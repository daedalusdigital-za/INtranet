import { Component, OnInit, inject, signal, computed, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { companyWideLogo, companyMonogram, companyHue } from '../../core/company-logos';
import { ToastService } from '../../ui/toast.service';
import { CreditorPacksService, ApAgingIndex, ApAgingSnapshot, ApAging, ApAgingVendor, ApAgingHistoryRow, ApAgingDocument, ApAgingVendorDocs } from '../../services/creditor-packs.service';

type SortKey = 'name' | 'current' | 'd30' | 'd60' | 'd90' | 'over90' | 'total' | 'overdue';
type DocSortKey = 'vendorName' | 'docNumber' | 'docDate' | 'dueDate' | 'daysOverdue' | 'total';

/**
 * Finance → Creditors → Aging. The Sage 300 "A/P Aged Payables by Due Date" per paying company,
 * uploaded as dated snapshots (.xls straight from Sage). One row per vendor with the ageing buckets;
 * shows what is already in a payment pack for each vendor and starts a payment from a row.
 */
@Component({
  selector: 'app-finance-creditors-aging',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule, MatProgressSpinnerModule, MatMenuModule],
  template: `
  @if (!index()) {
    <div class="ag-state"><mat-spinner diameter="36"></mat-spinner><p>Loading creditors aging…</p></div>
  } @else {
    <!-- Company tiles -->
    <div class="ag-companies">
      @for (c of index()!.companies; track c.code) {
        <button class="ag-co" [class.active]="company() === c.code" [class.dim]="company() && company() !== c.code" [class.empty]="!latestFor(c.code)" (click)="pickCompany(c.code)">
          <span class="mark">@if (logo(c.code); as src) { <img [src]="src" [alt]="c.name"> } @else { <span class="mono" [style.--hue]="hue(c.code)">{{ monogram(c.code, c.name) }}</span> }</span>
          <span class="txt">
            <span class="n">{{ c.name }}</span>
            @if (latestFor(c.code); as s) {
              <span class="v" [class.credit]="s.totalPayables < 0">R {{ s.totalPayables | number:'1.0-0' }}</span>
              <span class="d">{{ s.activeVendorCount }} vendors · as at {{ s.asOfDate | date:'dd MMM' }} <i class="stale {{ staleLevel(s) }}">{{ staleDays(s) }}d</i></span>
            } @else { <span class="d"><i class="stale red">No aging uploaded</i></span> }
          </span>
        </button>
      }
    </div>

    <!-- Upload -->
    <div class="ag-upload-row">
      <label class="ag-upload" [class.busy]="uploading()">
        <mat-icon>upload_file</mat-icon> {{ uploading() ? 'Reading report…' : 'Upload aged payables (.xls / .xlsx)' }}
        <input type="file" accept=".xls,.xlsx" multiple hidden (change)="upload($event)" [disabled]="uploading()">
      </label>
      <small class="muted">Sage 300 › A/P › Aged Payables by Due Date — <b>Detail by Document Date</b> (one row per invoice; preferred) or <b>Summary</b>. The company is read from the report header; several files can be dropped at once. Re-uploading the same day replaces that snapshot.</small>
    </div>

    @if (!company()) {
      <div class="ag-state"><mat-icon>account_balance_wallet</mat-icon><h3>Pick a company</h3><p>Choose a paying company above to see who it owes and how old the balances are.</p></div>
    } @else if (!snapshot() && !loading()) {
      <div class="ag-state"><mat-icon>upload_file</mat-icon><h3>No aging for {{ companyName() }} yet</h3><p>Export the aged payables from Sage and upload it above.</p></div>
    } @else {
      <div class="ag-snap">
        <mat-icon>event</mat-icon>
        <select [ngModel]="snapshotId()" (ngModelChange)="loadSnapshot($event)">
          @for (s of snapshotsFor(company()!); track s.id) { <option [ngValue]="s.id">As at {{ s.asOfDate | date:'dd MMM yyyy' }} · {{ s.activeVendorCount }} of {{ s.vendorCount }} vendors with balances{{ s.hasDetail ? ' · ' + s.documentCount + ' documents' : ' · summary only' }}</option> }
        </select>
        @if (snapshot(); as s) {
          @if (s.hasDetail) { <span class="badge detail" matTooltip="Uploaded from the Detail report — every open invoice, credit note and prepayment is available per vendor"><mat-icon>receipt_long</mat-icon> Detailed · {{ s.documentCount | number }} documents</span> }
          @else { <span class="badge" matTooltip="Summary report — vendor totals only. Upload the Detail by Document Date export to see the invoices behind each balance">Summary only</span> }
          <small class="muted">Uploaded {{ s.uploadedAt | date:'dd MMM, HH:mm' }}{{ s.uploadedByName ? ' by ' + s.uploadedByName : '' }} · {{ s.sourceFileName }}{{ s.reportCompany ? ' · "' + s.reportCompany + '"' : '' }}</small>
        }
        <span class="sp"></span>
        @if (snapshot()?.hasDetail) {
          <div class="ag-view">
            <button [class.on]="view() === 'vendors'" (click)="setView('vendors')"><mat-icon>groups</mat-icon> By vendor</button>
            <button [class.on]="view() === 'documents'" (click)="setView('documents')"><mat-icon>receipt_long</mat-icon> All documents</button>
          </div>
        }
        <button mat-stroked-button (click)="exportXlsx()"><mat-icon>download</mat-icon> Excel</button>
        <button mat-icon-button [matMenuTriggerFor]="more"><mat-icon>more_vert</mat-icon></button>
        <mat-menu #more="matMenu"><button mat-menu-item (click)="deleteSnapshot()"><mat-icon>delete</mat-icon> Delete this snapshot</button></mat-menu>
      </div>

      @if (loading()) { <div class="ag-state"><mat-spinner diameter="36"></mat-spinner><p>Building the aging…</p></div> }
      @if (!loading() && aging(); as a) {
        <div class="ag-buckets">
          <button class="ag-bucket total" [class.active]="bucket() === null" (click)="bucket.set(null)">
            <span class="l">Total payables</span>
            <span class="v">R {{ a.total | number:'1.2-2' }}</span>
            <span class="s">{{ a.vendors.length }} vendors · R {{ a.overdue | number:'1.0-0' }} overdue</span>
          </button>
          @for (b of a.buckets; track b.index) {
            <button class="ag-bucket b{{ b.index }}" [class.active]="bucket() === b.index" (click)="bucket.set(bucket() === b.index ? null : b.index)" [matTooltip]="'Only vendors with money in ' + b.label">
              <span class="l">{{ b.label }}</span>
              <span class="v">R {{ b.amount | number:'1.0-0' }}</span>
              <span class="bar"><i [style.width.%]="clampPct(b.pct)"></i></span>
              <span class="s">{{ b.pct }}% of book</span>
            </button>
          }
        </div>

        @if (view() === 'documents') {
          <div class="ag-filters">
            <div class="ag-search"><mat-icon>search</mat-icon><input type="text" placeholder="Search document number or vendor…" [ngModel]="docSearch()" (ngModelChange)="docSearch.set($event)">@if (docSearch()) { <button mat-icon-button (click)="docSearch.set('')"><mat-icon>close</mat-icon></button> }</div>
            <select class="ag-sel" [ngModel]="docType()" (ngModelChange)="docType.set($event)">
              <option value="">All types</option>
              @for (t of docTypes(); track t.code) { <option [value]="t.code">{{ t.label }} ({{ t.n }})</option> }
            </select>
            <label class="ag-check"><input type="checkbox" [ngModel]="docOverdueOnly()" (ngModelChange)="docOverdueOnly.set($event)"> Only overdue</label>
            <span class="sp"></span>
            <small class="muted">{{ visibleDocs().length }} of {{ docs().length }} documents{{ bucket() !== null ? ' · in ' + a.buckets[bucket()!].label : '' }}</small>
          </div>
          @if (docsLoading()) { <div class="ag-state"><mat-spinner diameter="32"></mat-spinner><p>Loading documents…</p></div> }
          @else {
          <div class="ag-table-wrap">
            <table class="ag-table docs">
              <thead><tr>
                <th class="sort" (click)="docSortBy('vendorName')">Vendor <mat-icon>{{ docSortIcon('vendorName') }}</mat-icon></th>
                <th class="sort" (click)="docSortBy('docNumber')">Document <mat-icon>{{ docSortIcon('docNumber') }}</mat-icon></th>
                <th class="sort" (click)="docSortBy('docDate')">Doc date <mat-icon>{{ docSortIcon('docDate') }}</mat-icon></th>
                <th class="sort" (click)="docSortBy('dueDate')">Due <mat-icon>{{ docSortIcon('dueDate') }}</mat-icon></th>
                <th class="num sort" (click)="docSortBy('daysOverdue')">Days over <mat-icon>{{ docSortIcon('daysOverdue') }}</mat-icon></th>
                <th>Bucket</th>
                <th class="num sort" (click)="docSortBy('total')">Amount <mat-icon>{{ docSortIcon('total') }}</mat-icon></th>
                <th></th>
              </tr></thead>
              <tbody>
                @for (d of visibleDocs(); track d.id) {
                  <tr class="doc" [class.risk]="d.bucket === 4" [class.creditrow]="d.total < 0">
                    <td><div class="ag-name"><b>{{ d.vendorName }}</b><small>{{ d.vendorCode }}</small></div></td>
                    <td><div class="ag-name"><b class="mono">{{ d.docNumber }}</b><small><span class="ty ty-{{ d.docType }}">{{ d.typeLabel }}</span></small></div></td>
                    <td class="dt">{{ d.docDate | date:'dd MMM yyyy' }}</td>
                    <td class="dt">{{ d.dueDate | date:'dd MMM yyyy' }}</td>
                    <td class="num" [class.danger]="d.daysOverdue > 90" [class.warn]="d.daysOverdue > 30 && d.daysOverdue <= 90">{{ d.daysOverdue || '—' }}</td>
                    <td><span class="pill b{{ d.bucket }}">{{ a.buckets[d.bucket].label }}</span></td>
                    <td class="num total" [class.credit]="d.total < 0">{{ d.total | number:'1.2-2' }}</td>
                    <td class="chev"><button mat-icon-button (click)="openVendor(d.vendorCode!)" matTooltip="Show this vendor"><mat-icon>person_search</mat-icon></button></td>
                  </tr>
                }
                @if (!visibleDocs().length) { <tr><td colspan="8"><div class="ag-state small"><mat-icon>inbox</mat-icon><p>No documents match these filters.</p></div></td></tr> }
              </tbody>
              <tfoot><tr class="grand"><td colspan="6">Total ({{ visibleDocs().length }} documents)</td><td class="num total">{{ sumDocs() | number:'1.2-2' }}</td><td></td></tr></tfoot>
            </table>
          </div>
          }
        } @else {
        <div class="ag-filters">
          <div class="ag-search"><mat-icon>search</mat-icon><input type="text" placeholder="Search vendor name or number…" [ngModel]="search()" (ngModelChange)="search.set($event)">@if (search()) { <button mat-icon-button (click)="search.set('')"><mat-icon>close</mat-icon></button> }</div>
          <label class="ag-check"><input type="checkbox" [ngModel]="onlyOverdue()" (ngModelChange)="onlyOverdue.set($event)"> Only vendors overdue</label>
          <label class="ag-check"><input type="checkbox" [ngModel]="hideCredits()" (ngModelChange)="hideCredits.set($event)"> Hide credit balances</label>
          <label class="ag-check"><input type="checkbox" [ngModel]="showZero()" (ngModelChange)="toggleZero($event)"> Show zero-balance vendors</label>
          <span class="sp"></span>
          <small class="muted">{{ visible().length }} of {{ a.vendors.length }} vendors · aged by due date</small>
        </div>

        <div class="ag-table-wrap">
          <table class="ag-table">
            <thead><tr>
              <th class="sort" (click)="sortBy('name')">Vendor <mat-icon>{{ sortIcon('name') }}</mat-icon></th>
              <th class="num sort" (click)="sortBy('current')">Current <mat-icon>{{ sortIcon('current') }}</mat-icon></th>
              <th class="num sort" (click)="sortBy('d30')">1–30 <mat-icon>{{ sortIcon('d30') }}</mat-icon></th>
              <th class="num sort" (click)="sortBy('d60')">31–60 <mat-icon>{{ sortIcon('d60') }}</mat-icon></th>
              <th class="num sort" (click)="sortBy('d90')">61–90 <mat-icon>{{ sortIcon('d90') }}</mat-icon></th>
              <th class="num sort" (click)="sortBy('over90')">Over 90 <mat-icon>{{ sortIcon('over90') }}</mat-icon></th>
              <th class="num sort" (click)="sortBy('overdue')">Overdue <mat-icon>{{ sortIcon('overdue') }}</mat-icon></th>
              <th class="num sort" (click)="sortBy('total')">Total <mat-icon>{{ sortIcon('total') }}</mat-icon></th>
              <th class="num">In packs</th>
              <th></th>
            </tr></thead>
            <tbody>
              @for (v of visible(); track v.id) {
                <tr class="vend" [class.open]="expanded() === v.code" [class.risk]="v.over90 > 0" (click)="toggle(v)">
                  <td><div class="ag-name"><b>{{ v.name }}</b><small>{{ v.code }}{{ v.currency && v.currency !== 'ZAR' ? ' · ' + v.currency : '' }}{{ v.docCount ? ' · ' + v.docCount + ' doc' + (v.docCount === 1 ? '' : 's') : '' }}</small></div></td>
                  <td class="num" [class.zero]="!v.current">{{ v.current | number:'1.2-2' }}</td>
                  <td class="num" [class.zero]="!v.d30">{{ v.d30 | number:'1.2-2' }}</td>
                  <td class="num" [class.zero]="!v.d60">{{ v.d60 | number:'1.2-2' }}</td>
                  <td class="num warn" [class.zero]="!v.d90">{{ v.d90 | number:'1.2-2' }}</td>
                  <td class="num danger" [class.zero]="!v.over90">{{ v.over90 | number:'1.2-2' }}</td>
                  <td class="num" [class.zero]="!v.overdue">{{ v.overdue | number:'1.2-2' }}</td>
                  <td class="num total" [class.credit]="v.total < 0">{{ v.total | number:'1.2-2' }}</td>
                  <td class="num">@if (v.inPacks) { <span class="badge ok" [matTooltip]="packTip(v)">R {{ v.inPacks | number:'1.0-0' }}</span> } @else { <span class="muted">—</span> }</td>
                  <td class="chev"><button mat-icon-button (click)="pay.emit({ company: company()!, vendor: v }); $event.stopPropagation()" matTooltip="Start a payment to this vendor"><mat-icon>payments</mat-icon></button><mat-icon>{{ expanded() === v.code ? 'expand_less' : 'expand_more' }}</mat-icon></td>
                </tr>
                @if (expanded() === v.code) {
                  <tr class="detail"><td colspan="10">
                    <div class="ag-detail">
                      <div class="pills">@for (b of a.buckets; track b.index) { <span class="pill b{{ b.index }}">{{ b.label }}: <b>{{ bucketOf(v, b.index) | number:'1.0-0' }}</b></span> }</div>
                      @if (v.packs?.length) { <div class="packs"><mat-icon>inventory_2</mat-icon> In payment packs: @for (p of v.packs; track p.batchId) { <button class="lnk" (click)="openBatch.emit(p.batchId); $event.stopPropagation()">{{ p.batchNumber }}</button><small>{{ p.status }}</small> }</div> }
                      @if (snapshot()?.hasDetail) {
                        @if (vendorDocsLoading()) { <div class="ag-inline"><mat-spinner diameter="18"></mat-spinner> Loading documents…</div> }
                        @else { @if (vendorDocs(); as vd) {
                          <div class="ag-docs-head"><mat-icon>receipt_long</mat-icon> <b>{{ vd.documents.length }}</b> open document{{ vd.documents.length === 1 ? '' : 's' }} behind this balance</div>
                          <table class="ag-hist docs">
                            <thead><tr><th>Type</th><th>Document</th><th>Doc date</th><th>Due</th><th class="num">Days over</th><th>Bucket</th><th class="num">Amount</th><th>In pack</th></tr></thead>
                            <tbody>
                              @for (d of vd.documents; track d.id) {
                                <tr [class.creditrow]="d.total < 0">
                                  <td><span class="ty ty-{{ d.docType }}">{{ d.typeLabel }}</span></td>
                                  <td class="mono">{{ d.docNumber }}</td>
                                  <td>{{ d.docDate | date:'dd MMM yyyy' }}</td>
                                  <td>{{ d.dueDate | date:'dd MMM yyyy' }}</td>
                                  <td class="num" [class.danger]="d.daysOverdue > 90" [class.warn]="d.daysOverdue > 30 && d.daysOverdue <= 90">{{ d.daysOverdue || '—' }}</td>
                                  <td><span class="pill b{{ d.bucket }}">{{ a.buckets[d.bucket].label }}</span></td>
                                  <td class="num total" [class.credit]="d.total < 0">{{ d.total | number:'1.2-2' }}</td>
                                  <td>@if (d.packs?.length) { @for (p of d.packs; track p.batchId) { <button class="lnk" (click)="openBatch.emit(p.batchId); $event.stopPropagation()">{{ p.batchNumber }}</button> } } @else { <span class="muted">—</span> }</td>
                                </tr>
                              }
                            </tbody>
                            <tfoot><tr class="cur"><td colspan="6">Vendor total</td><td class="num total">{{ vd.totals.total | number:'1.2-2' }}</td><td></td></tr></tfoot>
                          </table>
                        } }
                      }
                      @if (historyLoading()) { <div class="ag-inline"><mat-spinner diameter="18"></mat-spinner> Loading history…</div> }
                      @else if (history().length > 1) {
                        <table class="ag-hist"><thead><tr><th>As at</th><th class="num">Current</th><th class="num">1–30</th><th class="num">31–60</th><th class="num">61–90</th><th class="num">Over 90</th><th class="num">Total</th></tr></thead>
                          <tbody>@for (h of history(); track h.id) { <tr [class.cur]="h.id === snapshotId()"><td>{{ h.asOfDate | date:'dd MMM yyyy' }}</td><td class="num">{{ h.current | number:'1.0-0' }}</td><td class="num">{{ h.d30 | number:'1.0-0' }}</td><td class="num">{{ h.d60 | number:'1.0-0' }}</td><td class="num">{{ h.d90 | number:'1.0-0' }}</td><td class="num">{{ h.over90 | number:'1.0-0' }}</td><td class="num total">{{ h.total | number:'1.0-0' }}</td></tr> }</tbody></table>
                      } @else { <small class="muted">Only one snapshot so far — upload next month's report to see the movement.</small> }
                    </div>
                  </td></tr>
                }
              }
              @if (!visible().length) { <tr><td colspan="10"><div class="ag-state small"><mat-icon>inbox</mat-icon><p>No vendors match these filters.</p></div></td></tr> }
            </tbody>
            <tfoot><tr class="grand">
              <td>Total ({{ visible().length }} vendors)</td>
              <td class="num">{{ sum('current') | number:'1.2-2' }}</td><td class="num">{{ sum('d30') | number:'1.2-2' }}</td><td class="num">{{ sum('d60') | number:'1.2-2' }}</td>
              <td class="num warn">{{ sum('d90') | number:'1.2-2' }}</td><td class="num danger">{{ sum('over90') | number:'1.2-2' }}</td><td class="num">{{ sum('overdue') | number:'1.2-2' }}</td>
              <td class="num total">{{ sum('total') | number:'1.2-2' }}</td><td class="num">{{ sum('inPacks') | number:'1.0-0' }}</td><td></td>
            </tr></tfoot>
          </table>
        </div>
        }
      }
    }
  }
  `,
  styles: [`
    :host { display: block; }
    .sp { flex: 1; } .muted { color: var(--color-text-3); } .credit { color: var(--color-ok); }
    .ag-companies { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: var(--space-2); margin-bottom: var(--space-3); @media (max-width: 1400px) { grid-template-columns: repeat(4, minmax(0, 1fr)); } @media (max-width: 1000px) { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    .ag-co { display: flex; align-items: center; gap: 10px; padding: 10px 12px; text-align: left; cursor: pointer; font: inherit; color: var(--color-text); background: var(--color-surface); border: 2px solid var(--color-line); border-radius: var(--radius-lg); transition: border-color .15s, box-shadow .15s, opacity .15s; min-width: 0;
      .mark { width: 64px; height: 38px; flex: 0 0 auto; display: grid; place-items: center; background: #fff; border: 1px solid var(--color-line); border-radius: var(--radius-sm); overflow: hidden; img { max-width: 84%; max-height: 80%; width: auto; height: auto; object-fit: contain; } }
      .mono { width: 100%; height: 100%; display: grid; place-items: center; font-weight: 800; font-size: 11px; letter-spacing: .06em; color: hsl(var(--hue) 45% 32%); background: linear-gradient(135deg, hsl(var(--hue) 55% 94%), hsl(var(--hue) 45% 86%)); }
      .txt { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
      .n { font-weight: 600; font-size: var(--text-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .v { font-size: var(--text-md); font-weight: 700; line-height: 1.1; font-family: var(--font-mono); } .d { font-size: var(--text-xs); color: var(--color-text-3); white-space: nowrap; }
      .stale { font-style: normal; font-size: 10px; padding: 0 5px; border-radius: 999px; background: var(--color-ok-soft); color: var(--color-ok); &.amber { background: var(--color-warn-soft); color: #b45309; } &.red { background: var(--color-danger-soft, #fee2e2); color: var(--color-danger); } }
      &:hover { box-shadow: var(--shadow-sm); } &.active { border-color: var(--color-primary); background: var(--color-primary-soft); } &.dim { opacity: .6; } &.empty .mark { filter: grayscale(1); opacity: .7; } }
    .ag-upload-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); margin-bottom: var(--space-3); small { flex: 1; min-width: 260px; font-size: var(--text-xs); } }
    .ag-upload { display: inline-flex; align-items: center; gap: 8px; padding: 0 var(--space-4); height: 40px; cursor: pointer; font-weight: 600; color: #fff; background: var(--color-primary); border-radius: var(--radius-control); white-space: nowrap; &:hover { filter: brightness(1.05); } &.busy { opacity: .7; cursor: progress; } }
    .ag-snap { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin-bottom: var(--space-3); mat-icon { color: var(--color-text-3); }
      select { height: 36px; padding: 0 var(--space-3); border: 1px solid var(--color-line-strong); border-radius: var(--radius-control); background: var(--color-surface); color: var(--color-text); font: inherit; } }
    .ag-buckets { display: grid; grid-template-columns: 1.4fr repeat(5, 1fr); gap: var(--space-2); margin-bottom: var(--space-3); @media (max-width: 1100px) { grid-template-columns: repeat(3, 1fr); } }
    .ag-bucket { display: flex; flex-direction: column; gap: 4px; padding: var(--space-3) var(--space-4); text-align: left; cursor: pointer; font: inherit; color: var(--color-text); background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-md); border-top: 4px solid var(--c, var(--color-line-strong)); min-width: 0;
      .l { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .04em; color: var(--color-text-3); } .v { font-size: var(--text-xl); font-weight: 700; line-height: 1.1; white-space: nowrap; font-family: var(--font-mono); } .s { font-size: var(--text-xs); color: var(--color-text-3); }
      .bar { display: block; height: 5px; border-radius: 999px; background: var(--color-surface-2); overflow: hidden; i { display: block; height: 100%; background: var(--c); } }
      &:hover { box-shadow: var(--shadow-sm); } &.active { outline: 2px solid var(--c, var(--color-primary)); outline-offset: -1px; }
      &.total { --c: var(--color-primary); .v { font-size: var(--text-2xl); } }
      &.b0 { --c: var(--color-ok); } &.b1 { --c: #14b8a6; } &.b2 { --c: #f59e0b; } &.b3 { --c: #f97316; } &.b4 { --c: var(--color-danger); } }
    .ag-filters { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3); margin-bottom: var(--space-3); }
    .ag-search { display: flex; align-items: center; gap: 6px; height: 40px; padding: 0 var(--space-2) 0 var(--space-3); flex: 1 1 280px; max-width: 480px; border: 1px solid var(--color-line-strong); border-radius: var(--radius-control); background: var(--color-surface); mat-icon { color: var(--color-text-3); } input { flex: 1; border: 0; outline: 0; background: transparent; color: var(--color-text); font: inherit; } &:focus-within { border-color: var(--color-primary); } }
    .ag-check { display: inline-flex; align-items: center; gap: 6px; font-size: var(--text-sm); cursor: pointer; }
    .ag-table-wrap { background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-lg); overflow: auto; }
    .ag-table { width: 100%; border-collapse: collapse;
      th { text-align: left; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .04em; color: var(--color-text-3); padding: 10px var(--space-3); background: var(--color-surface-2); border-bottom: 1px solid var(--color-line); white-space: nowrap; position: sticky; top: 0; z-index: 1;
        &.sort { cursor: pointer; user-select: none; mat-icon { font-size: 16px; width: 16px; height: 16px; vertical-align: -3px; opacity: .6; } } }
      td { padding: 9px var(--space-3); border-bottom: 1px solid var(--color-line); vertical-align: middle; font-size: var(--text-sm); }
      .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .zero { color: var(--color-text-3); opacity: .5; } .warn:not(.zero) { color: #b45309; } .danger:not(.zero) { color: var(--color-danger); font-weight: 600; } .total { font-weight: 700; }
      tr.vend { cursor: pointer; &:hover td { background: var(--color-surface-2); } &.open td { background: var(--color-primary-soft); border-bottom-color: transparent; } &.risk td:first-child { box-shadow: inset 3px 0 0 var(--color-danger); } }
      tr.detail > td { padding: 0 var(--space-3) var(--space-3); background: var(--color-primary-soft); }
      tfoot tr.grand td { background: var(--color-surface-2); font-weight: 700; border-top: 2px solid var(--color-line-strong); }
      .chev { width: 72px; white-space: nowrap; mat-icon { color: var(--color-text-3); vertical-align: middle; } } }
    .ag-name { display: flex; flex-direction: column; small { color: var(--color-text-3); font-size: var(--text-xs); font-family: var(--font-mono); } }
    .ag-detail { display: grid; gap: 10px; padding: var(--space-3); background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-md);
      .pills { display: flex; flex-wrap: wrap; gap: 6px; }
      .packs { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: var(--text-sm); mat-icon { color: var(--color-primary); font-size: 18px; width: 18px; height: 18px; } small { color: var(--color-text-3); } }
      .lnk { font: inherit; font-family: var(--font-mono); font-weight: 600; color: var(--color-primary); background: none; border: 0; padding: 0; cursor: pointer; &:hover { text-decoration: underline; } } }
    .ag-hist { width: 100%; border-collapse: collapse; font-size: var(--text-xs); th { text-align: left; color: var(--color-text-3); padding: 4px 8px; border-bottom: 1px solid var(--color-line); } td { padding: 4px 8px; border-bottom: 1px solid var(--color-line); } .num { text-align: right; font-variant-numeric: tabular-nums; } tr.cur td { background: var(--color-primary-soft); font-weight: 600; } }
    .pill { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; color: #fff; background: var(--color-line-strong); &.b0 { background: var(--color-ok); } &.b1 { background: #14b8a6; } &.b2 { background: #f59e0b; } &.b3 { background: #f97316; } &.b4 { background: var(--color-danger); } }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: var(--text-xs); font-weight: 600; background: var(--color-surface-2); &.ok { background: var(--color-ok-soft); color: var(--color-ok); }
      &.detail { display: inline-flex; align-items: center; gap: 4px; background: var(--color-primary-soft); color: var(--color-primary); mat-icon { font-size: 14px; width: 14px; height: 14px; } } }
    .ag-view { display: inline-flex; border: 1px solid var(--color-line-strong); border-radius: var(--radius-control); overflow: hidden;
      button { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 12px; font: inherit; font-size: var(--text-sm); font-weight: 600; color: var(--color-text-2); background: var(--color-surface); border: 0; cursor: pointer; mat-icon { font-size: 18px; width: 18px; height: 18px; }
        & + button { border-left: 1px solid var(--color-line-strong); } &.on { background: var(--color-primary); color: #fff; } } }
    .ag-sel { height: 40px; padding: 0 var(--space-3); border: 1px solid var(--color-line-strong); border-radius: var(--radius-control); background: var(--color-surface); color: var(--color-text); font: inherit; }
    .mono { font-family: var(--font-mono); }
    .dt { white-space: nowrap; color: var(--color-text-2); }
    .ty { display: inline-block; padding: 0 6px; border-radius: 4px; font-size: 10px; font-weight: 700; letter-spacing: .03em; text-transform: uppercase; background: var(--color-surface-2); color: var(--color-text-2);
      &.ty-IN { background: #e0e7ff; color: #3730a3; } &.ty-CR, &.ty-PI { background: var(--color-ok-soft); color: var(--color-ok); } &.ty-DB, &.ty-IT { background: var(--color-warn-soft); color: #b45309; } &.ty-AD { background: #f3e8ff; color: #6b21a8; } }
    tr.creditrow td { color: var(--color-ok); }
    .ag-docs-head { display: flex; align-items: center; gap: 6px; font-size: var(--text-sm); color: var(--color-text-2); mat-icon { color: var(--color-primary); font-size: 18px; width: 18px; height: 18px; } }
    .ag-hist.docs { font-size: var(--text-sm); tfoot td { font-weight: 700; border-top: 2px solid var(--color-line-strong); } }
    .ag-inline { display: flex; align-items: center; gap: 8px; color: var(--color-text-3); font-size: var(--text-sm); }
    .ag-state { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); padding: var(--space-8) var(--space-4); color: var(--color-text-3); text-align: center; mat-icon { font-size: 44px; width: 44px; height: 44px; } h3 { margin: 0; color: var(--color-text); } p { margin: 0; } &.small { padding: var(--space-4); } }
  `]
})
export class FinanceCreditorsAgingComponent implements OnInit {
  private api = inject(CreditorPacksService);
  private toast = inject(ToastService);
  /** Start a payment for this vendor in a new pack for the company. */
  @Output() pay = new EventEmitter<{ company: string; vendor: ApAgingVendor }>();
  @Output() openBatch = new EventEmitter<number>();

