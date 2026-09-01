import type { Type } from '@angular/core';

import type { ParamSchemaRecord, QuerySchemaRecord } from './query-schema';
import type {
  HookList,
  LayoutDefinition,
  LayoutOptions,
  NavigationHooks,
  NavigationTree,
  PrepareFn,
  ParamsForPath,
  RedirectRouteDefinition,
  RenderableRoute,
  RouteOptions,
} from './navigation-definitions';

function asArray<T>(value: HookList<T> | undefined): readonly T[] | undefined {
  if (value === undefined) return undefined;
  return Object.freeze(Array.isArray(value) ? [...value] : [value]);
}

function normalizeHooks<TPrepare extends HookList<PrepareFn> | undefined>(
  hooks: NavigationHooks<TPrepare>,
) {
  return {
    beforeEnter: asArray(hooks.beforeEnter),
    beforeLeave: asArray(hooks.beforeLeave),
    prepare: asArray(hooks.prepare),
    afterEnter: asArray(hooks.afterEnter),
  };
}

export function route<
  const TPath extends string,
  const TName extends string | undefined = undefined,
  const TParams extends ParamsForPath<TPath> | undefined = undefined,
  const TQuery extends QuerySchemaRecord | undefined = undefined,
  const TPrepare extends HookList<PrepareFn> | undefined =
    HookList<PrepareFn> | undefined,
>(
  path: TPath,
  component: Type<unknown>,
  options: RouteOptions<TName, TParams, TQuery, TPrepare> = {},
): RenderableRoute<TPath, TName, TParams, TQuery, TPrepare> {
  const {
    beforeEnter,
    beforeLeave,
    prepare,
    afterEnter,
    ...routeOptions
  } = options;

  return {
    kind: 'route',
    path,
    component,
    ...normalizeHooks({ beforeEnter, beforeLeave, prepare, afterEnter }),
    ...routeOptions,
  } as RenderableRoute<TPath, TName, TParams, TQuery, TPrepare>;
}

export function redirect<
  const TPath extends string,
  const TRedirectTo extends string,
  const TName extends string | undefined = undefined,
>(
  path: TPath,
  redirectTo: TRedirectTo,
  options: Pick<RouteOptions<TName, undefined, undefined>, 'name' | 'data' | 'providers'> = {},
): RedirectRouteDefinition<TPath, TName> {
  return { kind: 'redirect', path, redirectTo, ...options };
}

export function layout<
  const TPath extends string,
  const TEntries extends NavigationTree,
  const TPrepare extends HookList<PrepareFn> | undefined =
    HookList<PrepareFn> | undefined,
>(
  path: TPath,
  component: Type<unknown>,
  entries: TEntries,
  options: LayoutOptions<TPrepare> = {},
): LayoutDefinition<TPath, TEntries, TPrepare> {
  const { beforeEnter, beforeLeave, prepare, afterEnter, ...layoutOptions } = options;

  return {
    kind: 'layout',
    path,
    component,
    entries,
    ...normalizeHooks({ beforeEnter, beforeLeave, prepare, afterEnter }),
    ...layoutOptions,
  } as LayoutDefinition<TPath, TEntries, TPrepare>;
}
