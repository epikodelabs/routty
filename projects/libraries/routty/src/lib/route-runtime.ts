import type {
  CanActivateFn,
  CanDeactivateFn,
  ParseRouteParams,
  ParseRouteQuery,
  PrepareRouteDataFn,
  RenderableRoute,
  Route,
} from './vanilla-router';

/**
 * Compatibility shape for code that used Routty's former lazy route runtime.
 * Routty routes are eager now, so these capabilities are read directly from
 * the route definition and no loader/cache exists.
 */
export interface RouteRuntime {
  readonly component?: import('./vanilla-router').RouteComponent;
  readonly canActivate?: readonly CanActivateFn[];
  readonly canDeactivate?: readonly CanDeactivateFn[];
  readonly prepare?: readonly PrepareRouteDataFn[];
  readonly parseParams?: ParseRouteParams;
  readonly parseQuery?: ParseRouteQuery;
}

export function prepareRouteRuntime(
  route: RenderableRoute,
): Promise<RouteRuntime> {
  return Promise.resolve(route);
}

export async function preloadRouteCatalog(
  routes: readonly Route[],
  _trace: (message: string, ...values: unknown[]) => void,
): Promise<void> {
  for (const route of routes) {
    if (route.kind === 'redirect' || typeof route.redirectTo === 'string') continue;

    for (const member of route.outlets ?? []) {
      if (member.parseParams || member.parseQuery) {
        throw new Error(
          `Outlet "${member.outlet}" cannot define parseParams or parseQuery`,
        );
      }
    }
  }
}
