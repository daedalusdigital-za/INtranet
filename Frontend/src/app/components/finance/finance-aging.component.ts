import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../ui/toast.service';
import { companyLogo } from '../../core/company-logos';

interface Snapshot { id: number; company: string; asOfDate: string; sourceFileName?: string; uploadedAt: string; uploadedBy?: string; customerCount: number; documentCount: number; totalBalance: number; notes?: string; }
interface Bucket { index: number; label: string; amount: number; pct?: number; }
interface AgingCustomer { code: string; name: string; current: number; d30: number; d60: number; d90: number; d120: number; balance: number; overdue: number; maxDaysOver: number; documents: number; invoices: number; credits: number; oldestBucket: number; }
interface AgingItem { id: number; documentNumber: string; documentType: string; typeLabel: string; orderNumber?: string; poNumber?: string; documentDate?: string; dueDate?: string; reference?: string; daysOver?: number; amount: number; balance: number; ageDays: number; bucket: number; bucketLabel: string; hasPod: boolean; importedInvoiceId?: number; }
type SortKey = keyof Pick<AgingCustomer, 'name' | 'current' | 'd30' | 'd60' | 'd90' | 'd120' | 'balance' | 'overdue' | 'maxDaysOver'>;

@Component({
  selector: 'app-finance-aging',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule, MatProgressSpinnerModule, MatMenuModule],
  template: `
    <!-- Company + snapshot picker -->
    <div class="ag-toolbar">
      <div class="ag-companies">
        @for (c of companies(); track c) {
          <button class="ag-co" [class.active]="company() === c" [class.dim]="company() && company() !== c" [class.empty]="!latestFor(c)" (click)="pickCompany(c)" [attr.aria-pressed]="company() === c">
            <img class="logo" [src]="logo(c)" [alt]="c">
            <span class="txt">
              <span class="n">{{ c }}</span>
              @if (latestFor(c); as s) {
                <span class="v">{{ s.totalBalance | currency:'ZAR':'R':'1.0-0' }}</span>
                <span class="d">as at {{ s.asOfDate | date:'dd MMM yyyy' }} <i class="stale {{ staleLevel(s) }}" [matTooltip]="staleDays(s) + ' days old — amber after 7, red after 14'">{{ staleDays(s) }}d</i></span>
              } @else { <span class="d"><i class="stale red">No aging uploaded yet</i></span> }
            </span>
          </button>
        }
      </div>
      <span class="ag-spacer"></span>
      <label class="ag-upload" [class.busy]="uploading()">
        <mat-icon>{{ uploading() ? 'hourglass_top' : 'upload_file' }}</mat-icon>
        {{ uploading() ? 'Importing…' : 'Upload Sage aging (.xlsx)' }}
        <input type="file" accept=".xlsx" (change)="upload($event)" [disabled]="uploading()" hidden />
      </label>
    </div>

    @if (!company()) {
      <div class="ag-state"><mat-icon>account_balance</mat-icon><h3>Pick a company</h3><p>Choose a company above, then upload its Sage aging workbook (the one with the <i>Customer Transaction</i> sheet).</p></div>
    } @else if (!snapshot() && !loading()) {
      <div class="ag-state"><mat-icon>upload_file</mat-icon><h3>No aging for {{ company() }} yet</h3><p>Export the age analysis from Sage to Excel and upload it here. Each upload is kept as a dated snapshot, so you can compare months.</p></div>
    } @else {
      <!-- Snapshot row -->
      <div class="ag-snap">
        <mat-icon>event</mat-icon>
        <select [ngModel]="snapshotId()" (ngModelChange)="loadSnapshot($event)" aria-label="Snapshot">
          @for (s of snapshotsFor(company()); track s.id) { <option [ngValue]="s.id">As at {{ s.asOfDate | date:'dd MMM yyyy' }} · {{ s.customerCount }} customers · {{ s.documentCount }} docs</option> }
        </select>
        @if (snapshot(); as s) { <small class="muted">Uploaded {{ s.uploadedAt | date:'dd MMM, HH:mm' }}{{ s.uploadedBy ? ' by ' + s.uploadedBy : '' }} · {{ s.sourceFileName }}</small> }
        <span class="ag-spacer"></span>
        <button mat-stroked-button (click)="exportCsv()" matTooltip="Download the customer aging as a spreadsheet"><mat-icon>download</mat-icon> Export</button>
        <button mat-icon-button [matMenuTriggerFor]="more" aria-label="More"><mat-icon>more_vert</mat-icon></button>
        <mat-menu #more="matMenu"><button mat-menu-item (click)="deleteSnapshot()"><mat-icon>delete</mat-icon> Delete this snapshot</button></mat-menu>
      </div>

      @if (loading()) {
        <div class="ag-state"><mat-spinner diameter="36"></mat-spinner><p>Building the aging…</p></div>
      } @else {
        @if (aging(); as a) {
        <!-- Buckets -->
        <div class="ag-buckets">
          <button class="ag-bucket total" [class.active]="bucketFilter() === null" (click)="bucketFilter.set(null)">
            <span class="l">Total outstanding</span>
            <span class="v">{{ a.total | currency:'ZAR':'R':'1.2-2' }}</span>
            <span class="s">{{ a.customers.length }} customers · {{ a.overdue | currency:'ZAR':'R':'1.0-0' }} past due date</span>
          </button>
          @for (b of a.buckets; track b.index) {
            <button class="ag-bucket b{{ b.index }}" [class.active]="bucketFilter() === b.index" (click)="toggleBucket(b.index)" [matTooltip]="'Show only customers with money in ' + b.label">
              <span class="l">{{ b.label }}</span>
              <span class="v">{{ b.amount | currency:'ZAR':'R':'1.0-0' }}</span>
              <span class="bar"><i [style.width.%]="b.pct"></i></span>
              <span class="s">{{ b.pct }}% of book</span>
            </button>
          }
        </div>

        <!-- Filters -->
        <div class="ag-filters">
          <div class="ag-search">
            <mat-icon>search</mat-icon>
            <input type="text" placeholder="Search customer, invoice, PO or order number…" [ngModel]="search()" (ngModelChange)="onSearch($event)" />
            @if (search()) { <button mat-icon-button aria-label="Clear" (click)="onSearch('')"><mat-icon>close</mat-icon></button> }
          </div>
          <label class="ag-check"><input type="checkbox" [ngModel]="onlyOverdue()" (ngModelChange)="onlyOverdue.set($event)" /> Only customers past due</label>
          <label class="ag-check"><input type="checkbox" [ngModel]="hideCredits()" (ngModelChange)="hideCredits.set($event)" /> Hide credit balances</label>
          <button class="ag-nopod" [class.active]="showNoPod()" (click)="toggleNoPod()" matTooltip="Invoices open 60+ days with no proof of delivery — the collection-dispute pattern"><mat-icon>gavel</mat-icon> 60+ days, no POD @if (noPodForCompany().length) { <span class="n">{{ noPodForCompany().length }}</span> }</button>
          <span class="ag-spacer"></span>
          <small class="muted">{{ visible().length }} of {{ a.customers.length }} customers · aged on document date, 30-day periods</small>
        </div>

        @if (showNoPod()) {
          <div class="ag-nopod-panel">
            <div class="h"><mat-icon>gavel</mat-icon><b>Open 60+ days with no POD — {{ company() }}</b><small>These are the invoices a customer can dispute as "never received". Link the POD scan (Finance › PODs) or get the driver's POD attached to the load; the row disappears as soon as one exists.</small><span class="ag-spacer"></span><b class="mono">{{ noPodValue() | currency:'ZAR':'R':'1.0-0' }}</b></div>
            @if (noPodLoading()) { <div class="ag-inline"><mat-spinner diameter="20"></mat-spinner> Checking PODs…</div> }
            @else if (noPodForCompany().length === 0) { <div class="ag-inline ok"><mat-icon>verified</mat-icon> Every invoice older than 60 days for {{ company() }} has a POD.</div> }
            @else {
              <table class="ag-docs"><thead><tr><th>Invoice</th><th>Customer</th><th>PO</th><th>Doc date</th><th class="num">Age</th><th class="num">Balance</th><th></th></tr></thead><tbody>
                @for (i of noPodForCompany(); track i.documentNumber) {
                  <tr><td class="mono"><b>{{ i.documentNumber }}</b></td><td>{{ i.customerName }}<small>{{ i.customerCode }}</small></td><td>{{ i.poNumber || '—' }}</td><td>{{ i.documentDate | date:'dd MMM yy' }}</td><td class="num"><span class="badge danger">{{ i.ageDays }}d</span></td><td class="num">{{ i.balance | number:'1.2-2' }}</td>
                    <td><button mat-icon-button (click)="open360(i.customerCode)" matTooltip="Customer 360"><mat-icon>hub</mat-icon></button></td></tr>
                }
              </tbody></table>
            }
          </div>
        }

        <!-- Customer table -->
        <div class="ag-table-wrap">
          <table class="app-table ag-table">
            <thead>
              <tr>
                <th class="sort" (click)="sortBy('name')">Customer <mat-icon>{{ sortIcon('name') }}</mat-icon></th>
                <th class="num sort" (click)="sortBy('current')">Current <mat-icon>{{ sortIcon('current') }}</mat-icon></th>
                <th class="num sort" (click)="sortBy('d30')">30 days <mat-icon>{{ sortIcon('d30') }}</mat-icon></th>
                <th class="num sort" (click)="sortBy('d60')">60 days <mat-icon>{{ sortIcon('d60') }}</mat-icon></th>
                <th class="num sort" (click)="sortBy('d90')">90 days <mat-icon>{{ sortIcon('d90') }}</mat-icon></th>
                <th class="num sort" (click)="sortBy('d120')">120+ days <mat-icon>{{ sortIcon('d120') }}</mat-icon></th>
                <th class="num sort" (click)="sortBy('balance')">Balance <mat-icon>{{ sortIcon('balance') }}</mat-icon></th>
                <th class="num sort" (click)="sortBy('maxDaysOver')">Oldest <mat-icon>{{ sortIcon('maxDaysOver') }}</mat-icon></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (c of visible(); track c.code) {
                <tr class="cust" [class.open]="expanded() === c.code" [class.risk]="c.oldestBucket >= 3" (click)="toggle(c)">
                  <td>
                    <div class="ag-name"><b>{{ c.name }}</b><small>{{ c.code }} · {{ c.invoices }} invoice{{ c.invoices === 1 ? '' : 's' }}{{ c.credits ? ' · ' + c.credits + ' credit/receipt' : '' }}</small></div>
                  </td>
                  <td class="num" [class.zero]="!c.current">{{ c.current | number:'1.2-2' }}</td>
                  <td class="num" [class.zero]="!c.d30">{{ c.d30 | number:'1.2-2' }}</td>
                  <td class="num" [class.zero]="!c.d60">{{ c.d60 | number:'1.2-2' }}</td>
                  <td class="num warn" [class.zero]="!c.d90">{{ c.d90 | number:'1.2-2' }}</td>
                  <td class="num danger" [class.zero]="!c.d120">{{ c.d120 | number:'1.2-2' }}</td>
                  <td class="num total" [class.credit]="c.balance < 0">{{ c.balance | number:'1.2-2' }}</td>
                  <td class="num">@if (c.maxDaysOver > 0) { <span class="badge" [class.warn]="c.maxDaysOver <= 60" [class.danger]="c.maxDaysOver > 60">{{ c.maxDaysOver }}d over</span> } @else { <span class="muted">—</span> }</td>
                  <td class="chev"><button mat-icon-button (click)="open360(c.code); $event.stopPropagation()" matTooltip="Customer 360 — across all companies"><mat-icon>hub</mat-icon></button><mat-icon>{{ expanded() === c.code ? 'expand_less' : 'expand_more' }}</mat-icon></td>
                </tr>
                @if (expanded() === c.code) {
                  <tr class="detail"><td colspan="9">
                    @if (detailLoading()) { <div class="ag-inline"><mat-spinner diameter="20"></mat-spinner> Loading documents…</div> }
                    @else { @if (detail(); as d) {
                      <table class="ag-docs">
                        <thead><tr><th>Document</th><th>Type</th><th>Order / PO</th><th>Doc date</th><th>Due / Ref</th><th class="num">Days over</th><th>Age</th><th class="num">Amount</th><th class="num">Balance</th><th>POD</th></tr></thead>
                        <tbody>
                          @for (i of d.items; track i.id) {
                            <tr [class.credit]="i.balance < 0">
                              <td><span class="ref">{{ i.documentNumber }}</span></td>
                              <td><span class="type t-{{ i.documentType }}">{{ i.typeLabel }}</span></td>
                              <td><small>{{ i.orderNumber || '' }}{{ i.orderNumber && i.poNumber ? ' · ' : '' }}{{ i.poNumber || '' }}</small></td>
                              <td class="nowrap">{{ i.documentDate | date:'dd MMM yyyy' }}</td>
                              <td class="nowrap">{{ i.dueDate ? (i.dueDate | date:'dd MMM yyyy') : (i.reference || '—') }}</td>
                              <td class="num">@if (i.daysOver && i.daysOver > 0) { <span class="badge" [class.warn]="i.daysOver <= 60" [class.danger]="i.daysOver > 60">{{ i.daysOver }}</span> } @else if (i.documentType === 'IN') { <span class="muted">0</span> } @else { <span class="muted">—</span> }</td>
                              <td><span class="pill b{{ i.bucket }}">{{ i.bucketLabel }}</span></td>
                              <td class="num">{{ i.amount | number:'1.2-2' }}</td>
                              <td class="num total">{{ i.balance | number:'1.2-2' }}</td>
                              <td>
                                @if (i.documentType === 'IN') {
                                  @if (i.hasPod) { <mat-icon class="pod ok" matTooltip="Proof of delivery on file">task_alt</mat-icon> }
                                  @else { <mat-icon class="pod none" matTooltip="No POD on file — the customer may query this invoice">help_outline</mat-icon> }
                                }
                              </td>
                            </tr>
                          }
                        </tbody>
                        <tfoot><tr>
                          <td colspan="7"><div class="ag-foot">@for (b of d.buckets; track b.index) { <span class="pill b{{ b.index }}">{{ b.label }}: <b>{{ b.amount | number:'1.0-0' }}</b></span> }</div></td>
                          <td></td><td class="num total">{{ d.balance | number:'1.2-2' }}</td><td></td>
                        </tr></tfoot>
                      </table>
                    } }
                  </td></tr>
                }
              }
              @if (visible().length === 0) { <tr><td colspan="9"><div class="ag-state small"><mat-icon>inbox</mat-icon><p>No customers match these filters.</p></div></td></tr> }
            </tbody>
            <tfoot>
              <tr class="grand">
                <td>Total ({{ visible().length }} customers)</td>
                <td class="num">{{ sum('current') | number:'1.2-2' }}</td>
                <td class="num">{{ sum('d30') | number:'1.2-2' }}</td>
                <td class="num">{{ sum('d60') | number:'1.2-2' }}</td>
                <td class="num warn">{{ sum('d90') | number:'1.2-2' }}</td>
                <td class="num danger">{{ sum('d120') | number:'1.2-2' }}</td>
                <td class="num total">{{ sum('balance') | number:'1.2-2' }}</td>
                <td colspan="2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
        }
      }
    }
  `,
  styles: [`
    :host { display: block; }
    .ag-toolbar { display: flex; flex-wrap: wrap; align-items: stretch; gap: var(--space-3); margin-bottom: var(--space-4); }
    .ag-companies { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: var(--space-3); flex: 1; }
    .ag-co { display: flex; align-items: center; gap: 14px; padding: 12px 16px; text-align: left; cursor: pointer; font: inherit; color: var(--color-text);
      background: var(--color-surface); border: 2px solid var(--color-line); border-radius: 16px; transition: border-color .15s, box-shadow .15s, opacity .15s, transform .15s;
      .logo { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; flex: 0 0 56px; background: #f3f4f6; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
      .txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .n { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .v { font-size: var(--text-xl); font-weight: 700; line-height: 1.1; } .d { font-size: var(--text-xs); color: var(--color-text-3); }
      &:hover { box-shadow: 0 6px 18px rgba(0,0,0,.08); transform: translateY(-1px); }
      &.active { border-color: var(--color-primary); background: var(--color-primary-soft); box-shadow: 0 0 0 3px rgba(37,99,235,.15); }
      &.dim { opacity: .55; }
      &.empty .n { color: var(--color-text-2); } &.empty .logo { filter: grayscale(1); opacity: .6; } }
    .ag-spacer { flex: 1; }
    .ag-upload { display: inline-flex; align-items: center; gap: 8px; align-self: center; padding: 0 var(--space-4); height: 40px; cursor: pointer; font-weight: 600; color: #fff; background: var(--color-primary); border-radius: var(--radius-control);
      &:hover { filter: brightness(1.05); } &.busy { opacity: .7; cursor: progress; } }
    .ag-snap { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin-bottom: var(--space-3); mat-icon { color: var(--color-text-3); }
      select { height: 36px; padding: 0 var(--space-3); border: 1px solid var(--color-line-strong); border-radius: var(--radius-control); background: var(--color-surface); color: var(--color-text); font: inherit; } }
    .ag-buckets { display: grid; grid-template-columns: 1.4fr repeat(5, 1fr); gap: var(--space-2); margin-bottom: var(--space-3); }
    .ag-bucket { display: flex; flex-direction: column; gap: 4px; padding: var(--space-3) var(--space-4); text-align: left; cursor: pointer; font: inherit; color: var(--color-text);
      background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-md); border-top: 4px solid var(--c, var(--color-line-strong));
      .l { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .04em; color: var(--color-text-3); } .v { font-size: var(--text-2xl); font-weight: 700; line-height: 1.1; } .s { font-size: var(--text-xs); color: var(--color-text-3); }
      .bar { display: block; height: 5px; border-radius: 999px; background: var(--color-surface-2); overflow: hidden; i { display: block; height: 100%; background: var(--c); } }
      &:hover { box-shadow: var(--shadow-sm); } &.active { outline: 2px solid var(--c, var(--color-primary)); outline-offset: -1px; }
      &.total { --c: var(--color-primary); .v { font-size: var(--text-3xl); } }
      &.b0 { --c: var(--color-ok); } &.b1 { --c: var(--color-cat-teal, #14b8a6); } &.b2 { --c: #f59e0b; } &.b3 { --c: #f97316; } &.b4 { --c: var(--color-danger); } }
    .ag-filters { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); margin-bottom: var(--space-3); }
    .ag-search { display: flex; align-items: center; gap: 6px; height: 40px; padding: 0 var(--space-2) 0 var(--space-3); flex: 1 1 300px; max-width: 520px; border: 1px solid var(--color-line-strong); border-radius: var(--radius-control); background: var(--color-surface);
      mat-icon { color: var(--color-text-3); } input { flex: 1; border: 0; outline: 0; background: transparent; color: var(--color-text); font: inherit; }
      &:focus-within { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-soft); } }
    .ag-check { display: inline-flex; align-items: center; gap: 6px; font-size: var(--text-sm); cursor: pointer; }
    .ag-table-wrap { background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-lg); overflow: auto; }
    .ag-table { width: 100%; border-collapse: collapse;
      th { text-align: left; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .04em; color: var(--color-text-3); padding: 10px var(--space-3); background: var(--color-surface-2); border-bottom: 1px solid var(--color-line); white-space: nowrap; position: sticky; top: 0; z-index: 1;
        &.sort { cursor: pointer; user-select: none; mat-icon { font-size: 16px; width: 16px; height: 16px; vertical-align: -3px; opacity: .6; } &:hover { color: var(--color-text); } } }
      td { padding: 10px var(--space-3); border-bottom: 1px solid var(--color-line); vertical-align: middle; font-size: var(--text-sm); }
      .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .zero { color: var(--color-text-3); opacity: .5; }
      .warn:not(.zero) { color: #b45309; } .danger:not(.zero) { color: var(--color-danger); font-weight: 600; }
      .total { font-weight: 700; } .credit { color: var(--color-ok); }
      tr.cust { cursor: pointer; &:hover td { background: var(--color-surface-2); } &.open td { background: var(--color-primary-soft); border-bottom-color: transparent; } &.risk td:first-child { box-shadow: inset 3px 0 0 var(--color-danger); } }
      tr.detail > td { padding: 0 var(--space-3) var(--space-3); background: var(--color-primary-soft); }
      tfoot tr.grand td { background: var(--color-surface-2); font-weight: 700; border-top: 2px solid var(--color-line-strong); }
      .chev { width: 32px; mat-icon { color: var(--color-text-3); } } }
    .ag-name { display: flex; flex-direction: column; small { color: var(--color-text-3); font-size: var(--text-xs); } }
    .ag-docs { width: 100%; border-collapse: collapse; background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-md); overflow: hidden;
      th { position: static; font-size: 10px; padding: 6px var(--space-2); }
      td { padding: 6px var(--space-2); font-size: var(--text-xs); border-bottom: 1px solid var(--color-line); }
      tr.credit td { color: var(--color-ok); }
      tfoot td { border-bottom: 0; background: var(--color-surface-2); } }
    .ag-foot { display: flex; flex-wrap: wrap; gap: 6px; }
    .ref { font-family: var(--font-mono); }
    .nowrap { white-space: nowrap; } .muted { color: var(--color-text-3); }
    .type { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; background: var(--color-surface-2); color: var(--color-text-2);
      &.t-IN { background: var(--color-primary-soft); color: var(--color-primary); } &.t-PY, &.t-PI, &.t-CR { background: var(--color-ok-soft); color: var(--color-ok); } }
    .pill { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; color: #fff; background: var(--color-line-strong);
      &.b0 { background: var(--color-ok); } &.b1 { background: var(--color-cat-teal, #14b8a6); } &.b2 { background: #f59e0b; } &.b3 { background: #f97316; } &.b4 { background: var(--color-danger); } }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: var(--text-xs); font-weight: 600; background: var(--color-surface-2);
      &.warn { background: var(--color-warn-soft); color: #b45309; } &.danger { background: var(--color-danger-soft, #fee2e2); color: var(--color-danger); } }
    .pod { font-size: 20px; width: 20px; height: 20px; &.ok { color: var(--color-ok); } &.none { color: var(--color-text-3); } }
    .ag-inline { display: flex; align-items: center; gap: 8px; padding: var(--space-3); color: var(--color-text-3); }
    .ag-state { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); padding: var(--space-8) var(--space-4); color: var(--color-text-3); text-align: center;
      mat-icon { font-size: 44px; width: 44px; height: 44px; } h3 { margin: 0; color: var(--color-text); } p { margin: 0; max-width: 520px; }
      &.small { padding: var(--space-4); mat-icon { font-size: 28px; width: 28px; height: 28px; } } }
    @media (max-width: 1100px) { .ag-buckets { grid-template-columns: repeat(3, 1fr); } }
    .stale { font-style:normal; font-size:10px; padding:1px 6px; border-radius:999px; margin-left:4px; background:#dcfce7; color:#166534; &.amber { background:#fef3c7; color:#92400e; } &.red { background:#fee2e2; color:#991b1b; } }
    .ag-nopod { display:inline-flex; align-items:center; gap:6px; border:1px solid var(--color-line); background: var(--color-surface); border-radius:999px; padding:5px 12px; font: inherit; font-size: var(--text-sm); cursor:pointer; color: var(--color-text-2);
      mat-icon { font-size:16px; width:16px; height:16px; } .n { background: var(--color-danger); color:#fff; border-radius:999px; padding:0 7px; font-size: var(--text-xs); }
      &.active { background: #fff1f2; border-color:#fecdd3; color:#9f1239; } }
    .ag-nopod-panel { border:1px solid #fecdd3; background:#fff7f7; border-radius: var(--radius-lg); padding:12px 14px; margin-bottom: var(--space-3);
      .h { display:flex; align-items:center; gap:10px; margin-bottom:8px; small { color: var(--color-text-3); max-width:640px; } mat-icon { color:#9f1239; } }
      .ok { color: var(--color-ok); display:flex; align-items:center; gap:6px; } .mono { font-variant-numeric: tabular-nums; } }
    .chev { white-space:nowrap; }
  `]
})
export class FinanceAgingComponent implements OnInit {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = `${environment.apiUrl}/finance/aging`;

