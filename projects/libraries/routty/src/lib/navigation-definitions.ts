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

export type NavigationProvider = Provider | EnvironmentProviders;
export type NavigationProviders = readonly NavigationProvider[];

export type RouteRedirect = {
  readonly redirectTo: string | URL;
  readonly replace?: boolean;
};

export type EmptyRouteData = Readonly<Record<string, never>>;
export type PrepareResult = void | RouteData;

export type PrepareFn<
  TResult extends PrepareResult = PrepareResult,
> = (context: NavigationContext) => MaybePromise<TResult>;

export type HookList<T> = T | readonly T[];

type AwaitedPrepareResult<TPrepare> =
  TPrepare extends (...args: never[]) => infer TResult
    ? Exclude<Awaited<TResult>, void>
    : never;

type UnionToIntersection<T> =
  (T extends unknown ? (value: T) => void : never) extends
    (value: infer TIntersection) => void ? TIntersection : never;

type Simplify<T> = { readonly [TKey in keyof T]: T[TKey] };

export type InferPreparedData<
  TPrepare extends HookList<PrepareFn> | undefined,
> = [TPrepare] extends [HookList<PrepareFn>]
  ? [AwaitedPrepareResult<
      TPrepare extends readonly PrepareFn[] ? TPrepare[number] : TPrepare
    >] extends [never]
    ? EmptyRouteData
    : Simplify<UnionToIntersection<AwaitedPrepareResult<
        TPrepare extends readonly PrepareFn[] ? TPrepare[number] : TPrepare
      >>>
  : EmptyRouteData;

export type AfterEnterFn<TData extends RouteData = RouteData> =
  (route: ActivatedRoute<TData>) => MaybePromise<void>;

export type BeforeLeaveFn<TData extends RouteData = RouteData> =
  (route: DeactivationContext<TData>) => MaybePromise<GuardResult>;

export interface NavigationHooks<
  TPrepare extends HookList<PrepareFn> | undefined =
    HookList<PrepareFn> | undefined,
> {
  readonly beforeEnter?: HookList<RouterCanActivateFn>;
  readonly beforeLeave?: HookList<BeforeLeaveFn<InferPreparedData<TPrepare>>>;
  readonly prepare?: TPrepare;
  readonly afterEnter?: HookList<AfterEnterFn<InferPreparedData<TPrepare>>>;
}

export interface NormalizedNavigationHooks<
  TData extends RouteData = RouteData,
> {
  readonly beforeEnter?: readonly RouterCanActivateFn[];
  readonly beforeLeave?: readonly BeforeLeaveFn<TData>[];
  readonly prepare?: readonly PrepareFn[];
  readonly afterEnter?: readonly AfterEnterFn<TData>[];
}

export interface RouteDefinitionBase<
  TPath extends string = string,
  TName extends string | undefined = string | undefined,
> {
  readonly path: TPath;
  readonly name?: TName;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly providers?: NavigationProviders;
}

export type RouteOutlets = Readonly<Record<string, Type<unknown>>>;

export interface RenderableRouteDefinitionBase<
  TPath extends string = string,
  TName extends string | undefined = string | undefined,
  TParams extends ParamSchemaRecord | undefined = ParamSchemaRecord | undefined,
  TQuery extends QuerySchemaRecord | undefined = QuerySchemaRecord | undefined,
> extends RouteDefinitionBase<TPath, TName> {
  readonly kind: 'route';
  /** Internal compiled outlet identity. Author named outlets through `outlets`. */
  readonly outlet?: string;
  readonly viewTransition?: boolean;
  readonly params?: TParams;
  readonly query?: TQuery;
  readonly outlets?: RouteOutlets;
}

export type ParamsForPath<TPath extends string> =
  [ExtractPathParams<TPath>] extends [never]
    ? never
    : Readonly<{
        [TKey in ExtractPathParams<TPath>]: ParamSchema;
      }>;

export type RouteOptions<
  TName extends string | undefined = string | undefined,
  TParams extends ParamSchemaRecord | undefined = ParamSchemaRecord | undefined,
  TQuery extends QuerySchemaRecord | undefined = QuerySchemaRecord | undefined,
  TPrepare extends HookList<PrepareFn> | undefined =
    HookList<PrepareFn> | undefined,
> = Omit<
  RenderableRouteDefinitionBase<string, TName, TParams, TQuery>,
  'kind' | 'path' | 'outlet'
> & NavigationHooks<TPrepare>;

export interface RedirectRouteDefinition<
  TPath extends string = string,
  TName extends string | undefined = string | undefined,
> extends RouteDefinitionBase<TPath, TName> {
  readonly kind: 'redirect';
  readonly redirectTo: string;
}

export type RenderableRoute<
  TPath extends string = string,
  TName extends string | undefined = string | undefined,
  TParams extends ParamSchemaRecord | undefined = ParamSchemaRecord | undefined,
  TQuery extends QuerySchemaRecord | undefined = QuerySchemaRecord | undefined,
  TPrepare extends HookList<PrepareFn> | undefined = HookList<PrepareFn> | undefined,
