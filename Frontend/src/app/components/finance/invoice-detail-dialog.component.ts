import { Component, Inject, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from '../../../environments/environment';
import { companyLogo, companyName } from '../../core/company-logos';

export interface InvoiceDetail {
  number: string; company?: string; customerNumber?: string; customerName?: string; date?: string;
  total: number; cost: number; quantity: number; status?: string; inSage: boolean;
  delivery?: { deliveryAddress?: string; deliveryCity?: string; deliveryProvince?: string; contactPerson?: string; contactPhone?: string } | null;
  lines: { productCode: string; productDescription: string; brand?: string; quantity: number; salesAmount: number; costOfSales: number; deliveredQuantity?: number }[];
  load?: { id: number; loadNumber: string; status: string; scheduledPickupDate?: string; actualPickupDate?: string; scheduledDeliveryDate?: string; actualDeliveryDate?: string } | null;
  driverPods: { id: number; deliveredAt: string; fileName?: string }[];
  scanPods: { podDocumentId: number; deliveryDate: string; fileName: string; linkedAt: string }[];
  credits: { number: string; date: string; value: number }[];
  aging?: { snapshotId: number; documentDate?: string; dueDate?: string; amount: number; balance: number; ageDays: number; daysOver?: number; bucket: number; bucketLabel: string; poNumber?: string; orderNumber?: string; reference?: string } | null;
}

/** Pop-up with everything we know about one invoice: Sage lines, trip sheet, PODs, credits and its aging row. */
@Component({
  selector: 'app-invoice-detail-dialog',
  standalone: true,
  imports: [CommonModule, RouterModule, MatDialogModule, MatIconModule, MatButtonModule, MatTooltipModule, MatProgressSpinnerModule],
  template: `
    <div class="hd">
      <img class="logo" [src]="logo(d()?.company || data.company)" alt="">
      <div class="t">
        <div class="eyebrow">{{ coName(d()?.company || data.company) }} · Invoice</div>
        <h2 class="mono">{{ data.number }}</h2>
        @if (d(); as v) { <div class="sub">{{ v.customerName }} <span class="mono muted">{{ v.customerNumber }}</span> · {{ v.date | date:'dd MMM yyyy' }}</div> }
      </div>
      <span class="sp"></span>
      <button mat-icon-button mat-dialog-close aria-label="Close"><mat-icon>close</mat-icon></button>
    </div>

    <mat-dialog-content>
      @if (loading()) { <div class="center"><mat-spinner diameter="32"></mat-spinner></div> }
      @else if (!d()) { <div class="center muted"><mat-icon>search_off</mat-icon> This invoice isn't in the imported sales history yet.</div> }
      @else { @if (d(); as v) {
        <!-- Status strip -->
        <div class="strip">
          <div class="kpi"><span>Invoice value</span><b>{{ v.total | currency:'ZAR':'R':'1.2-2' }}</b></div>
          @if (v.aging) { <div class="kpi" [class.warn]="v.aging.balance > 0"><span>Still owing</span><b>{{ v.aging.balance | currency:'ZAR':'R':'1.2-2' }}</b><small>{{ v.aging.bucketLabel }} · {{ v.aging.ageDays }}d old{{ v.aging.daysOver ? ' · ' + v.aging.daysOver + 'd over' : '' }}</small></div> }
          <div class="kpi" [class.ok]="v.load" ><span>Trip sheet</span>
            @if (v.load) { <b><a [routerLink]="['/logistics/loads', v.load.id]" mat-dialog-close>{{ v.load.loadNumber }}</a></b><small>{{ v.load.status }}{{ v.load.actualPickupDate ? ' · out ' + (v.load.actualPickupDate | date:'dd MMM') : '' }}</small> }
            @else { <b class="muted">Not dispatched</b> }
          </div>
          <div class="kpi" [class.ok]="hasPod(v)" [class.danger]="!hasPod(v) && v.load"><span>POD</span>
            @if (hasPod(v)) { <b><mat-icon>verified</mat-icon> {{ podDate(v) | date:'dd MMM yyyy' }}</b><small>{{ v.scanPods.length ? 'scanned copy' : "driver's POD" }}</small> }
            @else if (v.load) { <b><mat-icon>warning</mat-icon> Missing</b><small>went out, nothing signed back</small> }
            @else { <b class="muted">—</b> }
          </div>
          <div class="kpi" [class.warn]="v.credits.length"><span>Credit notes</span>
            @if (v.credits.length) { <b>{{ v.credits.length }}</b><small>{{ creditTotal(v) | currency:'ZAR':'R':'1.0-0' }} credited</small> } @else { <b class="muted">None</b> }
          </div>
        </div>

        <!-- Lines -->
        <h4><mat-icon>list_alt</mat-icon> What was invoiced <small>{{ v.lines.length }} line{{ v.lines.length === 1 ? '' : 's' }} · {{ v.quantity | number }} units</small></h4>
        <table class="tbl">
          <thead><tr><th>Code</th><th>Description</th><th>Brand</th><th class="r">Qty</th><th class="r">Value</th></tr></thead>
          <tbody>
            @for (l of v.lines; track $index) {
              <tr><td class="mono">{{ l.productCode }}</td><td>{{ l.productDescription }}</td><td class="muted">{{ l.brand || '' }}</td><td class="r">{{ l.quantity | number:'1.0-2' }}</td><td class="r mono">{{ l.salesAmount | number:'1.2-2' }}</td></tr>
            }
          </tbody>
          <tfoot><tr><td colspan="3"></td><td class="r">{{ v.quantity | number:'1.0-2' }}</td><td class="r mono"><b>{{ v.total | number:'1.2-2' }}</b></td></tr></tfoot>
        </table>

        <div class="grid">
          <!-- Aging / references -->
          @if (v.aging; as a) {
            <section>
              <h4><mat-icon>account_balance</mat-icon> On the debtors aging</h4>
              <dl>
                <dt>Document date</dt><dd>{{ a.documentDate | date:'dd MMM yyyy' }}</dd>
                <dt>Due date</dt><dd>{{ a.dueDate ? (a.dueDate | date:'dd MMM yyyy') : '—' }}</dd>
                <dt>Amount / balance</dt><dd class="mono">{{ a.amount | number:'1.2-2' }} / <b>{{ a.balance | number:'1.2-2' }}</b></dd>
                <dt>Order / PO</dt><dd>{{ a.orderNumber || '—' }}{{ a.poNumber ? ' · PO ' + a.poNumber : '' }}</dd>
                @if (a.reference) { <dt>Reference</dt><dd>{{ a.reference }}</dd> }
              </dl>
            </section>
          }
          <!-- Delivery -->
          <section>
            <h4><mat-icon>local_shipping</mat-icon> Delivery</h4>
            @if (v.delivery; as dl) {
              <dl>
                <dt>Address</dt><dd>{{ [dl.deliveryAddress, dl.deliveryCity, dl.deliveryProvince].join(', ') || '—' }}</dd>
                @if (dl.contactPerson || dl.contactPhone) { <dt>Contact</dt><dd>{{ dl.contactPerson }} {{ dl.contactPhone }}</dd> }
                <dt>Status</dt><dd>{{ v.status }}</dd>
              </dl>
            } @else { <p class="muted">No delivery details captured.</p> }
            @if (v.scanPods.length || v.driverPods.length) {
              <ul class="pods">
                @for (p of v.scanPods; track p.podDocumentId) { <li><button mat-stroked-button (click)="openPod(p.podDocumentId)"><mat-icon>picture_as_pdf</mat-icon> POD scan · {{ p.deliveryDate | date:'dd MMM yyyy' }}</button></li> }
                @for (p of v.driverPods; track p.id) { <li><span class="chip"><mat-icon>task_alt</mat-icon> Driver POD · {{ p.deliveredAt | date:'dd MMM yyyy, HH:mm' }}</span></li> }
              </ul>
            }
          </section>
          <!-- Credits -->
          @if (v.credits.length) {
            <section>
              <h4><mat-icon>undo</mat-icon> Credit notes against this invoice</h4>
              <ul class="credits">@for (c of v.credits; track c.number) { <li><span class="mono"><b>{{ c.number }}</b></span><span>{{ c.date | date:'dd MMM yyyy' }}</span><span class="mono">{{ c.value | currency:'ZAR':'R':'1.2-2' }}</span></li> }</ul>
            </section>
          }
        </div>
      } }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      @if (d(); as v) {
        <button mat-button (click)="open360(v)"><mat-icon>hub</mat-icon> Customer 360</button>
        <button mat-button (click)="goBookkeeping(v)"><mat-icon>menu_book</mat-icon> Book Keeping</button>
      }
      <button mat-flat-button color="primary" mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host { display:block; min-width: min(860px, 92vw); }
    .hd { display:flex; align-items:center; gap:14px; padding: 16px 20px 8px; .logo { width:48px; height:48px; border-radius:50%; object-fit:cover; box-shadow:0 1px 3px rgba(0,0,0,.15); } .sp { flex:1; } h2 { margin:0; font-size:22px; } .eyebrow { font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:#6b7280; } .sub { font-size:13px; color:#374151; } }
    mat-dialog-content { padding: 8px 20px 16px !important; max-height: 72vh; }
    .center { display:flex; gap:8px; align-items:center; justify-content:center; padding:40px; }
    .strip { display:grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap:10px; margin-bottom: 16px; }
    .kpi { background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px; padding:10px 12px; display:flex; flex-direction:column; gap:2px;
      span { font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:#6b7280; } b { font-size:16px; display:flex; align-items:center; gap:4px; mat-icon { font-size:18px; width:18px; height:18px; } a { color:#2563eb; text-decoration:none; } } small { font-size:11px; color:#6b7280; }
      &.ok { border-color:#a7f3d0; background:#ecfdf5; b { color:#047857; } } &.warn { border-color:#fde68a; background:#fffbeb; b { color:#b45309; } } &.danger { border-color:#fecaca; background:#fef2f2; b { color:#b91c1c; } } }
    h4 { display:flex; align-items:center; gap:6px; margin: 14px 0 6px; font-size:13px; text-transform:uppercase; letter-spacing:.04em; color:#374151; mat-icon { font-size:18px; width:18px; height:18px; } small { text-transform:none; letter-spacing:0; font-weight:400; color:#6b7280; } }
    .tbl { width:100%; border-collapse:collapse; font-size:13px; th { text-align:left; font-size:11px; text-transform:uppercase; color:#6b7280; padding:6px 8px; border-bottom:1px solid #e5e7eb; } td { padding:6px 8px; border-bottom:1px solid #f3f4f6; } tfoot td { border-top:2px solid #e5e7eb; border-bottom:none; } .r { text-align:right; white-space:nowrap; } }
    .grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
    dl { display:grid; grid-template-columns: auto 1fr; gap:4px 12px; margin:0; font-size:13px; dt { color:#6b7280; } dd { margin:0; } }
    .pods, .credits { list-style:none; padding:0; margin:8px 0 0; display:flex; flex-direction:column; gap:6px; }
    .credits li { display:flex; gap:12px; font-size:13px; span:last-child { margin-left:auto; } }
    .chip { display:inline-flex; align-items:center; gap:4px; background:#ecfdf5; color:#047857; border-radius:999px; padding:3px 10px; font-size:12px; mat-icon { font-size:16px; width:16px; height:16px; } }
    .mono { font-family: ui-monospace, Menlo, Consolas, monospace; } .muted { color:#9ca3af; }
  `]
})
export class InvoiceDetailDialogComponent {
  private http = inject(HttpClient);
  private router = inject(Router);
  d = signal<InvoiceDetail | null>(null);
  loading = signal(true);
  logo = companyLogo; coName = companyName;

