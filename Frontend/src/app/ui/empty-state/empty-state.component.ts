import { Component, Input, OnChanges, booleanAttribute, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { ILLUSTRATIONS, IllustrationKey, illustrationFor } from './illustrations';

/**
 * Says why a list is empty and offers the next step (design review D-11), instead of "No data".
 * Put the next step's button inside it. Visual refresh: shows a small illustration in the
 * module accent, picked from the icon unless `illustration` is given; compact ones keep the icon.
 *
 *   <app-empty-state icon="filter_alt_off" title="No loads match Late"
 *                    message="Every load due by now has been delivered or is still inside its window.">
 *     <button mat-stroked-button (click)="clearFilters()">Show all loads</button>
 *   </app-empty-state>
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="es" [class.compact]="compact">
      @if (compact) {
        <span class="es-tile" aria-hidden="true"><mat-icon>{{ icon }}</mat-icon></span>
      } @else {
        <svg class="es-art" viewBox="0 0 160 110" aria-hidden="true" [innerHTML]="art"></svg>
      }
      <b>{{ title }}</b>
      @if (message) { <p>{{ message }}</p> }
      <div class="es-actions"><ng-content></ng-content></div>
    </div>
  `,
  styles: [`
    .es { display: grid; justify-items: center; gap: 6px; padding: 32px 16px 36px; text-align: center; color: var(--color-text-3); }
    .es.compact { padding: 18px 12px; }
    .es-art { width: 168px; height: 116px; margin-bottom: 4px; animation: refresh-rise-in 300ms var(--ease) both; }
    .es-art ::ng-deep .a { fill: var(--accent); stroke: var(--accent); }
    .es-art ::ng-deep .s { fill: var(--accent-soft); stroke: color-mix(in srgb, var(--accent) 30%, transparent); }
    .es-art ::ng-deep .n { fill: var(--color-surface); stroke: var(--color-line-strong); stroke-width: 1.5; }
    .es-art ::ng-deep .l { stroke: var(--color-text-3); stroke-width: 2; stroke-linecap: round; fill: none; }
    .es-art ::ng-deep path.a[fill='none'], .es-art ::ng-deep path.a[stroke-width] { fill: none; }
    .es-tile { display: inline-grid; place-items: center; width: 40px; height: 40px; border-radius: 10px; background: var(--accent-soft); color: var(--accent); }
    .es-tile mat-icon { font-size: 22px; width: 22px; height: 22px; }
    .es b { font-size: var(--text-md); color: var(--color-text); }
    .es p { margin: 0; font-size: var(--text-sm); max-width: 420px; }
    .es-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; justify-content: center; margin-top: 6px; }
    .es-actions:empty { display: none; }
  `]
})
export class EmptyStateComponent implements OnChanges {
  private readonly sanitizer = inject(DomSanitizer);
  @Input() icon = 'inbox';
  @Input({ required: true }) title = '';
  @Input() message = '';
  /** Scene to draw; defaults to one that suits the icon. */
  @Input() illustration: IllustrationKey | null = null;
  /** Less padding, for small cards and side panels (shows the icon on a tile instead of a scene). */
  @Input({ transform: booleanAttribute }) compact = false;

  /** Static, app-authored SVG markup (never user data), so trusting it is safe. Cached so change detection doesn't redraw it. */
  art: SafeHtml = '';
  private artKey = '';

  ngOnChanges(): void {
    const key = this.illustration ?? illustrationFor(this.icon);
    if (key !== this.artKey) { this.artKey = key; this.art = this.sanitizer.bypassSecurityTrustHtml(ILLUSTRATIONS[key]); }
  }
}
