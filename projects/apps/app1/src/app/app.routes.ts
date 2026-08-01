import { inject } from '@angular/core';
import {
  frame,
  lazyRoute,
  layout,
  redirectRoute,
  route,
  s,
  type StreamixRoutes,
} from '@epikodelabs/switchboard';

import {
  AdminPage,
  AdminSidebarComponent,
  DemoShellComponent,
  EditorPage,
  EditorSidebarComponent,
  IntroPage,
  ReportsSidebarComponent,
  SettingsPage,
  SettingsSidebarComponent,
  WorkspacePage,
  WorkspaceSidebarComponent,
} from './demo-pages';
import { DemoSessionService } from './demo-session.service';

const workspaceRoute = route(
  '/workspace/:projectId',
  frame(WorkspacePage, {
    prepare: [
      context => {
        const projectId = Number(
          context.params['projectId'] ?? 0,
        );

        return {
          snapshot:
            inject(DemoSessionService)
              .buildWorkspaceSnapshot(projectId),
        };
      },
    ],
  }),
  {
    name: 'workspace',
    paramsSchema: {
      projectId: s.number({ min: 1 }),
    },
    querySchema: {
      view: s.string('overview'),
      page: s.number({ default: 1, min: 1 }),
      filters: s.array(),
      draft: s.optional(s.boolean()),
    },
  },
);

const settingsRoute = route('/settings', SettingsPage, {
  name: 'settings',
  querySchema: {
    section: s.string('general'),
  },
});

const editorRoute = route(
  '/editor/:draftId',
  frame(EditorPage, {
    beforeLeave: [
      () => {
        const session = inject(DemoSessionService);

        return !session.draftDirty()
          || window.confirm(
            'Leave the draft and discard unsaved changes?',
          );
      },
    ],
  }),
  {
    name: 'editor',
    paramsSchema: {
      draftId: s.number({ min: 1 }),
    },
    querySchema: {
      mode: s.string('write'),
    },
  },
);

const reportsRoute = lazyRoute(
  '/reports',
  () =>
    import('./reports.page')
      .then(module => module.ReportsPage),
  {
    name: 'reports',
  },
);

const adminRoute = route(
  '/admin',
  frame(AdminPage, {
    beforeEnter: [
      () => {
        const session = inject(DemoSessionService);

        return session.adminAccess()
          || {
            redirectTo: '/app/settings?section=access',
            replace: true,
          };
      },
    ],
    prepare: [
      () => ({
        audit:
          inject(DemoSessionService)
            .createAdminAudit(),
      }),
    ],
  }),
  {
    name: 'admin',
  },
);

export const routes = [
  route('/', IntroPage),
  redirectRoute(
    '/legacy',
    '/app/workspace/101?view=activity&page=2&filters=legacy',
  ),
  layout('/app', DemoShellComponent, [
    redirectRoute(
      '',
      '/app/workspace/101?view=overview&page=1&filters=open&filters=recent',
    ),
    workspaceRoute,
    route('/workspace/:projectId', WorkspaceSidebarComponent, {
      outlet: 'sidebar',
    }),
    settingsRoute,
    route('/settings', SettingsSidebarComponent, {
      outlet: 'sidebar',
    }),
    editorRoute,
    route('/editor/:draftId', EditorSidebarComponent, {
      outlet: 'sidebar',
    }),
    reportsRoute,
    route('/reports', ReportsSidebarComponent, {
      outlet: 'sidebar',
    }),
    adminRoute,
    route('/admin', AdminSidebarComponent, {
      outlet: 'sidebar',
    }),
  ]),
] as const satisfies StreamixRoutes;
