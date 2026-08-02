This file is a merged representation of the entire codebase, combined into a single document by Repomix.

# File Summary

## Purpose
This file contains a packed representation of the entire repository's contents.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
5. Multiple file entries, each consisting of:
  a. A header with the file path (## File: path/to/file)
  b. The full contents of the file in a code block

## Usage Guidelines
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Files are sorted by Git change count (files with more changes are at the bottom)

# Directory Structure
````
src/
  lib/
    adapter-utils.ts
    history.ts
    index.ts
    navigation-definitions.ts
    navigation-targets.ts
    query-schema.ts
    route-adapter.ts
    route-builders.ts
    route-compiler.ts
    route-renderer.ts
    router-events.ts
    router-link.ts
    router-outlet.ts
    router-url.ts
    router.ts
    typed-navigation.ts
    vanilla-router.ts
  tests/
    adapters.spec.ts
    angular-testbed.init.ts
    env.spec.ts
    outlet-isolation.spec.ts
    router-facade.spec.ts
    router-link.spec.ts
    router.spec.ts
    typed-navigation.spec.ts
  public-api.ts
ng-package.json
package.json
README.md
tsconfig.lib.json
tsconfig.lib.prod.json
tsconfig.spec.json
````

# Files

## File: src/lib/adapter-utils.ts
````typescript
import {
  type DestroyRef,
  type EnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';

import { ROUTER_LOCATION_CHANGE_EVENT } from './router-events';

export type MaybePromise<T> = T | PromiseLike<T>;

export interface Destroyable {
  destroy(): void;
}

export class ModuleRegistry {
  private readonly refs: Destroyable[] = [];

  add(ref: Destroyable): void {
    this.refs.push(ref);
  }

  dispose(onError: (error: unknown) => void = console.error): void {
    for (let index = this.refs.length - 1; index >= 0; index--) {
      try {
        this.refs[index].destroy();
      } catch (error) {
        onError(error);
      }
    }
    this.refs.length = 0;
  }
}

export function unwrapDefault<T>(value: T | { default: T }): T {
  return value !== null && typeof value === 'object' && 'default' in value
    ? (value as { default: T }).default
    : (value as T);
}

/**
 * Invokes a handler inside Angular's synchronous injection context.
 *
 * The handler may call inject() during its initial synchronous execution.
 * Dependencies needed after an await boundary must be captured before the
 * handler yields, because Angular does not preserve injection context across
 * arbitrary asynchronous continuations.
 */
export function runWithInjector<TContext, TResult>(
  injector: EnvironmentInjector,
  handler: (context: TContext) => MaybePromise<TResult>,
  context: TContext,
): Promise<TResult> {
  return runInInjectionContext(injector, () => Promise.resolve(handler(context)));
}

export function watchRouterLocation(
  destroyRef: DestroyRef,
  refresh: () => void,
): void {
  if (typeof window === 'undefined') {
    return;
  }

  const listener = () => refresh();
  window.addEventListener(ROUTER_LOCATION_CHANGE_EVENT, listener);
  window.addEventListener('popstate', listener);

  destroyRef.onDestroy(() => {
    window.removeEventListener(ROUTER_LOCATION_CHANGE_EVENT, listener);
    window.removeEventListener('popstate', listener);
  });
}
````

## File: src/lib/history.ts
````typescript
export interface ScrollPosition {
  readonly x: number;
  readonly y: number;
}

export interface HistoryEntry {
  readonly href: string;
  readonly scroll: ScrollPosition;
  readonly state: unknown;
}

export interface HistoryUpdate {
  readonly type: 'none' | 'push' | 'replace' | 'popstate';
  readonly previousIndex: number;
  readonly nextIndex: number;
  readonly previousEntry?: HistoryEntry;
  readonly previousScroll: ScrollPosition;
  readonly nextEntry?: HistoryEntry;
}

export const ZERO_SCROLL: ScrollPosition = Object.freeze({ x: 0, y: 0 });

export class HistoryManager {
  constructor(
    private readonly browserWindow: Pick<Window, 'history' | 'scrollX' | 'scrollY'> | null =
      typeof window === 'undefined' ? null : window,
    private readonly location: Pick<Location, 'pathname' | 'search' | 'hash'> =
      typeof window === 'undefined'
        ? { pathname: '/', search: '', hash: '' }
        : window.location,
  ) {}

  private entries: HistoryEntry[] = [];
  private index = -1;

  private get currentHref(): string {
    return this.location.pathname + this.location.search + this.location.hash;
  }

  private readScroll(): ScrollPosition {
    return {
      x: this.browserWindow?.scrollX ?? 0,
      y: this.browserWindow?.scrollY ?? 0,
    };
  }

  private readHistoryState(): unknown {
    return this.browserWindow?.history.state ?? null;
  }

  private ensureHistoryEntry(): void {
    if (this.entries.length > 0) {
      return;
    }

    this.entries = [{
      href: this.currentHref,
      scroll: this.readScroll(),
      state: this.readHistoryState(),
    }];
    this.index = 0;
  }

  private saveCurrentScroll(): ScrollPosition {
    const scroll = this.readScroll();
    if (this.index >= 0) {
      const entry = this.entries[this.index];
      if (entry) {
        this.entries[this.index] = {
          href: entry.href,
          scroll,
          state: entry.state,
        };
      }
    }
    return scroll;
  }

  createDefaultUpdate(): HistoryUpdate {
    this.ensureHistoryEntry();
    return {
      type: 'none',
      previousIndex: this.index,
      nextIndex: this.index,
      previousScroll: this.readScroll(),
      previousEntry: this.entries[this.index],
    };
  }

  createUpdate(href: string, replace: boolean, state: unknown): HistoryUpdate {
    this.ensureHistoryEntry();
    const previousScroll = this.saveCurrentScroll();
    const previousIndex = this.index;
    const nextEntry: HistoryEntry = {
      href,
      scroll: replace ? previousScroll : ZERO_SCROLL,
      state: state ?? null,
    };

    if (replace) {
      const previousEntry = this.entries[this.index];
      this.entries[this.index] = nextEntry;
      return {
        type: 'replace',
        previousIndex,
        nextIndex: this.index,
        previousEntry,
        previousScroll,
        nextEntry,
      };
    }

    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push(nextEntry);
    return {
      type: 'push',
      previousIndex,
      nextIndex: this.index + 1,
      previousScroll,
      previousEntry: this.entries[previousIndex],
      nextEntry,
    };
  }

  createPopStateUpdate(href: string): HistoryUpdate {
    this.ensureHistoryEntry();
    const previousScroll = this.saveCurrentScroll();
    const previousIndex = this.index;
    const resolvedIndex = this.findHistoryIndexByHref(href);
    const nextIndex = resolvedIndex >= 0 ? resolvedIndex : previousIndex;
    const nextEntry = this.entries[nextIndex]
      ? {
        ...this.entries[nextIndex]!,
        href,
        state: this.readHistoryState(),
      }
      : {
        href,
        scroll: ZERO_SCROLL,
        state: this.readHistoryState(),
      };

    return {
      type: 'popstate',
      previousIndex,
      nextIndex,
      previousScroll,
      previousEntry: this.entries[previousIndex],
      nextEntry,
    };
  }

  private findHistoryIndexByHref(href: string): number {
    if (this.entries.length === 0) {
      return -1;
    }

    const previous = this.entries[this.index - 1];
    if (previous?.href === href) {
      return this.index - 1;
    }

    const next = this.entries[this.index + 1];
    if (next?.href === href) {
      return this.index + 1;
    }

    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < this.entries.length; index++) {
      if (this.entries[index]?.href !== href || index === this.index) {
        continue;
      }

      const distance = Math.abs(index - this.index);
      if (distance < bestDistance) {
        bestIndex = index;
        bestDistance = distance;
      }
    }

    return bestIndex;
  }

  rollbackUpdate(update: HistoryUpdate): void {
    switch (update.type) {
      case 'push':
        this.entries = this.entries.slice(0, update.previousIndex + 1);
        this.index = update.previousIndex;
        return;
      case 'replace':
        if (update.previousEntry && update.previousIndex >= 0) {
          this.entries[update.previousIndex] = update.previousEntry;
        }
        this.index = update.previousIndex;
        return;
      case 'popstate':
      case 'none':
        this.index = update.previousIndex;
        return;
    }
  }

  commitUpdate(update: HistoryUpdate, href: string): void {
    this.index = update.nextIndex;
    this.entries[this.index] = update.nextEntry ?? {
      href,
      scroll: update.type === 'replace' ? update.previousScroll : ZERO_SCROLL,
      state: null,
    };
  }
}
````

## File: src/lib/index.ts
````typescript
export * from './navigation-targets';
export { RouterOutlet } from './router-outlet';
export * from './query-schema';
export * from './route-adapter';
export * from './route-builders';
export { RouterLink } from './router-link';
export * from './navigation-definitions';
export * from './router-events';
export * from './router-url';
export * from './typed-navigation';
export {
    createRouter,
    type ActivatedRoute,
    type DeactivationContext,
    type LoadedRoute,
    type NavigationContext,
    type NavigationOptions,
    type NavigationPhase,
    type NavigationTransition,
    type NavigationTransitionDefinition,
    type NavigationTransitionFn,
    type PreparedOutlet,
    type PreloadingStrategy,
    type RenderedRouteNode,
    type Route,
    type RouteComponent,
    type RouteData,
    type RouteParams,
    type RouteQuery,
    type RouteRenderContext,
    type Router as VanillaRouter,
    type RouterConfig as VanillaRouterConfig,
    type RouterState,
    type ScrollRestorationMode,
    type VanillaRouterInstance,
    type ViewTransitionContext,
    type ViewTransitionPhase,
    type ViewTransitionsOption
} from './vanilla-router';
export {
    provideRouter, ROUTE,
    ROUTE_CONTEXT, Router, type RouterOptions
} from './router';
````

## File: src/lib/navigation-definitions.ts
````typescript
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
````

## File: src/lib/navigation-targets.ts
````typescript
export type PathNavigationTarget = {
  readonly path: string | URL;
};

export type NamedNavigationTarget<
  TName extends string = string,
  TParams = Record<string, unknown>,
  TQuery = Record<string, unknown>,
> = {
  readonly name: TName;
  readonly params?: TParams;
  readonly query?: TQuery;
};

/**
 * A discriminated union representing a navigation target.
 * Can be a raw URL string, a URL object, or an object specifying
 * a path or a named route with parameters.
 */
export type NavigationTarget =
  | string
  | URL
  | PathNavigationTarget
  | NamedNavigationTarget;
````

## File: src/lib/query-schema.ts
````typescript
type ScalarSchema =
  | StringSchema
  | NumberSchema
  | BooleanSchema
  | DateSchema;

type NonOptionalSchema =
  | ScalarSchema
  | ArraySchema;

export type QuerySchema =
  | NonOptionalSchema
  | OptionalSchema<NonOptionalSchema>;

export type ParamSchema =
  | ScalarSchema
  | OptionalSchema<ScalarSchema>;

export type QuerySchemaRecord = Readonly<Record<string, QuerySchema>>;
export type ParamSchemaRecord = Readonly<Record<string, ParamSchema>>;

interface StringSchema {
  readonly _type: 'string';
  readonly default?: string;
}

interface NumberSchema {
  readonly _type: 'number';
  readonly default?: number;
  readonly min?: number;
  readonly max?: number;
}

interface BooleanSchema {
  readonly _type: 'boolean';
  readonly default?: boolean;
}

interface ArraySchema {
  readonly _type: 'array';
  readonly default?: readonly string[];
}

interface DateSchema {
  readonly _type: 'date';
  readonly default?: Date;
}

interface OptionalSchema<T extends NonOptionalSchema> {
  readonly _type: 'optional';
  readonly inner: T;
}

export const s = {
  string: (defaultValue?: string): StringSchema => ({
    _type: 'string',
    default: defaultValue,
  }),

  number: (opts?: {
    default?: number;
    min?: number;
    max?: number;
  }): NumberSchema => ({
    _type: 'number',
    ...opts,
  }),

  boolean: (defaultValue?: boolean): BooleanSchema => ({
    _type: 'boolean',
    default: defaultValue,
  }),

  array: (defaultValue?: readonly string[]): ArraySchema => ({
    _type: 'array',
    default: defaultValue,
  }),

  date: (defaultValue?: Date): DateSchema => ({
    _type: 'date',
    default: defaultValue,
  }),

  optional: <T extends NonOptionalSchema>(inner: T): OptionalSchema<T> => ({
    _type: 'optional',
    inner,
  }),
} as const;

type SchemaValue<TSchema extends QuerySchema | ParamSchema> =
  TSchema extends OptionalSchema<infer TInner>
    ? SchemaValue<TInner>
    : TSchema extends StringSchema
      ? string
      : TSchema extends NumberSchema
        ? number
        : TSchema extends BooleanSchema
          ? boolean
          : TSchema extends ArraySchema
            ? readonly string[]
            : TSchema extends DateSchema
              ? Date
              : unknown;

export type InferQueryType<T extends Record<string, QuerySchema>> = {
  [K in keyof T as T[K] extends OptionalSchema<NonOptionalSchema>
    ? never
    : K]: SchemaValue<T[K]>;
} & {
  [K in keyof T as T[K] extends OptionalSchema<NonOptionalSchema>
    ? K
    : never]?: SchemaValue<T[K]>;
};

export type InferQueryInputType<T extends Record<string, QuerySchema>> = {
  [K in keyof T]?: SchemaValue<T[K]>;
};

export type InferParamType<T extends Record<string, ParamSchema>> = {
  [K in keyof T as T[K] extends OptionalSchema<ScalarSchema>
    ? never
    : K]: SchemaValue<T[K]>;
} & {
  [K in keyof T as T[K] extends OptionalSchema<ScalarSchema>
    ? K
    : never]?: SchemaValue<T[K]>;
};

function parseValue(
  spec: QuerySchema | ParamSchema,
  raw: string | undefined,
): unknown {
  if (raw === undefined) {
    if (spec._type === 'optional') return undefined;
    return undefined;
  }

  switch (spec._type) {
    case 'string':
      return raw;
    case 'number': {
      const value = Number(raw);
      if (Number.isNaN(value)) {
        if (spec.default !== undefined) {
          return spec.default;
        }

        throw new Error(
          `Invalid number value "${raw}".`,
        );
      }

      const min = spec.min ?? -Infinity;
      const max = spec.max ?? Infinity;
      return Math.max(min, Math.min(max, value));
    }
    case 'boolean':
      return raw === 'true' || raw === '1'
        ? true
        : raw === 'false' || raw === '0'
          ? false
          : (spec.default ?? false);
    case 'date': {
      const value = new Date(raw);
      if (!Number.isNaN(value.getTime())) {
        return value;
      }

      if (spec.default) {
        return new Date(
          spec.default.getTime(),
        );
      }

      throw new Error(
        `Invalid date value "${raw}".`,
      );
    }
    case 'optional':
      return parseValue(spec.inner, raw);
    default:
      return raw;
  }
}

function getDefault(spec: QuerySchema): unknown {
  switch (spec._type) {
    case 'string':
      return spec.default ?? '';
    case 'number':
      return spec.default ?? 0;
    case 'boolean':
      return spec.default ?? false;
    case 'array':
      return Object.freeze([...(spec.default ?? [])]);
    case 'date':
      return spec.default
        ? new Date(spec.default.getTime())
        : new Date();
    case 'optional':
      return undefined;
    default:
      return undefined;
  }
}

function getParamDefault(spec: ParamSchema): unknown {
  switch (spec._type) {
    case 'string':
      return spec.default ?? '';
    case 'number':
      return spec.default ?? 0;
    case 'boolean':
      return spec.default ?? false;
    case 'date':
      return spec.default
        ? new Date(spec.default.getTime())
        : new Date();
    case 'optional':
      return undefined;
    default:
      return undefined;
  }
}

function parseQueryInternal(
  schema: Record<string, QuerySchema>,
  url: URL,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, spec] of Object.entries(schema)) {
    const allValues = url.searchParams.getAll(key);
    const raw = allValues[0];

    if (spec._type === 'array') {
      result[key] =
        allValues.length > 0
          ? Object.freeze([...allValues])
          : Object.freeze([...(spec.default ?? [])]);
      continue;
    }

    if (spec._type === 'optional' && raw === undefined) {
      continue;
    }

    const parsed = parseValue(spec, raw);
    result[key] = parsed !== undefined ? parsed : getDefault(spec);
  }

  return Object.freeze(result);
}

export function parseQuery<T extends Record<string, QuerySchema>>(
  schema: T,
  url: URL,
): InferQueryType<T> {
  return parseQueryInternal(schema, url) as InferQueryType<T>;
}

export function parseQueryRecord(
  schema: Record<string, QuerySchema>,
  url: URL,
): Record<string, unknown> {
  return parseQueryInternal(schema, url);
}

export function parseParams<T extends Record<string, ParamSchema>>(
  schema: T,
  params: Record<string, string>,
): InferParamType<T> {
  const result: Record<string, unknown> = {};

  for (const [key, spec] of Object.entries(schema)) {
    const raw = params[key];

    if (spec._type === 'optional' && raw === undefined) {
      continue;
    }

    const parsed = parseValue(spec, raw);
    result[key] = parsed !== undefined ? parsed : getParamDefault(spec);
  }

  return Object.freeze(result) as InferParamType<T>;
}

export function parseParamsRecord(
  schema: Record<string, ParamSchema>,
  params: Record<string, string>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, spec] of Object.entries(schema)) {
    const raw = params[key];

    if (spec._type === 'optional' && raw === undefined) {
      continue;
    }

    const parsed = parseValue(spec, raw);
    result[key] = parsed !== undefined ? parsed : getParamDefault(spec);
  }

  return Object.freeze(result);
}

function unwrapOptionalQuerySchema(
  schema: QuerySchema,
): QuerySchema {
  let current = schema;

  while (current._type === 'optional') {
    current = current.inner;
  }

  return current;
}

export function serializeQuery<
  const T extends QuerySchemaRecord,
>(
  schema: T,
  values: Readonly<Record<string, unknown>>,
): string {
  return serializeQueryRecord(
    schema,
    values,
  );
}

export function serializeQueryRecord(
  schema: QuerySchemaRecord,
  values: Readonly<Record<string, unknown>>,
): string {
  const params =
    new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      continue;
    }

    const declared =
      schema[key];

    if (!declared) {
      continue;
    }

    const spec =
      unwrapOptionalQuerySchema(
        declared,
      );

    if (
      spec._type === 'array' &&
      Array.isArray(value)
    ) {
      for (const item of value) {
        params.append(
          key,
          String(item),
        );
      }

      continue;
    }

    if (
      spec._type === 'date' &&
      value instanceof Date
    ) {
      params.set(
        key,
        value.toISOString(),
      );

      continue;
    }

    if (value !== getDefault(declared)) {
      params.set(
        key,
        String(value),
      );
    }
  }

  const search =
    params.toString();

  return search
    ? `?${search}`
    : '';
}

function serializeValue(
  spec: QuerySchema | ParamSchema,
  value: unknown,
): string {
  if (spec._type === 'optional') {
    return serializeValue(spec.inner, value);
  }

  if (spec._type === 'date' && value instanceof Date) {
    return value.toISOString();
  }

  if (spec._type === 'boolean') {
    return value ? 'true' : 'false';
  }

  return String(value);
}

export function serializeParams<T extends Record<string, ParamSchema>>(
  schema: T,
  values: InferParamType<T>,
): Record<string, string> {
  const params: Record<string, string> = {};

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      continue;
    }

    const spec = schema[key];
    if (!spec) {
      params[key] = String(value);
      continue;
    }

    params[key] = serializeValue(spec, value);
  }

  return params;
}
````

## File: src/lib/route-adapter.ts
````typescript
import {
  reflectComponentType,
  type EnvironmentInjector,
  type Type,
} from '@angular/core';

import type { NavigationProviders } from './navigation-definitions';
import type { ActivatedRoute, RouteComponent } from './vanilla-router';

const componentInputs =
  new WeakMap<
    Type<unknown>,
    readonly {
      readonly templateName: string;
      readonly propName: string;
    }[]
  >();

export interface InputBindingTarget {
  setInput(name: string, value: unknown): void;
}

export type RouteComponentRenderer = (
  component: Type<unknown>,
  injector: EnvironmentInjector,
  routeProviders?: NavigationProviders,
) => RouteComponent;

export interface RouteAdapterContext {
  readonly injector: EnvironmentInjector;
  readonly render: RouteComponentRenderer;
}

export function adaptRouteComponent(
  component: Type<unknown>,
  context: RouteAdapterContext,
  routeProviders?: NavigationProviders,
): RouteComponent {
  return context.render(component, context.injector, routeProviders);
}

export function bindRouteInputs(
  target: InputBindingTarget,
  component: Type<unknown>,
  route: ActivatedRoute,
): void {
  let inputs =
    componentInputs.get(component);

  if (!inputs) {
    inputs =
      reflectComponentType(component)
        ?.inputs ?? [];

    componentInputs.set(
      component,
      inputs,
    );
  }

  const data = route.data ?? {};
  // Parsed route inputs stay grouped by their source so component bindings are
  // explicit and collision-free.
  const values: Record<string, unknown> = {
    url: route.url,
    path: route.path,
    params: {
      ...route.params,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(((data as any)?.__params ?? {}) as Record<string, unknown>),
    },
    query: {
      ...route.query,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(((data as any)?.__query ?? {}) as Record<string, unknown>),
    },
    data: Object.fromEntries(
      Object.entries(data).filter(
        ([key]) =>
          key !== '__params' &&
          key !== '__query',
      ),
    ),
    historyState: route.historyState,
    config: route.config,
  };

  for (const input of inputs) {
    const value =
      values[input.templateName] ??
      values[input.propName];

    if (value !== undefined) {
      target.setInput(input.templateName, value);
    }
  }
}
````

## File: src/lib/route-builders.ts
````typescript
import type { Type } from '@angular/core';

import type { ParamSchemaRecord, QuerySchemaRecord } from './query-schema';
import type {
  Lazy,
  FrameView,
  FrameHooks,
  LayoutDefinition,
  LayoutOptions,
  RedirectRouteDefinition,
  RenderableRoute,
  RouteOptions,
  NavigationTree,
  ViewDefinition,
} from './navigation-definitions';

function isFrame(
  value: unknown,
): value is FrameView {
  return typeof value === 'object'
    && value !== null
    && 'kind' in value
    && value.kind === 'frame';
}

function isEagerFrame(
  value: FrameView,
): value is FrameView & { readonly component: Type<unknown> } {
  return 'component' in value
    && value.component !== undefined;
}

type ViewRecord =
  ViewDefinition & {
    readonly frame?: FrameView;
  };

function createViewRecord(
  view: Type<unknown> | FrameView,
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
  view: Lazy<Type<unknown>> | FrameView,
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
  hooks: FrameHooks = {},
): FrameView {
  return {
    kind: 'frame',
    component,
    ...hooks,
  };
}

export function lazyFrame(
  loadComponent: Lazy<Type<unknown>>,
  hooks: FrameHooks = {},
): FrameView {
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
  options?: RouteOptions<
    TName,
    TParamsSchema,
    TQuerySchema
  >,
): RenderableRoute<
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
  component: FrameView,
  options?: RouteOptions<
    TName,
    TParamsSchema,
    TQuerySchema
  >,
): RenderableRoute<
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
  component: Type<unknown> | FrameView,
  options: RouteOptions<
    TName,
    TParamsSchema,
    TQuerySchema
  > = {},
): RenderableRoute<
  TPath,
  TName,
  TParamsSchema,
  TQuerySchema
> {
  const route: RenderableRoute<
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
  options?: RouteOptions<
    TName,
    TParamsSchema,
    TQuerySchema
  >,
): RenderableRoute<
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
  loadComponent: FrameView,
  options?: RouteOptions<
    TName,
    TParamsSchema,
    TQuerySchema
  >,
): RenderableRoute<
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
  loadComponent: Lazy<Type<unknown>> | FrameView,
  options: RouteOptions<
    TName,
    TParamsSchema,
    TQuerySchema
  > = {},
): RenderableRoute<
  TPath,
  TName,
  TParamsSchema,
  TQuerySchema
> {
  const route: RenderableRoute<
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
    RouteOptions<TName, undefined, undefined>,
    'redirectTo' | 'paramsSchema' | 'querySchema' | 'outlet'
  > = {},
): RedirectRouteDefinition<
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
  const TEntries extends NavigationTree,
>(
  path: TPath,
  component: Type<unknown>,
  entries: TEntries,
  options?: LayoutOptions,
): LayoutDefinition<
  TPath,
  TEntries
>;
export function layout<
  const TPath extends string,
  const TEntries extends NavigationTree,
>(
  path: TPath,
  component: FrameView,
  entries: TEntries,
  options?: LayoutOptions,
): LayoutDefinition<
  TPath,
  TEntries
>;
export function layout<
  const TPath extends string,
  const TEntries extends NavigationTree,
>(
  path: TPath,
  component: Type<unknown> | FrameView,
  entries: TEntries,
  options: LayoutOptions = {},
): LayoutDefinition<
  TPath,
  TEntries
