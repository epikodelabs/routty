import {
  isPlatformBrowser,
  isPlatformServer,
} from '@angular/common';
import {
  Component,
  PLATFORM_ID,
  inject,
  input,
} from '@angular/core';
import {
  Router,
  RouterLink,
  RouterOutlet,
} from '@epikodelabs/routty';

type ParamsInput = Record<string, unknown>;
type QueryInput = Record<string, unknown>;
type DataInput = Record<string, unknown>;

const shellStyles = `
  :host {
    display: block;
    min-height: 100vh;
    padding: 1.25rem;
  }

  .shell {
    max-width: 88rem;
    margin: 0 auto;
    display: grid;
    gap: 1rem;
  }

  .masthead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 1.25rem;
    border: 1px solid var(--border-color);
    border-radius: 1.5rem;
    background:
      linear-gradient(135deg, rgb(255 255 255 / 0.9), rgb(245 249 255 / 0.72)),
      var(--panel-color);
    box-shadow: 0 16px 40px rgb(32 53 78 / 0.08);
    backdrop-filter: blur(16px);
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 0.85rem;
    text-decoration: none;
  }

  .brand-mark {
    display: grid;
    place-items: center;
    width: 2.75rem;
    height: 2.75rem;
    border-radius: 0.9rem;
    background: linear-gradient(135deg, var(--accent-color), var(--accent-deep));
    color: white;
    font-weight: 700;
    letter-spacing: 0.06em;
  }

  .brand strong,
  .brand small {
    display: block;
  }

  .brand small {
    color: var(--ink-soft);
    font-size: 0.82rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .top-nav {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
  }

  .top-nav a {
    padding: 0.7rem 1rem;
    border-radius: 999px;
    border: 1px solid transparent;
    text-decoration: none;
    color: var(--ink-soft);
    transition:
      transform 150ms ease,
      border-color 150ms ease,
      color 150ms ease,
      background-color 150ms ease;
  }

  .top-nav a:hover {
    transform: translateY(-1px);
    border-color: rgb(43 92 230 / 0.16);
    background: rgb(255 255 255 / 0.82);
    color: var(--ink-strong);
  }

  .masthead-meta {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }

  .meta-badge {
    display: inline-flex;
    align-items: center;
    min-height: 2.3rem;
    padding: 0.45rem 0.8rem;
    border-radius: 999px;
    border: 1px solid rgb(43 92 230 / 0.16);
    background: rgb(255 255 255 / 0.84);
    color: var(--ink-strong);
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .shell-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 20rem;
    gap: 1rem;
    align-items: start;
  }

  .primary,
  .sidebar {
    border: 1px solid var(--border-color);
    border-radius: 1.4rem;
    background: var(--panel-strong);
    box-shadow: 0 18px 42px rgb(28 47 74 / 0.08);
  }

  .primary {
    padding: 1.25rem;
  }

  .sidebar {
    padding: 1rem;
    position: sticky;
    top: 1rem;
    min-height: 10rem;
  }

  .sidebar-empty {
    color: var(--ink-soft);
    line-height: 1.6;
  }

  @media (max-width: 900px) {
    .shell-grid {
      grid-template-columns: 1fr;
    }

    .sidebar {
      position: static;
    }
  }

  @media (max-width: 760px) {
    :host {
      padding: 1rem;
    }

    .masthead {
      align-items: flex-start;
      flex-direction: column;
    }
  }
`;

