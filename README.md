# Routty

Routty is a typed Angular routing library for teams that want a smaller, clearer routing model — and honestly, a routing setup you enjoy opening back up six months later.

Most routing libraries spread a single route across several places: a path over here, a guard over there, data-loading somewhere else, and the component's actual behavior in a fourth file. Routty pulls all of that back together. Route matching, route identity, rendering, and lifecycle all live in one place, next to a flat route definition you can read top to bottom. No deep route tree to hold in your head — just explicit layouts, explicit routes, and function-based hooks that do exactly what they say.

If you've used Angular Router before, the shift is small but it pays off fast: fewer moving parts, fewer places to look when something breaks, and full type inference on your params, your query strings, and your generated links.

## Why Routty

Routty is a strong fit when you want:

- **Typed params and query values.** Declare a schema once and get real TypeScript types everywhere you read or generate a link — no more `params['id']` guesswork.
- **Readable route definitions that stay close to the feature.** A route and everything it needs to run — its guards, its data loading, its post-navigation behavior — sit in the same call, not scattered across a routing module.
- **Guards, preparation, and post-navigation behavior beside the route.** `beforeEnter`, `beforeLeave`, `prepare`, and `afterEnter` are just functions. Inject a service, check a condition, load some data — no special DSL to learn.
- **Layout composition and named outlets, without a deep route tree.** You get shell composition and companion outlets, without inheriting Angular Router's full nested-route model to get there.
- **A standalone-first Angular setup.** Built for the way modern Angular apps are actually structured today.

## Installation

```bash
npm install @epikodelabs/routty
```

Routty is built on standalone Angular APIs and is intended to work across recent Angular versions.

## Quick start

Here's a small, complete example. It's worth reading slowly once — every idea Routty has is visible somewhere in this one route.

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

Notice how the whole story is right there: the path, the component, the auth guard, the data it needs before it renders, and its typed params and query — all in one call to `route(...)`. Nothing about `/projects/:projectId` lives anywhere else.

In templates and standalone components, use `RouterLink` and `RouterOutlet` from Routty, the same way you would with Angular's built-in router.

## Core ideas

Routty is deliberately small. These four ideas cover essentially everything:

- **`path`** is the URL contract — what Routty matches against and what it generates when you build a link.
- **`name`** is the symbolic identity of a primary route, used for typed navigation so you can move around your app by name instead of by hand-built string.
- **`frame`** wraps a component with lifecycle behavior: `beforeEnter`, `beforeLeave`, `prepare`, and `afterEnter`. `lazyFrame(...)` does the same for a component that should be loaded on demand.
- **`layout`** composes a shell around a set of routes — navbars, side panels, anything that should wrap a group of pages. `lazyLayout(...)` is the code-split counterpart.

Named outlets are supported too, and they stay attached to a primary route and share its path, which keeps the mental model simple — a companion, not a second page:

```ts
route('/projects/:projectId', ProjectSidebarComponent, {
  outlet: 'sidebar',
})
```

### Typed params and queries, with `s`

The `s` helper builds small, declarative schemas: `s.string(default)`, `s.number({ min, max, default })`, `s.boolean(default)`, `s.array(default)`, `s.date(default)`, and `s.optional(schema)` for anything that shouldn't be required. Attach one to `paramsSchema` or `querySchema` on a route, and Routty handles parsing, defaulting, and — best of all — gives you the matching TypeScript type for free, everywhere that route is referenced.

## Included helpers

Beyond the pieces above, Routty also exports:

- `lazyRoute(...)` — a lazily-loaded route, same shape as `route(...)`
- `redirectRoute(...)` — a route that simply forwards elsewhere
- `RouterLink` — a directive for typed, template-friendly navigation
- `RouterOutlet` — where routes actually render
- typed `navigateTo` and `hrefTo` helpers on the router instance, for navigating and generating hrefs in code with full type safety

## Current scope

Routty is intentionally focused rather than feature-complete, and we think that's exactly what makes it pleasant to use. Today it's best suited to standalone Angular apps that want a typed, explicit routing layer without the weight of a full-featured router.

A few current boundaries worth knowing up front:

- no `RouterModule.forRoot()` or `RouterModule.forChild()` integration
- no `loadChildren` or lazy `NgModule` boundaries
- no Angular `Route` compatibility layer
- named outlets are subordinate to a primary route and can't behave like independent pages

None of these are accidents — they're the trade-offs that keep Routty small, typed, and easy to reason about. If your app needs the full breadth of Angular Router's feature set, this may not be the right layer yet. If it doesn't, Routty is built to feel great every day.

## Demo

See `projects/apps/app1/src/app/app.routes.ts` for a working reference with typed params, redirects, lazy routes, lifecycle hooks, and a coordinated `sidebar` outlet.

## Development

```bash
npm run build
npm test
```

We're actively growing Routty, and we're glad you're here for it.