> {
  const layout: LayoutDefinition<
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
  const TEntries extends NavigationTree,
>(
  path: TPath,
  loadComponent: Lazy<Type<unknown>>,
  entries: TEntries,
  options?: LayoutOptions,
): LayoutDefinition<
  TPath,
  TEntries
>;
export function lazyLayout<
  const TPath extends string,
  const TEntries extends NavigationTree,
>(
  path: TPath,
  loadComponent: FrameView,
  entries: TEntries,
  options?: LayoutOptions,
): LayoutDefinition<
  TPath,
  TEntries
>;
export function lazyLayout<
  const TPath extends string,
  const TEntries extends NavigationTree,
>(
  path: TPath,
  loadComponent: Lazy<Type<unknown>> | FrameView,
  entries: TEntries,
  options: LayoutOptions = {},
): LayoutDefinition<
  TPath,
  TEntries
> {
  const layout: LayoutDefinition<
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
````

## File: src/lib/route-compiler.ts
````typescript
import type {
  LayoutDefinition,
  RouteDefinition,
  NavigationTree,
} from './navigation-definitions';

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

export function joinRoutePath(
  parent: string,
  child: string,
): string {
  const parentSegments =
    parent
      .split('/')
      .filter(Boolean);

  const childSegments =
    child
      .split('/')
      .filter(Boolean);

  const joined = [
    ...parentSegments,
    ...childSegments,
  ].join('/');

  return joined
    ? `/${joined}`
    : '/';
}

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

    output.push({
      route: entry,
      path: joinRoutePath(
        parentPath,
        entry.path,
      ),
      redirectTo: compileRedirect(
        parentPath,
        entry.redirectTo,
      ),
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
      if (route.route.outlet) {
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
    } else if (!route.route.outlet) {
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

    if (group.primary.redirectTo && group.outlets.length > 0) {
      throw new Error(
        `A redirect route cannot have named outlets. Path: "${group.path}"`,
      );
    }

    const outletNames = new Set<string>();
    for (const outlet of group.outlets) {
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

      if (outlet.redirectTo) {
        throw new Error(
          `Named outlet routes cannot be redirects. Route path: "${group.path}", outlet: "${outletName}"`,
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

function normalizePattern(
  path: string,
): string {
  return path.replace(
    /:([A-Za-z_][A-Za-z0-9_]*)/g,
    ':',
  );
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
    const previous =
      literalPaths.get(path);

    if (previous && !previous.outlet && !route.outlet) {
      throw new Error(
        `Duplicate compiled route path "${path}".`,
      );
    }

    literalPaths.set(path, route);

    const pattern =
      normalizePattern(path);

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
````

## File: src/lib/route-renderer.ts
````typescript
import {
  ApplicationRef,
  EnvironmentInjector,
  Injector,
  Type,
  createComponent,
  createEnvironmentInjector,
} from '@angular/core';

import {
  bindRouteInputs,
} from './route-adapter';

import type {
  NavigationProviders,
} from './navigation-definitions';

import {
  OUTLET_ACTIVATE_EVENT,
  OUTLET_DEACTIVATE_EVENT,
  dispatchOutletLifecycleEvent,
  findContainingOutlet,
  findOutlet,
} from './router-events';

import type {
  ActivatedRoute,
  RenderedRouteNode,
  RouteComponent,
  RouteRenderContext,
} from './vanilla-router';

export interface RouteRenderTokens {
  readonly routeToken: unknown;
  readonly contextToken: unknown;
}

export interface ResolvedRouteView {
  readonly component:
    Type<unknown>;
  readonly providers?:
    NavigationProviders;
  readonly label: string;
}

interface RenderedLayer {
  readonly rendered:
    RenderedRouteNode;
  readonly injector?:
    EnvironmentInjector;
}


function createScopedInjector(
  providers:
    NavigationProviders | undefined,
  parent: EnvironmentInjector,
  label: string,
): EnvironmentInjector | undefined {
  if (!providers?.length) {
    return undefined;
  }

  try {
    return createEnvironmentInjector(
      Array.from(providers),
      parent,
      label,
    );
  } catch (error) {
    throw new Error(
      `Failed to create route injector for "${label}": ` +
      (error instanceof Error ? error.message : String(error)),
      { cause: error },
    );
  }
}

function createAngularComponent(
  appRef: ApplicationRef,
  tokens: RouteRenderTokens,
  component: Type<unknown>,
  environmentInjector:
    EnvironmentInjector,
  route: ActivatedRoute,
  context: RouteRenderContext,
): RenderedRouteNode {
  const host =
    document.createElement(
      'streamix-view',
    );

  const elementInjector =
    Injector.create({
      parent:
        environmentInjector,
      providers: [
        {
          provide:
            tokens.routeToken,
          useValue: route,
        },
        {
          provide:
            tokens.contextToken,
          useValue: context,
        },
      ],
    });

  const ref =
    createComponent(
      component,
      {
        hostElement: host,
        elementInjector,
        environmentInjector,
      },
    );

  let attached = false;
  let disposed = false;
  let containingOutlet: HTMLElement | null = null;

  try {
    try {
      bindRouteInputs(
        ref,
        component,
        route,
      );
    } catch (error) {
      throw new Error(
        `Failed to bind route inputs for "${component.name || 'anonymous component'}": ` +
        (error instanceof Error ? error.message : String(error)),
        { cause: error },
      );
    }

    appRef.attachView(
      ref.hostView,
    );

    attached = true;

    ref.changeDetectorRef
      .detectChanges();
  } catch (error) {
    if (attached) {
      try {
        appRef.detachView(
          ref.hostView,
        );
      } catch {}
    }

    ref.destroy();
    throw error;
  }

  return {
    node: host,
    component: ref.instance,

    dispose(): void {
      if (disposed) {
        return;
      }

      disposed = true;

      containingOutlet ??=
        (host as Node & {
          __streamixOutlet?: HTMLElement;
        }).__streamixOutlet ?? null;

      const outlet =
        containingOutlet ??
        findContainingOutlet(host);

      if (outlet) {
        dispatchOutletLifecycleEvent(
          outlet,
          OUTLET_DEACTIVATE_EVENT,
          ref.instance,
        );
      }

      try {
        if (attached) {
          appRef.detachView(
            ref.hostView,
          );

          attached = false;
        }
      } finally {
        ref.destroy();
        host.remove();
      }
    },
  };
}

function disposeLayers(
  layers:
    readonly RenderedLayer[],
): void {
  const errors: unknown[] = [];

  for (
    let index =
      layers.length - 1;
    index >= 0;
    index--
  ) {
    const layer =
      layers[index];

    try {
      layer.rendered
        .dispose?.();
    } catch (error) {
      errors.push(error);
    }

    try {
      layer.injector
        ?.destroy();
    } catch (error) {
      errors.push(error);
    }
  }

  if (errors.length === 1) {
    throw errors[0];
  }

  if (errors.length > 1) {
    throw new AggregateError(
      errors,
      'Multiple errors occurred while disposing a route view.',
    );
  }
}

export function composeAngularRouteView(
  appRef: ApplicationRef,
  rootInjector:
    EnvironmentInjector,
  tokens: RouteRenderTokens,
  views:
    readonly ResolvedRouteView[],
): RouteComponent {
  return async (
    route,
    context,
  ) => {
    const layers:
      RenderedLayer[] = [];

    let parentInjector =
      rootInjector;

    try {
      for (
        let index = 0;
        index < views.length;
        index++
      ) {
        const view =
          views[index];

        const scopedInjector =
          createScopedInjector(
            view.providers,
            parentInjector,
            view.label,
          );

        const activeInjector =
          scopedInjector ??
          parentInjector;

        const rendered =
          createAngularComponent(
            appRef,
            tokens,
            view.component,
            activeInjector,
            route,
            context,
          );

        const parent =
          layers[
            layers.length - 1
          ];

        if (parent) {
          // The route outlet selects the application-level render target.
          // Layout layers always compose through their primary child outlet.
          const outletName = '';
          const outlet = findOutlet(parent.rendered.node, outletName);

          if (!outlet) {
            throw new Error(
              `Cannot render "${view.label}": ` +
              `the parent layout has no router outlet` +
              (outletName ? ` named "${outletName}"` : ` (primary)`),
            );
          }

          outlet.replaceChildren(
            rendered.node,
          );

          // Capture the outlet while the node is attached. Parent-layer
          // disposal may detach this host before its own dispose() runs.
          const renderedNode =
            rendered.node as Node & {
              __streamixOutlet?: HTMLElement;
            };
          renderedNode.__streamixOutlet = outlet;

          if (
            rendered.component !==
            undefined
          ) {
            dispatchOutletLifecycleEvent(
              outlet,
              OUTLET_ACTIVATE_EVENT,
              rendered.component,
            );
          }
        }

        layers.push({
          rendered,
          injector:
            scopedInjector,
        });

        parentInjector =
          activeInjector;
      }

      const first =
        layers[0];

      const last =
        layers[
          layers.length - 1
        ];

      if (!first || !last) {
        throw new Error(
          'A route view requires at least one component.',
        );
      }

      return {
        node:
          first.rendered.node,
        component:
          last.rendered.component,

        dispose(): void {
          disposeLayers(layers);
        },
      };
    } catch (error) {
      disposeLayers(layers);
      throw error;
    }
  };
}

export function composeAngularLeafRouteView(
  appRef: ApplicationRef,
  rootInjector:
    EnvironmentInjector,
  tokens: RouteRenderTokens,
  views:
    readonly ResolvedRouteView[],
): RouteComponent {
  return async (
    route,
    context,
  ) => {
    const scopedInjectors:
      EnvironmentInjector[] = [];

    let parentInjector =
      rootInjector;

    try {
      for (const view of views) {
        const scopedInjector =
          createScopedInjector(
            view.providers,
            parentInjector,
            view.label,
          );

        if (scopedInjector) {
          scopedInjectors.push(
            scopedInjector,
          );
          parentInjector =
            scopedInjector;
        }
      }

      const leaf =
        views[
          views.length - 1
        ];

      if (!leaf) {
        throw new Error(
          'A route view requires at least one component.',
        );
      }

      const rendered =
        createAngularComponent(
          appRef,
          tokens,
          leaf.component,
          parentInjector,
          route,
          context,
        );

      return {
        node:
          rendered.node,
        component:
          rendered.component,

        dispose(): void {
          const errors: unknown[] = [];

          try {
            rendered.dispose?.();
          } catch (error) {
            errors.push(error);
          }

          for (
            let index =
              scopedInjectors.length - 1;
            index >= 0;
            index--
          ) {
            try {
              scopedInjectors[
                index
              ].destroy();
            } catch (error) {
              errors.push(error);
            }
          }

          if (errors.length === 1) {
            throw errors[0];
          }

          if (errors.length > 1) {
            throw new AggregateError(
              errors,
              'Multiple errors occurred while disposing a route view.',
            );
          }
        },
      };
    } catch (error) {
      for (
        let index =
          scopedInjectors.length - 1;
        index >= 0;
        index--
      ) {
        try {
          scopedInjectors[
            index
          ].destroy();
        } catch {}
      }

      throw error;
    }
  };
}
````

## File: src/lib/router-events.ts
````typescript
export const OUTLET_ACTIVATE_EVENT = 'vanilla-router-activate';
export const OUTLET_DEACTIVATE_EVENT = 'vanilla-router-deactivate';
export const ROUTER_LOCATION_CHANGE_EVENT = 'vanilla-router-locationchange';

const OUTLET_QUERY = 'router-outlet';

function isOutletElement(
  element: HTMLElement,
  targetName: string,
): boolean {
  const tagName = element.tagName.toLowerCase();
  if (
    tagName !== 'router-outlet'
  ) {
    return false;
  }

  return (element.getAttribute('name') ?? '') === targetName;
}

export function dispatchOutletLifecycleEvent(
  target: EventTarget,
  type: typeof OUTLET_ACTIVATE_EVENT | typeof OUTLET_DEACTIVATE_EVENT,
  component: unknown,
): void {
  target.dispatchEvent(new CustomEvent(type, { detail: component }));
}

export function dispatchRouterLocationChange(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(ROUTER_LOCATION_CHANGE_EVENT));
}

export function findOutlet(
  node: Node,
  name?: string | null,
): HTMLElement | null {
  if (!(node instanceof Element || node instanceof DocumentFragment)) {
    return null;
  }

  const targetName = name ?? '';

  if (
    node instanceof HTMLElement &&
    isOutletElement(node, targetName)
  ) {
    return node;
  }

  return (
    Array.from(
      node.querySelectorAll<HTMLElement>(OUTLET_QUERY),
    ).find(element =>
      isOutletElement(element, targetName),
    ) ?? null
  );
}

export function findContainingOutlet(
  node: Element,
): HTMLElement | null {
  return node.closest<HTMLElement>(OUTLET_QUERY);
}
````

## File: src/lib/router-link.ts
````typescript
import {
  DOCUMENT,
} from '@angular/common';

import {
  DestroyRef,
  Directive,
  ElementRef,
  HostBinding,
  HostListener,
  Input,
  OnChanges,
  inject,
} from '@angular/core';

import {
  getRouterLocation,
} from './router-url';

import {
  watchRouterLocation,
} from './adapter-utils';

import type {
  NavigationTarget,
  PathNavigationTarget,
} from './navigation-targets';

import { Router } from './router';

type RouterLinkCommands =
  readonly unknown[];

type RouterLinkInput =
  | NavigationTarget
  | RouterLinkCommands
  | null
  | undefined;

function buildPathFromCommands(
  commands: RouterLinkCommands,
): string {
  if (commands.length === 0) {
    return '';
  }

  let path = '';

  for (const command of commands) {
    if (command === null || command === undefined) {
      continue;
    }

    const segment =
      String(command).trim();

    if (!segment) {
      continue;
    }

    if (!path) {
      path = segment;
      continue;
    }

    path =
      `${path.replace(/\/+$/, '')}/${segment.replace(/^\/+/, '')}`;
  }

  return path;
}

function appendQueryParams(
  url: URL,
  queryParams:
    Readonly<Record<string, unknown>>,
): void {
  url.search = '';

  for (const [key, value] of Object.entries(queryParams)) {
    if (value === null || value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry === null || entry === undefined) {
          continue;
        }

        url.searchParams.append(key, String(entry));
      }

      continue;
    }

    url.searchParams.set(key, String(value));
  }
}

@Directive({
  selector: 'a[routerLink],area[routerLink]',
  standalone: true,
})
export class RouterLink implements OnChanges {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly element = inject(
    ElementRef<HTMLAnchorElement | HTMLAreaElement>,
  ).nativeElement;

  @Input() routerLink: RouterLinkInput;
  @Input() queryParams:
    Readonly<Record<string, unknown>> |
    null |
    undefined;
  @Input() fragment: string | null | undefined;
  @Input() state: unknown;
  @Input() replaceUrl = false;

  @HostBinding('attr.href')
  href: string | null = null;

  constructor() {
    watchRouterLocation(
      this.destroyRef,
      () => this.refreshHref(),
    );
  }

  ngOnChanges(): void {
    this.refreshHref();
  }

  @HostListener('click', ['$event'])
  handleClick(event: Event): void {
    if (!(event instanceof MouseEvent)) {
      return;
    }

    if (!this.href) {
      return;
    }

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    if (
      this.element.target &&
      this.element.target !== '_self'
    ) {
      return;
    }

    if (
      this.element.hasAttribute('download') ||
      this.element.rel
        .split(/\s+/)
        .includes('external')
    ) {
      return;
    }

    event.preventDefault();
    void this.router.navigate(
      this.href,
      {
        replace: this.replaceUrl,
        state: this.state,
      },
    );
  }

  private refreshHref(): void {
    const target =
      this.resolveTarget();

    if (!target) {
      this.href = null;
      return;
    }

    const href =
      this.router.href(target);

    if (!href) {
      this.href = null;
      return;
    }

    if (
      !this.queryParams &&
      this.fragment === undefined
    ) {
      this.href = href;
      return;
    }

    const url =
      new URL(
        href,
        getRouterLocation(this.document).origin,
      );

    if (this.queryParams) {
      appendQueryParams(
        url,
        this.queryParams,
      );
    }

    if (this.fragment !== undefined) {
      url.hash = this.fragment
        ? `#${this.fragment.replace(/^#/, '')}`
        : '';
    }

    this.href =
      `${url.pathname}${url.search}${url.hash}`;
  }

  private resolveTarget():
    NavigationTarget | null {
    const link =
      this.routerLink;

    if (link === null || link === undefined) {
      return null;
    }

    if (Array.isArray(link)) {
      return this.withQueryParams({
        path: buildPathFromCommands(link),
      });
    }

    if (
      typeof link === 'string' ||
      link instanceof URL
    ) {
      return this.withQueryParams(
        link,
      );
    }

    if ('name' in link) {
      return {
        ...link,
        query:
          this.queryParams
            ? {
                ...(link.query ?? {}),
                ...this.queryParams,
              }
            : link.query,
      };
    }

    return this.withQueryParams(
      link as PathNavigationTarget,
    );
  }

  private withQueryParams(
    target:
      string |
      URL |
      PathNavigationTarget,
  ): NavigationTarget {
    if (!this.queryParams) {
      return target;
    }

    const href =
      typeof target === 'string'
        ? target
        : target instanceof URL
          ? target.href
          : target.path;

    const url =
      new URL(
        href,
        getRouterLocation(this.document).href,
      );

    appendQueryParams(
      url,
      this.queryParams,
    );

    if (this.fragment !== undefined) {
      url.hash = this.fragment
        ? `#${this.fragment.replace(/^#/, '')}`
        : '';
    }

    return {
      path:
        `${url.pathname}${url.search}${url.hash}`,
    };
  }
}
````

## File: src/lib/router-outlet.ts
````typescript
import {
  DestroyRef,
  Directive,
  ElementRef,
  Input,
  OnInit,
  inject,
} from '@angular/core';

import { Router } from './router';

@Directive({ selector: 'router-outlet', standalone: true })
export class RouterOutlet implements OnInit {
  private readonly router = inject(Router);
  private readonly element = inject(ElementRef<HTMLElement>).nativeElement;
  private readonly destroyRef = inject(DestroyRef);
  private connectedName = '';

  @Input() name = '';

  ngOnInit(): void {
    this.connectedName = this.resolveName();

    if (!this.shouldConnect(this.connectedName)) {
      return;
    }

    this.router.connect(this.connectedName, this.element);
  }

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (!this.shouldConnect(this.connectedName)) {
        return;
      }

      this.router.disconnect(this.connectedName, this.element);
    });
  }

  private resolveName(): string {
    return (this.name || this.element.getAttribute('name') || '').trim();
  }

  private shouldConnect(name: string): boolean {
    return name !== '' || this.element.closest('streamix-view') === null;
  }
}
````

## File: src/lib/router-url.ts
````typescript
export type RouterUrlMode = 'navigate' | 'href';

const SERVER_LOCATION = {
  origin: 'http://localhost',
  pathname: '/',
  search: '',
  hash: '',
  href: 'http://localhost/',
} satisfies Pick<Location, 'origin' | 'pathname' | 'search' | 'hash' | 'href'>;

export function getRouterLocation(
  document: Pick<Document, 'location'> | null | undefined,
): Pick<Location, 'origin' | 'pathname' | 'search' | 'hash' | 'href'> {
  return document?.location ?? SERVER_LOCATION;
}

export function normalizePath(path: string): string {
  const normalized = `/${path}`.replace(/\/+/g, '/');
  return normalized.length > 1 && normalized.endsWith('/')
    ? normalized.slice(0, -1)
    : normalized;
}

export function normalizeBaseHref(value: string): string {
  return normalizePath(value.trim() || '/');
}

export function isPathInsideBase(pathname: string, baseHref: string): boolean {
  const base = normalizeBaseHref(baseHref);
  const path = normalizePath(pathname);
  return base === '/' || path === base || path.startsWith(`${base}/`);
}

export function stripBaseHref(pathname: string, baseHref: string): string {
  const base = normalizeBaseHref(baseHref);
  const path = normalizePath(pathname);
  if (base === '/' || !isPathInsideBase(path, base)) return path;
  return normalizePath(path.slice(base.length));
}

export function applyBaseHref(pathname: string, baseHref: string): string {
  const base = normalizeBaseHref(baseHref);
  const path = normalizePath(pathname);
  if (base === '/' || isPathInsideBase(path, base)) return path;
  return path === '/' ? base : normalizePath(`${base}/${path.slice(1)}`);
}

export function resolveRouterUrl(
  target: string | URL,
  baseHref: string,
  location: Pick<Location, 'origin' | 'pathname' | 'href'>,
  mode: RouterUrlMode,
): URL {
  if (target instanceof URL) return target;

  const value = String(target);
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) return new URL(value);
  if (value.startsWith('?') || value.startsWith('#')) {
    return new URL(value, location.href);
  }

  const base = normalizeBaseHref(baseHref);
  if (value.startsWith('/')) {
    const url = new URL(value, location.origin);
    if (mode === 'href') url.pathname = applyBaseHref(url.pathname, base);
    return url;
  }

  const relativeBase = isPathInsideBase(location.pathname, base)
    ? location.href
    : `${location.origin}${base}/`;
  return new URL(value, relativeBase);
}

export function routerHref(url: URL): string {
  return `${url.pathname}${url.search}${url.hash}`;
}
````

## File: src/lib/router.ts
````typescript
import {
  APP_BASE_HREF,
  DOCUMENT,
} from '@angular/common';

import {
  ApplicationRef,
  DestroyRef,
  EnvironmentInjector,
  InjectionToken,
  inject,
  runInInjectionContext,
  type Provider,
  type Type,
} from '@angular/core';

import {
  runWithInjector,
  unwrapDefault,
} from './adapter-utils';

import type {
  NamedNavigationTarget,
  NavigationTarget,
} from './navigation-targets';

import {
  CompiledRoute,
  CompiledRouteGroup,
  compileRoutes,
  createRouteRegistry,
  groupRoutes,
} from './route-compiler';

import {
  composeAngularLeafRouteView,
  composeAngularRouteView,
  type ResolvedRouteView,
} from './route-renderer';

import type {
  FramePrepareFn,
  MaybePromise,
  FrameView,
  LayoutDefinition,
  LayoutOptions,
  RenderableRoute,
  RouteDefinition,
  RouteOptions,
  NavigationTree
} from './navigation-definitions';

import type {
  TypedHref,
  TypedNavigate,
} from './typed-navigation';

import {
  OUTLET_ACTIVATE_EVENT,
  dispatchOutletLifecycleEvent,
} from './router-events';

import {
  getRouterLocation,
  resolveRouterUrl,
  routerHref,
} from './router-url';

import {
  parseParamsRecord,
  parseQueryRecord,
  serializeParams,
  serializeQuery,
  type InferParamType,
  type ParamSchemaRecord
} from './query-schema';

import {
  LoadedRoute,
  type CanActivateFn,
  type CanDeactivateFn,
  createRouter,
  type ActivatedRoute,
  type NavigationTransitionFn,
  type NavigationContext,
  type NavigationOptions,
  type NavigationTransitionDefinition,
  type PrepareRouteDataFn,
  type PreloadingStrategy,
  type Route,
  type RouteRenderContext,
  type Router as VanillaRouter,
  type RouterState,
  type ScrollRestorationMode,
  type ViewTransitionsOption,
} from './vanilla-router';

export interface RouterOptions {
  readonly baseHref?: string;
  readonly enableTracing?: boolean;
  readonly maxRedirects?: number;
  readonly onSameUrlNavigation?:
    'ignore';
  readonly scrollRestoration?:
    ScrollRestorationMode;
  readonly preloading?:
    PreloadingStrategy;
  readonly viewTransitions?:
    ViewTransitionsOption;
}

export const ROUTE =
  new InjectionToken<ActivatedRoute>(
    'ROUTE',
  );

export const ROUTE_CONTEXT =
  new InjectionToken<RouteRenderContext>(
    'ROUTE_CONTEXT',
  );

interface RouterConfiguration<
  TRoutes extends NavigationTree =
    NavigationTree,
> extends RouterOptions {
  readonly routes: TRoutes;
}

const ROUTER_CONFIGURATION =
  new InjectionToken<
    RouterConfiguration
  >(
    'ROUTER_CONFIGURATION',
  );

const EMPTY_ROUTER_STATE:
  RouterState = Object.freeze({
    current: null,
    pending: false,
    phase: null,
    error: null,
    path: '',
    params: Object.freeze({}),
    query: Object.freeze({}),
    data: Object.freeze({}),
    historyState: null,
    routeConfig: null,
  });

const lazyComponents =
  new WeakMap<
    object,
    Promise<Type<unknown>>
  >();

function loadComponent(
  owner: LayoutDefinition | RenderableRoute,
): Promise<Type<unknown>> {
  if (owner.component) {
    return Promise.resolve(
      owner.component,
    );
  }

  if (!owner.loadComponent) {
    return Promise.reject(
      new Error(
        'A route view must define component or loadComponent.',
      ),
    );
  }

  let pending =
    lazyComponents.get(owner);

  if (!pending) {
    pending =
      Promise.resolve(
        owner.loadComponent(),
      )
        .then(value =>
          unwrapDefault<Type<unknown>>(
            value as
              | Type<unknown>
              | { readonly default: Type<unknown> },
          ),
        )
        .then(component => {
          if (!component) {
            throw new Error(
              'Lazy component loader returned no component.',
            );
          }

          return component;
        })
        .catch(error => {
          lazyComponents.delete(
            owner,
          );

          throw error;
        });

    lazyComponents.set(
      owner,
      pending,
    );
  }

  return pending;
}

function snapshotRouterState(state: RouterState): RouterState {
  return Object.freeze({
    current: state.current ?? null,
    pending: state.pending ?? false,
    phase: state.phase ?? null,
    error: state.error ?? null,
    path: state.path ?? '',
    params: state.params ? Object.freeze({ ...state.params }) : Object.freeze({}),
    query: state.query ? Object.freeze({ ...state.query }) : Object.freeze({}),
    data: state.data ? Object.freeze({ ...state.data }) : Object.freeze({}),
    historyState: state.historyState ?? null,
    routeConfig: state.routeConfig ?? null,
  });
}

function execute<
  TContext,
  TResult,
>(
  injector:
    EnvironmentInjector,
  handler: (
    context: TContext,
  ) => MaybePromise<TResult>,
  context: TContext,
): Promise<TResult> {
  return runWithInjector(
    injector,
    handler,
    context,
  );
}

function adaptCanActivate(
  handlers:
    readonly CanActivateFn[] |
    undefined,
  injector:
    EnvironmentInjector,
): Route['canActivate'] {
  return handlers?.map(
    handler =>
      async context => {
        const value =
          await execute(
            injector,
            handler,
            context,
          );

        if (value instanceof URL) {
          return value.href;
        }

        if (
          value &&
          typeof value ===
            'object' &&
          'redirectTo' in value
        ) {
          const rawRedirect =
            value.redirectTo as any;
          const redirectTo =
            rawRedirect instanceof URL
              ? rawRedirect.href
              : String(rawRedirect);

          return {
            ...value,
            redirectTo,
          };
        }

        return value as
          | boolean
          | string;
      },
  );
}

function adaptCanDeactivate(
  handlers:
    readonly CanDeactivateFn[] |
    undefined,
  injector:
    EnvironmentInjector,
): Route['canDeactivate'] {
  return handlers?.map(
    handler =>
      async context => {
        const value =
          await execute(
            injector,
            handler,
            context,
          );

        if (value instanceof URL) {
          return value.href;
        }

        if (
          value &&
          typeof value ===
            'object' &&
          'redirectTo' in value
        ) {
          const rawRedirect =
            value.redirectTo as any;
          const redirectTo =
            rawRedirect instanceof URL
              ? rawRedirect.href
              : String(rawRedirect);

          return {
            ...value,
            redirectTo,
          };
        }

        return value as
          | boolean
          | string;
      },
  );
}

function adaptFrameBeforeEnter(
  handler: CanActivateFn,
  injector: EnvironmentInjector,
): NavigationTransitionFn {
  return transition =>
    execute(
      injector,
      handler,
      {
        ...transition.to,
        signal: transition.signal,
      },
    );
}

function adaptFrameBeforeLeave(
  handler: CanDeactivateFn,
  injector: EnvironmentInjector,
): NavigationTransitionFn {
  return transition => {
    if (!transition.from) {
      return true;
    }

    return execute(
      injector,
      handler,
      {
        ...transition.from,
        nextUrl: transition.to.url,
        signal: transition.signal,
      },
    );
  };
}

function adaptFramePrepare(
  handler: FramePrepareFn,
  injector: EnvironmentInjector,
): PrepareRouteDataFn {
  return route =>
    execute(
      injector,
      handler,
      route,
    );
}

function adaptFrameAfterEnter(
  handler: (
    route: ActivatedRoute,
  ) => MaybePromise<void>,
  injector: EnvironmentInjector,
): NavigationTransitionFn {
  return transition =>
    execute(
      injector,
      handler,
      transition.to,
    );
}

function collectEnterFrames(
  layouts: readonly LayoutDefinition[],
  route: RenderableRoute,
): readonly FrameView[] {
  return Object.freeze([
    ...layouts
      .map(layout => layout.frame)
      .filter((frame): frame is FrameView => !!frame),
    ...(route.frame ? [route.frame] : []),
  ]);
}

function collectLeaveFrames(
  layouts: readonly LayoutDefinition[],
  route: RenderableRoute,
): readonly FrameView[] {
  const routeFrames = route.frame
    ? [route.frame]
    : [];
  const layoutFrames =
    layouts
      .map(layout => layout.frame)
      .filter((frame): frame is FrameView => !!frame)
      .reverse();

  return Object.freeze([
    ...routeFrames,
    ...layoutFrames,
  ]);
}

function adaptFramePreparers(
  frames: readonly FrameView[],
  injector: EnvironmentInjector,
): readonly PrepareRouteDataFn[] | undefined {
  const handlers =
    frames.flatMap(frame =>
      frame.prepare?.map(handler =>
        adaptFramePrepare(handler, injector),
      ) ?? [],
    );

  return handlers.length > 0
    ? Object.freeze(handlers)
    : undefined;
}

function adaptFrameTransitions(
  groups: readonly CompiledRouteGroup[],
  injector: EnvironmentInjector,
): readonly NavigationTransitionDefinition[] {
  const transitions: NavigationTransitionDefinition[] = [];

  for (const group of groups) {
    const primaryRoute =
      group.primary.route;

    if (primaryRoute.redirectTo) {
      continue;
    }

    const renderableRoute =
      primaryRoute as RenderableRoute;
    const enterFrames =
      collectEnterFrames(
        group.layouts,
        renderableRoute,
      );
    const leaveFrames =
      collectLeaveFrames(
        group.layouts,
        renderableRoute,
      );

    for (const current of enterFrames) {
      if (
        !current.beforeEnter?.length &&
        !current.afterEnter?.length
      ) {
        continue;
      }

      transitions.push({
        to: route =>
          route?.config.sourceRoute === primaryRoute,
        beforeEnter: current.beforeEnter?.map(handler =>
          adaptFrameBeforeEnter(handler, injector),
        ),
        afterEnter: current.afterEnter?.map(handler =>
          adaptFrameAfterEnter(handler, injector),
        ),
      });
    }

    for (const current of leaveFrames) {
      if (!current.beforeLeave?.length) {
        continue;
      }

      transitions.push({
        from: route =>
          route?.config.sourceRoute === primaryRoute,
        beforeLeave: current.beforeLeave.map(handler =>
          adaptFrameBeforeLeave(handler, injector),
        ),
      });
    }
  }

  return transitions;
}

function adaptParamsParser(
  route: RouteDefinition,
  injector: EnvironmentInjector,
): LoadedRoute['parseParams'] {
  const schema = route.paramsSchema;
  if (!schema) return undefined;

  return (params, _url, _signal) =>
    runInInjectionContext(
      injector,
      () => Promise.resolve(parseParamsRecord(schema, params)),
    );
}

function adaptQueryParser(
  route: RouteDefinition,
  injector: EnvironmentInjector,
): LoadedRoute['parseQuery'] {
  const schema = route.querySchema;
  if (!schema) return undefined;

  return (url, _signal) =>
    runInInjectionContext(
      injector,
      () => Promise.resolve(parseQueryRecord(schema, url)),
    );
}

async function resolveViews(
  layouts: readonly LayoutDefinition[],
  route: RenderableRoute,
): Promise<readonly ResolvedRouteView[]> {
  const resolvedLayouts = await Promise.all(
    layouts.map(async (layout, index) => ({
      component: await loadComponent(layout),
      providers: (layout.providers ?? []).flat().filter(p => p),
      label: `LayoutDefinition(${layout.path || index})`,
    })),
  );

  const page = await loadComponent(route);

  return Object.freeze([
    ...resolvedLayouts,
    {
      component: page,
      providers: (route.providers ?? []).flat().filter(p => p),
      label: `RouteDefinition(${route.path})`,
    },
  ]);
}

function adaptRoute(
  route: RouteDefinition,
  path: string,
  redirectTo: string | undefined,
  layouts: readonly LayoutDefinition[],
  sharedPreparers: readonly PrepareRouteDataFn[] | undefined,
  appRef: ApplicationRef,
  injector: EnvironmentInjector,
): Route {
  const tokens = {
    routeToken: ROUTE,
    contextToken: ROUTE_CONTEXT,
  } as const;
  const renderableRoute =
    redirectTo
      ? null
      : route as RenderableRoute;

  return {
    name: route.name,
    path,
    outlet: route.outlet,
    sourceRoute: route,
    redirectTo,
    data: route.data,
    preload: route.preload,
    viewTransition: route.viewTransition,

    load: async () => {
      if (redirectTo) {
        return {};
      }

      const views = await resolveViews(
        layouts,
        renderableRoute!,
      );

      return {
        component:
          route.outlet
            ? composeAngularLeafRouteView(
                appRef,
                injector,
                tokens,
                views,
              )
            : composeAngularRouteView(
                appRef,
                injector,
                tokens,
                views,
              ),
        canActivate: adaptCanActivate(route.canActivate, injector),
        canDeactivate: adaptCanDeactivate(route.canDeactivate, injector),
        prepare: [
          ...(sharedPreparers ?? []),
          ...(adaptFramePreparers(
            renderableRoute?.frame
              ? [renderableRoute.frame]
              : [],
            injector,
          ) ?? []),
        ],
        parseParams: adaptParamsParser(route, injector),
        parseQuery: adaptQueryParser(route, injector),
      };
    },
  };
}

function adaptRoutes(
  entries: NavigationTree,
  appRef: ApplicationRef,
  injector: EnvironmentInjector,
): Route[] {
  const compiled = compileRoutes(entries);
  const groups = groupRoutes(compiled);
  // validateRouteGroups(groups); // This is now done inside createRouteRegistry

  return groups.map((group: CompiledRouteGroup) => {
      const sharedPreparers =
        adaptFramePreparers(
          group.layouts
            .map(layout => layout.frame)
            .filter((frame): frame is FrameView => !!frame),
          injector,
        );

      const primary = adaptRoute(
        group.primary.route,
        group.path,
        group.primary.redirectTo,
        group.layouts,
        sharedPreparers,
        appRef,
        injector,
      );
  
      const outlets = group.outlets.map((compiled: CompiledRoute) =>
        adaptRoute(
          compiled.route,
          group.path,
          compiled.redirectTo,
          group.layouts,
          sharedPreparers,
          appRef,
          injector,
        ),
      );
  
      return outlets.length > 0
        ? { ...primary, outlets: Object.freeze(outlets) }
        : primary;
    });
}

function interpolateNamedPath(
  template: string,
  params:
    Readonly<
      Record<
        string,
        unknown
      >
    >,
  schema:
    RouteDefinition[
      'paramsSchema'
    ],
): string | null {
  const serialized =
    schema
      ? serializeParams(
          schema,
          params as unknown as InferParamType<ParamSchemaRecord>,
        )
      : Object.fromEntries(
          Object.entries(params)
            .filter(
              ([, value]) =>
                value !==
                  undefined &&
                value !== null,
            )
            .map(
              ([key, value]) => [
                key,
                String(value),
              ],
            ),
        );

  const missing =
    new Set<string>();

  const path =
    template.replace(
      /:([A-Za-z_][A-Za-z0-9_]*)/g,
      (
        _match,
        key: string,
      ) => {
        const value =
          serialized[key];

        if (
          value === undefined
        ) {
          missing.add(key);
          return `:${key}`;
        }

        return encodeURIComponent(
          value,
        );
      },
    );

  if (missing.size > 0) {
    return null;
  }

  return path;
}

export class Router<
  TRoutes extends NavigationTree =
    any,
> {
  private readonly appRef: ApplicationRef;
  private readonly injector: EnvironmentInjector;
  private readonly destroyRef: DestroyRef;
  private readonly document: Document;
  private readonly appBaseHref: string;
  private readonly registry: ReturnType<typeof createRouteRegistry>;
  private engine: VanillaRouter | null = null;
  private currentState: RouterState = EMPTY_ROUTER_STATE;
  private readonly outlets = new Map<string, HTMLElement[]>();
  private tickQueued = false;

  public readonly navigateTo: TypedNavigate<TRoutes>;
  public readonly hrefTo: TypedHref<TRoutes>;

  constructor(
    private readonly configuration: RouterConfiguration<TRoutes>,
  ) {
    this.appRef = inject(ApplicationRef);
    this.injector = inject(EnvironmentInjector);
    this.destroyRef = inject(DestroyRef);
    this.document = inject(DOCUMENT);
    this.appBaseHref =
    inject(
      APP_BASE_HREF,
      {
        optional: true,
      },
    ) ?? '/';

    this.registry = createRouteRegistry(this.configuration.routes);
    this.navigateTo =
      this.createNavigateProxy();

    this.hrefTo =
      this.createHrefProxy();

    this.destroyRef.onDestroy(
      () => this.dispose(),
    );
  }

  get active(): boolean {
    return this.engine !== null;
  }

  get state(): RouterState {
    return this.currentState;
  }

  get url(): string {
    const current =
      this.currentState.current;

    return current
      ? current.url.pathname +
          current.url.search +
          current.url.hash
      : '';
  }

  connect(
    name: string,
    outlet: HTMLElement,
  ): void {
    const outletName =
      name.trim();

    const registered =
      this.outlets.get(
        outletName,
      ) ?? [];

    if (registered.includes(outlet)) {
      return;
    }

    registered.push(
      outlet,
    );

    this.outlets.set(
      outletName,
      registered,
    );

    if (this.engine) {
      return;
    }

    const engine =
      createRouter({
        routes:
          adaptRoutes(
            this.configuration.routes,
            this.appRef,
            this.injector,
          ),

        baseHref:
          this.baseHref,

        enableTracing:
          this.configuration
            .enableTracing,

        maxRedirects:
          this.configuration
            .maxRedirects,

        onSameUrlNavigation:
          this.configuration
            .onSameUrlNavigation,

        scrollRestoration:
          this.configuration
            .scrollRestoration,

        preloading:
          this.configuration
            .preloading,

        transitions:
          [
            ...adaptFrameTransitions(
              this.registry.groups,
              this.injector,
            ),
          ],

        viewTransitions:
          this.configuration
            .viewTransitions,

        render: (
          targetName,
          node,
        ) => {
          const target =
            this.getOutlet(
              targetName,
            );

          if (!target) {
            throw new Error(
              `Router outlet "${targetName}" is not connected.`,
            );
          }

          target.replaceChildren(
            node,
          );
        },

      commit: (outlets) => {
        // First phase: validate all outlets exist before any DOM mutation.
        for (const outlet of outlets) {
          if (!this.outlets.has(outlet.name)) {
            throw new Error(`Router outlet "${outlet.name}" is not connected.`);
          }
        }

        // Second phase: perform synchronous DOM mutations.
        for (const outlet of outlets) {
          const target = this.getOutlet(outlet.name);

          if (!target) {
            throw new Error(`Router outlet "${outlet.name}" is not connected.`);
          }

          target.replaceChildren(outlet.node);
          dispatchOutletLifecycleEvent(
            target,
            OUTLET_ACTIVATE_EVENT,
            outlet.component,
          );
        }
      },

        renderNotFound: (
          targetName,
          _url,
          _router,
        ) => {
          const target =
            this.getOutlet(
              targetName,
            );

          if (!target) {
            return;
          }

          const heading =
            this.document.createElement(
              'h1',
            );

          heading.textContent =
            '404 вЂ” Page Not Found';

          target.replaceChildren(
            heading,
          );
        },

        renderError: (
          targetName,
          _error,
          _router,
        ) => {
          const target =
            this.getOutlet(
              targetName,
            );

          if (!target) {
            return;
          }

          const heading =
            this.document.createElement(
              'h1',
            );

          heading.textContent =
            'Page failed to load';

          target.replaceChildren(
            heading,
          );
        },

        onStateChange:
          state => {
            this.currentState =
              snapshotRouterState(
                state,
              );
            this.requestTick();
          },

        onOutletActivate:
          (
            target,
            component,
          ) => {
            dispatchOutletLifecycleEvent(
              target,
              OUTLET_ACTIVATE_EVENT,
              component,
            );
          },
      });

    try {
      engine.start();
    } catch (error) {
      this.outlets.delete(
        outletName,
      );
      engine.dispose();
      throw error;
    }

    this.engine = engine;

    this.currentState =
      snapshotRouterState(
        engine.state,
      );
    this.requestTick();
  }

  disconnect(
    name: string,
    outlet: HTMLElement,
  ): void {
    const outletName =
      name.trim();

    const registered =
      this.outlets.get(
        outletName,
      );

    if (!registered) {
      return;
    }

    const index =
      registered.lastIndexOf(
        outlet,
      );

    if (index < 0) {
      return;
    }

    registered.splice(
      index,
      1,
    );

    if (registered.length === 0) {
      this.outlets.delete(
        outletName,
      );
    }

    if (
      this.outlets.size === 0
    ) {
      this.dispose();
    }
  }

  navigate(
    target: NavigationTarget,
    options?:
      NavigationOptions,
  ): Promise<boolean> {
    const href =
      this.href(target);

    if (href === null) {
      return Promise.resolve(
        false,
      );
    }

    return this
      .requireEngine()
      .navigate(
        href,
        options,
      );
  }

  href(
    target:
      NavigationTarget |
      null |
      undefined,
  ): string | null {
    if (
      target === null ||
      target === undefined
    ) {
      return null;
    }

    if (
      typeof target ===
      'string' ||
      target instanceof URL
    ) {
      return this.resolveHref(
        target,
      );
    }

    if ('path' in target) {
      return this.resolveHref(
        target.path,
      );
    }

    if ('name' in target) {
      return this
        .generateNamedHref(
          target,
        );
    }

    return null;
  }

  updateHistoryState(
    state: unknown,
  ): void {
    this.requireEngine()
      .updateHistoryState(
        state,
      );
  }

  preload(): Promise<void> {
    return this
      .requireEngine()
      .preload();
  }

  dispose(): void {
    const engine =
      this.engine;

    this.engine = null;
    this.outlets.clear();

    engine?.dispose();

    this.currentState =
      EMPTY_ROUTER_STATE;
  }

  private get baseHref():
    string {
    return (
      this.configuration
        .baseHref ??
      this.appBaseHref
    );
  }

  private requireEngine():
    VanillaRouter {
    if (!this.engine) {
      throw new Error(
        'Router has no active outlet.',
      );
    }

    return this.engine;
  }

  private resolveHref(
    target: string | URL,
  ): string {
    return routerHref(
      resolveRouterUrl(
        target,
        this.baseHref,
        getRouterLocation(this.document),
        'href',
      ),
    );
  }

  private generateNamedHref(
    target:
      NamedNavigationTarget,
  ): string | null {
    const record =
      this.registry.namedRoutes
        .get(target.name);

    if (!record) {
      return null;
    }

    const path =
      interpolateNamedPath(
        record.fullPath,
        target.params ?? {},
        record.route
          .paramsSchema,
      );

    if (!path) {
      return null;
    }

    const query =
      record.route.querySchema &&
      target.query
        ? serializeQuery(
            record.route
              .querySchema,
            target.query,
          )
        : '';

    return this.resolveHref(
      `${path}${query}`,
    );
  }

  private createNavigateProxy():
    TypedNavigate<TRoutes> {
    return new Proxy(
      Object.create(null),
      {
        get: (
          _target,
          property,
        ) => {
          if (
            typeof property !==
              'string' ||
            property === 'then'
          ) {
            return undefined;
          }

          return (
            options:
              Record<
                string,
                unknown
              > = {},
          ) =>
            this.navigate({
              name: property,
              ...options,
            } as NamedNavigationTarget);
        },
      },
    ) as TypedNavigate<TRoutes>;
  }

  private createHrefProxy():
    TypedHref<TRoutes> {
    return new Proxy(
      Object.create(null),
      {
        get: (
          _target,
          property,
        ) => {
          if (
            typeof property !==
              'string' ||
            property === 'then'
          ) {
            return undefined;
          }

          return (
            options:
              Record<
                string,
                unknown
              > = {},
          ) =>
            this.href({
              name: property,
              ...options,
            } as NamedNavigationTarget);
        },
      },
    ) as TypedHref<TRoutes>;
  }

  private getOutlet(
    name: string,
  ): HTMLElement | null {
    const registered =
      this.outlets.get(
        name.trim(),
      );

    return registered?.[
      registered.length - 1
    ] ?? null;
  }

  private requestTick(): void {
    if (this.tickQueued) {
      return;
    }

    this.tickQueued = true;

    queueMicrotask(() => {
      this.tickQueued = false;

      if (!this.engine) {
        return;
      }

      this.appRef.tick();
    });
  }
}


export function provideRouter<
  const TRoutes extends
    NavigationTree,
>(
  routes: TRoutes,
  options:
    RouterOptions = {},
): Provider[] {  
  const config: RouterConfiguration<TRoutes> = {
    ...options,
    routes,
  };

  return [
    {
      provide: ROUTER_CONFIGURATION,
      useValue: config,
    },
    {
      provide: Router,
      useFactory: (
        configuration:
          RouterConfiguration<TRoutes>,
      ) =>
        new Router<TRoutes>(
          configuration,
        ),
      deps: [
        ROUTER_CONFIGURATION,
      ],
    },
  ];
}

export {
  type LayoutOptions,
  type RouteOptions
};

  export {
    layout,
    lazyLayout, lazyRoute,
    redirectRoute, route
  } from './route-builders';
````

## File: src/lib/typed-navigation.ts
````typescript
import type {
  InferParamType,
  InferQueryInputType,
  InferQueryType,
  ParamSchemaRecord,
  QuerySchemaRecord,
} from './query-schema';
import type {
  RouteDefinition, NavigationTree
} from './navigation-definitions';

/**
 * Extracts named parameter tokens from path string templates (e.g. "/users/:id")
 */
export type ExtractPathParams<T extends string> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? Param | ExtractPathParams<`/${Rest}`>
    : T extends `${string}:${infer Param}`
    ? Param
    : never;

/**
 * Recursively flattens all routes and layout entries into a union of leaf routes.
 */
export type LeafRouteDefinitions<TRoutes extends NavigationTree> =
  TRoutes[number] extends infer TEntry ? TEntry extends { kind: 'route' } ? TEntry : TEntry extends { kind: 'layout', entries: infer TEntries extends NavigationTree } ? LeafRouteDefinitions<TEntries> : never : never;

type RouteName<TRoute> = TRoute extends RouteDefinition<
  string,
  infer TName,
  ParamSchemaRecord | undefined,
  QuerySchemaRecord | undefined
>
  ? Extract<TName, string>
  : never;

/**
 * Extracts route names safely across layout entries without deep recursion.
 */
export type ExtractRouteNames<TRoutes extends NavigationTree> =
  RouteName<LeafRouteDefinitions<TRoutes>>;

/**
 * Infers route path parameter types from paramsSchema or path template tokens.
 */
export type InferRouteParams<TRoute> =
  TRoute extends RouteDefinition<
    infer TPath extends string,
    string | undefined,
    infer TParamsSchema,
    QuerySchemaRecord | undefined
  >
    ? [TParamsSchema] extends [ParamSchemaRecord]
      ? InferParamType<TParamsSchema>
      : [ExtractPathParams<TPath>] extends [never]
        ? Record<string, never>
        : Record<ExtractPathParams<TPath>, string | number>
    : Record<string, unknown>;

/**
 * Infers route query parameter types from querySchema or searchSchema.
 */
export type InferRouteQuery<TRoute> =
  TRoute extends RouteDefinition<
    string,
    string | undefined,
    ParamSchemaRecord | undefined,
    infer TQuerySchema
  >
    ? [TQuerySchema] extends [QuerySchemaRecord]
      ? InferQueryType<TQuerySchema>
      : Record<string, unknown>
    : Record<string, unknown>;

export type InferRouteQueryInput<TRoute> =
  TRoute extends RouteDefinition<
    string,
    string | undefined,
    ParamSchemaRecord | undefined,
    infer TQuerySchema
  >
    ? [TQuerySchema] extends [QuerySchemaRecord]
      ? InferQueryInputType<TQuerySchema>
      : Record<string, unknown>
    : Record<string, unknown>;

type HasRequiredParams<TRoute> =
  InferRouteParams<TRoute> extends infer TParams
    ? keyof TParams extends never
      ? false
      : TParams extends Record<string, never>
      ? false
      : true
    : false;

/**
 * Maps options (params, query, search, navigation state) for a target route name.
 */
export type RouteOptionsByName<
  TRoutes extends NavigationTree,
  TName extends string,
> = LeafRouteDefinitions<TRoutes> extends infer TRoute
  ? TRoute extends RouteDefinition<string, TName, any, any>
    ? HasRequiredParams<TRoute> extends true
      ? {
          readonly params: InferRouteParams<TRoute>;
          readonly query?: InferRouteQueryInput<TRoute>;
          readonly state?: unknown;
          readonly replace?: boolean;
        }
      : {
          readonly params?: InferRouteParams<TRoute>;
          readonly query?: InferRouteQueryInput<TRoute>;
          readonly state?: unknown;
          readonly replace?: boolean;
        }
    : never
  : never;

/**
 * Strongly-typed navigation proxy for Router.
 */
export type TypedNavigate<TRoutes extends NavigationTree> = {
  [K in ExtractRouteNames<TRoutes>]: (
    options?: RouteOptionsByName<TRoutes, K>,
  ) => Promise<boolean>;
};

/**
 * Strongly-typed href generator proxy for Router.
 */
export type TypedHref<TRoutes extends NavigationTree> = {
  [K in ExtractRouteNames<TRoutes>]: (
    options?: RouteOptionsByName<TRoutes, K>,
  ) => string | null;
};
````

## File: src/lib/vanilla-router.ts
````typescript
import { HistoryManager, ZERO_SCROLL, type HistoryEntry, type HistoryUpdate, type ScrollPosition } from './history';
import { dispatchRouterLocationChange } from './router-events';
import {
  isPathInsideBase,
  normalizeBaseHref,
  getRouterLocation,
  resolveRouterUrl,
  routerHref,
  stripBaseHref
} from './router-url';

type MaybePromise<T> = T | PromiseLike<T>;

type RawRouteParams = Readonly<Record<string, string>>;

export type RouteParams =
  Readonly<Record<string, unknown>>;

export type RouteQuery =
  Readonly<Record<string, unknown>>;

export type RouteData =
  Readonly<Record<string, unknown>>;

export interface ActivatedRoute {
  readonly url: URL;
  readonly path: string;
  /**
   * Parsed and validated path parameters.
   * Raw matcher captures remain internal to the router.
   */
  readonly params: RouteParams;

  /**
   * Parsed and validated search values.
   * Raw URLSearchParams remain available through `url.searchParams`.
   */
  readonly query: RouteQuery;

  readonly data: RouteData;
  readonly historyState: unknown;
  readonly config: Route;
}

export interface NavigationContext extends ActivatedRoute {
  readonly signal: AbortSignal;
}

export interface DeactivationContext extends ActivatedRoute {
  readonly nextUrl: URL;
  readonly signal: AbortSignal;
}

export interface RouteRenderContext {
  readonly signal: AbortSignal;
  readonly destroySignal: AbortSignal;
}

export interface RenderedRouteNode {
  readonly node: Node;
  readonly dispose?: () => void;
  readonly component?: unknown;
}

export type GuardResult =
  | boolean
  | string
  | { redirectTo: string; replace?: boolean };

export type CanActivateFn = (
  route: NavigationContext,
) => MaybePromise<GuardResult>;

export type CanDeactivateFn = (
  route: DeactivationContext,
) => MaybePromise<GuardResult>;

export type PrepareRouteDataResult =
  | void
  | RouteData;

export type PrepareRouteDataFn = (
  route: NavigationContext,
) => MaybePromise<PrepareRouteDataResult>;

export type RouteComponent = (
  route: ActivatedRoute,
  context: RouteRenderContext
) => MaybePromise<Node | RenderedRouteNode>;

export type ParseRouteParams = (
  params: RawRouteParams,
  url: URL,
  signal: AbortSignal,
) => MaybePromise<RouteParams>;

export type ParseRouteQuery = (
  url: URL,
  signal: AbortSignal,
) => MaybePromise<RouteQuery>;

export interface LoadedRoute {
  readonly component?: RouteComponent;
  readonly canActivate?: CanActivateFn[];
  readonly canDeactivate?: CanDeactivateFn[];
  readonly prepare?: readonly PrepareRouteDataFn[];
  readonly parseParams?: ParseRouteParams;
  readonly parseQuery?: ParseRouteQuery;
}

export interface Route {
  name?: string;
  path: string;
  outlet?: string;
  sourceRoute?: unknown;
  /** Same-path named outlets activated atomically with this primary route. */
  outlets?: readonly Route[];
  load?: () => MaybePromise<LoadedRoute>;
  redirectTo?: string;
  data?: Record<string, unknown>;
  preload?: boolean;
  viewTransition?: boolean;
  canActivate?: CanActivateFn[];
  canDeactivate?: CanDeactivateFn[];
  prepare?: readonly PrepareRouteDataFn[];
}

export interface NavigationTransition {
  readonly from: ActivatedRoute | null;
  readonly to: ActivatedRoute;
  readonly signal: AbortSignal;
}

export type NavigationTransitionFn = (
  transition: NavigationTransition,
) => MaybePromise<GuardResult | void>;

export interface NavigationTransitionDefinition {
  readonly from?: (
    route: ActivatedRoute | null,
  ) => boolean;
  readonly to?: (
    route: ActivatedRoute,
  ) => boolean;
  readonly beforeEnter?: readonly NavigationTransitionFn[];
  readonly prepare?: readonly NavigationTransitionFn[];
  readonly beforeLeave?: readonly NavigationTransitionFn[];
  readonly afterEnter?: readonly NavigationTransitionFn[];
}

export type NavigationPhase = 'recognizing' | 'guarding' | 'resolving' | 'loading' | null;

export interface NavigationOptions {
  replace?: boolean;
  state?: unknown;
}

export type ScrollRestorationMode = 'restore' | 'top' | 'preserve';
export type PreloadingStrategy = 'none' | 'eager' | 'idle';
export type ViewTransitionPhase = 'success' | 'not-found' | 'error';

export interface ViewTransitionContext {
  readonly url: URL;
  readonly from: ActivatedRoute | null;
  readonly to: ActivatedRoute | null;
  readonly phase: ViewTransitionPhase;
  readonly routeConfig: Route | null;
  readonly error?: unknown;
}

export type ViewTransitionsOption =
  | boolean
  | ((context: ViewTransitionContext) => boolean);

export interface RouterState {
  readonly current: ActivatedRoute | null;
  readonly pending: boolean;
  readonly phase: NavigationPhase;
  readonly error: unknown;
  readonly path: string;
  readonly params: RouteParams;
  readonly query: RouteQuery;
  readonly data: RouteData;
  readonly historyState: unknown;
  readonly routeConfig: Route | null;
}

export interface Router {
  readonly state: RouterState;
  start(): void;
  stop(): void;
  dispose(): void;
  navigate(target: string | URL, options?: NavigationOptions): Promise<boolean>;
  replace(target: string | URL, state?: unknown): Promise<boolean>;
  updateHistoryState(state: unknown): void;
  preload(): Promise<void>;
  back(): void;
  forward(): void;
  href(target: string): string;
  createLink(to: string, text: string, className?: string): HTMLAnchorElement;
}

export interface RouterConfig {
  routes: Route[];
  transitions?: readonly NavigationTransitionDefinition[];
  /**
   * Default DOM outlet used when no custom named-outlet renderer is supplied.
   */
  outlet?: HTMLElement | null;
  baseHref?: string;
  enableTracing?: boolean;
  maxRedirects?: number;
  onSameUrlNavigation?: 'ignore';
  scrollRestoration?: ScrollRestorationMode;
  preloading?: PreloadingStrategy;
  viewTransitions?: ViewTransitionsOption;
  navigateExternal?: (url: URL) => void;
  onOutletActivate?: (outlet: HTMLElement, component: unknown) => void;
  render?: (outletName: string, node: Node, route: ActivatedRoute) => void;
  renderNotFound?: (outletName: string, url: URL, router: Router) => void;
  commit?: (outlets: readonly PreparedOutlet[]) => void;
  renderError?: (outletName: string, error: unknown, router: Router) => void;
  onStateChange?: (state: RouterState) => void;
}

interface NavigationCompletion {
  settled: boolean;
  resolve(success: boolean): void;
}

interface NavigationRequest {
  readonly id: number;
  readonly url: URL;
  readonly redirectCount: number;
  readonly completion: NavigationCompletion;
  readonly historyUpdate: HistoryUpdate;
}

interface RouteMatch {
  readonly route: Route;
  readonly params: RawRouteParams;
}

interface RoutePattern {
  readonly path: string;
  readonly segments: readonly string[];
  readonly parameterNames: readonly (string | null)[];
}

export interface PreparedOutlet {
  readonly name: string;
  readonly route: ActiveRoute;
  readonly node: Node;
  readonly component?: unknown;
  readonly rendered: ActiveRender;
}

interface NavigationSuccess {
  type: 'success';
  request: NavigationRequest;
  route: ActiveRoute;
  outlets: readonly PreparedOutlet[];
}

interface NavigationRedirect {
  type: 'redirect';
  request: NavigationRequest;
  redirectTo: string;
  replace: boolean;
}

interface NavigationBlocked {
  type: 'blocked';
  request: NavigationRequest;
}

interface NavigationNotFound {
  type: 'not-found';
  request: NavigationRequest;
}

interface NavigationFailure {
  type: 'error';
  request: NavigationRequest;
  error: unknown;
  preserveActive?: boolean;
}

type NavigationResult =
  | NavigationSuccess
  | NavigationRedirect
  | NavigationBlocked
  | NavigationNotFound
  | NavigationFailure;

class RoutePreparationError extends Error {
  constructor(
    readonly originalError: unknown,
    readonly preserveActive: boolean,
  ) {
    super(
      originalError instanceof Error
        ? originalError.message
        : String(originalError),
      { cause: originalError },
    );
    this.name = 'RoutePreparationError';
  }
}

interface ActiveRoute extends ActivatedRoute {
}

interface ActiveRender {
  readonly controller: AbortController;
  readonly dispose: () => void;
}

const EMPTY_PARAMS: RouteParams =
  Object.freeze({});

const EMPTY_QUERY: RouteQuery =
  Object.freeze({});

const EMPTY_DATA: RouteData =
  Object.freeze({});

function splitPath(path: string): string[] {
  return path
    .split('/')
    .filter(Boolean);
}

function decodeSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isRenderedRouteNode(value: unknown): value is RenderedRouteNode {
  return value !== null && typeof value === 'object' && 'node' in value;
}

function normalizeRenderedRouteNode(value: Node | RenderedRouteNode): RenderedRouteNode {
  return isRenderedRouteNode(value) ? value : { node: value };
}

function readRawQuery(
  url: URL,
): RouteQuery {
  const values:
    Record<string, string> = {};

  url.searchParams.forEach(
    (value, key) => {
      values[key] = value;
    },
  );

  return Object.freeze(values);
}


function executeGuard(
  guard: CanActivateFn,
  route: NavigationContext,
): MaybePromise<GuardResult> {
  return guard(route);
}

function executeDeactivationGuard(
  guard: CanDeactivateFn,
  route: DeactivationContext
): MaybePromise<GuardResult> {
  return guard(route);
}

function executePrepareRouteData(
  prepare: PrepareRouteDataFn,
  route: NavigationContext,
): MaybePromise<PrepareRouteDataResult> {
  return prepare(route);
}

function normalizePreparedRouteData(
  value: PrepareRouteDataResult,
): RouteData {
  if (value === undefined) {
    return EMPTY_DATA;
  }

  if (
    typeof value !== 'object'
    || value === null
    || Array.isArray(value)
  ) {
    throw new Error(
      'Route prepare handlers must return an object or void.',
    );
  }

  return Object.freeze({ ...value });
}

function mergeRouteData(
  entries: readonly RouteData[],
): RouteData {
  if (entries.length === 0) {
    return EMPTY_DATA;
  }

  return Object.freeze(
    Object.assign(
      {},
      ...entries,
    ),
  );
}

function executeTransition(
  transition: NavigationTransitionFn,
  context: NavigationTransition,
): MaybePromise<GuardResult | void> {
  return transition(context);
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('Navigation aborted', 'AbortError');
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error
    && (error as { name?: string }).name === 'AbortError';
}

function interpolateRedirect(
  redirectTo: string,
  params: RawRouteParams,
): string {
  return redirectTo.replace(/:([A-Za-z0-9_]+)/g, (_, key: string) => {
    if (!(key in params)) {
      throw new Error(`Missing route parameter "${key}" for redirect "${redirectTo}"`);
    }
    return encodeURIComponent(params[key]);
  });
}

function readRedirect(result: GuardResult): { redirectTo: string; replace: boolean } | null {
  if (typeof result === 'string') return { redirectTo: result, replace: true };
  if (result && typeof result === 'object' && 'redirectTo' in result) {
    return { redirectTo: result.redirectTo, replace: result.replace ?? true };
  }
  return null;
}

function defaultRender(outlet: HTMLElement, node: Node): void {
  outlet.replaceChildren(node);
}


function validateRouteGroups(routes: readonly Route[]): void {
  const primaryPaths = new Set<string>();

  for (const primary of routes) {
    const primaryOutlet = primary.outlet?.trim() ?? '';
    if (primaryOutlet) {
      throw new Error(
        `Top-level route "${primary.path}" must target the primary outlet`,
      );
    }

    if (primaryPaths.has(primary.path)) {
      throw new Error(`Duplicate primary route path "${primary.path}"`);
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
        throw new Error(`Outlet "${name}" cannot contain nested outlets`);
      }
      if (outlet.redirectTo) {
        throw new Error(`Outlet "${name}" cannot redirect`);
      }
      if (outlet.name) {
        throw new Error(`Outlet "${name}" cannot define a route name`);
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

const routeLoads = new WeakMap<Route, Promise<LoadedRoute>>();

function loadRoute(
  route: Route,
): Promise<LoadedRoute> {
  let pending = routeLoads.get(route);

  if (!pending) {
    pending = Promise
      .resolve(
        route.load?.() ?? {},
      )
      .then(loaded => ({
        component: loaded.component,
        canActivate: loaded.canActivate,
        canDeactivate: loaded.canDeactivate,
        prepare: loaded.prepare ?? route.prepare,
        parseParams: loaded.parseParams,
        parseQuery: loaded.parseQuery,
      }))
      .catch(error => {
        routeLoads.delete(route);
        throw error;
      });

    routeLoads.set(route, pending);
  }

  return pending;
}

export function createRouter(config: RouterConfig): Router {
  validateRouteGroups(config.routes);
  const render = config.render;
  const renderNotFound = config.renderNotFound;
  const renderError = config.renderError;
  const commitOutlets = config.commit;
  const transitions = config.transitions ?? [];
  const browserWindow = typeof window === 'undefined' ? null : window;
  const browserDocument = typeof document === 'undefined' ? null : document;
  const routerLocation = () =>
    browserWindow?.location ?? getRouterLocation(browserDocument);
  const navigateExternal = config.navigateExternal ?? ((url: URL) => {
    browserWindow?.location.assign(url.href);
  });
  const baseHref = normalizeBaseHref(config.baseHref ?? '/');
  const maxRedirects = config.maxRedirects ?? 10;
  const scrollRestoration = config.scrollRestoration ?? 'preserve';
  const preloading = config.preloading ?? 'none';
  const viewTransitions = config.viewTransitions ?? false;
  const history =
    new HistoryManager(browserWindow, routerLocation());
  const routePatterns = new WeakMap<Route, RoutePattern>();

  let currentState: ActiveRoute | null = null;
  let requestState: NavigationRequest | null = null;
  let navigationPhase: NavigationPhase = null;
  let errorState: unknown = null;

  let started = false;
  let disposed = false;
  let navigationId = 0;
  let latestRequestId = 0;
  let activeController: AbortController | null = null;
  const activeRenders = new Map<string, ActiveRender>();
  const activeRouteStates = new Map<string, ActiveRoute>();
  let startRequestQueued = false;
  let preloadTask: Promise<void> | null = null;
  let preloadQueued = false;
  let preloadIdleId: number | null = null;
  let preloadTimeoutId: number | null = null;

  function trace(message: string, ...values: unknown[]): void {
    if (config.enableTracing) console.debug(`[Router] ${message}`, ...values);
  }

  function warn(message: string, ...values: unknown[]): void {
    console.warn(`[Router] ${message}`, ...values);
  }

  function resolveOutlet(): HTMLElement | null {
    return config.outlet ?? browserDocument?.getElementById('app') ?? null;
  }

  function matchesTransitionDefinition(
    definition: NavigationTransitionDefinition,
    from: ActivatedRoute | null,
    to: ActivatedRoute,
  ): boolean {
    return (definition.from?.(from) ?? true)
      && (definition.to?.(to) ?? true);
  }

  function collectTransitionPhase(
    phase: keyof Pick<
      NavigationTransitionDefinition,
      'beforeEnter' | 'prepare' | 'beforeLeave' | 'afterEnter'
    >,
    from: ActivatedRoute | null,
    to: ActivatedRoute,
  ): readonly NavigationTransitionFn[] {
    const handlers: NavigationTransitionFn[] = [];

    for (const definition of transitions) {
      if (!matchesTransitionDefinition(definition, from, to)) {
        continue;
      }

      handlers.push(...(definition[phase] ?? []));
    }

    return handlers;
  }

  async function runTransitionPhase(
    phase: keyof Pick<
      NavigationTransitionDefinition,
      'beforeEnter' | 'prepare' | 'beforeLeave'
    >,
    from: ActivatedRoute | null,
    to: ActivatedRoute,
    signal: AbortSignal,
  ): Promise<GuardResult> {
    const handlers = collectTransitionPhase(phase, from, to);

    for (const handler of handlers) {
      const result = await executeTransition(handler, {
        from,
        to,
        signal,
      });
      throwIfAborted(signal);

      if (result === undefined || result === true) {
        continue;
      }

      return result;
    }

    return true;
  }

  function runAfterEnterTransitions(
    from: ActivatedRoute | null,
    to: ActivatedRoute,
  ): void {
    const handlers = collectTransitionPhase('afterEnter', from, to);

    for (const handler of handlers) {
      void Promise.resolve(
        executeTransition(handler, {
          from,
          to,
          signal: new AbortController().signal,
        }),
      ).catch(error => trace('afterEnter transition failed', error));
    }
  }

  function createStatusRoute(url: URL): ActivatedRoute {
    return currentState ?? {
      url,
      path: stripBaseHref(url.pathname, baseHref),
      params: EMPTY_PARAMS,
      query: readRawQuery(url),
      data: EMPTY_DATA,
      historyState: browserWindow?.history.state ?? null,
      config: config.routes[0] ?? { path: '**' },
    };
  }

  function renderPrimaryNode(node: Node, route: ActivatedRoute): HTMLElement | null {
    if (render) {
      render('', node, route);
      return node.parentElement ?? resolveOutlet();
    }

    const outlet = resolveOutlet();
    if (outlet) {
      defaultRender(outlet, node);
    }
    return outlet;
  }

  function disposeRender(renderInstance: ActiveRender | null): void {
    if (!renderInstance) return;
    renderInstance.dispose();
  }

  function replaceActiveRender(
    outletName: string,
    renderInstance: ActiveRender | null,
  ): void {
    const previousRender =
      activeRenders.get(outletName) ?? null;

    if (renderInstance) {
      activeRenders.set(
        outletName,
        renderInstance,
      );
    } else {
      activeRenders.delete(
        outletName,
      );
    }

    disposeRender(previousRender);
  }

  function disposeAllRenders(): void {
    for (const renderInstance of activeRenders.values()) {
      disposeRender(renderInstance);
    }

    activeRenders.clear();
    activeRouteStates.clear();
  }  

  function clearOutlet(): void {
    const outlet = resolveOutlet();
    if (outlet) outlet.replaceChildren();
  }

  function currentHref(): string {
    const location = routerLocation();
    return location.pathname + location.search + location.hash;
  }

  function readScroll(): ScrollPosition {
    return {
      x: browserWindow?.scrollX ?? 0,
      y: browserWindow?.scrollY ?? 0,
    }
  }

  function scrollToPosition(position: ScrollPosition): void {
    browserWindow?.scrollTo(position.x, position.y);
  }

  function restoreScroll(update: HistoryUpdate): void {
    if (scrollRestoration === 'preserve') {
      return;
    }

    if (scrollRestoration === 'restore' && update.type === 'popstate') {
      scrollToPosition(update.nextEntry?.scroll ?? ZERO_SCROLL);
      return;
    }

    scrollToPosition(ZERO_SCROLL);
  }

  function restorePreviousScroll(update: HistoryUpdate): void {
    if (scrollRestoration === 'preserve') {
      return;
    }

    scrollToPosition(update.previousScroll);
  }

  function isInsideBase(pathname: string): boolean {
    return isPathInsideBase(pathname, baseHref);
  }

  function resolveAppUrl(target: string | URL, mode: 'navigate' | 'href'): URL {
    return resolveRouterUrl(target, baseHref, routerLocation(), mode);
  }

  function activeHref(): string | null {
    const url = currentState?.url;
    return url ? url.pathname + url.search + url.hash : null;
  }

  function restoreActiveUrl(): void {
    const active = activeHref();
    const fallback = history.createDefaultUpdate().previousEntry?.href ?? currentHref();
    const href =
      active ?? fallback;

    browserWindow?.history.replaceState(
        currentState?.historyState ??
          history.createDefaultUpdate().previousEntry?.state ?? null,
        '',
        href,
      );

    dispatchRouterLocationChange();
  }

  function applyHistoryStateToRoute(
    route: ActiveRoute,
    historyState: unknown,
  ): ActiveRoute {
    return { ...route, historyState };
  }

  function updateHistoryState(state: unknown): void {
    if (disposed) {
      throw new Error('Cannot update history state on a disposed router');
    }

    const entry = history.createDefaultUpdate().previousEntry ?? {
      href: currentHref(),
      scroll: readScroll(),
      state: null,
    };
    const nextEntry: HistoryEntry = {
      href: entry.href,
      scroll: readScroll(),
      state: state ?? null,
    };

    browserWindow?.history.replaceState(
        nextEntry.state,
        '',
        nextEntry.href,
      );
    history.commitUpdate({ ...history.createDefaultUpdate(), nextEntry }, nextEntry.href);
    dispatchRouterLocationChange();

    if (currentState) {
      currentState = applyHistoryStateToRoute(currentState, nextEntry.state);
      notifyStateChange();
    }
  }

  function shouldUseViewTransition(
    context: ViewTransitionContext,
  ): boolean {
    const routeOverride = context.routeConfig?.viewTransition;
    if (routeOverride !== undefined) return routeOverride;

    return typeof viewTransitions === 'function'
      ? viewTransitions(context)
      : viewTransitions;
  }

  function runWithViewTransition(
    context: ViewTransitionContext,
    action: () => void,
  ): void {
    if (!shouldUseViewTransition(context)) {
      action();
      return;
    }

    if (!browserDocument) {
      action();
      return;
    }

    const transitionDocument = browserDocument as Document & {
      startViewTransition?: (
        callback: () => void | PromiseLike<void>,
      ) => { finished: PromiseLike<unknown> };
    };
    const startViewTransition = transitionDocument.startViewTransition;

    if (typeof startViewTransition !== 'function') {
      action();
      return;
    }

    try {
      void Promise.resolve(
        startViewTransition.call(transitionDocument, () => action()).finished,
      ).catch(error => trace('View transition failed', error));
    } catch (error) {
      trace('View transition setup failed', error);
      action();
    }
  }

  function notifyOutletActivate(outlet: HTMLElement, component: unknown): void {
    config.onOutletActivate?.(outlet, component);
  }

  function createCompletion(): { completion: NavigationCompletion; promise: Promise<boolean> } {
    let resolve!: (success: boolean) => void;
    const promise = new Promise<boolean>(completion => {
      resolve = completion;
    });
    return { completion: { settled: false, resolve }, promise };
  }

  function settleRequest(request: NavigationRequest, success: boolean): void {
    if (request.completion.settled) return;
    request.completion.settled = true;
    request.completion.resolve(success);
  }

  function cancelActiveNavigation(): void {
    activeController?.abort();
    activeController = null;
    if (requestState) settleRequest(requestState, false);
  }

  function createRequest(
    url: URL,
    redirectCount: number,
    completion: NavigationCompletion | undefined,
    historyUpdate: HistoryUpdate,
    run: (request: NavigationRequest, signal: AbortSignal) => Promise<void>,
  ): Promise<boolean> {
    const pending = completion ? null : createCompletion();
    const request: NavigationRequest = {
      id: ++navigationId,
      url,
      redirectCount,
      completion: completion ?? pending!.completion,
      historyUpdate,
    };
    if (!completion) cancelActiveNavigation();
    latestRequestId = request.id;
    requestState = request;
    errorState = null;
    notifyStateChange();

    const controller = new AbortController();
    activeController = controller;
    void run(request, controller.signal);
    return pending?.promise ?? Promise.resolve(false);
  }

  function requestNavigation(
    url: URL,
    redirectCount = 0,
    completion?: NavigationCompletion,
    historyUpdate: HistoryUpdate = history.createDefaultUpdate(),
  ): Promise<boolean> {
    return createRequest(
      url,
      redirectCount,
      completion,
      historyUpdate,
      runNavigation,
    );
  }

  function requestExternalNavigation(
    url: URL,
    completion?: NavigationCompletion,
    historyUpdate: HistoryUpdate = history.createDefaultUpdate(),
  ): Promise<boolean> {
    return createRequest(
      url,
      0,
      completion,
      historyUpdate,
      runExternalNavigation,
    );
  }

  function notifyStateChange(): void {
    config.onStateChange?.(publicState);
  }

  function setPhase(
    request: NavigationRequest,
    phase: NavigationPhase,
  ): void {
    if (request.id !== latestRequestId) {
      return;
    }

    navigationPhase = phase;
    notifyStateChange();
  }

  function getRoutePattern(route: Route): RoutePattern {
    const cached = routePatterns.get(route);
    if (cached && cached.path === route.path) {
      return cached;
    }

    const segments = splitPath(route.path);
    const pattern: RoutePattern = {
      path: route.path,
      segments,
      parameterNames: segments.map(segment =>
        segment.startsWith(':')
          ? segment.slice(1)
          : null,
      ),
    };

    routePatterns.set(route, pattern);
    return pattern;
  }

  function matchPattern(
    pattern: RoutePattern,
    segments: readonly string[],
    params: Record<string, string>,
  ): boolean {
    for (let index = 0; index < pattern.segments.length; index++) {
      const expected = pattern.segments[index];
      const actual = segments[index];

      if (actual === undefined) {
        return false;
      }

      const parameterName = pattern.parameterNames[index];
      if (parameterName) {
        params[parameterName] = decodeSegment(actual);
        continue;
      }

      if (expected !== actual) {
        return false;
      }
    }

    return true;
  }

  function recognize(path: string): RouteMatch | null {
    const segments = splitPath(path);
    let fallback: Route | undefined;

    for (const route of config.routes) {
      if (route.path === '**' || route.path === '*') {
        fallback = route;
        continue;
      }

      const pattern = getRoutePattern(route);
      if (pattern.segments.length !== segments.length) {
        continue;
      }

      const params: Record<string, string> = {};
      if (matchPattern(pattern, segments, params)) {
        return {
          route,
          params: Object.freeze(params),
        };
      }
    }

    return fallback
      ? { route: fallback, params: Object.freeze({}) }
      : null;
  }

  async function runPreloading(): Promise<void> {
    if (disposed) {
      return;
    }

    for (const route of config.routes) {
      if (route.preload === false) {
        continue;
      }

      const group = [route, ...(route.outlets ?? [])];
      for (const member of group) {
        try {
          const loaded = await loadRoute(member);
          if (member !== route && (loaded.parseParams || loaded.parseQuery)) {
            throw new Error(
              `Outlet "${member.outlet}" cannot define parseParams or parseQuery`,
            );
          }
        } catch (error) {
          trace('Route preload failed', member.path, member.outlet ?? '', error);
        }
      }
    }
  }

  function preload(): Promise<void> {
    preloadQueued = false;
    preloadTask ??= runPreloading().finally(() => {
      preloadTask = null;
    });
    return preloadTask;
  }

  function cancelScheduledPreloading(): void {
    if (preloadIdleId !== null) {
      const cancelIdle = (browserWindow as (Window & {
        cancelIdleCallback?: (id: number) => void;
      }) | null)?.cancelIdleCallback;

      cancelIdle?.(preloadIdleId);
      preloadIdleId = null;
    }

    if (preloadTimeoutId !== null) {
      browserWindow?.clearTimeout(preloadTimeoutId);
      preloadTimeoutId = null;
    }

    preloadQueued = false;
  }

  function schedulePreloading(): void {
    if (
      disposed ||
      preloading === 'none' ||
      preloadTask ||
      preloadQueued
    ) {
      return;
    }

    preloadQueued = true;

    const run = () => {
      preloadIdleId = null;
      preloadTimeoutId = null;

      if (disposed || !started) {
        preloadQueued = false;
        return;
      }

      void preload();
    };

    if (preloading === 'eager') {
      queueMicrotask(run);
      return;
    }

    const requestIdle = (browserWindow as (Window & {
      requestIdleCallback?: (callback: () => void) => number;
    }) | null)?.requestIdleCallback;

    if (typeof requestIdle === 'function') {
      preloadIdleId = requestIdle(run);
      return;
    }

    preloadTimeoutId = browserWindow?.setTimeout(run, 0) ?? null;
  }

  async function runCanDeactivateGuards(
    nextUrl: URL,
    signal: AbortSignal,
  ): Promise<GuardResult> {
    const routes = activeRouteStates.size > 0
      ? [...activeRouteStates.values()]
      : currentState
        ? [currentState]
        : [];

    for (const activeRoute of routes) {
      const context: DeactivationContext = {
        ...activeRoute,
        nextUrl,
        signal,
      };
      const loaded = await loadRoute(activeRoute.config);
      throwIfAborted(signal);

      for (const guard of loaded.canDeactivate ?? []) {
        const result = await executeDeactivationGuard(guard, context);
        throwIfAborted(signal);
        const redirect = readRedirect(result);
        if (redirect) {
          const redirectUrl = resolveAppUrl(redirect.redirectTo, 'href');
          if (redirectUrl.href === nextUrl.href) {
            warn('Ignoring canDeactivate redirect to the pending URL', redirect.redirectTo);
            continue;
          }
          return redirect;
        }
        if (result === false) return false;
      }
    }

    return true;
  }

  async function renderMatchedRoute(
    routeState: ActivatedRoute,
    loaded: LoadedRoute,
    signal: AbortSignal,
  ): Promise<{ node: Node; component?: unknown; rendered: ActiveRender }> {
    const destroyController = new AbortController();
    throwIfAborted(signal);
    if (!loaded.component) {
      throw new Error(`Matched route "${routeState.config.path}" has no component`);
    }
    const output = normalizeRenderedRouteNode(
      await loaded.component(routeState, {
        signal,
        destroySignal: destroyController.signal,
      }),
    );
    throwIfAborted(signal);
    return {
      node: output.node,
      component: output.component,
      rendered: {
        controller: destroyController,
        dispose: () => {
          destroyController.abort();
          output.dispose?.();
        },
      },
    };
  }

  async function performNavigation(
    request: NavigationRequest,
    signal: AbortSignal,
  ): Promise<NavigationResult> {
    trace('Navigation started', request.url.href);
    setPhase(request, 'recognizing');

    if (!isInsideBase(request.url.pathname)) {
      throw new Error(
        `URL "${request.url.pathname}" is outside router base "${baseHref}"`,
      );
    }

    const path = stripBaseHref(request.url.pathname, baseHref);
    const match = recognize(path);
    throwIfAborted(signal);

    if (!match) {
      setPhase(request, 'guarding');
      const deactivationResult = await runCanDeactivateGuards(request.url, signal);
      if (deactivationResult === false) {
        return { type: 'blocked', request };
      }

      const deactivationRedirect = deactivationResult
        ? readRedirect(deactivationResult)
        : null;
      if (deactivationRedirect) {
        return { type: 'redirect', request, ...deactivationRedirect };
      }

      return { type: 'not-found', request };
    }

    const primaryRoute = match.route;
    const routes = [primaryRoute, ...(primaryRoute.outlets ?? [])];
    const historyState = request.historyUpdate.nextEntry?.state ?? null;

    if (primaryRoute.redirectTo) {
      return {
        type: 'redirect',
        request,
        redirectTo: interpolateRedirect(primaryRoute.redirectTo, match.params),
        replace: true,
      };
    }

    let loadedRoutes: LoadedRoute[];
    try {
      loadedRoutes = await Promise.all(routes.map(loadRoute));
    } catch (error) {
      throw new RoutePreparationError(
        error,
        currentState !== null && routes.length > 1,
      );
    }
    throwIfAborted(signal);

    for (let index = 1; index < loadedRoutes.length; index++) {
      if (loadedRoutes[index].parseParams || loadedRoutes[index].parseQuery) {
        throw new Error(
          `Outlet "${routes[index].outlet}" cannot define parseParams or parseQuery`,
        );
      }
    }

    // The primary route owns URL parsing. Secondary outlets share the same
    // validated params and query because they are not independently navigable.
    const primaryLoaded = loadedRoutes[0];
    const [parsedParams, parsedQuery] = await Promise.all([
      primaryLoaded.parseParams
        ? primaryLoaded.parseParams(match.params, request.url, signal)
        : Promise.resolve(
            Object.freeze({ ...match.params }) as RouteParams,
          ),
      primaryLoaded.parseQuery
        ? primaryLoaded.parseQuery(request.url, signal)
        : Promise.resolve(readRawQuery(request.url)),
    ]);
    throwIfAborted(signal);

    const sharedParams = Object.freeze({ ...parsedParams });
    const sharedQuery = Object.freeze({ ...parsedQuery });

    const baseRoutes = routes.map<ActivatedRoute>(route => ({
      url: request.url,
      path,
      params: sharedParams,
      query: sharedQuery,
      data: Object.freeze(route.data ?? {}),
      historyState,
      config: route,
    }));

    setPhase(request, 'guarding');

    const beforeLeaveResult = await runTransitionPhase(
      'beforeLeave',
      currentState,
      baseRoutes[0],
      signal,
    );
    if (beforeLeaveResult === false) {
      return { type: 'blocked', request };
    }

    const beforeLeaveRedirect = readRedirect(beforeLeaveResult);
    if (beforeLeaveRedirect) {
      return { type: 'redirect', request, ...beforeLeaveRedirect };
    }

    const deactivationResult = await runCanDeactivateGuards(request.url, signal);
    if (deactivationResult === false) {
      return { type: 'blocked', request };
    }

    const deactivationRedirect = deactivationResult
      ? readRedirect(deactivationResult)
      : null;
    if (deactivationRedirect) {
      return { type: 'redirect', request, ...deactivationRedirect };
    }

    const beforeEnterResult = await runTransitionPhase(
      'beforeEnter',
      currentState,
      baseRoutes[0],
      signal,
    );
    if (beforeEnterResult === false) {
      return { type: 'blocked', request };
    }

    const beforeEnterRedirect = readRedirect(beforeEnterResult);
    if (beforeEnterRedirect) {
      return { type: 'redirect', request, ...beforeEnterRedirect };
    }

    for (let index = 0; index < loadedRoutes.length; index++) {
      const context: NavigationContext = {
        ...baseRoutes[index],
        signal,
      };

      for (const guard of loadedRoutes[index].canActivate ?? []) {
        const result = await executeGuard(guard, context);
        throwIfAborted(signal);
        const redirect = readRedirect(result);
        if (redirect) {
          return { type: 'redirect', request, ...redirect };
        }
        if (result === false) {
          return { type: 'blocked', request };
        }
      }
    }

    const prepareResult = await runTransitionPhase(
      'prepare',
      currentState,
      baseRoutes[0],
      signal,
    );
    if (prepareResult === false) {
      return { type: 'blocked', request };
    }

    const prepareRedirect = readRedirect(prepareResult);
    if (prepareRedirect) {
      return { type: 'redirect', request, ...prepareRedirect };
    }

    setPhase(request, 'resolving');
    const preparedRouteData =
      new WeakMap<
        PrepareRouteDataFn,
        Promise<RouteData>
      >();

    const activatedRoutes = await Promise.all(
      baseRoutes.map(async (baseRoute, index): Promise<ActiveRoute> => {
        const context: NavigationContext = {
          ...baseRoute,
          signal,
        };

        const preparedData = mergeRouteData(
          await Promise.all(
            (loadedRoutes[index].prepare ?? []).map(
              prepare => {
                let pending =
                  preparedRouteData.get(
                    prepare,
                  );

                if (!pending) {
                  pending = Promise.resolve(
                    executePrepareRouteData(
                      prepare,
                      context,
                    ),
                  ).then(result =>
                    normalizePreparedRouteData(
                      result,
                    ),
                  );

                  preparedRouteData.set(
                    prepare,
                    pending,
                  );
                }

                return pending;
              },
            ),
          ),
        );
        throwIfAborted(signal);

        return {
          ...baseRoute,
          data: mergeRouteData([
            baseRoute.data,
            preparedData,
          ]),
        };
      }),
    );

    setPhase(request, 'loading');

    const prepared: PreparedOutlet[] = [];
    try {
      for (let index = 0; index < activatedRoutes.length; index++) {
        const route = activatedRoutes[index];
        const rendered = await renderMatchedRoute(
          route,
          loadedRoutes[index],
          signal,
        );
        prepared.push({
          name: route.config.outlet?.trim() ?? '',
          route,
          ...rendered,
        });
      }
    } catch (error) {
      for (let index = prepared.length - 1; index >= 0; index--) {
        try {
          prepared[index].rendered.dispose();
        } catch {}
      }

      throw new RoutePreparationError(
        error,
        currentState !== null && routes.length > 1,
      );
    }

    return {
      type: 'success',
      request,
      route: activatedRoutes[0],
      outlets: Object.freeze(prepared),
    };
  }

  async function runNavigation(request: NavigationRequest, signal: AbortSignal): Promise<void> {
    if (disposed) return;

    try {
      const result = await performNavigation(request, signal);
      if (disposed || result.request.id !== latestRequestId) {
        if (result.type === 'success') {
          for (const outlet of result.outlets) {
            outlet.rendered.dispose();
          }
        }
        return;
      }
      commit(result);
    } catch (error) {
      if (signal.aborted || isAbortError(error)) return;
      const preparationError =
        error instanceof RoutePreparationError
          ? error
          : null;
      const failure: NavigationFailure = {
        type: 'error',
        request,
        error: preparationError?.originalError ?? error,
        preserveActive: preparationError?.preserveActive ?? false,
      };
      if (failure.request.id !== latestRequestId) return;
      commit(failure);
    } finally {
      if (activeController?.signal === signal) {
        activeController = null;
      }
    }
  }

  async function runExternalNavigation(
    request: NavigationRequest,
    signal: AbortSignal,
  ): Promise<void> {
    if (disposed) {
      settleRequest(request, false);
      return;
    }

    try {
      setPhase(request, 'guarding');

      const deactivationResult =
        await runCanDeactivateGuards(
          request.url,
          signal,
        );

      throwIfAborted(signal);

      if (request.id !== latestRequestId) {
        return;
      }

      const redirect =
        deactivationResult
          ? readRedirect(
              deactivationResult,
            )
          : null;

      if (redirect) {
        const redirectUrl =
          resolveAppUrl(
            redirect.redirectTo,
            'href',
          );

        if (
          redirectUrl.origin !==
          routerLocation().origin
        ) {
          requestState = null;
          navigationPhase = null;
          errorState = null;
          settleRequest(
            request,
            true,
          );
          notifyStateChange();
          navigateExternal(
            redirectUrl,
          );
          return;
        }

        const href =
          redirectUrl.pathname +
          redirectUrl.search +
          redirectUrl.hash;

        const historyState =
          browserWindow?.history.state ?? null;

        const historyUpdate =
          history.createUpdate(
            href,
            redirect.replace,
            historyState,
          );

        browserWindow?.history[
            redirect.replace
              ? 'replaceState'
              : 'pushState'
          ](
            historyState,
            '',
            href,
          );

        dispatchRouterLocationChange();

        void requestNavigation(
          redirectUrl,
          0,
          request.completion,
          historyUpdate,
        );

        return;
      }

      if (
        deactivationResult === false
      ) {
        commit({
          type: 'blocked',
          request,
        });
        return;
      }

      requestState = null;
      navigationPhase = null;
      errorState = null;

      settleRequest(
        request,
        true,
      );

      notifyStateChange();
      navigateExternal(
        request.url,
      );
    } catch (error) {
      if (
        signal.aborted ||
        isAbortError(error)
      ) {
        return;
      }

      if (
        request.id !==
        latestRequestId
      ) {
        return;
      }

      commit({
        type: 'error',
        request,
        error,
      });
    } finally {
      if (
        activeController?.signal ===
        signal
      ) {
        activeController = null;
      }
    }
  }

  function commit(result: NavigationResult): void {
    if (disposed || result.request.id !== latestRequestId) return;

    switch (result.type) {
      case 'success': {
        const previousRoute = currentState;
        runWithViewTransition({
          url: result.request.url,
          from: currentState,
          to: result.route,
          phase: 'success',
          routeConfig: result.route.config,
        }, () => {
          const nextNames = new Set(result.outlets.map(outlet => outlet.name));

          // A custom group commit remains atomic: old renders stay active until
          // the complete group has committed successfully. The built-in/per-outlet
          // renderer disposes old views first so their disposal hooks still observe
          // the view attached to its outlet.
          if (!commitOutlets) {
            for (const renderInstance of activeRenders.values()) {
              disposeRender(renderInstance);
            }
            activeRenders.clear();
            activeRouteStates.clear();
          }

          try {
            if (commitOutlets) {
              commitOutlets(result.outlets);
            } else {
              for (const outlet of result.outlets) {
                if (outlet.name === '') {
                  renderPrimaryNode(outlet.node, outlet.route);
                } else if (render) {
                  render(outlet.name, outlet.node, outlet.route);
                } else {
                  throw new Error(
                    `No renderer is configured for outlet "${outlet.name}"`,
                  );
                }
              }
            }
          } catch (error) {
            for (const outlet of result.outlets) {
              outlet.rendered.dispose();
            }
            throw error;
          }

          if (commitOutlets) {
            for (const [name] of activeRenders.entries()) {
              if (!nextNames.has(name)) {
                replaceActiveRender(name, null);
                activeRouteStates.delete(name);
              }
            }
          }

          for (const outlet of result.outlets) {
            if (commitOutlets) {
              replaceActiveRender(outlet.name, outlet.rendered);
            } else {
              activeRenders.set(outlet.name, outlet.rendered);
            }
            activeRouteStates.set(outlet.name, outlet.route);

            // The router only knows the concrete DOM target for its default
            // primary outlet. Custom named-outlet renderers own activation hooks.
            if (!commitOutlets && outlet.name === '') {
              const target = outlet.node.parentElement ?? resolveOutlet();
              if (target) {
                notifyOutletActivate(target, outlet.component);
              }
            }
          }
        });
        history.commitUpdate(
          result.request.historyUpdate,
          result.request.url.pathname + result.request.url.search + result.request.url.hash,
        );
        currentState = result.route;
        requestState = null;
        navigationPhase = null;
        errorState = null;
        browserWindow?.dispatchEvent(new CustomEvent('routechange', { detail: result.route }));
        trace('Navigation completed', result.route.path);
        restoreScroll(result.request.historyUpdate);
        settleRequest(result.request, true);
        notifyStateChange();
        runAfterEnterTransitions(previousRoute, result.route);
        return;
      }
      case 'redirect': {
        if (result.request.redirectCount >= maxRedirects) {
          commit({
            type: 'error',
            request: result.request,
            error: new Error(`Maximum redirect count of ${maxRedirects} exceeded`),
          });
          return;
        }

        const url = resolveAppUrl(result.redirectTo, 'href');
        if (
          url.origin !==
          routerLocation().origin
        ) {
          void requestExternalNavigation(
            url,
            result.request.completion,
            result.request.historyUpdate,
          );
          return;
        }

        const href = url.pathname + url.search + url.hash;
        const historyState = browserWindow?.history.state ?? null;
        const historyUpdate = history.createUpdate(href, result.replace, historyState);
        browserWindow?.history[result.replace ? 'replaceState' : 'pushState'](historyState, '', href);
        dispatchRouterLocationChange();
        void requestNavigation(
          url,
          result.request.redirectCount + 1,
          result.request.completion,
          historyUpdate,
        );
        return;
      }
      case 'blocked': {
        restoreActiveUrl();
        history.rollbackUpdate(result.request.historyUpdate);
        requestState = null;
        navigationPhase = null;
        errorState = null;
        trace('Navigation blocked');
        restorePreviousScroll(result.request.historyUpdate);
        settleRequest(result.request, false);
        notifyStateChange();
        return;
      }
      case 'not-found': {
        runWithViewTransition({
          url: result.request.url,
          from: currentState,
          to: null,
          phase: 'not-found',
          routeConfig: null,
        }, () => {          
          if (renderNotFound) {
            renderNotFound('', result.request.url, publicRouter);
          } else {
            const heading = browserDocument?.createElement('h1');
            if (!heading) return;
            heading.textContent = '404 — Page Not Found';
            renderPrimaryNode(
              heading,
              createStatusRoute(result.request.url),
            );
          }

          disposeAllRenders();
        });
        history.commitUpdate(
          result.request.historyUpdate,
          result.request.url.pathname + result.request.url.search + result.request.url.hash,
        );
        currentState = null;
        requestState = null;
        navigationPhase = null;
        errorState = null;
        trace('Route not found', result.request.url.pathname);
        restoreScroll(result.request.historyUpdate);
        settleRequest(result.request, false);
        notifyStateChange();
        return;
      }
      case 'error': {
        restoreActiveUrl();

        if (!result.preserveActive) {
          runWithViewTransition({
            url: result.request.url,
            from: currentState,
            to: null,
            phase: 'error',
            routeConfig: null,
            error: result.error,
          }, () => {
            if (renderError) {
              renderError('', result.error, publicRouter);
            } else {
              const heading = browserDocument?.createElement('h1');
              if (!heading) return;
              heading.textContent = 'Page failed to load';
              renderPrimaryNode(
                heading,
                createStatusRoute(result.request.url),
              );
            }

            disposeAllRenders();
          });
        }

        history.rollbackUpdate(result.request.historyUpdate);
        if (!result.preserveActive) {
          currentState = null;
        }
        requestState = null;
        navigationPhase = null;
        errorState = result.error;
        trace('Navigation failed', result.error);
        restorePreviousScroll(result.request.historyUpdate);
        settleRequest(result.request, false);
        notifyStateChange();
        return;
      }
    }
  }

  function handlePopState(): void {
    requestNavigation(
      new URL(routerLocation().href),
      0,
      undefined,
      history.createPopStateUpdate(currentHref()),
    );
  }

  function handleClick(event: MouseEvent): void {
    if (disposed || !started) return;
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) return;

    const anchor = target.closest('a[href]');
    if (!(anchor instanceof HTMLAnchorElement)) return;
    if (anchor.target && anchor.target !== '_self') return;
    if (anchor.hasAttribute('download') || anchor.rel.split(/\s+/).includes('external')) return;

    const location = routerLocation();
    const url = new URL(anchor.href, location.href);
    if (url.origin !== location.origin || !isInsideBase(url.pathname)) {
      return;
    }

    if (url.pathname === location.pathname && url.search === location.search && url.hash) {
      return;
    }

    event.preventDefault();
    navigate(url);
  }

  function navigate(target: string | URL, options: NavigationOptions = {}): Promise<boolean> {
    if (disposed) throw new Error('Cannot navigate with a disposed router');
    const url = resolveAppUrl(target, 'navigate');

    if (
      url.origin !==
      routerLocation().origin
    ) {
      return requestExternalNavigation(
        url,
        undefined,
        history.createDefaultUpdate(),
      );
    }

    if (!isInsideBase(url.pathname)) {
      throw new Error(`URL "${url.pathname}" is outside router base "${baseHref}"`);
    }

    if (config.onSameUrlNavigation === 'ignore' && currentState?.url.href === url.href) {
      return Promise.resolve(false);
    }

    const href = url.pathname + url.search + url.hash;
    const historyState = options.state ?? null;
    const historyUpdate = history.createUpdate(href, options.replace ?? false, historyState);
    browserWindow?.history[options.replace ? 'replaceState' : 'pushState'](historyState, '', href);
    dispatchRouterLocationChange();
    return requestNavigation(url, 0, undefined, historyUpdate);
  }

  function replace(target: string | URL, state?: unknown): Promise<boolean> {
    return navigate(target, { replace: true, state });
  }

  function startRouter(): void {
    if (disposed) {
      throw new Error(
        'Cannot start a disposed router',
      );
    }

    if (started) {
      return;
    }

    started = true;
    browserWindow?.addEventListener(
        'popstate',
        handlePopState,
      );
    browserDocument?.addEventListener(
        'click',
        handleClick,
      );
    schedulePreloading();

    // Starting the router must be synchronous from the caller's point of
    // view. Queue initial URL recognition so `state.pending` remains false
    // immediately after start(), and let an explicit navigate() win.
    if (startRequestQueued) {
      return;
    }

    startRequestQueued = true;

    queueMicrotask(() => {
      startRequestQueued = false;

      if (
        !started ||
        disposed ||
        currentState !== null ||
        requestState !== null
      ) {
        return;
      }

      void requestNavigation(
        new URL(routerLocation().href),
        0,
        undefined,
        history.createDefaultUpdate(),
      );
    });
  }

  function stopRouter(): void {
    cancelScheduledPreloading();

    if (!started) {
      cancelActiveNavigation();
      return;
    }

    browserWindow?.removeEventListener('popstate', handlePopState);
    browserDocument?.removeEventListener('click', handleClick);
    cancelActiveNavigation();
    disposeAllRenders();
    clearOutlet();
    started = false;
    startRequestQueued = false;
    requestState = null;
    navigationPhase = null;
    errorState = null;
    currentState = null;
    notifyStateChange();
  }

  function href(target: string): string {
    const url = resolveAppUrl(target, 'href');
    return routerHref(url);
  }

  function createLink(to: string, text: string, className = ''): HTMLAnchorElement {
    if (!browserDocument) {
      throw new Error('Cannot create a router link without a document.');
    }

    const link = browserDocument.createElement('a');
    link.href = href(to);
    link.textContent = text;
    if (className) link.className = className;
    return link;
  }

  let publicRouter: Router;

  const publicState: RouterState = {
    get current() {
      if (disposed) return null;
      return currentState;
    },
    get pending() {
      if (disposed) return false;
      return requestState !== null;
    },
    get phase() {
      if (disposed) return null;
      return navigationPhase;
    },
    get error() {
      if (disposed) return null;
      return errorState;
    },
    get path() {
      if (disposed) return '';
      return currentState?.path ?? '';
    },
    get params() {
      if (disposed) return EMPTY_PARAMS;
      return currentState?.params ?? EMPTY_PARAMS;
    },
    get query() {
      if (disposed) return EMPTY_QUERY;
      return currentState?.query ?? EMPTY_QUERY;
    },
    get data() {
      if (disposed) return EMPTY_DATA;
      return currentState?.data ?? EMPTY_DATA;
    },
    get historyState() {
      if (disposed) return null;
      return currentState?.historyState ?? history.createDefaultUpdate().previousEntry?.state ?? null;
    },
    get routeConfig() {
      if (disposed) return null;
      return currentState?.config ?? null;
    },
  };

  publicRouter = {
    state: publicState,
    start: () => startRouter(),
    stop: () => stopRouter(),
    dispose: () => {
      if (disposed) return;
      stopRouter();
      disposed = true;
    },
    navigate: (target, options) => navigate(target, options),
    replace: (target, state) => replace(target, state),
    updateHistoryState: (state) => updateHistoryState(state),
    preload: () => preload(),
    back: () => browserWindow?.history.back(),
    forward: () => browserWindow?.history.forward(),
    href: (target) => href(target),
    createLink: (to, text, className) => createLink(to, text, className),
  };

  return publicRouter;
}

export type VanillaRouterInstance = ReturnType<typeof createRouter>;
````

## File: src/tests/adapters.spec.ts
````typescript
import { Component, Input } from '@angular/core';

import {
  adaptRouteComponent,
  bindRouteInputs,
  type NavigationProviders,
} from '@epikodelabs/routty';

@Component({
  template: '',
})
class TestRouteComponent {}

type ActivatedRoute = Parameters<typeof bindRouteInputs>[2];

function createRoute(
  overrides: Partial<ActivatedRoute> = {},
): ActivatedRoute {
  return {
    path: '/projects/42',
    params: {},
    query: {},
    data: {},
    ...overrides,
  } as ActivatedRoute;
}

describe('router adapters', () => {
  it('binds route inputs by source instead of flattening them', () => {
    const target = {
      setInput: jasmine.createSpy('setInput'),
    };

    @Component({ template: '' })
    class TestInputsComponent {
      @Input() params!: Record<string, unknown>;
      @Input() query!: Record<string, unknown>;
      @Input() data!: Record<string, unknown>;
      @Input() projectId!: number;
    }

    const route = createRoute({
      params: {
        projectId: '7',
        section: 'overview',
      },
      query: {
        tab: 'activity',
        sort: 'oldest',
      },
      data: {
        'project-id': 42,
        user: 'Ada',
        __params: {
          projectId: 42,
        },
        __query: {
          tab: 'settings',
        },
        sort: 'recent',
      },
    });

    bindRouteInputs(target, TestInputsComponent, route);

    expect(target.setInput).toHaveBeenCalledTimes(3);
    expect(target.setInput).toHaveBeenCalledWith(
      'params',
      {
        projectId: 42,
        section: 'overview',
      },
    );
    expect(target.setInput).toHaveBeenCalledWith(
      'query',
      {
        tab: 'settings',
        sort: 'oldest',
      },
    );
    expect(target.setInput).toHaveBeenCalledWith(
      'data',
      {
        'project-id': 42,
        user: 'Ada',
        sort: 'recent',
      },
    );
    expect(target.setInput).not.toHaveBeenCalledWith('projectId', jasmine.anything());
  });

  it('returns the renderer-produced route component and passes route providers', () => {
    const providers: NavigationProviders = [
      {
        provide: 'ROUTE_MESSAGE',
        useValue: 'scoped',
      },
    ];

    const rendered = jasmine.createSpy('rendered');
    const render = jasmine
      .createSpy('render')
      .and.returnValue(rendered);

    const context = {
      injector: {
        kind: 'injector',
      },
      render,
    } as any;

    const routeComponent = adaptRouteComponent(
      TestRouteComponent,
      context,
      providers,
    );

    expect(render).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledWith(
      TestRouteComponent,
      context.injector,
      providers,
    );
    expect(routeComponent).toBe(rendered);
  });
});
````

## File: src/tests/angular-testbed.init.ts
````typescript
import {
  TestBed,
  getTestBed,
} from '@angular/core/testing';

import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';

export function ensureAngularTestEnvironment(): void {
  const testBed = getTestBed() as {
    platform: unknown | null;
  };

  if (testBed.platform) {
    return;
  }

  TestBed.initTestEnvironment(
    BrowserTestingModule,
    platformBrowserTesting(),
  );
}

ensureAngularTestEnvironment();
````

## File: src/tests/env.spec.ts
````typescript
// Avoid a hard dependency on Node ambient types in browser-focused specs.
const processLike = (globalThis as { process?: { versions?: { node?: unknown } } }).process;

const isNode =
  processLike != null &&
  processLike.versions != null &&
  processLike.versions.node != null;

const isBrowser =
  typeof window !== "undefined" &&
  typeof window.document !== "undefined";

// Suite-level wrappers (describe only accepts sync functions)
/**
 * Function ndescribe.
 */
export function ndescribe(name: string, fn: () => void) {
  return isNode ? describe(name, fn) : xdescribe(name, fn);
}

/**
 * Function idescribe.
 */
export function idescribe(name: string, fn: () => void) {
  return isBrowser ? describe(name, fn) : xdescribe(name, fn);
}

// Spec-level wrappers (it allows async callbacks with DoneFn)
/**
 * Function nit.
 */
export function nit(name: string, fn: jasmine.ImplementationCallback) {
  return isNode ? it(name, fn) : xit(name, fn);
}

/**
 * Function iit.
 */
export function iit(name: string, fn: jasmine.ImplementationCallback) {
  return isBrowser ? it(name, fn) : xit(name, fn);
}

// Export environment flags too
export { isBrowser, isNode };

describe('test environment helpers', () => {
  it('loads helper wrappers', () => {
    expect(true).toBeTrue();
  });
});
````

## File: src/tests/outlet-isolation.spec.ts
````typescript
import { ensureAngularTestEnvironment } from './angular-testbed.init';

import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterOutlet } from '@epikodelabs/routty';

ensureAngularTestEnvironment();

@Component({
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
class RouterOutletHost {}

describe('RouterOutlet isolation', () => {
  it('should compile the Angular-compatible router-outlet selector', async () => {
    expect(RouterOutlet).toBeTruthy();
    expect((RouterOutlet as any)['ɵdir']).toBeTruthy();

    await TestBed.configureTestingModule({
      imports: [RouterOutletHost],
    }).compileComponents();

    expect().nothing();
  });
});
````

## File: src/tests/router-facade.spec.ts
````typescript
import { ensureAngularTestEnvironment } from './angular-testbed.init';

import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  layout,
  lazyLayout,
  lazyRoute,
  provideRouter,
  RouterOutlet,
  route,
  Router,
  type NavigationTree,
} from '@epikodelabs/routty';

ensureAngularTestEnvironment();

@Component({ standalone: true, template: '<h1>Home</h1>' })
class HomeComponent {}

@Component({
  standalone: true,
  imports: [RouterOutlet],
  template: '<h2>Parent</h2><router-outlet />',
  host: { 'parent-cmp': '' },
})
class ParentComponent {}

@Component({
  standalone: true,
  imports: [RouterOutlet],
  template: '<h2>Shell</h2><router-outlet />',
  host: { 'shell-cmp': '' },
})
class ShellComponent {}

@Component({
  standalone: true,
  imports: [RouterOutlet],
  template: '<h2>Shell</h2><router-outlet name="sidebar" /><router-outlet />',
  host: { 'shell-sidebar-cmp': '' },
})
class ShellWithSidebarComponent {}

@Component({
  standalone: true,
  template: '<h3>Child</h3>',
  host: { 'child-cmp': '' },
})
class ChildComponent {}

@Component({
  standalone: true,
  template: '<h3>Settings</h3>',
  host: { 'settings-cmp': '' },
})
class SettingsComponent {}

describe('Router: flat routes and layouts', () => {
  let outlet: HTMLElement;
  let router: Router;

  function bootstrap(routes: NavigationTree): void {
    TestBed.configureTestingModule({
      imports: [
        HomeComponent,
        ParentComponent,
        ShellComponent,
        ShellWithSidebarComponent,
        ChildComponent,
        SettingsComponent,
      ],
      providers: [...provideRouter(routes)],
    });

    outlet = document.createElement('div');
    router = TestBed.inject(Router);
    router.connect('', outlet);
  }

  function getOutletContent(): string {
    return outlet.innerHTML;
  }

  async function navigate(path: string): Promise<void> {
    await router.navigate({ path });
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    spyOn(window.history, 'pushState').and.callThrough();
    spyOn(window.history, 'replaceState').and.callThrough();
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    router?.dispose();
    outlet?.remove();
  });

  it('renders a leaf route without a layout', async () => {
    const routes = [route('/', HomeComponent)] as const satisfies NavigationTree;

    bootstrap(routes);
    await navigate('/');

    expect(getOutletContent()).toContain('<h1>Home</h1>');
  });

  it('supports a layout index route', async () => {
    const routes = [
      layout('/admin', ParentComponent, [
        route('', HomeComponent),
      ]),
    ] as const satisfies NavigationTree;

    bootstrap(routes);
    await navigate('/admin');

    const content = getOutletContent();
    expect(content).toContain('<h2>Parent</h2>');
    expect(content).toContain('<h1>Home</h1>');
  });

  it('renders an eager layout around an eager leaf route', async () => {
    const routes = [
      layout('/admin', ParentComponent, [
        route('/child', ChildComponent),
      ]),
    ] as const satisfies NavigationTree;

    bootstrap(routes);
    await navigate('/admin/child');

    const content = getOutletContent();
    expect(content).toContain('<h2>Parent</h2>');
    expect(content).toContain('<h3>Child</h3>');
  });

  it('inherits the layout path prefix', async () => {
    const routes = [
      layout('/admin', ParentComponent, [
        route('/settings', SettingsComponent),
      ]),
    ] as const satisfies NavigationTree;

    bootstrap(routes);
    await navigate('/admin/settings');

    expect(getOutletContent()).toContain('<h3>Settings</h3>');
    expect(router.state.path).toBe('/admin/settings');
  });

  it('renders an eager layout around a lazy leaf route', async () => {
    const routes = [
      layout('/admin', ParentComponent, [
        lazyRoute('/lazy-child', async () => ChildComponent),
      ]),
    ] as const satisfies NavigationTree;

    bootstrap(routes);
    await navigate('/admin/lazy-child');

    const content = getOutletContent();
    expect(content).toContain('<h2>Parent</h2>');
    expect(content).toContain('<h3>Child</h3>');
  });

  it('renders a lazy layout around an eager leaf route', async () => {
    const routes = [
      lazyLayout('/admin', async () => ParentComponent, [
        route('/child', ChildComponent),
      ]),
    ] as const satisfies NavigationTree;

    bootstrap(routes);
    await navigate('/admin/child');

    const content = getOutletContent();
    expect(content).toContain('<h2>Parent</h2>');
    expect(content).toContain('<h3>Child</h3>');
  });

  it('renders a lazy layout around a lazy leaf route', async () => {
    const routes = [
      lazyLayout('/admin', async () => ParentComponent, [
        lazyRoute('/lazy-child', async () => ChildComponent),
      ]),
    ] as const satisfies NavigationTree;

    bootstrap(routes);
    await navigate('/admin/lazy-child');

    const content = getOutletContent();
    expect(content).toContain('<h2>Parent</h2>');
    expect(content).toContain('<h3>Child</h3>');
  });

  it('composes multiple layouts without creating a route hierarchy', async () => {
    const routes = [
      layout('/app', ShellComponent, [
        layout('/admin', ParentComponent, [
          route('/child', ChildComponent),
        ]),
      ]),
    ] as const satisfies NavigationTree;

    bootstrap(routes);
    await navigate('/app/admin/child');

    const content = getOutletContent();
    expect(content).toContain('<h2>Shell</h2>');
    expect(content).toContain('<h2>Parent</h2>');
    expect(content).toContain('<h3>Child</h3>');
  });

  it('supports multiple leaf routes inside one prefixed layout', async () => {
    const routes = [
      layout('/admin', ParentComponent, [
        route('/child', ChildComponent),
        route('/settings', SettingsComponent),
      ]),
    ] as const satisfies NavigationTree;

    bootstrap(routes);

    await navigate('/admin/child');
    expect(getOutletContent()).toContain('<h3>Child</h3>');

    await navigate('/admin/settings');
    const content = getOutletContent();
    expect(content).toContain('<h2>Parent</h2>');
    expect(content).toContain('<h3>Settings</h3>');
    expect(content).not.toContain('<h3>Child</h3>');
  });

  it('supports named outlets', async () => {
    const routes = [
      layout('/', ParentComponent, [
        route('', HomeComponent),
        route('', SettingsComponent, { outlet: 'sidebar' }),
      ]),
    ] as const satisfies NavigationTree;

    const sidebarOutlet = document.createElement('div');
    sidebarOutlet.id = 'sidebar-outlet';

    bootstrap(routes);
    router.connect('sidebar', sidebarOutlet);

    await navigate('/');
    const content = getOutletContent();
    expect(content).toContain('<h1>Home</h1>');
    expect(sidebarOutlet.innerHTML).toContain('<h3>Settings</h3>');

    router.disconnect('sidebar', sidebarOutlet);
  });

  it('connects named outlets declared inside a layout component', async () => {
    const routes = [
      layout('/app', ShellWithSidebarComponent, [
        route('/child', ChildComponent),
        route('/child', SettingsComponent, { outlet: 'sidebar' }),
      ]),
    ] as const satisfies NavigationTree;

    bootstrap(routes);
    await navigate('/app/child');

    const content = getOutletContent();
    expect(content).toContain('<h2>Shell</h2>');
    expect(content).toContain('<h3>Child</h3>');
    expect(content).toContain('<h3>Settings</h3>');
  });

  it('keeps named outlet navigation working across layout re-renders', async () => {
    const routes = [
      layout('/app', ShellWithSidebarComponent, [
        route('/child', ChildComponent),
        route('/child', SettingsComponent, { outlet: 'sidebar' }),
        route('/settings', SettingsComponent),
        route('/settings', HomeComponent, { outlet: 'sidebar' }),
      ]),
    ] as const satisfies NavigationTree;

    bootstrap(routes);

    await navigate('/app/child');
    expect(getOutletContent()).toContain('<h3>Child</h3>');
    expect(getOutletContent()).toContain('<h3>Settings</h3>');

    await navigate('/app/settings');

    const content = getOutletContent();
    expect(content).toContain('<h3>Settings</h3>');
    expect(content).toContain('<h1>Home</h1>');
    expect(router.state.path).toBe('/app/settings');
  });
});
````

## File: src/tests/router-link.spec.ts
````typescript
import { ensureAngularTestEnvironment } from './angular-testbed.init';

import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  RouterLink,
  RouterOutlet,
  Router,
  provideRouter,
  route,
} from '@epikodelabs/routty';

ensureAngularTestEnvironment();

function delay(ms = 0): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function dispatchAnchorClick(target: HTMLAnchorElement): boolean {
  const event = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    button: 0,
  });

  let defaultPrevented = false;
  const cleanupListener = (currentEvent: MouseEvent) => {
    defaultPrevented = currentEvent.defaultPrevented;
    currentEvent.preventDefault();
  };

  document.addEventListener('click', cleanupListener);
  try {
    target.dispatchEvent(event);
  } finally {
    document.removeEventListener('click', cleanupListener);
  }

  return defaultPrevented;
}

