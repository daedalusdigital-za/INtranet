import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { OpenMapComponent } from './open-map.component';

/**
 * Dialog wrapper that hosts the live Open Map. Opened from the Logistics
 * header button. Provides a close control plus an "open in new tab" action
 * that navigates to the standalone /logistics/open-map page. The map's own
 * Maximize (full-screen) button remains fully functional inside the dialog.
 */
@Component({
  selector: 'app-open-map-dialog',
  standalone: true,
  imports: [
    CommonModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatTooltipModule, OpenMapComponent
  ],
  template: `
    <div class="omd-shell">
      <div class="omd-header">
        <div class="omd-title">
          <mat-icon>map</mat-icon>
          <span>Open Map — Live Fleet</span>
        </div>
        <div class="omd-actions">
          <button mat-stroked-button (click)="openInNewTab()"
                  matTooltip="Open as a separate page / tab">
            <mat-icon>open_in_new</mat-icon> Open in new tab
          </button>
          <button aria-label="Close" mat-icon-button (click)="close()" matTooltip="Close">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>
      <div class="omd-body">
        <app-open-map></app-open-map>
      </div>
    </div>
  `,
  styles: [`
    .omd-shell { display:flex; flex-direction:column; height:100%; background:#0b1220; }
    .omd-header {
      display:flex; align-items:center; justify-content:space-between;
      padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.1);
      background:var(--color-text); flex-shrink:0;
    }
    .omd-title { display:flex; align-items:center; gap:10px; color:#fff; font-size:16px; font-weight:600; }
    .omd-title mat-icon { color:#60a5fa; }
    .omd-actions { display:flex; align-items:center; gap:8px; }
    .omd-actions button { color:#fff !important; border-color:rgba(255,255,255,0.3) !important; }
    .omd-actions .mat-mdc-icon-button { color:#fff !important; }
    .omd-body { flex:1; overflow:auto; padding:12px 16px; }
  `]
})
export class OpenMapDialogComponent {
  constructor(private ref: MatDialogRef<OpenMapDialogComponent>) {}

  openInNewTab(): void {
    window.open('/logistics/open-map', '_blank');
  }

  close(): void {
    this.ref.close();
  }
}
