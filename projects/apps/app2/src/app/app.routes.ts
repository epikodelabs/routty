import {
  frame,
  lazyRoute,
  layout,
  redirectRoute,
  route,
  s,
  type NavigationTree,
} from '@epikodelabs/routty';

import {
  AboutPage,
  AppShellComponent,
  IntroPage,
  ProjectPage,
  ProjectSidebarComponent,
  ReportsSidebarComponent,
} from './demo-pages';

const PROJECTS = new Map([
  [
    101,
    {
      name: 'Atlas',
      owner: 'Infrastructure',
      status: 'Stable rollout',
      summary:
        'SSR-safe project dashboard used to verify typed params, query parsing, and prepared route data.',
    },
  ],
  [
    202,
    {
      name: 'Beacon',
      owner: 'Growth',
      status: 'Metrics review',
      summary:
        'Companion scenario for query-only tab switches and named navigation links.',
    },
  ],
]);

const projectRoute = route(
  '/projects/:projectId',
  frame(ProjectPage, {
    prepare: [
      context => {
        const projectId = Number(context.params['projectId'] ?? 0);
        const project =
          PROJECTS.get(projectId)
          ?? {
            name: `Project ${projectId}`,
            owner: 'Unknown',
            status: 'Ad hoc preview',
            summary:
              'Generated fallback record for ids outside the demo catalog.',
          };

        return {
          project,
          highlights: [
            'Rendered through Routty on both server and client',
            'Params and query values parsed once from the route definition',
            'Sidebar outlet committed together with the primary page',
          ],
        };
      },
    ],
  }),
  {
    name: 'project',
    paramsSchema: {
      projectId: s.number({ min: 1 }),
    },
    querySchema: {
      tab: s.string('overview'),
      filter: s.optional(s.string()),
    },
  },
);

export const routes = [
  route('/', IntroPage),
  redirectRoute(
    '/legacy',
    '/app/projects/101?tab=activity&filter=recent',
  ),
  layout('/app', AppShellComponent, [
    redirectRoute('', '/app/projects/101?tab=overview'),
    projectRoute,
    route('/projects/:projectId', ProjectSidebarComponent, {
      outlet: 'sidebar',
    }),
    lazyRoute(
      '/reports',
      () =>
        import('./reports.page')
          .then(module => module.ReportsPage),
      {
        name: 'reports',
      },
    ),
    route('/reports', ReportsSidebarComponent, {
      outlet: 'sidebar',
    }),
    route('/about', AboutPage, {
      name: 'about',
    }),
  ]),
] as const satisfies NavigationTree;
