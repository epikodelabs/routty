import {
  layout,
  route,
  s,
} from '@epikodelabs/routty';

import { createRouteRegistry } from '../lib/route-compiler';

class TestPage {}
class TestLayout {}

describe('route compiler parameter validation', () => {
  it('rejects duplicate parameter names across layouts and leaf routes', () => {
    const routes = [
      layout('/teams/:id', TestLayout, [
        route('/members/:id', TestPage),
      ]),
    ] as const;

    expect(() => createRouteRegistry(routes)).toThrowError(
      /Duplicate path parameter ":id" in compiled route "\/teams\/:id\/members\/:id"/,
    );
  });

  it('rejects paramsSchema keys that are absent from the compiled path', () => {
    const routes = [
      route('/users/:userId', TestPage, {
        paramsSchema: {
          id: s.number(),
        },
      }),
    ] as const;

    expect(() => createRouteRegistry(routes)).toThrowError(
      /paramsSchema declares "id".*does not contain ":id"/,
    );
  });

  it('requires every path parameter to be declared when paramsSchema is present', () => {
    const routes = [
      route('/teams/:teamId/users/:userId', TestPage, {
        paramsSchema: {
          teamId: s.number(),
        },
      }),
    ] as const;

    expect(() => createRouteRegistry(routes)).toThrowError(
      /contains ":userId", but paramsSchema does not declare it/,
    );
  });

  it('accepts an exact paramsSchema for the compiled path', () => {
    const routes = [
      layout('/teams/:teamId', TestLayout, [
        route('/users/:userId', TestPage, {
          paramsSchema: {
            teamId: s.number(),
            userId: s.number(),
          },
        }),
      ]),
    ] as const;

    expect(() => createRouteRegistry(routes)).not.toThrow();
  });
});
