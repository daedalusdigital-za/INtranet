import { AfterViewInit, Component, Input, ViewChild } from '@angular/core';
import { Params, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTabNav, MatTabNavPanel, MatTabsModule } from '@angular/material/tabs';
import { SubPage } from '../sub-pages';

/**
 * Links to a module's sub-pages, shown under the page title (design review D-12). They are real
 * links: each sub-page has an address, Back moves between them, and middle-click opens a new tab.
 *
 *   <app-page-header ...>
 *     <app-sub-nav tabs [pages]="sections" base="/sales" [active]="section()" [panel]="salesPanel"
 *                  [queries]="sectionQuery()" [counts]="sectionCounts()" label="Sales sections"></app-sub-nav>
 *   </app-page-header>
 *   <mat-tab-nav-panel #salesPanel> ...the current sub-page... </mat-tab-nav-panel>
 */
@Component({
  selector: 'app-sub-nav',
  standalone: true,
  imports: [MatTabsModule, MatIconModule, RouterLink],
  template: `
    <nav mat-tab-nav-bar [tabPanel]="panel" [attr.aria-label]="label">
      @for (p of pages; track p.slug) {
        <a mat-tab-link [routerLink]="[base, p.slug]" [queryParams]="queries[p.slug] ?? null" [active]="active === p.slug">
          <mat-icon aria-hidden="true">{{ p.icon }}</mat-icon>{{ p.label }}
          @if (counts[p.slug]) { <span class="sn-count">{{ counts[p.slug] }}</span> }
        </a>
      }
    </nav>
  `,
  styles: [`
    /* min-width: 0 lets the bar fit a narrow page header, where it scrolls with arrows. */
    :host { display: block; min-width: 0; margin-top: var(--space-3); }
    /* Inactive links are quieter than the current one. */
    nav {
      --mat-tab-header-inactive-label-text-color: var(--color-text-2);
      --mat-tab-header-inactive-hover-label-text-color: var(--color-text);
      --mat-tab-header-inactive-focus-label-text-color: var(--color-text);
    }
    .mat-mdc-tab-link { flex-grow: 0; min-width: 0; padding: 0 var(--space-4); }
    .mat-mdc-tab-link mat-icon { font-size: var(--text-lg); width: 18px; height: 18px; margin-right: var(--space-2); }
    .sn-count {
      margin-left: var(--space-2); min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px;
      background: var(--color-surface-2); color: var(--color-text-2);
      font-size: var(--text-xs); font-weight: 700; line-height: 20px; text-align: center; font-variant-numeric: tabular-nums;
    }
    .mdc-tab--active .sn-count { background: var(--color-primary-soft); color: var(--color-primary); }
  `]
})
export class SubNavComponent implements AfterViewInit {
  @Input({ required: true }) pages: readonly SubPage[] = [];
  /** The module's address, e.g. "/sales"; each link is base/slug. */
  @Input({ required: true }) base = '';
  @Input() active = '';
  /** Each sub-page's filters, so its link brings them back. */
  @Input() queries: Partial<Record<string, Params>> = {};
  /** A number shown after a link's label, e.g. back orders waiting. Zero or missing shows nothing. */
  @Input() counts: Partial<Record<string, number>> = {};
  @Input() panel?: MatTabNavPanel;
  @Input() label = 'Sections';

  @ViewChild(MatTabNav) private tabNav?: MatTabNav;

  ngAfterViewInit(): void {
    // Material doesn't bring the current link into view when the bar first appears, so on a
    // phone a later sub-page's link could start off-screen. Scroll to it once it's laid out.
    // _scrollToLabel works out the distance; updatePagination applies it.
    setTimeout(() => {
      const index = this.pages.findIndex(p => p.slug === this.active);
      if (!this.tabNav || index < 0) return;
      this.tabNav.updatePagination();
      this.tabNav._scrollToLabel(index);
      this.tabNav.updatePagination();
    });
  }
}
