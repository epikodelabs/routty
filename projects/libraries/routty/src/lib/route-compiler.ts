import type {
  LayoutDefinition,
  RouteDefinition,
  NavigationTree,
} from './navigation-definitions';


import {
  compileRoutePath,
  extractRouteParamNames,
  joinRoutePath,
} from './route-path';

function validateCompiledRouteParams(
  route: RouteDefinition,
  path: string,
): void {
  const paramNames = extractRouteParamNames(path);
  const seen = new Set<string>();

  for (const name of paramNames) {
    if (seen.has(name)) {
      throw new Error(
        `Duplicate path parameter ":${name}" in compiled route "${path}". ` +
        'Path parameter names must be unique across the complete layout and route path.',
      );
    }

    seen.add(name);
  }

  if (route.kind === 'redirect') {
    return;
  }

  const schema = route.paramsSchema;
  if (!schema) {
    return;
  }

  const schemaNames = Object.keys(schema);

  for (const name of schemaNames) {
    if (!seen.has(name)) {
      throw new Error(
        `paramsSchema declares "${name}", but compiled route "${path}" ` +
        `does not contain ":${name}".`,
      );
    }
  }

  const declared = new Set(schemaNames);

  for (const name of paramNames) {
    if (!declared.has(name)) {
      throw new Error(
        `Compiled route "${path}" contains ":${name}", but paramsSchema ` +
        `does not declare it. Declare every path parameter when paramsSchema is present.`,
      );
    }
  }
}

export interface CompiledRoute {
  readonly route: RouteDefinition;
  readonly path: string;
  readonly redirectTo?: string;
  readonly layouts:
    readonly LayoutDefinition[];
}

export interface CompiledRouteGroup {
  readonly path: string;
  readonly layouts: readonly LayoutDefinition[];
  readonly primary: CompiledRoute;
  readonly outlets: readonly CompiledRoute[];
}

export { joinRoutePath } from './route-path';

export function compileRedirect(
  parentPath: string,
  redirectTo:
    string | undefined,
): string | undefined {
  if (!redirectTo) {
    return undefined;
  }

  if (
    /^[A-Za-z][A-Za-z\d+.-]*:/.test(redirectTo) ||
    redirectTo.startsWith('//')
  ) {
    return redirectTo;
  }

  return redirectTo.startsWith('/')
    ? joinRoutePath('/', redirectTo)
    : joinRoutePath(
        parentPath,
        redirectTo,
      );
}

export function compileRoutes(
  entries: NavigationTree,
  parentPath = '/',
  layouts:
    readonly LayoutDefinition[] = [],
  output: CompiledRoute[] = []
): readonly CompiledRoute[] {
  for (const entry of entries) {
    if (entry.kind === 'layout') {
      compileRoutes(
        entry.entries,
        joinRoutePath(
          parentPath,
          entry.path,
        ),
        Object.freeze([
          ...layouts,
          entry,
        ]),
        output,
      );

      continue;
    }

    // An empty child path is the index route of the current layout branch.
    // Preserve the already compiled parent path exactly instead of treating the
    // empty segment as a new route level.
    const path =
      entry.path === ''
        ? parentPath
        : joinRoutePath(
            parentPath,
            entry.path,
          );

    output.push({
      route: entry,
      path,
      redirectTo: entry.kind === 'redirect'
        ? compileRedirect(parentPath, entry.redirectTo)
        : undefined,
      layouts,
    });
  }

  return output;
}

export function groupRoutes(
  compiled: readonly CompiledRoute[],
): readonly CompiledRouteGroup[] {
  const groups = new Map<string, CompiledRouteGroup>();

  for (const route of compiled) {
    const key = `${route.path}#${route.layouts.map(l => l.path).join('/')}`;
    let group = groups.get(key);

    if (!group) {
      if (route.route.kind === 'route' && route.route.outlet) {
        throw new Error(
          `Named outlet route "${route.route.name ?? route.path}" with path "${route.path}" has no corresponding primary outlet route with the same path.`,
        );
      }

      group = {
        path: route.path,
        layouts: route.layouts,
        primary: route,
        outlets: [],
      };

      groups.set(key, group);
    } else if (route.route.kind === 'redirect' || !route.route.outlet) {
      throw new Error(
        `Duplicate primary route for path "${route.path}" under the same layout chain.`,
      );
    } else {
      group = {
        ...group,
        outlets: [...group.outlets, route],
      };

      groups.set(key, group);
    }
  }

  return Array.from(groups.values());
}

