import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../ui/toast.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';

interface Alias { id: number; company: string; customerCode: string; customerName?: string; source: string; }
interface Master { id: number; name: string; group?: string; type?: string; province?: string; notes?: string; logisticsCustomerId?: number; aliases: Alias[]; }
interface View360 {
  master: Master;
  sales: { lifetime: number; last12: number; lifetimeCredits: number; creditPct: number; firstInvoice?: string; lastInvoice?: string; invoiceCount: number;
    trend: { month: string; value: number; cost: number; invoices: number; credits: number }[];
    topProducts: { productCode: string; productDescription?: string; qty: number; value: number }[];
    recentInvoices: { number: string; company: string; date: string; value: number; lines: number; loadId?: number }[];
    byCompany: { code: string; company: string; value: number; invoices: number }[] };
  exposure: { total: number; current: number; d30: number; d60: number; d90: number; d120: number; agingAsOf?: string; disputeRisk: number; disputeRiskValue: number;
    openInvoices: { company: string; companyCode: string; documentNumber: string; documentDate?: string; dueDate?: string; balance: number; ageDays: number; bucket: number; poNumber?: string; orderNumber?: string; hasPod: boolean; disputeRisk: boolean }[];
    openCredits: { company: string; documentNumber: string; documentDate?: string; balance: number; ageDays: number }[];
    unapplied: { company: string; documentNumber: string; documentType: string; documentDate?: string; balance: number }[] };
  credits: { count: number; value: number; unsigned: number; reasons: { reason: string; count: number }[];
    items: { number: string; company: string; date: string; value: number; lines: number; hasSignedCopy: boolean; reason?: string; stockReturn?: { status: string; returnType: string } | null }[] };
  remittances: { id: number; subject?: string; fromEmail?: string; receivedAt: string; totalAmount?: number; matchedBalance: number; invoiceCount: number; matchedCount: number; status: string }[];
  pods: { coveragePct: number; invoicesLast12: number; linked: { invoice: string; podDocumentId: number; linkedAt: string; driver?: string; deliveryDate?: string }[] };
  backorders: { count: number; value: number; items: { sourceCompany: string; orderNumber: string; orderDate?: string; poNo?: string; itemDesc: string; qtyBackOrder: number; unitPrice: number; extPrice: number; location?: string }[] };
  loads: { id: number; loadNumber: string; status: string; scheduledPickupDate?: string; actualDeliveryDate?: string; deliveryLocation?: string; hasPod: boolean; invoices: number }[];
}

/**
 * Customer 360 — one page per real customer, rolled up across every Sage company via the customer master.
 * Sales (history), exposure (latest aging), credits (with signed-copy + stock-return state), remittances, PODs,
 * backorders and loads. Sales uses it before a call; Finance uses it before chasing.
 */
