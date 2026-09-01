import {
  layout,
  route,
  s,
} from '@epikodelabs/routty';

import { createRouteRegistry } from '../lib/route-compiler';

class TestPage {}
class TestLayout {}
class TestSidebar {}

describe('route compiler', () => {
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

  it('rejects params keys that are absent from the compiled path', () => {
    const routes = [
      route('/users/:userId', TestPage, {
        params: {
          id: s.number(),
        } as any,
      }),
    ] as const;

    expect(() => createRouteRegistry(routes)).toThrowError(
      /params declares "id".*does not contain ":id"/,
    );
  });

  it('requires every path parameter when params is present', () => {
    const routes = [
      route('/teams/:teamId/users/:userId', TestPage, {
        params: {
          teamId: s.number(),
        } as any,
      }),
    ] as const;

    expect(() => createRouteRegistry(routes)).toThrowError(
      /contains ":userId", but params does not declare it/,
    );
  });

  it('accepts exact params for the compiled path', () => {
    const routes = [
      layout('/teams/:teamId', TestLayout, [
        route('/users/:userId', TestPage, {
          params: {
            teamId: s.number(),
            userId: s.number(),
          },
        }),
      ]),
    ] as const;

    expect(() => createRouteRegistry(routes)).not.toThrow();
  });

  it('expands authored named outlets into one compiled route group', () => {
    const registry = createRouteRegistry([
      route('/projects/:projectId', TestPage, {
        outlets: {
          sidebar: TestSidebar,
        },
      }),
    ] as const);

    expect(registry.groups.length).toBe(1);
    expect(registry.groups[0]?.outlets.length).toBe(1);
    const outlet = registry.groups[0]?.outlets[0]?.route;
    expect(outlet?.kind).toBe('route');
    expect(outlet?.kind === 'route' ? outlet.outlet : undefined).toBe('sidebar');
  });
});
