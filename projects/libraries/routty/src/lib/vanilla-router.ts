import { decodeHistoryState, encodeHistoryState, HistoryManager, ZERO_SCROLL, type HistoryEntry, type HistoryUpdate, type ScrollPosition } from './history';
import { dispatchRouterLocationChange } from './router-events';
import {
  appendCatalogRoutes,
  createRouteCatalog,
  readCatalogRoutes,
  removeCatalogRoutes,
  replaceCatalogRoutes,
  type RouteCatalog,
} from './route-catalog';
import {
  commitNavigation,
} from './navigation-commit';
import {
  preloadRouteCatalog,
  prepareRouteRuntime,
  type RouteRuntime,
} from './route-runtime';
import {
  evaluateCanDeactivate,
  executeNavigation,
  RoutePreparationError,
  type ActiveRender,
  type NavigationFailure,
  type NavigationRequest,
  type NavigationResult,
  type PreparedOutlet,
} from './navigation-executor';
import {
  isPathInsideBase,
  normalizeBaseHref,
  getRouterLocation,
  resolveRouterUrl,
  routerHref,
  stripBaseHref
} from './router-url';

type MaybePromise<T> = T | PromiseLike<T>;

type RawRouteParams = Readonly<Record<string, string>>;

export type RouteParams =
  Readonly<Record<string, unknown>>;

export type RouteQuery =
  Readonly<Record<string, unknown>>;

export type RouteData =
  Readonly<Record<string, unknown>>;

export interface ActivatedRoute<
  TData extends RouteData = RouteData,
> {
  readonly url: URL;
  readonly path: string;
  /**
   * Parsed and validated path parameters.
   * Raw matcher captures remain internal to the router.
   */
  readonly params: RouteParams;

  /**
   * Parsed and validated search values.
   * Raw URLSearchParams remain available through `url.searchParams`.
   */
  readonly query: RouteQuery;

  readonly data: TData;
  readonly historyState: unknown;
  readonly config: Route;
}

export interface NavigationContext<
  TData extends RouteData = RouteData,
> extends ActivatedRoute<TData> {
  readonly signal: AbortSignal;
}

export interface DeactivationContext<
  TData extends RouteData = RouteData,
> extends ActivatedRoute<TData> {
  readonly nextUrl: URL;
  readonly signal: AbortSignal;
}

export interface RouteRenderContext {
  readonly signal: AbortSignal;
  readonly destroySignal: AbortSignal;
}

export interface RenderedRouteNode {
  readonly node: Node;
  readonly dispose?: () => void;
  readonly component?: unknown;
}

export type GuardResult =
  | boolean
  | string
  | { redirectTo: string; replace?: boolean };

export type CanActivateFn = (
  route: NavigationContext,
) => MaybePromise<GuardResult>;

export type CanDeactivateFn = (
  route: DeactivationContext,
) => MaybePromise<GuardResult>;

export type PrepareRouteDataResult =
  | void
  | RouteData;

export type PrepareRouteDataFn = (
  route: NavigationContext,
) => MaybePromise<PrepareRouteDataResult>;

export type RouteComponent = (
  route: ActivatedRoute,
  context: RouteRenderContext
) => MaybePromise<Node | RenderedRouteNode>;

export type ParseRouteParams = (
  params: RawRouteParams,
  url: URL,
  signal: AbortSignal,
) => MaybePromise<RouteParams>;

export type ParseRouteQuery = (
  url: URL,
  signal: AbortSignal,
) => MaybePromise<RouteQuery>;


export interface RouteBase {
  readonly name?: string;
  readonly path: string;
  readonly sourceRoute?: unknown;
  readonly data?: Record<string, unknown>;
}

export interface RedirectRoute extends RouteBase {
  readonly kind?: 'redirect';
  readonly redirectTo: string;
  readonly outlet?: never;
  readonly outlets?: never;
  readonly load?: never;
  readonly preload?: never;
  readonly viewTransition?: never;
  readonly canActivate?: never;
  readonly canDeactivate?: never;
  readonly prepare?: never;
}

export interface RenderableRoute extends RouteBase {
  readonly kind?: 'route';
  readonly outlet?: string;
  readonly outlets?: readonly RenderableRoute[];
  readonly load?: () => MaybePromise<RouteRuntime>;
  readonly preload?: boolean;
  readonly viewTransition?: boolean;
  readonly canActivate?: CanActivateFn[];
  readonly canDeactivate?: CanDeactivateFn[];
  readonly prepare?: readonly PrepareRouteDataFn[];
  readonly redirectTo?: never;
}

export type Route = RedirectRoute | RenderableRoute;

function isRedirectRoute(route: Route): route is RedirectRoute {
  return route.kind === 'redirect' || typeof route.redirectTo === 'string';
}

export interface NavigationTransition {
  readonly from: ActivatedRoute | null;
  readonly to: ActivatedRoute;
  readonly signal: AbortSignal;
}

export type NavigationTransitionFn = (
  transition: NavigationTransition,
) => MaybePromise<GuardResult | void>;

export interface NavigationTransitionDefinition {
  readonly from?: (
    route: ActivatedRoute | null,
  ) => boolean;
  readonly to?: (
    route: ActivatedRoute,
  ) => boolean;
  readonly beforeEnter?: readonly NavigationTransitionFn[];
  readonly prepare?: readonly NavigationTransitionFn[];
  readonly beforeLeave?: readonly NavigationTransitionFn[];
  readonly afterEnter?: readonly NavigationTransitionFn[];
}

