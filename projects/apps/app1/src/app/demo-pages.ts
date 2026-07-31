import {
  Component,
  inject,
  input,
} from '@angular/core';
import {
  RouterOutlet,
  StreamixRouter,
  StreamixRouterLink,
} from '@epikodelabs/switchboard';

import {
  type AdminAudit,
  type WorkspaceSnapshot,
  DemoSessionService,
} from './demo-session.service';

type ParamsInput = Record<string, unknown>;
type QueryInput = Record<string, unknown>;
type DataInput = Record<string, unknown>;

const pageStyles = `
  .page {
    display: grid;
    gap: 1rem;
  }

  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .page-header h1 {
    margin: 0.25rem 0 0;
    font-size: clamp(1.9rem, 3vw, 2.7rem);
  }

  .status-pill {
    padding: 0.55rem 0.8rem;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent-deep);
    font-weight: 700;
  }

  .page-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: 1rem;
  }

  .panel {
    padding: 1.1rem;
    border: 1px solid var(--border-color);
    border-radius: 1.1rem;
    background: var(--panel-strong);
  }

  .panel h3 {
    margin-top: 0;
  }

  .panel p {
    line-height: 1.6;
  }

  .data-list {
    display: grid;
    gap: 0.7rem;
    margin: 0;
  }

  .data-list div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .data-list dt {
    color: var(--ink-soft);
  }

  .data-list dd {
    margin: 0;
    font-weight: 700;
    color: var(--ink-strong);
  }

  .action-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .action-link,
  .action-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 2.9rem;
    padding: 0.75rem 1rem;
    border-radius: 999px;
    border: 1px solid rgb(43 92 230 / 0.18);
    background: rgb(255 255 255 / 0.8);
    color: var(--ink-strong);
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
  }

  .inline-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    margin-top: 0.85rem;
    font-weight: 600;
  }
`;

const sidebarStyles = `
  .sidebar-card {
    display: grid;
    gap: 0.75rem;
  }

  .sidebar-card h3 {
    margin: 0;
  }

  .sidebar-card p,
  .sidebar-card li {
    line-height: 1.55;
  }

  .sidebar-card ul {
    margin: 0;
    padding-left: 1.15rem;
  }

  .sidebar-links {
    display: grid;
    gap: 0.55rem;
  }

  .sidebar-links a {
    padding: 0.8rem 0.9rem;
    border-radius: 0.9rem;
    background: rgb(43 92 230 / 0.07);
    color: var(--ink-strong);
    text-decoration: none;
  }
`;

