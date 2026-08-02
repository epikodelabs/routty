# Routty

Routty is a typed, standalone-first Angular router built around flat runtime routes, explicit layout composition, and function-based lifecycle.

Define routes once, then use those same definitions for matching, rendering, guards, data preparation, typed params and query values, `RouterLink`, and typed `navigateTo` / `hrefTo` helpers.

Routty is for teams that want Angular routing to stay readable. You author layouts naturally, but the runtime stays flat. That keeps the mental model smaller without giving up typed navigation, lazy views, lifecycle hooks, or coordinated outlets.

## Why Routty

Routty is a strong fit when you want:

- **One route definition, used everywhere.** Keep the path, route identity, params/query schemas, lifecycle, and rendering behavior together instead of splitting them across several files.
- **Flat runtime navigation state.** Layouts are UI composition, not nested route state that every feature has to understand.
- **Typed params, query values, and named navigation.** Declare schemas once and get real TypeScript types when you read route state or generate links.
- **Function-based lifecycle beside the view.** `beforeEnter`, `beforeLeave`, `prepare`, and `afterEnter` stay close to the component they affect.
- **Standalone Angular integration.** Use a router that fits modern Angular applications without a compatibility layer for older router patterns.

## Installation

```bash
npm install @epikodelabs/routty
```

Routty is built on standalone Angular APIs and is intended to work across recent Angular versions.

## Quick start

```ts
import { inject } from '@angular/core';
import {
  frame,
  layout,
  provideRouter,
  route,
  s,
  type NavigationTree,
} from '@epikodelabs/routty';

const projectRoute = route(
  '/projects/:projectId',
  frame(ProjectPage, {
    beforeEnter: [
      () =>
        inject(SessionService).authenticated()
          ? true
          : { redirectTo: '/auth/login', replace: true },
    ],
    prepare: [
      context => ({
        project: inject(ProjectStore).load(
          Number(context.params['projectId'] ?? 0),
        ),
      }),
    ],
  }),
  {
    name: 'project',
    paramsSchema: {
      projectId: s.number({ min: 1 }),
    },
    querySchema: {
      tab: s.string('overview'),
    },
  },
);

export const routes = [
  layout('/app', AppShellComponent, [projectRoute]),
] as const satisfies NavigationTree;

export const appConfig = {
  providers: [...provideRouter(routes)],
};
```

That single route definition now drives:

- URL matching
- typed params and query parsing
- auth and lifecycle behavior
- data preparation
- link generation
- programmatic navigation by route name

In templates and standalone components, use `RouterLink` and `RouterOutlet` from Routty.

## Core ideas

- **`path`** is the URL contract for matching and link generation.
- **`name`** is the symbolic identity of a primary route for typed navigation.
- **`frame`** wraps a component with `beforeEnter`, `beforeLeave`, `prepare`, and `afterEnter`.
- **`layout`** composes a shell around a set of routes without turning the runtime into a nested route tree.

Named outlets are supported, but they stay attached to a primary route and share the same path:

```ts
route('/projects/:projectId', ProjectSidebarComponent, {
  outlet: 'sidebar',
})
```

That keeps outlets as coordinated companions to one destination, not independent pages with separate navigation state.

### Typed params and queries with `s`

The `s` helper builds small route schemas:

- `s.string(default)`
- `s.number({ min, max, default })`
- `s.boolean(default)`
- `s.array(default)`
- `s.date(default)`
- `s.optional(schema)`

Attach schemas to `paramsSchema` or `querySchema`, and Routty handles parsing, defaulting, serialization, and matching TypeScript inference.

## Included helpers

Routty also exports:

- `lazyRoute(...)`
- `redirectRoute(...)`
- `lazyLayout(...)`
- `lazyFrame(...)`
- `RouterLink`
- `RouterOutlet`
- typed `navigateTo` and `hrefTo` helpers on the router instance

## Current scope

Routty is intentionally focused rather than feature-complete. Today it is best suited to standalone Angular apps that want a typed, explicit routing layer without adopting Angular Router's recursive route-state model.

Current boundaries to keep in mind:

- no `RouterModule.forRoot()` or `RouterModule.forChild()` integration
- no `loadChildren` or lazy `NgModule` boundaries
- no Angular `Route` compatibility layer
- named outlets are subordinate to a primary route and cannot behave like independent pages

Those constraints are part of the product shape, not temporary omissions. Routty is optimized for applications that want a compact router with explicit composition and a flat runtime model.

## Demo

See `projects/apps/app1/src/app/app.routes.ts` for a working reference with typed params, redirects, lazy routes, lifecycle hooks, layouts, and a coordinated `sidebar` outlet.

## Development

```bash
npm run build
npm test
```