const pageStyles = `
  .page {
    display: grid;
    gap: 1rem;
  }

  .eyebrow {
    margin: 0 0 0.35rem;
    color: var(--ink-soft);
    font-size: 0.86rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .page-header h1 {
    margin: 0;
    font-size: clamp(1.9rem, 3vw, 2.6rem);
  }

  .lede {
    max-width: 42rem;
    margin: 0;
    line-height: 1.7;
  }

  .status-pill {
    padding: 0.55rem 0.8rem;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent-deep);
    font-weight: 700;
  }

  .status-pill--warning {
    background: var(--warning-soft);
    color: #8c5300;
  }

  .page-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: 1rem;
  }

  .hero-panel {
    position: relative;
    overflow: hidden;
    padding: 1.4rem;
    border: 1px solid rgb(43 92 230 / 0.14);
    border-radius: 1.35rem;
    background:
      radial-gradient(circle at top right, rgb(43 92 230 / 0.12), transparent 28%),
      linear-gradient(135deg, rgb(255 255 255 / 0.92), rgb(243 248 255 / 0.84));
  }

  .hero-panel::after {
    content: '';
    position: absolute;
    inset: auto -3rem -4rem auto;
    width: 12rem;
    height: 12rem;
    border-radius: 50%;
    background: rgb(18 54 184 / 0.08);
    filter: blur(10px);
    pointer-events: none;
  }

  .hero-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(18rem, 0.85fr);
    gap: 1rem;
    align-items: start;
  }

  .hero-copy {
    display: grid;
    gap: 1rem;
  }

  .hero-copy h1 {
    margin: 0;
    font-size: clamp(2.4rem, 5vw, 4.1rem);
    line-height: 0.96;
    letter-spacing: -0.03em;
  }

  .hero-copy .lede {
    max-width: 44rem;
  }

  .hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .action-link--solid {
    background: linear-gradient(135deg, var(--accent-color), var(--accent-deep));
    border-color: transparent;
    color: white;
    box-shadow: 0 16px 28px rgb(18 54 184 / 0.24);
  }

  .hero-note {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    width: fit-content;
    padding: 0.55rem 0.8rem;
    border-radius: 999px;
    background: rgb(255 255 255 / 0.72);
    color: var(--ink-soft);
    font-size: 0.9rem;
    font-weight: 600;
  }

  .hero-note strong {
    font-size: 0.86rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .hero-side {
    display: grid;
    gap: 0.9rem;
  }

  .signal-card {
    display: grid;
    gap: 0.5rem;
    padding: 1rem 1.05rem;
    border: 1px solid var(--border-color);
    border-radius: 1.1rem;
    background: rgb(255 255 255 / 0.74);
  }

  .signal-card strong {
    font-size: 1rem;
  }

  .signal-card p {
    margin: 0;
    color: var(--ink-soft);
    line-height: 1.55;
  }

  .signal-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }

  .signal-metric {
    padding: 0.95rem;
    border-radius: 1rem;
    background: rgb(255 255 255 / 0.8);
    border: 1px solid rgb(43 92 230 / 0.12);
  }

  .signal-metric strong,
  .signal-metric span {
    display: block;
  }

  .signal-metric strong {
    font-size: 1.55rem;
  }

  .signal-metric span {
    margin-top: 0.2rem;
    color: var(--ink-soft);
    font-size: 0.9rem;
  }

  .intro-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(18rem, 0.85fr);
    gap: 1rem;
    align-items: start;
  }

  .scenario-list {
    display: grid;
    gap: 0.85rem;
  }

  .scenario-card {
    display: grid;
    gap: 0.45rem;
    padding: 1rem 1.05rem;
    border: 1px solid var(--border-color);
    border-radius: 1rem;
    background: rgb(255 255 255 / 0.72);
  }

  .scenario-card h3 {
    margin: 0;
  }

  .scenario-card p {
    margin: 0;
    color: var(--ink-soft);
  }

  .intro-aside {
    display: grid;
    gap: 1rem;
  }

  .panel {
    padding: 1.1rem;
    border: 1px solid var(--border-color);
    border-radius: 1.1rem;
    background: rgb(255 255 255 / 0.72);
  }

  .panel h3 {
    margin-top: 0;
  }

  .panel p,
  .panel li {
    line-height: 1.65;
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
    background: rgb(255 255 255 / 0.86);
    color: var(--ink-strong);
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
  }

  .action-button {
    appearance: none;
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
  }

  @media (max-width: 900px) {
    .hero-grid,
    .intro-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .signal-grid {
      grid-template-columns: 1fr;
    }
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
    line-height: 1.6;
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
    text-decoration: none;
  }
`;

@Component({
  standalone: true,
  imports: [RouterLink, RouterOutlet],
  template: `
    <div class="shell">
      <header class="masthead">
        <a class="brand" [routerLink]="'/'">
          <span class="brand-mark">RT</span>
          <span>
            <strong>Routty</strong>
            <small>SSR sample</small>
          </span>
        </a>

        <div class="masthead-meta">
          <span class="meta-badge">Angular SSR</span>
          <span class="meta-badge">{{ renderModeLabel() }}</span>
        </div>
      </header>

      <nav class="top-nav" aria-label="Primary navigation">
        <a
          [routerLink]="{
            name: 'project',
            params: { projectId: 101 },
            query: { tab: 'overview' }
          }"
        >
          Project 101
        </a>
        <a
          [routerLink]="{
            name: 'project',
            params: { projectId: 202 },
            query: { tab: 'activity', filter: 'recent' }
          }"
        >
          Project 202
        </a>
        <a [routerLink]="{ name: 'reports' }">Lazy reports</a>
        <a [routerLink]="{ name: 'about' }">About</a>
        <a [routerLink]="'/legacy'">Redirect</a>
      </nav>

      <div class="shell-grid">
        <main class="primary">
          <router-outlet />
        </main>

        <aside class="sidebar">
          <p class="sidebar-empty">
            Companion outlet for the active primary route.
          </p>
          <router-outlet name="sidebar" />
        </aside>
      </div>
    </div>
  `,
  styles: [shellStyles],
})
export class AppShellComponent {
  private readonly platformId = inject(PLATFORM_ID);

