import type { Type } from '@angular/core';

import type { QuerySchemaRecord } from './query-schema';
import type {
  FrameHooks,
  FramePrepareFn,
  FrameView,
  InferPreparedData,
  LayoutDefinition,
  LayoutOptions,
  Lazy,
  NavigationTree,
  ParamsSchemaForPath,
  RedirectRouteDefinition,
  RenderableRoute,
  RouteOptions,
  ViewDefinition,
} from './navigation-definitions';

function isFrame(value: unknown): value is FrameView<any> {
  return typeof value === 'object'
    && value !== null
    && 'kind' in value
    && value.kind === 'frame';
}

function isEagerFrame(
  value: FrameView<any>,
): value is FrameView<any> & { readonly component: Type<unknown> } {
  return 'component' in value && value.component !== undefined;
}

type ViewRecord<TFrame extends FrameView<any> | undefined = FrameView<any> | undefined> =
  ViewDefinition & {
    readonly frame?: TFrame;
  };

function createViewRecord<TFrame extends FrameView<any>>(
  view: TFrame,
): ViewRecord<TFrame>;
function createViewRecord(
  view: Type<unknown>,
): ViewRecord<undefined>;
function createViewRecord(
  view: Type<unknown> | FrameView<any>,
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

function createLazyViewRecord<TFrame extends FrameView<any>>(
  view: TFrame,
): ViewRecord<TFrame>;
function createLazyViewRecord(
  view: Lazy<Type<unknown>>,
): ViewRecord<undefined>;
function createLazyViewRecord(
  view: Lazy<Type<unknown>> | FrameView<any>,
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

export function frame<
  const TPrepare extends readonly FramePrepareFn[],
>(
  component: Type<unknown>,
  hooks: FrameHooks<TPrepare> & { readonly prepare: TPrepare },
): FrameView<InferPreparedData<TPrepare>>;
export function frame(
  component: Type<unknown>,
  hooks?: FrameHooks<undefined>,
): FrameView<Readonly<Record<string, never>>>;
export function frame(
  component: Type<unknown>,
  hooks: FrameHooks<any> = {},
): FrameView<any> {
  return {
    kind: 'frame',
    component,
    ...hooks,
  };
}

export function lazyFrame<
  const TPrepare extends readonly FramePrepareFn[],
>(
  loadComponent: Lazy<Type<unknown>>,
  hooks: FrameHooks<TPrepare> & { readonly prepare: TPrepare },
): FrameView<InferPreparedData<TPrepare>>;
export function lazyFrame(
  loadComponent: Lazy<Type<unknown>>,
  hooks?: FrameHooks<undefined>,
): FrameView<Readonly<Record<string, never>>>;
export function lazyFrame(
  loadComponent: Lazy<Type<unknown>>,
  hooks: FrameHooks<any> = {},
): FrameView<any> {
  return {
    kind: 'frame',
    loadComponent,
    ...hooks,
  };
}

export function route<
  const TPath extends string,
  const TName extends string | undefined = undefined,
  const TParamsSchema extends ParamsSchemaForPath<TPath> | undefined = undefined,
  const TQuerySchema extends QuerySchemaRecord | undefined = undefined,
>(
  path: TPath,
  component: Type<unknown>,
  options?: RouteOptions<TPath, TName, TParamsSchema, TQuerySchema>,
): RenderableRoute<TPath, TName, TParamsSchema, TQuerySchema, undefined>;
export function route<
  const TPath extends string,
  const TFrame extends FrameView<any>,
  const TName extends string | undefined = undefined,
  const TParamsSchema extends ParamsSchemaForPath<TPath> | undefined = undefined,
  const TQuerySchema extends QuerySchemaRecord | undefined = undefined,
>(
  path: TPath,
  component: TFrame,
  options?: RouteOptions<TPath, TName, TParamsSchema, TQuerySchema>,
): RenderableRoute<TPath, TName, TParamsSchema, TQuerySchema, TFrame>;
export function route<
  const TPath extends string,
  const TName extends string | undefined = undefined,
  const TParamsSchema extends ParamsSchemaForPath<TPath> | undefined = undefined,
  const TQuerySchema extends QuerySchemaRecord | undefined = undefined,
>(
  path: TPath,
  component: Type<unknown> | FrameView<any>,
  options: RouteOptions<TPath, TName, TParamsSchema, TQuerySchema> = {},
): RenderableRoute<TPath, TName, TParamsSchema, TQuerySchema> {
  return {
    kind: 'route',
    path,
    ...createViewRecord(component as Type<unknown>),
    ...options,
  } as RenderableRoute<TPath, TName, TParamsSchema, TQuerySchema>;
}

export function lazyRoute<
  const TPath extends string,
  const TName extends string | undefined = undefined,
  const TParamsSchema extends ParamsSchemaForPath<TPath> | undefined = undefined,
  const TQuerySchema extends QuerySchemaRecord | undefined = undefined,
>(
  path: TPath,
  loadComponent: Lazy<Type<unknown>>,
  options?: RouteOptions<TPath, TName, TParamsSchema, TQuerySchema>,
): RenderableRoute<TPath, TName, TParamsSchema, TQuerySchema, undefined>;
export function lazyRoute<
  const TPath extends string,
  const TFrame extends FrameView<any>,
  const TName extends string | undefined = undefined,
  const TParamsSchema extends ParamsSchemaForPath<TPath> | undefined = undefined,
  const TQuerySchema extends QuerySchemaRecord | undefined = undefined,
>(
  path: TPath,
  loadComponent: TFrame,
  options?: RouteOptions<TPath, TName, TParamsSchema, TQuerySchema>,
): RenderableRoute<TPath, TName, TParamsSchema, TQuerySchema, TFrame>;
export function lazyRoute<
  const TPath extends string,
  const TName extends string | undefined = undefined,
  const TParamsSchema extends ParamsSchemaForPath<TPath> | undefined = undefined,
  const TQuerySchema extends QuerySchemaRecord | undefined = undefined,
>(
  path: TPath,
  loadComponent: Lazy<Type<unknown>> | FrameView<any>,
  options: RouteOptions<TPath, TName, TParamsSchema, TQuerySchema> = {},
): RenderableRoute<TPath, TName, TParamsSchema, TQuerySchema> {
  return {
    kind: 'route',
    path,
    ...createLazyViewRecord(loadComponent as Lazy<Type<unknown>>),
    ...options,
  } as RenderableRoute<TPath, TName, TParamsSchema, TQuerySchema>;
}

export function redirectRoute<
  const TPath extends string,
  const TRedirectTo extends string,
  const TName extends string | undefined = undefined,
>(
  path: TPath,
  redirectTo: TRedirectTo,
  options: Omit<
    RouteOptions<TPath, TName, undefined, undefined>,
    'redirectTo' | 'paramsSchema' | 'querySchema' | 'outlet'
  > = {},
): RedirectRouteDefinition<TPath, TName> {
  return {
    kind: 'redirect',
    path,
    redirectTo,
    ...options,
  };
}

export function layout<
  const TPath extends string,
  const TEntries extends NavigationTree,
>(
  path: TPath,
  component: Type<unknown>,
  entries: TEntries,
  options?: LayoutOptions,
): LayoutDefinition<TPath, TEntries, undefined>;
export function layout<
  const TPath extends string,
  const TEntries extends NavigationTree,
  const TFrame extends FrameView<any>,
>(
  path: TPath,
  component: TFrame,
  entries: TEntries,
  options?: LayoutOptions,
): LayoutDefinition<TPath, TEntries, TFrame>;
export function layout<
  const TPath extends string,
  const TEntries extends NavigationTree,
>(
  path: TPath,
  component: Type<unknown> | FrameView<any>,
  entries: TEntries,
  options: LayoutOptions = {},
): LayoutDefinition<TPath, TEntries> {
  return {
    kind: 'layout',
    path,
    ...createViewRecord(component as Type<unknown>),
    entries,
    ...options,
  } as LayoutDefinition<TPath, TEntries>;
}

export function lazyLayout<
  const TPath extends string,
  const TEntries extends NavigationTree,
>(
  path: TPath,
  loadComponent: Lazy<Type<unknown>>,
  entries: TEntries,
  options?: LayoutOptions,
): LayoutDefinition<TPath, TEntries, undefined>;
export function lazyLayout<
  const TPath extends string,
  const TEntries extends NavigationTree,
  const TFrame extends FrameView<any>,
>(
  path: TPath,
  loadComponent: TFrame,
  entries: TEntries,
  options?: LayoutOptions,
): LayoutDefinition<TPath, TEntries, TFrame>;
export function lazyLayout<
  const TPath extends string,
  const TEntries extends NavigationTree,
>(
  path: TPath,
  loadComponent: Lazy<Type<unknown>> | FrameView<any>,
  entries: TEntries,
  options: LayoutOptions = {},
): LayoutDefinition<TPath, TEntries> {
  return {
    kind: 'layout',
    path,
    ...createLazyViewRecord(loadComponent as Lazy<Type<unknown>>),
    entries,
    ...options,
  } as LayoutDefinition<TPath, TEntries>;
}