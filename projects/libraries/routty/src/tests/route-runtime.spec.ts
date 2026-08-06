import {
  preloadRouteCatalog,
  prepareRouteRuntime,
} from '../lib/route-runtime';
import type {
  RedirectRoute,
  RenderableRoute,
  RouteComponent,
} from '../lib/vanilla-router';

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

const component: RouteComponent = () =>
  document.createTextNode('Route');

function renderable(
  path: string,
  overrides: Partial<RenderableRoute> = {},
): RenderableRoute {
  return {
    path,
    load: async () => ({ component }),
    ...overrides,
  };
}

describe('RouteRuntime', () => {
  it('shares one pending runtime load between concurrent callers', async () => {
    const pending = deferred<{
      component: RouteComponent;
    }>();
    const load = jasmine
      .createSpy('load')
      .and.returnValue(pending.promise);
    const route = renderable('shared', {
      load,
    });

    const first = prepareRouteRuntime(route);
    const second = prepareRouteRuntime(route);

    expect(first).toBe(second);
    expect(load).toHaveBeenCalledTimes(1);

    pending.resolve({ component });

    expect(await first).toBe(await second);
  });

  it('caches a successfully resolved runtime', async () => {
    const load = jasmine
      .createSpy('load')
      .and.resolveTo({ component });
    const route = renderable('cached', {
      load,
    });

    const first = await prepareRouteRuntime(route);
    const second = await prepareRouteRuntime(route);

    expect(second).toBe(first);
    expect(Object.isFrozen(first)).toBeTrue();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('evicts a failed load so a later call can retry', async () => {
    let attempt = 0;
    const route = renderable('retry', {
      load: async () => {
        attempt++;

        if (attempt === 1) {
          throw new Error('first failure');
        }

        return { component };
      },
    });

    await expectAsync(
      prepareRouteRuntime(route),
    ).toBeRejectedWithError('first failure');

    const runtime =
      await prepareRouteRuntime(route);

    expect(runtime.component).toBe(component);
    expect(attempt).toBe(2);
  });

  it('uses route-level prepare handlers when the loaded runtime omits prepare', async () => {
    const prepare = jasmine.createSpy('prepare');
    const route = renderable('fallback', {
      prepare: [prepare],
      load: async () => ({ component }),
    });

    const runtime =
      await prepareRouteRuntime(route);

    expect(runtime.prepare).toEqual([prepare]);
  });

  it('uses loaded prepare handlers when they are supplied', async () => {
    const routePrepare =
      jasmine.createSpy('routePrepare');
    const loadedPrepare =
      jasmine.createSpy('loadedPrepare');

    const route = renderable('override', {
      prepare: [routePrepare],
      load: async () => ({
        component,
        prepare: [loadedPrepare],
      }),
    });

    const runtime =
      await prepareRouteRuntime(route);

    expect(runtime.prepare)
      .toEqual([loadedPrepare]);
  });

  it('preserves all loaded runtime capabilities', async () => {
    const canActivate =
      jasmine.createSpy('canActivate');
    const canDeactivate =
      jasmine.createSpy('canDeactivate');
    const prepare =
      jasmine.createSpy('prepare');
    const parseParams =
      jasmine.createSpy('parseParams');
    const parseQuery =
      jasmine.createSpy('parseQuery');

    const route = renderable('capabilities', {
      load: async () => ({
        component,
        canActivate: [canActivate],
        canDeactivate: [canDeactivate],
        prepare: [prepare],
        parseParams,
        parseQuery,
      }),
    });

    const runtime =
      await prepareRouteRuntime(route);

    expect(runtime).toEqual({
      component,
      canActivate: [canActivate],
      canDeactivate: [canDeactivate],
      prepare: [prepare],
      parseParams,
      parseQuery,
    });
  });

  it('skips redirect routes during preloading', async () => {
    const redirect: RedirectRoute = {
      path: 'legacy',
      redirectTo: '/next',
    };
    const trace = jasmine.createSpy('trace');

    await preloadRouteCatalog(
      [redirect],
      trace,
    );

    expect(trace).not.toHaveBeenCalled();
  });

  it('skips routes with preload explicitly disabled', async () => {
    const load = jasmine.createSpy('load');
    const route = renderable('manual', {
      preload: false,
      load,
    });

    await preloadRouteCatalog(
      [route],
      jasmine.createSpy('trace'),
    );

    expect(load).not.toHaveBeenCalled();
  });

  it('preloads the primary route and every outlet member', async () => {
    const primaryLoad = jasmine
      .createSpy('primaryLoad')
      .and.resolveTo({ component });
    const sidebarLoad = jasmine
      .createSpy('sidebarLoad')
      .and.resolveTo({ component });

    const route = renderable('project', {
      load: primaryLoad,
      outlets: [
        renderable('project', {
          outlet: 'sidebar',
          load: sidebarLoad,
        }),
      ],
    });

    await preloadRouteCatalog(
      [route],
      jasmine.createSpy('trace'),
    );

    expect(primaryLoad).toHaveBeenCalledTimes(1);
    expect(sidebarLoad).toHaveBeenCalledTimes(1);
  });

  it('continues preloading later routes after one route fails', async () => {
    const failure = new Error('broken');
    const brokenLoad = jasmine
      .createSpy('brokenLoad')
      .and.rejectWith(failure);
    const healthyLoad = jasmine
      .createSpy('healthyLoad')
      .and.resolveTo({ component });
    const trace = jasmine.createSpy('trace');

    await preloadRouteCatalog(
      [
        renderable('broken', {
          load: brokenLoad,
        }),
        renderable('healthy', {
          load: healthyLoad,
        }),
      ],
      trace,
    );

    expect(brokenLoad).toHaveBeenCalledTimes(1);
    expect(healthyLoad).toHaveBeenCalledTimes(1);
    expect(trace).toHaveBeenCalledWith(
      'Route preload failed',
      'broken',
      '',
      failure,
    );
  });

  it('reports an invalid parser on a named outlet and continues', async () => {
    const parseQuery =
      jasmine.createSpy('parseQuery');
    const nextLoad = jasmine
      .createSpy('nextLoad')
      .and.resolveTo({ component });
    const trace = jasmine.createSpy('trace');

    const grouped = renderable('project', {
      outlets: [
        renderable('project', {
          outlet: 'sidebar',
          load: async () => ({
            component,
            parseQuery,
          }),
        }),
      ],
    });

    await preloadRouteCatalog(
      [
        grouped,
        renderable('next', {
          load: nextLoad,
        }),
      ],
      trace,
    );

    expect(trace).toHaveBeenCalledWith(
      'Route preload failed',
      'project',
      'sidebar',
      jasmine.any(Error),
    );
    expect(nextLoad).toHaveBeenCalledTimes(1);
  });

  it('reuses a runtime already populated by preload', async () => {
    const load = jasmine
      .createSpy('load')
      .and.resolveTo({ component });
    const route = renderable('preloaded', {
      load,
    });

    await preloadRouteCatalog(
      [route],
      jasmine.createSpy('trace'),
    );

    const runtime =
      await prepareRouteRuntime(route);

    expect(runtime.component).toBe(component);
    expect(load).toHaveBeenCalledTimes(1);
  });
});
