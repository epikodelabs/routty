# Routty

Routty is a typed Angular routing library for teams that want a smaller, clearer routing model.

It keeps route matching, route identity, rendering, and lifecycle in one place, with flat route definitions, explicit layouts, and function-based hooks.

## Why Routty

Routty is a strong fit when you want:

- typed params and query values
- readable route definitions that stay close to the feature
- guards, preparation, and post-navigation behavior beside the route
- layout composition and named outlets without a deep route tree
- a standalone-first Angular setup

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

In templates and standalone components, use `RouterLink` and `RouterOutlet` from Routty.

## Core ideas

- `path` is the URL contract for matching and link generation
- `name` is the symbolic identity of a primary route for typed navigation
- `frame` wraps a component with `beforeEnter`, `beforeLeave`, `prepare`, and `afterEnter`
- `layout` composes a shell around a set of routes

Named outlets are supported, but they stay attached to a primary route and share the same path:

```ts
route('/projects/:projectId', ProjectSidebarComponent, {
  outlet: 'sidebar',
})
```

## Included helpers

Routty also exports:

- `lazyRoute(...)`
- `redirectRoute(...)`
- `RouterLink`
- `RouterOutlet`
- typed `navigateTo` and `hrefTo` helpers on the router instance

## Current scope

Routty is intentionally focused rather than feature-complete. Today it is best suited to standalone Angular apps that want a typed, explicit routing layer.

Current boundaries to keep in mind:

- no `RouterModule.forRoot()` or `RouterModule.forChild()` integration
- no `loadChildren` or lazy `NgModule` boundaries
- no Angular `Route` compatibility layer
- named outlets are subordinate to a primary route and cannot behave like independent pages

## Demo

See `projects/apps/app1/src/app/app.routes.ts` for a working reference with typed params, redirects, lazy routes, lifecycle hooks, and a coordinated `sidebar` outlet.

## Development

```bash
npm run build
npm test
```
