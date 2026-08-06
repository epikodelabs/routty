import type { Route } from '../lib/vanilla-router';
import {
  appendCatalogRoutes,
  createRouteCatalog,
  readCatalogRoutes,
  recognizeRoute,
  removeCatalogRoutes,
  replaceCatalogRoutes,
} from '../lib/route-catalog';

function route(path: string): Route {
  return {
    path,
    load: async () => ({
      component: () =>
        document.createTextNode(path),
    }),
  };
}

describe('RouteCatalog', () => {
  it('creates an immutable version-zero catalog', () => {
    const first = route('first');
    const catalog = createRouteCatalog([first]);

    expect(catalog.version).toBe(0);
    expect(Object.isFrozen(catalog)).toBeTrue();
    expect(Object.isFrozen(catalog.matchers)).toBeTrue();
    expect(readCatalogRoutes(catalog)).toEqual([first]);
  });

  it('returns an immutable route snapshot', () => {
    const first = route('first');
    const catalog = createRouteCatalog([first]);
    const snapshot =
      readCatalogRoutes(catalog) as Route[];

    expect(Object.isFrozen(snapshot)).toBeTrue();
    expect(() => snapshot.push(route('second')))
      .toThrow();
    expect(readCatalogRoutes(catalog)).toEqual([first]);
  });

  it('preserves identity and version for an empty append', () => {
    const catalog = createRouteCatalog([
      route('first'),
    ]);

    const next = appendCatalogRoutes(
      catalog,
      [],
    );

    expect(next).toBe(catalog);
    expect(next.version).toBe(0);
  });

  it('appends routes in order and increments the version once', () => {
    const first = route('first');
    const second = route('second');
    const third = route('third');
    const catalog = createRouteCatalog([first]);

    const next = appendCatalogRoutes(
      catalog,
      [second, third],
    );

    expect(next).not.toBe(catalog);
    expect(next.version).toBe(1);
    expect(readCatalogRoutes(next))
      .toEqual([first, second, third]);
  });

  it('rejects duplicate primary paths introduced by append', () => {
    const catalog = createRouteCatalog([
      route('same'),
    ]);

    expect(() => appendCatalogRoutes(
      catalog,
      [route('same')],
    )).toThrowError(
      /Duplicate primary route path "same"/,
    );
  });

  it('preserves identity when replacing with the same references in the same order', () => {
    const first = route('first');
    const second = route('second');
    const catalog = createRouteCatalog([
      first,
      second,
    ]);

    const next = replaceCatalogRoutes(
      catalog,
      [first, second],
    );

    expect(next).toBe(catalog);
    expect(next.version).toBe(0);
  });

  it('treats reordered references as a real replacement', () => {
    const first = route('first');
    const second = route('second');
    const catalog = createRouteCatalog([
      first,
      second,
    ]);

    const next = replaceCatalogRoutes(
      catalog,
      [second, first],
    );

    expect(next.version).toBe(1);
    expect(readCatalogRoutes(next))
      .toEqual([second, first]);
  });

  it('supports replacement with an empty catalog', () => {
    const catalog = createRouteCatalog([
      route('first'),
    ]);

    const next = replaceCatalogRoutes(
      catalog,
      [],
    );

    expect(next.version).toBe(1);
    expect(readCatalogRoutes(next)).toEqual([]);
    expect(recognizeRoute(next, '/first'))
      .toBeNull();
  });

  it('preserves identity when remove matches nothing', () => {
    const first = route('first');
    const catalog = createRouteCatalog([first]);

    const next = removeCatalogRoutes(
      catalog,
      candidate => candidate.path === 'missing',
    );

    expect(next).toBe(catalog);
    expect(next.version).toBe(0);
  });

  it('removes matching routes while preserving remaining order', () => {
    const first = route('first');
    const second = route('second');
    const third = route('third');
    const catalog = createRouteCatalog([
      first,
      second,
      third,
    ]);

    const next = removeCatalogRoutes(
      catalog,
      candidate => candidate === second,
    );

    expect(next.version).toBe(1);
    expect(readCatalogRoutes(next))
      .toEqual([first, third]);
  });

  it('recognizes exact routes and returns the original route reference', () => {
    const first = route('first');
    const catalog = createRouteCatalog([first]);

    const match = recognizeRoute(
      catalog,
      '/first',
    );

    expect(match?.route).toBe(first);
    expect(match?.params).toEqual({});
    expect(Object.isFrozen(match)).toBeTrue();
    expect(Object.isFrozen(match?.params))
      .toBeTrue();
  });

  it('extracts and decodes route parameters', () => {
    const user = route('users/:id');
    const catalog = createRouteCatalog([user]);

    const match = recognizeRoute(
      catalog,
      '/users/hello%20world',
    );

    expect(match?.route).toBe(user);
    expect(match?.params).toEqual({
      id: 'hello world',
    });
  });

  it('uses a wildcard only after every concrete route fails', () => {
    const fallback = route('**');
    const concrete = route('known');
    const catalog = createRouteCatalog([
      fallback,
      concrete,
    ]);

    expect(
      recognizeRoute(catalog, '/known')?.route,
    ).toBe(concrete);

    expect(
      recognizeRoute(catalog, '/unknown')?.route,
    ).toBe(fallback);
  });

  it('uses the last wildcard as the fallback', () => {
    const first = route('*');
    const second = route('**');
    const catalog = createRouteCatalog([
      first,
      second,
    ]);

    expect(
      recognizeRoute(catalog, '/missing')?.route,
    ).toBe(second);
  });

  it('refreshes a matcher when a concrete path changes', () => {
    const mutable = route('first');
    const catalog = createRouteCatalog([mutable]);

    expect(
      recognizeRoute(catalog, '/first')?.route,
    ).toBe(mutable);

    mutable.path = 'second';

    expect(
      recognizeRoute(catalog, '/first'),
    ).toBeNull();
    expect(
      recognizeRoute(catalog, '/second')?.route,
    ).toBe(mutable);
  });

  it('refreshes parameter extraction when a path shape changes', () => {
    const mutable = route('users/:id');
    const catalog = createRouteCatalog([mutable]);

    expect(
      recognizeRoute(
        catalog,
        '/users/7',
      )?.params,
    ).toEqual({ id: '7' });

    mutable.path = 'teams/:teamId/member/:memberId';

    expect(
      recognizeRoute(
        catalog,
        '/teams/core/member/42',
      )?.params,
    ).toEqual({
      teamId: 'core',
      memberId: '42',
    });
  });

  it('supports mutating a concrete route into a wildcard fallback', () => {
    const mutable = route('first');
    const catalog = createRouteCatalog([mutable]);

    mutable.path = '**';

    expect(
      recognizeRoute(catalog, '/anything')?.route,
    ).toBe(mutable);
    expect(
      recognizeRoute(catalog, '/anything')?.params,
    ).toEqual({});
  });

  it('supports mutating a wildcard fallback into a concrete route', () => {
    const mutable = route('**');
    const catalog = createRouteCatalog([mutable]);

    expect(
      recognizeRoute(catalog, '/anything')?.route,
    ).toBe(mutable);

    mutable.path = 'specific/:id';

    expect(
      recognizeRoute(catalog, '/anything'),
    ).toBeNull();
    expect(
      recognizeRoute(
        catalog,
        '/specific/9',
      )?.params,
    ).toEqual({ id: '9' });
  });

  it('validates duplicate outlet names', () => {
    const primary: Route = {
      ...route('project'),
      outlets: [
        {
          ...route('project'),
          outlet: 'sidebar',
        },
        {
          ...route('project'),
          outlet: 'sidebar',
        },
      ],
    };

    expect(() => createRouteCatalog([primary]))
      .toThrowError(
        /Duplicate outlet "sidebar"/,
      );
  });

  it('validates that secondary outlets use the primary path', () => {
    const primary: Route = {
      ...route('project'),
      outlets: [{
        ...route('different'),
        outlet: 'sidebar',
      }],
    };

    expect(() => createRouteCatalog([primary]))
      .toThrowError(
        /must use the primary path "project"/,
      );
  });
});
