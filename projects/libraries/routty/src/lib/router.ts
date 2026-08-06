import { APP_BASE_HREF, DOCUMENT } from '@angular/common';

import {
  ApplicationRef,
  DestroyRef,
  EnvironmentInjector,
  InjectionToken,
  inject,
  runInInjectionContext,
  type Provider,
  type Type,
} from '@angular/core';

import { runWithInjector, unwrapDefault } from './adapter-utils';

import type { NamedNavigationTarget, NavigationTarget } from './navigation-targets';

import { CompiledRoute, CompiledRouteGroup, createRouteRegistry } from './route-compiler';

import {
  composeAngularLeafRouteView,
  composeAngularRouteView,
  type ResolvedRouteView,
} from './route-renderer';

import type {
  FramePrepareFn,
  MaybePromise,
  FrameView,
  LayoutDefinition,
  LayoutOptions,
  RedirectRouteDefinition,
  RenderableRoute,
  RouteDefinition,
  RouteOptions,
  NavigationTree,
} from './navigation-definitions';

import type { TypedHref, TypedNavigate } from './typed-navigation';
import type { RouteRuntime } from './route-runtime';

import { OUTLET_ACTIVATE_EVENT, dispatchOutletLifecycleEvent } from './router-events';

import { getRouterLocation, resolveRouterUrl, routerHref } from './router-url';

import {
  parseParamsRecord,
  parseQueryRecord,
  serializeParams,
  serializeQuery,
  type InferParamType,
  type ParamSchemaRecord,
} from './query-schema';

import {
  type CanActivateFn,
  type CanDeactivateFn,
  createRouter,
  type ActivatedRoute,
  type NavigationTransitionFn,
  type NavigationContext,
  type NavigationOptions,
  type NavigationTransitionDefinition,
  type PrepareRouteDataFn,
  type PreloadingStrategy,
  type RedirectRoute,
  type RenderableRoute as RuntimeRenderableRoute,
  type Route,
  type RouteRenderContext,
  type Router as VanillaRouter,
  type RouterState,
  type ScrollRestorationMode,
  type ViewTransitionsOption,
} from './vanilla-router';

export interface RouterOptions {
  readonly baseHref?: string;
  readonly enableTracing?: boolean;
  readonly maxRedirects?: number;
  readonly onSameUrlNavigation?: 'ignore';
  readonly scrollRestoration?: ScrollRestorationMode;
  readonly preloading?: PreloadingStrategy;
  readonly viewTransitions?: ViewTransitionsOption;
}

export const ROUTE = new InjectionToken<ActivatedRoute>('ROUTE');

export const ROUTE_CONTEXT = new InjectionToken<RouteRenderContext>('ROUTE_CONTEXT');

interface RouterConfiguration<
  TRoutes extends NavigationTree = NavigationTree,
> extends RouterOptions {
  readonly routes: TRoutes;
}

const ROUTER_CONFIGURATION = new InjectionToken<RouterConfiguration>('ROUTER_CONFIGURATION');

const EMPTY_ROUTER_STATE: RouterState = Object.freeze({
  current: null,
  pending: false,
  phase: null,
  error: null,
  path: '',
  params: Object.freeze({}),
  query: Object.freeze({}),
  data: Object.freeze({}),
  historyState: null,
  routeConfig: null,
});

const lazyComponents = new WeakMap<object, Promise<Type<unknown>>>();

function loadComponent(owner: LayoutDefinition | RenderableRoute): Promise<Type<unknown>> {
  if (owner.component) {
    return Promise.resolve(owner.component);
  }

  if (!owner.loadComponent) {
    return Promise.reject(new Error('A route view must define component or loadComponent.'));
  }

  let pending = lazyComponents.get(owner);

  if (!pending) {
    pending = Promise.resolve(owner.loadComponent())
      .then((value) =>
        unwrapDefault<Type<unknown>>(value as Type<unknown> | { readonly default: Type<unknown> }),
      )
      .then((component) => {
        if (!component) {
          throw new Error('Lazy component loader returned no component.');
        }

        return component;
      })
      .catch((error) => {
        lazyComponents.delete(owner);

        throw error;
      });

    lazyComponents.set(owner, pending);
  }

  return pending;
}

