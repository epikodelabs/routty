import type {
  CanActivateFn,
  CanDeactivateFn,
  ParseRouteParams,
  ParseRouteQuery,
  PrepareRouteDataFn,
  RedirectRoute,
  RenderableRoute,
  Route,
} from './vanilla-router';

/** Runtime capabilities resolved from a renderable route definition. */
export interface RouteRuntime {
  readonly component?: import('./vanilla-router').RouteComponent;
  readonly canActivate?: readonly CanActivateFn[];
  readonly canDeactivate?: readonly CanDeactivateFn[];
  readonly prepare?: readonly PrepareRouteDataFn[];
  readonly parseParams?: ParseRouteParams;
  readonly parseQuery?: ParseRouteQuery;
}

const routeRuntimeCache = new WeakMap<RenderableRoute, Promise<RouteRuntime>>();

export function prepareRouteRuntime(
  route: RenderableRoute,
): Promise<RouteRuntime> {
  let pending = routeRuntimeCache.get(route);

  if (!pending) {
    pending = Promise
      .resolve(
        route.load?.() ?? {},
      )
      .then(runtime => Object.freeze({
        component: runtime.component,
        canActivate: runtime.canActivate,
        canDeactivate: runtime.canDeactivate,
        prepare: runtime.prepare ?? route.prepare,
        parseParams: runtime.parseParams,
        parseQuery: runtime.parseQuery,
      }))
      .catch(error => {
        routeRuntimeCache.delete(route);
        throw error;
      });

    routeRuntimeCache.set(route, pending);
  }

  return pending;
}

export async function preloadRouteCatalog(
  routes: readonly Route[],
  trace: (message: string, ...values: unknown[]) => void,
): Promise<void> {
  for (const route of routes) {
    if (isRedirectRoute(route) || route.preload === false) {
      continue;
    }

    const group: readonly RenderableRoute[] = [
      route,
      ...(route.outlets ?? []),
    ];

    for (const member of group) {
      try {
        const runtime = await prepareRouteRuntime(member);

        if (
          member !== route
          && (runtime.parseParams || runtime.parseQuery)
        ) {
          throw new Error(
            `Outlet "${member.outlet}" cannot define parseParams or parseQuery`,
          );
        }
      } catch (error) {
        trace(
          'Route preload failed',
          member.path,
          member.outlet ?? '',
          error,
        );
      }
    }
  }
}

function isRedirectRoute(
  route: Route,
): route is RedirectRoute {
  return (
    route.kind === 'redirect'
    || typeof route.redirectTo === 'string'
  );
}
