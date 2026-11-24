import { Component, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { ToastService } from '../../ui/toast.service';
import { CreditorPacksService, PaymentSchedule, ScheduleBatch, ScheduleItem, InProgressBatch, InProgressDoc } from '../../services/creditor-packs.service';
import { PackPreviewDialogComponent } from './pack-preview-dialog.component';
import { ReconPreviewDialogComponent } from './recon-preview-dialog.component';

interface PayRun { date: string; label: string; isNext: boolean; isPast: boolean; batches: ScheduleBatch[]; amount: number; }

/**
 * Payment Schedule — the treasurer's desk. Only batches that have cleared the pack process (prepared → checked →
 * accountant → director signed) appear here, booked on a pay-run (Mondays & Wednesdays).
 * Flow per batch: download bank file → Loaded on bank → Mark paid → upload POP per payment → Close.
 */
@Component({
  selector: 'app-finance-payment-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule, MatProgressSpinnerModule],
  template: `
  <input #popInput type="file" accept="application/pdf,image/*" hidden (change)="onPopFile($event)">

  @if (loading()) { <div class="ps-loading"><mat-spinner diameter="36"></mat-spinner><p>Loading the payment schedule…</p></div> }
  @else if (!data()) { <div class="ps-empty"><mat-icon>cloud_off</mat-icon><p>Couldn't load the schedule.</p><button mat-stroked-button (click)="load()">Retry</button></div> }
  @else {
  <div class="ps">
    <!-- Totals -->
    <div class="ps-kpis">
      <button class="ps-kpi ip" [class.on]="filter() === 'InProgress'" (click)="toggleFilter('InProgress')">
        <div class="k-head"><mat-icon>hourglass_top</mat-icon> In progress</div>
        <div class="k-val">{{ (data()!.totals.inProgress ?? 0) | currency:'ZAR':'R':'1.0-0' }}</div>
        <div class="k-sub">{{ data()!.totals.inProgressCount ?? 0 }} pack{{ data()!.totals.inProgressCount === 1 ? '' : 's' }} not yet signed</div>
      </button>
      <button class="ps-kpi" [class.on]="filter() === 'Approved'" (click)="toggleFilter('Approved')">
        <div class="k-head"><mat-icon>account_balance</mat-icon> To load on bank</div>
        <div class="k-val">{{ data()!.totals.toLoad | currency:'ZAR':'R':'1.0-0' }}</div>
        <div class="k-sub">{{ data()!.totals.toLoadCount }} signed batch{{ data()!.totals.toLoadCount === 1 ? '' : 'es' }}</div>
      </button>
      <button class="ps-kpi" [class.on]="filter() === 'LoadedOnBank'" (click)="toggleFilter('LoadedOnBank')">
        <div class="k-head"><mat-icon>schedule_send</mat-icon> Loaded · awaiting release</div>
        <div class="k-val">{{ data()!.totals.loaded | currency:'ZAR':'R':'1.0-0' }}</div>
        <div class="k-sub">{{ data()!.totals.loadedCount }} batch{{ data()!.totals.loadedCount === 1 ? '' : 'es' }} on the bank</div>
      </button>
      <button class="ps-kpi" [class.on]="filter() === 'Paid'" (click)="toggleFilter('Paid')">
        <div class="k-head"><mat-icon>receipt_long</mat-icon> Paid · POP outstanding</div>
        <div class="k-val">{{ data()!.totals.awaitingPop | currency:'ZAR':'R':'1.0-0' }}</div>
        <div class="k-sub">{{ data()!.totals.awaitingPopCount }} batch{{ data()!.totals.awaitingPopCount === 1 ? '' : 'es' }} to close</div>
      </button>
      <div class="ps-kpi next">
        <div class="k-head"><mat-icon>event</mat-icon> Next pay-run</div>
        <div class="k-val">{{ data()!.nextPayDay | date:'EEE d MMM' }}</div>
        <div class="k-sub">We pay Mondays &amp; Wednesdays @if (data()!.totals.overdue > 0) { · <b class="bad">{{ data()!.totals.overdue }} overdue</b> }</div>
      </div>
    </div>

    <div class="ps-toolbar">
      <div class="ps-flow"><span>Prepared</span><mat-icon>chevron_right</mat-icon><span>Checked</span><mat-icon>chevron_right</mat-icon><span>Accountant</span><mat-icon>chevron_right</mat-icon><span>Director signed</span><mat-icon>chevron_right</mat-icon><b>Payment schedule</b><mat-icon>chevron_right</mat-icon><span>Loaded</span><mat-icon>chevron_right</mat-icon><span>Paid + POP</span><mat-icon>chevron_right</mat-icon><span>Closed</span></div>
      <div class="ps-tools">
        <select [ngModel]="company()" (ngModelChange)="company.set($event)"><option value="">All companies</option>@for (c of companies(); track c.code) { <option [value]="c.code">{{ c.name }}</option> }</select>
        @if (filter() || company()) { <button mat-button (click)="filter.set(''); company.set('')"><mat-icon>filter_alt_off</mat-icon> Clear</button> }
        <button mat-icon-button (click)="load()" matTooltip="Refresh"><mat-icon>refresh</mat-icon></button>
      </div>
    </div>

    @if (showInProgress() && (inProgress().length || filter() === 'InProgress')) {
      <section class="run ip-run">
        <header class="run-head">
          <div class="run-date"><mat-icon>hourglass_top</mat-icon><b>In progress</b><span class="tag ip">Not signed yet</span></div>
          <div class="run-sum">{{ inProgress().length }} pack{{ inProgress().length === 1 ? '' : 's' }} · <b>{{ inProgressAmount() | currency:'ZAR':'R':'1.2-2' }}</b></div>
        </header>
        <p class="ip-note"><mat-icon>visibility</mat-icon> For information only. These packs are still with the preparer, the accountant or a director, so there is nothing to load yet. Each one moves to a pay-run once a director signs it.</p>
        @for (b of inProgress(); track b.id) {
          <article class="batch ip" [class.open]="open() === -b.id">
            <div class="b-row" (click)="toggle(-b.id)">
              <div class="b-co"><span class="code">{{ b.companyCode }}</span><div><b>{{ b.companyName }}</b><small>{{ b.batchNumber }} · {{ b.paymentTypeTitle }}</small></div></div>
              <div class="b-amt"><b>{{ b.amount | currency:'ZAR':'R':'1.2-2' }}</b><small>{{ b.itemCount }} payment{{ b.itemCount === 1 ? '' : 's' }} · {{ b.documentCount }} document{{ b.documentCount === 1 ? '' : 's' }}</small></div>
              <ol class="ip-steps" [attr.aria-label]="'Stage: ' + b.statusTitle">
                @for (s of ipSteps; track s; let k = $index) {
                  <li [class.done]="k < b.stage" [class.cur]="k === b.stage" [class.back]="k === b.stage && b.sentBack">{{ s }}</li>
                }
              </ol>
              <div class="b-status">
                <span class="pill" [class.back]="b.sentBack" [class.cur]="!b.sentBack">{{ b.statusTitle }}</span>
                <small>{{ whereNow(b) }}</small>
              </div>
              <div class="b-actions" (click)="$event.stopPropagation()">
                <button mat-icon-button aria-label="Preview the full pack" matTooltip="Preview the full pack: approval sheet and every document" (click)="previewPack(b)"><mat-icon>visibility</mat-icon></button>
                <button mat-icon-button matTooltip="Open the pack" (click)="openPack(b)"><mat-icon>open_in_new</mat-icon></button>
                <mat-icon class="chev">{{ open() === -b.id ? 'expand_less' : 'expand_more' }}</mat-icon>
              </div>
            </div>
            @if (open() === -b.id) {
              <div class="b-body">
                <div class="b-meta">
                  <span><mat-icon>person</mat-icon> Prepared by {{ b.preparedByName || '—' }} · {{ b.createdAt | date:'d MMM HH:mm' }}</span>
                  @if (b.submittedAt) { <span><mat-icon>send</mat-icon> Submitted {{ b.submittedAt | date:'d MMM HH:mm' }}</span> }
                  @if (b.accountantApprovedAt) { <span><mat-icon>fact_check</mat-icon> Accountant {{ b.accountantName }} approved {{ b.accountantApprovedAt | date:'d MMM HH:mm' }}</span> }
                  <span><mat-icon>event</mat-icon> Earliest pay-run {{ b.expectedPayDate | date:'EEE d MMM' }} (once signed)</span>
                </div>
                @if (b.sentBack && b.returnReason) { <p class="ip-back"><mat-icon>reply</mat-icon> {{ b.returnReason }}</p> }
                @if (b.batchDocuments.length) {
                  <div class="ip-docs"><span class="lbl">Pack documents</span>
                    @for (d of b.batchDocuments; track d.id) { <button class="doc" (click)="previewDoc(b, d)" [matTooltip]="d.originalFileName || d.title"><mat-icon>{{ d.textMethod === 'sheet' ? 'table_view' : 'picture_as_pdf' }}</mat-icon>{{ d.title }}</button> }
                  </div>
                }
                <table class="items">
                  <thead><tr><th>Beneficiary</th><th>Invoice(s) / reference</th><th class="r">Amount</th><th>Uploaded documents</th><th class="eye"><span class="sr">Preview</span></th></tr></thead>
                  <tbody>
                    @for (i of b.items; track i.id) {
                      <tr>
                        <td><b>{{ i.supplierName }}</b>@if (i.complianceTitle) { <span class="cmp-tag">Compliance · {{ i.complianceTitle }}</span> }@if (i.description) { <small>{{ i.description }}</small> }@if (i.decisionStatus === 'Queried') { <small class="warn">Queried</small> }</td>
                        <td>{{ i.invoiceNumbers || '—' }}</td>
                        <td class="r"><b>{{ i.amount | currency:'ZAR':'R':'1.2-2' }}</b></td>
                        <td>
                          <div class="ip-docs">
                            @for (d of i.documents; track d.id) { <button class="doc" (click)="previewDoc(b, d, i.supplierName)" [matTooltip]="(d.originalFileName || d.title) + (d.uploadedByName ? ' · ' + d.uploadedByName : '')"><mat-icon>{{ d.textMethod === 'sheet' ? 'table_view' : 'picture_as_pdf' }}</mat-icon>{{ d.title }}</button> }
                            @empty { <span class="muted">Nothing uploaded yet</span> }
                          </div>
                        </td>
                        <td class="eye">@if (i.documents.length) { <button mat-icon-button aria-label="Preview this payment" matTooltip="Preview this payment: approval sheet and its documents" (click)="previewItem(b, i)"><mat-icon>visibility</mat-icon></button> }</td>
                      </tr>
                    } @empty { <tr><td colspan="5" class="muted">No payments on this pack yet.</td></tr> }
                  </tbody>
                </table>
              </div>
            }
          </article>
        } @empty { <div class="ps-empty"><mat-icon>task_alt</mat-icon><p>No packs in progress@if (company()) { for this company }.</p></div> }
      </section>
    }

    @if (filter() !== 'InProgress' && runs().length === 0) {
      <div class="ps-empty"><mat-icon>event_available</mat-icon><p>Nothing on the schedule@if (filter() || company()) { for this filter }. Batches land here the moment a director signs them.</p></div>
    }

    @for (run of (filter() === 'InProgress' ? [] : runs()); track run.date) {
      <section class="run" [class.next]="run.isNext" [class.past]="run.isPast">
        <header class="run-head">
          <div class="run-date"><mat-icon>{{ run.isPast ? 'history' : 'event' }}</mat-icon><b>{{ run.label }}</b>@if (run.isNext) { <span class="tag next">Next pay-run</span> }@if (run.isPast) { <span class="tag past">Past pay-run</span> }</div>
          <div class="run-sum">{{ run.batches.length }} batch{{ run.batches.length === 1 ? '' : 'es' }} · <b>{{ run.amount | currency:'ZAR':'R':'1.2-2' }}</b></div>
        </header>

        @for (b of run.batches; track b.id) {
          <article class="batch" [class.open]="open() === b.id" [class]="'batch st-' + b.status">
            <div class="b-row" (click)="toggle(b.id)">
              <div class="b-co"><span class="code">{{ b.companyCode }}</span><div><b>{{ b.companyName }}</b><small>{{ b.batchNumber }} · {{ b.paymentTypeTitle }}</small></div></div>
              <div class="b-amt"><b>{{ b.approvedAmount | currency:'ZAR':'R':'1.2-2' }}</b><small>{{ b.approvedItems }} payment{{ b.approvedItems === 1 ? '' : 's' }}</small></div>
              <div class="b-sign"><mat-icon>verified</mat-icon><div><b>{{ b.directorName || '—' }}</b><small>signed {{ b.directorSignedAt | date:'d MMM HH:mm' }}</small></div></div>
              <div class="b-status">
                <span class="pill" [class]="'pill s-' + b.status">{{ b.statusTitle }}</span>
                @if (b.status === 'Paid') { <small [class.bad]="b.popMissing > 0">POP {{ b.popDone }}/{{ b.approvedItems }}</small> }
                @if (b.overdue) { <small class="bad">Overdue — not paid on its run</small> }
              </div>
              <div class="b-actions" (click)="$event.stopPropagation()">
                @if (b.can.bankFile) { <button mat-icon-button matTooltip="Download bank file (CSV)" (click)="bankFile(b)"><mat-icon>download</mat-icon></button> }
                @if (b.can.markLoaded) { <button mat-flat-button color="primary" [disabled]="busy()" (click)="setStatus(b, 'LoadedOnBank')"><mat-icon>account_balance</mat-icon> Loaded on bank</button> }
                @if (b.can.markPaid && b.status === 'LoadedOnBank') { <button mat-flat-button color="primary" [disabled]="busy()" (click)="setStatus(b, 'Paid')"><mat-icon>price_check</mat-icon> Mark paid</button> }
                @if (b.can.close) { <button mat-flat-button color="primary" [disabled]="busy() || b.popMissing > 0 || b.openPrepayments > 0" [matTooltip]="b.popMissing > 0 ? 'Upload proof of payment for every payment first' : (b.openPrepayments > 0 ? 'Prepayments still open (tax invoice + GRV)' : 'Close the batch')" (click)="setStatus(b, 'Closed')"><mat-icon>inventory</mat-icon> Close</button> }
                <button mat-icon-button aria-label="Preview the full pack" matTooltip="Preview the full pack: approval sheet and every document" (click)="previewPack(b)"><mat-icon>visibility</mat-icon></button>
                <button mat-icon-button matTooltip="Open the pack" (click)="openPack(b)"><mat-icon>open_in_new</mat-icon></button>
                <mat-icon class="chev">{{ open() === b.id ? 'expand_less' : 'expand_more' }}</mat-icon>
              </div>
            </div>

            @if (open() === b.id) {
              <div class="b-body">
                <div class="b-meta">
                  <span><mat-icon>person</mat-icon> Prepared by {{ b.preparedByName || '—' }}</span>
                  <span><mat-icon>fact_check</mat-icon> Accountant {{ b.accountantName || '—' }}</span>
                  @if (b.bankExportedAt) { <span><mat-icon>download_done</mat-icon> Bank file {{ b.bankExportedAt | date:'d MMM HH:mm' }}</span> }
                  @if (b.paidAt) { <span><mat-icon>price_check</mat-icon> Paid {{ b.paidAt | date:'d MMM HH:mm' }}</span> }
                  @if (b.can.reschedule) {
                    <span class="resched"><mat-icon>edit_calendar</mat-icon> Move to
                      <select [ngModel]="b.scheduledPayDate | date:'yyyy-MM-dd'" (ngModelChange)="reschedule(b, $event)" [disabled]="busy()">
                        @for (d of data()!.payDays; track d) { <option [value]="d | date:'yyyy-MM-dd'">{{ d | date:'EEE d MMM' }}</option> }
                      </select>
                    </span>
                  }
                </div>
                <table class="items">
                  <thead><tr><th>Beneficiary</th><th>Invoice(s) / reference</th><th>Bank</th><th class="r">Amount</th><th>Proof of payment</th><th class="eye"><span class="sr">Preview</span></th></tr></thead>
                  <tbody>
                    @for (i of b.items; track i.id) {
                      <tr>
                        <td><b>{{ i.supplierName }}</b>@if (i.complianceTitle) { <span class="cmp-tag">Compliance · {{ i.complianceTitle }}</span> }@if (i.description) { <small>{{ i.description }}</small> }</td>
                        <td>{{ i.invoiceNumbers || '—' }}@if (i.paymentReference) { <small>ref {{ i.paymentReference }}</small> }</td>
                        <td>{{ i.bankName || '—' }}@if (i.accountNumber) { <small>{{ i.accountNumber }}@if (i.branchCode) { · {{ i.branchCode }} }</small> }</td>
                        <td class="r"><b>{{ i.amount | currency:'ZAR':'R':'1.2-2' }}</b></td>
                        <td class="pop">
                          @if (i.hasPop) {
                            <span class="ok"><mat-icon>task_alt</mat-icon> Uploaded</span>
                            @if (i.popDocId) { <button mat-icon-button matTooltip="View POP" (click)="viewPop(b, i)"><mat-icon>visibility</mat-icon></button> }
                          } @else if (b.status === 'Paid' && b.can.uploadPop) {
                            <button mat-stroked-button [disabled]="busy()" (click)="pickPop(b, i)"><mat-icon>upload_file</mat-icon> Upload POP</button>
                          } @else if (b.status === 'Paid') { <span class="bad">Missing</span> }
                          @else { <span class="muted">after payment</span> }
                          @if (i.prepaymentOpen) { <small class="warn">Prepayment open</small> }
                        </td>
                        <td class="eye"><button mat-icon-button aria-label="Preview this payment" matTooltip="Preview this payment: approval sheet and its documents" (click)="previewItem(b, i)"><mat-icon>visibility</mat-icon></button></td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </article>
        }
      </section>
    }
  </div>
  }
  `,
  styles: [`
    :host { display:block; }
    .cmp-tag { display:inline-block; margin-left: var(--space-2); padding: 1px var(--space-2); border-radius: 999px; font-size: var(--text-xs); font-weight: 600; background: var(--color-cat-purple-soft); color: var(--color-cat-purple); white-space: nowrap; }
    .ps { display:flex; flex-direction:column; gap: var(--space-4); }
    .ps-loading, .ps-empty { display:flex; flex-direction:column; align-items:center; gap:10px; padding:48px 16px; color: var(--color-text-2); text-align:center; mat-icon { font-size:40px; width:40px; height:40px; } p { margin:0; } }
    .ps-kpis { display:grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap: var(--space-3); }
    .ps-kpi.ip .k-head mat-icon { color: var(--color-info); }
    .items td.eye, .items th.eye { width:1%; padding:2px 0; text-align:right; }
    .sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
    .ip-run { border-style: dashed; }
    .tag.ip { background: var(--color-info-soft); color: var(--color-info); }
    .ip-note { display:flex; align-items:center; gap: var(--space-2); margin:0; padding: var(--space-2) var(--space-4); font-size: var(--text-sm); color: var(--color-text-2); border-bottom:1px solid var(--color-line); mat-icon { font-size:16px; width:16px; height:16px; flex-shrink:0; } }
    .ip-steps { list-style:none; display:flex; gap:2px; margin:0; padding:0; flex-wrap:wrap;
      li { font-size: var(--text-xs); padding:2px var(--space-2); border-radius:999px; background: var(--color-surface-3); color: var(--color-text-3); white-space:nowrap;
        &.done { background: var(--color-ok-soft); color: var(--color-ok); }
        &.cur { background: var(--color-info-soft); color: var(--color-info); font-weight:700; }
        &.back { background: var(--color-warn-soft); color: var(--color-warn); } } }
    .pill.cur { background: var(--color-info-soft); color: var(--color-info); } .pill.back { background: var(--color-warn-soft); color: var(--color-warn); }
    .ip-back { display:flex; align-items:flex-start; gap: var(--space-2); margin:0 0 var(--space-3); padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); background: var(--color-warn-soft); color: var(--color-warn); font-size: var(--text-sm); mat-icon { font-size:16px; width:16px; height:16px; flex-shrink:0; } }
    .ip-docs { display:flex; flex-wrap:wrap; align-items:center; gap: var(--space-1); .lbl { font-size: var(--text-xs); text-transform:uppercase; letter-spacing:.4px; color: var(--color-text-3); margin-right: var(--space-2); } }
    .b-body > .ip-docs { margin-bottom: var(--space-3); }
    .doc { display:inline-flex; align-items:center; gap:4px; font: inherit; font-size: var(--text-xs); padding:3px var(--space-2); border:1px solid var(--color-line); border-radius: var(--radius-sm); background: var(--color-surface); color: var(--color-text); cursor:pointer;
      mat-icon { font-size:14px; width:14px; height:14px; color: var(--color-danger); } &:hover { border-color: var(--color-primary); color: var(--color-primary); } }
    .ps-kpi { text-align:left; background: var(--color-surface); border:1px solid var(--color-line); border-radius: var(--radius-lg); padding:14px 16px; cursor:pointer; font: inherit; color: inherit; transition: border-color .15s, transform .15s;
      &:hover { border-color: var(--color-primary); } &.on { border-color: var(--color-primary); background: var(--color-primary-soft); } &.next { cursor: default; }
      .k-head { display:flex; align-items:center; gap:6px; font-size:var(--text-sm); color: var(--color-text-2); text-transform: uppercase; letter-spacing:.4px; mat-icon { font-size:18px; width:18px; height:18px; } }
      .k-val { font-size:1.5rem; font-weight:800; margin:6px 0 2px; font-variant-numeric: tabular-nums; }
      .k-sub { font-size:var(--text-sm); color: var(--color-text-2); } }
    .bad { color: var(--color-danger); } .warn { color: var(--color-warn); } .ok { color: var(--color-ok); display:inline-flex; align-items:center; gap:4px; mat-icon { font-size:18px; width:18px; height:18px; } } .muted { color: var(--color-text-3); }
    .ps-toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
    .ps-flow { display:flex; align-items:center; gap:2px; font-size:var(--text-xs); color: var(--color-text-3); flex-wrap:wrap; mat-icon { font-size:16px; width:16px; height:16px; } b { color: var(--color-primary); } }
    .ps-tools { display:flex; align-items:center; gap:6px; select { font: inherit; font-size:var(--text-md); padding:6px 10px; border:1px solid var(--color-line); border-radius:8px; background: var(--color-surface); color: var(--color-text); } }

    .run { background: var(--color-surface); border:1px solid var(--color-line); border-radius: var(--radius-lg); overflow:hidden;
      &.next { border-color: var(--color-primary); } &.past { border-color: var(--color-danger); } }
    .run-head { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background: var(--color-surface-2); border-bottom:1px solid var(--color-line); flex-wrap:wrap; gap:8px; }
    .run-date { display:flex; align-items:center; gap:8px; font-size:var(--text-lg); }
    .tag { font-size:var(--text-xs); font-weight:700; text-transform:uppercase; letter-spacing:.5px; padding:2px 8px; border-radius:10px; &.next { background: var(--color-primary); color: var(--color-on-primary); } &.past { background: var(--color-danger-soft); color: var(--color-danger); } }
    .run-sum { color: var(--color-text-2); font-size:var(--text-md); }

    .batch { border-bottom:1px solid var(--color-line); &:last-child { border-bottom:0; } &.open { background: var(--color-canvas); } }
    .b-row { display:grid; grid-template-columns: 1.6fr 1fr 1.2fr 1.2fr auto; gap:12px; align-items:center; padding:12px 16px; cursor:pointer; &:hover { background: var(--color-surface-2); } }
    .b-co { display:flex; align-items:center; gap:10px; .code { width:44px; height:44px; border-radius:10px; background: var(--color-primary-soft); color: var(--color-primary); font-weight:800; font-size:var(--text-sm); display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; } div { display:flex; flex-direction:column; min-width:0; } small { color: var(--color-text-2); font-size:var(--text-xs); } }
    .b-amt { display:flex; flex-direction:column; font-variant-numeric: tabular-nums; small { color: var(--color-text-2); font-size:var(--text-xs); } }
    .b-sign { display:flex; align-items:center; gap:6px; mat-icon { color: var(--color-ok); } div { display:flex; flex-direction:column; } small { color: var(--color-text-2); font-size:var(--text-xs); } }
    .b-status { display:flex; flex-direction:column; gap:3px; small { font-size:var(--text-xs); } }
    .pill { display:inline-block; padding:3px 10px; border-radius:12px; font-size:var(--text-xs); font-weight:700; width:max-content; background: var(--color-surface-3); color: var(--color-text-2);
      &.s-Approved { background: var(--color-primary-soft); color: var(--color-primary); } &.s-LoadedOnBank { background: var(--color-warn-soft); color: var(--color-warn); } &.s-Paid { background: var(--color-ok-soft); color: var(--color-ok); } }
    .b-actions { display:flex; align-items:center; gap:4px; .chev { color: var(--color-text-3); } }
    .b-body { padding: 4px 16px 16px 70px; }
    .b-meta { display:flex; flex-wrap:wrap; gap:16px; font-size:var(--text-sm); color: var(--color-text-2); margin-bottom:10px; span { display:inline-flex; align-items:center; gap:4px; } mat-icon { font-size:16px; width:16px; height:16px; }
      .resched select { font: inherit; font-size:var(--text-sm); padding:3px 6px; border:1px solid var(--color-line); border-radius:6px; background: var(--color-surface); color: var(--color-text); margin-left:4px; } }
    .items { width:100%; border-collapse:collapse; font-size:var(--text-md); th { text-align:left; font-size:var(--text-xs); text-transform:uppercase; letter-spacing:.4px; color: var(--color-text-3); padding:6px 8px; border-bottom:1px solid var(--color-line); } td { padding:8px; border-bottom:1px solid var(--color-line); vertical-align:top; small { display:block; color: var(--color-text-2); font-size:var(--text-xs); } } .r { text-align:right; font-variant-numeric: tabular-nums; } .pop { white-space:nowrap; } tr:last-child td { border-bottom:0; } }
    @media (max-width: 1100px) { .ps-kpis { grid-template-columns: repeat(3, 1fr); } .b-row { grid-template-columns: 1fr 1fr; } .b-body { padding-left:16px; } }
  `]
})
export class FinancePaymentScheduleComponent implements OnInit {
  private api = inject(CreditorPacksService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  @ViewChild('popInput') popInput?: ElementRef<HTMLInputElement>;

  data = signal<PaymentSchedule | null>(null);
  loading = signal(true);
  busy = signal(false);
  open = signal<number | null>(null);
  filter = signal<'' | 'InProgress' | 'Approved' | 'LoadedOnBank' | 'Paid'>('');
  readonly ipSteps = ['Preparing', 'Accountant', 'Director', 'Signed'];
  inProgress = computed(() => { const co = this.company(); return (this.data()?.inProgress ?? []).filter(b => !co || b.companyCode === co); });
  inProgressAmount = computed(() => this.inProgress().reduce((s, b) => s + b.amount, 0));
  showInProgress = computed(() => this.filter() === '' || this.filter() === 'InProgress');
  company = signal('');
  private pendingPop: { b: ScheduleBatch; i: ScheduleItem } | null = null;

  companies = computed(() => {
    const seen = new Map<string, string>();
    for (const b of [...(this.data()?.batches ?? []), ...(this.data()?.inProgress ?? [])]) seen.set(b.companyCode, b.companyName);
    return [...seen].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name));
  });

  runs = computed<PayRun[]>(() => {
    const d = this.data(); if (!d) return [];
    const f = this.filter(), co = this.company();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const next = new Date(d.nextPayDay); next.setHours(0, 0, 0, 0);
    const groups = new Map<string, ScheduleBatch[]>();
    for (const b of d.batches) {
      if (f && b.status !== f) continue;
      if (co && b.companyCode !== co) continue;
      const k = b.scheduledPayDate.slice(0, 10);
      (groups.get(k) ?? groups.set(k, []).get(k)!).push(b);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, batches]) => {
      const dt = new Date(date + 'T00:00:00');
      return {
        date, batches, amount: batches.reduce((s, b) => s + b.approvedAmount, 0),
        label: dt.toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
        isNext: dt.getTime() === next.getTime(),
        isPast: dt < today && batches.some(b => b.status !== 'Paid')
      };
    });
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(!this.data());
    this.api.schedule().subscribe({ next: d => { this.data.set(d); this.loading.set(false); }, error: () => { this.loading.set(false); this.toast.error("Couldn't load the payment schedule."); } });
  }

  toggle(id: number): void { this.open.set(this.open() === id ? null : id); }
  toggleFilter(f: 'InProgress' | 'Approved' | 'LoadedOnBank' | 'Paid'): void { this.filter.set(this.filter() === f ? '' : f); }

  /** Who the in-progress pack is waiting on, in plain words. */
  whereNow(b: InProgressBatch): string {
    switch (b.status) {
      case 'Draft': return 'Being prepared';
      case 'ChecksFailed': return 'Checks failed: back with the preparer';
      case 'QueriedByAccountant': return 'Queried by the accountant: back with the preparer';
      case 'QueriedByDirector': return 'Queried by a director: back with the preparer';
      case 'AwaitingAccountant': return `Waiting on ${b.requestedApproverNames || 'the accountant'}`;
      case 'AwaitingDirector': return `Waiting on ${b.requestedDirectorNames || 'a director'} to sign`;
      default: return b.statusTitle;
    }
  }
  previewPack(b: InProgressBatch | ScheduleBatch): void {
    PackPreviewDialogComponent.open(this.dialog, { url: this.api.reviewPackUrl(b.id), title: `${b.batchNumber}: full pack`, subtitle: `${b.companyName} · ${b.paymentTypeTitle} · ${b.statusTitle}`, fileName: `Pack-${b.batchNumber}.pdf` });
  }
  /** One payment in one scroll: its approval sheet followed by every document attached to it. */
  previewItem(b: InProgressBatch | ScheduleBatch, i: { id: number; supplierName: string }): void {
    PackPreviewDialogComponent.open(this.dialog, { url: this.api.itemReviewUrl(b.id, i.id), title: `${i.supplierName}: approval sheet and documents`, subtitle: `${b.batchNumber} · ${b.companyName}`, fileName: `${b.batchNumber}-${i.supplierName}.pdf` });
  }
  previewDoc(b: InProgressBatch, d: InProgressDoc, supplier?: string): void {
    const title = `${d.title}${supplier ? ' · ' + supplier : ''}`, subtitle = `${b.batchNumber} · ${d.originalFileName || ''}`;
    if (d.textMethod === 'sheet') ReconPreviewDialogComponent.open(this.dialog, { sheetUrl: this.api.sheetUrl(b.id, d.id), fileUrl: this.api.fileUrl(b.id, d.id), title, subtitle, fileName: d.originalFileName });
    else PackPreviewDialogComponent.open(this.dialog, { url: this.api.fileUrl(b.id, d.id), title, subtitle, fileName: d.originalFileName });
  }
  openPack(b: { id: number }): void { this.router.navigate(['/finance'], { queryParams: { side: 'creditors', tab: 'creditors', batch: b.id } }); }

  bankFile(b: ScheduleBatch): void {
    this.api.bankFile(b.id).subscribe({
      next: blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${b.batchNumber}-bank.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 30_000); this.load(); },
      error: () => this.toast.error("Couldn't export the bank file.")
    });
  }

  setStatus(b: ScheduleBatch, s: 'LoadedOnBank' | 'Paid' | 'Closed'): void {
    this.busy.set(true);
    this.api.setStatus(b.id, s).subscribe({
      next: () => { this.busy.set(false); this.toast.done(s === 'LoadedOnBank' ? `${b.batchNumber} loaded on the bank` : s === 'Paid' ? `${b.batchNumber} marked paid — upload the POPs to close it` : `${b.batchNumber} closed`); this.load(); },
      error: e => { this.busy.set(false); this.toast.error(e?.error?.message || "Couldn't change the status."); }
    });
  }

  reschedule(b: ScheduleBatch, date: string): void {
    if (!date || date === b.scheduledPayDate.slice(0, 10)) return;
    this.busy.set(true);
    this.api.reschedule(b.id, date).subscribe({
      next: () => { this.busy.set(false); this.toast.done(`${b.batchNumber} moved to ${new Date(date + 'T00:00:00').toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })}`); this.load(); },
      error: e => { this.busy.set(false); this.toast.error(e?.error?.message || "Couldn't reschedule."); }
    });
  }

  pickPop(b: ScheduleBatch, i: ScheduleItem): void { this.pendingPop = { b, i }; this.popInput?.nativeElement.click(); }
  onPopFile(ev: Event): void {
    const input = ev.target as HTMLInputElement; const file = input.files?.[0]; input.value = '';
    if (!file || !this.pendingPop) return;
    const { b, i } = this.pendingPop; this.pendingPop = null;
    this.busy.set(true);
    this.api.upload(b.id, file, 'ProofOfPayment', i.id).subscribe({
      next: () => { this.busy.set(false); this.toast.done(`POP uploaded for ${i.supplierName}`); this.load(); },
      error: e => { this.busy.set(false); this.toast.error(e?.error?.message || "Couldn't upload the proof of payment."); }
    });
  }
  viewPop(b: ScheduleBatch, i: ScheduleItem): void {
    if (!i.popDocId) return;
    PackPreviewDialogComponent.open(this.dialog, { url: this.api.fileUrl(b.id, i.popDocId), title: `Proof of payment · ${i.supplierName}`, subtitle: `${b.batchNumber} · ${b.companyName}` });
  }
}