function validateRouteGroups(
  groups: readonly CompiledRouteGroup[],
): void {
  const names = new Set<string>();

  for (const group of groups) {
    const primaryName = group.primary.route.name;
    if (primaryName) {
      if (names.has(primaryName)) {
        throw new Error(`Duplicate route name "${primaryName}". Route names must be globally unique.`);
      }
      names.add(primaryName);
    }

    if (group.primary.route.kind === 'redirect' && group.outlets.length > 0) {
      throw new Error(
        `A redirect route cannot have named outlets. Path: "${group.path}"`,
      );
    }

    const outletNames = new Set<string>();
    for (const outlet of group.outlets) {
      if (outlet.route.kind === 'redirect') {
        throw new Error(`Named outlet routes cannot be redirects. Route path: "${group.path}"`);
      }

      const outletName = outlet.route.outlet!;
      if (outletNames.has(outletName)) {
        throw new Error(
          `Duplicate outlet named "${outletName}" for route path "${group.path}".`,
        );
      }
      outletNames.add(outletName);

      if (outlet.route.name) {
        throw new Error(
          `Named outlet routes cannot have a "name" property. Route path: "${group.path}", outlet: "${outletName}"`,
        );
      }

      if (outlet.route.paramsSchema || outlet.route.querySchema) {
        throw new Error('Named outlet routes cannot define paramsSchema or querySchema.');
      }

      if (outlet.route.viewTransition !== undefined) {
        throw new Error('Named outlet routes cannot define viewTransition.');
      }

      if (outlet.route.preload !== undefined) {
        throw new Error('Named outlet routes cannot define preload.');
      }
    }
  }
}

export interface RouteRegistryRecord {
  readonly route: RouteDefinition;
  readonly fullPath: string;
}

export interface RouteRegistry {
  readonly namedRoutes:
    ReadonlyMap<
      string,
      RouteRegistryRecord
    >;
  readonly groups:
    readonly CompiledRouteGroup[];
}

export function createRouteRegistry(
  entries: NavigationTree,
): RouteRegistry {
  const namedRoutes =
    new Map<
      string,
      RouteRegistryRecord
    >();
  
  const groups = groupRoutes(compileRoutes(entries));
  validateRouteGroups(groups);
  
  const literalPaths =
    new Map<string, RouteDefinition>();

  const patterns =
    new Map<string, string>();

  for (
    const {
      route,
      path,
    } of groups.flatMap(g => [g.primary, ...g.outlets])
  ) {
    validateCompiledRouteParams(route, path);

    const previous =
      literalPaths.get(path);

    if (
      previous &&
      (previous.kind === 'redirect' || !previous.outlet) &&
      (route.kind === 'redirect' || !route.outlet)
    ) {
      throw new Error(
        `Duplicate compiled route path "${path}".`,
      );
    }

    literalPaths.set(path, route);

    const pattern =
      compileRoutePath(path).patternKey;

    const previousPattern =
      patterns.get(pattern);

    if (
      previousPattern &&
      previousPattern !== path
    ) {
      throw new Error(
        `Conflicting route patterns ` +
        `"${previousPattern}" and "${path}".`,
      );
    }

    patterns.set(pattern, path);

    if (!route.name) {
      continue;
    }

    if (
      namedRoutes.has(route.name)
    ) {
      throw new Error(
        `Duplicate route name ` +
        `"${route.name}". ` +
        'Route names must be globally unique.',
      );
    }

    namedRoutes.set(
      route.name,
      {
        route,
        fullPath: path,
      },
    );
  }

  return {
    namedRoutes,
    groups,
  };
}