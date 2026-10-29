import { Component, Inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../ui/toast.service';
import { SkeletonRowsComponent } from '../../ui/skeleton-rows/skeleton-rows.component';

export interface ManualLinkDialogData {
  itemId: number;
  assetDescription: string;   // e.g. "Dell OptiPlex i5 — assigned to John"
  currentInvoiceNumber?: string;
  currentBookInvoiceId?: number | null;
}

interface SupplierOption { supplierName: string; invoiceCount: number; hasExtractedText: boolean; }
interface InvoiceOption {
  bookInvoiceId: number;
  invoiceNumber?: string;
  supplierName: string;
  total?: number | null;
  currency?: string;
  invoiceDate?: string;
  description?: string;
  hasExtractedText: boolean;
  fileName?: string;
}

@Component({
  selector: 'app-asset-manual-link-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule, SkeletonRowsComponent],
  template: `
    <div class="link-dialog">
      <div class="link-header">
        <mat-icon>link</mat-icon>
        <div>
          <h2>Link Invoice to Asset</h2>
          <p>{{ data.assetDescription }}</p>
        </div>
      </div>

      @if (data.currentBookInvoiceId) {
        <div class="current-link">
          <mat-icon>info</mat-icon>
          <span>Currently linked to invoice <strong>{{ data.currentInvoiceNumber || ('#' + data.currentBookInvoiceId) }}</strong>. Picking a new one will replace it.</span>
        </div>
      }

      <div class="link-body">
        <div class="field">
          <label for="supplier">1 · Supplier</label>
          <select id="supplier" [(ngModel)]="supplierName" (ngModelChange)="onSupplierChange()">
            <option value="">— Select a supplier —</option>
            @for (s of suppliers(); track s.supplierName) {
              <option [value]="s.supplierName">
                {{ s.supplierName }} ({{ s.invoiceCount }}){{ s.hasExtractedText ? '' : ' — scanned' }}
              </option>
            }
          </select>
          <span class="hint">All suppliers with confirmed invoices are shown, including scanned invoices that AI can't read.</span>
        </div>

        <div class="field">
          <label for="invoice">2 · Invoice</label>
          @if (loadingInvoices()) {
            <div class="loading-row"><app-skeleton-rows [rows]="1" [avatar]="false"></app-skeleton-rows></div>
          } @else {
            <select id="invoice" [(ngModel)]="selectedInvoiceId" [disabled]="!supplierName || invoices().length === 0">
              <option [ngValue]="null">— Select an invoice —</option>
              @for (inv of invoices(); track inv.bookInvoiceId) {
                <option [ngValue]="inv.bookInvoiceId">
                  {{ inv.invoiceNumber || ('#' + inv.bookInvoiceId) }}
                  · {{ inv.invoiceDate ? (inv.invoiceDate | date:'yyyy-MM-dd') : 'no date' }}
                  · {{ inv.currency || 'R' }}{{ (inv.total || 0) | number:'1.2-2' }}
                </option>
              }
            </select>
            @if (supplierName && invoices().length === 0) {
              <span class="hint warn">No confirmed invoices found for this supplier.</span>
            }
          }
        </div>

        @if (selectedInvoice(); as inv) {
          <div class="invoice-preview">
            <div class="ip-row"><span class="ip-lbl">Invoice #</span><span>{{ inv.invoiceNumber || '—' }}</span></div>
            <div class="ip-row"><span class="ip-lbl">Supplier</span><span>{{ inv.supplierName }}</span></div>
            <div class="ip-row"><span class="ip-lbl">Date</span><span>{{ inv.invoiceDate ? (inv.invoiceDate | date:'mediumDate') : '—' }}</span></div>
            <div class="ip-row"><span class="ip-lbl">Total</span><span class="ip-total">{{ inv.currency || 'R' }}{{ (inv.total || 0) | number:'1.2-2' }}</span></div>
            @if (inv.description) { <div class="ip-row"><span class="ip-lbl">Description</span><span>{{ inv.description }}</span></div> }
            @if (!inv.hasExtractedText) {
              <div class="ip-scan"><mat-icon>document_scanner</mat-icon> Scanned invoice — link the total manually below.</div>
            }
          </div>

          <div class="field">
            <label for="bookValue">3 · Book value for this asset (optional)</label>
            <div class="value-input">
              <span class="cur">{{ inv.currency || 'R' }}</span>
              <input id="bookValue" type="number" step="0.01" [(ngModel)]="bookValue" placeholder="e.g. {{ (inv.total || 0) | number:'1.2-2' }}" />
              <button mat-button class="use-total" (click)="bookValue = inv.total || null" matTooltip="Use the full invoice total">Use total</button>
            </div>
            <span class="hint">Leave blank to link without setting a value. For a single-item invoice, use the total.</span>
          </div>
        }
      </div>

      <div class="link-actions">
        <button mat-button (click)="close()">Cancel</button>
        <button mat-raised-button color="primary" (click)="applyLink()" [disabled]="!selectedInvoiceId || saving()">
          @if (saving()) { <mat-spinner diameter="18"></mat-spinner> <span>Linking…</span> }
          @else { <mat-icon>link</mat-icon> <span>Link Invoice</span> }
        </button>
      </div>
    </div>
  `,
  styles: [`
    .link-dialog { display: flex; flex-direction: column; gap: 16px; padding: 20px; width: 560px; max-width: 95vw; max-height: 88vh; overflow-y: auto; }
    .link-header { display: flex; gap: 12px; align-items: flex-start; }
    .link-header mat-icon { color: var(--color-primary); font-size: var(--text-3xl); width: 24px; height: 24px; }
    .link-header h2 { margin: 0 0 4px; font-size: var(--text-2xl); color: var(--color-text); }
    .link-header p { margin: 0; color: var(--color-text-3); font-size: var(--text-sm); }

    .current-link { display: flex; gap: 8px; align-items: center; background: var(--color-primary-soft); border: 1px solid var(--color-primary-soft); border-radius: 8px; padding: 10px 12px; font-size: var(--text-sm); color: var(--color-primary-hover); }
    .current-link mat-icon { font-size: var(--text-xl); width: 18px; height: 18px; }

    .link-body { display: flex; flex-direction: column; gap: 16px; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field label { font-weight: 600; font-size: var(--text-sm); color: var(--color-text-2); }
    .field select { padding: 9px 10px; border: 1px solid var(--color-line-strong); border-radius: 8px; font-size: var(--text-md); background: var(--color-surface); color: var(--color-text); }
    .field select:disabled { background: var(--color-surface-2); color: var(--color-text-3); }
    .hint { font-size: var(--text-xs); color: var(--color-text-3); }
    .hint.warn { color: var(--color-warn); }
    .loading-row { border: 1px solid var(--color-line); border-radius: 8px; overflow: hidden; }

    .invoice-preview { background: var(--color-canvas); border: 1px solid var(--color-line); border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; gap: 6px; }
    .ip-row { display: flex; gap: 10px; font-size: var(--text-sm); }
    .ip-lbl { min-width: 92px; color: var(--color-text-3); font-weight: 600; }
    .ip-total { font-weight: 700; color: var(--color-ok); }
    .ip-scan { display: flex; gap: 6px; align-items: center; margin-top: 4px; font-size: var(--text-xs); color: var(--color-warn); background: var(--color-warn-soft); border: 1px solid var(--color-warn-soft); border-radius: 6px; padding: 6px 8px; }
    .ip-scan mat-icon { font-size: var(--text-lg); width: 16px; height: 16px; }

    .value-input { display: flex; align-items: center; gap: 8px; }
    .value-input .cur { font-weight: 600; color: var(--color-text-2); }
    .value-input input { flex: 1; padding: 9px 10px; border: 1px solid var(--color-line-strong); border-radius: 8px; font-size: var(--text-md); background: var(--color-surface); color: var(--color-text); }
    .use-total { white-space: nowrap; font-size: var(--text-xs); }

    .link-actions { display: flex; gap: 8px; justify-content: flex-end; align-items: center; }
  `]
})
export class AssetManualLinkDialogComponent implements OnInit {
  suppliers = signal<SupplierOption[]>([]);
  invoices = signal<InvoiceOption[]>([]);
  loadingInvoices = signal(false);
  saving = signal(false);

  supplierName = '';
  selectedInvoiceId: number | null = null;
  bookValue: number | null = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ManualLinkDialogData,
    private dialogRef: MatDialogRef<AssetManualLinkDialogComponent>,
    private http: HttpClient,
    private toast: ToastService
  ) {}

  private headers(): HttpHeaders {
    const t = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${t}` });
  }

  ngOnInit(): void {
    this.http.get<SupplierOption[]>(`${environment.apiUrl}/asset-register/all-suppliers`, { headers: this.headers() })
      .subscribe({ next: s => this.suppliers.set(s || []), error: () => this.toast.error('Could not load suppliers.') });
  }

  selectedInvoice(): InvoiceOption | undefined {
    return this.invoices().find(i => i.bookInvoiceId === this.selectedInvoiceId);
  }

  onSupplierChange(): void {
    this.selectedInvoiceId = null;
    this.bookValue = null;
    this.invoices.set([]);
    if (!this.supplierName) return;

    this.loadingInvoices.set(true);
    const url = `${environment.apiUrl}/asset-register/invoices-by-supplier?supplier=${encodeURIComponent(this.supplierName)}`;
    this.http.get<InvoiceOption[]>(url, { headers: this.headers() }).subscribe({
      next: inv => { this.invoices.set(inv || []); this.loadingInvoices.set(false); },
      error: () => { this.loadingInvoices.set(false); this.toast.error('Could not load invoices.'); }
    });
  }

  applyLink(): void {
    if (!this.selectedInvoiceId) return;
    const inv = this.selectedInvoice();
    this.saving.set(true);

    const body = {
      matches: [{
        itemId: this.data.itemId,
        bookInvoiceId: this.selectedInvoiceId,
        invoiceNumber: inv?.invoiceNumber || null,
        bookValue: this.bookValue
      }],
      overwriteExistingValues: this.bookValue != null
    };

    this.http.post<any>(`${environment.apiUrl}/asset-register/apply-invoice-matches`, body, { headers: this.headers() }).subscribe({
      next: res => {
        this.saving.set(false);
        this.dialogRef.close({ linked: true, applied: res?.applied ?? 1 });
      },
      error: err => {
        this.saving.set(false);
        this.toast.error(err?.error?.detail || err?.error?.error || 'Failed to link invoice.');
      }
    });
  }

  close(): void { this.dialogRef.close(); }
}
