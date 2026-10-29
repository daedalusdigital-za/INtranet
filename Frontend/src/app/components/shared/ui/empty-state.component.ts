import { Component, Input, booleanAttribute } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

/**
 * Reusable empty-state block for consistent "nothing here yet" UX.
 *
 * Usage:
 *   <app-empty-state icon="warehouse" title="No warehouses"
 *                    message="No warehouses have been configured yet."></app-empty-state>
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="es" [class.es--compact]="compact">
      <mat-icon class="es__icon">{{ icon }}</mat-icon>
      <h3 class="es__title">{{ title }}</h3>
      @if (message) { <p class="es__msg">{{ message }}</p> }
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    .es {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 56px 24px; text-align: center;
    }
    .es__icon { font-size: 56px; width: 56px; height: 56px; color: var(--color-line-strong); margin-bottom: 12px; }
    .es__title { margin: 0 0 6px; font-size: 1.15rem; font-weight: 700; color: var(--color-text); }
    .es__msg { margin: 0; color: var(--color-text-3); font-size: 0.9rem; max-width: 420px; }
    /* Inside panels and lists */
    .es--compact { padding: 22px 16px; }
    .es--compact .es__icon { font-size: var(--text-3xl); width: 24px; height: 24px; margin-bottom: 6px; color: var(--color-text-3); }
    .es--compact .es__title { font-size: var(--text-md); }
    .es--compact .es__msg { font-size: var(--text-sm); }
  `]
})
export class EmptyStateComponent {
  @Input() icon = 'inbox';
  @Input() title = 'Nothing here yet';
  @Input() message = '';
  /** Smaller version for use inside a panel or list. */
  @Input({ transform: booleanAttribute }) compact = false;
}
