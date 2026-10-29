import { Component, Input, booleanAttribute } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Says why a list is empty and offers the next step (design review D-11), instead of "No data".
 * Put the next step's button inside it.
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
      <mat-icon aria-hidden="true">{{ icon }}</mat-icon>
      <b>{{ title }}</b>
      @if (message) { <p>{{ message }}</p> }
      <div class="es-actions"><ng-content></ng-content></div>
    </div>
  `,
  styles: [`
    .es { display: grid; justify-items: center; gap: 6px; padding: 40px 16px; text-align: center; color: var(--color-text-3); }
    .es.compact { padding: 20px 12px; }
    .es mat-icon { font-size: 32px; width: 32px; height: 32px; color: var(--color-text-3); }
    .es b { font-size: var(--text-md); color: var(--color-text); }
    .es p { margin: 0; font-size: var(--text-sm); max-width: 420px; }
    .es-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; justify-content: center; margin-top: 6px; }
    .es-actions:empty { display: none; }
  `]
})
export class EmptyStateComponent {
  @Input() icon = 'inbox';
  @Input({ required: true }) title = '';
  @Input() message = '';
  /** Less padding, for small cards and side panels. */
  @Input({ transform: booleanAttribute }) compact = false;
}
