import {
  createRouter,
  type Route,
  type VanillaRouter,
} from '@epikodelabs/routty';

import { idescribe } from './env.spec';

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;

  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });

  return {
    promise,
    resolve,
    reject,
  };
}

function delay(ms = 0): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function immediateRoute(
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

idescribe('Router mutation races', () => {
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

  function create(routes: readonly Route[]): VanillaRouter {
    return createRouter({
      routes: [...routes],
      render: (_name, node) => {
        outlet.replaceChildren(node);
      },
    });
  }

  it('should settle a navigation as false when a route mutation cancels it', async () => {
    const loading = deferred<{
      component: () => Node;
    }>();

    const slow: Route = {
      path: 'slow',
      load: () => loading.promise,
    };

    router = create([slow]);

    const navigation = router.navigate('/slow');
    await Promise.resolve();

    expect(router.state.pending).toBeTrue();
    expect(
      router.addRoutes([
        immediateRoute('other', 'Other'),
      ]),
    ).toBeTrue();

    await expectAsync(navigation)
      .toBeResolvedTo(false);

    loading.resolve({
      component: () =>
        document.createTextNode('Slow'),
    });

    await delay();

    expect(router.state.current).toBeNull();
    expect(outlet.textContent).toBe('');
  });

  it('should allow a newer navigation to win when an older lazy load resolves later', async () => {
    const loading = deferred<{
      component: () => Node;
    }>();

    const slow: Route = {
      path: 'slow',
      load: () => loading.promise,
    };

    const fast = immediateRoute(
      'fast',
      'Fast',
    );

    router = create([slow, fast]);

    const first = router.navigate('/slow');
    await Promise.resolve();

    const second = router.navigate('/fast');

    await expectAsync(first)
      .toBeResolvedTo(false);
    await expectAsync(second)
      .toBeResolvedTo(true);

    expect(router.state.current?.config).toBe(fast);
    expect(outlet.textContent).toBe('Fast');

    loading.resolve({
      component: () =>
        document.createTextNode('Slow'),
    });

    await delay();

    expect(router.state.current?.config).toBe(fast);
    expect(outlet.textContent).toBe('Fast');
  });

  it('should ignore an obsolete lazy-load failure after a newer navigation succeeds', async () => {
    const loading = deferred<{
      component: () => Node;
    }>();

    const slow: Route = {
      path: 'slow',
      load: () => loading.promise,
    };

    const fast = immediateRoute(
      'fast',
      'Fast',
    );

    router = create([slow, fast]);

    const first = router.navigate('/slow');
    await Promise.resolve();

    expect(await router.navigate('/fast'))
      .toBeTrue();

    loading.reject(
      new Error('obsolete failure'),
    );

    await expectAsync(first)
      .toBeResolvedTo(false);
    await delay();

    expect(router.state.current?.config).toBe(fast);
    expect(router.state.error).toBeNull();
    expect(outlet.textContent).toBe('Fast');
  });

  it('should dispose a prepared primary outlet when mutation cancels a pending sidebar render', async () => {
    const sidebarRender = deferred<Node>();
    const primaryDestroyed =
      jasmine.createSpy('primaryDestroyed');
    const sidebarDestroyed =
      jasmine.createSpy('sidebarDestroyed');
    const sidebarStarted =
      deferred<void>();

    const grouped: Route = {
      path: 'project',
      load: async () => ({
        component: (_route, context) => {
          context.destroySignal.addEventListener(
            'abort',
            primaryDestroyed,
            { once: true },
          );

          return document.createTextNode('Project');
        },
      }),
      outlets: [{
        path: 'project',
        outlet: 'sidebar',
        load: async () => ({
          component: (_route, context) => {
            context.destroySignal.addEventListener(
              'abort',
              sidebarDestroyed,
              { once: true },
            );

            sidebarStarted.resolve();

            return sidebarRender.promise;
          },
        }),
      }],
    };

    router = create([grouped]);

    const navigation =
      router.navigate('/project');

    await sidebarStarted.promise;

    // The primary outlet has been prepared, while the sidebar component is
    // still rendering. Replacing the catalog must cancel and clean up both.
    expect(
      router.replaceRoutes([
        immediateRoute('next', 'Next'),
      ]),
    ).toBeTrue();

    expect(sidebarDestroyed)
      .toHaveBeenCalledTimes(1);

    sidebarRender.resolve(
      document.createTextNode('Sidebar'),
    );

    await expectAsync(navigation)
      .toBeResolvedTo(false);
    await delay();

    expect(primaryDestroyed)
      .toHaveBeenCalledTimes(1);
    expect(sidebarDestroyed)
      .toHaveBeenCalledTimes(1);
    expect(router.state.current).toBeNull();
    expect(outlet.textContent).toBe('');
  });

  it('should revalidate only against the replacement catalog', async () => {
    const oldRoute = immediateRoute(
      '',
      'Old',
    );
    const nextRoute = immediateRoute(
      '',
      'Next',
    );

    router = create([oldRoute]);

    expect(await router.navigate('/'))
      .toBeTrue();
    expect(outlet.textContent).toBe('Old');

    expect(
      router.replaceRoutes([nextRoute]),
    ).toBeTrue();

    expect(await router.revalidate())
      .toBeTrue();

    expect(router.state.current?.config)
      .toBe(nextRoute);
    expect(outlet.textContent).toBe('Next');
  });

  it('should prevent a cancelled prepare result from replacing a newer route', async () => {
    const preparation = deferred<
      Readonly<Record<string, unknown>>
    >();

    const slow: Route = {
      path: 'slow',
      load: async () => ({
        prepare: [
          () => preparation.promise,
        ],
        component: route =>
          document.createTextNode(
            String(route.data['message']),
          ),
      }),
    };

    const fast = immediateRoute(
      'fast',
      'Fast',
    );

    router = create([slow, fast]);

    const first = router.navigate('/slow');
    await Promise.resolve();

    expect(await router.navigate('/fast'))
      .toBeTrue();

    preparation.resolve({
      message: 'Slow',
    });

    await expectAsync(first)
      .toBeResolvedTo(false);
    await delay();

    expect(router.state.current?.config).toBe(fast);
    expect(router.state.error).toBeNull();
    expect(outlet.textContent).toBe('Fast');
  });
});
