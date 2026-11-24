import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../ui/toast.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { CreditorPacksService, PaymentSchedule } from '../../services/creditor-packs.service';
import { FinancePaymentScheduleComponent } from '../finance/finance-payment-schedule.component';
import { PaymentHistoryComponent } from '../finance/payment-history.component';
import { PackPreviewDialogComponent } from '../finance/pack-preview-dialog.component';
import { FinanceCashflowComponent } from '../finance/finance-cashflow.component';

interface PaidInvoice {
  id: number; supplierName: string; invoiceNumber?: string; invoiceDate: string; total: number; companyName?: string; departmentName?: string;
  status: string; paymentDate?: string; paymentReference?: string; fileName?: string; hasPop: boolean; popFileName?: string; popUploadedAt?: string; popUploadedByName?: string;
}

const TABS = ['payruns', 'invoices', 'cashflow', 'history'] as const;
type Tab = typeof TABS[number];

/**
 * Treasury — the person who loads payments on the bank after the directors have signed.
 * Pay-runs: load, pay, attach POPs, close.  Supplier invoices: attach POPs to paid Books invoices.  History: everything paid.
 */
@Component({
  selector: 'app-treasury',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatTabsModule, MatTooltipModule, MatProgressSpinnerModule,
    NavbarComponent, PageHeaderComponent, FinancePaymentScheduleComponent, PaymentHistoryComponent, FinanceCashflowComponent],
  template: `
<app-navbar></app-navbar>
<div class="tr-container">
  <div class="tr-inner">
    <app-page-header [crumbs]="['Executive', 'Treasury']" title="Treasury"
                     subtitle="Load signed payments on the bank on Mondays and Wednesdays, release them, download the proofs of payment and attach each one — then close the batch.">
      <button mat-stroked-button (click)="router.navigate(['/finance'], { queryParams: { side: 'creditors', tab: 'creditors' } })"><mat-icon>folder_shared</mat-icon>Payment packs</button>
      <button mat-flat-button color="primary" (click)="go('payruns')"><mat-icon>event_available</mat-icon>Next pay-run</button>
    </app-page-header>

    @if (sched) {
      <div class="tr-kpis">
        <button class="kpi" (click)="go('payruns')"><mat-icon>hourglass_top</mat-icon><div><span class="v">{{ sched.totals.inProgressCount ?? 0 }}</span><span class="l">in progress, not signed</span><span class="s">{{ (sched.totals.inProgress ?? 0) | currency:'ZAR':'R':'1.0-0' }}</span></div></button>
        <button class="kpi hot" (click)="go('payruns')"><mat-icon>upload_file</mat-icon><div><span class="v">{{ sched.totals.toLoadCount }}</span><span class="l">to load on bank</span><span class="s">{{ sched.totals.toLoad | currency:'ZAR':'R':'1.0-0' }}</span></div></button>
        <button class="kpi" (click)="go('payruns')"><mat-icon>account_balance</mat-icon><div><span class="v">{{ sched.totals.loadedCount }}</span><span class="l">loaded, to release</span><span class="s">{{ sched.totals.loaded | currency:'ZAR':'R':'1.0-0' }}</span></div></button>
        <button class="kpi" [class.warn]="sched.totals.awaitingPopCount > 0" (click)="go('payruns')"><mat-icon>receipt_long</mat-icon><div><span class="v">{{ sched.totals.awaitingPopCount }}</span><span class="l">paid, POPs to attach</span><span class="s">{{ sched.totals.awaitingPop | currency:'ZAR':'R':'1.0-0' }}</span></div></button>
        <button class="kpi" [class.warn]="invoicesMissingPop > 0" (click)="go('invoices')"><mat-icon>description</mat-icon><div><span class="v">{{ invoicesMissingPop }}</span><span class="l">supplier invoices without POP</span><span class="s">Books · paid</span></div></button>
        <div class="kpi"><mat-icon>event</mat-icon><div><span class="v">{{ sched.nextPayDay | date:'EEE d MMM' }}</span><span class="l">next pay-run</span><span class="s">Mondays &amp; Wednesdays</span></div></div>
      </div>
    }

    <mat-tab-group class="tr-tabs" [selectedIndex]="tabIndex" (selectedIndexChange)="onTab($event)" animationDuration="150ms">
      <mat-tab>
        <ng-template mat-tab-label><mat-icon class="tab-icon">event_available</mat-icon>Pay-runs</ng-template>
        <div class="tab-body">
          <p class="intro"><b>In progress</b> shows packs still being prepared or approved, with their stage and documents to preview (view only). Below that are the signed packs, grouped by pay-run. Download the <b>bank file</b>, mark <b>Loaded on bank</b>, release it and <b>Mark paid</b>, then attach a <b>proof of payment</b> to every line. When all POPs are on, <b>Close</b> the batch.</p>
          @if (tab === 'payruns') { <app-finance-payment-schedule></app-finance-payment-schedule> }
        </div>
      </mat-tab>

      <mat-tab>
        <ng-template mat-tab-label><mat-icon class="tab-icon">description</mat-icon>Supplier invoices &amp; POPs</ng-template>
        <div class="tab-body">
          <p class="intro">Invoices from Books that have been paid. Attach the bank's proof of payment to each one so the department and the auditors can see it next to the invoice.</p>
          <div class="inv-filters">
            <select [(ngModel)]="invCompany" (change)="loadInvoices()">
              <option value="">All companies</option>
              @for (c of companies; track c) { <option [value]="c">{{ c }}</option> }
            </select>
            <input type="search" [(ngModel)]="invSearch" placeholder="Supplier, invoice #, reference…" (keyup.enter)="loadInvoices()" (search)="loadInvoices()">
            <div class="seg">
              <button [class.on]="invPop === 'missing'" (click)="invPop = 'missing'; loadInvoices()">Without POP</button>
              <button [class.on]="invPop === 'has'" (click)="invPop = 'has'; loadInvoices()">With POP</button>
              <button [class.on]="invPop === ''" (click)="invPop = ''; loadInvoices()">All paid</button>
            </div>
            <button mat-stroked-button (click)="loadInvoices()"><mat-icon>refresh</mat-icon></button>
          </div>

          @if (invLoading) { <div class="loading"><mat-spinner diameter="28"></mat-spinner>Loading invoices…</div> }
          @else if (!invoices.length) { <div class="empty"><mat-icon>task_alt</mat-icon>Nothing here — every paid invoice in this view has its proof of payment.</div> }
          @else {
            <table class="inv">
              <thead><tr><th>Supplier</th><th>Invoice</th><th>Company</th><th>Department</th><th>Paid</th><th class="num">Total</th><th>Proof of payment</th><th></th></tr></thead>
              <tbody>
                @for (i of invoices; track i.id) {
                  <tr [class.missing]="!i.hasPop">
                    <td><b>{{ i.supplierName }}</b></td>
                    <td>{{ i.invoiceNumber || '—' }}<div class="sub">{{ i.invoiceDate | date:'d MMM yyyy' }}</div></td>
                    <td>{{ i.companyName || '—' }}</td>
                    <td>{{ i.departmentName || '—' }}</td>
                    <td>{{ i.paymentDate ? (i.paymentDate | date:'d MMM yyyy') : '—' }}@if (i.paymentReference) {<div class="sub">{{ i.paymentReference }}</div>}</td>
                    <td class="num">{{ i.total | currency:'ZAR':'R':'1.2-2' }}</td>
                    <td>
                      @if (i.hasPop) {
                        <span class="ok"><mat-icon>check_circle</mat-icon>{{ i.popFileName }}</span>
                        <div class="sub">{{ i.popUploadedByName }} · {{ i.popUploadedAt | date:'d MMM HH:mm' }}</div>
                      } @else { <span class="miss"><mat-icon>warning</mat-icon>Not attached</span> }
                    </td>
                    <td class="acts">
                      @if (i.fileName) { <button mat-icon-button matTooltip="View invoice" (click)="viewInvoice(i)"><mat-icon>picture_as_pdf</mat-icon></button> }
                      @if (i.hasPop) { <button mat-icon-button matTooltip="View POP" (click)="viewPop(i)"><mat-icon>visibility</mat-icon></button> }
                      <label class="upload" [matTooltip]="i.hasPop ? 'Replace POP' : 'Attach POP'">
                        <mat-icon>{{ busyId === i.id ? 'hourglass_top' : 'attach_file' }}</mat-icon>{{ i.hasPop ? 'Replace' : 'Attach POP' }}
                        <input type="file" accept="application/pdf,image/*" hidden (change)="uploadPop(i, $event)" [disabled]="busyId === i.id">
                      </label>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
            @if (invTotal > invoices.length) { <p class="more">Showing {{ invoices.length }} of {{ invTotal }} — narrow the filters to see the rest.</p> }
          }
        </div>
      </mat-tab>

      <mat-tab>
        <ng-template mat-tab-label><mat-icon class="tab-icon">savings</mat-icon>Cashflow</ng-template>
        <div class="tab-body">
          <p class="intro">You keep the group cashflow: capture each company's <b>bank balance</b>, and maintain the <b>debit orders</b> and <b>recurring monthly payments</b>. Finance › Creditors sees the same figures but cannot change them.</p>
          @if (tab === 'cashflow') { <app-finance-cashflow (openBatch)="openPack($event)"></app-finance-cashflow> }
        </div>
      </mat-tab>

      <mat-tab>
        <ng-template mat-tab-label><mat-icon class="tab-icon">history</mat-icon>History</ng-template>
        <div class="tab-body">
          <p class="intro">Everything that has been paid: who prepared, checked and signed it, when it was loaded and paid, and the proof of payment for every line. Export for the auditors.</p>
          @if (tab === 'history') { <app-payment-history [defaultDays]="90"></app-payment-history> }
        </div>
      </mat-tab>
    </mat-tab-group>
  </div>
</div>
  `,
  styles: [`
:host { display:block; }
.tr-inner { max-width: 1400px; margin: 0 auto; padding: 0 24px 48px; }
.tr-kpis { display:grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap:12px; margin: 16px 0; }
.kpi { display:flex; gap:12px; align-items:center; text-align:left; padding:14px 16px; border-radius:12px; background: var(--surface,#fff); border:1px solid var(--border,#e5e7eb); font: inherit; color: inherit; cursor:pointer; }
div.kpi { cursor:default; }
.kpi mat-icon { font-size:28px; width:28px; height:28px; color: var(--primary,#4f46e5); }
.kpi .v { display:block; font-size:20px; font-weight:800; line-height:1.1; } .kpi .l { display:block; font-size:12.5px; color: var(--text-muted,#64748b); } .kpi .s { display:block; font-size:11.5px; color: var(--text-muted,#94a3b8); }
.kpi.hot { background: linear-gradient(135deg, rgba(79,70,229,.12), rgba(14,165,233,.08)); border-color: rgba(79,70,229,.35); }
.kpi.warn mat-icon { color:#f59e0b; }
.tab-icon { margin-right:6px; }
.tab-body { padding: 16px 0; }
.intro { color: var(--text-muted,#64748b); font-size:13.5px; margin: 0 0 14px; }
.inv-filters { display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom:12px; }
.inv-filters select, .inv-filters input { height:38px; padding:0 10px; border:1px solid var(--border,#e5e7eb); border-radius:8px; background: var(--surface,#fff); color: inherit; font: inherit; }
.inv-filters input { flex:1; min-width:220px; }
.seg { display:flex; border:1px solid var(--border,#e5e7eb); border-radius:8px; overflow:hidden; }
.seg button { border:none; background: var(--surface,#fff); padding:0 12px; height:38px; cursor:pointer; font: inherit; color: inherit; }
.seg button.on { background: var(--primary,#4f46e5); color:#fff; }
.loading, .empty { display:flex; align-items:center; gap:10px; padding:28px; justify-content:center; color: var(--text-muted,#64748b); } .empty mat-icon { color:#10b981; }
.inv { width:100%; border-collapse:collapse; font-size:13px; background: var(--surface,#fff); border:1px solid var(--border,#e5e7eb); border-radius:12px; overflow:hidden; }
.inv th, .inv td { padding:9px 10px; border-bottom:1px solid var(--border,#e5e7eb); text-align:left; vertical-align:top; }
.inv th { font-size:11px; text-transform:uppercase; letter-spacing:.04em; color: var(--text-muted,#64748b); background: var(--surface-2,#f8fafc); }
.inv .num { text-align:right; white-space:nowrap; }
.inv tr.missing td:first-child { box-shadow: inset 3px 0 0 #f59e0b; }
.sub { font-size:11.5px; color: var(--text-muted,#64748b); }
.ok, .miss { display:inline-flex; align-items:center; gap:4px; font-weight:600; } .ok { color:#166534; } .miss { color:#b45309; }
.ok mat-icon, .miss mat-icon { font-size:16px; width:16px; height:16px; }
.acts { white-space:nowrap; }
.upload { display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:8px; border:1px solid var(--primary,#4f46e5); color: var(--primary,#4f46e5); font-size:12px; font-weight:600; cursor:pointer; vertical-align:middle; }
.upload mat-icon { font-size:16px; width:16px; height:16px; }
.more { font-size:12px; color: var(--text-muted,#64748b); margin-top:8px; }
  `]
})
export class TreasuryComponent implements OnInit {
  router = inject(Router);
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private api = inject(CreditorPacksService);
  private dialog = inject(MatDialog);
  private toast = inject(ToastService);

