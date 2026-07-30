export const OUTLET_ACTIVATE_EVENT = 'vanilla-router-activate';
export const OUTLET_DEACTIVATE_EVENT = 'vanilla-router-deactivate';
export const ROUTER_LOCATION_CHANGE_EVENT = 'vanilla-router-locationchange';

function isOutletElement(
  node: Element,
): node is HTMLElement {
  const tagName =
    node.tagName.toLowerCase();

  return tagName === 'router-outlet';
}

export function dispatchOutletLifecycleEvent(
  target: EventTarget,
  type: typeof OUTLET_ACTIVATE_EVENT | typeof OUTLET_DEACTIVATE_EVENT,
  component: unknown,
): void {
  target.dispatchEvent(new CustomEvent(type, { detail: component }));
}

export function dispatchRouterLocationChange(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(ROUTER_LOCATION_CHANGE_EVENT));
}

/**
 * Finds a router outlet inside a node.
 *
 * - name === undefined | null | '' -> primary (unnamed) outlet
 * - name provided -> looks for router-outlet[name="..."]
 */
export function findOutlet(
  node: Node,
  name?: string | null,
): HTMLElement | null {
  if (
    !(
      node instanceof Element ||
      node instanceof DocumentFragment
    )
  ) {
    return null;
  }

  const targetName =
    name ?? '';

  if (
    node instanceof HTMLElement &&
    isOutletElement(node) &&
    (node.getAttribute('name') ?? '') === targetName
  ) {
    return node;
  }

  return (
    Array.from(
      node.querySelectorAll<HTMLElement>(
        'router-outlet',
      ),
    ).find(
      element =>
        isOutletElement(element) &&
        (element.getAttribute('name') ?? '') === targetName,
    ) ?? null
  );
}

export function findContainingOutlet(
  node: Node,
): HTMLElement | null {
  let current: Node | null = node;

  while (current) {
    if (
      current instanceof HTMLElement &&
      isOutletElement(current)
    ) {
      return current;
    }

    current =
      current.parentNode ??
      ((current as ShadowRoot).host ?? null);
  }

  return null;
}
