import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

/**
 * Reusable inline loading indicator for consistent "loading…" UX.
 *
 * Usage:
 *   <app-loading message="Fetching stock…"></app-loading>
 */
@Component({
  selector: 'app-loading',
  standalone: true,
  imports: [CommonModule, MatProgressSpinnerModule],
  template: `
    <div class="ld" [class.ld--inline]="inline">
      <mat-spinner [diameter]="diameter"></mat-spinner>
      @if (message) { <p class="ld__msg">{{ message }}</p> }
    </div>
  `,
  styles: [`
    .ld { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 48px 0; color: #64748b; }
    .ld--inline { flex-direction: row; padding: 12px 0; gap: 10px; }
    .ld__msg { margin: 0; font-size: 0.9rem; }
  `]
})
export class LoadingComponent {
  @Input() message = '';
  @Input() diameter = 40;
  @Input() inline = false;
}