function snapshotRouterState(state: RouterState): RouterState {
  return Object.freeze({
    current: state.current ?? null,
    pending: state.pending ?? false,
    phase: state.phase ?? null,
    error: state.error ?? null,
    path: state.path ?? '',
    params: state.params ? Object.freeze({ ...state.params }) : Object.freeze({}),
    query: state.query ? Object.freeze({ ...state.query }) : Object.freeze({}),
    data: state.data ? Object.freeze({ ...state.data }) : Object.freeze({}),
    historyState: state.historyState ?? null,
    routeConfig: state.routeConfig ?? null,
  });
}

function execute<TContext, TResult>(
  injector: EnvironmentInjector,
  handler: (context: TContext) => MaybePromise<TResult>,
  context: TContext,
): Promise<TResult> {
  return runWithInjector(injector, handler, context);
}

function adaptFrameBeforeEnter(
  handler: CanActivateFn,
  injector: EnvironmentInjector,
): NavigationTransitionFn {
  return (transition) =>
    execute(injector, handler, {
      ...transition.to,
      signal: transition.signal,
    });
}

function adaptFrameBeforeLeave(
  handler: CanDeactivateFn,
  injector: EnvironmentInjector,
): NavigationTransitionFn {
  return (transition) => {
    if (!transition.from) {
      return true;
    }

    return execute(injector, handler, {
      ...transition.from,
      nextUrl: transition.to.url,
      signal: transition.signal,
    });
  };
}

function adaptFramePrepare(
  handler: FramePrepareFn,
  injector: EnvironmentInjector,
): PrepareRouteDataFn {
  return (route) => execute(injector, handler, route);
}

function adaptFrameAfterEnter(
  handler: (route: ActivatedRoute) => MaybePromise<void>,
  injector: EnvironmentInjector,
): NavigationTransitionFn {
  return (transition) => execute(injector, handler, transition.to);
}

function collectEnterFrames(
  layouts: readonly LayoutDefinition[],
  route: RenderableRoute,
): readonly FrameView[] {
  return Object.freeze([
    ...layouts.map((layout) => layout.frame).filter((frame): frame is FrameView => !!frame),
    ...(route.frame ? [route.frame] : []),
  ]);
}

function collectLeaveFrames(
  layouts: readonly LayoutDefinition[],
  route: RenderableRoute,
): readonly FrameView[] {
  const routeFrames = route.frame ? [route.frame] : [];
  const layoutFrames = layouts
    .map((layout) => layout.frame)
    .filter((frame): frame is FrameView => !!frame)
    .reverse();

  return Object.freeze([...routeFrames, ...layoutFrames]);
}

function adaptFramePreparers(
  frames: readonly FrameView[],
  injector: EnvironmentInjector,
): readonly PrepareRouteDataFn[] | undefined {
  const handlers = frames.flatMap(
    (frame) => frame.prepare?.map((handler) => adaptFramePrepare(handler, injector)) ?? [],
  );

  return handlers.length > 0 ? Object.freeze(handlers) : undefined;
}

function adaptFrameTransitions(
  groups: readonly CompiledRouteGroup[],
  injector: EnvironmentInjector,
): readonly NavigationTransitionDefinition[] {
  const transitions: NavigationTransitionDefinition[] = [];

  for (const group of groups) {
    const primaryRoute = group.primary.route;

    if (primaryRoute.kind === 'redirect') {
      continue;
    }

    const renderableRoute = primaryRoute as RenderableRoute;
    const enterFrames = collectEnterFrames(group.layouts, renderableRoute);
    const leaveFrames = collectLeaveFrames(group.layouts, renderableRoute);

    for (const current of enterFrames) {
      if (!current.beforeEnter?.length && !current.afterEnter?.length) {
        continue;
      }

      transitions.push({
        to: (route) => route?.config.sourceRoute === primaryRoute,
        beforeEnter: current.beforeEnter?.map((handler) =>
          adaptFrameBeforeEnter(handler, injector),
        ),
        afterEnter: current.afterEnter?.map((handler) => adaptFrameAfterEnter(handler, injector)),
      });
    }

    for (const current of leaveFrames) {
      if (!current.beforeLeave?.length) {
        continue;
      }

      transitions.push({
        from: (route) => route?.config.sourceRoute === primaryRoute,
        beforeLeave: current.beforeLeave.map((handler) => adaptFrameBeforeLeave(handler, injector)),
      });
    }
  }

  return transitions;
}

