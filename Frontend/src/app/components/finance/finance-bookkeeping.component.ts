import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from '../../../environments/environment';
import { companyLogo } from '../../core/company-logos';

interface CreditRef { number: string; date: string; amount: number; }
interface Row {
  company: string; companyName: string; date: string; invoiceNumber: string; invoiceId: number;
  customerNumber: string; customerName: string; province?: string; amount: number; lines: number;
  loadId?: number; loadNumber?: string; loadStatus?: string; dispatchedAt?: string; deliveredAt?: string;
  podDate?: string; podSource: string; podDocumentId?: number; podFileName?: string;
  creditNotes: CreditRef[]; creditNoteNumbers: string; creditTotal: number;
  state: 'POD received' | 'Needs POD' | 'Not dispatched'; daysWaitingPod?: number;
}
interface CoSummary { company: string; companyName: string; invoices: number; amount: number; dispatched: number; notDispatched: number; hasPod: number; needsPod: number; needsPodAmount: number; }
interface Summary { invoices: number; amount: number; dispatched: number; notDispatched: number; hasPod: number; needsPod: number; needsPodAmount: number; byCompany: CoSummary[]; provinces: string[]; }

type Status = 'all' | 'needs-pod' | 'has-pod' | 'not-dispatched' | 'credited';

/**
 * Book Keeping register: every sales invoice with its trip sheet, POD and credit note in one line.
 * "Needs POD" = it went out on a load but nothing signed has come back — that's the collection worklist.
 */
