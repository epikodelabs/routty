import { inject } from '@angular/core';
import {
  layout,
  redirect,
  route,
  s,
  type NavigationTree,
} from '@epikodelabs/routty';

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
import { ReportsPage } from './reports.page';

export const routes = [
  route('/', IntroPage),
  redirect(
    '/legacy',
    '/app/workspace/101?view=activity&page=2&filters=legacy',
  ),
  layout('/app', DemoShellComponent, [
    redirect(
      '',
      '/app/workspace/101?view=overview&page=1&filters=open&filters=recent',
    ),

    route('/workspace/:projectId', WorkspacePage, {
      name: 'workspace',
      outlets: {
        sidebar: WorkspaceSidebarComponent,
      },
      params: {
        projectId: s.number({ min: 1 }),
      },
      query: {
        view: s.string('overview'),
        page: s.number({ default: 1, min: 1 }),
        filters: s.array(),
        draft: s.optional(s.boolean()),
      },
      prepare: context => ({
        snapshot: inject(DemoSessionService)
          .buildWorkspaceSnapshot(
            Number(context.params['projectId'] ?? 0),
          ),
      }),
    }),

    route('/settings', SettingsPage, {
      name: 'settings',
      outlets: {
        sidebar: SettingsSidebarComponent,
      },
      query: {
        section: s.string('general'),
      },
    }),

    route('/editor/:draftId', EditorPage, {
      name: 'editor',
      outlets: {
        sidebar: EditorSidebarComponent,
      },
      params: {
        draftId: s.number({ min: 1 }),
      },
      query: {
        mode: s.string('write'),
      },
      beforeLeave: () => {
        const session = inject(DemoSessionService);

        return !session.draftDirty()
          || window.confirm(
            'Leave the draft and discard unsaved changes?',
          );
      },
    }),

    route('/reports', ReportsPage, {
      name: 'reports',
      outlets: {
        sidebar: ReportsSidebarComponent,
      },
    }),

    route('/admin', AdminPage, {
      name: 'admin',
      outlets: {
        sidebar: AdminSidebarComponent,
      },
      beforeEnter: () => {
        const session = inject(DemoSessionService);

        return session.adminAccess()
          || {
            redirectTo: '/app/settings?section=access',
            replace: true,
          };
      },
      prepare: () => ({
        audit: inject(DemoSessionService)
          .createAdminAudit(),
      }),
    }),
  ]),
] as const satisfies NavigationTree;
