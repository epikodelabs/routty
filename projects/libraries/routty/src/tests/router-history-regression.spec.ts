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

function delay(ms = 50): Promise<void> {
  return new Promise(resolve =>
    setTimeout(resolve, ms),
  );
}

function route(
  path: string,
  text: string,
  overrides: Partial<Route> = {},
): Route {
  return {
    path,
    load: async () => ({
      component: () =>
        document.createTextNode(text),
    }),
    ...overrides,
  };
}

idescribe('Router history rollback regressions', () => {
  let outlet: HTMLElement;
  let router: VanillaRouter;

  beforeEach(() => {
    outlet = document.createElement('div');
    document.body.appendChild(outlet);
    window.history.replaceState(
      { initial: true },
      '',
      '/',
    );

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
      render: (_name, node) => {
        outlet.replaceChildren(node);
      },
      ...overrides,
    });
  }

  it('restores the active URL when a pushed navigation is blocked', async () => {
    const home: Route = {
      path: '',
      load: async () => ({
        component: () =>
          document.createTextNode('Home'),
        canDeactivate: [() => false],
      }),
    };

    router = create([
      home,
      route('about', 'About'),
    ]);

    expect(await router.navigate('/'))
      .toBeTrue();
    expect(await router.navigate('/about'))
      .toBeFalse();

    expect(window.location.pathname).toBe('/');
    expect(router.state.current?.config)
      .toBe(home);
    expect(outlet.textContent).toBe('Home');

    assertRouterInvariant(router);
  });

  it('restores the active URL when a replace navigation is blocked', async () => {
    const home: Route = {
      path: '',
      load: async () => ({
        component: () =>
          document.createTextNode('Home'),
        canDeactivate: [() => false],
      }),
    };

    router = create([
      home,
      route('about', 'About'),
    ]);

    expect(await router.navigate('/'))
      .toBeTrue();
    expect(
      await router.replace(
        '/about',
        { attempted: true },
      ),
    ).toBeFalse();

    expect(window.location.pathname).toBe('/');
    expect(window.history.state)
      .not.toEqual({ attempted: true });
    expect(router.state.current?.config)
      .toBe(home);

    assertRouterInvariant(router);
  });

  it('preserves the current history state when a navigation is blocked', async () => {
    const home: Route = {
      path: '',
      load: async () => ({
        component: () =>
          document.createTextNode('Home'),
        canDeactivate: [() => false],
      }),
    };

    router = create([
      home,
      route('next', 'Next'),
    ]);

    expect(
      await router.navigate('/', {
        state: { session: 7 },
      }),
    ).toBeTrue();

    expect(await router.navigate('/next'))
      .toBeFalse();

    expect(
      window.history.state
        .__routtyUserState,
    ).toEqual({ session: 7 });
    expect(router.state.historyState)
      .toEqual({ session: 7 });

    assertRouterInvariant(router);
  });

  it('restores the prior URL after a route load failure', async () => {
    const home = route('', 'Home');
    const broken: Route = {
      path: 'broken',
      load: async () => {
        throw new Error('Load failed');
      },
    };

    router = create([home, broken]);

    expect(await router.navigate('/'))
      .toBeTrue();
    expect(await router.navigate('/broken'))
      .toBeFalse();

    expect(window.location.pathname).toBe('/');
    expect(router.state.error)
      .toEqual(jasmine.any(Error));
    expect(
      (router.state.error as Error).message,
    ).toBe('Load failed');

    // A single-route preparation failure replaces the active view with error
    // output, but browser history still returns to the previously committed URL.
    expect(router.state.current).toBeNull();
    expect(router.state.pending).toBeFalse();
    expect(router.state.phase).toBeNull();
  });

  it('does not leave a failed custom commit in browser history', async () => {
    let commits = 0;
    const home = route('', 'Home');
    const next = route('next', 'Next');

    router = create(
      [home, next],
      {
        commit: outlets => {
          commits++;

          if (commits === 2) {
            throw new Error('Commit failed');
          }

          outlet.replaceChildren(
            outlets[0].node,
          );
        },
      },
    );

    expect(await router.navigate('/'))
      .toBeTrue();
    expect(await router.navigate('/next'))
      .toBeFalse();

    expect(window.location.pathname).toBe('/');
    expect(
      (router.state.error as Error).message,
    ).toBe('Commit failed');
    expect(router.state.pending).toBeFalse();
    expect(router.state.phase).toBeNull();
  });

  it('restores a popstate destination when canDeactivate blocks back navigation', async () => {
    const home = route('', 'Home');
    const about: Route = {
      path: 'about',
      load: async () => ({
        component: () =>
          document.createTextNode('About'),
        canDeactivate: [() => false],
      }),
    };

    router = create([home, about]);
    router.start();

    expect(await router.navigate('/'))
      .toBeTrue();
    expect(await router.navigate('/about'))
      .toBeTrue();

    window.history.back();
    await delay(100);

    expect(window.location.pathname)
      .toBe('/about');
    expect(router.state.current?.config)
      .toBe(about);
    expect(outlet.textContent).toBe('About');

    assertRouterInvariant(router);
  });

  it('preserves active state when a grouped secondary outlet fails to prepare', async () => {
    const stable = route('', 'Stable');
    const grouped: Route = {
      path: 'project',
      load: async () => ({
        component: () =>
          document.createTextNode('Project'),
      }),
      outlets: [{
        path: 'project',
        outlet: 'sidebar',
        load: async () => {
          throw new Error('Sidebar failed');
        },
      }],
    };

    router = create([stable, grouped]);

    expect(await router.navigate('/'))
      .toBeTrue();
    expect(await router.navigate('/project'))
      .toBeFalse();

    expect(window.location.pathname).toBe('/');
    expect(router.state.current?.config)
      .toBe(stable);
    expect(outlet.textContent).toBe('Stable');
    expect(
      (router.state.error as Error).message,
    ).toBe('Sidebar failed');

    assertRouterInvariant(router);
  });

  it('keeps revalidation out of browser history', async () => {
    let prepareCount = 0;
    const home: Route = {
      path: '',
      load: async () => ({
        prepare: [
          () => ({
            count: ++prepareCount,
          }),
        ],
        component: active =>
          document.createTextNode(
            String(active.data['count']),
          ),
      }),
    };

    router = create([home]);

    expect(await router.navigate('/'))
      .toBeTrue();

    const length = window.history.length;
    const state = window.history.state;

    expect(await router.revalidate())
      .toBeTrue();

    expect(window.history.length).toBe(length);
    expect(window.history.state).toBe(state);
    expect(outlet.textContent).toBe('2');

    assertRouterInvariant(router);
  });
});
