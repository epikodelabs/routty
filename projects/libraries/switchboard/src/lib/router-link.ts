import {
  DOCUMENT,
} from '@angular/common';

import {
  DestroyRef,
  Directive,
  ElementRef,
  HostBinding,
  HostListener,
  Input,
  OnChanges,
  inject,
} from '@angular/core';

import {
  getRouterLocation,
} from './router-url';

import {
  watchRouterLocation,
} from './adapter-utils';

import type {
  NavigationTarget,
  PathNavigationTarget,
} from './navigation-types';

import { StreamixRouter } from './streamix-router';

type RouterLinkCommands =
  readonly unknown[];

type RouterLinkInput =
  | NavigationTarget
  | RouterLinkCommands
  | null
  | undefined;

function buildPathFromCommands(
  commands: RouterLinkCommands,
): string {
  if (commands.length === 0) {
    return '';
  }

  let path = '';

  for (const command of commands) {
    if (command === null || command === undefined) {
      continue;
    }

    const segment =
      String(command).trim();

    if (!segment) {
      continue;
    }

    if (!path) {
      path = segment;
      continue;
    }

    path =
      `${path.replace(/\/+$/, '')}/${segment.replace(/^\/+/, '')}`;
  }

  return path;
}

function appendQueryParams(
  url: URL,
  queryParams:
    Readonly<Record<string, unknown>>,
): void {
  url.search = '';

  for (const [key, value] of Object.entries(queryParams)) {
    if (value === null || value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry === null || entry === undefined) {
          continue;
        }

        url.searchParams.append(key, String(entry));
      }

      continue;
    }

    url.searchParams.set(key, String(value));
  }
}

@Directive({
  selector: 'a[routerLink],area[routerLink]',
  standalone: true,
})
export class StreamixRouterLink implements OnChanges {
  private readonly router = inject(StreamixRouter);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly element = inject(
    ElementRef<HTMLAnchorElement | HTMLAreaElement>,
  ).nativeElement;

  @Input() routerLink: RouterLinkInput;
  @Input() queryParams:
    Readonly<Record<string, unknown>> |
    null |
    undefined;
  @Input() fragment: string | null | undefined;
  @Input() state: unknown;
  @Input() replaceUrl = false;

  @HostBinding('attr.href')
  href: string | null = null;

  constructor() {
    watchRouterLocation(
      this.destroyRef,
      () => this.refreshHref(),
    );
  }

  ngOnChanges(): void {
    this.refreshHref();
  }

  @HostListener('click', ['$event'])
  handleClick(event: Event): void {
    if (!(event instanceof MouseEvent)) {
      return;
    }

    if (!this.href) {
      return;
    }

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    if (
      this.element.target &&
      this.element.target !== '_self'
    ) {
      return;
    }

    if (
      this.element.hasAttribute('download') ||
      this.element.rel
        .split(/\s+/)
        .includes('external')
    ) {
      return;
    }

    event.preventDefault();
    void this.router.navigate(
      this.href,
      {
        replace: this.replaceUrl,
        state: this.state,
      },
    );
  }

  private refreshHref(): void {
    const target =
      this.resolveTarget();

    if (!target) {
      this.href = null;
      return;
    }

    const href =
      this.router.href(target);

    if (!href) {
      this.href = null;
      return;
    }

    if (
      !this.queryParams &&
      this.fragment === undefined
    ) {
      this.href = href;
      return;
    }

    const url =
      new URL(
        href,
        getRouterLocation(this.document).origin,
      );

    if (this.queryParams) {
      appendQueryParams(
        url,
        this.queryParams,
      );
    }

    if (this.fragment !== undefined) {
      url.hash = this.fragment
        ? `#${this.fragment.replace(/^#/, '')}`
        : '';
    }

    this.href =
      `${url.pathname}${url.search}${url.hash}`;
  }

  private resolveTarget():
    NavigationTarget | null {
    const link =
      this.routerLink;

    if (link === null || link === undefined) {
      return null;
    }

    if (Array.isArray(link)) {
      return this.withQueryParams({
        path: buildPathFromCommands(link),
      });
    }

    if (
      typeof link === 'string' ||
      link instanceof URL
    ) {
      return this.withQueryParams(
        link,
      );
    }

    if ('name' in link) {
      return {
        ...link,
        query:
          this.queryParams
            ? {
                ...(link.query ?? {}),
                ...this.queryParams,
              }
            : link.query,
      };
    }

    return this.withQueryParams(
      link as PathNavigationTarget,
    );
  }

  private withQueryParams(
    target:
      string |
      URL |
      PathNavigationTarget,
  ): NavigationTarget {
    if (!this.queryParams) {
      return target;
    }

    const href =
      typeof target === 'string'
        ? target
        : target instanceof URL
          ? target.href
          : target.path;

    const url =
      new URL(
        href,
        getRouterLocation(this.document).href,
      );

    appendQueryParams(
      url,
      this.queryParams,
    );

    if (this.fragment !== undefined) {
      url.hash = this.fragment
        ? `#${this.fragment.replace(/^#/, '')}`
        : '';
    }

    return {
      path:
        `${url.pathname}${url.search}${url.hash}`,
    };
  }
}

export { StreamixRouterLink as RouterLink };