export type NavigationPhase = 'recognizing' | 'guarding' | 'resolving' | 'loading' | null;

export interface NavigationOptions {
  replace?: boolean;
  state?: unknown;
}

export type ScrollRestorationMode = 'restore' | 'top' | 'preserve';
export type PreloadingStrategy = 'none' | 'eager' | 'idle';
export type ViewTransitionPhase = 'success' | 'not-found' | 'error';

export interface ViewTransitionContext {
  readonly url: URL;
  readonly from: ActivatedRoute | null;
  readonly to: ActivatedRoute | null;
  readonly phase: ViewTransitionPhase;
  readonly routeConfig: Route | null;
  readonly error?: unknown;
}

export type ViewTransitionsOption =
  | boolean
  | ((context: ViewTransitionContext) => boolean);

export interface RouterState {
  readonly current: ActivatedRoute | null;
  readonly pending: boolean;
  readonly phase: NavigationPhase;
  readonly error: unknown;
  readonly path: string;
  readonly params: RouteParams;
  readonly query: RouteQuery;
  readonly data: RouteData;
  readonly historyState: unknown;
  readonly routeConfig: Route | null;
}

export interface RouterConfiguration {
  readonly routes: readonly Route[];
  readonly transitions: readonly NavigationTransitionDefinition[];
}

export interface Router {
  readonly state: RouterState;
  readonly routeVersion: number;
  routes(): readonly Route[];
  addRoutes(routes: readonly Route[]): boolean;
  replaceConfiguration(configuration: RouterConfiguration): boolean;
  replaceRoutes(routes: readonly Route[]): boolean;
  removeRoutes(predicate: (route: Route) => boolean): boolean;
  replaceTransitions(transitions: readonly NavigationTransitionDefinition[]): boolean;
  start(): void;
  stop(): void;
  dispose(): void;
  navigate(target: string | URL, options?: NavigationOptions): Promise<boolean>;
  replace(target: string | URL, state?: unknown): Promise<boolean>;
  revalidate(): Promise<boolean>;
  updateHistoryState(state: unknown): void;
  preload(): Promise<void>;
  back(): void;
  forward(): void;
  href(target: string): string;
  createLink(to: string, text: string, className?: string): HTMLAnchorElement;
}

export interface RouterConfig {
  routes: Route[];
  transitions?: readonly NavigationTransitionDefinition[];
  /**
   * Default DOM outlet used when no custom named-outlet renderer is supplied.
   */
  outlet?: HTMLElement | null;
  baseHref?: string;
  enableTracing?: boolean;
  maxRedirects?: number;
  onSameUrlNavigation?: 'ignore';
  scrollRestoration?: ScrollRestorationMode;
  preloading?: PreloadingStrategy;
  viewTransitions?: ViewTransitionsOption;
  navigateExternal?: (url: URL) => void;
  onOutletActivate?: (outlet: HTMLElement, component: unknown) => void;
  render?: (outletName: string, node: Node, route: ActivatedRoute) => void;
  renderNotFound?: (outletName: string, url: URL, router: Router) => void;
  commit?: (outlets: readonly PreparedOutlet[]) => void;
  renderError?: (outletName: string, error: unknown, router: Router) => void;
  onStateChange?: (state: RouterState) => void;
}

interface NavigationCompletion {
  settled: boolean;
  resolve(success: boolean): void;
}

export type { PreparedOutlet } from './navigation-executor';

const EMPTY_PARAMS: RouteParams =
  Object.freeze({});

const EMPTY_QUERY: RouteQuery =
  Object.freeze({});

const EMPTY_DATA: RouteData =
  Object.freeze({});


function isRenderedRouteNode(value: unknown): value is RenderedRouteNode {
  return value !== null && typeof value === 'object' && 'node' in value;
}

function normalizeRenderedRouteNode(value: Node | RenderedRouteNode): RenderedRouteNode {
  return isRenderedRouteNode(value) ? value : { node: value };
}

function readRawQuery(
  url: URL,
): RouteQuery {
  const values:
    Record<string, string> = {};

  url.searchParams.forEach(
    (value, key) => {
      values[key] = value;
    },
  );

  return Object.freeze(values);
}


function executeGuard(
  guard: CanActivateFn,
  route: NavigationContext,
): MaybePromise<GuardResult> {
  return guard(route);
}

function executeDeactivationGuard(
  guard: CanDeactivateFn,
  route: DeactivationContext
): MaybePromise<GuardResult> {
  return guard(route);
}

function executePrepareRouteData(
  prepare: PrepareRouteDataFn,
  route: NavigationContext,
): MaybePromise<PrepareRouteDataResult> {
  return prepare(route);
}

function normalizePreparedRouteData(
  value: PrepareRouteDataResult,
): RouteData {
  if (value === undefined) {
    return EMPTY_DATA;
  }

  if (
    typeof value !== 'object'
    || value === null
    || Array.isArray(value)
  ) {
    throw new Error(
      'Route prepare handlers must return an object or void.',
    );
  }

  return Object.freeze({ ...value });
}

function mergeRouteData(
  entries: readonly RouteData[],
): RouteData {
  if (entries.length === 0) {
    return EMPTY_DATA;
  }

  return Object.freeze(
    Object.assign(
      {},
      ...entries,
    ),
  );
}

