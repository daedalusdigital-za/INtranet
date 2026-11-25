import { Component, Input, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { moduleForUrl, ModuleKey } from '../module-accent';

/** Default page icon per module, shown on the accent tile when a page doesn't pass one. */
const MODULE_ICONS: Record<ModuleKey, string> = {
  home: 'home', docs: 'folder_open', projects: 'view_kanban', sales: 'trending_up', logistics: 'local_shipping',
  stock: 'inventory_2', tenders: 'gavel', people: 'groups', finance: 'account_balance', admin: 'settings',
};

/**
 * Compact page header (design review D-08): breadcrumb, title, one line of context,
 * and actions on the right. Visual refresh: the title sits beside an icon tile in the
 * module's accent colour.
 *
 *   <app-page-header [crumbs]="['Operations', 'Logistics']" title="Loads" icon="local_shipping" subtitle="Updated 1 minute ago">
 *     <button mat-stroked-button>Live map</button>
 *     <button mat-flat-button color="primary">New load</button>
 *     <nav tabs> ...sub-navigation links... </nav>
 *   </app-page-header>
 *
 * Buttons go in the default slot; an element with the `tabs` attribute renders below.
 * Pass icon="" to hide the tile.
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
          @if (tileIcon) { <span class="icon-tile ph-tile" aria-hidden="true"><mat-icon>{{ tileIcon }}</mat-icon></span> }
          <div class="ph-words">
            <h1 class="ph-title">{{ title }}</h1>
            @if (subtitle) { <p class="ph-sub">{{ subtitle }}</p> }
          </div>
        </div>
        <div class="ph-actions"><ng-content></ng-content></div>
      </div>
      <ng-content select="[tabs]"></ng-content>
    </header>
  `,
  styles: [`
    :host { display: block; }
    .ph { display: grid; gap: 6px; }
    .ph-crumbs { display: flex; align-items: center; gap: 4px; font-size: var(--text-xs); font-weight: 600; color: var(--color-text-3); }
    .ph-crumbs mat-icon { font-size: var(--text-lg); width: 16px; height: 16px; }
    .ph-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .ph-text { min-width: 0; display: flex; align-items: center; gap: 14px; }
    .ph-tile { width: 44px; height: 44px; border-radius: 12px; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 14%, transparent); }
    .ph-tile mat-icon { font-size: 24px; width: 24px; height: 24px; }
    .ph-words { min-width: 0; }
    .ph-title { margin: 0; font-size: calc(28px * var(--text-scale)); line-height: 1.15; font-weight: 700; letter-spacing: -0.02em; color: var(--color-text); }
    .ph-sub { margin: 3px 0 0; font-size: var(--text-sm); color: var(--color-text-3); }
    .ph-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .ph-actions:empty { display: none; }
  `]
})
export class PageHeaderComponent {
  private readonly router = inject(Router);
  @Input() title = '';
  @Input() subtitle = '';
  @Input() crumbs: string[] = [];
  /** Material icon for the accent tile; defaults to the module's icon. Pass '' for none. */
  @Input() icon: string | null = null;

  get tileIcon(): string { return this.icon ?? MODULE_ICONS[moduleForUrl(this.router.url)]; }
}
