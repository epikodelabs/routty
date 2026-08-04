import type { EnvironmentProviders, Provider, Type } from '@angular/core';
import type { ParamSchema, ParamSchemaRecord, QuerySchemaRecord } from './query-schema';
import type { ExtractPathParams } from './route-path';
import type {
  ActivatedRoute,
  CanActivateFn as RouterCanActivateFn,
  DeactivationContext,
  GuardResult,
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

export type FramePrepareResult = void | RouteData;

export type FramePrepareFn<
  TResult extends FramePrepareResult = FramePrepareResult,
> = (
  context: NavigationContext,
) => MaybePromise<TResult>;

type AwaitedPrepareResult<TPrepare> =
  TPrepare extends (...args: never[]) => infer TResult
    ? Exclude<Awaited<TResult>, void>
    : never;

type UnionToIntersection<T> =
  (T extends unknown ? (value: T) => void : never) extends
    (value: infer TIntersection) => void
      ? TIntersection
      : never;

type Simplify<T> = {
  readonly [TKey in keyof T]: T[TKey];
};

/**
 * Merges the object results of all prepare handlers in a frame.
 * A handler returning void contributes no keys.
 */
export type InferPreparedData<
  TPrepare extends readonly FramePrepareFn[] | undefined,
> = [TPrepare] extends [readonly FramePrepareFn[]]
  ? [AwaitedPrepareResult<TPrepare[number]>] extends [never]
    ? Readonly<Record<string, never>>
    : Simplify<UnionToIntersection<AwaitedPrepareResult<TPrepare[number]>>>
  : Readonly<Record<string, never>>;

export type FrameAfterEnterFn<
  TData extends RouteData = RouteData,
> = (
  route: ActivatedRoute<TData>,
) => MaybePromise<void>;

export type FrameBeforeLeaveFn<
  TData extends RouteData = RouteData,
> = (
  route: DeactivationContext<TData>,
) => MaybePromise<GuardResult>;

export interface FrameHooks<
  TPrepare extends readonly FramePrepareFn[] | undefined =
    readonly FramePrepareFn[] | undefined,
> {
  readonly beforeEnter?: readonly RouterCanActivateFn[];
  readonly beforeLeave?: readonly FrameBeforeLeaveFn<InferPreparedData<TPrepare>>[];
  readonly prepare?: TPrepare;
  readonly afterEnter?: readonly FrameAfterEnterFn<InferPreparedData<TPrepare>>[];
}

export interface EagerViewDefinition {
  readonly component: Type<unknown>;
  readonly loadComponent?: never;
}

export interface LazyViewDefinition {
  readonly component?: never;
  readonly loadComponent: Lazy<Type<unknown>>;
}

export type ViewDefinition = EagerViewDefinition | LazyViewDefinition;

export type FrameView<
  TData extends RouteData = RouteData,
> = ViewDefinition & {
  readonly kind: 'frame';
  readonly beforeEnter?: readonly RouterCanActivateFn[];
  readonly beforeLeave?: readonly FrameBeforeLeaveFn<TData>[];
  readonly prepare?: readonly FramePrepareFn[];
  readonly afterEnter?: readonly FrameAfterEnterFn<TData>[];
};

export type InferFrameData<TFrame> =
  TFrame extends FrameView<infer TData>
    ? TData
    : Readonly<Record<string, never>>;

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
}

export type ParamsSchemaForPath<TPath extends string> =
  [ExtractPathParams<TPath>] extends [never]
    ? never
    : Readonly<{
        [TKey in ExtractPathParams<TPath>]: ParamSchema;
      }>;

export type RouteOptions<
  TPath extends string = string,
  TName extends string | undefined = string | undefined,
  TParamsSchema extends ParamSchemaRecord | undefined = ParamSchemaRecord | undefined,
  TQuerySchema extends QuerySchemaRecord | undefined = QuerySchemaRecord | undefined,
> = Omit<
  RouteDefinitionBase<TPath, TName, TParamsSchema, TQuerySchema>,
  'kind' | 'path'
>;

export interface RedirectRouteDefinition<
  TPath extends string = string,
  TName extends string | undefined = string | undefined,