@Component({
  standalone: true,
  template: '<h1>Home</h1>',
})
class HomeComponent {}

@Component({
  standalone: true,
  template: '<h1>About</h1>',
})
class AboutComponent {}

@Component({
  standalone: true,
  imports: [RouterLink, RouterOutlet],
  template: '<a [routerLink]="target">About</a><router-outlet />',
})
class RouterLinkHostComponent {
  target = '/about';
}

describe('RouterLink', () => {
  let router: Router;

  beforeEach(() => {
    TestBed.resetTestingModule();
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    router?.dispose();
  });

  it('binds href for routerLink and navigates through anchor clicks', async () => {
    await TestBed.configureTestingModule({
      imports: [
        HomeComponent,
        AboutComponent,
        RouterLinkHostComponent,
      ],
      providers: [
        ...provideRouter([
          route('/', HomeComponent),
          route('/about', AboutComponent),
        ]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(RouterLinkHostComponent);
    router = TestBed.inject(Router);

    fixture.detectChanges();
    await delay();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const anchor = host.querySelector('a');

    expect(anchor).not.toBeNull();
    expect(anchor?.getAttribute('href')).toBe('/about');

    const defaultPrevented = dispatchAnchorClick(anchor as HTMLAnchorElement);

    await delay();
    fixture.detectChanges();

    expect(defaultPrevented).toBeTrue();
    expect(router.state.current?.path).toBe('/about');
    expect(host.textContent).toContain('About');
  });
});
````

## File: src/tests/router.spec.ts
````typescript
import { createRouter, type Route, type VanillaRouter, type VanillaRouterConfig } from '@epikodelabs/routty';
import { idescribe } from './env.spec';

function unwrapTestComponent<T>(value: T | { default: T }): T {
  return value != null && typeof value === 'object' && 'default' in value
    ? value.default
    : value as T;
}
// Helper function for async testing
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// Helper function to create test components
function createComponent(text: string): () => Node {
    return () => document.createTextNode(text);
}
function dispatchAnchorClick(target: HTMLAnchorElement, init: MouseEventInit = {}): boolean {
    const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        button: 0,
        ...init
    });
    let defaultPrevented = false;
    const cleanupListener = (currentEvent: MouseEvent) => {
        defaultPrevented = currentEvent.defaultPrevented;
        currentEvent.preventDefault();
    };
    document.addEventListener('click', cleanupListener);
    try {
        target.dispatchEvent(event);
    }
    finally {
        document.removeEventListener('click', cleanupListener);
    }
    return defaultPrevented;
}
// Helper to create a route object with component (since Route doesn't have 'component' property)
function routeWithComponent(path: string, text: string): Route {
    return {
        path,
        load: async () => ({
            component: unwrapTestComponent(await (() => Promise.resolve(createComponent(text)))())
        })
    };
}
idescribe('Router', () => {
    let outlet: HTMLElement;
    let router: VanillaRouter;
    beforeEach(() => {
        // Create a DOM outlet for testing
        outlet = document.createElement('div');
        outlet.id = 'test-outlet';
        document.body.appendChild(outlet);
        // Reset URL
        window.history.replaceState(null, '', '/');
        // Spy on console methods
        spyOn(console, 'debug');
        spyOn(console, 'error');
    });
    afterEach(() => {
        if (router) {
            router.dispose();
        }
        if (outlet.parentNode) {
            document.body.removeChild(outlet);
        }
    });
    describe('creation', () => {
        it('should create a router instance', () => {
            const config: VanillaRouterConfig = {
                routes: [routeWithComponent('', 'Home')],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            expect(router).toBeDefined();
            expect(router.state).toBeDefined();
            expect(router.state.current).toBeNull();
            expect(router.state.pending).toBeFalse();
            expect(router.state.phase).toBeNull();
            expect(router.state.path).toBe('');
            expect(router.state.params).toEqual({});
            expect(router.state.query).toEqual({});
            expect(router.state.data).toEqual({});
            expect(router.state.routeConfig).toBeNull();
        });
        it('should use default outlet when not provided', () => {
            const app = document.createElement('div');
            app.id = 'app';
            document.body.appendChild(app);
            const defaultRouter = createRouter({
                routes: [routeWithComponent('', 'Home')]
            });
            expect(defaultRouter).toBeDefined();
            defaultRouter.dispose();
            document.body.removeChild(app);
        });
        it('should normalize baseHref', () => {
            const config: VanillaRouterConfig = {
                routes: [routeWithComponent('', 'Home')],
                baseHref: '/app/',
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            expect(router.href('/about')).toBe('/app/about');
        });
    });
    describe('navigation', () => {
        it('should navigate to a route', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.navigate('/about');
            await delay(50);
            expect(router.state.current?.path).toBe('/about');
            expect(router.state.current?.config.path).toBe('about');
            expect(outlet.textContent).toBe('About');
            expect(router.state.routeConfig?.path).toBe('about');
        });
        it('should resolve navigation after the route has rendered', async () => {
            router = createRouter({
                routes: [routeWithComponent('about', 'About')],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            });
            const completed = await router.navigate('/about');
            expect(completed).toBeTrue();
            expect(router.state.current?.path).toBe('/about');
            expect(outlet.textContent).toBe('About');
        });
        it('should notify outlet activation through the config hook', async () => {
            const onOutletActivate = jasmine.createSpy('onOutletActivate');
            router = createRouter({
                routes: [{
                        path: 'about',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(() => ({
                                node: document.createTextNode('About'),
                                component: { kind: 'about-component' }
                            })))())
                        })
                    }], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
                onOutletActivate
            });
            await router.navigate('/about');
            expect(onOutletActivate).toHaveBeenCalledTimes(1);
            expect(onOutletActivate).toHaveBeenCalledWith(outlet, jasmine.objectContaining({ kind: 'about-component' }));
        });
        it('should navigate to the home route', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.navigate('/');
            await delay(50);
            expect(router.state.current?.path).toBe('/');
            expect(outlet.textContent).toBe('Home');
        });
        it('should navigate with replace option', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            const replaceSpy = spyOn(window.history, 'replaceState').and.callThrough();
            router.navigate('/about', { replace: true });
            await delay(50);
            expect(replaceSpy).toHaveBeenCalled();
            expect(router.state.current?.path).toBe('/about');
        });
        it('should navigate with state', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            const pushStateSpy = spyOn(window.history, 'pushState').and.callThrough();
            router.navigate('/about', { state: { from: 'test' } });
            await delay(50);
            expect(pushStateSpy).toHaveBeenCalledWith({ from: 'test' }, '', '/about');
            expect(router.state.historyState).toEqual({ from: 'test' });
            expect(router.state.current?.historyState).toEqual({ from: 'test' });
        });
        it('should update the current history state without navigating', async () => {
            router = createRouter({
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            });
            router.start();
            await router.navigate('/about', { state: { from: 'test' } });
            const replaceStateSpy = spyOn(window.history, 'replaceState').and.callThrough();
            router.updateHistoryState({ from: 'updated', step: 2 });
            expect(replaceStateSpy).toHaveBeenCalledWith({ from: 'updated', step: 2 }, '', '/about');
            expect(router.state.historyState).toEqual({ from: 'updated', step: 2 });
            expect(router.state.current?.historyState).toEqual({ from: 'updated', step: 2 });
        });
        it('should handle navigation to external URLs', async () => {
            const navigateExternal = jasmine.createSpy('navigateExternal');
            const config: VanillaRouterConfig = {
                routes: [routeWithComponent('', 'Home')],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
                navigateExternal
            };
            router = createRouter(config);
            router.start();
            router.navigate('https://example.com');
            await delay(10);
            expect(navigateExternal).toHaveBeenCalledWith(new URL('https://example.com/'));
        });
        it('should handle navigation with query parameters', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.navigate('/?foo=bar&baz=qux');
            await delay(50);
            expect(router.state.query).toEqual({ foo: 'bar', baz: 'qux' });
        });
        it('should handle navigation with hash', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.navigate('/#section');
            await delay(50);
            expect(router.state.current?.url.hash).toBe('#section');
        });
        it('should ignore an active URL without touching history when configured', async () => {
            let guardCalls = 0;
            let prepareCalls = 0;
            let componentLoads = 0;
            const pushStateSpy = spyOn(window.history, 'pushState').and.callThrough();
            router = createRouter({
                routes: [{
                        path: 'same',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => {
                                componentLoads++;
                                return Promise.resolve(createComponent('Same'));
                            })()),
                            canActivate: [() => {
                                    guardCalls++;
                                    return true;
                                }],
                            prepare: [() => {
                                prepareCalls++;
                                return {
                                    value: 'prepared'
                                };
                            }]
                        })
                    }], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
                onSameUrlNavigation: 'ignore'
            });
            await router.navigate('/same');
            pushStateSpy.calls.reset();
            const navigated = await router.navigate('/same');
            expect(navigated).toBeFalse();
            expect(guardCalls).toBe(1);
            expect(prepareCalls).toBe(1);
            expect(componentLoads).toBe(1);
            expect(pushStateSpy).not.toHaveBeenCalled();
        });
        it('should reload an active URL by default', async () => {
            let componentLoads = 0;
            router = createRouter({
                routes: [{
                        path: 'same',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => {
                                componentLoads++;
                                return Promise.resolve(createComponent('Same'));
                            })())
                        })
                    }], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            });
            await router.navigate('/same');
            const navigated = await router.navigate('/same');
            expect(navigated).toBeTrue();
            expect(componentLoads).toBe(1);
        });
    });
    describe('route matching', () => {
        it('should refresh a cached route pattern when its path changes', async () => {
            const route = routeWithComponent('first', 'Route');
            router = createRouter({ routes: [route], render: (name, node) => {
                outlet.replaceChildren(node);
            }, });
            await router.navigate('/first');
            route.path = 'second';
            await router.navigate('/second');
            expect(router.state.current?.path).toBe('/second');
            expect(outlet.textContent).toBe('Route');
        });
        it('should match parameterized routes', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'users/:id',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('User')))())
                        })
                    },
                ], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.navigate('/users/123');
            await delay(50);
            expect(router.state.current?.path).toBe('/users/123');
            expect(router.state.current?.params).toEqual({ id: '123' });
            expect(router.state.current?.config.path).toBe('users/:id');
            expect(router.state.params).toEqual({ id: '123' });
        });
        it('should decode URL parameters', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'users/:id',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('User')))())
                        })
                    },
                ], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.navigate('/users/hello%20world');
            await delay(50);
            expect(router.state.current?.params).toEqual({ id: 'hello world' });
        });
        it('should match wildcard routes', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    {
                        path: '**',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('404')))())
                        })
                    },
                ], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.navigate('/non-existent');
            await delay(50);
            expect(router.state.current?.config.path).toBe('**');
            expect(outlet.textContent).toBe('404');
        });
    });
        it('should only match complete flat route paths', async () => {
            router = createRouter({
                routes: [
                    routeWithComponent('admin/users', 'Admin Users'),
                    routeWithComponent('admin/settings', 'Admin Settings'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            });

            await router.navigate('/admin/users');

            expect(router.state.current?.config.path).toBe('admin/users');
            expect(outlet.textContent).toBe('Admin Users');
        });
        it('should not infer parent routes from path prefixes', async () => {
            router = createRouter({
                routes: [
                    routeWithComponent('admin', 'Admin'),
                    routeWithComponent('admin/users', 'Admin Users'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            });

            await router.navigate('/admin/users');

            expect(router.state.current?.config.path).toBe('admin/users');
            expect(outlet.textContent).toBe('Admin Users');
        });
    describe('guards', () => {
        it('should allow navigation when guard returns true', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'protected',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Protected')))()),
                            canActivate: [() => true]
                        })
                    },
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.navigate('/protected');
            await delay(50);
            expect(router.state.current?.path).toBe('/protected');
            expect(outlet.textContent).toBe('Protected');
        });
        it('should block navigation when guard returns false', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'protected',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Protected')))()),
                            canActivate: [() => false]
                        })
                    },
                    routeWithComponent('', 'Home'),
                ],
                outlet
            };
            router = createRouter(config);
            router.start();
            router.navigate('/protected');
            await delay(50);
            expect(router.state.current).toBeNull();
            expect(router.state.pending).toBeFalse();
        });
        it('should resolve false when a guard blocks navigation', async () => {
            router = createRouter({
                routes: [{
                        path: 'protected',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Protected')))()),
                            canActivate: [() => false]
                        })
                    }], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            });
            const completed = await router.navigate('/protected');
            expect(completed).toBeFalse();
            expect(router.state.current).toBeNull();
        });
        it('should redirect when guard returns a redirect string', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'old',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Old')))()),
                            canActivate: [() => '/new']
                        })
                    },
                    routeWithComponent('new', 'New'),
                ],
                outlet
            };
            router = createRouter(config);
            router.start();
            router.navigate('/old');
            await delay(100);
            expect(router.state.current?.path).toBe('/new');
            expect(outlet.textContent).toBe('New');
        });
        it('should redirect when guard returns a redirect object', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'old',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Old')))()),
                            canActivate: [() => ({ redirectTo: '/new', replace: true })]
                        })
                    },
                    routeWithComponent('new', 'New'),
                ],
                outlet
            };
            router = createRouter(config);
            router.start();
            router.navigate('/old');
            await delay(100);
            expect(router.state.current?.path).toBe('/new');
            expect(outlet.textContent).toBe('New');
        });
        it('should support async guards', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'async',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Async')))()),
                            canActivate: [
                                async () => {
                                    await delay(10);
                                    return true;
                                },
                            ]
                        })
                    },
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.navigate('/async');
            await delay(50);
            expect(router.state.current?.path).toBe('/async');
            expect(outlet.textContent).toBe('Async');
        });
        it('should execute multiple guards in order', async () => {
            const order: string[] = [];
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'guarded',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Guarded')))()),
                            canActivate: [
                                () => { order.push('first'); return true; },
                                () => { order.push('second'); return true; },
                            ]
                        })
                    },
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.navigate('/guarded');
            await delay(50);
            expect(order).toEqual(['first', 'second']);
            expect(router.state.current?.path).toBe('/guarded');
        });
        it('should stop at the first failing guard', async () => {
            const order: string[] = [];
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'guarded',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Guarded')))()),
                            canActivate: [
                                () => { order.push('first'); return true; },
                                () => { order.push('second'); return false; },
                                () => { order.push('third'); return true; },
                            ]
                        })
                    },
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.navigate('/guarded');
            await delay(50);
            expect(order).toEqual(['first', 'second']);
            expect(router.state.current).toBeNull();
        });
        it('should work with guard objects', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'protected',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Protected')))()),
                            canActivate: [() => true]
                        })
                    },
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.navigate('/protected');
            await delay(50);
            expect(router.state.current?.path).toBe('/protected');
        });
        it('should block navigation when canDeactivate returns false', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'edit',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Edit')))()),
                            canDeactivate: [() => false]
                        })
                    },
                    routeWithComponent('other', 'Other'),
                ],
                outlet
            };
            router = createRouter(config);
            router.start();
            router.navigate('/edit');
            await delay(50);
            router.navigate('/other');
            await delay(50);
            expect(router.state.current?.path).toBe('/edit');
            expect(outlet.textContent).toBe('Edit');
            expect(router.state.error).toBeNull();
        });
        it('should redirect when canDeactivate returns a redirect', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'edit',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Edit')))()),
                            canDeactivate: [() => '/confirm']
                        })
                    },
                    routeWithComponent('confirm', 'Confirm'),
                    routeWithComponent('other', 'Other'),
                ],
                outlet
            };
            router = createRouter(config);
            router.start();
            router.navigate('/edit');
            await delay(50);
            router.navigate('/other');
            await delay(100);
            expect(router.state.current?.path).toBe('/confirm');
            expect(outlet.textContent).toBe('Confirm');
        });
        it('should warn when canDeactivate redirects to the pending URL', async () => {
            const warnSpy = spyOn(console, 'warn');
            router = createRouter({
                routes: [
                    {
                        path: 'edit',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Edit')))()),
                            canDeactivate: [() => ({ redirectTo: '/target', replace: true })]
                        })
                    },
                    routeWithComponent('target', 'Target'),
                ],
                outlet
            });
            await router.navigate('/edit');
            await router.navigate('/target');
            expect(warnSpy).toHaveBeenCalledWith('[Router] Ignoring canDeactivate redirect to the pending URL', '/target');
            expect(router.state.current?.path).toBe('/target');
        });
    });
    describe('prepare data', () => {
        it('should prepare data before navigation', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'user',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('User')))()),
                            prepare: [
                                () => ({ userId: 123 }),
                                () => ({ userName: 'Alice' })
                            ]
                        })
                    },
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.navigate('/user');
            await delay(50);
            expect(router.state.current?.data).toEqual({
                userId: 123,
                userName: 'Alice'
            });
        });
        it('should support async prepare handlers', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'async-data',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Async Data')))()),
                            prepare: [async () => {
                                    await delay(10);
                                    return { data: { id: 1, name: 'Async' } };
                                }]
                        })
                    },
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.navigate('/async-data');
            await delay(50);
            expect(router.state.current?.data).toEqual({
                data: { id: 1, name: 'Async' }
            });
        });
        it('should merge static data and prepared data', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'merged',
                        data: { static: 'static-value' },
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Merged')))()),
                            prepare: [() => ({ dynamic: 'dynamic-value' })]
                        })
                    },
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.navigate('/merged');
            await delay(50);
            expect(router.state.current?.data).toEqual({
                static: 'static-value',
                dynamic: 'dynamic-value'
            });
        });
        it('should merge multiple prepare handlers', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'user',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('User')))()),
                            prepare: [
                                () => ({ userId: 100 }),
                                () => ({ userId: 123 })
                            ]
                        })
                    },
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.navigate('/user');
            await delay(50);
            expect(router.state.current?.data).toEqual({
                userId: 123
            });
        });
    });
    describe('redirects', () => {
        it('should handle static redirects', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'old',
                        redirectTo: '/new'
                    },
                    routeWithComponent('new', 'New Page'),
                ],
                outlet
            };
            router = createRouter(config);
            router.start();
            router.navigate('/old');
            await delay(100);
            expect(router.state.current?.path).toBe('/new');
            expect(outlet.textContent).toBe('New Page');
        });
        it('should handle parameterized redirects', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'users/:id',
                        redirectTo: '/profiles/:id'
                    },
                    {
                        path: 'profiles/:id',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Profile')))())
                        })
                    },
                ], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.navigate('/users/123');
            await delay(100);
            expect(router.state.current?.path).toBe('/profiles/123');
            expect(router.state.current?.params).toEqual({ id: '123' });
        });
        it('should enforce max redirect count', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'a',
                        redirectTo: '/b'
                    },
                    {
                        path: 'b',
                        redirectTo: '/a'
                    },
                ], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
                maxRedirects: 3
            };
            router = createRouter(config);
            router.start();
            router.navigate('/a');
            await delay(200);
            expect(router.state.phase).toBeNull();
            expect(router.state.error).toBeDefined();
            expect((router.state.error as Error).message).toContain('Maximum redirect count');
        });
        it('should handle cross-origin redirects', async () => {
            const navigateExternal = jasmine.createSpy('navigateExternal');
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'external',
                        redirectTo: 'https://example.com'
                    },
                ], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
                navigateExternal
            };
            router = createRouter(config);
            router.start();
            router.navigate('/external');
            await delay(50);
            expect(navigateExternal).toHaveBeenCalledWith(new URL('https://example.com/'));
        });
    });
    describe('lazy loading', () => {
        it('should lazy load components', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'lazy',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Lazy Loaded')))())
                        })
                    },
                ], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.navigate('/lazy');
            await delay(50);
            expect(router.state.current?.path).toBe('/lazy');
            expect(outlet.textContent).toBe('Lazy Loaded');
        });
        it('should lazy load components with default export', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'lazy-default',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve({
                                default: createComponent('Lazy Default')
                            }))())
                        })
                    },
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.navigate('/lazy-default');
            await delay(50);
            expect(outlet.textContent).toBe('Lazy Default');
        });
        it('should handle lazy loading errors', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'error',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.reject(new Error('Load failed')))())
                        })
                    },
                ], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.navigate('/error');
            await delay(50);
            expect(router.state.phase).toBeNull();
            expect(router.state.error).toBeDefined();
            expect((router.state.error as Error).message).toBe('Load failed');
        });
    });
    describe('history management', () => {
        it('should handle back navigation', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                    {
                        path: 'users/:id',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('User')))())
                        })
                    },
                ], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.navigate('/about');
            await delay(50);
            router.navigate('/users/123');
            await delay(50);
            router.back();
            await delay(50);
            expect(router.state.current?.path).toBe('/about');
        });
        it('should handle forward navigation', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                    {
                        path: 'users/:id',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('User')))())
                        })
                    },
                ], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.navigate('/about');
            await delay(50);
            router.navigate('/users/123');
            await delay(50);
            router.back();
            await delay(50);
            router.forward();
            await delay(50);
            expect(router.state.current?.path).toBe('/users/123');
        });
        it('should handle popstate events', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.navigate('/about');
            await delay(50);
            // Simulate popstate
            window.history.back();
            const popstateEvent = new PopStateEvent('popstate');
            window.dispatchEvent(popstateEvent);
            await delay(50);
            expect(router.state.current?.path).toBe('/');
        });
        it('should scroll to the top after programmatic navigation when configured', async () => {
            let scrollX = 24;
            let scrollY = 160;
            spyOnProperty(window, 'scrollX', 'get').and.callFake(() => scrollX);
            spyOnProperty(window, 'scrollY', 'get').and.callFake(() => scrollY);
            const scrollToSpy = spyOn(window, 'scrollTo').and.callFake((x?: number | ScrollToOptions, y?: number) => {
                if (typeof x === 'number') {
                    scrollX = x;
                    scrollY = y ?? 0;
                }
            });
            router = createRouter({
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
                scrollRestoration: 'top'
            });
            router.start();
            await router.navigate('/about');
            expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
        });
        it('should restore the saved scroll position on popstate when configured', async () => {
            let scrollX = 30;
            let scrollY = 140;
            spyOnProperty(window, 'scrollX', 'get').and.callFake(() => scrollX);
            spyOnProperty(window, 'scrollY', 'get').and.callFake(() => scrollY);
            const scrollToSpy = spyOn(window, 'scrollTo').and.callFake((x?: number | ScrollToOptions, y?: number) => {
                if (typeof x === 'number') {
                    scrollX = x;
                    scrollY = y ?? 0;
                }
            });
            router = createRouter({
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
                scrollRestoration: 'restore'
            });
            router.start();
            await router.navigate('/about');
            scrollX = 320;
            scrollY = 480;
            window.history.back();
            const popstateEvent = new PopStateEvent('popstate');
            window.dispatchEvent(popstateEvent);
            await delay(50);
            expect(scrollToSpy).toHaveBeenCalledWith(30, 140);
            expect(router.state.current?.path).toBe('/');
        });
        it('should restore active URL on blocked navigation', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    {
                        path: 'blocked',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Blocked')))()),
                            canActivate: [() => false]
                        })
                    },
                ], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            // First navigate to home to have a current route
            await router.navigate('/', { state: { page: 'home' } });
            const replaceStateSpy = spyOn(window.history, 'replaceState').and.callThrough();
            await router.navigate('/blocked', { state: { page: 'blocked' } });
            expect(replaceStateSpy).toHaveBeenCalledWith({ page: 'home' }, '', '/');
            expect(router.state.current?.path).toBe('/');
            expect(router.state.historyState).toEqual({ page: 'home' });
        });
        it('should run view transitions for DOM commits when enabled', async () => {
            const transitionDocument = document as Document & {
                startViewTransition?: (callback: () => void | PromiseLike<void>) => {
                    finished: Promise<void>;
                };
            };
            const original = transitionDocument.startViewTransition;
            const startViewTransition = jasmine.createSpy('startViewTransition')
                .and.callFake((callback: () => void | PromiseLike<void>) => {
                void callback();
                return { finished: Promise.resolve() };
            });
            transitionDocument.startViewTransition = startViewTransition;
            try {
                router = createRouter({
                    routes: [
                        routeWithComponent('', 'Home'),
                        routeWithComponent('about', 'About'),
                    ],
                    viewTransitions: true
                });
                await router.navigate('/about');
                expect(startViewTransition).toHaveBeenCalled();
            }
            finally {
                transitionDocument.startViewTransition = original;
            }
        });
        it('should allow a route to opt into view transitions', async () => {
            const transitionDocument = document as Document & {
                startViewTransition?: (callback: () => void | PromiseLike<void>) => {
                    finished: Promise<void>;
                };
            };
            const original = transitionDocument.startViewTransition;
            const startViewTransition = jasmine.createSpy('startViewTransition')
                .and.callFake((callback: () => void | PromiseLike<void>) => {
                void callback();
                return { finished: Promise.resolve() };
            });
            transitionDocument.startViewTransition = startViewTransition;
            try {
                router = createRouter({
                    routes: [
                        routeWithComponent('', 'Home'),
                        {
                            path: 'about',
                            viewTransition: true,
                            load: async () => ({
                                component: unwrapTestComponent(await (() => Promise.resolve(createComponent('About')))())
                            })
                        },
                    ], render: (name, node) => {
                        outlet.replaceChildren(node);
                    },
                });
                await router.navigate('/about');
                expect(startViewTransition).toHaveBeenCalled();
            }
            finally {
                transitionDocument.startViewTransition = original;
            }
        });
        it('should allow a route to opt out of global view transitions', async () => {
            const transitionDocument = document as Document & {
                startViewTransition?: (callback: () => void | PromiseLike<void>) => {
                    finished: Promise<void>;
                };
            };
            const original = transitionDocument.startViewTransition;
            const startViewTransition = jasmine.createSpy('startViewTransition')
                .and.callFake((callback: () => void | PromiseLike<void>) => {
                void callback();
                return { finished: Promise.resolve() };
            });
            transitionDocument.startViewTransition = startViewTransition;
            try {
                router = createRouter({
                    routes: [
                        routeWithComponent('', 'Home'),
                        {
                            path: 'about',
                            viewTransition: false,
                            load: async () => ({
                                component: unwrapTestComponent(await (() => Promise.resolve(createComponent('About')))())
                            })
                        },
                    ], render: (name, node) => {
                        outlet.replaceChildren(node);
                    },
                    viewTransitions: true
                });
                await router.navigate('/about');
                expect(startViewTransition).not.toHaveBeenCalled();
            }
            finally {
                transitionDocument.startViewTransition = original;
            }
        });
        it('should evaluate the view transition predicate against navigation context', async () => {
            const transitionDocument = document as Document & {
                startViewTransition?: (callback: () => void | PromiseLike<void>) => {
                    finished: Promise<void>;
                };
            };
            const original = transitionDocument.startViewTransition;
            const startViewTransition = jasmine.createSpy('startViewTransition')
                .and.callFake((callback: () => void | PromiseLike<void>) => {
                void callback();
                return { finished: Promise.resolve() };
            });
            const predicate = jasmine.createSpy('predicate')
                .and.callFake((context: {
                from: {
                    path: string;
                } | null;
                to: {
                    path: string;
                } | null;
                phase: string;
                url: URL;
            }) => context.to?.path === '/about' && context.phase === 'success');
            transitionDocument.startViewTransition = startViewTransition;
            try {
                router = createRouter({
                    routes: [
                        routeWithComponent('', 'Home'),
                        routeWithComponent('about', 'About'),
                        routeWithComponent('settings', 'Settings'),
                    ],
                    viewTransitions: predicate
                });
                await router.navigate('/about');
                await router.navigate('/settings');
                const [firstCall] = predicate.calls.allArgs();
                const [firstContext] = firstCall as [
                    {
                        from: {
                            path: string;
                        } | null;
                        to: {
                            path: string;
                        } | null;
                        phase: string;
                        url: URL;
                    }
                ];
                expect(firstContext.from).toBeNull();
                expect(firstContext.to?.path).toBe('/about');
                expect(firstContext.phase).toBe('success');
                expect(firstContext.url.pathname).toBe('/about');
                expect(startViewTransition).toHaveBeenCalledTimes(1);
            }
            finally {
                transitionDocument.startViewTransition = original;
            }
        });
        it('should preload flat lazy routes eagerly when configured', async () => {
            const aboutLoader = jasmine.createSpy('aboutLoader')
                .and.returnValue(Promise.resolve(createComponent('About')));
            const settingsLoader = jasmine.createSpy('settingsLoader')
                .and.returnValue(Promise.resolve(createComponent('Settings')));

            router = createRouter({
                routes: [
                    {
                        path: 'about',
                        load: async () => ({
                            component: unwrapTestComponent(await aboutLoader())
                        })
                    },
                    {
                        path: 'settings',
                        load: async () => ({
                            component: unwrapTestComponent(await settingsLoader())
                        })
                    },
                ], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
                preloading: 'eager'
            });

            router.start();
            await delay(50);

            expect(aboutLoader).toHaveBeenCalledTimes(1);
            expect(settingsLoader).toHaveBeenCalledTimes(1);
        });
        it('should clear stale error state on blocked navigation', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    {
                        path: 'broken'
                    },
                    {
                        path: 'blocked',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Blocked')))()),
                            canActivate: [() => false]
                        })
                    },
                ],
                outlet
            };
            router = createRouter(config);
            router.start();
            router.navigate('/broken');
            await delay(50);
            expect(router.state.error).toBeDefined();
            router.navigate('/');
            await delay(50);
            router.navigate('/blocked');
            await delay(50);
            expect(router.state.error).toBeNull();
            expect(router.state.current?.path).toBe('/');
        });
    });
    describe('click interception', () => {
        it('should intercept anchor clicks', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            const link = document.createElement('a');
            link.href = '/about';
            link.textContent = 'About';
            document.body.appendChild(link);
            const defaultPrevented = dispatchAnchorClick(link);
            await delay(50);
            expect(defaultPrevented).toBeTrue();
            expect(router.state.current?.path).toBe('/about');
            document.body.removeChild(link);
        });
        it('should not intercept external links', () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            const link = document.createElement('a');
            link.href = 'https://example.com';
            link.textContent = 'External';
            document.body.appendChild(link);
            const defaultPrevented = dispatchAnchorClick(link);
            // Router should not intercept external links
            expect(defaultPrevented).toBeFalse();
            document.body.removeChild(link);
        });
        it('should not intercept links with modifier keys', () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            const link = document.createElement('a');
            link.href = '/about';
            link.textContent = 'About';
            document.body.appendChild(link);
            const defaultPrevented = dispatchAnchorClick(link, { metaKey: true });
            expect(defaultPrevented).toBeFalse();
            document.body.removeChild(link);
        });
        it('should not intercept links with download attribute', () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            const link = document.createElement('a');
            link.href = '/about';
            link.download = 'file';
            document.body.appendChild(link);
            const defaultPrevented = dispatchAnchorClick(link);
            expect(defaultPrevented).toBeFalse();
            document.body.removeChild(link);
        });
        it('should not intercept links with external rel', () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            const link = document.createElement('a');
            link.href = '/about';
            link.rel = 'external';
            document.body.appendChild(link);
            const defaultPrevented = dispatchAnchorClick(link);
            expect(defaultPrevented).toBeFalse();
            document.body.removeChild(link);
        });
        it('should handle hash-only links', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            // Navigate to about first
            router.navigate('/about');
            await delay(50);
            // Click on a hash link from the same page
            const link = document.createElement('a');
            link.href = '#section';
            link.textContent = 'Section';
            document.body.appendChild(link);
            const defaultPrevented = dispatchAnchorClick(link);
            // The router should NOT prevent default for hash-only links
            expect(defaultPrevented).toBeFalse();
            document.body.removeChild(link);
        });
    });
    describe('state management', () => {
        it('should expose current route state', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.navigate('/about');
            await delay(50);
            expect(router.state.path).toBe('/about');
            expect(router.state.params).toEqual({});
            expect(router.state.query).toEqual({});
            expect(router.state.routeConfig).toBeDefined();
            expect(router.state.pending).toBeFalse();
            expect(router.state.phase).toBeNull();
        });
        it('should expose a base-stripped path when baseHref is configured', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                ],
                baseHref: '/app/',
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.navigate('/app/about');
            await delay(50);
            expect(router.state.path).toBe('/about');
            expect(router.state.current?.path).toBe('/about');
            expect(router.state.current?.url.pathname).toBe('/app/about');
        });
        it('should track navigation phase', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'async',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Async')))()),
                            prepare: [async () => {
                                    await delay(30);
                                    return { data: 'data' };
                                }]
                        })
                    },
                ], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.navigate('/async');
            // Check that phase changes
            expect(router.state.phase).toBeDefined();
            await delay(50);
            expect(router.state.phase).toBeNull();
        });
        it('should track pending state during navigation', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'async',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Async')))()),
                            prepare: [async () => {
                                    await delay(30);
                                    return { data: 'data' };
                                }]
                        })
                    },
                ], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            expect(router.state.pending).toBeFalse();
            router.navigate('/async');
            // Should be pending during navigation
            expect(router.state.pending).toBeTrue();
            await delay(50);
            expect(router.state.pending).toBeFalse();
        });
        it('should expose error state on navigation failure', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'error',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.reject(new Error('Component failed')))())
                        })
                    },
                ],
                outlet
            };
            router = createRouter(config);
            router.start();
            router.navigate('/error');
            await delay(50);
            expect(router.state.error).toBeDefined();
            expect((router.state.error as Error).message).toBe('Component failed');
        });
    });
    describe('lifecycle', () => {
        it('should start and stop the router', () => {
            const config: VanillaRouterConfig = {
                routes: [routeWithComponent('', 'Home')],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            expect(router.state.pending).toBeFalse();
            router.stop();
            expect(router.state.current).toBeNull();
            expect(router.state.pending).toBeFalse();
        });
        it('should prevent starting a disposed router', () => {
            const config: VanillaRouterConfig = {
                routes: [routeWithComponent('', 'Home')],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.dispose();
            expect(() => {
                router.start();
            }).toThrowError(/Cannot start a disposed router/);
        });
        it('should prevent navigation after disposal', () => {
            const config: VanillaRouterConfig = {
                routes: [routeWithComponent('', 'Home')],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.dispose();
            expect(() => {
                router.navigate('/about');
            }).toThrowError(/Cannot navigate with a disposed router/);
        });
        it('should clean up event listeners on dispose', () => {
            const config: VanillaRouterConfig = {
                routes: [routeWithComponent('', 'Home')],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            const removeEventListenerSpy = spyOn(window, 'removeEventListener').and.callThrough();
            const documentRemoveSpy = spyOn(document, 'removeEventListener').and.callThrough();
            router = createRouter(config);
            router.start();
            router.dispose();
            expect(removeEventListenerSpy).toHaveBeenCalledWith('popstate', jasmine.any(Function));
            expect(documentRemoveSpy).toHaveBeenCalledWith('click', jasmine.any(Function));
        });
        it('should stop navigation on dispose', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'slow',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Slow')))()),
                            prepare: [async () => {
                                    await delay(100);
                                    return { data: 'data' };
                                }]
                        })
                    },
                ],
            };
            router = createRouter(config);
            router.start();
            router.navigate('/slow');
            // Dispose while navigation is in progress
            router.dispose();
            // The navigation should be cancelled
            expect(router.state.phase).toBeNull();
        });
        it('should dispose the active component when navigating away', async () => {
            let disposedComponent = false;
            let abortedSignal = false;
            let attachedAtDisposal = false;
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'first',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve((_route, { destroySignal }) => {
                                destroySignal.addEventListener('abort', () => {
                                    abortedSignal = true;
                                }, { once: true });
                                const node = document.createElement('div');
                                node.textContent = 'First';
                                return {
                                    node,
                                    dispose: () => {
                                        disposedComponent = true;
                                        attachedAtDisposal = node.parentElement === outlet;
                                    }
                                };
                            }))())
                        })
                    },
                    routeWithComponent('second', 'Second'),
                ],
                outlet
            };
            router = createRouter(config);
            router.start();
            router.navigate('/first');
            await delay(50);
            router.navigate('/second');
            await delay(50);
            expect(disposedComponent).toBeTrue();
            expect(abortedSignal).toBeTrue();
            expect(attachedAtDisposal).toBeTrue();
            expect(router.state.current?.path).toBe('/second');
        });
    });
    describe('utility methods', () => {
        it('should generate href with baseHref', () => {
            const config: VanillaRouterConfig = {
                routes: [routeWithComponent('', 'Home')],
                baseHref: '/app/',
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            expect(router.href('/about')).toBe('/app/about');
            expect(router.href('about')).toBe('/app/about');
        });
        it('should generate href with query parameters', () => {
            const config: VanillaRouterConfig = {
                routes: [routeWithComponent('', 'Home')],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            expect(router.href('/about?foo=bar')).toBe('/about?foo=bar');
        });
        it('should resolve relative hrefs from the current location inside baseHref', () => {
            window.history.replaceState(null, '', '/app/section/');
            const config: VanillaRouterConfig = {
                routes: [routeWithComponent('', 'Home')],
                baseHref: '/app/',
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            expect(router.href('child')).toBe('/app/section/child');
        });
        it('should resolve relative hrefs from the current location at the root baseHref', () => {
            window.history.replaceState(null, '', '/dashboard/profile');
            const config: VanillaRouterConfig = {
                routes: [routeWithComponent('', 'Home')],
                baseHref: '/',
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            expect(router.href('settings')).toBe('/dashboard/settings');
        });
        it('should create links with correct href', () => {
            const config: VanillaRouterConfig = {
                routes: [routeWithComponent('', 'Home')],
                baseHref: '/app/',
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            const link = router.createLink('/about', 'About', 'nav-link');
            expect(link.tagName).toBe('A');
            expect(link.textContent).toBe('About');
            expect(link.className).toBe('nav-link');
            expect(link.href).toContain('/app/about');
        });
        it('should create links without className', () => {
            const config: VanillaRouterConfig = {
                routes: [routeWithComponent('', 'Home')],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            const link = router.createLink('/about', 'About');
            expect(link.tagName).toBe('A');
            expect(link.textContent).toBe('About');
            expect(link.className).toBe('');
        });
    });
    describe('error handling', () => {
        it('should handle route with no component', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'broken'
                    },
                ], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.navigate('/broken');
            await delay(50);
            expect(router.state.phase).toBeNull();
            expect(router.state.error).toBeDefined();
            expect((router.state.error as Error).message).toContain('no component');
        });
        it('should use custom renderError on initial navigation failure', async () => {
            let errorRendered = false;
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'broken'
                    },
                ], render: (name, node) => {
                    outlet.replaceChildren(node);
                }, renderError: (outletName: string, error: unknown) => {
                    errorRendered = true;
                    outlet.textContent = 'Custom Error: ' + (error as Error).message;
                }
            };
            router = createRouter(config);
            router.start();
            router.navigate('/broken');
            await delay(50);
            expect(errorRendered).toBeTrue();
            expect(outlet.textContent).toContain('Custom Error');
        });
        it('should synchronize state and outlet on navigation error', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    {
                        path: 'broken'
                    },
                ], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            // Navigate to home first
            router.navigate('/');
            await delay(50);
            expect(outlet.textContent).toBe('Home');
            // Try to navigate to broken route
            router.navigate('/broken');
            await delay(50);
            expect(outlet.textContent).toContain('Page failed to load');
            expect(router.state.current).toBeNull();
            expect(router.state.error).toBeDefined();
        });
        it('should treat named AbortError failures as aborted navigations', async () => {
            let markStarted!: () => void;
            const started = new Promise<void>(resolve => {
                markStarted = resolve;
            });
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    {
                        path: 'slow',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Slow')))()),
                            prepare: [async ({ signal }) => {
                                    markStarted();
                                    await new Promise<void>((_resolve, reject) => {
                                        signal.addEventListener('abort', () => {
                                            const error = new Error('aborted');
                                            error.name = 'AbortError';
                                            reject(error);
                                        }, { once: true });
                                    });
                                    return { data: 'slow' };
                                }]
                        })
                    },
                ],
            };
            router = createRouter(config);
            router.start();
            router.navigate('/slow');
            await started;
            router.navigate('/');
            await delay(50);
            expect(router.state.error).toBeNull();
            expect(router.state.current?.path).toBe('/');
        });
        it('should handle guard errors', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'error',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Error')))()),
                            canActivate: [
                                () => {
                                    throw new Error('Guard failed');
                                },
                            ]
                        })
                    },
                ],
                outlet
            };
            router = createRouter(config);
            router.start();
            router.navigate('/error');
            await delay(50);
            expect(router.state.error).toBeDefined();
            expect((router.state.error as Error).message).toBe('Guard failed');
        });
        it('should handle prepare errors', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'error',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Error')))()),
                            prepare: [() => {
                                throw new Error('Prepare failed');
                            }]
                        })
                    },
                ],
            };
            router = createRouter(config);
            router.start();
            router.navigate('/error');
            await delay(50);
            expect(router.state.error).toBeDefined();
            expect((router.state.error as Error).message).toBe('Prepare failed');
        });
    });
    describe('tracing', () => {
        it('should log debug messages when tracing is enabled', () => {
            const debugSpy = console.debug as jasmine.Spy;
            debugSpy.calls.reset();
            const config: VanillaRouterConfig = {
                routes: [routeWithComponent('', 'Home')],
                enableTracing: true, render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.navigate('/about');
            router.dispose();
            expect(debugSpy).toHaveBeenCalled();
        });
        it('should not log debug messages when tracing is disabled', () => {
            const debugSpy = console.debug as jasmine.Spy;
            debugSpy.calls.reset();
            const config: VanillaRouterConfig = {
                routes: [routeWithComponent('', 'Home')],
                enableTracing: false, render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.navigate('/about');
            router.dispose();
            expect(debugSpy).not.toHaveBeenCalled();
        });
    });
    describe('replace method', () => {
        it('should navigate with replace option', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            const replaceSpy = spyOn(window.history, 'replaceState').and.callThrough();
            router.replace('/about');
            await delay(50);
            expect(replaceSpy).toHaveBeenCalled();
            expect(router.state.current?.path).toBe('/about');
        });
        it('should navigate with replace option and state', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            const replaceSpy = spyOn(window.history, 'replaceState').and.callThrough();
            router.replace('/about', { from: 'test' });
            await delay(50);
            expect(replaceSpy).toHaveBeenCalledWith({ from: 'test' }, '', '/about');
        });
    });
    describe('baseHref handling', () => {
        it('should strip baseHref from URL for routing', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                ],
                baseHref: '/app/',
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.navigate('/app/about');
            await delay(50);
            expect(router.state.current?.path).toBe('/about');
            expect(router.state.current?.url.pathname).toBe('/app/about');
            expect(outlet.textContent).toBe('About');
        });
        it('should reject navigation outside baseHref', () => {
            const config: VanillaRouterConfig = {
                routes: [routeWithComponent('', 'Home')],
                baseHref: '/app/',
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            expect(() => {
                router.navigate('/outside');
            }).toThrowError(/outside router base/);
        });
        it('should handle baseHref with root path', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                ],
                baseHref: '/',
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.navigate('/about');
            await delay(50);
            expect(router.state.current?.path).toBe('/about');
            expect(outlet.textContent).toBe('About');
        });
        it('should navigate relative URLs from the current location at the root baseHref', async () => {
            window.history.replaceState(null, '', '/dashboard/profile');
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('dashboard/profile', 'Profile'),
                    routeWithComponent('dashboard/settings', 'Settings'),
                ],
                baseHref: '/',
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            await delay(50);
            router.navigate('settings');
            await delay(50);
            expect(router.state.current?.path).toBe('/dashboard/settings');
            expect(router.state.current?.url.pathname).toBe('/dashboard/settings');
            expect(outlet.textContent).toBe('Settings');
        });
        it('should handle absolute URLs within baseHref', () => {
            const config: VanillaRouterConfig = {
                routes: [routeWithComponent('', 'Home')],
                baseHref: '/app/',
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            // Should create href with baseHref
            expect(router.href('/app/about')).toBe('/app/about');
            expect(router.href('about')).toBe('/app/about');
        });
        it('should navigate relative URLs from the current baseHref location', async () => {
            window.history.replaceState(null, '', '/app/section/');
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('section', 'Section'),
                    routeWithComponent('section/child', 'Child'),
                ],
                baseHref: '/app/',
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.navigate('child');
            await delay(50);
            expect(router.state.current?.path).toBe('/section/child');
            expect(router.state.current?.url.pathname).toBe('/app/section/child');
            expect(outlet.textContent).toBe('Child');
        });
    });
    describe('renderNotFound', () => {
        it('should call renderNotFound when route is not found', async () => {
            let notFoundCalled = false;
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                }, renderNotFound: (outletName: string, _url: URL) => {
                    notFoundCalled = true;
                    outlet.textContent = 'Custom 404';
                }
            };
            router = createRouter(config);
            router.start();
            router.navigate('/non-existent');
            await delay(50);
            expect(notFoundCalled).toBeTrue();
            expect(outlet.textContent).toBe('Custom 404');
            expect(router.state.phase).toBeNull();
            expect(router.state.error).toBeNull();
            expect(router.state.current).toBeNull();
        });
        it('should use default renderNotFound when not provided', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.navigate('/non-existent');
            await delay(50);
            expect(outlet.textContent).toBe('404 — Page Not Found');
        });
        it('should clear the current route when rendering not found', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.navigate('/');
            await delay(50);
            expect(router.state.current?.path).toBe('/');
            router.navigate('/non-existent');
            await delay(50);
            expect(router.state.current).toBeNull();
            expect(router.state.path).toBe('');
        });
    });
    describe('grouped named outlets', () => {
        function groupedRoute(): Route {
            return {
                path: 'project/:id',
                load: async () => ({
                    component: () => document.createTextNode('Primary')
                }),
                outlets: [{
                    path: 'project/:id',
                    outlet: 'sidebar',
                    load: async () => ({
                        component: () => document.createTextNode('Sidebar')
                    })
                }]
            };
        }

        it('should prepare and commit the complete outlet group', async () => {
            const primary = document.createElement('div');
            const sidebar = document.createElement('div');
            const committed: string[][] = [];

            router = createRouter({
                routes: [groupedRoute()],
                commit: outlets => {
                    committed.push(outlets.map(current => current.name));
                    for (const current of outlets) {
                        (current.name === 'sidebar' ? sidebar : primary)
                            .replaceChildren(current.node);
                    }
                }
            });

            expect(await router.navigate('/project/42')).toBeTrue();
            expect(committed).toEqual([['', 'sidebar']]);
            expect(primary.textContent).toBe('Primary');
            expect(sidebar.textContent).toBe('Sidebar');
            expect(router.state.params).toEqual({ id: '42' });
        });

        it('should reject malformed groups before navigation starts', () => {
            expect(() => createRouter({
                routes: [{
                    path: 'project',
                    load: async () => ({ component: createComponent('Primary') }),
                    outlets: [{
                        path: 'other',
                        outlet: 'sidebar',
                        load: async () => ({ component: createComponent('Sidebar') })
                    }]
                }]
            })).toThrowError(/must use the primary path/);

            expect(() => createRouter({
                routes: [{
                    path: 'project',
                    load: async () => ({ component: createComponent('Primary') }),
                    outlets: [
                        {
                            path: 'project',
                            outlet: 'sidebar',
                            load: async () => ({ component: createComponent('One') })
                        },
                        {
                            path: 'project',
                            outlet: 'sidebar',
                            load: async () => ({ component: createComponent('Two') })
                        }
                    ]
                }]
            })).toThrowError(/Duplicate outlet/);
        });

        it('should reject URL parsers declared by a secondary outlet', async () => {
            router = createRouter({
                routes: [{
                    path: 'project/:id',
                    load: async () => ({ component: createComponent('Primary') }),
                    outlets: [{
                        path: 'project/:id',
                        outlet: 'sidebar',
                        load: async () => ({
                            component: createComponent('Sidebar'),
                            parseParams: params => params
                        })
                    }]
                }],
                commit: () => undefined
            });

            expect(await router.navigate('/project/42')).toBeFalse();
            expect((router.state.error as Error).message)
                .toContain('cannot define parseParams or parseQuery');
        });

        it('should preload every member of an enabled route group', async () => {
            const primaryLoad = jasmine.createSpy('primaryLoad').and.resolveTo({
                component: createComponent('Primary')
            });
            const sidebarLoad = jasmine.createSpy('sidebarLoad').and.resolveTo({
                component: createComponent('Sidebar')
            });

            router = createRouter({
                routes: [{
                    path: 'project',
                    load: primaryLoad,
                    outlets: [{
                        path: 'project',
                        outlet: 'sidebar',
                        load: sidebarLoad
                    }]
                }]
            });

            await router.preload();
            expect(primaryLoad).toHaveBeenCalledTimes(1);
            expect(sidebarLoad).toHaveBeenCalledTimes(1);
        });

        it('should preserve the active route when a later group fails to prepare', async () => {
            const primary = document.createElement('div');
            router = createRouter({
                routes: [
                    routeWithComponent('stable', 'Stable'),
                    {
                        path: 'broken',
                        load: async () => ({ component: createComponent('Broken') }),
                        outlets: [{
                            path: 'broken',
                            outlet: 'sidebar',
                            load: async () => { throw new Error('Sidebar failed'); }
                        }]
                    }
                ],
                commit: outlets => {
                    primary.replaceChildren(outlets[0].node);
                }
            });

            expect(await router.navigate('/stable')).toBeTrue();
            expect(primary.textContent).toBe('Stable');
            expect(await router.navigate('/broken')).toBeFalse();
            expect(router.state.current?.path).toBe('/stable');
            expect(primary.textContent).toBe('Stable');
            expect((router.state.error as Error).message).toBe('Sidebar failed');
        });

        it('should dispose all staged views when the group commit throws', async () => {
            const destroyed: boolean[] = [];
            router = createRouter({
                routes: [{
                    path: 'project',
                    load: async () => ({
                        component: (_route, context) => {
                            context.destroySignal.addEventListener('abort', () => destroyed.push(true));
                            return document.createTextNode('Primary');
                        }
                    }),
                    outlets: [{
                        path: 'project',
                        outlet: 'sidebar',
                        load: async () => ({
                            component: (_route, context) => {
                                context.destroySignal.addEventListener('abort', () => destroyed.push(true));
                                return document.createTextNode('Sidebar');
                            }
                        })
                    }]
                }],
                commit: () => { throw new Error('Commit failed'); }
            });

            expect(await router.navigate('/project')).toBeFalse();
            expect(destroyed.length).toBe(2);
            expect((router.state.error as Error).message).toBe('Commit failed');
        });

        it('should run native view transitions for grouped named outlet commits', async () => {
            const transitionDocument = document as Document & {
                startViewTransition?: (callback: () => void | PromiseLike<void>) => {
                    finished: Promise<void>;
                };
            };
            const original = transitionDocument.startViewTransition;
            const startViewTransition = jasmine.createSpy('startViewTransition')
                .and.callFake((callback: () => void | PromiseLike<void>) => {
                void callback();
                return { finished: Promise.resolve() };
            });
            transitionDocument.startViewTransition = startViewTransition;

            try {
                router = createRouter({
                    routes: [groupedRoute()],
                    viewTransitions: true,
                    commit: outlets => {
                        for (const current of outlets) {
                            (current.name === 'sidebar' ? document.createElement('div') : outlet)
                                .replaceChildren(current.node);
                        }
                    }
                });

                expect(await router.navigate('/project/42')).toBeTrue();
                expect(startViewTransition).toHaveBeenCalled();
            }
            finally {
                transitionDocument.startViewTransition = original;
            }
        });
    });

});
````

