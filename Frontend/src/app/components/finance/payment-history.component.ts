import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import * as XLSX from 'xlsx';
import { ToastService } from '../../ui/toast.service';
import { CreditorPacksService, HistoryBatch, HistoryLine, PaymentHistory } from '../../services/creditor-packs.service';
import { PackPreviewDialogComponent } from './pack-preview-dialog.component';

/**
 * Payment history — every batch that has been paid or closed, with the proofs of payment.
 * Shared by Treasury (History tab) and Directors (History tab).
 */
@Component({
  selector: 'app-payment-history',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatTooltipModule, MatProgressSpinnerModule],
  template: `
<div class="ph">
  <div class="ph-filters">
    <label>From <input type="date" [(ngModel)]="from" (change)="load()"></label>
    <label>To <input type="date" [(ngModel)]="to" (change)="load()"></label>
    <label>Company
      <select [(ngModel)]="company" (change)="load()">
        <option value="">All companies</option>
        @for (c of data?.companies || []; track c.code) { <option [value]="c.code">{{ c.name }}</option> }
      </select>
    </label>
    <label class="grow">Search <input type="search" [(ngModel)]="q" placeholder="Batch, supplier, invoice, reference, amount…" (keyup.enter)="load()" (search)="load()"></label>
    <div class="quick">
      <button mat-stroked-button (click)="preset(30)">30 days</button>
      <button mat-stroked-button (click)="preset(90)">90 days</button>
      <button mat-stroked-button (click)="presetYear()">This year</button>
      <button mat-stroked-button (click)="presetAll()">All time</button>
    </div>
    <button mat-flat-button color="primary" (click)="exportXlsx()" [disabled]="!data?.batches?.length"><mat-icon>download</mat-icon>Export</button>
  </div>
  @if (supplier) {
    <div class="ph-supplier"><mat-icon>storefront</mat-icon> Showing packs that paid <b>{{ supplier }}</b> <button mat-button (click)="clearSupplier()"><mat-icon>close</mat-icon> Show all suppliers</button></div>
  }

  @if (loading) { <div class="ph-loading"><mat-spinner diameter="28"></mat-spinner>Loading history…</div> }
  @else if (data) {
    <div class="ph-kpis">
      <div><span class="v">{{ data.count }}</span><span class="l">batches</span></div>
      <div><span class="v">{{ data.total | currency:'ZAR':'R':'1.0-0' }}</span><span class="l">paid out</span></div>
      <div [class.warn]="data.popMissing > 0"><span class="v">{{ data.popMissing }}</span><span class="l">POPs still missing</span></div>
    </div>

    @if (!data.batches.length) { <div class="ph-empty"><mat-icon>history</mat-icon>No payments in this range.</div> }

    @for (b of data.batches; track b.id) {
      <div class="hb" [class.open]="open.has(b.id)">
        <div class="hb-row" (click)="toggle(b.id)">
          <mat-icon class="chev">{{ open.has(b.id) ? 'expand_more' : 'chevron_right' }}</mat-icon>
          <span class="chip co">{{ b.companyCode }}</span>
          <b>{{ b.batchNumber }}</b>
          <span class="chip">{{ b.paymentTypeTitle }}</span>
          <span class="chip" [class.closed]="b.status === 'Closed'" [class.paid]="b.status === 'Paid'">{{ b.statusTitle }}</span>
          <span class="meta">paid {{ (b.paidAt || b.closedAt) | date:'EEE d MMM yyyy' }} · {{ b.items }} payment{{ b.items === 1 ? '' : 's' }}</span>
          @if (b.popMissing > 0) { <span class="chip warn">{{ b.popMissing }} POP missing</span> } @else { <span class="chip ok"><mat-icon>check</mat-icon>all POPs</span> }
          <span class="amt">{{ b.amount | currency:'ZAR':'R':'1.2-2' }}</span>
          <button mat-icon-button matTooltip="Open pack" (click)="$event.stopPropagation(); openPack(b.id)"><mat-icon>open_in_new</mat-icon></button>
        </div>
        @if (open.has(b.id)) {
          <div class="hb-body">
            <div class="trail">
              <span><mat-icon>edit_note</mat-icon>Prepared by <b>{{ b.preparedByName || '—' }}</b></span>
              <span><mat-icon>fact_check</mat-icon>Checked by <b>{{ b.accountantName || '—' }}</b> {{ b.accountantApprovedAt | date:'d MMM HH:mm' }}</span>
              <span><mat-icon>draw</mat-icon>Signed by <b>{{ b.directorName || '—' }}</b> {{ b.directorSignedAt | date:'d MMM HH:mm' }}</span>
              <span><mat-icon>account_balance</mat-icon>Bank file {{ b.bankExportedAt ? (b.bankExportedAt | date:'d MMM HH:mm') : '—' }}</span>
              <span><mat-icon>payments</mat-icon>Paid {{ b.paidAt | date:'d MMM HH:mm' }}</span>
              @if (b.closedAt) { <span><mat-icon>lock</mat-icon>Closed {{ b.closedAt | date:'d MMM HH:mm' }}</span> }
            </div>
            <table class="lines">
              <thead><tr><th>Supplier</th><th>Invoices</th><th>Bank</th><th>Reference</th><th class="num">Amount</th><th>Proof of payment</th></tr></thead>
              <tbody>
                @for (l of b.lines; track l.id) {
                  <tr>
                    <td><b>{{ l.supplierName }}</b>@if (l.description) {<div class="sub">{{ l.description }}</div>}</td>
                    <td>{{ l.invoiceNumbers || '—' }}</td>
                    <td>{{ l.bankName || '—' }}<div class="sub">{{ l.accountNumber }}</div></td>
                    <td>{{ l.paymentReference || '—' }}</td>
                    <td class="num">{{ l.amount | currency:'ZAR':'R':'1.2-2' }}</td>
                    <td>
                      @if (l.popDocId) {
                        <button mat-stroked-button (click)="viewPop(b, l)"><mat-icon>visibility</mat-icon>View</button>
                        <button mat-icon-button (click)="downloadPop(b, l)" matTooltip="Download POP"><mat-icon>download</mat-icon></button>
                      } @else { <span class="missing"><mat-icon>warning</mat-icon>Missing</span> }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    }
  }
</div>
  `,
  styles: [`
.ph-filters { display:flex; flex-wrap:wrap; gap:10px; align-items:flex-end; margin-bottom:14px; }
.ph-filters label { display:flex; flex-direction:column; gap:4px; font-size:12px; color: var(--color-text-3); }
.ph-filters label.grow { flex:1; min-width:220px; }
.ph-filters input, .ph-filters select { height:38px; padding:0 10px; border:1px solid var(--color-line); border-radius:8px; background: var(--surface); color: inherit; font: inherit; }
.quick { display:flex; gap:6px; flex-wrap:wrap; }
.ph-supplier { display:flex; align-items:center; gap:8px; padding:8px 12px; margin-bottom:12px; border-radius:10px; background:var(--color-primary-soft); color:var(--color-primary); font-size:13px; mat-icon { font-size:18px; width:18px; height:18px; } button { margin-left:auto; } }
.ph-loading, .ph-empty { display:flex; align-items:center; gap:10px; padding:28px; justify-content:center; color: var(--color-text-3); }
.ph-kpis { display:flex; gap:12px; margin-bottom:14px; flex-wrap:wrap; }
.ph-kpis > div { padding:10px 16px; border-radius:10px; border:1px solid var(--color-line); background: var(--surface); min-width:140px; }
.ph-kpis .v { display:block; font-size:18px; font-weight:800; } .ph-kpis .l { font-size:12px; color: var(--color-text-3); }
.ph-kpis .warn { border-color:color-mix(in srgb, var(--color-warn) 35%, transparent); background:var(--color-warn-soft); }
.hb { border:1px solid var(--color-line); border-radius:12px; margin-bottom:8px; background: var(--surface); }
.hb-row { display:flex; align-items:center; gap:8px; padding:10px 12px; cursor:pointer; flex-wrap:wrap; }
.hb-row:hover { background: var(--color-surface-2); }
.chev { color: var(--color-text-3); }
.meta { font-size:12px; color: var(--color-text-3); }
.amt { margin-left:auto; font-weight:800; white-space:nowrap; }
.chip { font-size:11px; font-weight:700; padding:2px 8px; border-radius:999px; border:1px solid var(--color-line); display:inline-flex; align-items:center; gap:3px; }
.chip mat-icon { font-size:13px; width:13px; height:13px; }
.chip.co { background:var(--color-text); color:var(--color-on-primary); border-color:var(--color-text); }
.chip.paid { background:var(--color-primary-soft); color:var(--color-primary); border-color:color-mix(in srgb, var(--color-primary) 35%, transparent); }
.chip.closed { background:var(--color-ok-soft); color:var(--color-ok); border-color:color-mix(in srgb, var(--color-ok) 35%, transparent); }
.chip.warn { background:var(--color-warn-soft); color:var(--color-warn); border-color:color-mix(in srgb, var(--color-warn) 35%, transparent); }
.chip.ok { background:var(--color-ok-soft); color:var(--color-ok); border-color:color-mix(in srgb, var(--color-ok) 35%, transparent); }
.hb-body { padding:0 14px 14px 40px; }
.trail { display:flex; flex-wrap:wrap; gap:14px; font-size:12px; color: var(--color-text-3); margin:4px 0 12px; }
.trail span { display:inline-flex; align-items:center; gap:4px; } .trail mat-icon { font-size:15px; width:15px; height:15px; }
.lines { width:100%; border-collapse:collapse; font-size:13px; }
.lines th, .lines td { padding:8px 10px; border-bottom:1px solid var(--color-line); text-align:left; vertical-align:top; }
.lines th { font-size:11px; text-transform:uppercase; letter-spacing:.04em; color: var(--color-text-3); }
.lines .num { text-align:right; white-space:nowrap; }
.sub { font-size:11.5px; color: var(--color-text-3); }
.missing { display:inline-flex; align-items:center; gap:4px; color:var(--color-warn); font-weight:600; font-size:12px; } .missing mat-icon { font-size:16px; width:16px; height:16px; }
  `]
})
export class PaymentHistoryComponent implements OnInit {
  api = inject(CreditorPacksService);
  private dialog = inject(MatDialog);
  private toast = inject(ToastService);
  private router = inject(Router);

