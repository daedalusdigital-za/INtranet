import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Compact page header (design review D-08): breadcrumb, title, one line of context,
 * and actions on the right. Replaces the per-module banners with logos and gradients.
 *
 *   <app-page-header [crumbs]="['Operations', 'Logistics']" title="Loads" subtitle="Updated 1 minute ago">
 *     <button mat-stroked-button>Live map</button>
 *     <button mat-flat-button color="primary">New load</button>
 *     <nav tabs> ...sub-navigation links... </nav>
 *   </app-page-header>
 *
 * Buttons go in the default slot; an element with the `tabs` attribute renders below.
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <header class="ph">
      @if (crumbs.length) {
        <nav class="ph-crumbs" aria-label="Breadcrumb">
          @for (c of crumbs; track $index; let last = $last) {
            <span>{{ c }}</span>
            @if (!last) { <mat-icon aria-hidden="true">chevron_right</mat-icon> }
          }
        </nav>
      }
      <div class="ph-row">
        <div class="ph-text">
          <h1 class="ph-title">{{ title }}</h1>
          @if (subtitle) { <p class="ph-sub">{{ subtitle }}</p> }
        </div>
        <div class="ph-actions"><ng-content></ng-content></div>
      </div>
      <ng-content select="[tabs]"></ng-content>
    </header>
  `,
  styles: [`
    :host { display: block; }
    .ph { display: grid; gap: 4px; }
    .ph-crumbs { display: flex; align-items: center; gap: 4px; font-size: var(--text-xs); font-weight: 600; color: var(--color-text-3); }
    .ph-crumbs mat-icon { font-size: var(--text-lg); width: 16px; height: 16px; }
    .ph-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .ph-text { min-width: 0; }
    .ph-title { margin: 0; font-size: var(--text-3xl); line-height: 1.2; font-weight: 800; letter-spacing: -0.02em; color: var(--color-text); }
    .ph-sub { margin: 3px 0 0; font-size: var(--text-sm); color: var(--color-text-3); }
    .ph-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .ph-actions:empty { display: none; }
  `]
})
export class PageHeaderComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() crumbs: string[] = [];
}
