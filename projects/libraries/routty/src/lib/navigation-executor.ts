import type { HistoryUpdate } from './history';
import type { RouteRuntime } from './route-runtime';
import {
  recognizeRoute,
  type RouteCatalog,
} from './route-catalog';
import { stripBaseHref } from './router-url';

import type {
  ActivatedRoute,
  GuardResult,
  NavigationContext,
  NavigationPhase,
  NavigationTransitionDefinition,
  NavigationTransitionFn,
  PrepareRouteDataFn,
  RenderableRoute,
  Route,
  RouteData,
  RouteParams,
  RouteQuery,
} from './vanilla-router';

export interface NavigationCompletion {
  settled: boolean;
  resolve(success: boolean): void;
}

export interface NavigationRequest {
  readonly id: number;
  readonly url: URL;
  readonly redirectCount: number;
  readonly completion: NavigationCompletion;
  readonly historyUpdate: HistoryUpdate;
}

export interface ActiveRender {
  readonly controller: AbortController;
  readonly dispose: () => void;
}

export interface PreparedOutlet {
  readonly name: string;
  readonly route: ActivatedRoute;
  readonly node: Node;
  readonly component?: unknown;
  readonly rendered: ActiveRender;
}

export interface NavigationSuccess {
  readonly type: 'success';
  readonly request: NavigationRequest;
  readonly route: ActivatedRoute;
  readonly outlets: readonly PreparedOutlet[];
}

export interface NavigationRedirect {
  readonly type: 'redirect';
  readonly request: NavigationRequest;
  readonly redirectTo: string;
  readonly replace: boolean;
}

export interface NavigationBlocked {
  readonly type: 'blocked';
  readonly request: NavigationRequest;
}

export interface NavigationNotFound {
  readonly type: 'not-found';
  readonly request: NavigationRequest;
}

export interface NavigationFailure {
  readonly type: 'error';
  readonly request: NavigationRequest;
  readonly error: unknown;
  readonly preserveActive?: boolean;
}

export type NavigationResult =
  | NavigationSuccess
  | NavigationRedirect
  | NavigationBlocked
  | NavigationNotFound
  | NavigationFailure;

export class RoutePreparationError extends Error {
  constructor(
    readonly originalError: unknown,
    readonly preserveActive: boolean,
  ) {
    super(
      originalError instanceof Error
        ? originalError.message
        : String(originalError),
      { cause: originalError },
    );
    this.name = 'RoutePreparationError';
  }
}

export interface CanDeactivateEvaluationContext {
  readonly activeRoutes: readonly ActivatedRoute[];
  readonly loadRoute: (route: RenderableRoute) => Promise<RouteRuntime>;
  readonly resolveAppUrl: (target: string) => URL;
  readonly warn: (message: string, ...values: unknown[]) => void;
}

export interface NavigationExecutionContext
  extends CanDeactivateEvaluationContext {
  readonly catalog: RouteCatalog;
  readonly baseHref: string;
  readonly currentRoute: ActivatedRoute | null;
  readonly runTransitionPhase: (
    phase: keyof Pick<
      NavigationTransitionDefinition,
      'beforeEnter' | 'prepare' | 'beforeLeave'
    >,
    from: ActivatedRoute | null,
    to: ActivatedRoute,
    signal: AbortSignal,
  ) => Promise<GuardResult>;
  readonly setPhase: (
    request: NavigationRequest,
    phase: NavigationPhase,
  ) => void;
  readonly trace: (message: string, ...values: unknown[]) => void;
}

const EMPTY_DATA: RouteData = Object.freeze({});