  index = signal<ApAgingIndex | null>(null);
  company = signal<string | null>(null);
  snapshotId = signal<number | null>(null);
  aging = signal<ApAging | null>(null);
  loading = signal(false);
  uploading = signal(false);
  search = signal('');
  bucket = signal<number | null>(null);
  onlyOverdue = signal(false);
  hideCredits = signal(false);
  showZero = signal(false);
  expanded = signal<string | null>(null);
  history = signal<ApAgingHistoryRow[]>([]);
  historyLoading = signal(false);
  sortKey = signal<SortKey>('total');
  sortDir = signal<1 | -1>(-1);

  // Detail (per-document) view
  view = signal<'vendors' | 'documents'>('vendors');
  vendorDocs = signal<ApAgingVendorDocs | null>(null);
  vendorDocsLoading = signal(false);
  docs = signal<ApAgingDocument[]>([]);
  docsLoading = signal(false);
  docSearch = signal('');
  docType = signal('');
  docOverdueOnly = signal(false);
  docSortKey = signal<DocSortKey>('dueDate');
  docSortDir = signal<1 | -1>(1);
  docTypes = computed(() => {
    const m = new Map<string, { code: string; label: string; n: number }>();
    for (const d of this.docs()) { const e = m.get(d.docType); if (e) e.n++; else m.set(d.docType, { code: d.docType, label: d.typeLabel, n: 1 }); }
    return [...m.values()].sort((a, b) => b.n - a.n);
  });
  visibleDocs = computed(() => {
    const q = this.docSearch().trim().toLowerCase(); const b = this.bucket(); const t = this.docType();
    let rows = this.docs().filter(d => (!q || d.docNumber.toLowerCase().includes(q) || (d.vendorName ?? '').toLowerCase().includes(q) || (d.vendorCode ?? '').toLowerCase().includes(q))
      && (b === null || d.bucket === b) && (!t || d.docType === t) && (!this.docOverdueOnly() || d.daysOverdue > 0));
    const k = this.docSortKey(), dir = this.docSortDir();
    rows = [...rows].sort((x, y) => {
      const a = x[k] as any, c = y[k] as any;
      if (k === 'vendorName' || k === 'docNumber') return dir * String(a ?? '').localeCompare(String(c ?? ''));
      if (k === 'docDate' || k === 'dueDate') return dir * ((a ? new Date(a).getTime() : 0) - (c ? new Date(c).getTime() : 0));
      return dir * ((a ?? 0) - (c ?? 0));
    });
    return rows;
  });

