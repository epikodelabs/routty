import type { HistoryUpdate } from './history';
import type {
  ActiveRender,
  NavigationCompletion,
  NavigationResult,
  PreparedOutlet,
} from './navigation-executor';
import type {
  ActivatedRoute,
  Route,
  ViewTransitionContext,
} from './vanilla-router';

export interface NavigationCommitContext {
  readonly disposed: () => boolean;
  readonly latestRequestId: () => number;
  readonly maxRedirects: number;
  readonly currentRoute: () => ActivatedRoute | null;
  readonly setCurrentRoute: (route: ActivatedRoute | null) => void;
  readonly clearPendingState: () => void;
  readonly setError: (error: unknown) => void;

  readonly runWithViewTransition: (
    context: ViewTransitionContext,
    action: () => void,
  ) => void;

  readonly customCommit?: (
    outlets: readonly PreparedOutlet[],
  ) => void;
  readonly render: (
    outletName: string,
    node: Node,
    route: ActivatedRoute,
  ) => void;
  readonly renderPrimary: (
    node: Node,
    route: ActivatedRoute,
  ) => void;
  readonly renderNotFound: (url: URL) => void;
  readonly renderError: (error: unknown, url: URL) => void;
  readonly resolveOutlet: () => HTMLElement | null;
  readonly notifyOutletActivate: (
    outlet: HTMLElement,
    component: unknown,
  ) => void;

  readonly activeRenders: Map<string, ActiveRender>;
  readonly activeRoutes: Map<string, ActivatedRoute>;
  readonly disposeRender: (render: ActiveRender | null) => void;
  readonly replaceActiveRender: (
    outletName: string,
    render: ActiveRender | null,
  ) => void;
  readonly disposeAllRenders: () => void;

  readonly commitHistory: (
    update: HistoryUpdate,
    href: string,
  ) => void;
  readonly rollbackHistory: (
    update: HistoryUpdate,
  ) => void;
  readonly createHistoryUpdate: (
    href: string,
    replace: boolean,
    state: unknown,
  ) => HistoryUpdate;
  readonly readHistoryState: () => unknown;
  readonly writeHistory: (
    href: string,
    replace: boolean,
    state: unknown,
    update: HistoryUpdate,
  ) => void;
  readonly dispatchLocationChange: () => void;

  readonly resolveAppUrl: (target: string) => URL;
  readonly currentOrigin: () => string;
  readonly requestNavigation: (
    url: URL,
    redirectCount: number,
    completion: NavigationCompletion,
    historyUpdate: HistoryUpdate,
  ) => void;
  readonly requestExternalNavigation: (
    url: URL,
    completion: NavigationCompletion,
    historyUpdate: HistoryUpdate,
  ) => void;

  readonly restoreActiveUrl: () => void;
  readonly restoreScroll: (update: HistoryUpdate) => void;
  readonly restorePreviousScroll: (update: HistoryUpdate) => void;
  readonly settleRequest: (
    completion: NavigationCompletion,
    success: boolean,
  ) => void;
  readonly notifyStateChange: () => void;
  readonly runAfterEnterTransitions: (
    from: ActivatedRoute | null,
    to: ActivatedRoute,
  ) => void;
  readonly dispatchRouteChange: (route: ActivatedRoute) => void;
  readonly trace: (message: string, ...values: unknown[]) => void;
}

export function commitNavigation(
  result: NavigationResult,
  context: NavigationCommitContext,
): void {
  if (
    context.disposed()
    || result.request.id !== context.latestRequestId()
  ) {
    disposePreparedResult(result);
    return;
  }

  switch (result.type) {
    case 'success':
      commitSuccess(result, context);
      return;

    case 'redirect':
      commitRedirect(result, context);
      return;

    case 'blocked':
      context.restoreActiveUrl();
      context.rollbackHistory(result.request.historyUpdate);
      context.clearPendingState();
      context.setError(null);
      context.trace('Navigation blocked');
      context.restorePreviousScroll(result.request.historyUpdate);
      context.settleRequest(result.request.completion, false);
      context.notifyStateChange();
      return;

    case 'not-found':
      commitNotFound(result, context);
      return;

    case 'error':
      commitError(result, context);
      return;
  }
}

function commitSuccess(
  result: Extract<NavigationResult, { readonly type: 'success' }>,
  context: NavigationCommitContext,
): void {
  const previousRoute = context.currentRoute();

  context.runWithViewTransition({
    url: result.request.url,
    from: previousRoute,
    to: result.route,
    phase: 'success',
    routeConfig: result.route.config,
  }, () => commitPreparedOutlets(result.outlets, context));

  context.commitHistory(
    result.request.historyUpdate,
    hrefOf(result.request.url),
  );
  context.setCurrentRoute(result.route);
  context.clearPendingState();
  context.setError(null);
  context.dispatchRouteChange(result.route);
  context.trace('Navigation completed', result.route.path);
  context.restoreScroll(result.request.historyUpdate);
  context.settleRequest(result.request.completion, true);
  context.notifyStateChange();
  context.runAfterEnterTransitions(previousRoute, result.route);
}

