import { APP_BASE_HREF, DOCUMENT } from '@angular/common';

import {
  ApplicationRef,
  DestroyRef,
  EnvironmentInjector,
  InjectionToken,
  inject,
  runInInjectionContext,
  signal,
  type Provider,
} from '@angular/core';

import { runWithInjector } from './adapter-utils';

import type { NamedNavigationTarget, NavigationTarget } from './navigation-targets';

import { CompiledRoute, CompiledRouteGroup, createRouteRegistry } from './route-compiler';

import {
  composeAngularLeafRouteView,
  composeAngularRouteView,
  type ResolvedRouteView,
} from './route-renderer';

import type {
  PrepareFn,
  MaybePromise,
  LayoutDefinition,
  LayoutOptions,
  RedirectRouteDefinition,
  RenderableRoute,
  RouteDefinition,
  RouteOptions,
  NavigationTree,
} from './navigation-definitions';

import type { TypedHref, TypedNavigate } from './typed-navigation';

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

function adaptBeforeEnter(
  handler: CanActivateFn,
  injector: EnvironmentInjector,
): NavigationTransitionFn {
  return (transition) =>
    execute(injector, handler, {
      ...transition.to,
      signal: transition.signal,
    });
}

function adaptBeforeLeave(
  handler: CanDeactivateFn,
  injector: EnvironmentInjector,
): NavigationTransitionFn {
  return (transition) => {
    if (!transition.from) return true;

    return execute(injector, handler, {
      ...transition.from,
      nextUrl: transition.to.url,
      signal: transition.signal,
    });
  };
}

function adaptPrepare(
  handler: PrepareFn,
  injector: EnvironmentInjector,
): PrepareRouteDataFn {
  return (route) => execute(injector, handler, route);
}

function adaptAfterEnter(
  handler: (route: ActivatedRoute) => MaybePromise<void>,
  injector: EnvironmentInjector,
): NavigationTransitionFn {
  return (transition) => execute(injector, handler, transition.to);
}

interface HookOwner {
  readonly beforeEnter?: readonly ((context: any) => MaybePromise<any>)[];
  readonly beforeLeave?: readonly ((context: any) => MaybePromise<any>)[];
  readonly prepare?: readonly ((context: any) => MaybePromise<any>)[];
  readonly afterEnter?: readonly ((context: any) => MaybePromise<any>)[];
}

function collectPreparers(
  owners: readonly HookOwner[],
  injector: EnvironmentInjector,
): readonly PrepareRouteDataFn[] | undefined {
  const handlers = owners.flatMap(
    owner => owner.prepare?.map(handler => adaptPrepare(handler as PrepareFn, injector)) ?? [],
  );

  return handlers.length > 0 ? Object.freeze(handlers) : undefined;
}

function adaptTransitions(
  groups: readonly CompiledRouteGroup[],
  injector: EnvironmentInjector,
): readonly NavigationTransitionDefinition[] {
  const transitions: NavigationTransitionDefinition[] = [];

  for (const group of groups) {
    const primaryRoute = group.primary.route;
    if (primaryRoute.kind === 'redirect') continue;

    const enterOwners: readonly HookOwner[] = [...group.layouts, primaryRoute];
    const leaveOwners: readonly HookOwner[] = [primaryRoute, ...[...group.layouts].reverse()];

    for (const owner of enterOwners) {
      if (!owner.beforeEnter?.length && !owner.afterEnter?.length) continue;

      transitions.push({
        to: route => route?.config.sourceRoute === primaryRoute,
        beforeEnter: owner.beforeEnter?.map(handler => adaptBeforeEnter(handler as CanActivateFn, injector)),
        afterEnter: owner.afterEnter?.map(handler => adaptAfterEnter(handler as (route: ActivatedRoute) => MaybePromise<void>, injector)),
      });
    }

    for (const owner of leaveOwners) {
      if (!owner.beforeLeave?.length) continue;

      transitions.push({
        from: route => route?.config.sourceRoute === primaryRoute,
        beforeLeave: owner.beforeLeave.map(handler => adaptBeforeLeave(handler as CanDeactivateFn, injector)),
      });
    }
  }

  return transitions;
}

function adaptParamsParser(
  route: RenderableRoute,
  injector: EnvironmentInjector,
): import('./vanilla-router').ParseRouteParams | undefined {
  const schema = route.params;
  if (!schema) return undefined;

  return (params, _url, _signal) =>
    runInInjectionContext(injector, () => Promise.resolve(parseParamsRecord(schema, params)));
}