function adaptParamsParser(
  route: RenderableRoute,
  injector: EnvironmentInjector,
): RouteRuntime['parseParams'] {
  const schema = route.paramsSchema;
  if (!schema) return undefined;

  return (params, _url, _signal) =>
    runInInjectionContext(injector, () => Promise.resolve(parseParamsRecord(schema, params)));
}

function adaptQueryParser(
  route: RenderableRoute,
  injector: EnvironmentInjector,
): RouteRuntime['parseQuery'] {
  const schema = route.querySchema;
  if (!schema) return undefined;

  return (url, _signal) =>
    runInInjectionContext(injector, () => Promise.resolve(parseQueryRecord(schema, url)));
}

async function resolveViews(
  layouts: readonly LayoutDefinition[],
  route: RenderableRoute,
): Promise<readonly ResolvedRouteView[]> {
  const resolvedLayouts = await Promise.all(
    layouts.map(async (layout, index) => ({
      component: await loadComponent(layout),
      providers: (layout.providers ?? []).flat().filter((p) => p),
      label: `LayoutDefinition(${layout.path || index})`,
    })),
  );

  const page = await loadComponent(route);

  return Object.freeze([
    ...resolvedLayouts,
    {
      component: page,
      providers: (route.providers ?? []).flat().filter((p) => p),
      label: `RouteDefinition(${route.path})`,
    },
  ]);
}

function adaptRoute(
  route: RedirectRouteDefinition,
  path: string,
  redirectTo: string | undefined,
  layouts: readonly LayoutDefinition[],
  sharedPreparers: readonly PrepareRouteDataFn[] | undefined,
  appRef: ApplicationRef,
  injector: EnvironmentInjector,
): RedirectRoute;
function adaptRoute(
  route: RenderableRoute,
  path: string,
  redirectTo: string | undefined,
  layouts: readonly LayoutDefinition[],
  sharedPreparers: readonly PrepareRouteDataFn[] | undefined,
  appRef: ApplicationRef,
  injector: EnvironmentInjector,
): RuntimeRenderableRoute;
function adaptRoute(
  route: RouteDefinition,
  path: string,
  redirectTo: string | undefined,
  layouts: readonly LayoutDefinition[],
  sharedPreparers: readonly PrepareRouteDataFn[] | undefined,
  appRef: ApplicationRef,
  injector: EnvironmentInjector,
): Route;
function adaptRoute(
  route: RouteDefinition,
  path: string,
  redirectTo: string | undefined,
  layouts: readonly LayoutDefinition[],
  sharedPreparers: readonly PrepareRouteDataFn[] | undefined,
  appRef: ApplicationRef,
  injector: EnvironmentInjector,
): Route {
  if (route.kind === 'redirect') {
    return {
      kind: 'redirect',
      name: route.name,
      path,
      sourceRoute: route,
      redirectTo: redirectTo ?? route.redirectTo,
      data: route.data,
    };
  }

  const tokens = {
    routeToken: ROUTE,
    contextToken: ROUTE_CONTEXT,
  } as const;

  return {
    kind: 'route',
    name: route.name,
    path,
    outlet: route.outlet,
    sourceRoute: route,
    data: route.data,
    preload: route.preload,
    viewTransition: route.viewTransition,

    load: async () => {
      const views = await resolveViews(layouts, route);

      return {
        component: route.outlet
          ? composeAngularLeafRouteView(appRef, injector, tokens, views)
          : composeAngularRouteView(appRef, injector, tokens, views),
        prepare: [
          ...(sharedPreparers ?? []),
          ...(adaptFramePreparers(
            route.frame ? [route.frame] : [],
            injector,
          ) ?? []),
        ],
        parseParams: adaptParamsParser(route, injector),
        parseQuery: adaptQueryParser(route, injector),
      };
    },
  };
}