function commitPreparedOutlets(
  outlets: readonly PreparedOutlet[],
  context: NavigationCommitContext,
): void {
  const customCommit = context.customCommit;
  const nextNames = new Set(outlets.map(outlet => outlet.name));

  // A custom group commit remains atomic: old renders stay active until the
  // complete group has committed successfully. The built-in/per-outlet
  // renderer disposes old views first so disposal hooks still observe the
  // view attached to its outlet.
  if (!customCommit) {
    for (const render of context.activeRenders.values()) {
      context.disposeRender(render);
    }
    context.activeRenders.clear();
    context.activeRoutes.clear();
  }

  try {
    if (customCommit) {
      customCommit(outlets);
    } else {
      for (const outlet of outlets) {
        if (outlet.name === '') {
          context.renderPrimary(outlet.node, outlet.route);
        } else {
          context.render(outlet.name, outlet.node, outlet.route);
        }
      }
    }
  } catch (error) {
    for (const outlet of outlets) {
      outlet.rendered.dispose();
    }
    throw error;
  }

  if (customCommit) {
    for (const name of context.activeRenders.keys()) {
      if (!nextNames.has(name)) {
        context.replaceActiveRender(name, null);
        context.activeRoutes.delete(name);
      }
    }
  }

  for (const outlet of outlets) {
    if (customCommit) {
      context.replaceActiveRender(outlet.name, outlet.rendered);
    } else {
      context.activeRenders.set(outlet.name, outlet.rendered);
    }
    context.activeRoutes.set(outlet.name, outlet.route);

    if (!customCommit && outlet.name === '') {
      const target = outlet.node.parentElement ?? context.resolveOutlet();
      if (target) {
        context.notifyOutletActivate(target, outlet.component);
      }
    }
  }
}

function commitRedirect(
  result: Extract<NavigationResult, { readonly type: 'redirect' }>,
  context: NavigationCommitContext,
): void {
  if (result.request.redirectCount >= context.maxRedirects) {
    commitNavigation({
      type: 'error',
      request: result.request,
      error: new Error(
        `Maximum redirect count of ${context.maxRedirects} exceeded`,
      ),
    }, context);
    return;
  }

  const url = context.resolveAppUrl(result.redirectTo);
  if (url.origin !== context.currentOrigin()) {
    context.requestExternalNavigation(
      url,
      result.request.completion,
      result.request.historyUpdate,
    );
    return;
  }

  const href = hrefOf(url);
  const state = context.readHistoryState();
  const update = context.createHistoryUpdate(
    href,
    result.replace,
    state,
  );

  context.writeHistory(href, result.replace, state, update);
  context.dispatchLocationChange();
  context.requestNavigation(
    url,
    result.request.redirectCount + 1,
    result.request.completion,
    update,
  );
}

function commitNotFound(
  result: Extract<NavigationResult, { readonly type: 'not-found' }>,
  context: NavigationCommitContext,
): void {
  context.runWithViewTransition({
    url: result.request.url,
    from: context.currentRoute(),
    to: null,
    phase: 'not-found',
    routeConfig: null,
  }, () => {
    context.renderNotFound(result.request.url);
    context.disposeAllRenders();
  });

  context.commitHistory(
    result.request.historyUpdate,
    hrefOf(result.request.url),
  );
  context.setCurrentRoute(null);
  context.clearPendingState();
  context.setError(null);
  context.trace('Route not found', result.request.url.pathname);
  context.restoreScroll(result.request.historyUpdate);
  context.settleRequest(result.request.completion, false);
  context.notifyStateChange();
}

function commitError(
  result: Extract<NavigationResult, { readonly type: 'error' }>,
  context: NavigationCommitContext,
): void {
  context.restoreActiveUrl();

  if (!result.preserveActive) {
    context.runWithViewTransition({
      url: result.request.url,
      from: context.currentRoute(),
      to: null,
      phase: 'error',
      routeConfig: null,
      error: result.error,
    }, () => {
      context.renderError(result.error, result.request.url);
      context.disposeAllRenders();
    });
  }

  context.rollbackHistory(result.request.historyUpdate);
  if (!result.preserveActive) {
    context.setCurrentRoute(null);
  }
  context.clearPendingState();
  context.setError(result.error);
  context.trace('Navigation failed', result.error);
  context.restorePreviousScroll(result.request.historyUpdate);
  context.settleRequest(result.request.completion, false);
  context.notifyStateChange();
}

function disposePreparedResult(result: NavigationResult): void {
  if (result.type !== 'success') {
    return;
  }

  for (const outlet of result.outlets) {
    outlet.rendered.dispose();
  }
}

function hrefOf(url: URL): string {
  return url.pathname + url.search + url.hash;
}