  logo = companyWideLogo; monogram = companyMonogram; hue = companyHue;

  snapshot = computed(() => this.aging()?.snapshot ?? null);
  companyName = computed(() => this.index()?.companies.find(c => c.code === this.company())?.name ?? this.company() ?? '');
  visible = computed(() => {
    const a = this.aging(); if (!a) return [];
    const q = this.search().trim().toLowerCase(); const b = this.bucket();
    let rows = a.vendors.filter(v => (!q || v.name.toLowerCase().includes(q) || v.code.toLowerCase().includes(q))
      && (b === null || this.bucketOf(v, b) > 0) && (!this.onlyOverdue() || v.overdue > 0) && (!this.hideCredits() || v.total >= 0));
    const k = this.sortKey(), d = this.sortDir();
    rows = [...rows].sort((x, y) => k === 'name' ? d * x.name.localeCompare(y.name) : d * ((x[k] as number) - (y[k] as number)));
    return rows;
  });

  ngOnInit(): void { this.loadIndex(); }

  loadIndex(keep = true): void {
    this.api.apAgingSnapshots().subscribe({
      next: i => { this.index.set(i); if (keep && this.company()) { const latest = this.latestFor(this.company()!); if (latest && latest.id !== this.snapshotId()) this.loadSnapshot(latest.id); } },
      error: () => this.toast.error("Couldn't load the creditors aging.")
    });
  }
  snapshotsFor(code: string): ApAgingSnapshot[] { return (this.index()?.snapshots ?? []).filter(s => s.companyCode === code); }
  latestFor(code: string): ApAgingSnapshot | undefined { return this.snapshotsFor(code)[0]; }
  staleDays(s: ApAgingSnapshot): number { return Math.max(0, Math.floor((Date.now() - new Date(s.asOfDate).getTime()) / 86400000)); }
  staleLevel(s: ApAgingSnapshot): string { const d = this.staleDays(s); return d > 14 ? 'red' : d > 7 ? 'amber' : ''; }
  clampPct(p: number): number { return Math.max(0, Math.min(100, p)); }
  bucketOf(v: ApAgingVendor, i: number): number { return [v.current, v.d30, v.d60, v.d90, v.over90][i] ?? 0; }
  packTip(v: ApAgingVendor): string { return (v.packs ?? []).map(p => `${p.batchNumber} · ${p.status}`).join('\n'); }
  sum(k: keyof ApAgingVendor): number { return this.visible().reduce((t, v) => t + ((v[k] as number) || 0), 0); }
  sortBy(k: SortKey): void { if (this.sortKey() === k) this.sortDir.set(this.sortDir() === 1 ? -1 : 1); else { this.sortKey.set(k); this.sortDir.set(k === 'name' ? 1 : -1); } }
  sortIcon(k: SortKey): string { return this.sortKey() !== k ? 'unfold_more' : this.sortDir() === 1 ? 'expand_less' : 'expand_more'; }
  docSortBy(k: DocSortKey): void { if (this.docSortKey() === k) this.docSortDir.set(this.docSortDir() === 1 ? -1 : 1); else { this.docSortKey.set(k); this.docSortDir.set(k === 'total' || k === 'daysOverdue' ? -1 : 1); } }
  docSortIcon(k: DocSortKey): string { return this.docSortKey() !== k ? 'unfold_more' : this.docSortDir() === 1 ? 'expand_less' : 'expand_more'; }
  sumDocs(): number { return this.visibleDocs().reduce((t, d) => t + (d.total || 0), 0); }