  protected renderModeLabel(): string {
    if (isPlatformServer(this.platformId)) {
      return 'Server render';
    }

    if (isPlatformBrowser(this.platformId)) {
      return 'Hydrated client';
    }

    return 'Unknown platform';
  }
}

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="page">
      <section class="hero-panel">
        <div class="hero-grid">
          <div class="hero-copy">
            <div>
              <p class="eyebrow">Server-rendered entry</p>
              <h1>Flat routing, real SSR, one route definition.</h1>
            </div>

            <p class="lede">
              This sample lives entirely inside <code>app2</code>. Routty owns
              matching, rendering, typed links, prepared data, and coordinated
              outlets. Angular SSR owns the server render and hydration
              pipeline.
            </p>

            <div class="hero-actions">
              <a
                class="action-link action-link--solid"
                [routerLink]="{
                  name: 'project',
                  params: { projectId: 101 },
                  query: { tab: 'overview' }
                }"
              >
                Open project 101
              </a>
              <a
                class="action-link"
                [routerLink]="{
                  name: 'project',
                  params: { projectId: 202 },
                  query: { tab: 'activity', filter: 'recent' }
                }"
              >
                Open project 202
              </a>
              <a class="action-link" [routerLink]="'/legacy'">Try redirect flow</a>
            </div>

            <div class="hero-note">
              <strong>Runtime</strong>
              <span>{{ renderModeLabel() }}</span>
            </div>
          </div>

          <div class="hero-side">
            <article class="signal-card">
              <strong>Angular SSR + Routty</strong>
              <p>
                Initial HTML is rendered on the server. After hydration, the
                same route definitions keep driving navigation on the client.
              </p>
            </article>

            <div class="signal-grid">
              <article class="signal-metric">
                <strong>1</strong>
                <span>route catalog</span>
              </article>
              <article class="signal-metric">
                <strong>2</strong>
                <span>named project scenarios</span>
              </article>
              <article class="signal-metric">
                <strong>1</strong>
                <span>lazy primary route</span>
              </article>
              <article class="signal-metric">
                <strong>1</strong>
                <span>sidebar outlet group</span>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section class="intro-grid">
        <div class="scenario-list">
          <article class="scenario-card">
            <p class="eyebrow">What to check</p>
            <h3>Typed project navigation</h3>
            <p>
              Open either project card, then switch tabs through query values
              and confirm that params, query values, prepared data, and the
              sidebar all stay in sync.
            </p>
          </article>

          <article class="scenario-card">
            <p class="eyebrow">SSR behavior</p>
            <h3>Hard-refresh deep routes</h3>
            <p>
              Refresh <code>/app/projects/101</code> or <code>/app/reports</code>
              directly. The page should render server-side first, then hydrate
              into a live Routty app.
            </p>
          </article>

          <article class="scenario-card">
            <p class="eyebrow">Flow coverage</p>
            <h3>Redirects and lazy loading</h3>
            <p>
              Visit <code>/legacy</code> to confirm redirect behavior, then move
              to the lazy reports page and back to verify grouped outlet swaps.
            </p>
          </article>
        </div>

        <aside class="intro-aside">
          <article class="panel">
            <h3>What this sample demonstrates</h3>
            <ul>
              <li>standalone Routty configuration inside app2</li>
              <li>typed params and query parsing</li>
              <li>prepare hooks feeding route data</li>
              <li>layout composition with a named sidebar outlet</li>
              <li>lazy primary routes under SSR</li>
            </ul>
          </article>

          <article class="panel">
            <h3>Current runtime</h3>
            <p>
              SSR status is exposed intentionally so the landing view makes it
              clear this is not just a client-only demo shell.
            </p>
            <p>
              Active mode: <strong>{{ renderModeLabel() }}</strong>
            </p>
          </article>
        </aside>
      </section>
    </section>
  `,
  styles: [pageStyles],
})
export class IntroPage {
  private readonly platformId = inject(PLATFORM_ID);

  protected renderModeLabel(): string {
    if (isPlatformServer(this.platformId)) {
      return 'Server render';
    }

    if (isPlatformBrowser(this.platformId)) {
      return 'Hydrated client';
    }

    return 'Unknown platform';
  }
}

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <p class="eyebrow">Prepared route</p>
          <h1>{{ projectName() }}</h1>
          <p class="lede">{{ projectSummary() }}</p>
        </div>
        <span class="status-pill">{{ tabLabel() }}</span>
      </header>

      <div class="page-grid">
        <article class="panel">
          <h3>Typed route state</h3>
          <dl class="data-list">
            <div>
              <dt>projectId</dt>
              <dd>{{ projectId() }}</dd>
            </div>
            <div>
              <dt>tab</dt>
              <dd>{{ tabLabel() }}</dd>
            </div>
            <div>
              <dt>filter</dt>
              <dd>{{ filterLabel() }}</dd>
            </div>
            <div>
              <dt>owner</dt>
              <dd>{{ projectOwner() }}</dd>
            </div>
          </dl>
        </article>

        <article class="panel">
          <h3>Prepared highlights</h3>
          <ul>
            @for (item of highlights(); track item) {
              <li>{{ item }}</li>
            }
          </ul>
        </article>
      </div>

      <div class="action-row">
        <a
          class="action-link"
          [routerLink]="{
            name: 'project',
            params: { projectId: projectId() },
            query: { tab: 'overview' }
          }"
        >
          Overview
        </a>
        <a
          class="action-link"
          [routerLink]="{
            name: 'project',
            params: { projectId: projectId() },
            query: { tab: 'activity', filter: 'recent' }
          }"
        >
          Activity
        </a>
        <button type="button" class="action-button" (click)="openReports()">
          Go to lazy reports
        </button>
      </div>
    </section>
  `,
  styles: [pageStyles],
})
export class ProjectPage {
  private readonly router = inject(Router);

