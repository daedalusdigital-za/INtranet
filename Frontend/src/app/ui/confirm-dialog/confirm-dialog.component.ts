import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmOptions {
  /** Question naming the thing, e.g. "Delete trip sheet STS-000412?" */
  title: string;
  /** What will happen, in a sentence or two. */
  message?: string;
  /** Short list of consequences shown as bullets. */
  details?: string[];
  /** Button text naming the action, e.g. "Delete trip sheet". Defaults to "Continue". */
  confirmText?: string;
  /** Text for the safe choice, e.g. "Keep trip sheet". Defaults to "Cancel". */
  cancelText?: string;
  /** Red confirm button and icon, for deletes and other losses. */
  danger?: boolean;
}

/** In-app replacement for window.confirm() (design review D-10). Open it through ConfirmService. */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="cd" [class.danger]="data.danger">
      @if (data.danger) {
        <span class="cd-icon" aria-hidden="true"><mat-icon>warning</mat-icon></span>
      }
      <h2 mat-dialog-title class="cd-title">{{ data.title }}</h2>
      @if (data.message || data.details?.length) {
        <mat-dialog-content class="cd-body">
          @if (data.message) { <p>{{ data.message }}</p> }
          @if (data.details?.length) {
            <ul>
              @for (d of data.details; track $index) { <li>{{ d }}</li> }
            </ul>
          }
        </mat-dialog-content>
      }
      <mat-dialog-actions align="end" class="cd-actions">
        <button mat-stroked-button type="button" (click)="close(false)">{{ data.cancelText || 'Cancel' }}</button>
        <button mat-flat-button type="button" [class.cd-danger]="data.danger" color="primary" (click)="close(true)" cdkFocusInitial>
          {{ data.confirmText || 'Continue' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .cd { padding: 4px 4px 0; max-width: 460px; }
    .cd-icon { display: inline-grid; place-items: center; width: 40px; height: 40px; margin: 16px 0 0 24px; border-radius: 10px; background: var(--color-danger-soft); color: var(--color-danger); }
    .cd-title { font-size: 18px !important; font-weight: 800 !important; line-height: 1.3 !important; color: var(--color-text); }
    .cd-body { color: var(--color-text-2); font-size: 14px; }
    .cd-body p { margin: 0 0 8px; }
    .cd-body ul { margin: 0; padding-left: 18px; display: grid; gap: 4px; }
    .cd-actions { gap: 8px; padding: 8px 24px 20px !important; }
    .cd-danger { --mdc-filled-button-container-color: var(--color-danger); --mdc-filled-button-label-text-color: var(--color-on-primary); }
  `]
})
export class ConfirmDialogComponent {
  readonly data = inject<ConfirmOptions>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<ConfirmDialogComponent, boolean>);

  close(result: boolean): void {
    this.ref.close(result);
  }
}
