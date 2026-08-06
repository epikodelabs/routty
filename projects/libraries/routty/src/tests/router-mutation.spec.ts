import {
  createRouter,
  type NavigationTransitionDefinition,
  type Route,
  type VanillaRouter,
} from '@epikodelabs/routty';

import { idescribe } from './env.spec';

function routeWithComponent(
  path: string,
  text: string,
  onDestroy?: () => void,
): Route {
  return {
    path,
    load: async () => ({
      component: (_route, context) => {
        if (onDestroy) {
          context.destroySignal.addEventListener(
            'abort',
            onDestroy,
            { once: true },
          );
        }

        return document.createTextNode(text);
      },
    }),
  };
}

idescribe('Router route mutations', () => {
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
    routes: readonly Route[],
    overrides: Partial<Parameters<typeof createRouter>[0]> = {},
  ): VanillaRouter {
    return createRouter({
      routes: [...routes],
      render: (_name, node) => {
        outlet.replaceChildren(node);
      },
      ...overrides,
    });
  }

  it('should expose the initial route catalog without increasing its version', () => {
    const home = routeWithComponent('', 'Home');
    const about = routeWithComponent('about', 'About');

    router = create([home, about]);

    expect(router.routeVersion).toBe(0);
    expect(router.routes()).toEqual([home, about]);
    expect(router.routes()[0]).toBe(home);
    expect(router.routes()[1]).toBe(about);
  });

  it('should preserve catalog identity for an empty append', () => {
    const home = routeWithComponent('', 'Home');
    router = create([home]);

    expect(router.addRoutes([])).toBeFalse();
    expect(router.routeVersion).toBe(0);
    expect(router.routes()).toEqual([home]);
  });

  it('should append a route and make it immediately available to navigation', async () => {
    const home = routeWithComponent('', 'Home');
    const settings = routeWithComponent('settings', 'Settings');
    router = create([home]);

    expect(router.addRoutes([settings])).toBeTrue();
    expect(router.routeVersion).toBe(1);
    expect(router.routes()).toEqual([home, settings]);

    expect(await router.navigate('/settings')).toBeTrue();
    expect(router.state.current?.config).toBe(settings);
    expect(outlet.textContent).toBe('Settings');
  });

  it('should preserve the catalog when replacing it with the same route references', () => {
    const home = routeWithComponent('', 'Home');
    const settings = routeWithComponent('settings', 'Settings');
    router = create([home, settings]);

    expect(router.replaceRoutes([home, settings])).toBeFalse();
    expect(router.routeVersion).toBe(0);
    expect(router.routes()).toEqual([home, settings]);
  });

  it('should replace the complete route catalog', async () => {
    const oldRoute = routeWithComponent('old', 'Old');
    const nextRoute = routeWithComponent('next', 'Next');
    const notFound = jasmine.createSpy('notFound');

    router = create([oldRoute], {
      renderNotFound: (_outletName, url) => {
        notFound(url.pathname);
        outlet.replaceChildren(
          document.createTextNode('Not found'),
        );
      },
    });

    expect(await router.navigate('/old')).toBeTrue();
    expect(outlet.textContent).toBe('Old');

    expect(router.replaceRoutes([nextRoute])).toBeTrue();
    expect(router.routeVersion).toBe(1);
    expect(router.routes()).toEqual([nextRoute]);

    expect(await router.navigate('/old')).toBeFalse();
    expect(notFound).toHaveBeenCalledWith('/old');
    expect(outlet.textContent).toBe('Not found');

    expect(await router.navigate('/next')).toBeTrue();
    expect(outlet.textContent).toBe('Next');
  });

  it('should preserve the active view until removal is explicitly revalidated', async () => {
    const destroyed = jasmine.createSpy('destroyed');
    const active = routeWithComponent(
      'active',
      'Active',
      destroyed,
    );

    router = create([active]);

    expect(await router.navigate('/active')).toBeTrue();
    expect(outlet.textContent).toBe('Active');

    expect(
      router.removeRoutes(route => route === active),
    ).toBeTrue();

    expect(router.routeVersion).toBe(1);
    expect(router.routes()).toEqual([]);
    expect(router.state.current?.config).toBe(active);
    expect(outlet.textContent).toBe('Active');
    expect(destroyed).not.toHaveBeenCalled();

    expect(await router.revalidate()).toBeFalse();

    expect(router.state.current).toBeNull();
    expect(destroyed).toHaveBeenCalledTimes(1);
  });

  it('should not increment the version when no route is removed', () => {
    const home = routeWithComponent('', 'Home');
    router = create([home]);

    expect(
      router.removeRoutes(route => route.path === 'missing'),
    ).toBeFalse();

    expect(router.routeVersion).toBe(0);
    expect(router.routes()).toEqual([home]);
  });

  it('should return a new route snapshot that cannot mutate catalog membership', () => {
    const home = routeWithComponent('', 'Home');
    router = create([home]);

    const snapshot =
      router.routes() as Route[];

    expect(() => snapshot.push(
      routeWithComponent('extra', 'Extra'),
    )).toThrow();

    expect(router.routes()).toEqual([home]);
    expect(router.routeVersion).toBe(0);
  });

  it('should replace transitions and use the new transition during revalidation', async () => {
    const calls: string[] = [];
    const route = routeWithComponent('', 'Home');

    const first: NavigationTransitionDefinition = {
      beforeEnter: [
        () => {
          calls.push('first');
          return true;
        },
      ],
    };

    const second: NavigationTransitionDefinition = {
      beforeEnter: [
        () => {
          calls.push('second');
          return true;
        },
      ],
    };

    router = create([route], {
      transitions: [first],
    });

    expect(await router.navigate('/')).toBeTrue();
    expect(calls).toEqual(['first']);

    expect(router.replaceTransitions([second])).toBeTrue();
    expect(await router.revalidate()).toBeTrue();
    expect(calls).toEqual(['first', 'second']);

    expect(router.replaceTransitions([second])).toBeFalse();
  });

  it('should reject every catalog mutation after disposal', () => {
    const route = routeWithComponent('', 'Home');
    router = create([route]);
    router.dispose();

    expect(() => router.addRoutes([]))
      .toThrowError(/disposed router/);
    expect(() => router.replaceRoutes([]))
      .toThrowError(/disposed router/);
    expect(() => router.removeRoutes(() => true))
      .toThrowError(/disposed router/);
    expect(() => router.replaceTransitions([]))
      .toThrowError(/disposed router/);
  });
});