  companies = signal<string[]>([]);
  snapshots = signal<Snapshot[]>([]);
  company = signal<string>('');
  snapshotId = signal<number | null>(null);
  snapshot = computed(() => this.snapshots().find(s => s.id === this.snapshotId()) ?? null);
  aging = signal<{ total: number; overdue: number; buckets: Bucket[]; customers: AgingCustomer[] } | null>(null);
  loading = signal(false);
  uploading = signal(false);

  search = signal('');
  bucketFilter = signal<number | null>(null);
  onlyOverdue = signal(false);
  hideCredits = signal(false);
  sortKey = signal<SortKey>('balance');
  sortDir = signal<1 | -1>(-1);

  expanded = signal<string | null>(null);
  detail = signal<{ items: AgingItem[]; buckets: Bucket[]; balance: number } | null>(null);
  detailLoading = signal(false);

  visible = computed(() => {
    const a = this.aging(); if (!a) return [];
    const q = this.search().trim().toLowerCase();
    const bf = this.bucketFilter();
    const bucketVal = (c: AgingCustomer, i: number) => [c.current, c.d30, c.d60, c.d90, c.d120][i];
    let rows = a.customers.filter(c =>
      (!q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)) &&
      (bf === null || bucketVal(c, bf) > 0.005) &&
      (!this.onlyOverdue() || c.overdue > 0) &&
      (!this.hideCredits() || c.balance >= 0));
    const k = this.sortKey(), d = this.sortDir();
    rows = [...rows].sort((x, y) => k === 'name' ? d * x.name.localeCompare(y.name) : d * ((x[k] as number) - (y[k] as number)));
    return rows;
  });

  ngOnInit(): void {
    this.loadSnapshots();
    if (this.route.snapshot.queryParamMap.get('view') === 'nopod') { this.showNoPod.set(true); this.loadNoPod(); }
  }

  // ── staleness ──
  staleDays(s: Snapshot): number { return Math.max(0, Math.floor((Date.now() - new Date(s.asOfDate).getTime()) / 86400000)); }
  staleLevel(s: Snapshot): string { const d = this.staleDays(s); return d > 14 ? 'red' : d > 7 ? 'amber' : 'ok'; }

  // ── 60+ days, no POD ──
  showNoPod = signal(false); noPodLoading = signal(false);
  noPodAll = signal<{ company: string; customerCode: string; customerName: string; documentNumber: string; documentDate?: string; balance: number; ageDays: number; poNumber?: string }[]>([]);
  noPodForCompany = computed(() => this.noPodAll().filter(i => i.company === this.company()));
  noPodValue = computed(() => this.noPodForCompany().reduce((s, i) => s + i.balance, 0));
  toggleNoPod(): void { this.showNoPod.set(!this.showNoPod()); if (this.showNoPod() && this.noPodAll().length === 0) this.loadNoPod(); }
  loadNoPod(): void {
    this.noPodLoading.set(true);
    this.http.get<{ noPodInvoices: { items: any[] } }>(`${environment.apiUrl}/finance/alerts`, { params: { top: 100 } }).subscribe({
      next: a => { this.noPodAll.set(a.noPodInvoices.items); this.noPodLoading.set(false); },
      error: () => { this.noPodLoading.set(false); this.toast.error('Could not check PODs'); }
    });
  }
  open360(code: string): void {
    this.http.get<{ id: number }>(`${environment.apiUrl}/customers/master/resolve`, { params: { company: this.company(), code } }).subscribe({
      next: r => this.router.navigate(['/customers', r.id]),
      error: () => this.toast.error('Could not resolve the customer')
    });
  }

  loadSnapshots(selectLatestFor?: string): void {
    this.http.get<{ companies: string[]; snapshots: Snapshot[] }>(`${this.api}/snapshots`).subscribe({
      next: r => {
        this.companies.set(r.companies); this.snapshots.set(r.snapshots);
        const co = selectLatestFor ?? this.company() ?? '';
        if (co) { this.company.set(co); const latest = this.latestFor(co); if (latest) this.loadSnapshot(latest.id); else { this.snapshotId.set(null); this.aging.set(null); } }
        else if (!this.company()) { const first = r.companies.find(c => this.latestFor(c)) ?? r.companies[0]; if (first) this.pickCompany(first); }
      },
      error: () => this.toast.error("Couldn't load the aging snapshots.")
    });
  }

  snapshotsFor(co: string): Snapshot[] { return this.snapshots().filter(s => s.company === co); }
  logo = companyLogo;
  latestFor(co: string): Snapshot | undefined { return this.snapshotsFor(co)[0]; }

  pickCompany(co: string): void {
    this.company.set(co); this.expanded.set(null); this.bucketFilter.set(null);
    const latest = this.latestFor(co);
    if (latest) this.loadSnapshot(latest.id); else { this.snapshotId.set(null); this.aging.set(null); }
  }

  loadSnapshot(id: number): void {
    this.snapshotId.set(id); this.expanded.set(null); this.loading.set(true);
    let params = new HttpParams();
    const q = this.search().trim(); if (q) params = params.set('search', q);
    this.http.get<any>(`${this.api}/snapshots/${id}`, { params }).subscribe({
      next: r => { this.aging.set(r); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.error("Couldn't build the aging."); }
    });
  }

  private searchTimer: any;
  onSearch(v: string): void {
    this.search.set(v ?? '');
    clearTimeout(this.searchTimer);
    // Server search also matches invoice / PO / order numbers inside the documents; client filter narrows by name instantly.
    this.searchTimer = setTimeout(() => { if (this.snapshotId()) this.loadSnapshot(this.snapshotId()!); }, 350);
  }
  toggleBucket(i: number): void { this.bucketFilter.set(this.bucketFilter() === i ? null : i); }
  sortBy(k: SortKey): void { if (this.sortKey() === k) this.sortDir.set(this.sortDir() === 1 ? -1 : 1); else { this.sortKey.set(k); this.sortDir.set(k === 'name' ? 1 : -1); } }
  sortIcon(k: SortKey): string { return this.sortKey() !== k ? 'unfold_more' : this.sortDir() === 1 ? 'expand_less' : 'expand_more'; }
  sum(k: 'current' | 'd30' | 'd60' | 'd90' | 'd120' | 'balance'): number { return this.visible().reduce((s, c) => s + c[k], 0); }

  toggle(c: AgingCustomer): void {
    if (this.expanded() === c.code) { this.expanded.set(null); return; }
    this.expanded.set(c.code); this.detail.set(null); this.detailLoading.set(true);
    this.http.get<any>(`${this.api}/snapshots/${this.snapshotId()}/customers/${encodeURIComponent(c.code)}`).subscribe({
      next: r => { this.detail.set(r); this.detailLoading.set(false); },
      error: () => { this.detailLoading.set(false); this.toast.error("Couldn't load this customer's documents."); }
    });
  }

  upload(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0]; input.value = '';
    if (!file) return;
    const co = this.company() || this.companies()[0];
    if (!co) { this.toast.error('Pick a company first.'); return; }
    if (!window.confirm(`Import "${file.name}" as the aging for ${co}?`)) return;
    const fd = new FormData(); fd.append('file', file); fd.append('company', co);
    this.uploading.set(true);
    this.http.post<any>(`${this.api}/import`, fd).subscribe({
      next: r => {
        this.uploading.set(false);
        this.toast.done(`Imported ${r.documentCount} documents for ${r.customerCount} customers · R ${Number(r.totalBalance).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`);
        this.loadSnapshots(co);
      },
      error: e => { this.uploading.set(false); this.toast.error(e?.error?.message || "Couldn't import this workbook."); }
    });
  }

  exportCsv(): void {
    const id = this.snapshotId(); if (!id) return;
    this.http.get(`${this.api}/snapshots/${id}/export`, { responseType: 'blob' }).subscribe({
      next: b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `Aging-${this.company().replace(/\s+/g, '_')}.csv`; a.click(); URL.revokeObjectURL(a.href); },
      error: () => this.toast.error("Couldn't export the aging.")
    });
  }

  deleteSnapshot(): void {
    const s = this.snapshot(); if (!s) return;
    if (!window.confirm(`Delete the ${s.company} aging as at ${new Date(s.asOfDate).toLocaleDateString()}? The documents in it are removed; Sage is not affected.`)) return;
    this.http.delete(`${this.api}/snapshots/${s.id}`).subscribe({
      next: () => { this.toast.done('Snapshot deleted'); this.aging.set(null); this.snapshotId.set(null); this.loadSnapshots(this.company()); },
      error: () => this.toast.error("Couldn't delete the snapshot.")
    });
  }
}