  constructor(@Inject(MAT_DIALOG_DATA) public data: { number: string; company?: string; snapshotId?: number }, private ref: MatDialogRef<InvoiceDetailDialogComponent>) {
    const params: Record<string, string> = {};
    if (data.company) params['company'] = data.company;
    if (data.snapshotId) params['snapshotId'] = String(data.snapshotId);
    this.http.get<InvoiceDetail>(`${environment.apiUrl}/finance/aging/invoice/${encodeURIComponent(data.number)}`, { params })
      .subscribe({ next: v => { this.d.set(v); this.loading.set(false); }, error: () => { this.d.set(null); this.loading.set(false); } });
  }

  hasPod(v: InvoiceDetail): boolean { return v.scanPods.length > 0 || v.driverPods.length > 0; }
  podDate(v: InvoiceDetail): string | undefined { return v.scanPods[0]?.deliveryDate ?? v.driverPods[0]?.deliveredAt; }
  creditTotal(v: InvoiceDetail): number { return v.credits.reduce((s, c) => s + c.value, 0); }
  openPod(id: number): void { this.http.get(`${environment.apiUrl}/PodDocuments/${id}/view`, { responseType: 'blob' }).subscribe(b => window.open(URL.createObjectURL(b), '_blank')); }
  open360(v: InvoiceDetail): void {
    if (!v.company || !v.customerNumber) return;
    this.http.get<{ id: number }>(`${environment.apiUrl}/customers/master/resolve`, { params: { company: v.company, code: v.customerNumber } })
      .subscribe(m => { this.ref.close(); this.router.navigate(['/customers', m.id]); });
  }
  goBookkeeping(v: InvoiceDetail): void { this.ref.close(); this.router.navigate(['/finance'], { queryParams: { tab: 'bookkeeping', search: v.number } }); }

  static open(dialog: MatDialog, data: { number: string; company?: string; snapshotId?: number }) {
    return dialog.open(InvoiceDetailDialogComponent, { data, autoFocus: false, maxWidth: '95vw' });
  }
}