  /** Default range in days when first opened. 0 = all time. */
  @Input() defaultDays = 90;
  /** Pre-filter to one supplier (e.g. coming from the aging). */
  @Input() supplier = '';
  /** Pre-fill the search box. */
  @Input() initialQuery = '';

  from = ''; to = ''; company = ''; q = '';
  data: PaymentHistory | null = null;
  loading = false;
  open = new Set<number>();

  ngOnInit(): void { this.q = this.initialQuery || ''; if (this.supplier || this.defaultDays <= 0) this.presetAll(); else this.preset(this.defaultDays); }

  preset(days: number): void {
    const t = new Date(); const f = new Date(); f.setDate(f.getDate() - days);
    this.from = f.toISOString().slice(0, 10); this.to = t.toISOString().slice(0, 10);
    this.load();
  }
  presetYear(): void { const t = new Date(); this.from = `${t.getFullYear()}-01-01`; this.to = t.toISOString().slice(0, 10); this.load(); }
  presetAll(): void { this.from = ''; this.to = ''; this.load(); }
  clearSupplier(): void { this.supplier = ''; this.load(); }

  load(): void {
    this.loading = true;
    this.api.history({ from: this.from, to: this.to, company: this.company, q: this.q, supplier: this.supplier }).subscribe({
      next: d => { this.data = d; this.loading = false; },
      error: e => { this.loading = false; this.toast.error(e?.error?.message || 'Could not load payment history'); }
    });
  }

