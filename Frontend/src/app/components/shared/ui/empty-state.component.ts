import { Component, Input } from '@angular/core';
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
    <div class="es">
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
    .es__icon { font-size: 56px; width: 56px; height: 56px; color: #cbd5e1; margin-bottom: 12px; }
    .es__title { margin: 0 0 6px; font-size: 1.15rem; font-weight: 700; color: #0f172a; }
    .es__msg { margin: 0; color: #64748b; font-size: 0.9rem; max-width: 420px; }
  `]
})
export class EmptyStateComponent {
  @Input() icon = 'inbox';
  @Input() title = 'Nothing here yet';
  @Input() message = '';
}