## File: src/tests/typed-navigation.spec.ts
````typescript
import {
  layout,
  route,
  s,
  type NavigationTree,
  type Router,
} from '@epikodelabs/routty';

class DashboardLayout {}
class DashboardPage {}
class SettingsPage {}

const dashboardRoute = route('/dashboard/:projectId', DashboardPage, {
  name: 'dashboard',
  paramsSchema: {
    projectId: s.number({ min: 1 }),
  },
  querySchema: {
    tab: s.string('overview'),
    page: s.number({ default: 1, min: 1 }),
    filters: s.array(),
    draft: s.optional(s.boolean()),
  },
});

const settingsRoute = route('/settings', SettingsPage, {
  name: 'settings',
  querySchema: {
    section: s.string('general'),
  },
});

const routes = [
  layout('/app', DashboardLayout, [
    settingsRoute,
    dashboardRoute,
  ]),
] as const satisfies NavigationTree;

function assertNamedNavigation(router: Router<typeof routes>): void {
  void router.navigateTo.dashboard({
    params: { projectId: 123 },
  });

  void router.navigateTo.dashboard({
    params: { projectId: 123 },
    query: {
      tab: 'settings',
      page: 2,
      filters: ['a', 'b'],
      draft: true,
    },
  });

  void router.navigateTo.settings({
    query: { section: 'billing' },
  });

  const href = router.hrefTo.dashboard({
    params: { projectId: 123 },
    query: { tab: 'overview' },
  });

  const typedHref: string | null = href;
  void typedHref;

  // @ts-expect-error route name must exist in the configured layout tree
  void router.navigateTo.missing();
}

