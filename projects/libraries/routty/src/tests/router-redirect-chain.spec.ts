import {
  createRouter,
  type Route,
  type VanillaRouter,
  type VanillaRouterConfig,
} from '@epikodelabs/routty';

import { idescribe } from './env.spec';
import {
  assertRouterInvariant,
} from './router-test-utils';

function route(
  path: string,
  text: string,
): Route {
  return {
    path,
    load: async () => ({
      component: () =>
        document.createTextNode(text),
    }),
  };
}

idescribe('Router redirect chains', () => {
  let outlet: HTMLElement;
  let router: VanillaRouter;

  beforeEach(() => {
    outlet = document.createElement('div');
    document.body.appendChild(outlet);
    window.history.replaceState(null, '', '/');

    spyOn(console, 'debug');
    spyOn(console, 'error');
  });

  afterEach(() => {
    router?.dispose();
    window.history.replaceState(null, '', '/');
    outlet.remove();
  });

  function create(
    routes: Route[],
    overrides: Partial<VanillaRouterConfig> = {},
  ): VanillaRouter {
    return createRouter({
      routes,
      outlet,
      ...overrides,
    });
  }

  it('follows a multi-step static redirect chain', async () => {
    const final = route('final', 'Final');

    router = create([
      {
        path: 'one',
        redirectTo: '/two',
      },
      {
        path: 'two',
        redirectTo: '/final',
      },
      final,
    ]);

    expect(await router.navigate('/one'))
      .toBeTrue();

    expect(window.location.pathname)
      .toBe('/final');
    expect(router.state.current?.config)
      .toBe(final);
    expect(outlet.textContent).toBe('Final');

    assertRouterInvariant(router);
  });

  it('interpolates parameters across a redirect', async () => {
    const user = route('users/:id', 'User');

    router = create([
      {
        path: 'legacy/:id',
        redirectTo: '/users/:id',
      },
      user,
    ]);

    expect(
      await router.navigate(
        '/legacy/hello%20world',
      ),
    ).toBeTrue();

    expect(window.location.pathname)
      .toBe('/users/hello%20world');
    expect(router.state.params)
      .toEqual({ id: 'hello world' });

    assertRouterInvariant(router);
  });

  it('preserves navigation state across a redirect chain', async () => {
    const final = route('final', 'Final');

    router = create([
      {
        path: 'start',
        redirectTo: '/middle',
      },
      {
        path: 'middle',
        redirectTo: '/final',
      },
      final,
    ]);

    const state = {
      token: 'abc',
      attempt: 4,
    };

    expect(
      await router.navigate(
        '/start',
        { state },
      ),
    ).toBeTrue();

    expect(
      window.history.state
        .__routtyUserState,
    ).toEqual(state);
    expect(router.state.historyState)
      .toEqual(state);

    assertRouterInvariant(router);
  });

  it('uses a guard redirect and carries its replace option', async () => {
    const source: Route = {
      path: 'source',
      load: async () => ({
        canActivate: [
          () => ({
            redirectTo: '/target',
            replace: false,
          }),
        ],
        component: () =>
          document.createTextNode('Source'),
      }),
    };
    const target = route('target', 'Target');

    router = create([source, target]);

    const pushState = spyOn(
      window.history,
      'pushState',
    ).and.callThrough();

    expect(await router.navigate('/source'))
      .toBeTrue();

    expect(window.location.pathname)
      .toBe('/target');
    expect(pushState).toHaveBeenCalledWith(
      jasmine.any(Object),
      '',
      '/target',
    );
    expect(router.state.current?.config)
      .toBe(target);

    assertRouterInvariant(router);
  });

  it('fails when a redirect references a missing parameter', async () => {
    router = create([
      {
        path: 'legacy',
        redirectTo: '/users/:id',
      },
      route('users/:id', 'User'),
    ]);

    expect(await router.navigate('/legacy'))
      .toBeFalse();

    expect(router.state.current).toBeNull();
    expect(
      (router.state.error as Error).message,
    ).toContain(
      'Missing route parameter "id"',
    );
    expect(window.location.pathname).toBe('/');
  });

  it('stops a redirect loop at maxRedirects', async () => {
    router = create(
      [
        {
          path: 'a',
          redirectTo: '/b',
        },
        {
          path: 'b',
          redirectTo: '/a',
        },
      ],
      {
        maxRedirects: 3,
      },
    );

    expect(await router.navigate('/a'))
      .toBeFalse();

    expect(
      (router.state.error as Error).message,
    ).toContain(
      'Maximum redirect count of 3 exceeded',
    );
    expect(router.state.pending).toBeFalse();
    expect(router.state.phase).toBeNull();
  });

  it('delegates an external redirect to navigateExternal', async () => {
    const navigateExternal =
      jasmine.createSpy('navigateExternal');

    const source: Route = {
      path: 'source',
      load: async () => ({
        canActivate: [
          () => ({
            redirectTo:
              'https://external.test/path',
            replace: true,
          }),
        ],
        component: () =>
          document.createTextNode('Source'),
      }),
    };

    router = create([source], {
      navigateExternal,
    });

    expect(await router.navigate('/source'))
      .toBeTrue();

    expect(navigateExternal)
      .toHaveBeenCalledTimes(1);
    expect(
      navigateExternal.calls.mostRecent()
        .args[0].href,
    ).toBe(
      'https://external.test/path',
    );
    expect(router.state.current).toBeNull();
  });

  it('does not render an intermediate redirect route', async () => {
    const rendered: string[] = [];
    const final: Route = {
      path: 'final',
      load: async () => ({
        component: () => {
          rendered.push('final');
          return document.createTextNode('Final');
        },
      }),
    };

    router = create([
      {
        path: 'start',
        redirectTo: '/final',
      },
      final,
    ]);

    expect(await router.navigate('/start'))
      .toBeTrue();

    expect(rendered).toEqual(['final']);
    expect(outlet.textContent).toBe('Final');

    assertRouterInvariant(router);
  });

  it('keeps query and hash values on an explicit redirect target', async () => {
    const final = route('final', 'Final');

    router = create([
      {
        path: 'start',
        redirectTo:
          '/final?tab=activity#details',
      },
      final,
    ]);

    expect(await router.navigate('/start'))
      .toBeTrue();

    expect(window.location.pathname)
      .toBe('/final');
    expect(window.location.search)
      .toBe('?tab=activity');
    expect(window.location.hash)
      .toBe('#details');
    expect(router.state.query)
      .toEqual({ tab: 'activity' });

    assertRouterInvariant(router);
  });
});
