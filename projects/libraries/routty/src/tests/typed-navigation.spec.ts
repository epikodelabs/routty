import {
  layout,
  route,
  s,
  type NavigationTree,
  type Router,
} from '@epikodelabs/routty';

class DashboardLayout {}
class DashboardPage {}
class SettingsPage {}
class AuditPage {}

const dashboardRoute = route('/dashboard/:projectId', DashboardPage, {
  name: 'dashboard',
  params: {
    projectId: s.number({ min: 1 }),
  },
  query: {
    tab: s.string('overview'),
    page: s.number({ default: 1, min: 1 }),
    filters: s.array(),
    draft: s.optional(s.boolean()),
  },
});

const auditRoute = route('/audit/:entryId', AuditPage, {
  name: 'audit',
});

const settingsRoute = route('/settings', SettingsPage, {
  name: 'settings',
  query: {
    section: s.string('general'),
  },
});

const routes = [
  layout('/app', DashboardLayout, [
    settingsRoute,
    auditRoute,
    dashboardRoute,
  ]),
] as const satisfies NavigationTree;

function assertNavigationPromise(_navigation: Promise<boolean>): void {}

function assertHrefValue(_href: string | null): void {}

function assertNamedNavigation(router: Router<typeof routes>): void {
  assertNavigationPromise(router.navigateTo.dashboard({
    params: { projectId: 123 },
  }));

  assertNavigationPromise(router.navigateTo.dashboard({
    params: { projectId: 123 },
    query: {
      tab: 'settings',
      page: 2,
      filters: ['a', 'b'],
      draft: true,
    },
  }));

  assertNavigationPromise(router.navigateTo.audit({
    params: { entryId: 'evt-42' },
  }));

  // @ts-expect-error schema-less path parameters remain strings
  assertNavigationPromise(router.navigateTo.audit({ params: { entryId: 42 } }));

  // @ts-expect-error literal path requires entryId
  assertNavigationPromise(router.navigateTo.audit({ params: {} }));

  assertNavigationPromise(router.navigateTo.settings({
    query: { section: 'billing' },
  }));

  const href = router.hrefTo.dashboard({
    params: { projectId: 123 },
    query: { tab: 'overview' },
  });

  const typedHref: string | null = href;
  assertHrefValue(typedHref);

  // @ts-expect-error route name must exist in the configured layout tree
  assertNavigationPromise(router.navigateTo.missing());
}

describe('typed routes typings', () => {
  it('discovers named leaf routes nested inside layouts', () => {
    expect(typeof assertNamedNavigation).toBe('function');
  });
});

route('/users/:userId', DashboardPage, {
  // @ts-expect-error params keys must come from the literal route path
  params: { accountId: s.number() },
});

route('/teams/:teamId/users/:userId', DashboardPage, {
  // @ts-expect-error params must declare every literal path parameter
  params: { teamId: s.number() },
});

route('/health', DashboardPage, {
  // @ts-expect-error routes without path parameters cannot declare params
  params: { id: s.string() },
});