@Component({
  selector: 'app-customer-360',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatIconModule, MatButtonModule, MatTooltipModule, MatProgressSpinnerModule, NavbarComponent, PageHeaderComponent],
  template: `
    <app-navbar></app-navbar>
    <div class="c360">
      @if (loading()) { <div class="center"><mat-spinner diameter="40"></mat-spinner></div> }
      @else { @if (v(); as v) {
        <app-page-header [crumbs]="['People and money', 'Customers', v.master.name]" [title]="v.master.name"
          [subtitle]="(v.master.type || 'Customer') + (v.master.group ? ' · ' + v.master.group : '') + ' · ' + v.master.aliases.length + ' Sage account' + (v.master.aliases.length === 1 ? '' : 's') + (v.exposure.agingAsOf ? ' · aging as at ' + (v.exposure.agingAsOf | date:'d MMM') : '')">
          <a mat-stroked-button routerLink="/customers"><mat-icon>arrow_back</mat-icon> All customers</a>
          <button mat-stroked-button (click)="editing.set(!editing())"><mat-icon>edit</mat-icon> Edit</button>
        </app-page-header>

        <!-- Aliases -->
        <div class="aliases">
          @for (a of v.master.aliases; track a.id) {
            <span class="alias" [matTooltip]="a.customerName || ''"><b>{{ a.company }}</b> {{ a.customerCode }} <small>{{ a.source }}</small>
              @if (v.master.aliases.length > 1) { <button class="x" (click)="splitAlias(a)" matTooltip="Not this customer — split into its own record">×</button> }
            </span>
          }
          <button class="alias add" (click)="addAliasOpen.set(!addAliasOpen())"><mat-icon>add</mat-icon> Link another account</button>
          @if (addAliasOpen()) {
            <span class="alias-form">
              <select [(ngModel)]="newAlias.company"><option value="PMT">PMT</option><option value="ACM">ACM</option><option value="PHT">PHT</option><option value="SBT">SBT</option></select>
              <input [(ngModel)]="newAlias.code" placeholder="Customer code" (keyup.enter)="addAlias()" />
              <button mat-flat-button color="primary" (click)="addAlias()">Link</button>
            </span>
          }
        </div>

        @if (editing()) {
          <div class="edit">
            <label>Name<input [(ngModel)]="edit.name" /></label>
            <label>Group<input [(ngModel)]="edit.group" placeholder="Netcare, Gauteng DoH…" /></label>
            <label>Type<select [(ngModel)]="edit.type"><option value="">—</option>@for (t of types; track t) { <option [value]="t">{{ t }}</option> }</select></label>
            <label>Province<input [(ngModel)]="edit.province" /></label>
            <label class="full">Notes<textarea rows="2" [(ngModel)]="edit.notes"></textarea></label>
            <div class="full acts"><button mat-button (click)="editing.set(false)">Cancel</button><button mat-flat-button color="primary" (click)="save()">Save</button></div>
          </div>
        }

        <!-- KPIs -->
        <div class="kpis">
          <div class="kpi"><span class="k">Owed to us now</span><b>{{ v.exposure.total | currency:'ZAR':'R':'1.0-0' }}</b><small>{{ v.exposure.openInvoices.length }} open invoices</small>
            <div class="bar"><i class="c" [style.width.%]="pct(v.exposure.current, v.exposure.total)"></i><i class="o" [style.width.%]="pct(v.exposure.d30 + v.exposure.d60, v.exposure.total)"></i><i class="w" [style.width.%]="pct(v.exposure.d90, v.exposure.total)"></i><i class="d" [style.width.%]="pct(v.exposure.d120, v.exposure.total)"></i></div>
            <small>current {{ v.exposure.current | currency:'ZAR':'R':'1.0-0' }} · 90+ {{ v.exposure.d90 + v.exposure.d120 | currency:'ZAR':'R':'1.0-0' }}</small></div>
          <div class="kpi" [class.bad]="v.exposure.disputeRisk > 0"><span class="k">Dispute risk</span><b>{{ v.exposure.disputeRiskValue | currency:'ZAR':'R':'1.0-0' }}</b><small>{{ v.exposure.disputeRisk }} invoice{{ v.exposure.disputeRisk === 1 ? '' : 's' }} 60+ days with no POD</small></div>
          <div class="kpi"><span class="k">Sales last 12 months</span><b>{{ v.sales.last12 | currency:'ZAR':'R':'1.0-0' }}</b><small>{{ v.sales.lifetime | currency:'ZAR':'R':'1.0-0' }} lifetime · {{ v.sales.invoiceCount }} invoices since {{ v.sales.firstInvoice | date:'MMM yyyy' }}</small></div>
          <div class="kpi" [class.warn]="v.sales.creditPct > 3"><span class="k">Credited</span><b>{{ v.sales.creditPct }}%</b><small>{{ v.credits.count }} credit notes · {{ v.credits.value | currency:'ZAR':'R':'1.0-0' }}@if (v.credits.unsigned) { · <span class="bad">{{ v.credits.unsigned }} unsigned</span> }</small></div>
          <div class="kpi" [class.warn]="v.pods.coveragePct < 80"><span class="k">POD coverage</span><b>{{ v.pods.coveragePct }}%</b><small>of {{ v.pods.invoicesLast12 }} invoices in 12 months have a linked POD</small></div>
          <div class="kpi" [class.warn]="v.backorders.count > 0"><span class="k">On backorder</span><b>{{ v.backorders.value | currency:'ZAR':'R':'1.0-0' }}</b><small>{{ v.backorders.count }} lines waiting</small></div>
        </div>

        <!-- Trend + by company -->
        <div class="row2">
          <div class="card">
            <h3><mat-icon>show_chart</mat-icon> Sales vs credits · 12 months</h3>
            <div class="trend">
              @for (m of v.sales.trend; track m.month) {
                <div class="col" [matTooltip]="m.month + ' · sales ' + (m.value | currency:'ZAR':'R':'1.0-0') + ' · credits ' + (m.credits | currency:'ZAR':'R':'1.0-0') + ' · ' + m.invoices + ' invoices'">
                  <div class="bars"><i class="s" [style.height.%]="pct(m.value, maxTrend(v))"></i><i class="c" [style.height.%]="pct(m.credits, maxTrend(v))"></i></div><span>{{ m.month.slice(5) }}</span>
                </div>
              }
              @if (!v.sales.trend.length) { <p class="muted">No sales in the last 12 months.</p> }
            </div>
          </div>
          <div class="card">
            <h3><mat-icon>business</mat-icon> By company</h3>
            <table class="mini"><tbody>
              @for (c of v.sales.byCompany; track c.code) { <tr><td><b>{{ c.company }}</b><small>{{ c.invoices }} invoices</small></td><td class="r mono">{{ c.value | currency:'ZAR':'R':'1.0-0' }}</td></tr> }
            </tbody></table>
            <h3 style="margin-top:14px"><mat-icon>inventory_2</mat-icon> Top products · 12 months</h3>
            <table class="mini"><tbody>
              @for (p of v.sales.topProducts; track p.productCode) { <tr><td><b>{{ p.productDescription || p.productCode }}</b><small>{{ p.productCode }} · {{ p.qty | number:'1.0-0' }} units</small></td><td class="r mono">{{ p.value | currency:'ZAR':'R':'1.0-0' }}</td></tr> }
            </tbody></table>
          </div>
        </div>

        <!-- Open invoices -->
        <div class="card">
          <h3><mat-icon>request_quote</mat-icon> Open invoices <small>latest aging per company</small>
            <span class="sp"></span>
            <label class="chk"><input type="checkbox" [(ngModel)]="onlyRisk" /> Only dispute risk</label></h3>
          @if (!v.exposure.openInvoices.length) { <p class="muted">Nothing open on the aging.</p> }
          @else {
            <table class="tbl"><thead><tr><th>Invoice</th><th>Co</th><th>PO / Order</th><th>Doc date</th><th>Due</th><th class="r">Age</th><th class="r">Balance</th><th>POD</th></tr></thead><tbody>
              @for (i of openInvoices(v); track i.documentNumber + i.companyCode) {
                <tr [class.risk]="i.disputeRisk"><td class="mono"><b>{{ i.documentNumber }}</b></td><td><span class="pill">{{ i.companyCode }}</span></td><td>{{ i.poNumber || i.orderNumber || '—' }}</td><td>{{ i.documentDate | date:'dd MMM yy' }}</td><td>{{ i.dueDate | date:'dd MMM yy' }}</td>
                  <td class="r"><span class="badge" [class.warn]="i.ageDays > 30 && i.ageDays <= 60" [class.danger]="i.ageDays > 60">{{ i.ageDays }}d</span></td><td class="r mono">{{ i.balance | number:'1.2-2' }}</td>
                  <td>@if (i.hasPod) { <mat-icon class="ok" matTooltip="POD on file">task</mat-icon> } @else if (i.disputeRisk) { <mat-icon class="bad" matTooltip="60+ days, no POD — dispute risk">gavel</mat-icon> } @else { <span class="muted">—</span> }</td></tr>
              }
            </tbody></table>
          }
          @if (v.exposure.openCredits.length || v.exposure.unapplied.length) {
            <div class="unapplied">
              @for (c of v.exposure.openCredits; track c.documentNumber) { <span class="pill cr" [routerLink]="['/finance']" [queryParams]="{ tab: 'credit-notes' }" matTooltip="Unapplied credit note">{{ c.documentNumber }} {{ c.balance | currency:'ZAR':'R':'1.0-0' }}</span> }
              @for (u of v.exposure.unapplied; track u.documentNumber) { <span class="pill py" [matTooltip]="u.documentType + ' · unapplied'">{{ u.documentNumber }} {{ u.balance | currency:'ZAR':'R':'1.0-0' }}</span> }
            </div>
          }
        </div>

        <div class="row2">
          <!-- Credits -->
          <div class="card">
            <h3><mat-icon>undo</mat-icon> Credit notes <small>{{ v.credits.count }} · {{ v.credits.value | currency:'ZAR':'R':'1.0-0' }}</small></h3>
            @if (v.credits.reasons.length) { <div class="chips">@for (r of v.credits.reasons; track r.reason) { <span class="chip">{{ r.reason }} <b>{{ r.count }}</b></span> }</div> }
            <table class="tbl"><tbody>
              @for (c of v.credits.items; track c.number + c.company) {
                <tr><td class="mono"><b>{{ c.number }}</b><small>{{ c.company }} · {{ c.date | date:'dd MMM yy' }}</small></td><td>{{ c.reason || '—' }}@if (c.stockReturn) { <small>stock {{ c.stockReturn.returnType.toLowerCase() }} {{ c.stockReturn.status.toLowerCase() }}</small> }</td>
                  <td>@if (c.hasSignedCopy) { <mat-icon class="ok" matTooltip="Signed copy on file">verified</mat-icon> } @else { <mat-icon class="bad" matTooltip="No signed copy">warning_amber</mat-icon> }</td><td class="r mono">{{ c.value | currency:'ZAR':'R':'1.0-0' }}</td></tr>
              }
              @if (!v.credits.items.length) { <tr><td class="muted">No credits ever — nice.</td></tr> }
            </tbody></table>
          </div>
          <!-- Remittances -->
          <div class="card">
            <h3><mat-icon>mark_email_read</mat-icon> Remittances</h3>
            <table class="tbl"><tbody>
              @for (r of v.remittances; track r.id) {
                <tr><td><b>{{ r.subject }}</b><small>{{ r.fromEmail }} · {{ r.receivedAt | date:'dd MMM yy' }} · {{ r.matchedCount }}/{{ r.invoiceCount }} invoices matched</small></td><td><span class="pill">{{ r.status }}</span></td><td class="r mono">{{ r.totalAmount | currency:'ZAR':'R':'1.0-0' }}</td></tr>
              }
              @if (!v.remittances.length) { <tr><td class="muted">No remittance emails matched to this customer.</td></tr> }
            </tbody></table>
          </div>
        </div>

        <div class="row2">
          <!-- Backorders -->
          <div class="card">
            <h3><mat-icon>pending_actions</mat-icon> Backorders <small>{{ v.backorders.count }} lines</small></h3>
            <table class="tbl"><tbody>
              @for (b of v.backorders.items; track b.orderNumber + b.itemDesc) {
                <tr><td><b>{{ b.itemDesc }}</b><small>{{ b.sourceCompany }} · {{ b.orderNumber }}@if (b.poNo) { · PO {{ b.poNo }} } · {{ b.orderDate | date:'dd MMM yy' }}@if (b.location) { · {{ b.location }} }</small></td><td class="r mono">{{ b.qtyBackOrder | number:'1.0-0' }}</td><td class="r mono">{{ b.extPrice | currency:'ZAR':'R':'1.0-0' }}</td></tr>
              }
              @if (!v.backorders.items.length) { <tr><td class="muted">Nothing on backorder.</td></tr> }
            </tbody></table>
          </div>
          <!-- Loads + PODs -->
          <div class="card">
            <h3><mat-icon>local_shipping</mat-icon> Deliveries <small>loads & linked PODs</small></h3>
            <table class="tbl"><tbody>
              @for (l of v.loads; track l.id) {
                <tr><td><b>{{ l.loadNumber }}</b><small>{{ l.scheduledPickupDate | date:'dd MMM yy' }} · {{ l.invoices }} invoice{{ l.invoices === 1 ? '' : 's' }}@if (l.deliveryLocation) { · {{ l.deliveryLocation }} }</small></td><td><span class="pill">{{ l.status }}</span></td><td>@if (l.hasPod) { <mat-icon class="ok" matTooltip="Driver POD captured">task</mat-icon> } @else { <span class="muted">—</span> }</td></tr>
              }
              @if (!v.loads.length) { <tr><td class="muted">No loads linked yet.</td></tr> }
            </tbody></table>
            @if (v.pods.linked.length) {
              <h4>Recent POD scans</h4>
              <div class="chips">@for (p of v.pods.linked; track p.invoice + p.podDocumentId) { <span class="chip" [matTooltip]="(p.driver || '') + ' · ' + (p.deliveryDate | date:'dd MMM yy')">{{ p.invoice }}</span> }</div>
            }
          </div>
        </div>

        <div class="card">
          <h3><mat-icon>receipt_long</mat-icon> Recent invoices</h3>
          <table class="tbl"><thead><tr><th>Invoice</th><th>Co</th><th>Date</th><th class="r">Lines</th><th class="r">Value</th><th>Load</th></tr></thead><tbody>
            @for (i of v.sales.recentInvoices; track i.number + i.company) {
              <tr><td class="mono"><b>{{ i.number }}</b></td><td><span class="pill">{{ i.company }}</span></td><td>{{ i.date | date:'dd MMM yyyy' }}</td><td class="r">{{ i.lines }}</td><td class="r mono">{{ i.value | currency:'ZAR':'R':'1.2-2' }}</td><td>@if (i.loadId) { <a [routerLink]="['/logistics/loads']" [queryParams]="{ id: i.loadId }">#{{ i.loadId }}</a> } @else { <span class="muted">—</span> }</td></tr>
            }
          </tbody></table>
        </div>
      } @else {
        <div class="center"><mat-icon>person_off</mat-icon><p>Customer not found.</p><a mat-stroked-button routerLink="/customers">All customers</a></div>
      } }
    </div>
  `,
  styles: [`
    .c360 { padding: 0 var(--space-5, 24px) var(--space-6, 32px); max-width: 1500px; margin: 0 auto; }
    .center { display:flex; flex-direction:column; align-items:center; gap:10px; padding:60px; color: var(--color-text-3); }
    .mono { font-variant-numeric: tabular-nums; font-family: var(--font-mono, ui-monospace, monospace); } .r { text-align:right; } .sp { flex:1; }
    .muted { color: var(--color-text-3); } .ok { color: var(--color-ok, #15803d); } .bad { color: var(--color-danger, #b91c1c); } .warn { color: var(--color-warn, #b45309); }
    small { display:block; color: var(--color-text-3); font-size: var(--text-xs, 12px); }
    .aliases { display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin: 8px 0 14px; }
    .alias { display:inline-flex; align-items:center; gap:6px; background: var(--color-surface-2, #f1f5f9); border-radius:999px; padding:4px 10px; font-size: 12px; small { display:inline; opacity:.7; } .x { border:0; background:none; cursor:pointer; color:#9f1239; font-size:14px; padding:0 2px; }
      &.add { background:none; border:1px dashed var(--color-line, #e5e7eb); cursor:pointer; font: inherit; font-size:12px; mat-icon { font-size:16px; width:16px; height:16px; } } }
    .alias-form { display:inline-flex; gap:6px; align-items:center; input, select { padding:4px 8px; border:1px solid var(--color-line, #e5e7eb); border-radius:6px; font: inherit; } }
    .edit { display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; background: var(--color-surface, #fff); border:1px solid var(--color-line, #e5e7eb); border-radius:12px; padding:14px; margin-bottom:14px;
      label { display:flex; flex-direction:column; gap:4px; font-size:12px; color: var(--color-text-2); } input, select, textarea { padding:7px 10px; border:1px solid var(--color-line, #e5e7eb); border-radius:8px; font: inherit; }
      .full { grid-column: 1 / -1; } .acts { display:flex; justify-content:flex-end; gap:8px; } }
    .kpis { display:grid; grid-template-columns: repeat(6, minmax(0,1fr)); gap:10px; margin-bottom:14px; }
    .kpi { background: var(--color-surface, #fff); border:1px solid var(--color-line, #e5e7eb); border-left:4px solid var(--color-primary, #2563eb); border-radius:12px; padding:12px 14px; display:flex; flex-direction:column; gap:3px;
      .k { font-size:11px; text-transform:uppercase; letter-spacing:.04em; color: var(--color-text-2); font-weight:700; } b { font-size: clamp(16px, 1.6vw, 22px); font-weight:800; white-space:nowrap; }
      &.bad { border-left-color: var(--color-danger, #b91c1c); } &.warn { border-left-color: var(--color-warn, #b45309); }
      .bar { display:flex; height:6px; border-radius:999px; overflow:hidden; background: var(--color-surface-2, #f1f5f9); margin:4px 0; i { display:block; height:100%; } .c { background:#22c55e; } .o { background:#f59e0b; } .w { background:#f97316; } .d { background:#ef4444; } } }
    .row2 { display:grid; grid-template-columns: 1fr 1fr; gap:14px; margin-bottom:14px; }
    .card { background: var(--color-surface, #fff); border:1px solid var(--color-line, #e5e7eb); border-radius:12px; padding:14px 16px; margin-bottom:14px; .row2 & { margin-bottom:0; }
      h3 { display:flex; align-items:center; gap:8px; margin:0 0 10px; font-size:14px; mat-icon { font-size:18px; width:18px; height:18px; color: var(--color-primary, #2563eb); } small { display:inline; font-weight:400; } }
      h4 { margin:12px 0 6px; font-size:12px; color: var(--color-text-2); } }
    .chk { display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:400; color: var(--color-text-2); }
    .trend { display:flex; gap:6px; align-items:flex-end; height:140px; .col { flex:1; display:flex; flex-direction:column; align-items:center; gap:4px; height:100%; .bars { flex:1; width:100%; display:flex; gap:2px; align-items:flex-end; i { flex:1; display:block; border-radius:3px 3px 0 0; min-height:2px; } .s { background: var(--color-primary, #2563eb); } .c { background:#ef4444; } } span { font-size:10px; color: var(--color-text-3); } } }
    .mini { width:100%; border-collapse:collapse; font-size:13px; td { padding:5px 4px; border-bottom:1px solid var(--color-line, #f1f5f9); vertical-align:top; } }
    .tbl { width:100%; border-collapse:collapse; font-size:13px; th { text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:.04em; color: var(--color-text-3); padding:6px 8px; border-bottom:1px solid var(--color-line, #e5e7eb); } td { padding:7px 8px; border-bottom:1px solid var(--color-line, #f1f5f9); vertical-align:top; } tr.risk { background:#fff7f7; } }
    .pill { background: var(--color-surface-2, #f1f5f9); border-radius:6px; padding:2px 8px; font-weight:700; font-size:11px; &.cr { background:#fee2e2; color:#991b1b; cursor:pointer; } &.py { background:#dbeafe; color:#1e40af; } }
    .badge { border-radius:999px; padding:2px 8px; font-size:11px; background: var(--color-surface-2, #f1f5f9); &.warn { background:#fef3c7; color:#92400e; } &.danger { background:#fee2e2; color:#991b1b; } }
    .chips { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px; } .chip { background: var(--color-surface-2, #f1f5f9); border-radius:999px; padding:3px 10px; font-size:12px; b { margin-left:4px; } }
    .unapplied { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
    @media (max-width: 1100px) { .kpis { grid-template-columns: repeat(3, 1fr); } .row2 { grid-template-columns: 1fr; } }
    @media (max-width: 640px) { .kpis { grid-template-columns: 1fr 1fr; } .edit { grid-template-columns: 1fr; } }
  `]
})
export class Customer360Component implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private api = `${environment.apiUrl}/customers/master`;

  readonly types = ['Hospital', 'Clinic', 'Depot', 'Pharmacy', 'Medical', 'Distributor', 'Government', 'Other'];
  v = signal<View360 | null>(null); loading = signal(true);
  editing = signal(false); edit = { name: '', group: '', type: '', province: '', notes: '' };
  addAliasOpen = signal(false); newAlias = { company: 'PMT', code: '' };
  onlyRisk = false;
  private id = 0;

  ngOnInit(): void { this.route.paramMap.subscribe(p => { this.id = Number(p.get('id')); this.load(); }); }
  load(): void {
    this.loading.set(true);
    this.http.get<View360>(`${this.api}/${this.id}/360`).subscribe({
      next: v => { this.v.set(v); this.loading.set(false); this.edit = { name: v.master.name, group: v.master.group || '', type: v.master.type || '', province: v.master.province || '', notes: v.master.notes || '' }; },
      error: () => { this.v.set(null); this.loading.set(false); }
    });
  }
  pct(a: number, b: number): number { return b > 0 ? Math.max(0, Math.min(100, a / b * 100)) : 0; }
  maxTrend(v: View360): number { return Math.max(1, ...v.sales.trend.map(t => Math.max(t.value, t.credits))); }
  openInvoices(v: View360) { return this.onlyRisk ? v.exposure.openInvoices.filter(i => i.disputeRisk) : v.exposure.openInvoices; }

  save(): void {
    this.http.put(`${this.api}/${this.id}`, this.edit).subscribe({ next: () => { this.toast.done('Saved'); this.editing.set(false); this.load(); }, error: () => this.toast.error('Could not save') });
  }
  addAlias(): void {
    if (!this.newAlias.code.trim()) return;
    this.http.post(`${this.api}/${this.id}/aliases`, { company: this.newAlias.company, code: this.newAlias.code.trim() }).subscribe({
      next: () => { this.toast.done('Account linked'); this.addAliasOpen.set(false); this.newAlias.code = ''; this.load(); },
      error: e => this.toast.error(e?.error?.error || 'Could not link the account')
    });
  }
  splitAlias(a: Alias): void {
    if (!confirm(`Split ${a.company} ${a.customerCode} (${a.customerName}) into its own customer record?`)) return;
    this.http.post<{ id: number }>(`${this.api}/split`, { company: a.company, code: a.customerCode }).subscribe({
      next: r => { this.toast.done('Split into its own record'); this.router.navigate(['/customers', r.id]); },
      error: e => this.toast.error(e?.error?.error || 'Could not split')
    });
  }
}