export async function executeNavigation(
  request: NavigationRequest,
  signal: AbortSignal,
  context: NavigationExecutionContext,
): Promise<NavigationResult> {
  context.trace('Navigation started', request.url.href);
  context.setPhase(request, 'recognizing');

  const path = stripBaseHref(
    request.url.pathname,
    context.baseHref,
  );
  const match = recognizeRoute(context.catalog, path);
  throwIfAborted(signal);

  if (!match) {
    context.setPhase(request, 'guarding');
    const result = await evaluateCanDeactivate(
      request.url,
      signal,
      context,
    );

    if (result === false) {
      return { type: 'blocked', request };
    }

    const redirect = readRedirect(result);
    return redirect
      ? { type: 'redirect', request, ...redirect }
      : { type: 'not-found', request };
  }

  const primaryRoute = match.route;

  if (isRedirectRoute(primaryRoute)) {
    return {
      type: 'redirect',
      request,
      redirectTo: interpolateRedirect(
        primaryRoute.redirectTo,
        match.params,
      ),
      replace: true,
    };
  }

  const routes: readonly RenderableRoute[] = [
    primaryRoute,
    ...(primaryRoute.outlets ?? []),
  ];
  const historyState =
    request.historyUpdate.nextEntry?.state
    ?? request.historyUpdate.previousEntry?.state
    ?? null;

  let loadedRoutes: RouteRuntime[];
  try {
    loadedRoutes = await Promise.all(
      routes.map(context.loadRoute),
    );
  } catch (error) {
    throw new RoutePreparationError(
      error,
      context.currentRoute !== null && routes.length > 1,
    );
  }
  throwIfAborted(signal);

  validateOutletParsers(routes, loadedRoutes);

  const primaryLoaded = loadedRoutes[0];
  const [parsedParams, parsedQuery] = await Promise.all([
    primaryLoaded.parseParams
      ? primaryLoaded.parseParams(match.params, request.url, signal)
      : Promise.resolve(
          Object.freeze({ ...match.params }) as RouteParams,
        ),
    primaryLoaded.parseQuery
      ? primaryLoaded.parseQuery(request.url, signal)
      : Promise.resolve(readRawQuery(request.url)),
  ]);
  throwIfAborted(signal);

  const sharedParams = Object.freeze({ ...parsedParams });
  const sharedQuery = Object.freeze({ ...parsedQuery });
  const baseRoutes = routes.map<ActivatedRoute>(route => ({
    url: request.url,
    path,
    params: sharedParams,
    query: sharedQuery,
    data: Object.freeze(route.data ?? {}),
    historyState,
    config: route,
  }));

  context.setPhase(request, 'guarding');

  const transitionResult = await runRouteGuards(
    request,
    signal,
    context,
    baseRoutes,
    loadedRoutes,
  );
  if (transitionResult) {
    return transitionResult;
  }

  context.setPhase(request, 'resolving');
  const activatedRoutes = await prepareRoutes(
    baseRoutes,
    loadedRoutes,
    signal,
  );

  context.setPhase(request, 'loading');
  const outlets = await renderRoutes(
    activatedRoutes,
    loadedRoutes,
    signal,
    context.currentRoute !== null && routes.length > 1,
  );

  return {
    type: 'success',
    request,
    route: activatedRoutes[0],
    outlets,
  };
}

async function runRouteGuards(
  request: NavigationRequest,
  signal: AbortSignal,
  context: NavigationExecutionContext,
  baseRoutes: readonly ActivatedRoute[],
  loadedRoutes: readonly RouteRuntime[],
): Promise<NavigationRedirect | NavigationBlocked | null> {
  const beforeLeave = await context.runTransitionPhase(
    'beforeLeave',
    context.currentRoute,
    baseRoutes[0],
    signal,
  );
  const first = guardResult(request, beforeLeave);
  if (first) return first;

  const deactivation = await evaluateCanDeactivate(
    request.url,
    signal,
    context,
  );
  const second = guardResult(request, deactivation);
  if (second) return second;

  const beforeEnter = await context.runTransitionPhase(
    'beforeEnter',
    context.currentRoute,
    baseRoutes[0],
    signal,
  );
  const third = guardResult(request, beforeEnter);
  if (third) return third;

  for (let index = 0; index < loadedRoutes.length; index++) {
    const routeContext: NavigationContext = {
      ...baseRoutes[index],
      signal,
    };

    for (const guard of loadedRoutes[index].canActivate ?? []) {
      const result = await guard(routeContext);
      throwIfAborted(signal);
      const guarded = guardResult(request, result);
      if (guarded) return guarded;
    }
  }

  const prepare = await context.runTransitionPhase(
    'prepare',
    context.currentRoute,
    baseRoutes[0],
    signal,
  );
  return guardResult(request, prepare);
}