describe('typed routes typings', () => {
  it('discovers named leaf routes nested inside layouts', () => {
    expect(typeof assertNamedNavigation).toBe('function');
  });
});
````

## File: src/public-api.ts
````typescript
/** Public API surface of the routing library. */
export * from './lib';
````

## File: ng-package.json
````json
{
  "$schema": "../../../node_modules/ng-packagr/ng-package.schema.json",
  "dest": "../../../dist/routty",
  "lib": {
    "entryFile": "src/public-api.ts"
  }
}
````

## File: tsconfig.lib.json
````json
/* To learn more about Typescript configuration file: https://www.typescriptlang.org/docs/handbook/tsconfig-json.html. */
/* To learn more about Angular compiler options: https://angular.dev/reference/configs/angular-compiler-options. */
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "../../../out-tsc/lib",
    "declaration": true,
    "declarationMap": true,
    "types": []
  },
  "include": [
    "src/**/*.ts"
  ],
  "exclude": [
    "**/*.spec.ts"
  ]
}
````

## File: tsconfig.lib.prod.json
````json
/* To learn more about Typescript configuration file: https://www.typescriptlang.org/docs/handbook/tsconfig-json.html. */
/* To learn more about Angular compiler options: https://angular.dev/reference/configs/angular-compiler-options. */
{
  "extends": "./tsconfig.lib.json",
  "compilerOptions": {
    "declarationMap": false
  },
  "angularCompilerOptions": {
    "compilationMode": "partial"
  }
}
````