function adaptRoutes(
  groups: readonly CompiledRouteGroup[],
  appRef: ApplicationRef,
  injector: EnvironmentInjector,
): Route[] {
  return groups.map((group: CompiledRouteGroup) => {
    const sharedPreparers = adaptFramePreparers(
      group.layouts
        .map((layout) => layout.frame)
        .filter((frame): frame is FrameView => !!frame),
      injector,
    );

    const authoredPrimary =
      group.primary.route;

    // Narrow the authored definition before calling adaptRoute(). The runtime
    // redirect discriminant is optional for compatibility, so narrowing the
    // adapted Route union afterwards is not reliable enough for TypeScript.
    if (authoredPrimary.kind === 'redirect') {
      return adaptRoute(
        authoredPrimary,
        group.path,
        group.primary.redirectTo,
        group.layouts,
        sharedPreparers,
        appRef,
        injector,
      );
    }

    const primary = adaptRoute(
      authoredPrimary,
      group.path,
      group.primary.redirectTo,
      group.layouts,
      sharedPreparers,
      appRef,
      injector,
    );

    const outlets: RuntimeRenderableRoute[] =
      group.outlets.map(
        (compiled: CompiledRoute): RuntimeRenderableRoute => {
          const authoredOutlet =
            compiled.route;

          if (authoredOutlet.kind === 'redirect') {
            throw new Error(
              `Named outlet route "${compiled.path}" cannot be a redirect.`,
            );
          }

          return adaptRoute(
            authoredOutlet,
            group.path,
            compiled.redirectTo,
            group.layouts,
            sharedPreparers,
            appRef,
            injector,
          );
        },
      );

    return outlets.length > 0
      ? {
          ...primary,
          outlets: Object.freeze(outlets),
        }
      : primary;
  });
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

function interpolateNamedPath(
  template: string,
  params: Readonly<Record<string, unknown>>,
  schema: ParamSchemaRecord | undefined,
): string | null {
  const serialized = schema
    ? serializeParams(schema, params as unknown as InferParamType<ParamSchemaRecord>)
    : Object.fromEntries(
        Object.entries(params)
          .filter(([, value]) => value !== undefined && value !== null)
          .map(([key, value]) => [key, String(value)]),
      );

  const missing = new Set<string>();

  const path = template.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_match, key: string) => {
    const value = serialized[key];

    if (value === undefined) {
      missing.add(key);
      return `:${key}`;
    }

    return encodeURIComponent(value);
  });

  if (missing.size > 0) {
    return null;
  }

  return path;
}

export class Router<TRoutes extends NavigationTree = any> {
  private readonly appRef: ApplicationRef;
  private readonly injector: EnvironmentInjector;
  private readonly destroyRef: DestroyRef;
  private readonly document: Document;
  private readonly appBaseHref: string;
  private readonly registry: ReturnType<typeof createRouteRegistry>;
  private engine: VanillaRouter | null = null;
  private currentState: RouterState = EMPTY_ROUTER_STATE;
  private readonly outlets = new Map<string, HTMLElement[]>();
  private tickQueued = false;

  public readonly navigateTo: TypedNavigate<TRoutes>;
  public readonly hrefTo: TypedHref<TRoutes>;