@Component({
  standalone: true,
  imports: [StreamixRouterLink],
  template: `
    <section class="hero">
      <p class="eyebrow">Sample application</p>
      <h1>Manual route scenario harness</h1>
      <p class="lede">
        This app is meant for real browser checks, not framework smoke tests.
        Use it to validate how Switchboard handles redirects, typed params,
        query defaults, lazy routes, guards, and grouped named outlets.
      </p>

      <div class="hero-actions">
        <a class="action-link action-link--solid" [routerLink]="'/legacy'">
          Follow redirect scenario
        </a>
        <a
          class="action-link"
          [routerLink]="{
            name: 'settings',
            query: { section: 'profile' }
          }"
        >
          Open settings by route name
        </a>
        <button type="button" class="action-button" (click)="openWorkspace(204)">
          Navigate with history state
        </button>
      </div>

      <div class="scenario-grid">
        <article class="scenario-card">
          <strong>Redirects</strong>
          <p>
            Visit <code>/legacy</code> or <code>/app</code> and confirm the
            router rewrites to the expected workspace URLs.
          </p>
        </article>
        <article class="scenario-card">
          <strong>Typed parsing</strong>
          <p>
            Workspace pages parse <code>projectId</code> as a number and apply
            defaults for <code>view</code>, <code>page</code>, and
            <code>filters</code>.
          </p>
        </article>
        <article class="scenario-card">
          <strong>Named outlets</strong>
          <p>
            Every <code>/app/*</code> route updates a primary view and the
            sidebar outlet as one grouped navigation commit.
          </p>
        </article>
        <article class="scenario-card">
          <strong>Guards and lazy routes</strong>
          <p>
            The admin page redirects until access is enabled, and the reports
            page is loaded lazily.
          </p>
        </article>
      </div>
    </section>
  `,
  styles: `
    .hero {
      max-width: 88rem;
      margin: 0 auto;
      padding: clamp(1.25rem, 2vw, 2rem);
      border: 1px solid var(--border-color);
      border-radius: 2rem;
      background:
        linear-gradient(140deg, rgb(255 255 255 / 0.92), rgb(239 245 255 / 0.78)),
        var(--panel-color);
      box-shadow: 0 24px 64px rgb(18 31 56 / 0.08);
    }

    .eyebrow {
      margin: 0 0 0.8rem;
      color: var(--accent-deep);
      font-size: 0.82rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    h1 {
      margin: 0;
      font-size: clamp(2.2rem, 4vw, 4rem);
      line-height: 0.95;
    }

    .lede {
      max-width: 46rem;
      margin: 1rem 0 0;
      font-size: 1.05rem;
      line-height: 1.7;
    }

    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.8rem;
      margin: 1.75rem 0 0;
    }

    .action-link,
    .action-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 3rem;
      padding: 0.75rem 1.1rem;
      border-radius: 999px;
      border: 1px solid rgb(43 92 230 / 0.18);
      background: rgb(255 255 255 / 0.8);
      color: var(--ink-strong);
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
      transition:
        transform 150ms ease,
        box-shadow 150ms ease,
        background-color 150ms ease;
    }

    .action-link--solid {
      background: linear-gradient(135deg, var(--accent-color), var(--accent-deep));
      color: #fff;
      border-color: transparent;
    }

    .action-link:hover,
    .action-button:hover {
      transform: translateY(-1px);
      box-shadow: 0 12px 24px rgb(18 54 184 / 0.12);
    }

    .scenario-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
      gap: 1rem;
      margin-top: 2rem;
    }

    .scenario-card {
      padding: 1.1rem;
      border: 1px solid var(--border-color);
      border-radius: 1.2rem;
      background: rgb(255 255 255 / 0.68);
    }

    .scenario-card strong {
      display: block;
      margin-bottom: 0.55rem;
    }

    .scenario-card p {
      margin: 0;
      line-height: 1.6;
    }
  `,
})
export class IntroPage {
  private readonly router = inject(StreamixRouter);

  protected openWorkspace(projectId: number): void {
    void this.router.navigate(
      {
        name: 'workspace',
        params: { projectId },
        query: {
          view: 'activity',
          page: 2,
          filters: ['recent', 'flagged'],
          draft: true,
        },
      },
      {
        state: {
          source: 'intro-page',
          projectId,
        },
      },
    );
  }
}

