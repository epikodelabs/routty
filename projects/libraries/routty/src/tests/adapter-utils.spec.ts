import type { DestroyRef } from '@angular/core';

import {
  watchRouterLocation,
} from '../lib/adapter-utils';
import {
  ROUTER_LOCATION_CHANGE_EVENT,
} from '../lib/router-events';

function createDestroyRef(): {
  readonly ref: DestroyRef;
  destroy(): void;
} {
  const callbacks: Array<() => void> = [];

  return {
    ref: {
      onDestroy(callback: () => void): () => void {
        callbacks.push(callback);
        return () => {
          const index = callbacks.indexOf(callback);
          if (index >= 0) callbacks.splice(index, 1);
        };
      },
    } as DestroyRef,
    destroy(): void {
      for (const callback of [...callbacks]) {
        callback();
      }
      callbacks.length = 0;
    },
  };
}

describe('watchRouterLocation', () => {
  it('shares one pair of window listeners across subscribers', () => {
    const addEventListener = spyOn(window, 'addEventListener').and.callThrough();
    const removeEventListener = spyOn(window, 'removeEventListener').and.callThrough();

    const first = createDestroyRef();
    const second = createDestroyRef();
    const firstRefresh = jasmine.createSpy('firstRefresh');
    const secondRefresh = jasmine.createSpy('secondRefresh');

    watchRouterLocation(first.ref, firstRefresh);
    watchRouterLocation(second.ref, secondRefresh);

    expect(
      addEventListener.calls.allArgs().filter(
        ([type]) => type === ROUTER_LOCATION_CHANGE_EVENT,
      ).length,
    ).toBe(1);
    expect(
      addEventListener.calls.allArgs().filter(
        ([type]) => type === 'popstate',
      ).length,
    ).toBe(1);

    window.dispatchEvent(
      new Event(ROUTER_LOCATION_CHANGE_EVENT),
    );

    expect(firstRefresh).toHaveBeenCalledTimes(1);
    expect(secondRefresh).toHaveBeenCalledTimes(1);

    first.destroy();
    window.dispatchEvent(
      new PopStateEvent('popstate'),
    );

    expect(firstRefresh).toHaveBeenCalledTimes(1);
    expect(secondRefresh).toHaveBeenCalledTimes(2);

    second.destroy();

    expect(
      removeEventListener.calls.allArgs().filter(
        ([type]) => type === ROUTER_LOCATION_CHANGE_EVENT,
      ).length,
    ).toBe(1);
    expect(
      removeEventListener.calls.allArgs().filter(
        ([type]) => type === 'popstate',
      ).length,
    ).toBe(1);
  });
});