function executeTransition(
  transition: NavigationTransitionFn,
  context: NavigationTransition,
): MaybePromise<GuardResult | void> {
  return transition(context);
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('Navigation aborted', 'AbortError');
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error
    && (error as { name?: string }).name === 'AbortError';
}

function interpolateRedirect(
  redirectTo: string,
  params: RawRouteParams,
): string {
  return redirectTo.replace(/:([A-Za-z0-9_]+)/g, (_, key: string) => {
    if (!(key in params)) {
      throw new Error(`Missing route parameter "${key}" for redirect "${redirectTo}"`);
    }
    return encodeURIComponent(params[key]);
  });
}

function readRedirect(result: GuardResult): { redirectTo: string; replace: boolean } | null {
  if (typeof result === 'string') return { redirectTo: result, replace: true };
  if (result && typeof result === 'object' && 'redirectTo' in result) {
    return { redirectTo: result.redirectTo, replace: result.replace ?? true };
  }
  return null;
}

function replaceChildNodes(
  target: Node & {
    replaceChildren?: (...nodes: Node[]) => void;
    firstChild: ChildNode | null;
    removeChild(node: ChildNode): void;
    appendChild<T extends Node>(node: T): T;
  },
  ...nodes: Node[]
): void {
  if (typeof target.replaceChildren === 'function') {
    target.replaceChildren(...nodes);
    return;
  }

  while (target.firstChild) {
    target.removeChild(target.firstChild);
  }

  for (const node of nodes) {
    target.appendChild(node);
  }
}

function defaultRender(outlet: HTMLElement, node: Node): void {
  replaceChildNodes(outlet, node);
}