## File: tsconfig.spec.json
````json
/* To learn more about Typescript configuration file: https://www.typescriptlang.org/docs/handbook/tsconfig-json.html. */
/* To learn more about Angular compiler options: https://angular.dev/reference/configs/angular-compiler-options. */
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "../../../out-tsc/spec",
    "types": ["jasmine"]
  },
  "include": [
    "src/**/*.d.ts",
    "src/**/*.spec.ts"
  ]
}
````

## File: README.md
````markdown
# Routty

Routty is a typed Angular routing library for teams that want a smaller, clearer routing model — and honestly, a routing setup you enjoy opening back up six months later.

Most routing libraries spread a single route across several places: a path over here, a guard over there, data-loading somewhere else, and the component's actual behavior in a fourth file. Routty pulls all of that back together. Route matching, route identity, rendering, and lifecycle all live in one place, next to a flat route definition you can read top to bottom. No deep route tree to hold in your head — just explicit layouts, explicit routes, and function-based hooks that do exactly what they say.

If you've used Angular Router before, the shift is small but it pays off fast: fewer moving parts, fewer places to look when something breaks, and full type inference on your params, your query strings, and your generated links.

## Why Routty

Routty is a strong fit when you want:

- **Typed params and query values.** Declare a schema once and get real TypeScript types everywhere you read or generate a link — no more `params['id']` guesswork.
- **Readable route definitions that stay close to the feature.** A route and everything it needs to run — its guards, its data loading, its post-navigation behavior — sit in the same call, not scattered across a routing module.
- **Guards, preparation, and post-navigation behavior beside the route.** `beforeEnter`, `beforeLeave`, `prepare`, and `afterEnter` are just functions. Inject a service, check a condition, load some data — no special DSL to learn.
- **Layout composition and named outlets, without a deep route tree.** You get shell composition and companion outlets, without inheriting Angular Router's full nested-route model to get there.
- **A standalone-first Angular setup.** Built for the way modern Angular apps are actually structured today.

