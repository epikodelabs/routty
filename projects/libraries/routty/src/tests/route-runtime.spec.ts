import {
  prepareRouteRuntime,
  preloadRouteCatalog,
} from '../lib/route-runtime';
import type { RenderableRoute } from '../lib/vanilla-router';

function component(label: string) {
  return () => document.createTextNode(label);
}

describe('eager route runtime', () => {
  it('reads runtime capabilities directly from the route', async () => {
    const route: RenderableRoute = {
      path: '/projects',
      component: component('Projects'),
      prepare: [() => ({ ready: true })],
    };

    const runtime = await prepareRouteRuntime(route);

    expect(runtime.component).toBe(route.component);
    expect(runtime.prepare).toBe(route.prepare);
  });

  it('does not invoke a loader to prepare an eager route', async () => {
    const route: RenderableRoute = {
      path: '/about',
      component: component('About'),
    };

    const first = await prepareRouteRuntime(route);
    const second = await prepareRouteRuntime(route);

    expect(first.component).toBe(route.component);
    expect(second.component).toBe(route.component);
  });

  it('validates that secondary outlets do not own URL parsers', async () => {
    const route: RenderableRoute = {
      path: '/projects/:id',
      component: component('Project'),
      outlets: [{
        path: '/projects/:id',
        outlet: 'sidebar',
        component: component('Sidebar'),
        parseParams: params => params,
      }],
    };

    await expectAsync(
      preloadRouteCatalog([route], () => undefined),
    ).toBeRejectedWithError(/cannot define parseParams or parseQuery/);
  });
});
