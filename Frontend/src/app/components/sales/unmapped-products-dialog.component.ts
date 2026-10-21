import { Component, Inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';

export interface BackOrderStockInfo {
  code: string;
  commodityId: number;
  commodityName: string;
  onHand: number;
  warehouses: { warehouseId: number; name: string; qty: number }[];
}

interface UnmappedProduct {
  code: string;
  description: string;
  uom?: string;
  companies: string[];
  lines: number;
  totalQty: number;
  totalValue: number;
  // UI state
  mode?: 'create' | 'link';
  linkQuery?: string;
  linkResults?: CommoditySearchHit[];
  linkTarget?: CommoditySearchHit | null;
  busy?: boolean;
  done?: boolean;
  error?: string;
}

interface CommoditySearchHit { id: number; name: string; code?: string | null; unitOfMeasure?: string | null; onHand: number; }

/**
 * Unmapped products queue — back-order item codes that don't match any
 * Commodity.Code, so Stock cannot tell Sales whether stock exists. Each row
 * can be resolved by creating a new product or linking the code to an
 * existing product that has no code yet.
 */
@Component({
  selector: 'app-unmapped-products-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatTooltipModule, MatProgressBarModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>link_off</mat-icon>
      Unmapped Products
      <span class="count" *ngIf="!loading()">{{ pending().length }} open</span>
    </h2>
    <mat-dialog-content>
      <p class="hint">
        These back-order item codes don't exist in the product master, so no stock check is possible for them.
        Create the product, or link the code to an existing product.
      </p>
      <mat-progress-bar mode="indeterminate" *ngIf="loading()"></mat-progress-bar>

      <div class="toolbar" *ngIf="!loading()">
        <mat-form-field appearance="outline" class="search">
          <mat-label>Filter</mat-label>
          <input matInput [(ngModel)]="filter" placeholder="code, description or company">
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>
        <span class="totals">{{ visible().length }} products · {{ sumLines() }} lines · R{{ sumValue() | number:'1.0-0' }}</span>
      </div>

      <div class="empty" *ngIf="!loading() && pending().length === 0">
        <mat-icon>check_circle</mat-icon>
        <span>All back-order item codes are mapped.</span>
      </div>

      <table class="q" *ngIf="!loading() && visible().length > 0">
        <thead>
          <tr><th>Code</th><th>Description</th><th>Co.</th><th class="num">Lines</th><th class="num">Qty</th><th class="num">Value</th><th class="act">Action</th></tr>
        </thead>
        <tbody>
          @for (p of visible(); track p.code) {
            <tr [class.done]="p.done">
              <td class="mono">{{ p.code }}</td>
              <td>
                @if (p.mode === 'create') {
                  <input class="inline" [(ngModel)]="p.description" placeholder="Product name">
                } @else {
                  {{ p.description }}
                }
              </td>
              <td>{{ p.companies.join(', ') }}</td>
              <td class="num">{{ p.lines }}</td>
              <td class="num">{{ p.totalQty | number:'1.0-0' }}</td>
              <td class="num">R{{ p.totalValue | number:'1.0-0' }}</td>
              <td class="act">
                @if (p.done) {
                  <span class="ok"><mat-icon inline>check</mat-icon> Mapped</span>
                } @else if (p.mode === 'link') {
                  <div class="link-box">
                    <input class="inline" [(ngModel)]="p.linkQuery" (ngModelChange)="search(p)" placeholder="Search existing product…">
                    @if (p.linkResults?.length) {
                      <ul class="hits">
                        @for (h of p.linkResults; track h.id) {
                          <li (click)="p.linkTarget = h" [class.sel]="p.linkTarget?.id === h.id" [class.has-code]="!!h.code"
                              [matTooltip]="h.code ? 'Already has code ' + h.code + ' — cannot link' : 'On hand: ' + h.onHand">
                            <span>{{ h.name }}</span><small>{{ h.code || 'no code' }} · {{ h.onHand }} on hand</small>
                          </li>
                        }
                      </ul>
                    }
                    <div class="row-actions">
                      <button mat-flat-button color="primary" [disabled]="!p.linkTarget || !!p.linkTarget.code || p.busy" (click)="link(p)">Link</button>
                      <button mat-button (click)="p.mode = undefined">Cancel</button>
                    </div>
                  </div>
                } @else if (p.mode === 'create') {
                  <div class="row-actions">
                    <button mat-flat-button color="primary" [disabled]="!p.description?.trim() || p.busy" (click)="create(p)">Save</button>
                    <button mat-button (click)="p.mode = undefined">Cancel</button>
                  </div>
                } @else {
                  <button mat-stroked-button (click)="p.mode = 'create'" matTooltip="Create a new product with this code"><mat-icon>add</mat-icon> Create</button>
                  <button mat-stroked-button (click)="p.mode = 'link'; p.linkQuery = p.description; search(p)" matTooltip="Link to an existing product"><mat-icon>link</mat-icon> Link</button>
                }
                <div class="err" *ngIf="p.error">{{ p.error }}</div>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close(changed)">Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 { display:flex; align-items:center; gap:8px; }
    h2 .count { margin-left:auto; font-size:.8rem; background:#fff3e0; color:#e65100; padding:2px 10px; border-radius:12px; font-weight:600; }
    .hint { color:#555; font-size:.9rem; margin:0 0 12px; }
    .toolbar { display:flex; align-items:center; gap:16px; }
    .search { flex:1; }
    .totals { color:#666; font-size:.85rem; white-space:nowrap; }
    .empty { display:flex; align-items:center; gap:8px; padding:24px; color:#2e7d32; justify-content:center; }
    table.q { width:100%; border-collapse:collapse; font-size:.85rem; }
    .q th { text-align:left; padding:8px; border-bottom:2px solid #e0e0e0; color:#555; font-weight:600; position:sticky; top:0; background:#fff; }
    .q td { padding:8px; border-bottom:1px solid #eee; vertical-align:top; }
    .q .num { text-align:right; white-space:nowrap; }
    .q .mono { font-family:monospace; font-weight:600; }
    .q .act { width:260px; }
    .q tr.done td { background:#f1f8e9; color:#777; }
    .ok { color:#2e7d32; font-weight:600; display:inline-flex; align-items:center; gap:4px; }
    .inline { width:100%; padding:6px 8px; border:1px solid #ccc; border-radius:4px; font:inherit; }
    .row-actions { display:flex; gap:6px; margin-top:6px; }
    .act button { margin-right:4px; }
    .hits { list-style:none; margin:4px 0 0; padding:0; max-height:160px; overflow:auto; border:1px solid #e0e0e0; border-radius:4px; }
    .hits li { padding:6px 8px; cursor:pointer; display:flex; flex-direction:column; }
    .hits li:hover { background:#f5f5f5; }
    .hits li.sel { background:#e3f2fd; }
    .hits li.has-code { opacity:.5; cursor:not-allowed; }
    .hits small { color:#777; }
    .err { color:#c62828; font-size:.8rem; margin-top:4px; }
    mat-dialog-content { min-height:300px; }
  `]
})
export class UnmappedProductsDialog {
  loading = signal(true);
  items = signal<UnmappedProduct[]>([]);
  filter = '';
  changed = false;
  private searchTimer: any;

  constructor(
    public ref: MatDialogRef<UnmappedProductsDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { apiUrl: string },
    private http: HttpClient,
    private snack: MatSnackBar
  ) {
    this.http.get<UnmappedProduct[]>(`${data.apiUrl}/backorders/unmapped`).subscribe({
      next: rows => { this.items.set(rows || []); this.loading.set(false); },
      error: () => { this.loading.set(false); this.snack.open('Failed to load unmapped products', 'Close', { duration: 3000 }); }
    });
  }

  pending(): UnmappedProduct[] { return this.items().filter(i => !i.done); }

  visible(): UnmappedProduct[] {
    const f = this.filter.trim().toLowerCase();
    const list = this.items();
    if (!f) return list;
    return list.filter(p => p.code.toLowerCase().includes(f) || p.description?.toLowerCase().includes(f) || p.companies.some(c => c.toLowerCase().includes(f)));
  }

  sumLines(): number { return this.visible().reduce((s, p) => s + p.lines, 0); }
  sumValue(): number { return this.visible().reduce((s, p) => s + p.totalValue, 0); }

  search(p: UnmappedProduct): void {
    clearTimeout(this.searchTimer);
    const q = (p.linkQuery || '').trim();
    if (q.length < 2) { p.linkResults = []; return; }
    this.searchTimer = setTimeout(() => {
      this.http.get<CommoditySearchHit[]>(`${this.data.apiUrl}/backorders/commodity-search`, { params: { q } })
        .subscribe({ next: hits => p.linkResults = hits, error: () => p.linkResults = [] });
    }, 250);
  }

  create(p: UnmappedProduct): void {
    this.post(p, { code: p.code, description: p.description?.trim(), uom: p.uom });
  }

  link(p: UnmappedProduct): void {
    if (!p.linkTarget) return;
    this.post(p, { code: p.code, commodityId: p.linkTarget.id });
  }

  private post(p: UnmappedProduct, body: any): void {
    p.busy = true; p.error = undefined;
    this.http.post<any>(`${this.data.apiUrl}/backorders/map`, body).subscribe({
      next: res => {
        p.busy = false; p.done = true; p.mode = undefined; this.changed = true;
        this.snack.open(`${p.code} → ${res.name}${res.created ? ' (created)' : ''}`, 'Close', { duration: 2500 });
      },
      error: err => {
        p.busy = false;
        p.error = err?.error?.error || err?.message || 'Mapping failed';
      }
    });
  }
}
