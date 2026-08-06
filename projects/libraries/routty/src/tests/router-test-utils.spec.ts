import {
  createRouter,
  type VanillaRouter,
} from '@epikodelabs/routty';

import {
  assertRouterInvariant,
} from './router-test-utils';

describe('assertRouterInvariant', () => {
  let router: VanillaRouter;

  afterEach(() => {
    router?.dispose();
    window.history.replaceState(null, '', '/');
  });

  it('accepts a settled router with no active route', () => {
    router = createRouter({
      routes: [],
      render: () => {},
    });

    assertRouterInvariant(router, {
      routeVersion: 0,
      routes: [],
    });
  });

  it('accepts a settled router with an active route', async () => {
    const route = {
      path: '',
      load: async () => ({
        component: () =>
          document.createTextNode('Home'),
      }),
    };

    router = createRouter({
      routes: [route],
      render: () => {},
    });

    expect(await router.navigate('/')).toBeTrue();

    assertRouterInvariant(router, {
      routeVersion: 0,
      routes: [route],
    });
  });
});
