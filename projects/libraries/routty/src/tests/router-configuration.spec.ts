import {
  createRouter,
  type NavigationTransitionDefinition,
  type Route,
  type VanillaRouter,
} from '@epikodelabs/routty';

import { idescribe } from './env.spec';
import {
  assertRouterInvariant,
} from './router-test-utils';

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;

  return {
    promise: new Promise<T>(
      accept => {
        resolve = accept;
      },
    ),
    resolve,
  };
}

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

idescribe('Router atomic configuration replacement', () => {
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

  it('returns false when route and transition references are unchanged', () => {
    const home = route('', 'Home');
    const transition:
      NavigationTransitionDefinition = {};

    router = createRouter({
      routes: [home],
      transitions: [transition],
      outlet,
    });

    expect(
      router.replaceConfiguration({
        routes: [home],
        transitions: [transition],
      }),
    ).toBeFalse();

    assertRouterInvariant(router, {
      routeVersion: 0,
      routes: [home],
    });
  });

  it('replaces routes and transitions in one transaction', async () => {
    const oldRoute = route('', 'Old');
    const nextRoute = route('', 'Next');
    const calls: string[] = [];

    const oldTransition:
      NavigationTransitionDefinition = {
        beforeEnter: [
          () => {
            calls.push('old');
            return true;
          },
        ],
      };

    const nextTransition:
      NavigationTransitionDefinition = {
        beforeEnter: [
          () => {
            calls.push('next');
            return true;
          },
        ],
      };

    router = createRouter({
      routes: [oldRoute],
      transitions: [oldTransition],
      outlet,
    });

    expect(await router.navigate('/'))
      .toBeTrue();
    expect(calls).toEqual(['old']);
    expect(outlet.textContent).toBe('Old');

    expect(
      router.replaceConfiguration({
        routes: [nextRoute],
        transitions: [nextTransition],
      }),
    ).toBeTrue();

    // Configuration changes what the router knows, not what is currently
    // rendered. Revalidation remains explicit.
    expect(outlet.textContent).toBe('Old');
    expect(router.state.current?.config)
      .toBe(oldRoute);

    expect(await router.revalidate())
      .toBeTrue();

    expect(calls).toEqual(['old', 'next']);
    expect(outlet.textContent).toBe('Next');

    assertRouterInvariant(router, {
      routeVersion: 1,
      routes: [nextRoute],
    });
  });

  it('does not increment routeVersion for a transition-only update', async () => {
    const home = route('', 'Home');
    const first:
      NavigationTransitionDefinition = {};
    const second:
      NavigationTransitionDefinition = {
        beforeEnter: [() => true],
      };

    router = createRouter({
      routes: [home],
      transitions: [first],
      outlet,
    });

    expect(
      router.replaceConfiguration({
        routes: [home],
        transitions: [second],
      }),
    ).toBeTrue();

    expect(router.routeVersion).toBe(0);
    expect(await router.revalidate())
      .toBeTrue();

    assertRouterInvariant(router, {
      routeVersion: 0,
      routes: [home],
    });
  });

  it('increments routeVersion once when both parts change', () => {
    const oldRoute = route('', 'Old');
    const nextRoute = route('', 'Next');

    router = createRouter({
      routes: [oldRoute],
      transitions: [],
      outlet,
    });

    expect(
      router.replaceConfiguration({
        routes: [nextRoute],
        transitions: [{}],
      }),
    ).toBeTrue();

    expect(router.routeVersion).toBe(1);
    expect(router.routes()).toEqual([nextRoute]);
  });

  it('cancels one pending navigation when both parts change', async () => {
    const loading = deferred<{
      component: () => Node;
    }>();
    const slow: Route = {
      path: 'slow',
      load: () => loading.promise,
    };
    const next = route('next', 'Next');

    router = createRouter({
      routes: [slow],
      transitions: [],
      outlet,
    });

    const navigation =
      router.navigate('/slow');

    await Promise.resolve();

    expect(
      router.replaceConfiguration({
        routes: [next],
        transitions: [{}],
      }),
    ).toBeTrue();

    await expectAsync(navigation)
      .toBeResolvedTo(false);

    loading.resolve({
      component: () =>
        document.createTextNode('Slow'),
    });

    expect(router.state.current).toBeNull();
    expect(router.routeVersion).toBe(1);
  });

  it('validates the next route catalog before cancelling navigation', async () => {
    const loading = deferred<{
      component: () => Node;
    }>();
    const slow: Route = {
      path: 'slow',
      load: () => loading.promise,
    };

    router = createRouter({
      routes: [slow],
      transitions: [],
      outlet,
    });

    const navigation =
      router.navigate('/slow');

    await Promise.resolve();

    expect(() =>
      router.replaceConfiguration({
        routes: [
          route('duplicate', 'One'),
          route('duplicate', 'Two'),
        ],
        transitions: [{}],
      }),
    ).toThrowError(
      /Duplicate primary route path "duplicate"/,
    );

    // Rejected configuration did not cancel the existing request.
    expect(router.state.pending).toBeTrue();

    loading.resolve({
      component: () =>
        document.createTextNode('Slow'),
    });

    await expectAsync(navigation)
      .toBeResolvedTo(true);

    expect(outlet.textContent).toBe('Slow');
    expect(router.routeVersion).toBe(0);
  });

  it('keeps replaceRoutes and replaceTransitions as compatible wrappers', () => {
    const first = route('', 'First');
    const second = route('', 'Second');
    const transition:
      NavigationTransitionDefinition = {};

    router = createRouter({
      routes: [first],
      transitions: [],
      outlet,
    });

    expect(router.replaceRoutes([second]))
      .toBeTrue();
    expect(router.routeVersion).toBe(1);

    expect(
      router.replaceTransitions([transition]),
    ).toBeTrue();
    expect(router.routeVersion).toBe(1);

    expect(router.replaceRoutes([second]))
      .toBeFalse();
    expect(
      router.replaceTransitions([transition]),
    ).toBeFalse();
  });

  it('throws after disposal', () => {
    const home = route('', 'Home');

    router = createRouter({
      routes: [home],
      outlet,
    });

    router.dispose();

    expect(() =>
      router.replaceConfiguration({
        routes: [home],
        transitions: [],
      }),
    ).toThrowError(
      /Cannot replace configuration on a disposed router/,
    );
  });
});
