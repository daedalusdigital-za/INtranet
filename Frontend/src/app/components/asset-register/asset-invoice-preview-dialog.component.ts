import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

export interface AssetInvoicePreviewData {
  found: boolean;
  invoiceNumber?: string;
  supplierName?: string;
  total?: number;
  currency?: string;
  invoiceDate?: string;
  status?: string;
  fileName?: string;
  contentType?: string;
  blobUrl?: string;      // object URL for the fetched file (already auth-fetched)
  downloadName?: string;
}

@Component({
  selector: 'app-asset-invoice-preview-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="inv-dialog">
      <div class="inv-header">
        <div class="inv-title">
          <mat-icon>receipt_long</mat-icon>
          <div>
            <h3>Invoice {{ data.invoiceNumber || '' }}</h3>
            @if (data.supplierName) { <span class="inv-supplier">{{ data.supplierName }}</span> }
          </div>
        </div>
        <div class="inv-header-actions">
          @if (data.found && data.blobUrl) {
            <button mat-icon-button (click)="download()" matTooltip="Download"><mat-icon>download</mat-icon></button>
            <button mat-icon-button (click)="openNewTab()" matTooltip="Open in new tab"><mat-icon>open_in_new</mat-icon></button>
          }
          <button mat-icon-button (click)="close()" matTooltip="Close"><mat-icon>close</mat-icon></button>
        </div>
      </div>

      @if (data.found) {
        <div class="inv-meta">
          @if (data.invoiceDate) { <span><mat-icon>event</mat-icon> {{ data.invoiceDate | date:'dd MMM yyyy' }}</span> }
          @if (data.total != null) { <span><mat-icon>payments</mat-icon> {{ data.currency || 'ZAR' }} {{ data.total | number:'1.2-2' }}</span> }
          @if (data.status) { <span class="inv-status">{{ data.status }}</span> }
        </div>
        <div class="inv-body">
          @if (isPdf) {
            <iframe [src]="safeUrl" title="Invoice preview"></iframe>
          } @else if (isImage) {
            <img [src]="data.blobUrl" alt="Invoice preview">
          } @else {
            <div class="inv-fallback">
              <mat-icon>description</mat-icon>
              <p>{{ data.fileName || 'Document' }}</p>
              <button mat-raised-button color="primary" (click)="download()"><mat-icon>download</mat-icon> Download to view</button>
            </div>
          }
        </div>
      } @else {
        <div class="inv-notfound">
          <mat-icon>search_off</mat-icon>
          <h4>No matching invoice in Books</h4>
          <p>Invoice <strong>{{ data.invoiceNumber || '—' }}</strong> is not yet uploaded or linked in the Books module.</p>
          <p class="hint">Upload it under <em>Books › Invoices</em>, then it will preview here automatically.</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .inv-dialog { width: 78vw; max-width: 900px; height: 82vh; display: flex; flex-direction: column; background: #fff; }
    .inv-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid #eef2f7; }
    .inv-title { display: flex; align-items: center; gap: 12px; }
    .inv-title > mat-icon { color: #2563eb; font-size: 28px; width: 28px; height: 28px; }
    .inv-title h3 { margin: 0; font-size: 17px; color: #1f2937; font-weight: 700; }
    .inv-supplier { font-size: 12px; color: #6b7280; }
    .inv-header-actions { display: flex; gap: 2px; }
    .inv-meta { display: flex; align-items: center; gap: 18px; padding: 10px 18px; background: #f8fafc; border-bottom: 1px solid #eef2f7; font-size: 13px; color: #475569; flex-wrap: wrap; }
    .inv-meta span { display: inline-flex; align-items: center; gap: 5px; }
    .inv-meta mat-icon { font-size: 16px; width: 16px; height: 16px; color: #94a3b8; }
    .inv-status { background: #dbeafe; color: #1d4ed8; border-radius: 10px; padding: 2px 10px; font-size: 11px; font-weight: 600; }
    .inv-body { flex: 1; min-height: 0; background: #525659; }
    .inv-body iframe { width: 100%; height: 100%; border: 0; }
    .inv-body img { width: 100%; height: 100%; object-fit: contain; }
    .inv-fallback { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; color: #e5e7eb; }
    .inv-fallback mat-icon { font-size: 56px; width: 56px; height: 56px; opacity: .8; }
    .inv-notfound { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 40px; }
    .inv-notfound mat-icon { font-size: 64px; width: 64px; height: 64px; color: #cbd5e1; }
    .inv-notfound h4 { margin: 16px 0 8px; color: #374151; font-size: 18px; }
    .inv-notfound p { margin: 4px 0; color: #6b7280; font-size: 14px; }
    .inv-notfound .hint { font-size: 12px; color: #9ca3af; margin-top: 10px; }
  `]
})
export class AssetInvoicePreviewDialogComponent {
  safeUrl: SafeResourceUrl;
  isPdf = false;
  isImage = false;

  constructor(
    private ref: MatDialogRef<AssetInvoicePreviewDialogComponent>,
    private sanitizer: DomSanitizer,
    @Inject(MAT_DIALOG_DATA) public data: AssetInvoicePreviewData
  ) {
    const ct = (data.contentType || '').toLowerCase();
    const name = (data.fileName || '').toLowerCase();
    this.isPdf = ct.includes('pdf') || name.endsWith('.pdf');
    this.isImage = ct.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/.test(name);
    this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(data.blobUrl || '');
  }

  download() {
    if (!this.data.blobUrl) return;
    const a = document.createElement('a');
    a.href = this.data.blobUrl;
    a.download = this.data.downloadName || this.data.fileName || 'invoice';
    a.click();
  }

  openNewTab() { if (this.data.blobUrl) window.open(this.data.blobUrl, '_blank'); }
  close() { this.ref.close(); }
}
