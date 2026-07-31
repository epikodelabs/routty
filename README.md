# Switchboard

This workspace includes a manual route playground app under `apps/route-playground` for checking real browser navigation scenarios against the Switchboard library.

## Playground

Run the sample app with:

```bash
npm run start:playground
```

The playground covers:

- flat layout composition under `/app`
- typed params and query parsing on `/app/workspace/:projectId`
- grouped named outlets with a persistent sidebar outlet
- redirects through `/legacy` and the `/app` index route
- lazy component loading on `/app/reports`
- `beforeEnter` and `beforeLeave` behavior on `/app/admin` and `/app/editor/:draftId`

Build the sample app with:

```bash
npm run build:playground
```

## Library

Build the Switchboard library with:

```bash
npm run build
```

Run the existing library tests with:

```bash
npm test
```