function adaptQueryParser(
  route: RenderableRoute,
  injector: EnvironmentInjector,
): import('./vanilla-router').ParseRouteQuery | undefined {
  const schema = route.query;
  if (!schema) return undefined;

  return (url, _signal) =>
    runInInjectionContext(injector, () => Promise.resolve(parseQueryRecord(schema, url)));
}

function resolveViews(
  layouts: readonly LayoutDefinition[],
  route: RenderableRoute,
): readonly ResolvedRouteView[] {
  return Object.freeze([
    ...layouts.map((layout, index) => ({
      component: layout.component,
      providers: (layout.providers ?? []).flat().filter(p => p),
      label: `LayoutDefinition(${layout.path || index})`,
    })),
    {
      component: route.component,
      providers: (route.providers ?? []).flat().filter(p => p),
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
  documentRef: Document,
  injector: EnvironmentInjector,
): RedirectRoute;
function adaptRoute(
  route: RenderableRoute,
  path: string,
  redirectTo: string | undefined,
  layouts: readonly LayoutDefinition[],
  sharedPreparers: readonly PrepareRouteDataFn[] | undefined,
  appRef: ApplicationRef,
  documentRef: Document,
  injector: EnvironmentInjector,
): RuntimeRenderableRoute;
function adaptRoute(
  route: RouteDefinition,
  path: string,
  redirectTo: string | undefined,
  layouts: readonly LayoutDefinition[],
  sharedPreparers: readonly PrepareRouteDataFn[] | undefined,
  appRef: ApplicationRef,
  documentRef: Document,
  injector: EnvironmentInjector,
): Route;
function adaptRoute(
  route: RouteDefinition,
  path: string,
  redirectTo: string | undefined,
  layouts: readonly LayoutDefinition[],
  sharedPreparers: readonly PrepareRouteDataFn[] | undefined,
  appRef: ApplicationRef,
  documentRef: Document,
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
    viewTransition: route.viewTransition,
    component: route.outlet
      ? composeAngularLeafRouteView(appRef, documentRef, injector, tokens, resolveViews(layouts, route))
      : composeAngularRouteView(appRef, documentRef, injector, tokens, resolveViews(layouts, route)),
    prepare: Object.freeze([
      ...(sharedPreparers ?? []),
      ...(collectPreparers([route], injector) ?? []),
    ]),
    parseParams: adaptParamsParser(route, injector),
    parseQuery: adaptQueryParser(route, injector),
  };
}

function adaptRoutes(
  groups: readonly CompiledRouteGroup[],
  appRef: ApplicationRef,
  documentRef: Document,
  injector: EnvironmentInjector,
): Route[] {
  return groups.map((group: CompiledRouteGroup) => {
    const sharedPreparers = collectPreparers(group.layouts, injector);

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
        documentRef,
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
      documentRef,
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
            documentRef,
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
  private readonly stateSnapshot = signal<RouterState>(EMPTY_ROUTER_STATE);
  private readonly outlets = new Map<string, HTMLElement[]>();

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
    // Reading this getter in a template tracks the snapshot signal, allowing
    // Angular to schedule only dependent views rather than a global tick.
    return this.stateSnapshot();
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
      routes: adaptRoutes(this.registry.groups, this.appRef, this.document, this.injector),

      baseHref: this.baseHref,

      enableTracing: this.configuration.enableTracing,

      maxRedirects: this.configuration.maxRedirects,

      onSameUrlNavigation: this.configuration.onSameUrlNavigation,

      scrollRestoration: this.configuration.scrollRestoration,

      transitions: [...adaptTransitions(this.registry.groups, this.injector)],

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
        this.setState(snapshotRouterState(state));
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

    this.setState(snapshotRouterState(engine.state));
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

  dispose(): void {
    const engine = this.engine;

    this.engine = null;
    this.outlets.clear();

    engine?.dispose();

    this.setState(EMPTY_ROUTER_STATE);
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
      record.route.kind === 'route' ? record.route.params : undefined,
    );

    if (!path) {
      return null;
    }

    const query =
      record.route.kind === 'route' && record.route.query && target.query
        ? serializeQuery(record.route.query, target.query)
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

  private setState(state: RouterState): void {
    this.currentState = state;
    this.stateSnapshot.set(state);
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

export { layout, redirect, route } from './route-builders';