export function createRouter(config: RouterConfig): Router {
  let routeCatalog = createRouteCatalog(config.routes);
  const render = config.render;
  const renderNotFound = config.renderNotFound;
  const renderError = config.renderError;
  const commitOutlets = config.commit;
  let transitions = Object.freeze([...(config.transitions ?? [])]) as readonly NavigationTransitionDefinition[];
  const browserWindow = typeof window === 'undefined' ? null : window;
  const browserDocument = typeof document === 'undefined' ? null : document;
  const routerLocation = () =>
    browserWindow?.location ?? getRouterLocation(browserDocument);
  const navigateExternal = config.navigateExternal ?? ((url: URL) => {
    browserWindow?.location.assign(url.href);
  });
  const baseHref = normalizeBaseHref(config.baseHref ?? '/');
  const maxRedirects = config.maxRedirects ?? 10;
  const scrollRestoration = config.scrollRestoration ?? 'preserve';
  const preloading = config.preloading ?? 'none';
  const viewTransitions = config.viewTransitions ?? false;
  const history =
    new HistoryManager(browserWindow, routerLocation());

  let currentState: ActivatedRoute | null = null;
  let requestState: NavigationRequest | null = null;
  let navigationPhase: NavigationPhase = null;
  let errorState: unknown = null;

  let started = false;
  let disposed = false;
  let navigationId = 0;
  let latestRequestId = 0;
  let activeController: AbortController | null = null;
  const activeRenders = new Map<string, ActiveRender>();
  const activeRouteStates = new Map<string, ActivatedRoute>();
  let startRequestQueued = false;
  let preloadTask: Promise<void> | null = null;
  let preloadQueued = false;
  let preloadIdleId: number | null = null;
  let preloadTimeoutId: number | null = null;

  function trace(message: string, ...values: unknown[]): void {
    if (config.enableTracing) console.debug(`[Router] ${message}`, ...values);
  }

  function warn(message: string, ...values: unknown[]): void {
    console.warn(`[Router] ${message}`, ...values);
  }

  function resolveOutlet(): HTMLElement | null {
    return config.outlet ?? browserDocument?.getElementById('app') ?? null;
  }

  function matchesTransitionDefinition(
    definition: NavigationTransitionDefinition,
    from: ActivatedRoute | null,
    to: ActivatedRoute,
  ): boolean {
    return (definition.from?.(from) ?? true)
      && (definition.to?.(to) ?? true);
  }

  function collectTransitionPhase(
    phase: keyof Pick<
      NavigationTransitionDefinition,
      'beforeEnter' | 'prepare' | 'beforeLeave' | 'afterEnter'
    >,
    from: ActivatedRoute | null,
    to: ActivatedRoute,
  ): readonly NavigationTransitionFn[] {
    const handlers: NavigationTransitionFn[] = [];

    for (const definition of transitions) {
      if (!matchesTransitionDefinition(definition, from, to)) {
        continue;
      }

      handlers.push(...(definition[phase] ?? []));
    }

    return handlers;
  }

  async function runTransitionPhase(
    phase: keyof Pick<
      NavigationTransitionDefinition,
      'beforeEnter' | 'prepare' | 'beforeLeave'
    >,
    from: ActivatedRoute | null,
    to: ActivatedRoute,
    signal: AbortSignal,
  ): Promise<GuardResult> {
    const handlers = collectTransitionPhase(phase, from, to);

    for (const handler of handlers) {
      const result = await executeTransition(handler, {
        from,
        to,
        signal,
      });
      throwIfAborted(signal);

      if (result === undefined || result === true) {
        continue;
      }

      return result;
    }

    return true;
  }

  function runAfterEnterTransitions(
    from: ActivatedRoute | null,
    to: ActivatedRoute,
  ): void {
    const handlers = collectTransitionPhase('afterEnter', from, to);

    for (const handler of handlers) {
      void Promise.resolve(
        executeTransition(handler, {
          from,
          to,
          signal: new AbortController().signal,
        }),
      ).catch(error => trace('afterEnter transition failed', error));
    }
  }

  function createStatusRoute(url: URL): ActivatedRoute {
    return currentState ?? {
      url,
      path: stripBaseHref(url.pathname, baseHref),
      params: EMPTY_PARAMS,
      query: readRawQuery(url),
      data: EMPTY_DATA,
      historyState: decodeHistoryState(browserWindow?.history.state ?? null),
      config: readCatalogRoutes(routeCatalog)[0] ?? { path: '**' },
    };
  }

  function renderPrimaryNode(node: Node, route: ActivatedRoute): HTMLElement | null {
    if (render) {
      render('', node, route);
      return node.parentElement ?? resolveOutlet();
    }

    const outlet = resolveOutlet();
    if (outlet) {
      defaultRender(outlet, node);
    }
    return outlet;
  }

  function disposeRender(renderInstance: ActiveRender | null): void {
    if (!renderInstance) return;
    renderInstance.dispose();
  }

  function replaceActiveRender(
    outletName: string,
    renderInstance: ActiveRender | null,
  ): void {
    const previousRender =
      activeRenders.get(outletName) ?? null;

    if (renderInstance) {
      activeRenders.set(
        outletName,
        renderInstance,
      );
    } else {
      activeRenders.delete(
        outletName,
      );
    }

    disposeRender(previousRender);
  }

  function disposeAllRenders(): void {
    for (const renderInstance of activeRenders.values()) {
      disposeRender(renderInstance);
    }

    activeRenders.clear();
    activeRouteStates.clear();
  }  

  function clearOutlet(): void {
    const outlet = resolveOutlet();
    if (outlet) replaceChildNodes(outlet);
  }

  function currentHref(): string {
    const location = routerLocation();
    return location.pathname + location.search + location.hash;
  }

  function readScroll(): ScrollPosition {
    return {
      x: browserWindow?.scrollX ?? 0,
      y: browserWindow?.scrollY ?? 0,
    }
  }

  function scrollToPosition(position: ScrollPosition): void {
    browserWindow?.scrollTo(position.x, position.y);
  }

  function restoreScroll(update: HistoryUpdate): void {
    if (scrollRestoration === 'preserve') {
      return;
    }

    if (scrollRestoration === 'restore' && update.type === 'popstate') {
      scrollToPosition(update.nextEntry?.scroll ?? ZERO_SCROLL);
      return;
    }

    scrollToPosition(ZERO_SCROLL);
  }

  function restorePreviousScroll(update: HistoryUpdate): void {
    if (scrollRestoration === 'preserve') {
      return;
    }

    scrollToPosition(update.previousScroll);
  }

  function isInsideBase(pathname: string): boolean {
    return isPathInsideBase(pathname, baseHref);
  }

  function resolveAppUrl(target: string | URL, mode: 'navigate' | 'href'): URL {
    return resolveRouterUrl(target, baseHref, routerLocation(), mode);
  }

  function activeHref(): string | null {
    const url = currentState?.url;
    return url ? url.pathname + url.search + url.hash : null;
  }

  function restoreActiveUrl(): void {
    const active = activeHref();
    const fallback = history.createDefaultUpdate().previousEntry?.href ?? currentHref();
    const href =
      active ?? fallback;

    const currentEntry =
      history.createDefaultUpdate().previousEntry;

    browserWindow?.history.replaceState(
        currentEntry
          ? encodeHistoryState({
              ...currentEntry,
              state:
                currentState?.historyState
                ?? currentEntry.state,
            })
          : null,
        '',
        href,
      );

    dispatchRouterLocationChange();
  }

  function applyHistoryStateToRoute(
    route: ActivatedRoute,
    historyState: unknown,
  ): ActivatedRoute {
    return { ...route, historyState };
  }

  function updateHistoryState(state: unknown): void {
    if (disposed) {
      throw new Error('Cannot update history state on a disposed router');
    }

    const update = history.createDefaultUpdate();
    const entry = update.previousEntry;
    if (!entry) {
      throw new Error('History manager did not provide a current entry.');
    }

    const nextEntry: HistoryEntry = {
      id: entry.id,
      href: entry.href,
      scroll: readScroll(),
      state: state ?? null,
    };

    browserWindow?.history.replaceState(
        encodeHistoryState(nextEntry),
        '',
        nextEntry.href,
      );
    history.commitUpdate({ ...update, nextEntry }, nextEntry.href);
    dispatchRouterLocationChange();

    if (currentState) {
      currentState = applyHistoryStateToRoute(currentState, nextEntry.state);
      notifyStateChange();
    }
  }

  function shouldUseViewTransition(
    context: ViewTransitionContext,
  ): boolean {
    const routeOverride = context.routeConfig?.viewTransition;
    if (routeOverride !== undefined) return routeOverride;

    return typeof viewTransitions === 'function'
      ? viewTransitions(context)
      : viewTransitions;
  }

  function runWithViewTransition(
    context: ViewTransitionContext,
    action: () => void,
  ): void {
    if (!shouldUseViewTransition(context)) {
      action();
      return;
    }

    if (!browserDocument) {
      action();
      return;
    }

    const transitionDocument = browserDocument as Document & {
      startViewTransition?: (
        callback: () => void | PromiseLike<void>,
      ) => { finished: PromiseLike<unknown> };
    };
    const startViewTransition = transitionDocument.startViewTransition;

    if (typeof startViewTransition !== 'function') {
      action();
      return;
    }

    try {
      void Promise.resolve(
        startViewTransition.call(transitionDocument, () => action()).finished,
      ).catch(error => trace('View transition failed', error));
    } catch (error) {
      trace('View transition setup failed', error);
      action();
    }
  }

  function notifyOutletActivate(outlet: HTMLElement, component: unknown): void {
    config.onOutletActivate?.(outlet, component);
  }

  function createCompletion(): { completion: NavigationCompletion; promise: Promise<boolean> } {
    let resolve!: (success: boolean) => void;
    const promise = new Promise<boolean>(completion => {
      resolve = completion;
    });
    return { completion: { settled: false, resolve }, promise };
  }

  function settleRequest(request: NavigationRequest, success: boolean): void {
    if (request.completion.settled) return;
    request.completion.settled = true;
    request.completion.resolve(success);
  }

  function cancelActiveNavigation(): void {
    activeController?.abort();
    activeController = null;
    if (requestState) settleRequest(requestState, false);
  }

  function createRequest(
    url: URL,
    redirectCount: number,
    completion: NavigationCompletion | undefined,
    historyUpdate: HistoryUpdate,
    run: (request: NavigationRequest, signal: AbortSignal) => Promise<void>,
  ): Promise<boolean> {
    const pending = completion ? null : createCompletion();
    const request: NavigationRequest = {
      id: ++navigationId,
      url,
      redirectCount,
      completion: completion ?? pending!.completion,
      historyUpdate,
    };
    if (!completion) cancelActiveNavigation();
    latestRequestId = request.id;
    requestState = request;
    errorState = null;
    notifyStateChange();

    const controller = new AbortController();
    activeController = controller;
    void run(request, controller.signal);
    return pending?.promise ?? Promise.resolve(false);
  }

  function requestNavigation(
    url: URL,
    redirectCount = 0,
    completion?: NavigationCompletion,
    historyUpdate: HistoryUpdate = history.createDefaultUpdate(),
  ): Promise<boolean> {
    return createRequest(
      url,
      redirectCount,
      completion,
      historyUpdate,
      runNavigation,
    );
  }

  function requestExternalNavigation(
    url: URL,
    completion?: NavigationCompletion,
    historyUpdate: HistoryUpdate = history.createDefaultUpdate(),
  ): Promise<boolean> {
    return createRequest(
      url,
      0,
      completion,
      historyUpdate,
      runExternalNavigation,
    );
  }

  function notifyStateChange(): void {
    config.onStateChange?.(publicState);
  }

  function setPhase(
    request: NavigationRequest,
    phase: NavigationPhase,
  ): void {
    if (request.id !== latestRequestId) {
      return;
    }

    navigationPhase = phase;
    notifyStateChange();
  }



  function runPreloading(): Promise<void> {
    if (disposed) {
      return Promise.resolve();
    }

    return preloadRouteCatalog(
      readCatalogRoutes(routeCatalog),
      trace,
    );
  }

  function preload(): Promise<void> {
    preloadQueued = false;
    preloadTask ??= runPreloading().finally(() => {
      preloadTask = null;
    });
    return preloadTask;
  }

  function cancelScheduledPreloading(): void {
    if (preloadIdleId !== null) {
      const cancelIdle = (browserWindow as (Window & {
        cancelIdleCallback?: (id: number) => void;
      }) | null)?.cancelIdleCallback;

      cancelIdle?.(preloadIdleId);
      preloadIdleId = null;
    }

    if (preloadTimeoutId !== null) {
      browserWindow?.clearTimeout(preloadTimeoutId);
      preloadTimeoutId = null;
    }

    preloadQueued = false;
  }

  function schedulePreloading(): void {
    if (
      disposed ||
      preloading === 'none' ||
      preloadTask ||
      preloadQueued
    ) {
      return;
    }

    preloadQueued = true;

    const run = () => {
      preloadIdleId = null;
      preloadTimeoutId = null;

      if (disposed || !started) {
        preloadQueued = false;
        return;
      }

      void preload();
    };

    if (preloading === 'eager') {
      queueMicrotask(run);
      return;
    }

    const requestIdle = (browserWindow as (Window & {
      requestIdleCallback?: (callback: () => void) => number;
    }) | null)?.requestIdleCallback;

    if (typeof requestIdle === 'function') {
      preloadIdleId = requestIdle(run);
      return;
    }

    preloadTimeoutId = browserWindow?.setTimeout(run, 0) ?? null;
  }



  async function runNavigation(request: NavigationRequest, signal: AbortSignal): Promise<void> {
    if (disposed) return;

    try {
      const result = await executeNavigation(
        request,
        signal,
        {
          catalog: routeCatalog,
          baseHref,
          currentRoute: currentState,
          activeRoutes: activeRouteStates.size > 0
            ? [...activeRouteStates.values()]
            : currentState
              ? [currentState]
              : [],
          loadRoute: prepareRouteRuntime,
          runTransitionPhase,
          resolveAppUrl: target => resolveAppUrl(target, 'href'),
          setPhase,
          trace,
          warn,
        },
      );
      if (disposed || result.request.id !== latestRequestId) {
        if (result.type === 'success') {
          for (const outlet of result.outlets) {
            outlet.rendered.dispose();
          }
        }
        return;
      }
      commit(result);
    } catch (error) {
      if (signal.aborted || isAbortError(error)) return;
      const preparationError =
        error instanceof RoutePreparationError
          ? error
          : null;
      const failure: NavigationFailure = {
        type: 'error',
        request,
        error: preparationError?.originalError ?? error,
        preserveActive: preparationError?.preserveActive ?? false,
      };
      if (failure.request.id !== latestRequestId) return;
      commit(failure);
    } finally {
      if (activeController?.signal === signal) {
        activeController = null;
      }
    }
  }

  async function runExternalNavigation(
    request: NavigationRequest,
    signal: AbortSignal,
  ): Promise<void> {
    if (disposed) {
      settleRequest(request, false);
      return;
    }

    try {
      setPhase(request, 'guarding');

      const deactivationResult =
        await evaluateCanDeactivate(
          request.url,
          signal,
          {
            activeRoutes: activeRouteStates.size > 0
              ? [...activeRouteStates.values()]
              : currentState
                ? [currentState]
                : [],
            loadRoute: prepareRouteRuntime,
            resolveAppUrl: target =>
              resolveAppUrl(target, 'href'),
            warn,
          },
        );

      throwIfAborted(signal);

      if (request.id !== latestRequestId) {
        return;
      }

      const redirect =
        deactivationResult
          ? readRedirect(
              deactivationResult,
            )
          : null;

      if (redirect) {
        const redirectUrl =
          resolveAppUrl(
            redirect.redirectTo,
            'href',
          );

        if (
          redirectUrl.origin !==
          routerLocation().origin
        ) {
          requestState = null;
          navigationPhase = null;
          errorState = null;
          settleRequest(
            request,
            true,
          );
          notifyStateChange();
          navigateExternal(
            redirectUrl,
          );
          return;
        }

        const href =
          redirectUrl.pathname +
          redirectUrl.search +
          redirectUrl.hash;

        const historyState =
          decodeHistoryState(
            browserWindow?.history.state ?? null,
          );

        const historyUpdate =
          history.createUpdate(
            href,
            redirect.replace,
            historyState,
          );

        browserWindow?.history[
            redirect.replace
              ? 'replaceState'
              : 'pushState'
          ](
            encodeHistoryState(
              historyUpdate.nextEntry!,
            ),
            '',
            href,
          );

        dispatchRouterLocationChange();

        void requestNavigation(
          redirectUrl,
          0,
          request.completion,
          historyUpdate,
        );

        return;
      }

      if (
        deactivationResult === false
      ) {
        commit({
          type: 'blocked',
          request,
        });
        return;
      }

      requestState = null;
      navigationPhase = null;
      errorState = null;

      settleRequest(
        request,
        true,
      );

      notifyStateChange();
      navigateExternal(
        request.url,
      );
    } catch (error) {
      if (
        signal.aborted ||
        isAbortError(error)
      ) {
        return;
      }

      if (
        request.id !==
        latestRequestId
      ) {
        return;
      }

      commit({
        type: 'error',
        request,
        error,
      });
    } finally {
      if (
        activeController?.signal ===
        signal
      ) {
        activeController = null;
      }
    }
  }

  function commit(result: NavigationResult): void {
    commitNavigation(result, {
      disposed: () => disposed,
      latestRequestId: () => latestRequestId,
      maxRedirects,
      currentRoute: () => currentState,
      setCurrentRoute: route => {
        currentState = route;
      },
      clearPendingState: () => {
        requestState = null;
        navigationPhase = null;
      },
      setError: error => {
        errorState = error;
      },

      runWithViewTransition,
      customCommit: commitOutlets,
      render: (outletName, node, route) => {
        if (!render) {
          throw new Error(
            `No renderer is configured for outlet "${outletName}"`,
          );
        }
        render(outletName, node, route);
      },
      renderPrimary: (node, route) => {
        renderPrimaryNode(node, route);
      },
      renderNotFound: url => {
        if (renderNotFound) {
          renderNotFound('', url, publicRouter);
          return;
        }

        const heading = browserDocument?.createElement('h1');
        if (!heading) return;
        heading.textContent = '404 — Page Not Found';
        renderPrimaryNode(heading, createStatusRoute(url));
      },
      renderError: (error, url) => {
        if (renderError) {
          renderError('', error, publicRouter);
          return;
        }

        const heading = browserDocument?.createElement('h1');
        if (!heading) return;
        heading.textContent = 'Page failed to load';
        renderPrimaryNode(heading, createStatusRoute(url));
      },
      resolveOutlet,
      notifyOutletActivate,

      activeRenders,
      activeRoutes: activeRouteStates,
      disposeRender,
      replaceActiveRender,
      disposeAllRenders,

      commitHistory: (update, href) => {
        history.commitUpdate(update, href);
      },
      rollbackHistory: update => {
        history.rollbackUpdate(update);
      },
      createHistoryUpdate: (href, replace, state) =>
        history.createUpdate(href, replace, state),
      readHistoryState: () => decodeHistoryState(browserWindow?.history.state ?? null),
      writeHistory: (href, replace, _state, update) => {
        browserWindow?.history[
          replace ? 'replaceState' : 'pushState'
        ](
          encodeHistoryState(update.nextEntry!),
          '',
          href,
        );
      },
      dispatchLocationChange: dispatchRouterLocationChange,

      resolveAppUrl: target => resolveAppUrl(target, 'href'),
      currentOrigin: () => routerLocation().origin,
      requestNavigation: (url, redirectCount, completion, update) => {
        void requestNavigation(url, redirectCount, completion, update);
      },
      requestExternalNavigation: (url, completion, update) => {
        void requestExternalNavigation(url, completion, update);
      },

      restoreActiveUrl,
      restoreScroll,
      restorePreviousScroll,
      settleRequest: (completion, success) => {
        if (completion.settled) return;
        completion.settled = true;
        completion.resolve(success);
      },
      notifyStateChange,
      runAfterEnterTransitions,
      dispatchRouteChange: route => {
        browserWindow?.dispatchEvent(
          new CustomEvent('routechange', { detail: route }),
        );
      },
      trace,
    });
  }

  function handlePopState(): void {
    const location = routerLocation();
    const update = history.createPopStateUpdate(currentHref());
    const targetHref = update.nextEntry?.href ?? currentHref();

    requestNavigation(
      new URL(targetHref, location.origin),
      0,
      undefined,
      update,
    );
  }

  function handleClick(event: MouseEvent): void {
    if (disposed || !started) return;
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) return;

    const anchor = target.closest('a[href]');
    if (!(anchor instanceof HTMLAnchorElement)) return;
    if (anchor.target && anchor.target !== '_self') return;
    if (anchor.hasAttribute('download') || anchor.rel.split(/\s+/).includes('external')) return;

    const location = routerLocation();
    const url = new URL(anchor.href, location.href);
    if (url.origin !== location.origin || !isInsideBase(url.pathname)) {
      return;
    }

    if (url.pathname === location.pathname && url.search === location.search && url.hash) {
      return;
    }

    event.preventDefault();
    navigate(url);
  }

  function navigate(target: string | URL, options: NavigationOptions = {}): Promise<boolean> {
    if (disposed) throw new Error('Cannot navigate with a disposed router');
    const url = resolveAppUrl(target, 'navigate');

    if (
      url.origin !==
      routerLocation().origin
    ) {
      return requestExternalNavigation(
        url,
        undefined,
        history.createDefaultUpdate(),
      );
    }

    if (!isInsideBase(url.pathname)) {
      throw new Error(`URL "${url.pathname}" is outside router base "${baseHref}"`);
    }

    if (config.onSameUrlNavigation === 'ignore' && currentState?.url.href === url.href) {
      return Promise.resolve(false);
    }

    const href = url.pathname + url.search + url.hash;
    const historyState = options.state ?? null;
    const historyUpdate = history.createUpdate(href, options.replace ?? false, historyState);
    browserWindow?.history[options.replace ? 'replaceState' : 'pushState'](encodeHistoryState(historyUpdate.nextEntry!), '', href);
    dispatchRouterLocationChange();
    return requestNavigation(url, 0, undefined, historyUpdate);
  }

  function replace(target: string | URL, state?: unknown): Promise<boolean> {
    return navigate(target, { replace: true, state });
  }

  function revalidate(): Promise<boolean> {
    if (disposed) {
      throw new Error('Cannot revalidate with a disposed router');
    }

    const url = new URL(routerLocation().href);

    if (
      url.origin !==
      routerLocation().origin
    ) {
      return requestExternalNavigation(
        url,
        undefined,
        history.createDefaultUpdate(),
      );
    }

    if (!isInsideBase(url.pathname)) {
      throw new Error(
        `URL "${url.pathname}" is outside router base "${baseHref}"`,
      );
    }

    // Revalidation intentionally bypasses onSameUrlNavigation. It performs a
    // complete navigation transaction for the current URL without mutating
    // browser history, allowing guards, prepare handlers, layouts, and named
    // outlets to be rebuilt after external authority or session state changes.
    return requestNavigation(
      url,
      0,
      undefined,
      history.createDefaultUpdate(),
    );
  }


  function sameTransitionReferences(
    nextTransitions: readonly NavigationTransitionDefinition[],
  ): boolean {
    return (
      transitions.length === nextTransitions.length
      && transitions.every(
        (transition, index) =>
          transition === nextTransitions[index],
      )
    );
  }

  function applyConfiguration(
    nextCatalog: RouteCatalog,
    nextTransitions: readonly NavigationTransitionDefinition[],
  ): boolean {
    const routesChanged =
      nextCatalog !== routeCatalog;
    const transitionsChanged =
      !sameTransitionReferences(nextTransitions);

    if (!routesChanged && !transitionsChanged) {
      return false;
    }

    // One configuration transaction owns one cancellation, even when both
    // routes and transitions change together.
    cancelActiveNavigation();

    if (routesChanged) {
      routeCatalog = nextCatalog;
      cancelScheduledPreloading();
    }

    if (transitionsChanged) {
      transitions =
        Object.freeze([...nextTransitions]);
    }

    if (routesChanged) {
      schedulePreloading();
    }

    return true;
  }

  function addRoutes(routes: readonly Route[]): boolean {
    if (disposed) {
      throw new Error('Cannot add routes to a disposed router');
    }

    return applyConfiguration(
      appendCatalogRoutes(routeCatalog, routes),
      transitions,
    );
  }

  function replaceConfiguration(
    configuration: RouterConfiguration,
  ): boolean {
    if (disposed) {
      throw new Error(
        'Cannot replace configuration on a disposed router',
      );
    }

    // Build and validate the next catalog before cancelling the current
    // navigation. A rejected configuration leaves the active router untouched.
    const nextCatalog = replaceCatalogRoutes(
      routeCatalog,
      configuration.routes,
    );

    return applyConfiguration(
      nextCatalog,
      configuration.transitions,
    );
  }

  function replaceRoutes(routes: readonly Route[]): boolean {
    if (disposed) {
      throw new Error('Cannot replace routes on a disposed router');
    }

    return applyConfiguration(
      replaceCatalogRoutes(routeCatalog, routes),
      transitions,
    );
  }

  function removeRoutes(predicate: (route: Route) => boolean): boolean {
    if (disposed) {
      throw new Error('Cannot remove routes from a disposed router');
    }

    return applyConfiguration(
      removeCatalogRoutes(routeCatalog, predicate),
      transitions,
    );
  }

  function replaceTransitions(
    nextTransitions: readonly NavigationTransitionDefinition[],
  ): boolean {
    if (disposed) {
      throw new Error('Cannot replace transitions on a disposed router');
    }

    return applyConfiguration(
      routeCatalog,
      nextTransitions,
    );
  }

  function startRouter(): void {
    if (disposed) {
      throw new Error(
        'Cannot start a disposed router',
      );
    }

    if (started) {
      return;
    }

    started = true;
    browserWindow?.addEventListener(
        'popstate',
        handlePopState,
      );
    browserDocument?.addEventListener(
        'click',
        handleClick,
      );
    schedulePreloading();

    // Starting the router must be synchronous from the caller's point of
    // view. Queue initial URL recognition so `state.pending` remains false
    // immediately after start(), and let an explicit navigate() win.
    if (startRequestQueued) {
      return;
    }

    startRequestQueued = true;

    queueMicrotask(() => {
      startRequestQueued = false;

      if (
        !started ||
        disposed ||
        currentState !== null ||
        requestState !== null
      ) {
        return;
      }

      void requestNavigation(
        new URL(routerLocation().href),
        0,
        undefined,
        history.createDefaultUpdate(),
      );
    });
  }

  function stopRouter(): void {
    cancelScheduledPreloading();

    if (!started) {
      cancelActiveNavigation();
      return;
    }

    browserWindow?.removeEventListener('popstate', handlePopState);
    browserDocument?.removeEventListener('click', handleClick);
    cancelActiveNavigation();
    disposeAllRenders();
    clearOutlet();
    started = false;
    startRequestQueued = false;
    requestState = null;
    navigationPhase = null;
    errorState = null;
    currentState = null;
    notifyStateChange();
  }

  function href(target: string): string {
    const url = resolveAppUrl(target, 'href');
    return routerHref(url);
  }

  function createLink(to: string, text: string, className = ''): HTMLAnchorElement {
    if (!browserDocument) {
      throw new Error('Cannot create a router link without a document.');
    }

    const link = browserDocument.createElement('a');
    link.href = href(to);
    link.textContent = text;
    if (className) link.className = className;
    return link;
  }

  let publicRouter: Router;

  const publicState: RouterState = {
    get current() {
      if (disposed) return null;
      return currentState;
    },
    get pending() {
      if (disposed) return false;
      return requestState !== null;
    },
    get phase() {
      if (disposed) return null;
      return navigationPhase;
    },
    get error() {
      if (disposed) return null;
      return errorState;
    },
    get path() {
      if (disposed) return '';
      return currentState?.path ?? '';
    },
    get params() {
      if (disposed) return EMPTY_PARAMS;
      return currentState?.params ?? EMPTY_PARAMS;
    },
    get query() {
      if (disposed) return EMPTY_QUERY;
      return currentState?.query ?? EMPTY_QUERY;
    },
    get data() {
      if (disposed) return EMPTY_DATA;
      return currentState?.data ?? EMPTY_DATA;
    },
    get historyState() {
      if (disposed) return null;
      return currentState?.historyState ?? history.createDefaultUpdate().previousEntry?.state ?? null;
    },
    get routeConfig() {
      if (disposed) return null;
      return currentState?.config ?? null;
    },
  };

  publicRouter = {
    state: publicState,
    get routeVersion() {
      return routeCatalog.version;
    },
    routes: () => readCatalogRoutes(routeCatalog),
    addRoutes: (routes) => addRoutes(routes),
    replaceConfiguration: (configuration) =>
      replaceConfiguration(configuration),
    replaceRoutes: (routes) => replaceRoutes(routes),
    removeRoutes: (predicate) => removeRoutes(predicate),
    replaceTransitions: (nextTransitions) => replaceTransitions(nextTransitions),
    start: () => startRouter(),
    stop: () => stopRouter(),
    dispose: () => {
      if (disposed) return;
      stopRouter();
      disposed = true;
    },
    navigate: (target, options) => navigate(target, options),
    replace: (target, state) => replace(target, state),
    revalidate: () => revalidate(),
    updateHistoryState: (state) => updateHistoryState(state),
    preload: () => preload(),
    back: () => browserWindow?.history.back(),
    forward: () => browserWindow?.history.forward(),
    href: (target) => href(target),
    createLink: (to, text, className) => createLink(to, text, className),
  };

  return publicRouter;
}

export type VanillaRouterInstance = ReturnType<typeof createRouter>;