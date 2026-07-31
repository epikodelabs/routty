import { Component } from '@angular/core';
import { StreamixRouterLink } from '@epikodelabs/switchboard';

@Component({
  standalone: true,
  imports: [StreamixRouterLink],
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <p class="eyebrow">Lazy route</p>
          <h1>Reports</h1>
        </div>
        <span class="status-pill">lazy component</span>
      </header>

      <div class="panel-grid">
        <article class="panel">
          <h3>What to verify</h3>
          <p>
            This page is loaded through <code>lazyRoute()</code> while the
            paired sidebar route remains eager.
          </p>
        </article>
        <article class="panel">
          <h3>Suggested checks</h3>
          <ul>
            <li>Hard refresh on <code>/app/reports</code>.</li>
            <li>Navigate here from workspace and back.</li>
            <li>Confirm the sidebar swaps in the same commit.</li>
          </ul>
        </article>
      </div>

      <div class="actions">
        <a
          [routerLink]="{
            name: 'workspace',
            params: { projectId: 120 },
            query: { view: 'activity', page: 3, filters: ['recent'] }
          }"
        >
          Back to workspace
        </a>
        <a [routerLink]="{ name: 'admin' }">Try guarded admin route</a>
      </div>
    </section>
  `,
  styles: `
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

    .eyebrow {
      margin: 0;
      color: var(--ink-soft);
      font-size: 0.78rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .status-pill {
      padding: 0.55rem 0.8rem;
      border-radius: 999px;
      background: var(--warning-soft);
      color: #9a5600;
      font-weight: 700;
    }

    .panel-grid {
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

    .panel ul {
      margin: 0;
      padding-left: 1.1rem;
      line-height: 1.6;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .actions a {
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
    }
  `,
})
export class ReportsPage {}