@Component({
  standalone: true,
  imports: [
    RouterOutlet,
    StreamixRouterLink,
  ],
  template: `
    <section class="playground-shell">
      <aside class="control-panel">
        <p class="eyebrow">Scenario menu</p>
        <h2><code>/app</code> layout shell</h2>

        <nav class="scenario-nav" aria-label="Scenario navigation">
          @for (item of navItems; track item.label) {
            <a class="nav-card" [routerLink]="item.target">
              <strong>{{ item.label }}</strong>
              <span>{{ item.description }}</span>
            </a>
          }
        </nav>

        <div class="control-card">
          <label class="toggle">
            <input
              type="checkbox"
              [checked]="session.adminAccess()"
              (change)="setAdminAccess($event)"
            />
            Allow <code>/app/admin</code>
          </label>
          <p>
            @if (session.adminAccess()) {
              The <code>beforeEnter</code> guard will allow the admin route.
            } @else {
              The <code>beforeEnter</code> guard redirects to access settings.
            }
          </p>
        </div>

        <div class="control-card">
          <label class="toggle">
            <input
              type="checkbox"
              [checked]="session.draftDirty()"
              (change)="setDraftDirty($event)"
            />
            Leave guard armed
          </label>
          <p>
            When enabled, leaving the editor route triggers a native
            confirmation dialog through <code>beforeLeave</code>.
          </p>
        </div>

        <section class="outlet-card">
          <p class="outlet-label">Named outlet</p>
          <router-outlet name="sidebar" />
        </section>
      </aside>

      <main class="canvas">
        <router-outlet />
      </main>
    </section>
  `,
  styles: `
    .playground-shell {
      display: grid;
      grid-template-columns: minmax(18rem, 24rem) minmax(0, 1fr);
      gap: 1rem;
      max-width: 88rem;
      margin: 0 auto;
    }

    .control-panel,
    .canvas {
      border: 1px solid var(--border-color);
      border-radius: 1.75rem;
      background: var(--panel-color);
      box-shadow: 0 20px 48px rgb(25 40 71 / 0.07);
      backdrop-filter: blur(16px);
    }

    .control-panel {
      padding: 1.2rem;
    }

    .canvas {
      min-width: 0;
      padding: 1.2rem;
    }

    .eyebrow,
    .outlet-label {
      margin: 0 0 0.7rem;
      color: var(--ink-soft);
      font-size: 0.78rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    h2 {
      margin: 0 0 1rem;
      font-size: 1.45rem;
    }

    .scenario-nav {
      display: grid;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .nav-card {
      display: block;
      padding: 0.95rem;
      border: 1px solid var(--border-color);
      border-radius: 1rem;
      background: rgb(255 255 255 / 0.74);
      text-decoration: none;
    }

    .nav-card strong,
    .nav-card span {
      display: block;
    }

    .nav-card span {
      margin-top: 0.35rem;
      color: var(--ink-soft);
      line-height: 1.5;
    }

    .control-card,
    .outlet-card {
      padding: 1rem;
      border: 1px solid var(--border-color);
      border-radius: 1rem;
      background: rgb(255 255 255 / 0.68);
    }

    .control-card + .control-card,
    .control-card + .outlet-card {
      margin-top: 0.85rem;
    }

    .toggle {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      font-weight: 600;
      color: var(--ink-strong);
    }

    .control-card p {
      margin: 0.8rem 0 0;
      line-height: 1.55;
    }

    @media (max-width: 960px) {
      .playground-shell {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class DemoShellComponent {
  protected readonly session = inject(DemoSessionService);

  protected readonly navItems = Object.freeze([
    {
      label: 'Workspace',
      description: 'Typed params, query defaults, grouped sidebar outlet',
      target: {
        name: 'workspace',
        params: { projectId: 101 },
        query: {
          view: 'overview',
          page: 1,
          filters: ['open', 'recent'],
        },
      },
    },
    {
      label: 'Settings',
      description: 'Query-only route that also receives guard redirects',
      target: {
        name: 'settings',
        query: { section: 'profile' },
      },
    },
    {
      label: 'Editor',
      description: 'beforeLeave confirmation path with a dirty-state toggle',
      target: {
        name: 'editor',
        params: { draftId: 7 },
        query: { mode: 'review' },
      },
    },
    {
      label: 'Lazy reports',
      description: 'Lazy component route paired with an eager sidebar outlet',
      target: {
        name: 'reports',
      },
    },
    {
      label: 'Admin',
      description: 'Guarded route that redirects until access is enabled',
      target: {
        name: 'admin',
      },
    },
  ]);

  protected setAdminAccess(event: Event): void {
    this.session.setAdminAccess(this.readChecked(event));
  }

  protected setDraftDirty(event: Event): void {
    this.session.setDraftDirty(this.readChecked(event));
  }

  private readChecked(event: Event): boolean {
    return (event.target as HTMLInputElement | null)?.checked ?? false;
  }
}

@Component({
  standalone: true,
  imports: [StreamixRouterLink],
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <p class="eyebrow">Typed params + query schema</p>
          <h1>Workspace {{ projectId() }}</h1>
        </div>
        <span class="status-pill">
          Resolver load #{{ snapshot()?.loadOrder ?? 0 }}
        </span>
      </header>

      <div class="page-grid">
        <article class="panel">
          <h3>Parsed route values</h3>
          <dl class="data-list">
            <div>
              <dt>projectId</dt>
              <dd>{{ projectId() }}</dd>
            </div>
            <div>
              <dt>view</dt>
              <dd>{{ queryValue('view', 'overview') }}</dd>
            </div>
            <div>
              <dt>page</dt>
              <dd>{{ queryValue('page', 1) }}</dd>
            </div>
            <div>
              <dt>filters</dt>
              <dd>{{ filtersText() }}</dd>
            </div>
            <div>
              <dt>draft</dt>
              <dd>{{ queryValue('draft', 'not set') }}</dd>
            </div>
          </dl>
        </article>

        <article class="panel">
          <h3>Resolver payload</h3>
          <p>
            Suggested filters:
            <strong>{{ snapshot()?.suggestedFilters?.join(', ') || 'none' }}</strong>
          </p>
          <p>
            Admin route available:
            <strong>{{ snapshot()?.canOpenAdmin ? 'yes' : 'no' }}</strong>
          </p>
          <p>
            Use the shell controls to change future resolver output without
            rebuilding the app.
          </p>
        </article>
      </div>

      <div class="action-row">
        <a
          class="action-link"
          [routerLink]="{
            name: 'workspace',
            params: { projectId: projectId() + 1 },
            query: {
              view: 'activity',
              page: 1,
              filters: ['assigned']
            }
          }"
        >
          Next project
        </a>
        <button type="button" class="action-button" (click)="openEditor()">
          Open editor scenario
        </button>
        <button type="button" class="action-button" (click)="updateHistory()">
          Update history.state
        </button>
      </div>
    </section>
  `,
  styles: [pageStyles],
})
export class WorkspacePage {
  private readonly router = inject(StreamixRouter);

