# Routty

Routty is a typed Angular router built around **one eager route model for both server and client navigation**.

Routes are authored once and reused for URL matching, SSR, hydrated browser navigation, lifecycle, typed params and query values, layouts, named outlets, `RouterLink`, and typed `navigateTo` / `hrefTo` helpers.

Routty deliberately does not have a lazy route model. Components are part of the application build, while route preparation and lifecycle may still be asynchronous.

## Why Routty

Routty is a strong fit when you want:

- **One route catalog for server and browser.** The same route definitions drive Angular SSR and client-side navigation after hydration.
- **Flat runtime navigation state.** Layouts compose UI; they do not create recursive route state.
- **Eager, predictable route code.** There is no route loader, preload strategy, or separate lazy-route API.
- **Typed params, query values, and named navigation.** Declare schemas once and reuse their types for state and links.
- **Function-based lifecycle beside the destination.** `beforeEnter`, `beforeLeave`, `prepare`, and `afterEnter` live directly on `route()` or `layout()`.
- **Coordinated named outlets.** Companion views belong to the primary destination and commit together.

## Installation

```bash
npm install @epikodelabs/routty
```

## Quick start

```ts
import { inject } from '@angular/core';
import {
  layout,
  provideRouter,
  redirect,
  route,
  s,
  type NavigationTree,
} from '@epikodelabs/routty';

export const routes = [
  redirect('/', '/app/projects/1'),

  layout('/app', AppShellComponent, [
    route('/projects/:projectId', ProjectPage, {
      name: 'project',

      params: {
        projectId: s.number({ min: 1 }),
      },

      query: {
        tab: s.string('overview'),
      },

      outlets: {
        sidebar: ProjectSidebarComponent,
      },

      beforeEnter: () =>
        inject(SessionService).authenticated()
          ? true
          : { redirectTo: '/auth/login', replace: true },

      prepare: context => ({
        project: inject(ProjectStore).load(
          Number(context.params['projectId'] ?? 0),
        ),
      }),
    }),
  ]),
] as const satisfies NavigationTree;

export const appConfig = {
  providers: [...provideRouter(routes)],
};
```

The same `routes` value is used when Angular renders the application on the server and when the hydrated browser handles later navigation.

Your application root must import Routty's standalone outlet directive:

```ts
import { Component } from '@angular/core';
import { RouterOutlet } from '@epikodelabs/routty';

@Component({
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class AppComponent {}
```

## Public route language

Routty intentionally keeps route construction small:

- `route(path, component, options)` — define an eager destination.
- `layout(path, component, entries, options)` — compose eager UI around destinations.
- `redirect(path, target, options)` — redirect one URL to another.

There is no `lazyRoute`, `lazyLayout`, `lazyFrame`, route loader, or preloading strategy.

## Route options

A route may define:

- `name`
- `params`
- `query`
- `outlets`
- `data`
- `providers`
- `beforeEnter`
- `beforeLeave`
- `prepare`
- `afterEnter`
- `viewTransition`

Lifecycle handlers accept either one function or an array. Routty normalizes them internally.

`prepare` may be asynchronous. Its returned object is available as route data;
multiple applicable handlers merge their returned objects in execution order. Keep
lifecycle code SSR-safe: capture injected dependencies before an `await`, and do
not read browser-only globals unless the code is guarded for the server.

### Route inputs

Routty binds these component inputs when they are declared with Angular's
`input()` API or `@Input()`: `url`, `path`, `params`, `query`, `data`,
`historyState`, and `config`. Parsed params and query values are therefore
available without reading URL primitives in the component.

```ts
import { Component, input } from '@angular/core';

@Component({ standalone: true, template: '{{ params().projectId }}' })
export class ProjectPage {
  readonly params = input.required<{ projectId: number }>();
  readonly data = input<Record<string, unknown>>({});
}
```

### Named outlets

Named outlets are authored on their primary destination:

```ts
route('/projects/:projectId', ProjectPage, {
  outlets: {
    sidebar: ProjectSidebarComponent,
  },
});
```

They share the primary route's path, params, query, layouts, and navigation transaction.

### Typed links and imperative navigation

Import the standalone `RouterLink` directive for templates. Named links and
`navigateTo` calls are checked against the route catalog, including required
params and query value types.

```ts
import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@epikodelabs/routty';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <a [routerLink]="{ name: 'project', params: { projectId: 42 } }">
      Open project
    </a>
  `,
})
export class ProjectLinkComponent {
  private readonly router = inject(Router<typeof routes>);

  open(): Promise<boolean> {
    return this.router.navigateTo.project({
      params: { projectId: 42 },
      query: { tab: 'activity' },
    });
  }
}
```

`router.hrefTo.project(...)` produces the equivalent typed href. Reading
`router.state` in a template is reactive; it exposes the active route, pending
state, phase, parsed params/query, prepared data, and navigation errors.

### Typed params and queries with `s`

The `s` helper builds route schemas:

- `s.string(default)`
- `s.number({ min, max, default })`
- `s.boolean(default)`
- `s.array(default)`
- `s.date(default)`
- `s.optional(schema)`

Attach schemas through `params` and `query`. Routty handles parsing, defaults, serialization, and TypeScript inference.

## Server and client routing

Routty does not maintain separate server and browser route APIs.

On the server, Angular SSR boots the application, Routty matches the request URL, parses params/query, runs applicable lifecycle and preparation, and renders the matched route tree.

After hydration, the same route catalog handles `RouterLink`, history, redirects, revalidation, scrolling, view transitions, and outlet commits in the browser.

Routty does **not** implement server-authorized route artifact delivery. Applications that need the server to decide which route code the browser may receive should use Waypoint instead.

## Current boundaries

- eager route components only
- no `loadChildren`
- no lazy `NgModule` boundaries
- no Angular `Route` compatibility layer
- named outlets are subordinate to one primary destination
- one complete route catalog is available to both server and client

## Demo

`projects/apps/app1` demonstrates client navigation. `projects/apps/app2` demonstrates the same eager route model under Angular SSR and hydration.

## Development

```bash
npm run build
npm test
npm run build:app2
npm run serve:ssr:app2
```