  tab: Tab = 'payruns';
  get tabIndex() { return TABS.indexOf(this.tab); }
  sched: PaymentSchedule | null = null;

  companies: string[] = [];
  invoices: PaidInvoice[] = [];
  invTotal = 0; invLoading = false; invoicesMissingPop = 0;
  invCompany = ''; invSearch = ''; invPop: '' | 'missing' | 'has' = 'missing';
  busyId: number | null = null;

  ngOnInit(): void {
    const t = this.route.snapshot.queryParamMap.get('tab') as Tab | null;
    if (t && TABS.includes(t)) this.tab = t;
    this.api.schedule().subscribe({ next: s => this.sched = s, error: () => {} });
    this.http.get<string[]>(`${environment.apiUrl}/Books/companies`).subscribe({ next: c => this.companies = c || [], error: () => {} });
    this.countMissing();
    if (this.tab === 'invoices') this.loadInvoices();
  }

  go(t: Tab): void { this.tab = t; this.router.navigate([], { queryParams: { tab: t }, queryParamsHandling: 'merge', replaceUrl: true }); if (t === 'invoices' && !this.invoices.length) this.loadInvoices(); }
  onTab(i: number): void { this.go(TABS[i] ?? 'payruns'); }
  /** From the cashflow: open a payment pack in Finance › Creditors › Payment packs. */
  openPack(batchId: number): void { if (batchId) this.router.navigate(['/finance'], { queryParams: { side: 'creditors', tab: 'creditors', batch: batchId } }); }

