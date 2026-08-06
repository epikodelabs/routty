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
  paramsSchema: {
    projectId: s.number({ min: 1 }),
  },
  querySchema: {
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
  querySchema: {
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

function assertNamedNavigation(router: Router<typeof routes>): void {
  void router.navigateTo.dashboard({
    params: { projectId: 123 },
  });

  void router.navigateTo.dashboard({
    params: { projectId: 123 },
    query: {
      tab: 'settings',
      page: 2,
      filters: ['a', 'b'],
      draft: true,
    },
  });

  void router.navigateTo.audit({
    params: { entryId: 'evt-42' },
  });

  // @ts-expect-error schema-less path parameters remain strings
  void router.navigateTo.audit({ params: { entryId: 42 } });

  // @ts-expect-error literal path requires entryId
  void router.navigateTo.audit({ params: {} });

  void router.navigateTo.settings({
    query: { section: 'billing' },
  });

  const href = router.hrefTo.dashboard({
    params: { projectId: 123 },
    query: { tab: 'overview' },
  });

  const typedHref: string | null = href;
  void typedHref;

  // @ts-expect-error route name must exist in the configured layout tree
  void router.navigateTo.missing();
}

describe('typed routes typings', () => {
  it('discovers named leaf routes nested inside layouts', () => {
    expect(typeof assertNamedNavigation).toBe('function');
  });
});

// @ts-expect-error paramsSchema keys must come from the literal route path
route('/users/:userId', DashboardPage, {
  paramsSchema: { accountId: s.number() },
});

// @ts-expect-error paramsSchema must declare every literal path parameter
route('/teams/:teamId/users/:userId', DashboardPage, {
  paramsSchema: { teamId: s.number() },
});

// @ts-expect-error routes without path parameters cannot declare paramsSchema
route('/health', DashboardPage, {
  paramsSchema: { id: s.string() },
});