## Installation

```bash
npm install @epikodelabs/routty
```

Routty is built on standalone Angular APIs and is intended to work across recent Angular versions.

## Quick start

Here's a small, complete example. It's worth reading slowly once — every idea Routty has is visible somewhere in this one route.

```ts
import { inject } from '@angular/core';
import {
  frame,
  layout,
  provideRouter,
  route,
  s,
  type NavigationTree,
} from '@epikodelabs/routty';

const projectRoute = route(
  '/projects/:projectId',
  frame(ProjectPage, {
    beforeEnter: [
      () =>
        inject(SessionService).authenticated()
          ? true
          : { redirectTo: '/auth/login', replace: true },
    ],
    prepare: [
      context => ({
        project: inject(ProjectStore).load(
          Number(context.params['projectId'] ?? 0),
        ),
      }),
    ],
  }),
  {
    name: 'project',
    paramsSchema: {
      projectId: s.number({ min: 1 }),
    },
    querySchema: {
      tab: s.string('overview'),
    },
  },
);

export const routes = [
  layout('/app', AppShellComponent, [projectRoute]),
] as const satisfies NavigationTree;

export const appConfig = {
  providers: [...provideRouter(routes)],
};
```

Notice how the whole story is right there: the path, the component, the auth guard, the data it needs before it renders, and its typed params and query — all in one call to `route(...)`. Nothing about `/projects/:projectId` lives anywhere else.