  constructor(private readonly configuration: RouterConfiguration<TRoutes>) {
    this.appRef = inject(ApplicationRef);
    this.injector = inject(EnvironmentInjector);
    this.destroyRef = inject(DestroyRef);
    this.document = inject(DOCUMENT);
    this.appBaseHref =
      inject(APP_BASE_HREF, {
        optional: true,
      }) ?? '/';

    this.registry = createRouteRegistry(this.configuration.routes);
    this.navigateTo = this.createNavigateProxy();

    this.hrefTo = this.createHrefProxy();

    this.destroyRef.onDestroy(() => this.dispose());
  }

  get active(): boolean {
    return this.engine !== null;
  }

  get state(): RouterState {
    return this.currentState;
  }

  get displayUrl(): string {
    const location = getRouterLocation(this.document);

    return `${location.pathname}${location.search}${location.hash}`;
  }

  connect(name: string, outlet: HTMLElement): void {
    const outletName = name.trim();

    const registered = this.outlets.get(outletName) ?? [];

    if (registered.includes(outlet)) {
      return;
    }

    registered.push(outlet);

    this.outlets.set(outletName, registered);

    if (this.engine) {
      return;
    }

    const engine = createRouter({
      routes: adaptRoutes(this.registry.groups, this.appRef, this.injector),

      baseHref: this.baseHref,

      enableTracing: this.configuration.enableTracing,

      maxRedirects: this.configuration.maxRedirects,

      onSameUrlNavigation: this.configuration.onSameUrlNavigation,

      scrollRestoration: this.configuration.scrollRestoration,

      preloading: this.configuration.preloading,

      transitions: [...adaptFrameTransitions(this.registry.groups, this.injector)],

      viewTransitions: this.configuration.viewTransitions,

      render: (targetName, node) => {
        const target = this.getOutlet(targetName);

        if (!target) {
          throw new Error(`Router outlet "${targetName}" is not connected.`);
        }

        replaceChildNodes(target, node);
      },

      commit: (outlets) => {
        // First phase: validate all outlets exist before any DOM mutation.
        for (const outlet of outlets) {
          if (!this.outlets.has(outlet.name)) {
            throw new Error(`Router outlet "${outlet.name}" is not connected.`);
          }
        }

        // Second phase: perform synchronous DOM mutations.
        for (const outlet of outlets) {
          const target = this.getOutlet(outlet.name);

          if (!target) {
            throw new Error(`Router outlet "${outlet.name}" is not connected.`);
          }

          replaceChildNodes(target, outlet.node);
          dispatchOutletLifecycleEvent(target, OUTLET_ACTIVATE_EVENT, outlet.component);
        }
      },

      renderNotFound: (targetName, _url, _router) => {
        const target = this.getOutlet(targetName);

        if (!target) {
          return;
        }

        const heading = this.document.createElement('h1');

        heading.textContent = '404 — Page Not Found';

        replaceChildNodes(target, heading);
      },

      renderError: (targetName, _error, _router) => {
        const target = this.getOutlet(targetName);

        if (!target) {
          return;
        }

        const heading = this.document.createElement('h1');

        heading.textContent = 'Page failed to load';

        replaceChildNodes(target, heading);
      },

      onStateChange: (state) => {
        this.currentState = snapshotRouterState(state);
        this.requestTick();
      },

      onOutletActivate: (target, component) => {
        dispatchOutletLifecycleEvent(target, OUTLET_ACTIVATE_EVENT, component);
      },
    });

    try {
      engine.start();
    } catch (error) {
      this.outlets.delete(outletName);
      engine.dispose();
      throw error;
    }

    this.engine = engine;

    this.currentState = snapshotRouterState(engine.state);
    this.requestTick();
  }

  disconnect(name: string, outlet: HTMLElement): void {
    const outletName = name.trim();

    const registered = this.outlets.get(outletName);

    if (!registered) {
      return;
    }

    const index = registered.lastIndexOf(outlet);

    if (index < 0) {
      return;
    }

    registered.splice(index, 1);

    if (registered.length === 0) {
      this.outlets.delete(outletName);
    }

    if (this.outlets.size === 0) {
      this.dispose();
    }
  }

