import {
  layout,
  redirect,
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
import { ReportsPage } from './reports.page';

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

export const routes = [
  route('/', IntroPage),
  redirect(
    '/legacy',
    '/app/projects/101?tab=activity&filter=recent',
  ),
  layout('/app', AppShellComponent, [
    redirect('', '/app/projects/101?tab=overview'),

    route('/projects/:projectId', ProjectPage, {
      name: 'project',
      outlets: {
        sidebar: ProjectSidebarComponent,
      },
      params: {
        projectId: s.number({ min: 1 }),
      },
      query: {
        tab: s.string('overview'),
        filter: s.optional(s.string()),
      },
      prepare: context => {
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
    }),

    route('/reports', ReportsPage, {
      name: 'reports',
      outlets: {
        sidebar: ReportsSidebarComponent,
      },
    }),

    route('/about', AboutPage, {
      name: 'about',
    }),
  ]),
] as const satisfies NavigationTree;
