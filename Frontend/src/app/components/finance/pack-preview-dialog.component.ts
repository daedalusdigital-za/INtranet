import { Component, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

export interface PackPreviewData { url: string; title: string; subtitle?: string; fileName?: string; }

/** In-page PDF/image preview of a pack (or one of its component files). Fetches with auth, shows in an iframe. */
@Component({
  selector: 'app-pack-preview-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule, MatButtonModule, MatTooltipModule, MatProgressSpinnerModule],
  template: `
  <div class="pv">
    <header class="pv__head">
      <mat-icon class="pv__icon">picture_as_pdf</mat-icon>
      <div class="pv__title"><b>{{ data.title }}</b>@if (data.subtitle) { <small>{{ data.subtitle }}</small> }</div>
      <button mat-icon-button type="button" (click)="openTab()" [disabled]="!blobUrl()" matTooltip="Open in new tab"><mat-icon>open_in_new</mat-icon></button>
      <button mat-icon-button type="button" (click)="download()" [disabled]="!blobUrl()" matTooltip="Download"><mat-icon>download</mat-icon></button>
      <button mat-icon-button type="button" mat-dialog-close aria-label="Close"><mat-icon>close</mat-icon></button>
    </header>
    <div class="pv__body">
      @if (loading()) { <div class="pv__state"><mat-spinner diameter="32"></mat-spinner></div> }
      @else if (error()) { <div class="pv__state pv__state--err"><mat-icon>error_outline</mat-icon><p>{{ error() }}</p></div> }
      @else if (isImage()) { <img [src]="safeUrl()!" alt="" /> }
      @else { <iframe [src]="safeUrl()!" title="Preview"></iframe> }
    </div>
  </div>
  `,
  styles: [`
    :host { display:block; }
    .pv { display:flex; flex-direction:column; height: 92vh; }
    .pv__head { display:flex; align-items:center; gap:10px; padding:10px 12px 10px 16px; border-bottom:1px solid var(--color-line); }
    .pv__icon { color:#dc2626; }
    .pv__title { flex:1; min-width:0; display:flex; flex-direction:column; b { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } small { color: var(--color-text-muted); font-size:.78rem; } }
    .pv__body { flex:1; min-height:0; background:#525659; display:flex; align-items:center; justify-content:center;
      iframe { width:100%; height:100%; border:0; } img { max-width:100%; max-height:100%; object-fit:contain; } }
    .pv__state { display:flex; flex-direction:column; align-items:center; gap:8px; color:#fff; &--err { mat-icon { font-size:40px; width:40px; height:40px; } p { margin:0; } } }
  `]
})
export class PackPreviewDialogComponent implements OnDestroy {
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);
  private ref = inject(MatDialogRef<PackPreviewDialogComponent>);
  data = inject<PackPreviewData>(MAT_DIALOG_DATA);

  static open(dialog: MatDialog, data: PackPreviewData) {
    return dialog.open(PackPreviewDialogComponent, { width: 'min(1100px, 96vw)', maxWidth: '96vw', maxHeight: '96vh', panelClass: 'pack-preview-panel', data, autoFocus: false });
  }

  loading = signal(true);
  error = signal('');
  blobUrl = signal<string | null>(null);
  safeUrl = signal<SafeResourceUrl | null>(null);
  isImage = signal(false);

  constructor() {
    this.http.get(this.data.url, { responseType: 'blob' }).subscribe({
      next: b => {
        const url = URL.createObjectURL(b);
        this.isImage.set(b.type.startsWith('image/'));
        this.blobUrl.set(url);
        this.safeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.isImage() ? url : `${url}#toolbar=1&navpanes=0`));
        this.loading.set(false);
      },
      error: e => { this.loading.set(false); this.error.set(e?.status === 404 ? 'The file is missing on the server.' : "Couldn't load the file."); },
    });
  }

  openTab(): void { const u = this.blobUrl(); if (u) window.open(u, '_blank'); }
  download(): void {
    const u = this.blobUrl(); if (!u) return;
    const a = document.createElement('a'); a.href = u; a.download = this.data.fileName || 'document.pdf'; a.click();
  }
  ngOnDestroy(): void { const u = this.blobUrl(); if (u) setTimeout(() => URL.revokeObjectURL(u), 1000); }
}