> {
  readonly kind: 'redirect';
  readonly path: TPath;
  readonly name?: TName;
  readonly redirectTo: string;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly providers?: NavigationProviders;
}

export type RenderableRoute<
  TPath extends string = string,
  TName extends string | undefined = string | undefined,
  TParamsSchema extends ParamSchemaRecord | undefined = ParamSchemaRecord | undefined,
  TQuerySchema extends QuerySchemaRecord | undefined = QuerySchemaRecord | undefined,
  TFrame extends FrameView<any> | undefined = FrameView<any> | undefined,
> = RouteDefinitionBase<TPath, TName, TParamsSchema, TQuerySchema> &
  ViewDefinition & {
    readonly frame?: TFrame;
  };

export type RouteDefinition<
  TPath extends string = string,
  TName extends string | undefined = string | undefined,
  TParamsSchema extends ParamSchemaRecord | undefined = ParamSchemaRecord | undefined,
  TQuerySchema extends QuerySchemaRecord | undefined = QuerySchemaRecord | undefined,
  TFrame extends FrameView<any> | undefined = FrameView<any> | undefined,
> =
  | RedirectRouteDefinition<TPath, TName>
  | RenderableRoute<TPath, TName, TParamsSchema, TQuerySchema, TFrame>;

export type InferRoutePreparedData<TRoute> =
  TRoute extends RenderableRoute<string, string | undefined, any, any, infer TFrame>
    ? TFrame extends FrameView<any>
      ? InferFrameData<TFrame>
      : Readonly<Record<string, never>>
    : Readonly<Record<string, never>>;



type EmptyRouteData = Readonly<Record<string, never>>;

type NormalizePreparedData<TData> =
  string extends keyof TData ? Readonly<{}> : TData;

type MergePreparedData<TLeft, TRight> = Simplify<
  NormalizePreparedData<TLeft> & NormalizePreparedData<TRight>
>;

type InferLayoutPreparedData<TLayout> =
  TLayout extends LayoutDefinition<any, any, infer TFrame>
    ? TFrame extends FrameView<any>
      ? InferFrameData<TFrame>
      : EmptyRouteData
    : EmptyRouteData;

type RouteNameMatches<TRoute, TName extends string> =
  TRoute extends { readonly name?: infer TRouteName }
    ? TRouteName extends TName
      ? true
      : false
    : false;

type InferNavigationPreparedDataFromEntry<
  TEntry,
  TName extends string,
  TInherited extends RouteData,
> = TEntry extends LayoutDefinition<any, infer TEntries, any>
  ? InferNavigationPreparedDataFromTree<
      TEntries,
      TName,
      MergePreparedData<TInherited, InferLayoutPreparedData<TEntry>>
    >
  : TEntry extends RouteDefinition
    ? RouteNameMatches<TEntry, TName> extends true
      ? MergePreparedData<TInherited, InferRoutePreparedData<TEntry>>
      : never
    : never;

type InferNavigationPreparedDataFromTree<
  TTree,
  TName extends string,
  TInherited extends RouteData,
> = TTree extends readonly unknown[]
  ? InferNavigationPreparedDataFromEntry<TTree[number], TName, TInherited>
  : never;

/**
 * Infers all data returned by prepare handlers for a named route, including
 * every parent layout frame and the route frame itself.
 */
export type InferNavigationPreparedData<
  TTree extends NavigationTree,
  TName extends string,
> = [InferNavigationPreparedDataFromTree<TTree, TName, EmptyRouteData>] extends [never]
  ? never
  : InferNavigationPreparedDataFromTree<TTree, TName, EmptyRouteData>;

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
  TFrame extends FrameView<any> | undefined = FrameView<any> | undefined,
> = LayoutDefinitionBase<TPath, TEntries> &
  ViewDefinition & {
    readonly frame?: TFrame;
  };

export type AnyRouteDefinition = RouteDefinition<any, any, any, any, any>;
export type AnyLayoutDefinition = LayoutDefinition<any, any, any>;

export type NavigationEntry = AnyRouteDefinition | AnyLayoutDefinition;
export type NavigationTree = readonly NavigationEntry[];