> = RenderableRouteDefinitionBase<TPath, TName, TParams, TQuery> &
  NormalizedNavigationHooks<InferPreparedData<TPrepare>> & {
    /** @internal Type-only carrier for prepared-data inference. */
    readonly __preparedData?: InferPreparedData<TPrepare>;
    readonly component: Type<unknown>;
    readonly redirectTo?: never;
  };

export type RouteDefinition<
  TPath extends string = string,
  TName extends string | undefined = string | undefined,
  TParams extends ParamSchemaRecord | undefined = ParamSchemaRecord | undefined,
  TQuery extends QuerySchemaRecord | undefined = QuerySchemaRecord | undefined,
  TPrepare extends HookList<PrepareFn> | undefined = HookList<PrepareFn> | undefined,
> =
  | RedirectRouteDefinition<TPath, TName>
  | RenderableRoute<TPath, TName, TParams, TQuery, TPrepare>;

export type InferRoutePreparedData<TRoute> =
  TRoute extends { readonly __preparedData?: infer TData }
    ? NonNullable<TData>
    : EmptyRouteData;

type NormalizePreparedData<TData> =
  string extends keyof TData ? Readonly<{}> : TData;

type MergePreparedData<TLeft, TRight> = Simplify<
  NormalizePreparedData<TLeft> & NormalizePreparedData<TRight>
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

export type LayoutOptions<
  TPrepare extends HookList<PrepareFn> | undefined =
    HookList<PrepareFn> | undefined,
> = Omit<LayoutDefinitionBase, 'kind' | 'path' | 'entries'> & NavigationHooks<TPrepare>;

export type LayoutDefinition<
  TPath extends string = string,
  TEntries extends NavigationTree = NavigationTree,
  TPrepare extends HookList<PrepareFn> | undefined = HookList<PrepareFn> | undefined,
> = LayoutDefinitionBase<TPath, TEntries> &
  NormalizedNavigationHooks<InferPreparedData<TPrepare>> & {
    /** @internal Type-only carrier for prepared-data inference. */
    readonly __preparedData?: InferPreparedData<TPrepare>;
    readonly component: Type<unknown>;
  };

type InferLayoutPreparedData<TLayout> =
  TLayout extends { readonly __preparedData?: infer TData }
    ? NonNullable<TData>
    : EmptyRouteData;

type EntryPreparedData<TEntry> =
  TEntry extends { readonly __preparedData?: infer TData }
    ? NonNullable<TData>
    : EmptyRouteData;

type InferNavigationPreparedDataFromEntry<
  TEntry,
  TName extends string,
  TInherited,
> = TEntry extends {
  readonly kind: 'layout';
  readonly entries: infer TEntries;
}
  ? InferNavigationPreparedDataFromTree<
      TEntries,
      TName,
      MergePreparedData<TInherited, EntryPreparedData<TEntry>>
    >
  : TEntry extends { readonly kind: 'route'; readonly name?: infer TRouteName }
    ? TRouteName extends TName
      ? MergePreparedData<TInherited, EntryPreparedData<TEntry>>
      : never
    : never;

type InferNavigationPreparedDataFromTree<
  TTree,
  TName extends string,
  TInherited,
> = TTree extends readonly unknown[]
  ? InferNavigationPreparedDataFromEntry<TTree[number], TName, TInherited>
  : never;

export type InferNavigationPreparedData<
  TTree extends NavigationTree,
  TName extends string,
> = [InferNavigationPreparedDataFromTree<TTree, TName, EmptyRouteData>] extends [never]
  ? never
  : InferNavigationPreparedDataFromTree<TTree, TName, EmptyRouteData>;

export type AnyRouteDefinition =
  | RedirectRouteDefinition<any, any>
  | (RenderableRouteDefinitionBase<any, any, any, any> & {
      readonly component: Type<unknown>;
      readonly beforeEnter?: readonly ((context: any) => MaybePromise<any>)[];
      readonly beforeLeave?: readonly ((context: any) => MaybePromise<any>)[];
      readonly prepare?: readonly ((context: any) => MaybePromise<any>)[];
      readonly afterEnter?: readonly ((context: any) => MaybePromise<any>)[];
    });

export type AnyLayoutDefinition = LayoutDefinitionBase<any, any> & {
  readonly component: Type<unknown>;
  readonly beforeEnter?: readonly ((context: any) => MaybePromise<any>)[];
  readonly beforeLeave?: readonly ((context: any) => MaybePromise<any>)[];
  readonly prepare?: readonly ((context: any) => MaybePromise<any>)[];
  readonly afterEnter?: readonly ((context: any) => MaybePromise<any>)[];
};

export type NavigationEntry = AnyRouteDefinition | AnyLayoutDefinition;
export type NavigationTree = readonly NavigationEntry[];
