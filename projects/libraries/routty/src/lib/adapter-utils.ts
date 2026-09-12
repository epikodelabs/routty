import {
  type DestroyRef,
  type EnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';

import { ROUTER_LOCATION_CHANGE_EVENT } from './router-events';

export type MaybePromise<T> = T | PromiseLike<T>;

/**
 * Invokes a handler inside Angular's synchronous injection context.
 *
 * The handler may call inject() during its initial synchronous execution.
 * Dependencies needed after an await boundary must be captured before the
 * handler yields, because Angular does not preserve injection context across
 * arbitrary asynchronous continuations.
 */
export function runWithInjector<TContext, TResult>(
  injector: EnvironmentInjector,
  handler: (context: TContext) => MaybePromise<TResult>,
  context: TContext,
): Promise<TResult> {
  return runInInjectionContext(injector, () => Promise.resolve(handler(context)));
}

const routerLocationSubscribers = new Set<() => void>();
let routerLocationListenersInstalled = false;

function notifyRouterLocationSubscribers(): void {
  for (const subscriber of [...routerLocationSubscribers]) {
    subscriber();
  }
}

function installRouterLocationListeners(): void {
  if (
    routerLocationListenersInstalled
    || typeof window === 'undefined'
  ) {
    return;
  }

  window.addEventListener(
    ROUTER_LOCATION_CHANGE_EVENT,
    notifyRouterLocationSubscribers,
  );
  window.addEventListener(
    'popstate',
    notifyRouterLocationSubscribers,
  );
  routerLocationListenersInstalled = true;
}

function uninstallRouterLocationListeners(): void {
  if (
    !routerLocationListenersInstalled
    || typeof window === 'undefined'
  ) {
    return;
  }

  window.removeEventListener(
    ROUTER_LOCATION_CHANGE_EVENT,
    notifyRouterLocationSubscribers,
  );
  window.removeEventListener(
    'popstate',
    notifyRouterLocationSubscribers,
  );
  routerLocationListenersInstalled = false;
}

export function watchRouterLocation(
  destroyRef: DestroyRef,
  refresh: () => void,
): void {
  if (typeof window === 'undefined') {
    return;
  }

  const subscriber = () => refresh();
  routerLocationSubscribers.add(subscriber);
  installRouterLocationListeners();

  destroyRef.onDestroy(() => {
    routerLocationSubscribers.delete(subscriber);

    if (routerLocationSubscribers.size === 0) {
      uninstallRouterLocationListeners();
    }
  });
}
