import { Component } from '@angular/core';
import { RouterLink } from '@epikodelabs/routty';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <p class="eyebrow">Lazy route</p>
          <h1>Reports</h1>
          <p class="lede">
            This page is loaded on demand inside the SSR sample to verify that
            lazy primary routes still work cleanly with Routty and Angular SSR.
          </p>
        </div>
        <span class="status-pill">code split</span>
      </header>

      <div class="page-grid">
        <article class="panel">
          <h3>Checks to run</h3>
          <ul>
            <li>hard refresh this URL</li>
            <li>navigate here from a project route</li>
            <li>navigate back and confirm the sidebar changes too</li>
          </ul>
        </article>

        <article class="panel">
          <h3>Why it matters</h3>
          <p>
            A dedicated SSR example should demonstrate more than static pages.
            This route makes sure the app covers lazy loading in addition to
            typed params and coordinated outlets.
          </p>
        </article>
      </div>

      <div class="action-row">
        <a
          class="action-link"
          [routerLink]="{
            name: 'project',
            params: { projectId: 101 },
            query: { tab: 'overview' }
          }"
        >
          Back to project 101
        </a>
        <a class="action-link" [routerLink]="{ name: 'about' }">Open about</a>
      </div>
    </section>
  `,
  styles: [`
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
      max-width: 40rem;
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

    .page-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
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

    .action-link {
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
    }
  `],
})
export class ReportsPage {}