  toggle(id: number): void { this.open.has(id) ? this.open.delete(id) : this.open.add(id); }
  openPack(id: number): void { this.router.navigate(['/finance'], { queryParams: { side: 'creditors', tab: 'creditors', batch: id } }); }
  viewPop(b: HistoryBatch, l: HistoryLine): void {
    if (!l.popDocId) return;
    PackPreviewDialogComponent.open(this.dialog, { url: this.api.fileUrl(b.id, l.popDocId), title: `Proof of payment · ${l.supplierName}`, subtitle: `${b.batchNumber} · ${b.companyName}` });
  }

  downloadPop(b: HistoryBatch, l: HistoryLine): void {
    if (!l.popDocId) return;
    this.api.file(b.id, l.popDocId).subscribe({
      next: blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `POP_${b.batchNumber}_${l.supplierName.replace(/[^a-z0-9]+/gi, '-')}.pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); },
      error: () => this.toast.error('Could not download the proof of payment')
    });
  }

  exportXlsx(): void {
    if (!this.data) return;
    const rows = this.data.batches.flatMap(b => b.lines.map(l => ({
      'Batch': b.batchNumber, 'Company': b.companyName, 'Type': b.paymentTypeTitle, 'Status': b.statusTitle,
      'Paid on': b.paidAt ? b.paidAt.slice(0, 10) : '', 'Signed by': b.directorName || '', 'Checked by': b.accountantName || '', 'Prepared by': b.preparedByName || '',
      'Supplier': l.supplierName, 'Invoices': l.invoiceNumbers || '', 'Description': l.description || '', 'Bank': l.bankName || '', 'Account': l.accountNumber || '',
      'Reference': l.paymentReference || '', 'Amount': l.amount, 'POP': l.popDocId ? 'Yes' : 'Missing'
    })));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [14, 22, 16, 10, 12, 18, 18, 18, 28, 18, 30, 14, 16, 18, 14, 8].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Payments');
    XLSX.writeFile(wb, `payment-history_${this.from}_${this.to}.xlsx`);
    this.toast.done(`Exported ${rows.length} payment line${rows.length === 1 ? '' : 's'}`);
  }
}
