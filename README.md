# Routty

Routty is a typed Angular routing workspace built around a smaller routing model: flat route definitions, explicit layout composition, and function-based lifecycle hooks.

This repository contains the library itself and a set of small apps used to exercise real navigation flows.

## What is in this repository

- `projects/libraries/routty` contains the published library source for `@epikodelabs/routty`
- `projects/apps/app1` is the main playground for browser navigation scenarios
- `projects/apps/app2` is an additional application target used by the workspace

## Quick start

Install dependencies:

```bash
npm install
```

Run the main playground:

```bash
npm run start:playground
```

Build the library:

```bash
npm run build
```

Run the library test suite:

```bash
npm test
```

## Playground coverage

The main playground in `projects/apps/app1` demonstrates:

- flat layout composition under `/app`
- typed params and query parsing on `/app/workspace/:projectId`
- grouped named outlets with a persistent sidebar outlet
- redirects through `/legacy` and the `/app` index route
- lazy component loading on `/app/reports`
- `beforeEnter`, `beforeLeave`, and `prepare` hooks on protected and stateful routes
- typed links and typed programmatic navigation

Build the playground separately with:

```bash
npm run build:playground
```

## Design boundaries

Routty is intentionally narrower than Angular Router. The library is a better fit when you want:

- a standalone-first router setup
- typed route params and query parsing
- route behavior kept close to the route definition
- explicit layout and named-outlet composition without a deep route tree

It is a worse fit when you need broad Angular Router feature parity. Current tradeoffs include:

- no `RouterModule.forRoot()` or `RouterModule.forChild()` integration
- no `loadChildren` or lazy `NgModule` boundaries
- no class-based guards or resolvers
- no compatibility layer for Angular `Route` objects
- named outlets are subordinate to a primary route and cannot act as independent pages

## Documentation

The main library documentation lives in [`projects/libraries/routty/README.md`](projects/libraries/routty/README.md).