  protected readonly params = input<ParamsInput>({});
  protected readonly query = input<QueryInput>({});
  protected readonly data = input<DataInput>({});

  protected projectId(): number {
    return Number(this.params()['projectId'] ?? 0);
  }

  protected tabLabel(): string {
    return String(this.query()['tab'] ?? 'overview');
  }

  protected filterLabel(): string {
    return String(this.query()['filter'] ?? 'none');
  }

  protected projectRecord(): Record<string, unknown> {
    return (this.data()['project'] as Record<string, unknown> | undefined) ?? {};
  }

  protected projectName(): string {
    return String(this.projectRecord()['name'] ?? 'Unknown project');
  }

  protected projectOwner(): string {
    return String(this.projectRecord()['owner'] ?? 'Unknown');
  }

  protected projectSummary(): string {
    return String(this.projectRecord()['summary'] ?? '');
  }

  protected highlights(): readonly string[] {
    return (this.data()['highlights'] as readonly string[] | undefined) ?? [];
  }

  protected openReports(): void {
    void this.router.navigate({ name: 'reports' });
  }
}

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="sidebar-card">
      <h3>Project sidebar</h3>
      <p>
        This outlet is activated together with the primary project route.
      </p>

      <div class="sidebar-links">
        <a
          [routerLink]="{
            name: 'project',
            params: { projectId: projectId() },
            query: { tab: 'overview' }
          }"
        >
          Overview tab
        </a>
        <a
          [routerLink]="{
            name: 'project',
            params: { projectId: projectId() },
            query: { tab: 'activity', filter: 'recent' }
          }"
        >
          Activity tab
        </a>
        <a
          [routerLink]="{
            name: 'project',
            params: { projectId: 202 },
            query: { tab: 'overview' }
          }"
        >
          Switch project
        </a>
      </div>
    </section>
  `,
  styles: [sidebarStyles],
})
export class ProjectSidebarComponent {
  protected readonly params = input<ParamsInput>({});

  protected projectId(): number {
    return Number(this.params()['projectId'] ?? 101);
  }
}

@Component({
  standalone: true,
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <p class="eyebrow">Static page</p>
          <h1>About this sample</h1>
          <p class="lede">
            App2 exists to prove that Routty can drive a dedicated Angular SSR
            app without borrowing route definitions or providers from another
            demo application.
          </p>
        </div>
        <span class="status-pill">self-contained</span>
      </header>

      <div class="page-grid">
        <article class="panel">
          <h3>Owned by app2</h3>
          <ul>
            <li>route catalog</li>
            <li>layout shell</li>
            <li>lazy reports route</li>
            <li>project prepare hook</li>
          </ul>
        </article>

        <article class="panel">
          <h3>Still provided by Angular SSR</h3>
          <ul>
            <li>Node request handling</li>
            <li>server rendering integration</li>
            <li>hydration infrastructure</li>
          </ul>
        </article>
      </div>
    </section>
  `,
  styles: [pageStyles],
})
export class AboutPage {}

@Component({
  standalone: true,
  template: `
    <section class="sidebar-card">
      <h3>Reports sidebar</h3>
      <p>
        The sidebar is eager even though the primary reports page is lazy.
      </p>
      <ul>
        <li>Try a hard refresh on <code>/app/reports</code>.</li>
        <li>Navigate back to a project route to confirm a coordinated swap.</li>
      </ul>
    </section>
  `,
  styles: [sidebarStyles],
})
export class ReportsSidebarComponent {}