  navigate(target: NavigationTarget, options?: NavigationOptions): Promise<boolean> {
    const href = this.href(target);

    if (href === null) {
      return Promise.resolve(false);
    }

    return this.requireEngine().navigate(href, options);
  }

  href(target: NavigationTarget | null | undefined): string | null {
    if (target === null || target === undefined) {
      return null;
    }

    if (typeof target === 'string' || target instanceof URL) {
      return this.resolveHref(target);
    }

    if ('path' in target) {
      return this.resolveHref(target.path);
    }

    if ('name' in target) {
      return this.generateNamedHref(target);
    }

    return null;
  }

  revalidate(): Promise<boolean> {
    return this.requireEngine().revalidate();
  }

  updateHistoryState(state: unknown): void {
    this.requireEngine().updateHistoryState(state);
  }

  preload(): Promise<void> {
    return this.requireEngine().preload();
  }

  dispose(): void {
    const engine = this.engine;

    this.engine = null;
    this.outlets.clear();

    engine?.dispose();

    this.currentState = EMPTY_ROUTER_STATE;
  }

  private get baseHref(): string {
    return this.configuration.baseHref ?? this.appBaseHref;
  }

  private requireEngine(): VanillaRouter {
    if (!this.engine) {
      throw new Error('Router has no active outlet.');
    }

    return this.engine;
  }

  private resolveHref(target: string | URL): string {
    return routerHref(
      resolveRouterUrl(target, this.baseHref, getRouterLocation(this.document), 'href'),
    );
  }

  private generateNamedHref(target: NamedNavigationTarget): string | null {
    const record = this.registry.namedRoutes.get(target.name);

    if (!record) {
      return null;
    }

    const path = interpolateNamedPath(
      record.fullPath,
      target.params ?? {},
      record.route.kind === 'route' ? record.route.paramsSchema : undefined,
    );

    if (!path) {
      return null;
    }

    const query =
      record.route.kind === 'route' && record.route.querySchema && target.query
        ? serializeQuery(record.route.querySchema, target.query)
        : '';

    return this.resolveHref(`${path}${query}`);
  }

  private createNavigateProxy(): TypedNavigate<TRoutes> {
    return new Proxy(Object.create(null), {
      get: (_target, property) => {
        if (typeof property !== 'string' || property === 'then') {
          return undefined;
        }

        return (options: Record<string, unknown> = {}) =>
          this.navigate({
            name: property,
            ...options,
          } as NamedNavigationTarget);
      },
    }) as TypedNavigate<TRoutes>;
  }

  private createHrefProxy(): TypedHref<TRoutes> {
    return new Proxy(Object.create(null), {
      get: (_target, property) => {
        if (typeof property !== 'string' || property === 'then') {
          return undefined;
        }

        return (options: Record<string, unknown> = {}) =>
          this.href({
            name: property,
            ...options,
          } as NamedNavigationTarget);
      },
    }) as TypedHref<TRoutes>;
  }

  private getOutlet(name: string): HTMLElement | null {
    const registered = this.outlets.get(name.trim());

    return registered?.[registered.length - 1] ?? null;
  }

  private requestTick(): void {
    if (this.tickQueued) {
      return;
    }

    this.tickQueued = true;

    queueMicrotask(() => {
      this.tickQueued = false;

      if (!this.engine) {
        return;
      }

      this.appRef.tick();
    });
  }
}

export function provideRouter<const TRoutes extends NavigationTree>(
  routes: TRoutes,
  options: RouterOptions = {},
): Provider[] {
  const config: RouterConfiguration<TRoutes> = {
    ...options,
    routes,
  };

  return [
    {
      provide: ROUTER_CONFIGURATION,
      useValue: config,
    },
    {
      provide: Router,
      useFactory: (configuration: RouterConfiguration<TRoutes>) =>
        new Router<TRoutes>(configuration),
      deps: [ROUTER_CONFIGURATION],
    },
  ];
}

export { type LayoutOptions, type RouteOptions };

export { layout, lazyLayout, lazyRoute, redirectRoute, route } from './route-builders';