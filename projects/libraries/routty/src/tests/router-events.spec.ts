import {
  OUTLET_ACTIVATE_EVENT,
  OUTLET_DEACTIVATE_EVENT,
  ROUTER_LOCATION_CHANGE_EVENT,
  dispatchOutletLifecycleEvent,
  dispatchRouterLocationChange,
} from '../lib/router-events';

describe('Routty browser events', () => {
  it('dispatches one namespaced outlet activation event', () => {
    const target = new EventTarget();
    const component = { id: 1 };
    let currentCount = 0;
    let legacyCount = 0;
    let received: unknown;

    target.addEventListener(
      OUTLET_ACTIVATE_EVENT,
      event => {
        currentCount++;
        received = (event as CustomEvent<unknown>).detail;
      },
    );

    target.addEventListener(
      'vanilla-router-activate',
      () => legacyCount++,
    );

    dispatchOutletLifecycleEvent(
      target,
      OUTLET_ACTIVATE_EVENT,
      component,
    );

    expect(currentCount).toBe(1);
    expect(legacyCount).toBe(0);
    expect(received).toBe(component);
  });

  it('dispatches one namespaced outlet deactivation event', () => {
    const target = new EventTarget();
    const component = { id: 2 };
    let currentCount = 0;
    let legacyCount = 0;

    target.addEventListener(
      OUTLET_DEACTIVATE_EVENT,
      () => currentCount++,
    );

    target.addEventListener(
      'vanilla-router-deactivate',
      () => legacyCount++,
    );

    dispatchOutletLifecycleEvent(
      target,
      OUTLET_DEACTIVATE_EVENT,
      component,
    );

    expect(currentCount).toBe(1);
    expect(legacyCount).toBe(0);
  });

  it('dispatches one namespaced location-change event', () => {
    let currentCount = 0;
    let legacyCount = 0;

    const currentListener = () => currentCount++;
    const legacyListener = () => legacyCount++;

    window.addEventListener(
      ROUTER_LOCATION_CHANGE_EVENT,
      currentListener,
    );
    window.addEventListener(
      'vanilla-router-locationchange',
      legacyListener,
    );

    try {
      dispatchRouterLocationChange();

      expect(currentCount).toBe(1);
      expect(legacyCount).toBe(0);
    } finally {
      window.removeEventListener(
        ROUTER_LOCATION_CHANGE_EVENT,
        currentListener,
      );
      window.removeEventListener(
        'vanilla-router-locationchange',
        legacyListener,
      );
    }
  });
});
