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

export type NavigationProvider = Provider | EnvironmentProviders;
export type NavigationProviders = readonly NavigationProvider[];

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

export interface FrameHooks {
  readonly beforeEnter?: readonly RouterCanActivateFn[];
  readonly beforeLeave?: readonly RouterCanDeactivateFn[];
  readonly prepare?: readonly FramePrepareFn[];
  readonly afterEnter?: readonly FrameAfterEnterFn[];
}

export interface EagerViewDefinition {
  readonly component: Type<unknown>;
  readonly loadComponent?: never;
}

export interface LazyViewDefinition {
  readonly component?: never;
  readonly loadComponent: Lazy<Type<unknown>>;
}

export type ViewDefinition =
  | EagerViewDefinition
  | LazyViewDefinition;

export type FrameView =
  ViewDefinition &
  FrameHooks & {
    readonly kind: 'frame';
  };

export interface RouteDefinitionBase<
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
  readonly providers?: NavigationProviders;
  readonly canActivate?: readonly RouterCanActivateFn[];
  readonly canDeactivate?: readonly RouterCanDeactivateFn[];
}

export type RouteOptions<
  TName extends string | undefined = string | undefined,
  TParamsSchema extends ParamSchemaRecord | undefined = ParamSchemaRecord | undefined,
  TQuerySchema extends QuerySchemaRecord | undefined = QuerySchemaRecord | undefined,
> = Omit<
  RouteDefinitionBase<
    string,
    TName,
    TParamsSchema,
    TQuerySchema
  >,
  'kind' | 'path'
>;

export interface RedirectRouteDefinition<
  TPath extends string = string,
  TName extends string | undefined = string | undefined,
> extends RouteDefinitionBase<
    TPath,
    TName,
    undefined,
    undefined
  > {
  readonly redirectTo: string;
}

export type RenderableRoute<
  TPath extends string = string,
  TName extends string | undefined = string | undefined,
  TParamsSchema extends ParamSchemaRecord | undefined = ParamSchemaRecord | undefined,
  TQuerySchema extends QuerySchemaRecord | undefined = QuerySchemaRecord | undefined,
> =
  RouteDefinitionBase<
    TPath,
    TName,
    TParamsSchema,
    TQuerySchema
  > &
  ViewDefinition & {
  readonly frame?: FrameView;
  readonly redirectTo?: undefined;
};

export type RouteDefinition<
  TPath extends string = string,
  TName extends string | undefined = string | undefined,
  TParamsSchema extends ParamSchemaRecord | undefined = ParamSchemaRecord | undefined,
  TQuerySchema extends QuerySchemaRecord | undefined = QuerySchemaRecord | undefined,
> =
  | RedirectRouteDefinition<
      TPath,
      TName
    >
  | RenderableRoute<
      TPath,
      TName,
      TParamsSchema,
      TQuerySchema
    >;

export interface LayoutDefinitionBase<
  TPath extends string = string,
  TEntries extends NavigationTree = NavigationTree,
> {
  readonly kind: 'layout';
  readonly path: TPath;
  readonly entries: TEntries;
  readonly providers?: NavigationProviders;
}

export type LayoutOptions = Omit<
  LayoutDefinitionBase,
  'kind' | 'path' | 'entries'
>;

export type LayoutDefinition<
  TPath extends string = string,
  TEntries extends NavigationTree = NavigationTree,
> =
  LayoutDefinitionBase<
    TPath,
    TEntries
  > &
  ViewDefinition & {
    readonly frame?: FrameView;
  };

// Any-instantiated route/layout primitives to avoid undefined-widening issues
export type AnyRouteDefinition = RouteDefinition<any, any, any, any>;
export type AnyLayoutDefinition = LayoutDefinition<any, any>;

export type NavigationEntry = AnyRouteDefinition | AnyLayoutDefinition;
export type NavigationTree = readonly NavigationEntry[];