  setView(v: 'vendors' | 'documents'): void {
    this.view.set(v);
    if (v === 'documents' && !this.docs().length) this.loadDocs();
  }
  private loadDocs(): void {
    const id = this.snapshotId(); if (!id || !this.snapshot()?.hasDetail) return;
    this.docsLoading.set(true);
    this.api.apAgingDocuments(id).subscribe({ next: d => { this.docs.set(d); this.docsLoading.set(false); }, error: () => { this.docsLoading.set(false); this.toast.error("Couldn't load the documents."); } });
  }
  /** From the documents view: jump to the vendor row and expand it. */
  openVendor(code: string): void {
    this.view.set('vendors'); this.search.set(''); this.bucket.set(null);
    const v = this.aging()?.vendors.find(x => x.code === code);
    if (v) { this.expanded.set(null); this.toggle(v); }
  }

  pickCompany(code: string): void {
    this.company.set(code); this.expanded.set(null); this.bucket.set(null); this.aging.set(null); this.view.set('vendors'); this.docs.set([]);
    const latest = this.latestFor(code); if (latest) this.loadSnapshot(latest.id); else this.snapshotId.set(null);
  }
  loadSnapshot(id: number): void {
    this.snapshotId.set(id); this.loading.set(true); this.expanded.set(null); this.docs.set([]); this.vendorDocs.set(null);
    this.api.apAging(id, undefined, !this.showZero()).subscribe({ next: a => { this.aging.set(a); this.loading.set(false); if (!a.snapshot.hasDetail) this.view.set('vendors'); else if (this.view() === 'documents') this.loadDocs(); }, error: () => { this.loading.set(false); this.toast.error("Couldn't build the aging."); } });
  }
  toggleZero(v: boolean): void { this.showZero.set(v); const id = this.snapshotId(); if (id) this.loadSnapshot(id); }
  toggle(v: ApAgingVendor): void {
    if (this.expanded() === v.code) { this.expanded.set(null); return; }
    this.expanded.set(v.code); this.history.set([]); this.historyLoading.set(true); this.vendorDocs.set(null);
    this.api.apAgingHistory(this.company()!, v.code).subscribe({ next: h => { this.history.set(h); this.historyLoading.set(false); }, error: () => this.historyLoading.set(false) });
    const id = this.snapshotId();
    if (id && this.snapshot()?.hasDetail) {
      this.vendorDocsLoading.set(true);
      this.api.apAgingVendorDocs(id, v.code).subscribe({ next: d => { this.vendorDocs.set(d); this.vendorDocsLoading.set(false); }, error: () => this.vendorDocsLoading.set(false) });
    }
  }