  protected readonly params = input<ParamsInput>({});
  protected readonly query = input<QueryInput>({});
  protected readonly data = input<DataInput>({});

  protected projectId(): number {
    return Number(this.params()['projectId'] ?? 0);
  }

  protected queryValue(key: string, fallback: unknown): unknown {
    return this.query()[key] ?? fallback;
  }

  protected filtersText(): string {
    const filters = this.query()['filters'];
    return Array.isArray(filters) && filters.length > 0
      ? filters.join(', ')
      : 'none';
  }

  protected snapshot(): WorkspaceSnapshot | null {
    return (this.data()['snapshot'] as WorkspaceSnapshot | undefined) ?? null;
  }

  protected openEditor(): void {
    void this.router.navigate({
      name: 'editor',
      params: { draftId: this.projectId() * 10 },
      query: { mode: 'review' },
    });
  }

  protected updateHistory(): void {
    this.router.updateHistoryState({
      updatedFrom: 'workspace',
      projectId: this.projectId(),
    });
  }
}

@Component({
  standalone: true,
  imports: [StreamixRouterLink],
  template: `
    <section class="sidebar-card">
      <h3>Workspace sidebar</h3>
      <p>
        This outlet is committed together with the primary workspace route for
        <code>/app/workspace/:projectId</code>.
      </p>

      <div class="sidebar-links">
        <a
          [routerLink]="{
            name: 'workspace',
            params: { projectId: projectId() },
            query: { view: 'overview', page: 1, filters: ['open'] }
          }"
        >
          Overview tab
        </a>
        <a
          [routerLink]="{
            name: 'workspace',
            params: { projectId: projectId() },
            query: { view: 'activity', page: 2, filters: ['recent'] }
          }"
        >
          Activity tab
        </a>
        <a
          [routerLink]="{
            name: 'workspace',
            params: { projectId: projectId() },
            query: { view: 'files', page: 1, filters: ['approved'] }
          }"
        >
          Files tab
        </a>
      </div>
    </section>
  `,
  styles: [sidebarStyles],
})
export class WorkspaceSidebarComponent {
  protected readonly params = input<ParamsInput>({});

  protected projectId(): number {
    return Number(this.params()['projectId'] ?? 0);
  }
}

