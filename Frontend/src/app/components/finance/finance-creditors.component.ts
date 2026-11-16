import { Component, OnInit, inject, signal, computed, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { ToastService } from '../../ui/toast.service';
import { CreditorPacksService, CreditorMeta, BatchRow, BatchDetail, BatchItem, BatchDoc, ItemInput, CreditorCompany, CreditorAlert, RequiredDoc } from '../../services/creditor-packs.service';

type View = 'board' | 'batch' | 'admin';

const EMPTY_ITEM: ItemInput = { supplierName: '', supplierVatNumber: '', invoiceNumbers: '', description: '', amount: 0, bankName: '', accountNumber: '', branchCode: '', accountHolder: '', paymentReference: '', stockReturned: false };

/**
 * Finance → Creditors. Payment packs per paying company: the clerk builds the schedule and attaches
 * the required documents, the system runs its checks, the company accountant approves, the director
 * decides each payment and signs, the bank user loads and marks paid, the clerk closes with proof of payment.
 */
@Component({
  selector: 'app-finance-creditors',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule, MatProgressSpinnerModule, MatMenuModule, MatCheckboxModule],
  template: `
  @if (!meta()) {
    <div class="cr-state"><mat-spinner diameter="36"></mat-spinner><p>Opening creditors…</p></div>
  } @else {

  <!-- ═══════════ BOARD ═══════════ -->
  @if (view() === 'board') {
    <div class="cr-kpis">
      <button class="cr-kpi" [class.active]="statusFilter() === ''" (click)="statusFilter.set('')"><mat-icon>payments</mat-icon><span class="v">{{ rows().length }}</span><span class="l">Batches</span></button>
      <button class="cr-kpi muted" [class.active]="statusFilter() === 'Draft'" (click)="statusFilter.set('Draft')"><mat-icon>edit_note</mat-icon><span class="v">{{ count('Draft') }}</span><span class="l">Drafts</span></button>
      <button class="cr-kpi bad" [class.active]="statusFilter() === 'ChecksFailed'" (click)="statusFilter.set('ChecksFailed')"><mat-icon>report</mat-icon><span class="v">{{ count('ChecksFailed') + count('QueriedByAccountant') + count('QueriedByDirector') }}</span><span class="l">Sent back</span></button>
      <button class="cr-kpi warn" [class.active]="statusFilter() === 'AwaitingAccountant'" (click)="statusFilter.set('AwaitingAccountant')"><mat-icon>fact_check</mat-icon><span class="v">{{ count('AwaitingAccountant') }}</span><span class="l">With accountant</span></button>
      <button class="cr-kpi warn" [class.active]="statusFilter() === 'AwaitingDirector'" (click)="statusFilter.set('AwaitingDirector')"><mat-icon>draw</mat-icon><span class="v">{{ count('AwaitingDirector') }}</span><span class="l">With director</span></button>
      <button class="cr-kpi ok" [class.active]="statusFilter() === 'Approved'" (click)="statusFilter.set('Approved')"><mat-icon>account_balance</mat-icon><span class="v">{{ count('Approved') + count('LoadedOnBank') }}</span><span class="l">To load / pay</span></button>
      <button class="cr-kpi" [class.active]="statusFilter() === 'Paid'" (click)="statusFilter.set('Paid')"><mat-icon>receipt_long</mat-icon><span class="v">{{ count('Paid') }}</span><span class="l">Paid · needs POP</span></button>
      <button class="cr-kpi warn2" [class.active]="statusFilter() === 'prepay'" (click)="statusFilter.set('prepay')"><mat-icon>hourglass_top</mat-icon><span class="v">{{ openPrepay() }}</span><span class="l">Open prepayments</span></button>
    </div>

    @if (alerts().length) {
      <div class="cr-alerts">
        <mat-icon>gpp_maybe</mat-icon>
        <div class="txt"><strong>{{ alerts().length }} control alert{{ alerts().length === 1 ? '' : 's' }}</strong> across open batches — new bank details, old bank letters, duplicates, open prepayments.</div>
        <button mat-button (click)="showAlerts.set(!showAlerts())">{{ showAlerts() ? 'Hide' : 'Show' }}</button>
      </div>
      @if (showAlerts()) {
        <div class="cr-alert-list">
          @for (a of alerts(); track $index) {
            <button class="cr-alert" [class.fail]="a.severity === 'FAIL'" (click)="open(a.batchId)">
              <span class="code">{{ a.code }}</span><span class="b">{{ a.batchNumber }} · {{ a.companyCode }}</span><span class="t">{{ a.title }}</span><span class="d">{{ a.detail }}</span>
            </button>
          }
        </div>
      }
    }

    <div class="cr-toolbar">
      <div class="cr-chips">
        <button class="chip" [class.on]="companyFilter() === ''" (click)="companyFilter.set('')">All companies</button>
        @for (c of activeCompanies(); track c.code) {
          <button class="chip" [class.on]="companyFilter() === c.code" (click)="companyFilter.set(c.code)" [matTooltip]="c.name">{{ c.code }}</button>
        }
      </div>
      <span class="cr-spacer"></span>
      <select [ngModel]="typeFilter()" (ngModelChange)="typeFilter.set($event)">
        <option value="">All payment types</option>
        @for (p of meta()!.paymentTypes; track p.key) { <option [value]="p.key">{{ p.title }}</option> }
      </select>
      <button mat-stroked-button (click)="loadBoard()"><mat-icon>refresh</mat-icon> Refresh</button>
      @if (meta()!.me.isAdmin) { <button mat-stroked-button (click)="openAdmin()"><mat-icon>admin_panel_settings</mat-icon> Companies & roles</button> }
      @if (meta()!.me.clerk) { <button mat-flat-button color="primary" (click)="newOpen.set(true)"><mat-icon>add</mat-icon> New batch</button> }
    </div>

    @if (newOpen()) {
      <div class="cr-card cr-new">
        <h3>New payment batch</h3>
        <div class="row">
          <label>Paying company
            <select [(ngModel)]="newBatch.companyCode">
              @for (c of activeCompanies(); track c.code) { <option [value]="c.code">{{ c.code }} — {{ c.name }}</option> }
            </select>
          </label>
          <label>Payment type
            <select [(ngModel)]="newBatch.paymentType">
              @for (p of meta()!.paymentTypes; track p.key) { <option [value]="p.key">{{ p.title }}</option> }
            </select>
          </label>
          <label>Payment date <input type="date" [(ngModel)]="newBatch.batchDate"></label>
          <label class="grow">Notes <input type="text" [(ngModel)]="newBatch.notes" placeholder="e.g. Week 46 daily creditors"></label>
        </div>
        @if (companyFor(newBatch.companyCode); as co) {
          <p class="hint" [class.warn]="!co.accountantUserId">
            <mat-icon>{{ co.accountantUserId ? 'verified_user' : 'warning' }}</mat-icon>
            Accountant: <strong>{{ co.accountantName || 'not set — any accountant may approve until the admin assigns one' }}</strong>
            · Director: <strong>{{ co.directorName || 'not set' }}</strong>
          </p>
        }
        <div class="actions"><button mat-button (click)="newOpen.set(false)">Cancel</button><button mat-flat-button color="primary" [disabled]="!newBatch.companyCode || busy()" (click)="create()">Create batch</button></div>
      </div>
    }

    @if (loading()) { <div class="cr-state"><mat-spinner diameter="32"></mat-spinner></div> }
    @else if (!filteredRows().length) {
      <div class="cr-state"><mat-icon>inbox</mat-icon><h3>No batches here</h3><p>Create a batch to start a payment pack, or change the filters.</p></div>
    } @else {
      <div class="cr-table-wrap">
        <table class="cr-table">
          <thead><tr><th>Batch</th><th>Company</th><th>Type</th><th>Date</th><th class="num">Amount</th><th>Lines</th><th>Status</th><th>Prepared by</th><th>Approvals</th><th></th></tr></thead>
          <tbody>
            @for (r of filteredRows(); track r.id) {
              <tr (click)="open(r.id)" [class]="'st-' + r.status">
                <td class="ref">{{ r.batchNumber }}</td>
                <td><strong>{{ r.companyCode }}</strong></td>
                <td>{{ typeTitle(r.paymentType) }}</td>
                <td class="nowrap">{{ r.batchDate | date:'dd MMM yyyy' }}</td>
                <td class="num">R {{ r.totalAmount | number:'1.2-2' }}</td>
                <td>{{ r.items }} <small class="muted">· {{ r.documents }} docs</small></td>
                <td>
                  <span class="badge" [class]="'badge ' + badge(r.status)">{{ r.statusTitle }}</span>
                  @if (r.checksStatus && r.status !== 'Draft') { <span class="chk" [class]="'chk ' + r.checksStatus.toLowerCase()" [matTooltip]="'Automatic checks: ' + r.checksStatus">{{ r.checksStatus }}</span> }
                  @if (r.returnReason && (r.status === 'ChecksFailed' || r.status.startsWith('Queried'))) { <div class="reason">{{ r.returnReason }}</div> }
                </td>
                <td>{{ r.preparedByName }}</td>
                <td class="appr">
                  <span [class.done]="r.accountantApprovedAt" matTooltip="Accountant">{{ r.accountantApprovedAt ? '✓' : '○' }} Acc</span>
                  <span [class.done]="r.directorSignedAt" matTooltip="Director">{{ r.directorSignedAt ? '✓' : '○' }} Dir</span>
                  @if (r.openPrepayments) { <span class="pre" matTooltip="Prepayments awaiting invoice + GRV">{{ r.openPrepayments }} open</span> }
                </td>
                <td class="actions"><mat-icon>chevron_right</mat-icon></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  }

  <!-- ═══════════ BATCH ═══════════ -->
  @if (view() === 'batch' && batch(); as b) {
    <div class="cr-bhead">
      <button mat-icon-button (click)="back()" aria-label="Back"><mat-icon>arrow_back</mat-icon></button>
      <div class="ttl">
        <h2>{{ b.batchNumber }} <span class="badge" [class]="'badge ' + badge(b.status)">{{ b.statusTitle }}</span>
          @if (b.lockedAt) { <mat-icon class="lock" matTooltip="Signed and locked — files can't be changed">lock</mat-icon> }
        </h2>
        <p>{{ b.companyName }} ({{ b.companyCode }}) · {{ b.paymentTypeTitle }} · {{ b.batchDate | date:'dd MMM yyyy' }} · prepared by {{ b.preparedByName }}</p>
      </div>
      <div class="sum"><span class="l">Total</span><span class="v">R {{ b.totalAmount | number:'1.2-2' }}</span>
        @if (b.approvedAmount && b.approvedAmount !== b.totalAmount) { <span class="l">Approved R {{ b.approvedAmount | number:'1.2-2' }}</span> }
      </div>
    </div>

    <!-- Progress -->
    <ol class="cr-steps">
      @for (s of steps; track s.key) {
        <li [class.done]="stepState(b, s.key) === 'done'" [class.now]="stepState(b, s.key) === 'now'" [class.bad]="stepState(b, s.key) === 'bad'">
          <mat-icon>{{ s.icon }}</mat-icon><span>{{ s.title }}</span>
        </li>
      }
    </ol>

    @if (b.returnReason && (b.status === 'ChecksFailed' || b.status.startsWith('Queried') || b.status === 'Rejected')) {
      <div class="cr-banner bad"><mat-icon>undo</mat-icon><div><strong>Sent back:</strong> {{ b.returnReason }}</div>
        @if (b.can.reopen) { <button mat-stroked-button (click)="setStatus('Draft')">Reopen & fix</button> }
      </div>
    }

    <!-- Action bar -->
    <div class="cr-actions">
      @if (b.can.rerunChecks && b.items.length) { <button mat-stroked-button (click)="rerun()" [disabled]="busy()"><mat-icon>rule</mat-icon> Run checks</button> }
      @if (b.can.edit) {
        <button mat-flat-button color="primary" [disabled]="!b.can.submit || busy()" (click)="submit()" [matTooltip]="b.can.submit ? 'Run the checks and send to the accountant' : 'Add payments and fill every required document first'"><mat-icon>send</mat-icon> Submit to accountant</button>
        @if (b.status === 'Draft') { <button mat-button color="warn" (click)="deleteBatch()"><mat-icon>delete</mat-icon> Delete draft</button> }
      }
      @if (b.can.accountant) {
        <button mat-flat-button color="primary" (click)="accountant('approve')" [disabled]="busy()"><mat-icon>task_alt</mat-icon> Approve → director</button>
        <button mat-stroked-button color="warn" (click)="accountant('query')" [disabled]="busy()"><mat-icon>reply</mat-icon> Send back</button>
      }
      @if (b.can.direct) {
        <button mat-stroked-button (click)="decideAll('Approved')" [disabled]="busy()"><mat-icon>done_all</mat-icon> Approve all pending</button>
        <button mat-flat-button color="primary" [disabled]="!b.can.sign || busy()" (click)="signOpen.set(true)" [matTooltip]="b.accountantApprovedAt ? (b.can.sign ? 'Sign the batch' : 'Decide on every payment first') : 'Waiting for the company accountant'"><mat-icon>draw</mat-icon> Sign batch</button>
      }
      @if (b.can.bankFile) { <button mat-stroked-button (click)="bankFile()"><mat-icon>download</mat-icon> Bank file (CSV)</button> }
      @if (b.can.markLoaded) { <button mat-flat-button color="primary" (click)="setStatus('LoadedOnBank')"><mat-icon>account_balance</mat-icon> Loaded on bank</button> }
      @if (b.can.markPaid) { <button mat-flat-button color="primary" (click)="setStatus('Paid')"><mat-icon>price_check</mat-icon> Mark paid</button> }
      @if (b.can.close) { <button mat-flat-button color="primary" (click)="setStatus('Closed')"><mat-icon>inventory</mat-icon> Close batch</button> }
      <span class="cr-spacer"></span>
      @if (b.checksStatus) { <span class="chk big" [class]="'chk big ' + b.checksStatus.toLowerCase()">Checks: {{ b.checksStatus }}</span> }
    </div>

    <!-- Sign dialog -->
    @if (signOpen()) {
      <div class="cr-card cr-sign">
        <h3><mat-icon>draw</mat-icon> Director sign-off</h3>
        <p>You are approving <strong>{{ approvedCount(b) }}</strong> payment(s) for <strong>R {{ b.approvedAmount | number:'1.2-2' }}</strong> from {{ b.companyName }}.
           Accountant approval: <strong>{{ b.accountantName }}</strong> on {{ b.accountantApprovedAt | date:'dd MMM HH:mm' }}. Once signed, the batch and its documents are locked.</p>
        <label>Type your full name to sign <input type="text" [(ngModel)]="signName" placeholder="Full name as on your profile"></label>
        <label>Draw your signature (optional)
          <canvas #sigpad width="520" height="140" class="sigpad" (pointerdown)="padDown($event)" (pointermove)="padMove($event)" (pointerup)="padUp()" (pointerleave)="padUp()"></canvas>
          <button mat-button type="button" (click)="padClear()">Clear</button>
        </label>
        <label>Comment <input type="text" [(ngModel)]="signComment" placeholder="Optional"></label>
        <div class="actions"><button mat-button (click)="signOpen.set(false)">Cancel</button><button mat-flat-button color="primary" [disabled]="!signName || busy()" (click)="sign()">Sign & lock</button></div>
      </div>
    }

    <div class="cr-grid">
      <!-- LEFT: schedule + documents -->
      <div class="cr-main">
        <!-- Batch-level documents -->
        <section class="cr-card">
          <header><h3><mat-icon>folder</mat-icon> Batch documents</h3><small>{{ filledCount(b.requiredBatchDocs) }} of {{ b.requiredBatchDocs.length }} required</small></header>
          <div class="req">
            @for (r of b.requiredBatchDocs; track r.docType) {
              <span class="reqchip" [class.ok]="r.filled" (click)="!r.filled && b.can.edit && pickFor(r.docType, null)"><mat-icon>{{ r.filled ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>{{ r.title }}</span>
            }
          </div>
          <ng-container *ngTemplateOutlet="docList; context: { docs: b.batchDocuments, itemId: null }"></ng-container>
          @if (b.can.edit || b.can.uploadAfterLock) {
            <div class="drop" (dragover)="$event.preventDefault()" (drop)="drop($event, null)">
              <mat-icon>upload_file</mat-icon> Drop PDFs here or <button mat-button (click)="pickFor('', null)">choose files</button>
              <small>One document per PDF · we'll suggest the type, you confirm</small>
            </div>
          }
        </section>

        <!-- Schedule -->
        <section class="cr-card">
          <header><h3><mat-icon>list_alt</mat-icon> Payment schedule</h3><small>{{ b.items.length }} payment(s)</small>
            @if (b.can.edit) { <button mat-stroked-button (click)="startItem()"><mat-icon>add</mat-icon> Add payment</button> }
          </header>

          @if (itemForm()) {
            <div class="cr-itemform">
              <div class="row">
                <label class="grow">Supplier / beneficiary <input [(ngModel)]="itemDraft.supplierName" required></label>
                <label>VAT no. <input [(ngModel)]="itemDraft.supplierVatNumber" placeholder="4xxxxxxxxx"></label>
                <label>Amount (R) <input type="number" step="0.01" [(ngModel)]="itemDraft.amount"></label>
              </div>
              <div class="row">
                <label class="grow">Invoice / reference numbers <input [(ngModel)]="itemDraft.invoiceNumbers" placeholder="INV123, INV124"></label>
                <label class="grow">Description <input [(ngModel)]="itemDraft.description"></label>
              </div>
              <div class="row">
                <label>Bank <input [(ngModel)]="itemDraft.bankName"></label>
                <label>Account no. <input [(ngModel)]="itemDraft.accountNumber"></label>
                <label>Branch <input [(ngModel)]="itemDraft.branchCode"></label>
                <label class="grow">Account holder <input [(ngModel)]="itemDraft.accountHolder"></label>
                <label>Payment ref <input [(ngModel)]="itemDraft.paymentReference"></label>
              </div>
              @if (b.paymentType === 'CreditNote') {
                <mat-checkbox [(ngModel)]="itemDraft.stockReturned">Stock physically returned (warehouse GRV + collection slip required)</mat-checkbox>
              }
              <div class="actions"><button mat-button (click)="itemForm.set(null)">Cancel</button><button mat-flat-button color="primary" [disabled]="!itemDraft.supplierName || !itemDraft.amount || busy()" (click)="saveItem()">{{ itemForm() === 'new' ? 'Add' : 'Save' }}</button></div>
            </div>
          }

          @if (!b.items.length) { <p class="empty">No payments yet. Add each beneficiary on the schedule, then attach its documents.</p> }
          @for (it of b.items; track it.id) {
            <div [class]="'cr-item dec-' + it.decisionStatus" [class.open]="openItem() === it.id">
              <div class="head" (click)="openItem.set(openItem() === it.id ? 0 : it.id)">
                <mat-icon class="tw">{{ openItem() === it.id ? 'expand_more' : 'chevron_right' }}</mat-icon>
                <div class="who"><strong>{{ it.supplierName }}</strong><small>{{ it.invoiceNumbers || it.description || '—' }} · {{ it.bankName || '' }} {{ it.accountNumber || '' }}</small></div>
                <div class="docs" [matTooltip]="'Required documents for this payment'">
                  @for (r of it.required; track r.docType) { <mat-icon [class.ok]="r.filled" [matTooltip]="r.title + (r.filled ? ' ✓' : ' — missing')">{{ r.filled ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon> }
                </div>
                @if (it.prepaymentOpen && it.paidAt) { <span class="pre">prepayment open</span> }
                <span class="dec" [class]="'dec ' + it.decisionStatus.toLowerCase()">{{ it.decisionStatus === 'Pending' ? '' : it.decisionStatus }}</span>
                <span class="amt">R {{ it.amount | number:'1.2-2' }}</span>
                @if (b.can.edit) {
                  <button mat-icon-button (click)="$event.stopPropagation(); startItem(it)" matTooltip="Edit"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button (click)="$event.stopPropagation(); removeItem(it)" matTooltip="Remove"><mat-icon>delete</mat-icon></button>
                }
                @if (b.can.direct) {
                  <span class="decide" (click)="$event.stopPropagation()">
                    <button mat-icon-button [class.sel]="it.decisionStatus === 'Approved'" matTooltip="Approve" (click)="decide(it, 'Approved')"><mat-icon>thumb_up</mat-icon></button>
                    <button mat-icon-button [class.sel]="it.decisionStatus === 'Queried'" matTooltip="Query (send back)" (click)="decide(it, 'Queried')"><mat-icon>help</mat-icon></button>
                    <button mat-icon-button [class.sel]="it.decisionStatus === 'Rejected'" matTooltip="Reject" (click)="decide(it, 'Rejected')"><mat-icon>thumb_down</mat-icon></button>
                  </span>
                }
              </div>
              @if (it.decisionComment) { <div class="deccomment"><mat-icon>chat</mat-icon> {{ it.decisionComment }}</div> }
              @if (openItem() === it.id) {
                <div class="body">
                  <div class="req">
                    @for (r of it.required; track r.docType) {
                      <span class="reqchip" [class.ok]="r.filled" (click)="!r.filled && (b.can.edit || b.can.uploadAfterLock) && pickFor(r.docType, it.id)">
                        <mat-icon>{{ r.filled ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>{{ r.title }}
                        @if (!r.filled && b.can.edit) { <a class="na" (click)="$event.stopPropagation(); markNa(r, it.id)">N/A</a> }
                      </span>
                    }
                  </div>
                  <ng-container *ngTemplateOutlet="docList; context: { docs: it.documents, itemId: it.id }"></ng-container>
                  @if (b.can.edit || b.can.uploadAfterLock) {
                    <div class="drop sm" (dragover)="$event.preventDefault()" (drop)="drop($event, it.id)">
                      <mat-icon>upload_file</mat-icon> Drop this payment's PDFs here or <button mat-button (click)="pickFor('', it.id)">choose</button>
                    </div>
                  }
                  @if (findingsFor(it.id).length) {
                    <ul class="cr-findings">
                      @for (f of findingsFor(it.id); track $index) { <li [class]="f.severity.toLowerCase()"><span class="code">{{ f.code }}</span><strong>{{ f.title }}</strong> <span>{{ f.detail }}</span></li> }
                    </ul>
                  }
                </div>
              }
            </div>
          }
        </section>
      </div>

      <!-- RIGHT: checks, approvals, trail -->
      <aside class="cr-side">
        <section class="cr-card">
          <header><h3><mat-icon>rule</mat-icon> Automatic checks</h3>
            @if (b.checksRunAt) { <small>{{ b.checksRunAt | date:'dd MMM HH:mm' }}</small> }
          </header>
          @if (!b.checks) { <p class="empty">Checks run when you submit. You can also run them any time from the toolbar.</p> }
          @else {
            <div class="chksum"><span class="fail">{{ b.checks.fail }} fail</span><span class="review">{{ b.checks.review }} review</span><span class="pass">{{ b.checks.pass }} pass</span></div>
            <ul class="cr-findings">
              @for (f of sortedFindings(b); track $index) {
                <li [class]="f.severity.toLowerCase()"><span class="code">{{ f.code }}</span><strong>{{ f.title }}</strong>@if (f.supplier) { <em> · {{ f.supplier }}</em> } <span>{{ f.detail }}</span></li>
              }
            </ul>
          }
        </section>

        <section class="cr-card">
          <header><h3><mat-icon>verified</mat-icon> Approvals</h3></header>
          <div class="appr-row" [class.done]="b.accountantApprovedAt"><mat-icon>{{ b.accountantApprovedAt ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
            <div><strong>Company accountant</strong><small>{{ b.accountantApprovedAt ? (b.accountantName + ' · ' + (b.accountantApprovedAt | date:'dd MMM HH:mm')) : (responsibleName(b.responsible.accountant) || 'not assigned') }}</small>@if (b.accountantComment) { <small>“{{ b.accountantComment }}”</small> }</div>
          </div>
          <div class="appr-row" [class.done]="b.directorSignedAt && b.lockedAt"><mat-icon>{{ b.lockedAt ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
            <div><strong>Director sign-off</strong><small>{{ b.directorSignedAt ? (b.directorName + ' · ' + (b.directorSignedAt | date:'dd MMM HH:mm')) : (responsibleName(b.responsible.director) || 'not assigned') }}</small>@if (b.directorComment) { <small>“{{ b.directorComment }}”</small> }</div>
          </div>
          @if (b.lockHash) { <small class="hash" matTooltip="Tamper-evidence hash of the signed batch">lock {{ b.lockHash | slice:0:16 }}…</small> }
          @for (s of b.signatures; track s.id) {
            <div class="sig"><mat-icon>{{ s.method === 'Drawn' ? 'gesture' : 'keyboard' }}</mat-icon><span>{{ s.signerName }} · {{ s.context === 'AccountantApproval' ? 'Accountant' : 'Director' }} · {{ s.action }} · {{ s.signedAtUtc | date:'dd MMM HH:mm' }}</span></div>
          }
        </section>

        <section class="cr-card">
          <header><h3><mat-icon>history</mat-icon> Trail</h3></header>
          <ul class="cr-trail">
            @for (e of b.events; track e.id) {
              <li><span class="when">{{ e.at | date:'dd MMM HH:mm' }}</span><span class="who">{{ e.userName }}</span><span class="what">{{ e.action }}@if (e.toStatus) { → {{ statusTitle(e.toStatus) }} }</span>@if (e.comment) { <span class="cmt">{{ e.comment }}</span> }</li>
            }
          </ul>
        </section>
      </aside>
    </div>

    <!-- document list template -->
    <ng-template #docList let-docs="docs" let-itemId="itemId">
      @if (docs?.length) {
        <ul class="cr-docs">
          @for (d of docs; track d.id) {
            <li [class.na]="d.isNotApplicable">
              <mat-icon>{{ d.isNotApplicable ? 'block' : 'picture_as_pdf' }}</mat-icon>
              <div class="info">
                <div class="top">
                  @if (b.can.edit && !d.isNotApplicable) {
                    <select class="type" [ngModel]="d.docType" (ngModelChange)="retype(d, $event)" [class.sugg]="d.suggestedDocType && d.suggestedDocType !== d.docType">
                      @for (t of docTypesFor(itemId); track t.key) { <option [value]="t.key">{{ t.title }}</option> }
                    </select>
                  } @else { <strong>{{ d.title }}</strong> }
                  @if (d.version > 1) { <span class="ver">v{{ d.version }}</span> }
                  @if (d.suggestedDocType && d.suggestedDocType !== d.docType && !d.isNotApplicable) { <small class="sugg" matTooltip="The system read it as a different type">looked like {{ docTitle(d.suggestedDocType) }}</small> }
                </div>
                <small>
                  @if (d.isNotApplicable) { N/A — {{ d.naReason }} }
                  @else { {{ d.originalFileName }} · {{ d.pageCount }}p · {{ d.textMethod }}@if (d.documentDate) { · dated {{ d.documentDate | date:'dd MMM yyyy' }} }@if (d.extractedAmount) { · R {{ d.extractedAmount | number:'1.2-2' }} }@if (d.extractedAccountNumber) { · acc {{ d.extractedAccountNumber }} } }
                  · {{ d.uploadedByName }} {{ d.uploadedAt | date:'dd MMM' }}
                </small>
                @if (d.versionReason) { <small class="vr">Replaced: {{ d.versionReason }}</small> }
              </div>
              @if (!d.isNotApplicable) { <button mat-icon-button matTooltip="Open" (click)="openDoc(d)"><mat-icon>open_in_new</mat-icon></button> }
              @if (b.can.edit) { <button mat-icon-button matTooltip="Remove" (click)="removeDoc(d)"><mat-icon>delete</mat-icon></button> }
              @else if (b.can.uploadAfterLock && !d.isNotApplicable) { <button mat-icon-button matTooltip="Replace (needs a reason)" (click)="replaceDoc(d)"><mat-icon>published_with_changes</mat-icon></button> }
            </li>
          }
        </ul>
      }
    </ng-template>
    <input #fileInput type="file" accept="application/pdf" multiple hidden (change)="filesChosen($event)">
  }

  <!-- ═══════════ ADMIN ═══════════ -->
  @if (view() === 'admin') {
    <div class="cr-bhead">
      <button mat-icon-button (click)="back()" aria-label="Back"><mat-icon>arrow_back</mat-icon></button>
      <div class="ttl"><h2>Companies, approvers & roles</h2><p>Each paying company needs its responsible accountant (mandatory approval step), a back-up, and the director(s) who sign. Roles here are the same keys the Settings › Users screen shows under “Finance › Creditors”.</p></div>
    </div>
    <section class="cr-card">
      <header><h3><mat-icon>business</mat-icon> Paying companies</h3><button mat-stroked-button (click)="addCompanyRow()"><mat-icon>add</mat-icon> Add company</button></header>
      <table class="cr-table admin">
        <thead><tr><th>Code</th><th>Company</th><th>Accountant *</th><th>Back-up approver</th><th>Director</th><th>Delegate director</th><th>Active</th><th></th></tr></thead>
        <tbody>
          @for (c of adminCompanies(); track c.id ?? $index) {
            <tr>
              <td><input class="code" [(ngModel)]="c.code" maxlength="10"></td>
              <td><input [(ngModel)]="c.name"><input class="act" [(ngModel)]="c.activity" placeholder="activity"></td>
              <td><select [(ngModel)]="c.accountantUserId"><option [ngValue]="null">—</option>@for (u of usersWith('cred.accountant'); track u.id) { <option [ngValue]="u.id">{{ u.name }}</option> }</select></td>
              <td><select [(ngModel)]="c.backupApproverUserId"><option [ngValue]="null">—</option>@for (u of usersWith('cred.accountant'); track u.id) { <option [ngValue]="u.id">{{ u.name }}</option> }</select></td>
              <td><select [(ngModel)]="c.directorUserId"><option [ngValue]="null">—</option>@for (u of usersWith('cred.director'); track u.id) { <option [ngValue]="u.id">{{ u.name }}</option> }</select></td>
              <td><select [(ngModel)]="c.delegateDirectorUserId"><option [ngValue]="null">—</option>@for (u of usersWith('cred.director'); track u.id) { <option [ngValue]="u.id">{{ u.name }}</option> }</select></td>
              <td><mat-checkbox [(ngModel)]="c.isActive"></mat-checkbox></td>
              <td><button mat-flat-button color="primary" (click)="saveCompany(c)" [disabled]="busy() || !c.code || !c.name">Save</button></td>
            </tr>
          }
        </tbody>
      </table>
      <p class="hint"><mat-icon>info</mat-icon> Only users who hold the matching role appear in the pickers. Grant roles below first.</p>
    </section>

    <section class="cr-card">
      <header><h3><mat-icon>badge</mat-icon> Who does what</h3><input class="search" [(ngModel)]="userSearch" (ngModelChange)="loadUsers()" placeholder="Search people…"></header>
      <table class="cr-table admin">
        <thead><tr><th>Person</th>@for (r of meta()!.roles; track r.key) { <th [matTooltip]="r.description">{{ r.title }}</th> }</tr></thead>
        <tbody>
          @for (u of users(); track u.id) {
            <tr><td><strong>{{ u.name }}</strong><small class="muted"> {{ u.email }} · {{ u.role }}</small></td>
              @for (r of meta()!.roles; track r.key) { <td class="ctr"><mat-checkbox [checked]="hasRole(u, r.key)" (change)="setRole(u, r.key, $event.checked)"></mat-checkbox></td> }
            </tr>
          }
        </tbody>
      </table>
    </section>
  }
  }
  `,
  styles: [`
    :host { display: block; }
    .cr-state { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); padding: var(--space-8) var(--space-4); color: var(--color-text-3); text-align: center; mat-icon { font-size: 44px; width: 44px; height: 44px; } h3 { margin: 0; color: var(--color-text); } p { margin: 0; } }
    .cr-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: var(--space-3); margin-bottom: var(--space-4); }
    .cr-kpi { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: var(--space-3) var(--space-4); text-align: left; font: inherit; color: var(--color-text); background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-md); cursor: pointer;
      mat-icon { color: var(--color-primary); margin-bottom: 4px; } .v { font-size: var(--text-3xl); font-weight: 700; line-height: 1.1; } .l { font-size: var(--text-xs); color: var(--color-text-3); }
      &:hover { border-color: var(--color-primary); } &.active { border-color: var(--color-primary); background: var(--color-primary-soft); }
      &.ok mat-icon { color: var(--color-ok); } &.warn mat-icon, &.warn2 mat-icon { color: var(--color-warn); } &.bad mat-icon { color: var(--color-danger); } &.muted mat-icon { color: var(--color-text-3); } }
    .cr-alerts { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-3); margin-bottom: var(--space-2); background: var(--color-warn-soft); border: 1px solid var(--color-warn); border-radius: var(--radius-md); mat-icon { color: var(--color-warn); } .txt { flex: 1; font-size: var(--text-sm); } }
    .cr-alert-list { display: grid; gap: 4px; margin-bottom: var(--space-3); }
    .cr-alert { display: grid; grid-template-columns: 44px 160px 1fr; gap: 4px 12px; text-align: left; font: inherit; padding: 8px 12px; background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-sm); cursor: pointer; font-size: var(--text-sm);
      .code { font-family: var(--font-mono); color: var(--color-text-3); } .b { font-weight: 600; } .d { grid-column: 3; color: var(--color-text-2); font-size: var(--text-xs); } &.fail { border-color: var(--color-danger); } &:hover { border-color: var(--color-primary); } }
    .cr-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin-bottom: var(--space-3);
      select, input { height: 40px; padding: 0 var(--space-3); border: 1px solid var(--color-line-strong); border-radius: var(--radius-control); background: var(--color-surface); color: var(--color-text); font: inherit; } }
    .cr-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip { font: inherit; font-size: var(--text-sm); padding: 6px 12px; border-radius: 999px; border: 1px solid var(--color-line-strong); background: var(--color-surface); color: var(--color-text-2); cursor: pointer; &.on { background: var(--color-primary-soft); color: var(--color-primary); border-color: var(--color-primary); font-weight: 600; } }
    .cr-spacer { flex: 1; }
    .cr-card { background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-lg); padding: var(--space-4); margin-bottom: var(--space-4);
      header { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-3); h3 { margin: 0; font-size: var(--text-md); display: flex; align-items: center; gap: 6px; flex: 1; mat-icon { color: var(--color-primary); } } small { color: var(--color-text-3); } }
      .row { display: flex; flex-wrap: wrap; gap: var(--space-3); margin-bottom: var(--space-2); }
      label { display: flex; flex-direction: column; gap: 4px; font-size: var(--text-xs); color: var(--color-text-3); &.grow { flex: 1; min-width: 200px; } }
      input, select { height: 38px; padding: 0 var(--space-2); border: 1px solid var(--color-line-strong); border-radius: var(--radius-control); background: var(--color-surface); color: var(--color-text); font: inherit; font-size: var(--text-sm); }
      .actions { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-2); }
      .hint { display: flex; align-items: center; gap: 6px; font-size: var(--text-sm); color: var(--color-text-2); mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--color-ok); } &.warn mat-icon { color: var(--color-warn); } }
      .empty { color: var(--color-text-3); font-size: var(--text-sm); margin: 0; } }
    .cr-table-wrap { background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-lg); overflow: auto; }
    .cr-table { width: 100%; border-collapse: collapse;
      th { text-align: left; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .04em; color: var(--color-text-3); padding: 10px var(--space-3); background: var(--color-surface-2); border-bottom: 1px solid var(--color-line); }
      td { padding: var(--row-pad-y) var(--space-3); border-bottom: 1px solid var(--color-line); font-size: var(--text-sm); vertical-align: middle; }
      tbody tr { cursor: pointer; &:hover td { background: var(--color-surface-2); } }
      .num { text-align: right; font-family: var(--font-mono); } .nowrap { white-space: nowrap; } .ref { font-family: var(--font-mono); } .muted { color: var(--color-text-3); }
      .reason { font-size: var(--text-xs); color: var(--color-danger); max-width: 320px; }
      .appr span { display: inline-block; margin-right: 8px; font-size: var(--text-xs); color: var(--color-text-3); &.done { color: var(--color-ok); font-weight: 600; } &.pre { color: var(--color-warn); } }
      .actions { text-align: right; color: var(--color-text-3); } .ctr { text-align: center; }
      &.admin { tbody tr { cursor: default; } input, select { height: 34px; width: 100%; min-width: 120px; font-size: var(--text-sm); } input.code { width: 70px; min-width: 0; font-family: var(--font-mono); } input.act { margin-top: 4px; font-size: var(--text-xs); } } }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: var(--text-xs); font-weight: 600; background: var(--color-surface-3); color: var(--color-text-2); vertical-align: middle;
      &.ok { background: var(--color-ok-soft); color: var(--color-ok); } &.warn { background: var(--color-warn-soft); color: var(--color-warn); } &.bad { background: var(--color-danger-soft); color: var(--color-danger); } &.info { background: var(--color-primary-soft); color: var(--color-primary); } }
    .chk { display: inline-block; margin-left: 6px; font-family: var(--font-mono); font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; background: var(--color-surface-3); &.pass { color: var(--color-ok); } &.review { color: var(--color-warn); } &.fail { color: var(--color-danger); } &.big { font-size: var(--text-xs); padding: 4px 10px; } }
    .cr-bhead { display: flex; align-items: flex-start; gap: var(--space-3); margin-bottom: var(--space-3);
      .ttl { flex: 1; h2 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: var(--text-xl); .lock { color: var(--color-ok); } } p { margin: 2px 0 0; color: var(--color-text-2); font-size: var(--text-sm); } }
      .sum { text-align: right; .l { display: block; font-size: var(--text-xs); color: var(--color-text-3); } .v { display: block; font-size: var(--text-2xl); font-weight: 700; font-family: var(--font-mono); } } }
    .cr-steps { display: flex; list-style: none; margin: 0 0 var(--space-3); padding: 0; gap: 4px; overflow: auto;
      li { flex: 1; min-width: 100px; display: flex; align-items: center; gap: 6px; padding: 6px 10px; font-size: var(--text-xs); color: var(--color-text-3); background: var(--color-surface-2); border-radius: var(--radius-sm); mat-icon { font-size: 16px; width: 16px; height: 16px; }
        &.done { color: var(--color-ok); background: var(--color-ok-soft); } &.now { color: var(--color-primary); background: var(--color-primary-soft); font-weight: 700; } &.bad { color: var(--color-danger); background: var(--color-danger-soft); } } }
    .cr-banner { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-3); margin-bottom: var(--space-3); border-radius: var(--radius-md); font-size: var(--text-sm); div { flex: 1; } &.bad { background: var(--color-danger-soft); border: 1px solid var(--color-danger); mat-icon { color: var(--color-danger); } } }
    .cr-actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin-bottom: var(--space-3); }
    .cr-sign { border-color: var(--color-primary); h3 { display: flex; align-items: center; gap: 6px; margin: 0 0 var(--space-2); } label { margin-bottom: var(--space-2); } .sigpad { border: 1px dashed var(--color-line-strong); border-radius: var(--radius-sm); background: #fff; touch-action: none; max-width: 100%; } }
    .cr-grid { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: var(--space-4); @media (max-width: 1100px) { grid-template-columns: 1fr; } }
    .req { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: var(--space-2); }
    .reqchip { display: inline-flex; align-items: center; gap: 4px; font-size: var(--text-xs); padding: 3px 10px 3px 6px; border-radius: 999px; border: 1px dashed var(--color-line-strong); color: var(--color-text-2); cursor: pointer; mat-icon { font-size: 16px; width: 16px; height: 16px; color: var(--color-text-3); }
      &.ok { border-style: solid; border-color: var(--color-ok); color: var(--color-ok); cursor: default; mat-icon { color: var(--color-ok); } } .na { margin-left: 4px; color: var(--color-primary); text-decoration: underline; } }
    .drop { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: var(--space-3); border: 2px dashed var(--color-line-strong); border-radius: var(--radius-md); color: var(--color-text-3); font-size: var(--text-sm); margin-top: var(--space-2); mat-icon { color: var(--color-primary); } small { flex-basis: 100%; font-size: var(--text-xs); } &.sm { padding: var(--space-2); } }
    .cr-docs { list-style: none; margin: 0; padding: 0; li { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--color-line); &:last-child { border-bottom: 0; } > mat-icon { color: var(--color-danger); } &.na > mat-icon { color: var(--color-text-3); }
      .info { flex: 1; min-width: 0; .top { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; } small { display: block; color: var(--color-text-3); font-size: var(--text-xs); } .type { height: 28px; font-size: var(--text-xs); &.sugg { border-color: var(--color-warn); } } .sugg { color: var(--color-warn); } .ver { font-family: var(--font-mono); font-size: 10px; background: var(--color-surface-3); padding: 1px 5px; border-radius: 4px; } .vr { color: var(--color-warn); } } } }
    .cr-itemform { background: var(--color-surface-2); border-radius: var(--radius-md); padding: var(--space-3); margin-bottom: var(--space-3); }
    .cr-item { border: 1px solid var(--color-line); border-radius: var(--radius-md); margin-bottom: 8px; overflow: hidden;
      .head { display: flex; align-items: center; gap: 8px; padding: 8px 10px; cursor: pointer; &:hover { background: var(--color-surface-2); }
        .tw { color: var(--color-text-3); } .who { flex: 1; min-width: 0; strong { display: block; font-size: var(--text-sm); } small { display: block; color: var(--color-text-3); font-size: var(--text-xs); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } }
        .docs mat-icon { font-size: 16px; width: 16px; height: 16px; color: var(--color-line-strong); &.ok { color: var(--color-ok); } }
        .amt { font-family: var(--font-mono); font-weight: 600; white-space: nowrap; min-width: 110px; text-align: right; }
        .dec { font-size: var(--text-xs); font-weight: 700; &.approved { color: var(--color-ok); } &.queried { color: var(--color-warn); } &.rejected { color: var(--color-danger); } }
        .pre { font-size: var(--text-xs); color: var(--color-warn); }
        .decide button.sel { background: var(--color-primary-soft); color: var(--color-primary); } }
      .deccomment { display: flex; align-items: center; gap: 6px; padding: 4px 12px 8px 40px; font-size: var(--text-xs); color: var(--color-text-2); mat-icon { font-size: 14px; width: 14px; height: 14px; } }
      .body { padding: 8px 12px 12px 40px; border-top: 1px solid var(--color-line); background: var(--color-surface); }
      &.dec-Approved { border-left: 3px solid var(--color-ok); } &.dec-Queried { border-left: 3px solid var(--color-warn); } &.dec-Rejected { border-left: 3px solid var(--color-danger); opacity: .8; } }
    .chksum { display: flex; gap: 8px; margin-bottom: 8px; span { font-size: var(--text-xs); font-weight: 700; padding: 2px 8px; border-radius: 999px; background: var(--color-surface-3); &.fail { color: var(--color-danger); } &.review { color: var(--color-warn); } &.pass { color: var(--color-ok); } } }
    .cr-findings { list-style: none; margin: 0; padding: 0; li { display: flex; flex-wrap: wrap; gap: 4px 6px; padding: 6px 8px; border-left: 3px solid var(--color-line); margin-bottom: 4px; font-size: var(--text-xs); background: var(--color-surface-2); border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
      .code { font-family: var(--font-mono); color: var(--color-text-3); } strong { color: var(--color-text); } em { color: var(--color-text-2); } > span:last-child { flex-basis: 100%; color: var(--color-text-2); }
      &.fail { border-color: var(--color-danger); } &.review { border-color: var(--color-warn); } &.pass { border-color: var(--color-ok); opacity: .7; } } }
    .appr-row { display: flex; gap: 8px; align-items: flex-start; padding: 6px 0; mat-icon { color: var(--color-text-3); } &.done mat-icon { color: var(--color-ok); } strong { display: block; font-size: var(--text-sm); } small { display: block; color: var(--color-text-3); font-size: var(--text-xs); } }
    .hash { font-family: var(--font-mono); font-size: 10px; color: var(--color-text-3); }
    .sig { display: flex; align-items: center; gap: 6px; font-size: var(--text-xs); color: var(--color-text-2); padding: 4px 0; mat-icon { font-size: 16px; width: 16px; height: 16px; } }
    .cr-trail { list-style: none; margin: 0; padding: 0; max-height: 420px; overflow: auto; li { display: grid; grid-template-columns: 90px 1fr; gap: 0 8px; padding: 6px 0; border-bottom: 1px solid var(--color-line); font-size: var(--text-xs); .when { color: var(--color-text-3); font-family: var(--font-mono); } .who { font-weight: 600; } .what { grid-column: 2; color: var(--color-text-2); } .cmt { grid-column: 2; color: var(--color-text-3); white-space: pre-wrap; } } }
    .search { height: 36px; padding: 0 10px; border: 1px solid var(--color-line-strong); border-radius: var(--radius-control); font: inherit; }
  `]
})
export class FinanceCreditorsComponent implements OnInit {
  private api = inject(CreditorPacksService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('sigpad') sigpad?: ElementRef<HTMLCanvasElement>;

  meta = signal<CreditorMeta | null>(null);
  rows = signal<BatchRow[]>([]);
  alerts = signal<CreditorAlert[]>([]);
  showAlerts = signal(false);
  openPrepay = signal(0);
  loading = signal(false);
  busy = signal(false);
  view = signal<View>('board');
  batch = signal<BatchDetail | null>(null);
  companyFilter = signal('');
  statusFilter = signal('');
  typeFilter = signal('');
  newOpen = signal(false);
  signOpen = signal(false);
  itemForm = signal<'new' | number | null>(null);
  openItem = signal(0);
  users = signal<{ id: number; name: string; email: string; role: string; permissions?: string }[]>([]);
  adminCompanies = signal<Partial<CreditorCompany>[]>([]);
  userSearch = '';

  newBatch = { companyCode: '', paymentType: 'DailyCreditor', batchDate: new Date().toISOString().slice(0, 10), notes: '' };
  itemDraft: ItemInput = { ...EMPTY_ITEM };
  signName = ''; signComment = '';
  private pendingType = ''; private pendingItem: number | null = null; private pendingReplace: BatchDoc | null = null;
  private drawing = false; private drew = false;

  readonly steps = [
    { key: 'Draft', title: 'Prepare', icon: 'edit_note' }, { key: 'Checks', title: 'Checks', icon: 'rule' }, { key: 'AwaitingAccountant', title: 'Accountant', icon: 'fact_check' },
    { key: 'AwaitingDirector', title: 'Director', icon: 'draw' }, { key: 'Approved', title: 'Approved', icon: 'lock' }, { key: 'LoadedOnBank', title: 'Bank', icon: 'account_balance' },
    { key: 'Paid', title: 'Paid', icon: 'price_check' }, { key: 'Closed', title: 'Closed', icon: 'inventory' }
  ];
  private readonly order = ['Draft', 'Checks', 'AwaitingAccountant', 'AwaitingDirector', 'Approved', 'LoadedOnBank', 'Paid', 'Closed'];

  activeCompanies = computed(() => (this.meta()?.companies ?? []).filter(c => c.isActive));
  filteredRows = computed(() => {
    const co = this.companyFilter(), st = this.statusFilter(), ty = this.typeFilter();
    return this.rows().filter(r => (!co || r.companyCode === co) && (!ty || r.paymentType === ty) &&
      (!st || (st === 'prepay' ? r.openPrepayments > 0 : st === 'ChecksFailed' ? ['ChecksFailed', 'QueriedByAccountant', 'QueriedByDirector'].includes(r.status) : st === 'Approved' ? ['Approved', 'LoadedOnBank'].includes(r.status) : r.status === st)));
  });

  ngOnInit(): void {
    this.api.meta().subscribe({
      next: m => { this.meta.set(m); if (!this.newBatch.companyCode) this.newBatch.companyCode = m.companies.find(c => c.isActive)?.code ?? ''; this.loadBoard();
        const id = Number(this.route.snapshot.queryParamMap.get('batch')); if (id) this.open(id); },
      error: () => this.toast.error("Couldn't open creditors. Check your Finance access.")
    });
  }

  loadBoard(): void {
    this.loading.set(true);
    this.api.list().subscribe({ next: r => { this.rows.set(r); this.loading.set(false); this.openPrepay.set(r.reduce((n, x) => n + x.openPrepayments, 0)); }, error: () => { this.loading.set(false); this.toast.error("Couldn't load batches."); } });
    this.api.alerts().subscribe({ next: a => this.alerts.set(a), error: () => {} });
  }
  count(s: string): number { return this.rows().filter(r => r.status === s).length; }
  companyFor(code: string) { return this.meta()?.companies.find(c => c.code === code); }
  typeTitle(k: string) { return this.meta()?.paymentTypes.find(p => p.key === k)?.title ?? k; }
  statusTitle(k: string) { return this.meta()?.statuses.find(s => s.key === k)?.title ?? k; }
  docTitle(k: string) { return this.meta()?.docTypes.find(d => d.key === k)?.title ?? k; }
  docTypesFor(itemId: number | null) { return (this.meta()?.docTypes ?? []).filter(d => itemId ? d.scope === 'item' || d.key === 'Other' : d.scope === 'batch' || d.key === 'Other'); }
  badge(s: string) { return s === 'Approved' || s === 'Paid' || s === 'Closed' || s === 'LoadedOnBank' ? 'ok' : s.startsWith('Awaiting') ? 'warn' : s === 'ChecksFailed' || s.startsWith('Queried') || s === 'Rejected' ? 'bad' : s === 'Draft' ? '' : 'info'; }
  responsibleName(id?: number) { if (!id) return ''; const c = this.meta()?.companies ?? []; for (const x of c) { if (x.accountantUserId === id) return x.accountantName ?? ''; if (x.backupApproverUserId === id) return x.backupApproverName ?? ''; if (x.directorUserId === id) return x.directorName ?? ''; if (x.delegateDirectorUserId === id) return x.delegateDirectorName ?? ''; } return ''; }

  stepState(b: BatchDetail, key: string): 'done' | 'now' | 'bad' | '' {
    const cur = b.status === 'ChecksFailed' ? 'Checks' : b.status === 'QueriedByAccountant' ? 'AwaitingAccountant' : b.status === 'QueriedByDirector' || b.status === 'Rejected' ? 'AwaitingDirector' : b.status;
    const ci = this.order.indexOf(cur), ki = this.order.indexOf(key);
    if (ki < ci) return 'done';
    if (ki === ci) return b.status === 'ChecksFailed' || b.status.startsWith('Queried') || b.status === 'Rejected' ? 'bad' : b.status === 'Closed' ? 'done' : 'now';
    return '';
  }
  approvedCount(b: BatchDetail) { return b.items.filter(i => i.decisionStatus === 'Approved').length; }
  filledCount(r: RequiredDoc[]) { return r.filter(x => x.filled).length; }
  sortedFindings(b: BatchDetail) { const w: Record<string, number> = { FAIL: 0, REVIEW: 1, PASS: 2 }; return [...(b.checks?.findings ?? [])].sort((a, c) => w[a.severity] - w[c.severity]); }
  findingsFor(itemId: number) { return (this.batch()?.checks?.findings ?? []).filter(f => f.itemId === itemId && f.severity !== 'PASS'); }

  // ── navigation ──
  open(id: number): void {
    this.busy.set(true);
    this.api.get(id).subscribe({
      next: b => { this.batch.set(b); this.view.set('batch'); this.busy.set(false); this.signOpen.set(false); this.itemForm.set(null); this.router.navigate([], { relativeTo: this.route, queryParams: { batch: id }, queryParamsHandling: 'merge', replaceUrl: true }); },
      error: () => { this.busy.set(false); this.toast.error("Couldn't open that batch."); }
    });
  }
  back(): void { this.view.set('board'); this.batch.set(null); this.router.navigate([], { relativeTo: this.route, queryParams: { batch: null }, queryParamsHandling: 'merge', replaceUrl: true }); this.loadBoard(); }
  private apply = (b: BatchDetail, msg?: string) => { this.batch.set(b); this.busy.set(false); if (msg) this.toast.done(msg); };
  private fail = (e: any, fallback: string) => { this.busy.set(false); this.toast.error(e?.error?.message || fallback); };

  // ── batch ──
  create(): void {
    this.busy.set(true);
    this.api.create({ ...this.newBatch, notes: this.newBatch.notes || undefined }).subscribe({ next: b => { this.newOpen.set(false); this.apply(b, `${b.batchNumber} created`); this.view.set('batch'); }, error: e => this.fail(e, "Couldn't create the batch.") });
  }
  deleteBatch(): void { const b = this.batch()!; if (!confirm(`Delete draft ${b.batchNumber}?`)) return; this.api.delete(b.id).subscribe({ next: () => { this.toast.done('Draft deleted'); this.back(); }, error: e => this.fail(e, "Couldn't delete.") }); }
  submit(): void { const b = this.batch()!; this.busy.set(true); this.api.submit(b.id).subscribe({ next: r => this.apply(r, r.status === 'ChecksFailed' ? 'Checks failed — see what to fix' : 'Sent to the accountant'), error: e => this.fail(e, "Couldn't submit.") }); }
  rerun(): void { const b = this.batch()!; this.busy.set(true); this.api.rerunChecks(b.id).subscribe({ next: r => this.apply(r, `Checks: ${r.checksStatus}`), error: e => this.fail(e, "Couldn't run the checks.") }); }
  accountant(d: 'approve' | 'query'): void {
    const b = this.batch()!; const c = prompt(d === 'approve' ? 'Comment (optional):' : 'What needs fixing?'); if (d === 'query' && !c) return; if (c === null && d === 'query') return;
    this.busy.set(true); this.api.accountant(b.id, d, c || undefined).subscribe({ next: r => this.apply(r, d === 'approve' ? 'Approved — now with the director' : 'Sent back to the preparer'), error: e => this.fail(e, "Couldn't record your decision.") });
  }
  decide(it: BatchItem, d: string): void {
    const b = this.batch()!; let c: string | null = null;
    if (d !== 'Approved') { c = prompt(d === 'Queried' ? `Why query ${it.supplierName}?` : `Why reject ${it.supplierName}?`); if (!c) return; }
    this.busy.set(true); this.api.decide(b.id, it.id, d, c || undefined).subscribe({ next: r => this.apply(r), error: e => this.fail(e, "Couldn't save the decision.") });
  }
  decideAll(d: string): void { const b = this.batch()!; const pend = b.items.filter(i => i.decisionStatus === 'Pending'); if (!pend.length) return; this.busy.set(true); let n = 0; for (const it of pend) this.api.decide(b.id, it.id, d).subscribe({ next: r => { if (++n === pend.length) this.apply(r, `${n} payment(s) approved`); }, error: e => this.fail(e, "Couldn't approve all.") }); }
  sign(): void {
    const b = this.batch()!; const img = this.drew && this.sigpad ? this.sigpad.nativeElement.toDataURL('image/png') : undefined;
    this.busy.set(true); this.api.sign(b.id, this.signName, this.signComment || undefined, img).subscribe({ next: r => { this.signOpen.set(false); this.apply(r, r.status === 'Approved' ? 'Signed and locked' : r.status === 'Rejected' ? 'Batch rejected' : 'Queries sent back to the preparer'); }, error: e => this.fail(e, "Couldn't sign.") });
  }
  setStatus(s: 'LoadedOnBank' | 'Paid' | 'Closed' | 'Draft'): void { const b = this.batch()!; this.busy.set(true); this.api.setStatus(b.id, s).subscribe({ next: r => this.apply(r, this.statusTitle(r.status)), error: e => this.fail(e, "Couldn't change the status.") }); }
  bankFile(): void { const b = this.batch()!; this.api.bankFile(b.id).subscribe({ next: blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${b.batchNumber}-bank.csv`; a.click(); URL.revokeObjectURL(a.href); this.open(b.id); }, error: e => this.fail(e, "Couldn't export.") }); }

  // ── items ──
  startItem(it?: BatchItem): void { this.itemDraft = it ? { supplierName: it.supplierName, supplierVatNumber: it.supplierVatNumber ?? '', invoiceNumbers: it.invoiceNumbers ?? '', description: it.description ?? '', amount: it.amount, bankName: it.bankName ?? '', accountNumber: it.accountNumber ?? '', branchCode: it.branchCode ?? '', accountHolder: it.accountHolder ?? '', paymentReference: it.paymentReference ?? '', stockReturned: it.stockReturned } : { ...EMPTY_ITEM }; this.itemForm.set(it ? it.id : 'new'); }
  saveItem(): void {
    const b = this.batch()!; const f = this.itemForm(); this.busy.set(true);
    const req = f === 'new' ? this.api.addItem(b.id, this.itemDraft) : this.api.updateItem(b.id, f as number, this.itemDraft);
    req.subscribe({ next: r => { this.itemForm.set(null); this.apply(r); if (f === 'new') this.openItem.set(r.items[r.items.length - 1]?.id ?? 0); }, error: e => this.fail(e, "Couldn't save the payment.") });
  }
  removeItem(it: BatchItem): void { const b = this.batch()!; if (!confirm(`Remove ${it.supplierName} and its documents?`)) return; this.busy.set(true); this.api.deleteItem(b.id, it.id).subscribe({ next: r => this.apply(r), error: e => this.fail(e, "Couldn't remove.") }); }

  // ── documents ──
  pickFor(docType: string, itemId: number | null): void { this.pendingType = docType; this.pendingItem = itemId; this.pendingReplace = null; this.fileInput?.nativeElement.click(); }
  replaceDoc(d: BatchDoc): void { const reason = prompt('Why is this document being replaced? (recorded in the audit trail)'); if (!reason) return; this.pendingType = d.docType; this.pendingItem = d.itemId ?? null; this.pendingReplace = { ...d, versionReason: reason }; this.fileInput?.nativeElement.click(); }
  filesChosen(e: Event): void { const inp = e.target as HTMLInputElement; const files = Array.from(inp.files ?? []); inp.value = ''; this.uploadAll(files, this.pendingItem, this.pendingType); }
  drop(e: DragEvent, itemId: number | null): void { e.preventDefault(); this.uploadAll(Array.from(e.dataTransfer?.files ?? []), itemId, ''); }
  private uploadAll(files: File[], itemId: number | null, docType: string): void {
    const b = this.batch()!; const pdfs = files.filter(f => /\.pdf$/i.test(f.name)); if (!pdfs.length) { this.toast.warn('PDF files only — one document per file.'); return; }
    this.busy.set(true); let i = 0;
    const next = () => { if (i >= pdfs.length) { this.busy.set(false); this.toast.done(`${pdfs.length} file(s) added — confirm the document types`); return; }
      const f = pdfs[i++]; const rep = this.pendingReplace;
      this.api.upload(b.id, f, docType || undefined, itemId, rep?.id, rep?.versionReason).subscribe({ next: r => { this.batch.set(r); this.pendingReplace = null; next(); }, error: e => { this.toast.error(`${f.name}: ${e?.error?.message || 'upload failed'}`); next(); } }); };
    next();
  }
  retype(d: BatchDoc, t: string): void { const b = this.batch()!; this.api.updateDoc(b.id, d.id, { docType: t }).subscribe({ next: r => this.batch.set(r), error: e => this.fail(e, "Couldn't change the type.") }); }
  removeDoc(d: BatchDoc): void { const b = this.batch()!; this.api.deleteDoc(b.id, d.id).subscribe({ next: r => this.batch.set(r), error: e => this.fail(e, "Couldn't remove the document.") }); }
  markNa(r: RequiredDoc, itemId: number | null): void { const b = this.batch()!; const reason = prompt(`Why does "${r.title}" not apply here?`); if (!reason) return; this.api.markNa(b.id, r.docType, itemId, reason).subscribe({ next: x => this.batch.set(x), error: e => this.fail(e, "Couldn't mark N/A.") }); }
  openDoc(d: BatchDoc): void { const b = this.batch()!; this.api.file(b.id, d.id).subscribe({ next: blob => window.open(URL.createObjectURL(blob), '_blank'), error: () => this.toast.error("Couldn't open the file.") }); }

  // ── signature pad ──
  private ctx(): CanvasRenderingContext2D | null { const c = this.sigpad?.nativeElement; if (!c) return null; const x = c.getContext('2d'); if (x) { x.lineWidth = 2; x.lineCap = 'round'; x.strokeStyle = '#111'; } return x; }
  private pos(e: PointerEvent) { const c = this.sigpad!.nativeElement; const r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * c.width / r.width, y: (e.clientY - r.top) * c.height / r.height }; }
  padDown(e: PointerEvent) { const x = this.ctx(); if (!x) return; this.drawing = true; const p = this.pos(e); x.beginPath(); x.moveTo(p.x, p.y); }
  padMove(e: PointerEvent) { if (!this.drawing) return; const x = this.ctx(); if (!x) return; const p = this.pos(e); x.lineTo(p.x, p.y); x.stroke(); this.drew = true; }
  padUp() { this.drawing = false; }
  padClear() { const c = this.sigpad?.nativeElement; c?.getContext('2d')?.clearRect(0, 0, c.width, c.height); this.drew = false; }

  // ── admin ──
  openAdmin(): void { this.view.set('admin'); this.adminCompanies.set((this.meta()?.companies ?? []).map(c => ({ ...c }))); this.loadUsers(); }
  loadUsers(): void { this.api.users(this.userSearch || undefined).subscribe({ next: u => this.users.set(u), error: () => {} }); }
  hasRole(u: { permissions?: string }, role: string): boolean { return (u.permissions ?? '').split(/[,\[\]" ]+/).includes(role); }
  usersWith(role: string) { return this.users().filter(u => this.hasRole(u, role) || u.role === 'Admin' || u.role === 'Super Admin'); }
  setRole(u: { id: number; permissions?: string }, role: string, grant: boolean): void { this.api.toggleRole(u.id, role, grant).subscribe({ next: r => { u.permissions = r.permissions; this.users.set([...this.users()]); }, error: e => this.fail(e, "Couldn't change the role.") }); }
  addCompanyRow(): void { this.adminCompanies.set([...this.adminCompanies(), { code: '', name: '', isActive: true, sortOrder: this.adminCompanies().length + 1, accountantUserId: null, backupApproverUserId: null, directorUserId: null, delegateDirectorUserId: null }]); }
  saveCompany(c: Partial<CreditorCompany>): void {
    this.busy.set(true);
    const req = c.id ? this.api.updateCompany(c.id, c) : this.api.addCompany(c);
    req.subscribe({ next: () => { this.busy.set(false); this.toast.done(`${c.code} saved`); this.api.meta().subscribe(m => { this.meta.set(m); this.adminCompanies.set(m.companies.map(x => ({ ...x }))); }); }, error: e => this.fail(e, "Couldn't save the company.") });
  }
}