export async function evaluateCanDeactivate(
  nextUrl: URL,
  signal: AbortSignal,
  context: CanDeactivateEvaluationContext,
): Promise<GuardResult> {
  for (const activeRoute of context.activeRoutes) {
    const route = requireRenderableRoute(activeRoute.config);
    const loaded = await context.loadRoute(route);
    throwIfAborted(signal);

    for (const guard of loaded.canDeactivate ?? []) {
      const result = await guard({
        ...activeRoute,
        nextUrl,
        signal,
      });
      throwIfAborted(signal);

      const redirect = readRedirect(result);
      if (redirect) {
        const redirectUrl = context.resolveAppUrl(redirect.redirectTo);
        if (redirectUrl.href === nextUrl.href) {
          context.warn(
            'Ignoring canDeactivate redirect to the pending URL',
            redirect.redirectTo,
          );
          continue;
        }
        return redirect;
      }

      if (result === false) return false;
    }
  }

  return true;
}

async function prepareRoutes(
  baseRoutes: readonly ActivatedRoute[],
  loadedRoutes: readonly RouteRuntime[],
  signal: AbortSignal,
): Promise<readonly ActivatedRoute[]> {
  const prepared = new WeakMap<
    PrepareRouteDataFn,
    Promise<RouteData>
  >();

  return Promise.all(
    baseRoutes.map(async (baseRoute, index) => {
      const routeContext: NavigationContext = {
        ...baseRoute,
        signal,
      };
      const data = mergeRouteData(
        await Promise.all(
          (loadedRoutes[index].prepare ?? []).map(handler => {
            let pending = prepared.get(handler);
            if (!pending) {
              pending = Promise.resolve(handler(routeContext))
                .then(normalizePreparedRouteData);
              prepared.set(handler, pending);
            }
            return pending;
          }),
        ),
      );
      throwIfAborted(signal);

      return {
        ...baseRoute,
        data: mergeRouteData([baseRoute.data, data]),
      };
    }),
  );
}

async function renderRoutes(
  routes: readonly ActivatedRoute[],
  loadedRoutes: readonly RouteRuntime[],
  signal: AbortSignal,
  preserveActive: boolean,
): Promise<readonly PreparedOutlet[]> {
  const prepared: PreparedOutlet[] = [];

  try {
    for (let index = 0; index < routes.length; index++) {
      const route = routes[index];
      const rendered = await renderMatchedRoute(
        route,
        loadedRoutes[index],
        signal,
      );
      prepared.push({
        name: route.config.outlet?.trim() ?? '',
        route,
        ...rendered,
      });
    }
  } catch (error) {
    for (let index = prepared.length - 1; index >= 0; index--) {
      try {
        prepared[index].rendered.dispose();
      } catch {}
    }
    throw new RoutePreparationError(error, preserveActive);
  }

  return Object.freeze(prepared);
}

