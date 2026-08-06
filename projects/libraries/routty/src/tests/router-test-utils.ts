import type {
  Route,
  VanillaRouter,
} from '@epikodelabs/routty';

export interface RouterInvariantOptions {
  /**
   * Set to true only while deliberately inspecting an unsettled navigation.
   * Most tests should assert invariants after the returned navigation promise
   * has settled.
   */
  readonly allowPending?: boolean;

  /**
   * Optionally assert the exact catalog version expected by the scenario.
   */
  readonly routeVersion?: number;

  /**
   * Optionally assert exact route reference ordering.
   */
  readonly routes?: readonly Route[];
}

/**
 * Verifies public-state relationships that must hold after every settled router
 * operation. Keep this helper restricted to public API invariants so it remains
 * useful while router internals are refactored.
 */
export function assertRouterInvariant(
  router: VanillaRouter,
  options: RouterInvariantOptions = {},
): void {
  const {
    allowPending = false,
    routeVersion,
    routes,
  } = options;

  expect(Number.isInteger(router.routeVersion))
    .withContext('routeVersion must be an integer')
    .toBeTrue();
  expect(router.routeVersion)
    .withContext('routeVersion must not be negative')
    .toBeGreaterThanOrEqual(0);

  const snapshot = router.routes();

  expect(Object.isFrozen(snapshot))
    .withContext('routes() must return an immutable snapshot')
    .toBeTrue();
  expect(snapshot.every(
    route => typeof route.path === 'string',
  )).withContext(
    'every catalog route must have a string path',
  ).toBeTrue();

  if (routeVersion !== undefined) {
    expect(router.routeVersion)
      .withContext('unexpected catalog version')
      .toBe(routeVersion);
  }

  if (routes) {
    expect(snapshot.length)
      .withContext('unexpected catalog size')
      .toBe(routes.length);

    routes.forEach((route, index) => {
      expect(snapshot[index])
        .withContext(
          `unexpected route reference at index ${index}`,
        )
        .toBe(route);
    });
  }

  if (!allowPending) {
    expect(router.state.pending)
      .withContext(
        'router must not remain pending after a settled operation',
      )
      .toBeFalse();
    expect(router.state.phase)
      .withContext(
        'navigation phase must clear after a settled operation',
      )
      .toBeNull();
  }

  const current = router.state.current;

  if (current === null) {
    expect(router.state.routeConfig)
      .withContext(
        'routeConfig must be null without a current route',
      )
      .toBeNull();
    expect(router.state.path)
      .withContext(
        'path must be empty without a current route',
      )
      .toBe('');
    expect(router.state.params)
      .withContext(
        'params must be empty without a current route',
      )
      .toEqual({});
    expect(router.state.query)
      .withContext(
        'query must be empty without a current route',
      )
      .toEqual({});
    expect(router.state.data)
      .withContext(
        'data must be empty without a current route',
      )
      .toEqual({});
    return;
  }

  expect(router.state.routeConfig)
    .withContext(
      'routeConfig must reference the current route config',
    )
    .toBe(current.config);
  expect(router.state.path)
    .withContext(
      'state.path must mirror current.path',
    )
    .toBe(current.path);
  expect(router.state.params)
    .withContext(
      'state.params must reference current.params',
    )
    .toBe(current.params);
  expect(router.state.query)
    .withContext(
      'state.query must reference current.query',
    )
    .toBe(current.query);
  expect(router.state.data)
    .withContext(
      'state.data must reference current.data',
    )
    .toBe(current.data);
  expect(router.state.historyState)
    .withContext(
      'historyState must mirror the current route',
    )
    .toBe(current.historyState);
}
