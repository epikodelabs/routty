import {
  compileRoutePath,
  matchRoutePath,
  splitRoutePath,
} from './route-path';

import type { Route } from './vanilla-router';

export type RawRouteParams =
  Readonly<Record<string, string>>;

export interface RouteMatch {
  readonly route: Route;
  readonly params: RawRouteParams;
}

/**
 * Compiled matching behavior for one route definition.
 *
 * A matcher owns its route and returns the complete recognition result. The
 * concrete matching representation remains private to this module.
 */
export interface RouteMatcher {
  readonly route: Route;

  match(
    segments: readonly string[],
  ): RouteMatch | null;
}

/** Immutable, versioned snapshot of the router's currently known routes. */
export interface RouteCatalog {
  readonly version: number;
  readonly matchers: readonly RouteMatcher[];
}

export function createRouteCatalog(
  routes: readonly Route[],
): RouteCatalog {
  validateRouteGroups(routes);

  return Object.freeze({
    version: 0,
    matchers: compileRouteMatchers(routes),
  });
}

export function readCatalogRoutes(
  catalog: RouteCatalog,
): readonly Route[] {
  return Object.freeze(
    catalog.matchers.map(
      matcher => matcher.route,
    ),
  );
}

export function appendCatalogRoutes(
  catalog: RouteCatalog,
  routes: readonly Route[],
): RouteCatalog {
  if (routes.length === 0) {
    return catalog;
  }

  const nextRoutes = [
    ...readCatalogRoutes(catalog),
    ...routes,
  ];

  validateRouteGroups(nextRoutes);

  return Object.freeze({
    version: catalog.version + 1,
    matchers: Object.freeze([
      ...catalog.matchers,
      ...compileRouteMatchers(routes),
    ]),
  });
}

export function replaceCatalogRoutes(
  catalog: RouteCatalog,
  routes: readonly Route[],
): RouteCatalog {
  if (sameRouteReferences(catalog, routes)) {
    return catalog;
  }

  validateRouteGroups(routes);

  return Object.freeze({
    version: catalog.version + 1,
    matchers: compileRouteMatchers(routes),
  });
}

export function removeCatalogRoutes(
  catalog: RouteCatalog,
  predicate: (route: Route) => boolean,
): RouteCatalog {
  const nextRoutes = readCatalogRoutes(catalog)
    .filter(route => !predicate(route));

  if (nextRoutes.length === catalog.matchers.length) {
    return catalog;
  }

  validateRouteGroups(nextRoutes);

  return Object.freeze({
    version: catalog.version + 1,
    matchers: compileRouteMatchers(nextRoutes),
  });
}

/**
 * Recognizes one complete application path.
 *
 * Wildcard routes remain fallbacks and are selected only when no concrete
 * matcher succeeds.
 */
export function recognizeRoute(
  catalog: RouteCatalog,
  path: string,
): RouteMatch | null {
  const segments = splitRoutePath(path);
  let fallback: RouteMatcher | undefined;

  for (const matcher of catalog.matchers) {
    const path = matcher.route.path;

    if (path === '*' || path === '**') {
      fallback = matcher;
      continue;
    }

    const match = matcher.match(segments);

    if (match) {
      return match;
    }
  }

  return fallback
    ? Object.freeze({
        route: fallback.route,
        params: Object.freeze({}),
      })
    : null;
}

function createRouteMatcher(
  route: Route,
): RouteMatcher {
  let compiledPath: string | null = null;
  let compiled: ReturnType<typeof compileRoutePath> | null = null;

  return Object.freeze({
    route,

    match(
      segments: readonly string[],
    ): RouteMatch | null {
      const currentPath = route.path;

      // Wildcards are selected by recognizeRoute() only after every concrete
      // route has failed. Keeping that decision outside the matcher preserves
      // fallback ordering even when a route path is mutated at runtime.
      if (currentPath === '*' || currentPath === '**') {
        return null;
      }

      // Route definitions historically allow path mutation. Refresh the
      // compiled matcher only when the path value changes, preserving the old
      // cached-pattern behavior without recompiling on every navigation.
      if (compiled === null || compiledPath !== currentPath) {
        compiledPath = currentPath;
        compiled = compileRoutePath(currentPath);
      }

      const params = matchRoutePath(
        compiled,
        segments,
      );

      return params
        ? Object.freeze({
            route,
            params,
          })
        : null;
    },
  });
}

function compileRouteMatchers(
  routes: readonly Route[],
): readonly RouteMatcher[] {
  return Object.freeze(
    routes.map(createRouteMatcher),
  );
}

function sameRouteReferences(
  catalog: RouteCatalog,
  routes: readonly Route[],
): boolean {
  return (
    catalog.matchers.length === routes.length
    && catalog.matchers.every(
      (matcher, index) =>
        matcher.route === routes[index],
    )
  );
}

function validateRouteGroups(
  routes: readonly Route[],
): void {
  const primaryPaths = new Set<string>();

  for (const primary of routes) {
    const primaryOutlet =
      primary.outlet?.trim() ?? '';

    if (primaryOutlet) {
      throw new Error(
        `Top-level route "${primary.path}" must target the primary outlet`,
      );
    }

    if (primaryPaths.has(primary.path)) {
      throw new Error(
        `Duplicate primary route path "${primary.path}"`,
      );
    }

    primaryPaths.add(primary.path);

    const outletNames = new Set<string>();

    for (const outlet of primary.outlets ?? []) {
      const name = outlet.outlet?.trim() ?? '';

      if (!name) {
        throw new Error(
          `Secondary route for "${primary.path}" must define a named outlet`,
        );
      }

      if (outletNames.has(name)) {
        throw new Error(
          `Duplicate outlet "${name}" for route "${primary.path}"`,
        );
      }

      outletNames.add(name);

      if (outlet.path !== primary.path) {
        throw new Error(
          `Outlet "${name}" must use the primary path "${primary.path}"`,
        );
      }

      if (outlet.outlets?.length) {
        throw new Error(
          `Outlet "${name}" cannot contain nested outlets`,
        );
      }

      if (outlet.redirectTo) {
        throw new Error(
          `Outlet "${name}" cannot redirect`,
        );
      }

      if (outlet.name) {
        throw new Error(
          `Outlet "${name}" cannot define a route name`,
        );
      }

      if (outlet.preload !== undefined) {
        throw new Error(
          `Outlet "${name}" cannot define preload; the primary route owns group preloading`,
        );
      }

      if (outlet.viewTransition !== undefined) {
        throw new Error(
          `Outlet "${name}" cannot define viewTransition; the primary route owns the transition`,
        );
      }
    }

    if (primary.redirectTo && outletNames.size > 0) {
      throw new Error(
        `Redirect route "${primary.path}" cannot activate named outlets`,
      );
    }
  }
}