  upload(ev: Event): void {
    const input = ev.target as HTMLInputElement; const files = Array.from(input.files ?? []); input.value = '';
    if (!files.length) return;
    this.uploading.set(true);
    const results: string[] = []; const errors: string[] = [];
    const next = (i: number) => {
      if (i >= files.length) {
        this.uploading.set(false);
        if (results.length) this.toast.done(`Imported ${results.join(', ')}`);
        if (errors.length) this.toast.error(errors.join(' · '));
        this.loadIndex(true);
        if (!this.company() && results.length) { /* leave the user to pick */ }
        return;
      }
      // If a company is selected and only one file is given, assume it's for that company unless the header says otherwise.
      this.api.apAgingImport(files[i], undefined).subscribe({
        next: s => { results.push(`${s.companyCode} (${s.activeVendorCount} vendors${s.hasDetail ? ', ' + s.documentCount + ' docs' : ''})`); if (!this.company()) this.company.set(s.companyCode); next(i + 1); },
        error: e => { errors.push(`${files[i].name}: ${e?.error?.message || 'failed'}`); next(i + 1); }
      });
    };
    next(0);
  }
  exportXlsx(): void {
    const id = this.snapshotId(); if (!id) return;
    this.api.apAgingExport(id, !this.showZero()).subscribe({ next: b => { const url = URL.createObjectURL(b); const a = document.createElement('a'); a.href = url; a.download = `Creditors-aging-${this.company()}-${this.snapshot()?.asOfDate.slice(0, 10)}.xlsx`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }, error: () => this.toast.error("Couldn't export.") });
  }
  deleteSnapshot(): void {
    const s = this.snapshot(); if (!s) return;
    if (!confirm(`Delete the ${this.companyName()} aging as at ${new Date(s.asOfDate).toLocaleDateString()}?`)) return;
    this.api.apAgingDelete(s.id).subscribe({ next: () => { this.toast.done('Snapshot deleted'); this.aging.set(null); this.snapshotId.set(null); this.loadIndex(false); setTimeout(() => this.pickCompany(this.company()!), 300); }, error: () => this.toast.error("Couldn't delete.") });
  }
}