@Component({
  selector: 'app-finance-bookkeeping',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatIconModule, MatButtonModule, MatTooltipModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatPaginatorModule, MatProgressSpinnerModule],
  template: `
    <!-- ── Summary ── -->
    @if (summary(); as s) {
      <div class="kpis">
        <button class="kpi" [class.active]="status === 'all'" (click)="setStatus('all')">
          <span class="k-label">Invoiced</span><b>{{ s.invoices | number }}</b><span class="k-sub">{{ s.amount | currency:'ZAR':'R':'1.0-0' }}</span>
        </button>
        <button class="kpi" [class.active]="status === 'not-dispatched'" (click)="setStatus('not-dispatched')">
          <span class="k-label">Not on a trip sheet</span><b>{{ s.notDispatched | number }}</b><span class="k-sub">still in branch</span>
        </button>
        <button class="kpi warn" [class.active]="status === 'needs-pod'" (click)="setStatus('needs-pod')">
          <span class="k-label">Went out — POD needed</span><b>{{ s.needsPod | number }}</b><span class="k-sub">{{ s.needsPodAmount | currency:'ZAR':'R':'1.0-0' }} to collect proof for</span>
        </button>
        <button class="kpi ok" [class.active]="status === 'has-pod'" (click)="setStatus('has-pod')">
          <span class="k-label">POD received</span><b>{{ s.hasPod | number }}</b><span class="k-sub">{{ s.dispatched ? (s.hasPod / s.dispatched | percent:'1.0-0') : '—' }} of dispatched</span>
        </button>
        <button class="kpi" [class.active]="status === 'credited'" (click)="setStatus('credited')">
          <span class="k-label">Credited</span><b><mat-icon>undo</mat-icon></b><span class="k-sub">invoices with a credit note</span>
        </button>
      </div>
      <div class="co-bar">
        <button class="co-tile all" [class.active]="!company" (click)="setCompany('')">
          <span class="co-logo all-logo"><mat-icon>apps</mat-icon></span>
          <span class="co-text"><b>All companies</b><span>{{ s.invoices | number }} invoices · <em [class.zero]="s.needsPod === 0">{{ s.needsPod | number }} need POD</em></span></span>
        </button>
        @for (c of s.byCompany; track c.company) {
          <button class="co-tile" [class.active]="company === c.company" [class.dim]="company && company !== c.company" (click)="setCompany(company === c.company ? '' : c.company)" [attr.aria-pressed]="company === c.company">
            <img class="co-logo" [src]="logo(c.company)" [alt]="c.companyName">
            <span class="co-text"><b>{{ c.companyName }}</b><span>{{ c.invoices | number }} invoices · <em [class.zero]="c.needsPod === 0">{{ c.needsPod | number }} need POD</em></span></span>
          </button>
        }
      </div>
    }

    <!-- ── Filters ── -->
    <div class="filters">
      <mat-form-field appearance="outline" class="grow">
        <mat-label>Search invoice, customer no. or name</mat-label>
        <input matInput [(ngModel)]="search" (keyup.enter)="reload()" placeholder="e.g. IN123456 or 01-STM">
        <button matSuffix mat-icon-button (click)="reload()"><mat-icon>search</mat-icon></button>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Province</mat-label>
        <mat-select [(ngModel)]="province" (selectionChange)="reload()">
          <mat-option value="">All</mat-option>
          @for (p of summary()?.provinces ?? []; track p) { <mat-option [value]="p">{{ p }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>From</mat-label>
        <input matInput type="date" [(ngModel)]="from" (change)="reload(true)">
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>To</mat-label>
        <input matInput type="date" [(ngModel)]="to" (change)="reload(true)">
      </mat-form-field>
      <button mat-stroked-button (click)="exportCsv()" [disabled]="!rows().length" matTooltip="Download this view as CSV"><mat-icon>download</mat-icon> Export</button>
      <button mat-icon-button (click)="reload(true)" matTooltip="Refresh"><mat-icon>refresh</mat-icon></button>
    </div>

    <!-- ── Register ── -->
    @if (loading()) { <div class="center"><mat-spinner diameter="36"></mat-spinner></div> }
    @else if (!rows().length) { <div class="empty"><mat-icon>inbox</mat-icon> No invoices match.</div> }
    @else {
      <div class="table-wrap">
        <table class="bk">
          <thead>
            <tr>
              <th>Date</th><th>Invoice No</th><th>Co.</th><th>Customer No</th><th>Province</th><th>Customer Name</th>
              <th class="num">Amount</th><th>Trip sheet</th><th>Credit Note</th><th>POD Date</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            @for (r of rows(); track r.company + r.invoiceNumber) {
              <tr [class.needs]="r.state === 'Needs POD'" [class.pod]="r.state === 'POD received'">
                <td class="nowrap">{{ r.date | date:'dd MMM yyyy' }}</td>
                <td class="mono"><b>{{ r.invoiceNumber }}</b><div class="sub">{{ r.lines }} line{{ r.lines === 1 ? '' : 's' }}</div></td>
                <td><img class="row-logo" [src]="logo(r.company)" [alt]="r.companyName" [matTooltip]="r.companyName"></td>
                <td class="mono">{{ r.customerNumber }}</td>
                <td>{{ r.province || '—' }}</td>
                <td class="name" [title]="r.customerName">{{ r.customerName }}</td>
                <td class="num">@if (r.amount) { {{ r.amount | currency:'ZAR':'R':'1.2-2' }} } @else { <span class="muted" matTooltip="Imported from the trip sheet without a value">—</span> }</td>
                <td>
                  @if (r.loadNumber) {
                    <a [routerLink]="['/logistics/loads', r.loadId]" class="link mono">{{ r.loadNumber }}</a>
                    <div class="sub">{{ r.loadStatus }}@if (r.dispatchedAt) { · out {{ r.dispatchedAt | date:'dd MMM' }} }</div>
                  } @else { <span class="muted">—</span> }
                </td>
                <td>
                  @if (r.creditNotes.length) {
                    @for (c of r.creditNotes; track c.number) {
                      <div class="cn" [matTooltip]="(c.date | date:'dd MMM yyyy') + ' · ' + (c.amount | currency:'ZAR':'R':'1.2-2')">
                        <mat-icon>undo</mat-icon> <span class="mono">{{ c.number }}</span>
                      </div>
                    }
                  } @else { <span class="muted">—</span> }
                </td>
                <td class="nowrap">
                  @if (r.podDate) {
                    <span class="pod-date"><mat-icon>verified</mat-icon> {{ r.podDate | date:'dd MMM yyyy' }}</span>
                    <div class="sub">{{ r.podSource }}</div>
                  } @else if (r.state === 'Needs POD') {
                    <span class="waiting" [class.late]="(r.daysWaitingPod ?? 0) > 14">waiting {{ r.daysWaitingPod }}d</span>
                  } @else { <span class="muted">—</span> }
                </td>
                <td><span class="state" [class]="'state ' + stateClass(r.state)">{{ r.state }}</span></td>
                <td class="actions">
                  @if (r.podDocumentId) {
                    <button mat-icon-button (click)="openPod(r.podDocumentId)" matTooltip="Open POD"><mat-icon>picture_as_pdf</mat-icon></button>
                  }
                  <button mat-icon-button (click)="open360(r)" matTooltip="Customer 360"><mat-icon>account_circle</mat-icon></button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <mat-paginator [length]="total()" [pageIndex]="page - 1" [pageSize]="pageSize" [pageSizeOptions]="[25, 50, 100, 200]" (page)="onPage($event)" showFirstLastButtons></mat-paginator>
    }
  `,
  styles: [`
    :host { display: block; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 12px; }
    .kpi { text-align: left; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px 14px; cursor: pointer; display: flex; flex-direction: column; gap: 2px; transition: box-shadow .15s, border-color .15s; }
    .kpi:hover { box-shadow: 0 4px 14px rgba(0,0,0,.06); }
    .kpi.active { border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37,99,235,.15); }
    .kpi .k-label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: .04em; }
    .kpi b { font-size: 24px; line-height: 1.1; }
    .kpi .k-sub { font-size: 12px; color: #6b7280; }
    .kpi.warn b { color: #b45309; } .kpi.ok b { color: #047857; }
    .co-bar { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .co-tile { display: flex; align-items: center; gap: 14px; text-align: left; background: #fff; border: 2px solid #e5e7eb; border-radius: 16px; padding: 12px 16px; cursor: pointer; transition: border-color .15s, box-shadow .15s, opacity .15s, transform .15s; }
    .co-tile:hover { box-shadow: 0 6px 18px rgba(0,0,0,.08); transform: translateY(-1px); }
    .co-tile.active { border-color: #2563eb; background: #eff6ff; box-shadow: 0 0 0 3px rgba(37,99,235,.15); }
    .co-tile.dim { opacity: .55; }
    .co-logo { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; flex: 0 0 56px; background: #f3f4f6; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
    .co-logo.all-logo { display: inline-flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #1e3a8a, #2563eb); color: #fff; }
    .co-logo.all-logo mat-icon { font-size: 30px; width: 30px; height: 30px; }
    .co-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .co-text b { font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .co-text span { font-size: 12px; color: #6b7280; }
    .co-text em { font-style: normal; color: #b45309; font-weight: 600; } .co-text em.zero { color: #047857; }
    .filters { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; }
    .filters .grow { flex: 1; min-width: 240px; }
    .filters mat-form-field { margin-bottom: -1.25em; }
    .table-wrap { overflow: auto; border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; }
    table.bk { width: 100%; border-collapse: collapse; font-size: 13px; }
    .bk th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; padding: 10px 12px; border-bottom: 1px solid #e5e7eb; background: #f9fafb; position: sticky; top: 0; white-space: nowrap; }
    .bk td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
    .bk tr.needs td { background: #fffbeb; } .bk tr.pod td { background: #fff; }
    .bk tr:hover td { background: #f3f4f6; }
    .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .mono { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12px; }
    .nowrap { white-space: nowrap; }
    .name { max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sub, .muted { color: #9ca3af; font-size: 11px; }
    .row-logo { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; display: block; box-shadow: 0 1px 2px rgba(0,0,0,.15); }
    .link { color: #2563eb; text-decoration: none; } .link:hover { text-decoration: underline; }
    .cn { display: flex; align-items: center; gap: 4px; color: #7c3aed; } .cn mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .pod-date { display: inline-flex; align-items: center; gap: 4px; color: #047857; font-weight: 600; } .pod-date mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .waiting { color: #b45309; font-weight: 600; } .waiting.late { color: #b91c1c; }
    .state { border-radius: 999px; padding: 2px 8px; font-size: 11px; font-weight: 600; white-space: nowrap; }
    .state.ok { background: #d1fae5; color: #065f46; } .state.warn { background: #fef3c7; color: #92400e; } .state.idle { background: #f3f4f6; color: #374151; }
    .actions { white-space: nowrap; }
    .center { display: flex; justify-content: center; padding: 40px; }
    .empty { display: flex; gap: 8px; align-items: center; justify-content: center; padding: 40px; color: #6b7280; }
  `]
})
export class FinanceBookkeepingComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = environment.apiUrl;

  summary = signal<Summary | null>(null);
  rows = signal<Row[]>([]);
  total = signal(0);
  loading = signal(false);

  status: Status = 'all';
  company = '';
  province = '';
  search = '';
  from = '';
  to = '';
  page = 1;
  pageSize = 50;

  ngOnInit(): void {
    const v = this.route.snapshot.queryParamMap.get('view');
    if (v === 'needs-pod' || v === 'has-pod' || v === 'not-dispatched' || v === 'credited') this.status = v;
    this.reload(true);
  }

  setStatus(s: Status): void { this.status = s; this.page = 1; this.load(); }
  setCompany(c: string): void { this.company = c; this.page = 1; this.load(); }
  onPage(e: PageEvent): void { this.page = e.pageIndex + 1; this.pageSize = e.pageSize; this.load(); }

  reload(withSummary = false): void {
    this.page = 1;
    if (withSummary) this.loadSummary();
    this.load();
  }

  private dateParams(p: HttpParams): HttpParams {
    if (this.from) p = p.set('from', this.from);
    if (this.to) p = p.set('to', this.to);
    return p;
  }

  loadSummary(): void {
    this.http.get<Summary>(`${this.api}/finance/bookkeeping/summary`, { params: this.dateParams(new HttpParams()) })
      .subscribe({ next: s => this.summary.set(s), error: () => this.summary.set(null) });
  }

  load(): void {
    this.loading.set(true);
    let p = new HttpParams().set('status', this.status).set('page', this.page).set('pageSize', this.pageSize);
    if (this.company) p = p.set('company', this.company);
    if (this.province) p = p.set('province', this.province);
    if (this.search.trim()) p = p.set('search', this.search.trim());
    p = this.dateParams(p);
    this.http.get<{ total: number; rows: Row[] }>(`${this.api}/finance/bookkeeping`, { params: p }).subscribe({
      next: r => { this.rows.set(r.rows); this.total.set(r.total); this.loading.set(false); },
      error: () => { this.rows.set([]); this.total.set(0); this.loading.set(false); }
    });
  }

  stateClass(s: Row['state']): string { return s === 'POD received' ? 'ok' : s === 'Needs POD' ? 'warn' : 'idle'; }
  logo = companyLogo;
  openPod(id: number): void {
    this.http.get(`${this.api}/PodDocuments/${id}/view`, { responseType: 'blob' })
      .subscribe({ next: b => window.open(URL.createObjectURL(b), '_blank') });
  }

  open360(r: Row): void {
    this.http.get<{ id: number }>(`${this.api}/customers/master/resolve`, { params: { company: r.company, code: r.customerNumber } })
      .subscribe({ next: m => this.router.navigate(['/customers', m.id]), error: () => this.router.navigate(['/customers'], { queryParams: { search: r.customerName } }) });
  }

  exportCsv(): void {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const fmt = (d?: string) => d ? new Date(d).toISOString().slice(0, 10) : '';
    const head = ['Date', 'Invoice No', 'Company', 'Customer No', 'Province', 'Customer Name', 'Amount', 'Trip Sheet', 'Dispatched', 'Credit Note', 'POD Date', 'POD Source', 'Status', 'Days waiting POD'];
    const body = this.rows().map(r => [fmt(r.date), r.invoiceNumber, r.company, r.customerNumber, r.province, r.customerName, r.amount.toFixed(2), r.loadNumber, fmt(r.dispatchedAt), r.creditNoteNumbers, fmt(r.podDate), r.podSource, r.state, r.daysWaitingPod ?? ''].map(esc).join(','));
    const blob = new Blob(['\uFEFF' + [head.map(esc).join(','), ...body].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bookkeeping-${this.status}${this.company ? '-' + this.company : ''}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
