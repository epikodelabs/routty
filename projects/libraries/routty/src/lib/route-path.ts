export type RoutePathSegment =
  | {
      readonly kind: 'literal';
      readonly value: string;
    }
  | {
      readonly kind: 'parameter';
      readonly name: string;
    };

export interface CompiledRoutePath {
  readonly source: string;
  readonly segments: readonly RoutePathSegment[];
  readonly parameterNames: readonly string[];
  readonly patternKey: string;
}

const PARAMETER_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function splitRoutePath(path: string): readonly string[] {
  return Object.freeze(
    path
      .split('/')
      .filter(Boolean),
  );
}

export function joinRoutePath(
  parent: string,
  child: string,
): string {
  const joined = [
    ...splitRoutePath(parent),
    ...splitRoutePath(child),
  ].join('/');

  return joined ? `/${joined}` : '/';
}

export function compileRoutePath(path: string): CompiledRoutePath {
  const rawSegments = splitRoutePath(path);
  const parameterNames: string[] = [];

  const segments = rawSegments.map<RoutePathSegment>((segment) => {
    if (!segment.startsWith(':')) {
      return Object.freeze({
        kind: 'literal',
        value: segment,
      });
    }

    const name = segment.slice(1);
    if (!PARAMETER_NAME.test(name)) {
      throw new Error(
        `Invalid path parameter segment "${segment}" in route "${path}". ` +
        'Parameter names must match [A-Za-z_][A-Za-z0-9_]*.',
      );
    }

    parameterNames.push(name);
    return Object.freeze({
      kind: 'parameter',
      name,
    });
  });

  return Object.freeze({
    source: path,
    segments: Object.freeze(segments),
    parameterNames: Object.freeze(parameterNames),
    patternKey: segments
      .map(segment => segment.kind === 'parameter' ? ':' : segment.value)
      .join('/'),
  });
}

export function extractRouteParamNames(path: string): readonly string[] {
  return compileRoutePath(path).parameterNames;
}

function decodeRouteSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function matchRoutePath(
  pattern: CompiledRoutePath,
  path: string | readonly string[],
): Readonly<Record<string, string>> | null {
  const actualSegments =
    typeof path === 'string'
      ? splitRoutePath(path)
      : path;

  if (pattern.segments.length !== actualSegments.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let index = 0; index < pattern.segments.length; index++) {
    const expected = pattern.segments[index]!;
    const actual = actualSegments[index];

    if (actual === undefined) {
      return null;
    }

    if (expected.kind === 'parameter') {
      params[expected.name] = decodeRouteSegment(actual);
      continue;
    }

    if (expected.value !== actual) {
      return null;
    }
  }

  return Object.freeze(params);
}
