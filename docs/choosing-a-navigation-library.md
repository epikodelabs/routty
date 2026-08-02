# Choosing a Navigation Library

The navigation ecosystem has three libraries with a shared philosophy but different navigation models.

They intentionally solve different problems.

All three libraries share the same design principles:

- typed navigation
- builder-style APIs
- layouts
- frames
- typed params and query schemas
- standalone-first Angular
- function-based lifecycle
- modern TypeScript

If you learn one, the others should feel familiar. The difference is how navigation itself is modeled.

---

# Waypoint

**General-purpose navigation for Angular applications.**

Waypoint is the library most teams should reach for first.

It models applications around URLs and destinations while keeping navigation strongly typed and explicit.

Use Waypoint when your application needs:

- deep linking
- browser history
- layouts
- lazy loading
- typed URLs
- route lifecycle
- server-driven navigation
- named outlets

Waypoint is designed to feel familiar while reducing the amount of infrastructure required to describe a destination.

---

# Routty

**A compact, typed Angular router with a flat runtime model.**

Routty is for applications that want URL-driven navigation, explicit layouts, typed route definitions, and a smaller runtime mental model.

Its core promise is simple:

> Define routes once, then use those same definitions everywhere.

In Routty, route definitions drive matching, rendering, guards, data preparation, typed params and query values, link generation, and named navigation helpers.

Choose Routty when you want:

- flat runtime navigation state
- explicit layout composition
- typed params and query values
- function-based lifecycle beside the view
- named navigation by route name
- companion outlets attached to one primary destination

Routty is not trying to be the smallest possible router. It is trying to be a clear, compact router with strong typing and explicit composition.

---

# Switchboard

**Navigation as a graph.**

Switchboard is not centered around URLs.

Instead, applications are described as states connected by transitions.

Navigation becomes moving through a graph rather than matching paths.

This model is particularly well suited for:

- onboarding
- checkout
- installers
- editors
- workflow systems
- kiosk applications
- embedded applications
- state-driven experiences

Instead of asking:

> Which URL should I navigate to?

You ask:

> Which state can I transition to?

---

# Shared vocabulary

Although the navigation models differ, the ecosystem deliberately shares the same language.

```ts
route(...)
layout(...)
frame(...)
lazyRoute(...)
redirectRoute(...)
```

Schemas are identical:

```ts
s.string(...)
s.number(...)
s.boolean(...)
s.array(...)
```

Lifecycle concepts remain familiar.

Moving between libraries should not require relearning the public API from scratch.

---

# Which library should I choose?

| If your application... | Choose |
| ---------------------- | ------ |
| is a typical Angular application | **Waypoint** |
| wants flat URL routing with explicit composition | **Routty** |
| is built around workflows or state transitions | **Switchboard** |

Most applications should start with **Waypoint**.

Choose **Routty** when you want client-owned URL routing with flat runtime state and a route definition that stays usable everywhere.

Choose **Switchboard** when navigation itself is part of the application's business logic.

---

# One philosophy, different models

These libraries are not editions of the same router.

Each explores a different way of thinking about navigation.

Waypoint asks:

> Which destination does this URL represent?

Routty asks:

> How do I keep navigation flat while still composing the UI explicitly?

Switchboard asks:

> Which transition is valid from the current state?

They share a common philosophy, but intentionally optimize for different problems.
