import { inject } from '@angular/core';
import {
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
    route('/workspace/:projectId', WorkspacePage, {
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
      resolve: {
        snapshot: context => {
          const projectId = Number(
            context.params['projectId'] ?? 0,
          );

          return inject(DemoSessionService)
            .buildWorkspaceSnapshot(projectId);
        },
      },
    }),
    route('/workspace/:projectId', WorkspaceSidebarComponent, {
      outlet: 'sidebar',
    }),
    route('/settings', SettingsPage, {
      name: 'settings',
      querySchema: {
        section: s.string('general'),
      },
    }),
    route('/settings', SettingsSidebarComponent, {
      outlet: 'sidebar',
    }),
    route('/editor/:draftId', EditorPage, {
      name: 'editor',
      paramsSchema: {
        draftId: s.number({ min: 1 }),
      },
      querySchema: {
        mode: s.string('write'),
      },
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
    route('/editor/:draftId', EditorSidebarComponent, {
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
    route('/admin', AdminPage, {
      name: 'admin',
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
      resolve: {
        audit: () =>
          inject(DemoSessionService)
            .createAdminAudit(),
      },
    }),
    route('/admin', AdminSidebarComponent, {
      outlet: 'sidebar',
    }),
  ]),
] as const satisfies StreamixRoutes;