@Component({
  standalone: true,
  imports: [StreamixRouterLink],
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <p class="eyebrow">Query-only route</p>
          <h1>Settings</h1>
        </div>
        <span class="status-pill">section={{ section() }}</span>
      </header>

      <div class="page-grid">
        <article class="panel">
          <h3>Why this page exists</h3>
          <p>
            The admin guard redirects here with
            <code>?section=access</code> when access is disabled.
          </p>
        </article>
        <article class="panel">
          <h3>Quick checks</h3>
          <p>
            Change sections with named navigation and verify the same layout
            shell remains mounted.
          </p>
        </article>
      </div>

      <div class="action-row">
        <a
          class="action-link"
          [routerLink]="{ name: 'settings', query: { section: 'billing' } }"
        >
          Billing section
        </a>
        <a
          class="action-link"
          [routerLink]="{ name: 'settings', query: { section: 'access' } }"
        >
          Access section
        </a>
        <a
          class="action-link"
          [routerLink]="{
            name: 'workspace',
            params: { projectId: 101 },
            query: { view: 'overview', page: 1, filters: ['open'] }
          }"
        >
          Back to workspace
        </a>
      </div>
    </section>
  `,
  styles: [pageStyles],
})
export class SettingsPage {
  protected readonly query = input<QueryInput>({});

  protected section(): string {
    return String(this.query()['section'] ?? 'general');
  }
}

@Component({
  standalone: true,
  template: `
    <section class="sidebar-card">
      <h3>Settings sidebar</h3>
      <p>
        Use this route to confirm grouped outlet swaps outside the workspace
        flow.
      </p>
      <ul>
        <li>Query parsing: <code>section</code></li>
        <li>Guard redirect target: <code>/app/settings?section=access</code></li>
      </ul>
    </section>
  `,
  styles: [sidebarStyles],
})
export class SettingsSidebarComponent {}

@Component({
  standalone: true,
  imports: [StreamixRouterLink],
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <p class="eyebrow">beforeLeave route</p>
          <h1>Draft {{ draftId() }}</h1>
        </div>
        <span class="status-pill">{{ mode() }} mode</span>
      </header>

      <div class="page-grid">
        <article class="panel">
          <h3>Leave guard</h3>
          <p>
            The shell toggle controls whether leaving this page should prompt.
          </p>
          <label class="inline-toggle">
            <input
              type="checkbox"
              [checked]="session.draftDirty()"
              (change)="setDraftDirty($event)"
            />
            Unsaved changes present
          </label>
        </article>
        <article class="panel">
          <h3>Manual checks</h3>
          <p>Try navigating to reports or workspace with the guard armed.</p>
        </article>
      </div>

      <div class="action-row">
        <button type="button" class="action-button" (click)="goReports()">
          Leave for lazy reports
        </button>
        <a
          class="action-link"
          [routerLink]="{
            name: 'workspace',
            params: { projectId: 103 },
            query: { view: 'activity', page: 1, filters: ['recent'] }
          }"
        >
          Return to workspace
        </a>
      </div>
    </section>
  `,
  styles: [pageStyles],
})
export class EditorPage {
  protected readonly session = inject(DemoSessionService);
  private readonly router = inject(StreamixRouter);

  protected readonly params = input<ParamsInput>({});
  protected readonly query = input<QueryInput>({});

  protected draftId(): number {
    return Number(this.params()['draftId'] ?? 0);
  }

  protected mode(): string {
    return String(this.query()['mode'] ?? 'write');
  }

  protected setDraftDirty(event: Event): void {
    this.session.setDraftDirty(
      (event.target as HTMLInputElement | null)?.checked ?? false,
    );
  }

  protected goReports(): void {
    void this.router.navigate({ name: 'reports' });
  }
}

@Component({
  standalone: true,
  template: `
    <section class="sidebar-card">
      <h3>Editor sidebar</h3>
      <p>
        Confirm this outlet changes with the primary editor page and that the
        leave guard only applies when you navigate away.
      </p>
    </section>
  `,
  styles: [sidebarStyles],
})
export class EditorSidebarComponent {}

@Component({
  standalone: true,
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <p class="eyebrow">beforeEnter + resolve</p>
          <h1>Admin console</h1>
        </div>
        <span class="status-pill">guard passed</span>
      </header>

      <div class="page-grid">
        <article class="panel">
          <h3>Guard result</h3>
          <p>
            Access is controlled by the shell checkbox. Disable it and try the
            route again to confirm the redirect.
          </p>
        </article>
        <article class="panel">
          <h3>Resolver audit</h3>
          <p>reviewedBy: <strong>{{ audit()?.reviewedBy }}</strong></p>
          <p>workspaceLoads: <strong>{{ audit()?.workspaceLoads ?? 0 }}</strong></p>
        </article>
      </div>
    </section>
  `,
  styles: [pageStyles],
})
export class AdminPage {
  protected readonly data = input<DataInput>({});

  protected audit(): AdminAudit | null {
    return (this.data()['audit'] as AdminAudit | undefined) ?? null;
  }
}

@Component({
  standalone: true,
  template: `
    <section class="sidebar-card">
      <h3>Admin sidebar</h3>
      <p>
        This route is useful for checking that a successful guard still commits
        both outlets together.
      </p>
    </section>
  `,
  styles: [sidebarStyles],
})
export class AdminSidebarComponent {}

@Component({
  standalone: true,
  template: `
    <section class="sidebar-card">
      <h3>Reports sidebar</h3>
      <p>
        The sidebar is eager even though the primary reports page is lazy.
      </p>
      <ul>
        <li>Check the first load after a hard refresh.</li>
        <li>Navigate away and back to confirm reuse behavior.</li>
      </ul>
    </section>
  `,
  styles: [sidebarStyles],
})
export class ReportsSidebarComponent {}