In templates and standalone components, use `RouterLink` and `RouterOutlet` from Routty, the same way you would with Angular's built-in router.

## Core ideas

Routty is deliberately small. These four ideas cover essentially everything:

- **`path`** is the URL contract — what Routty matches against and what it generates when you build a link.
- **`name`** is the symbolic identity of a primary route, used for typed navigation so you can move around your app by name instead of by hand-built string.
- **`frame`** wraps a component with lifecycle behavior: `beforeEnter`, `beforeLeave`, `prepare`, and `afterEnter`. `lazyFrame(...)` does the same for a component that should be loaded on demand.
- **`layout`** composes a shell around a set of routes — navbars, side panels, anything that should wrap a group of pages. `lazyLayout(...)` is the code-split counterpart.

Named outlets are supported too, and they stay attached to a primary route and share its path, which keeps the mental model simple — a companion, not a second page:

```ts
route('/projects/:projectId', ProjectSidebarComponent, {
  outlet: 'sidebar',
})
```

### Typed params and queries, with `s`

The `s` helper builds small, declarative schemas: `s.string(default)`, `s.number({ min, max, default })`, `s.boolean(default)`, `s.array(default)`, `s.date(default)`, and `s.optional(schema)` for anything that shouldn't be required. Attach one to `paramsSchema` or `querySchema` on a route, and Routty handles parsing, defaulting, and — best of all — gives you the matching TypeScript type for free, everywhere that route is referenced.

## Included helpers

Beyond the pieces above, Routty also exports:

- `lazyRoute(...)` — a lazily-loaded route, same shape as `route(...)`
- `redirectRoute(...)` — a route that simply forwards elsewhere
- `RouterLink` — a directive for typed, template-friendly navigation
- `RouterOutlet` — where routes actually render
- typed `navigateTo` and `hrefTo` helpers on the router instance, for navigating and generating hrefs in code with full type safety

## Current scope

Routty is intentionally focused rather than feature-complete, and we think that's exactly what makes it pleasant to use. Today it's best suited to standalone Angular apps that want a typed, explicit routing layer without the weight of a full-featured router.

A few current boundaries worth knowing up front:

- no `RouterModule.forRoot()` or `RouterModule.forChild()` integration
- no `loadChildren` or lazy `NgModule` boundaries
- no Angular `Route` compatibility layer
- named outlets are subordinate to a primary route and can't behave like independent pages

None of these are accidents — they're the trade-offs that keep Routty small, typed, and easy to reason about. If your app needs the full breadth of Angular Router's feature set, this may not be the right layer yet. If it doesn't, Routty is built to feel great every day.

## Demo

See `projects/apps/app1/src/app/app.routes.ts` for a working reference with typed params, redirects, lazy routes, lifecycle hooks, and a coordinated `sidebar` outlet.

## Development

```bash
npm run build
npm test
```

We're actively growing Routty, and we're glad you're here for it.
````

## File: package.json
````json
{
  "name": "@epikodelabs/routty",
  "version": "1.0.1",
  "peerDependencies": {
    "@angular/common": ">=16.0.0",
    "@angular/core": ">=16.0.0"
  },
  "dependencies": {
    "tslib": "^2.8.1"
  },
  "sideEffects": false
}
````
