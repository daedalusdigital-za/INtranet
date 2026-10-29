import { Component, Input } from '@angular/core';

/**
 * Placeholder rows in the shape of the content that is loading (design review D-11).
 * Use instead of a spinner for lists and tables; keep spinners for button actions.
 *   <app-skeleton-rows [rows]="4" />
 */
@Component({
  selector: 'app-skeleton-rows',
  standalone: true,
  template: `
    <div class="sk" aria-busy="true" aria-label="Loading">
      @for (r of rowArray; track $index) {
        <div class="sk-row">
          @if (avatar) { <span class="skeleton sk-av"></span> }
          <span class="sk-lines">
            <span class="skeleton sk-line" [style.width.%]="70 - ($index % 3) * 12"></span>
            <span class="skeleton sk-line sk-sub" [style.width.%]="45 - ($index % 2) * 10"></span>
          </span>
        </div>
      }
    </div>
  `,
  styles: [`
    .sk { display: grid; }
    .sk-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--color-line); }
    .sk-row:last-child { border-bottom: 0; }
    .sk-av { width: 34px; height: 34px; border-radius: 9px; flex: none; }
    .sk-lines { flex: 1; display: grid; gap: 7px; }
    .sk-line { display: block; height: 11px; border-radius: 4px; }
    .sk-sub { height: 9px; }
  `]
})
export class SkeletonRowsComponent {
  @Input() rows = 3;
  @Input() avatar = true;
  get rowArray(): number[] { return Array.from({ length: this.rows }, (_, i) => i); }
}
