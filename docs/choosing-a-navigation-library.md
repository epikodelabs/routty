\# Choosing a Navigation Library



The navigation ecosystem consists of three libraries with a shared philosophy but different navigation models.



They intentionally solve different problems.



All three libraries share the same design principles:



\- typed navigation

\- builder-style APIs

\- layouts

\- frames

\- typed params and query schemas

\- standalone-first Angular

\- function-based lifecycle

\- modern TypeScript



If you've learned one, the others will feel familiar.



The difference is \*\*how navigation itself is modeled\*\*.



\---



\# Waypoint



\*\*General-purpose navigation for Angular applications.\*\*



Waypoint is the library you'll reach for most often.



It models applications around URLs and destinations while keeping navigation strongly typed and explicit.



Use Waypoint when your application needs:



\- deep linking

\- browser history

\- layouts

\- lazy loading

\- typed URLs

\- route lifecycle

\- server-driven navigation

\- named outlets



Waypoint is designed to feel familiar while reducing the amount of infrastructure required to describe a destination.



\---



\# Routty



\*\*The smallest possible router.\*\*



Routty focuses on simplicity.



Instead of supporting every navigation scenario, it embraces flat route definitions with a tiny API surface.



Choose Routty when you want:



\- minimal bundle size

\- flat route tables

\- straightforward applications

\- libraries

\- demos

\- internal tools



If your application doesn't need advanced navigation concepts, Routty keeps everything intentionally small.



\---



\# Switchboard



\*\*Navigation as a graph.\*\*



Switchboard isn't centered around URLs.



Instead, applications are described as states connected by transitions.



Navigation becomes moving through a graph rather than matching paths.



This model is particularly well suited for:



\- onboarding

\- checkout

\- installers

\- editors

\- workflow systems

\- kiosk applications

\- embedded applications

\- state-driven experiences



Instead of asking



> "Which URL should I navigate to?"



you ask



> "Which state can I transition to?"



\---



\# Shared vocabulary



Although the navigation models differ, the ecosystem deliberately shares the same language.



```ts

route(...)

layout(...)

frame(...)

lazyRoute(...)

redirect(...)

```



Schemas are identical.



```ts

s.string(...)

s.number(...)

s.boolean(...)

s.array(...)

```



Lifecycle concepts remain familiar.



Moving between libraries shouldn't require relearning the API.



\---



\# Which library should I choose?



| If your application... | Choose |

|-------------------------|--------|

| is a typical Angular application | \*\*Waypoint\*\* |

| needs the smallest possible router | \*\*Routty\*\* |

| is built around workflows or state transitions | \*\*Switchboard\*\* |



Most applications should start with \*\*Waypoint\*\*.



Choose \*\*Routty\*\* when simplicity is the primary goal.



Choose \*\*Switchboard\*\* when navigation itself is part of the application's business logic.



\---



\# One philosophy, different models



These libraries are not "editions" of the same router.



Each explores a different way of thinking about navigation.



Waypoint asks:



> Which destination does this URL represent?



Routty asks:



> What's the simplest way to reach this destination?



Switchboard asks:



> Which transition is valid from the current state?



They share a common philosophy, but intentionally optimize for different problems.

