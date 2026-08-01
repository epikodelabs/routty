import type { Type } from '@angular/core';

import type { ParamSchemaRecord, QuerySchemaRecord } from './query-schema';
import type {
  Lazy,
  StreamixFrame,
  StreamixFrameHooks,
  StreamixLayout,
  StreamixLayoutOptions,
  StreamixRedirectRoute,
  StreamixRenderableRoute,
  StreamixRouteOptions,
  StreamixRoutes,
  StreamixView,
} from './route-types';

function isFrame(
  value: unknown,
): value is StreamixFrame {
  return typeof value === 'object'
    && value !== null
    && 'kind' in value
    && value.kind === 'frame';
}

function isEagerFrame(
  value: StreamixFrame,
): value is StreamixFrame & { readonly component: Type<unknown> } {
  return 'component' in value
    && value.component !== undefined;
}

type ViewRecord =
  StreamixView & {
    readonly frame?: StreamixFrame;
  };

function createViewRecord(
  view: Type<unknown> | StreamixFrame,
): ViewRecord {
  if (isFrame(view)) {
    if (isEagerFrame(view)) {
      return {
        component: view.component,
        frame: view,
      };
    }

    return {
      loadComponent: view.loadComponent,
      frame: view,
    };
  }

  return {
    component: view,
    frame: undefined,
  };
}

function createLazyViewRecord(
  view: Lazy<Type<unknown>> | StreamixFrame,
): ViewRecord {
  if (isFrame(view)) {
    if (isEagerFrame(view)) {
      return {
        component: view.component,
        frame: view,
      };
    }

    return {
      loadComponent: view.loadComponent,
      frame: view,
    };
  }

  return {
    loadComponent: view,
    frame: undefined,
  };
}

export function frame(
  component: Type<unknown>,
  hooks: StreamixFrameHooks = {},
): StreamixFrame {
  return {
    kind: 'frame',
    component,
    ...hooks,
  };
}

export function lazyFrame(
  loadComponent: Lazy<Type<unknown>>,
  hooks: StreamixFrameHooks = {},
): StreamixFrame {
  return {
    kind: 'frame',
    loadComponent,
    ...hooks,
  };
}

export function route<
  const TPath extends string,
  const TName extends
    string | undefined = undefined,
  const TParamsSchema extends
    ParamSchemaRecord | undefined = undefined,
  const TQuerySchema extends
    QuerySchemaRecord | undefined = undefined,
>(
  path: TPath,
  component: Type<unknown>,
  options?: StreamixRouteOptions<
    TName,
    TParamsSchema,
    TQuerySchema
  >,
): StreamixRenderableRoute<
  TPath,
  TName,
  TParamsSchema,
  TQuerySchema
>;
export function route<
  const TPath extends string,
  const TName extends
    string | undefined = undefined,
  const TParamsSchema extends
    ParamSchemaRecord | undefined = undefined,
  const TQuerySchema extends
    QuerySchemaRecord | undefined = undefined,
>(
  path: TPath,
  component: StreamixFrame,
  options?: StreamixRouteOptions<
    TName,
    TParamsSchema,
    TQuerySchema
  >,
): StreamixRenderableRoute<
  TPath,
  TName,
  TParamsSchema,
  TQuerySchema
>;
export function route<
  const TPath extends string,
  const TName extends
    string | undefined = undefined,
  const TParamsSchema extends
    ParamSchemaRecord | undefined = undefined,
  const TQuerySchema extends
    QuerySchemaRecord | undefined = undefined,
>(
  path: TPath,
  component: Type<unknown> | StreamixFrame,
  options: StreamixRouteOptions<
    TName,
    TParamsSchema,
    TQuerySchema
  > = {},
): StreamixRenderableRoute<
  TPath,
  TName,
  TParamsSchema,
  TQuerySchema
> {
  const route: StreamixRenderableRoute<
    TPath,
    TName,
    TParamsSchema,
    TQuerySchema
  > = {
    kind: 'route',
    path,
    ...createViewRecord(component),
    ...options,
  };

  return route;
}

export function lazyRoute<
  const TPath extends string,
  const TName extends
    string | undefined = undefined,
  const TParamsSchema extends
    ParamSchemaRecord | undefined = undefined,
  const TQuerySchema extends
    QuerySchemaRecord | undefined = undefined,
