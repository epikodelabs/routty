export const OUTLET_ACTIVATE_EVENT = 'vanilla-router-activate';
export const OUTLET_DEACTIVATE_EVENT = 'vanilla-router-deactivate';
export const ROUTER_LOCATION_CHANGE_EVENT = 'vanilla-router-locationchange';

const OUTLET_QUERY = 'router-outlet';

function isOutletElement(
  element: HTMLElement,
  targetName: string,
): boolean {
  const tagName = element.tagName.toLowerCase();
  if (
    tagName !== 'router-outlet'
  ) {
    return false;
  }

  return (element.getAttribute('name') ?? '') === targetName;
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

export function findOutlet(
  node: Node,
  name?: string | null,
): HTMLElement | null {
  if (!(node instanceof Element || node instanceof DocumentFragment)) {
    return null;
  }

  const targetName = name ?? '';

  if (
    node instanceof HTMLElement &&
    isOutletElement(node, targetName)
  ) {
    return node;
  }

  return (
    Array.from(
      node.querySelectorAll<HTMLElement>(OUTLET_QUERY),
    ).find(element =>
      isOutletElement(element, targetName),
    ) ?? null
  );
}

export function findContainingOutlet(
  node: Element,
): HTMLElement | null {
  return node.closest<HTMLElement>(OUTLET_QUERY);
}
