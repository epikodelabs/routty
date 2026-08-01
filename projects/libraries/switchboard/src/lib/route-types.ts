import type { EnvironmentProviders, Provider, Type } from '@angular/core';
import type { ParamSchemaRecord, QuerySchemaRecord } from './query-schema';
import type {
  ActivatedRoute,
  CanActivateFn as RouterCanActivateFn,
  CanDeactivateFn as RouterCanDeactivateFn,
  NavigationContext,
  RouteData,
} from './vanilla-router';

export type MaybePromise<T> = T | PromiseLike<T>;
export type Lazy<T> = () => MaybePromise<T | { readonly default: T }>;

export type StreamixRouteProvider = Provider | EnvironmentProviders;
export type StreamixRouteProviders = readonly StreamixRouteProvider[];

export type RouteRedirect = {
  readonly redirectTo: string | URL;
  readonly replace?: boolean;
};

export type FramePrepareResult =
  | void
  | RouteData;

export type FramePrepareFn = (
  context: NavigationContext,
) => MaybePromise<FramePrepareResult>;

export type FrameAfterEnterFn = (
  route: ActivatedRoute,
) => MaybePromise<void>;

export interface StreamixFrameHooks {
  readonly beforeEnter?: readonly RouterCanActivateFn[];
  readonly beforeLeave?: readonly RouterCanDeactivateFn[];
  readonly prepare?: readonly FramePrepareFn[];
  readonly afterEnter?: readonly FrameAfterEnterFn[];
}

export interface StreamixEagerView {
  readonly component: Type<unknown>;
  readonly loadComponent?: never;
}

export interface StreamixLazyView {
  readonly component?: never;
  readonly loadComponent: Lazy<Type<unknown>>;
}

export type StreamixView =
  | StreamixEagerView
  | StreamixLazyView;

export type StreamixFrame =
  StreamixView &
  StreamixFrameHooks & {
    readonly kind: 'frame';
  };

export interface StreamixRouteBase<
  TPath extends string = string,
  TName extends string | undefined = string | undefined,
  TParamsSchema extends ParamSchemaRecord | undefined = ParamSchemaRecord | undefined,
  TQuerySchema extends QuerySchemaRecord | undefined = QuerySchemaRecord | undefined,
> {
  readonly kind: 'route';
  readonly path: TPath;
  readonly name?: TName;
  readonly outlet?: string;
  readonly preload?: boolean;
  readonly viewTransition?: boolean;
  readonly paramsSchema?: TParamsSchema;
  readonly querySchema?: TQuerySchema;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly providers?: StreamixRouteProviders;
  readonly canActivate?: readonly RouterCanActivateFn[];
  readonly canDeactivate?: readonly RouterCanDeactivateFn[];
}

export type StreamixRouteOptions<
  TName extends string | undefined = string | undefined,
  TParamsSchema extends ParamSchemaRecord | undefined = ParamSchemaRecord | undefined,
  TQuerySchema extends QuerySchemaRecord | undefined = QuerySchemaRecord | undefined,
> = Omit<
  StreamixRouteBase<
    string,
    TName,
    TParamsSchema,
    TQuerySchema
  >,
  'kind' | 'path'
>;

export interface StreamixRedirectRoute<
  TPath extends string = string,
  TName extends string | undefined = string | undefined,
> extends StreamixRouteBase<
    TPath,
    TName,
    undefined,
    undefined
  > {
  readonly redirectTo: string;
}

export type StreamixRenderableRoute<
  TPath extends string = string,
  TName extends string | undefined = string | undefined,
  TParamsSchema extends ParamSchemaRecord | undefined = ParamSchemaRecord | undefined,
  TQuerySchema extends QuerySchemaRecord | undefined = QuerySchemaRecord | undefined,
> =
  StreamixRouteBase<
    TPath,
    TName,
    TParamsSchema,
    TQuerySchema
  > &
  StreamixView & {
  readonly frame?: StreamixFrame;
  readonly redirectTo?: undefined;
};

export type StreamixRoute<
  TPath extends string = string,
  TName extends string | undefined = string | undefined,
  TParamsSchema extends ParamSchemaRecord | undefined = ParamSchemaRecord | undefined,
  TQuerySchema extends QuerySchemaRecord | undefined = QuerySchemaRecord | undefined,
> =
  | StreamixRedirectRoute<
      TPath,
      TName
    >
  | StreamixRenderableRoute<
      TPath,
      TName,
      TParamsSchema,
      TQuerySchema
    >;

export interface StreamixLayoutBase<
  TPath extends string = string,
  TEntries extends StreamixRoutes = StreamixRoutes,
> {
  readonly kind: 'layout';
  readonly path: TPath;
  readonly entries: TEntries;
  readonly providers?: StreamixRouteProviders;
}

export type StreamixLayoutOptions = Omit<
  StreamixLayoutBase,
  'kind' | 'path' | 'entries'
>;

export type StreamixLayout<
  TPath extends string = string,
  TEntries extends StreamixRoutes = StreamixRoutes,
> =
  StreamixLayoutBase<
    TPath,
    TEntries
  > &
  StreamixView & {
    readonly frame?: StreamixFrame;
  };

// Any-instantiated route/layout primitives to avoid undefined-widening issues
export type AnyStreamixRoute = StreamixRoute<any, any, any, any>;
export type AnyStreamixLayout = StreamixLayout<any, any>;

export type StreamixRouteEntry = AnyStreamixRoute | AnyStreamixLayout;
export type StreamixRoutes = readonly StreamixRouteEntry[];