>(
  path: TPath,
  loadComponent: Lazy<Type<unknown>>,
  options?: StreamixRouteOptions<
    TName,
    TParamsSchema,
    TQuerySchema
  >,
): StreamixRenderableRoute<
  TPath,
  TName,
  TParamsSchema,
  TQuerySchema
>;
export function lazyRoute<
  const TPath extends string,
  const TName extends
    string | undefined = undefined,
  const TParamsSchema extends
    ParamSchemaRecord | undefined = undefined,
  const TQuerySchema extends
    QuerySchemaRecord | undefined = undefined,
>(
  path: TPath,
  loadComponent: StreamixFrame,
  options?: StreamixRouteOptions<
    TName,
    TParamsSchema,
    TQuerySchema
  >,
): StreamixRenderableRoute<
  TPath,
  TName,
  TParamsSchema,
  TQuerySchema
>;
export function lazyRoute<
  const TPath extends string,
  const TName extends
    string | undefined = undefined,
  const TParamsSchema extends
    ParamSchemaRecord | undefined = undefined,
  const TQuerySchema extends
    QuerySchemaRecord | undefined = undefined,
>(
  path: TPath,
  loadComponent: Lazy<Type<unknown>> | StreamixFrame,
  options: StreamixRouteOptions<
    TName,
    TParamsSchema,
    TQuerySchema
  > = {},
): StreamixRenderableRoute<
  TPath,
  TName,
  TParamsSchema,
  TQuerySchema
> {
  const route: StreamixRenderableRoute<
    TPath,
    TName,
    TParamsSchema,
    TQuerySchema
  > = {
    kind: 'route',
    path,
    ...createLazyViewRecord(loadComponent),
    ...options,
  };

  return route;
}

export function redirectRoute<
  const TPath extends string,
  const TRedirectTo extends string,
  const TName extends
    string | undefined = undefined,
>(
  path: TPath,
  redirectTo: TRedirectTo,
  options: Omit<
    StreamixRouteOptions<TName, undefined, undefined>,
    'redirectTo' | 'paramsSchema' | 'querySchema' | 'outlet'
  > = {},
): StreamixRedirectRoute<
  TPath,
  TName
> {
  return {
    kind: 'route',
    path,
    redirectTo,
    ...options,
  };
}

export function layout<
  const TPath extends string,
  const TEntries extends StreamixRoutes,
>(
  path: TPath,
  component: Type<unknown>,
  entries: TEntries,
  options?: StreamixLayoutOptions,
): StreamixLayout<
  TPath,
  TEntries
>;
export function layout<
  const TPath extends string,
  const TEntries extends StreamixRoutes,
>(
  path: TPath,
  component: StreamixFrame,
  entries: TEntries,
  options?: StreamixLayoutOptions,
): StreamixLayout<
  TPath,
  TEntries
>;
export function layout<
  const TPath extends string,
  const TEntries extends StreamixRoutes,
>(
  path: TPath,
  component: Type<unknown> | StreamixFrame,
  entries: TEntries,
  options: StreamixLayoutOptions = {},
): StreamixLayout<
  TPath,
  TEntries
> {
  const layout: StreamixLayout<
    TPath,
    TEntries
  > = {
    kind: 'layout',
    path,
    ...createViewRecord(component),
    entries,
    ...options,
  };

  return layout;
}

export function lazyLayout<
  const TPath extends string,
  const TEntries extends StreamixRoutes,
>(
  path: TPath,
  loadComponent: Lazy<Type<unknown>>,
  entries: TEntries,
  options?: StreamixLayoutOptions,
): StreamixLayout<
  TPath,
  TEntries
>;
export function lazyLayout<
  const TPath extends string,
  const TEntries extends StreamixRoutes,
>(
  path: TPath,
  loadComponent: StreamixFrame,
  entries: TEntries,
  options?: StreamixLayoutOptions,
): StreamixLayout<
  TPath,
  TEntries
>;
export function lazyLayout<
  const TPath extends string,
  const TEntries extends StreamixRoutes,
>(
  path: TPath,
  loadComponent: Lazy<Type<unknown>> | StreamixFrame,
  entries: TEntries,
  options: StreamixLayoutOptions = {},
): StreamixLayout<
  TPath,
  TEntries
> {
  const layout: StreamixLayout<
    TPath,
    TEntries
  > = {
    kind: 'layout',
    path,
    ...createLazyViewRecord(loadComponent),
    entries,
    ...options,
  };

  return layout;
}