  private countMissing(): void {
    this.http.get<any>(`${environment.apiUrl}/Books?status=Paid&pop=missing&page=1&pageSize=1`).subscribe({ next: r => this.invoicesMissingPop = r.totalCount || 0, error: () => {} });
  }

  loadInvoices(): void {
    this.invLoading = true;
    let url = `${environment.apiUrl}/Books?status=Paid&page=1&pageSize=200&sortBy=paymentdate&sortDir=desc`;
    if (this.invPop) url += `&pop=${this.invPop}`;
    if (this.invCompany) url += `&company=${encodeURIComponent(this.invCompany)}`;
    if (this.invSearch) url += `&search=${encodeURIComponent(this.invSearch)}`;
    this.http.get<any>(url).subscribe({
      next: r => { this.invoices = r.items || []; this.invTotal = r.totalCount || 0; this.invLoading = false; },
      error: e => { this.invLoading = false; this.toast.error(e?.error?.error || 'Could not load invoices'); }
    });
  }

  uploadPop(i: PaidInvoice, ev: Event): void {
    const input = ev.target as HTMLInputElement; const file = input.files?.[0]; input.value = '';
    if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    this.busyId = i.id;
    this.http.post<any>(`${environment.apiUrl}/Books/${i.id}/pop`, fd).subscribe({
      next: r => {
        Object.assign(i, { hasPop: true, popFileName: r.popFileName, popUploadedAt: r.popUploadedAt, popUploadedByName: r.popUploadedByName, status: r.status, paymentDate: r.paymentDate });
        this.busyId = null; this.toast.done(`POP attached to ${i.supplierName}${i.invoiceNumber ? ' · ' + i.invoiceNumber : ''}`);
        this.countMissing();
        if (this.invPop === 'missing') this.invoices = this.invoices.filter(x => x.id !== i.id);
      },
      error: e => { this.busyId = null; this.toast.error(e?.error?.error || 'Upload failed'); }
    });
  }

  viewInvoice(i: PaidInvoice): void { PackPreviewDialogComponent.open(this.dialog, { url: `${environment.apiUrl}/Books/${i.id}/view`, title: `${i.supplierName} · ${i.invoiceNumber || 'invoice'}`, subtitle: i.companyName || '' }); }
  viewPop(i: PaidInvoice): void { PackPreviewDialogComponent.open(this.dialog, { url: `${environment.apiUrl}/Books/${i.id}/pop`, title: `Proof of payment · ${i.supplierName}`, subtitle: `${i.invoiceNumber || ''} · ${i.paymentReference || ''}` }); }
}