async function renderMatchedRoute(
  route: ActivatedRoute,
  loaded: RouteRuntime,
  signal: AbortSignal,
): Promise<{
  readonly node: Node;
  readonly component?: unknown;
  readonly rendered: ActiveRender;
}> {
  const destroyController = new AbortController();
  let output:
    | {
        readonly node: Node;
        readonly dispose?: () => void;
        readonly component?: unknown;
      }
    | undefined;

  const abortPreparedRender = () => {
    destroyController.abort();
  };

  throwIfAborted(signal);

  if (!loaded.component) {
    throw new Error(
      `Matched route "${route.config.path}" has no component`,
    );
  }

  // A component can perform asynchronous rendering. Propagate cancellation to
  // its destroySignal immediately instead of waiting for the component promise
  // to settle and for renderRoutes() to clean up earlier outlets.
  signal.addEventListener(
    'abort',
    abortPreparedRender,
    { once: true },
  );

  try {
    const value = await loaded.component(route, {
      signal,
      destroySignal: destroyController.signal,
    });

    output = isRenderedRouteNode(value)
      ? value
      : { node: value };

    throwIfAborted(signal);

    // Once preparation succeeds, navigation cancellation no longer owns this
    // render. Its lifetime is transferred to the prepared/active render.
    signal.removeEventListener(
      'abort',
      abortPreparedRender,
    );

    let disposed = false;

    return {
      node: output.node,
      component: output.component,
      rendered: {
        controller: destroyController,
        dispose: () => {
          if (disposed) {
            return;
          }

          disposed = true;
          destroyController.abort();
          output?.dispose?.();
        },
      },
    };
  } catch (error) {
    signal.removeEventListener(
      'abort',
      abortPreparedRender,
    );

    destroyController.abort();
    output?.dispose?.();

    throw error;
  }
}

function validateOutletParsers(
  routes: readonly RenderableRoute[],
  loadedRoutes: readonly RouteRuntime[],
): void {
  for (let index = 1; index < loadedRoutes.length; index++) {
    if (loadedRoutes[index].parseParams || loadedRoutes[index].parseQuery) {
      throw new Error(
        `Outlet "${routes[index].outlet}" cannot define parseParams or parseQuery`,
      );
    }
  }
}

function guardResult(
  request: NavigationRequest,
  result: GuardResult | void,
): NavigationRedirect | NavigationBlocked | null {
  const redirect = readRedirect(result);
  if (redirect) {
    return { type: 'redirect', request, ...redirect };
  }
  return result === false
    ? { type: 'blocked', request }
    : null;
}

function readRedirect(
  result: GuardResult | void,
): { readonly redirectTo: string; readonly replace: boolean } | null {
  if (typeof result === 'string') {
    return { redirectTo: result, replace: true };
  }
  if (result && typeof result === 'object' && 'redirectTo' in result) {
    return {
      redirectTo: result.redirectTo,
      replace: result.replace ?? true,
    };
  }
  return null;
}

function interpolateRedirect(
  redirectTo: string,
  params: Readonly<Record<string, string>>,
): string {
  return redirectTo.replace(
    /:([A-Za-z0-9_]+)/g,
    (_, key: string) => {
      if (!(key in params)) {
        throw new Error(
          `Missing route parameter "${key}" for redirect "${redirectTo}"`,
        );
      }
      return encodeURIComponent(params[key]);
    },
  );
}

function readRawQuery(url: URL): RouteQuery {
  const values: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    values[key] = value;
  });
  return Object.freeze(values);
}

function normalizePreparedRouteData(
  value: void | RouteData,
): RouteData {
  if (value === undefined) return EMPTY_DATA;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(
      'Route prepare handlers must return an object or void.',
    );
  }
  return Object.freeze({ ...value });
}

function mergeRouteData(
  entries: readonly RouteData[],
): RouteData {
  return entries.length === 0
    ? EMPTY_DATA
    : Object.freeze(Object.assign({}, ...entries));
}

function isRedirectRoute(
  route: Route,
): route is Route & { readonly redirectTo: string } {
  return route.kind === 'redirect'
    || typeof route.redirectTo === 'string';
}

function isRenderedRouteNode(
  value: unknown,
): value is {
  readonly node: Node;
  readonly dispose?: () => void;
  readonly component?: unknown;
} {
  return value !== null
    && typeof value === 'object'
    && 'node' in value;
}

function requireRenderableRoute(
  route: ActivatedRoute['config'],
): RenderableRoute {
  if (
    route.kind === 'redirect'
    || typeof route.redirectTo === 'string'
  ) {
    throw new Error(
      `Active route "${route.path}" cannot be a redirect route.`,
    );
  }

  return route;
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException('Navigation aborted', 'AbortError');
  }
}
