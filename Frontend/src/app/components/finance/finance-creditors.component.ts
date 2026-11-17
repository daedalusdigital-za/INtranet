import { Component, OnInit, inject, signal, computed, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { PackPreviewDialogComponent } from './pack-preview-dialog.component';
import { ToastService } from '../../ui/toast.service';
import { CreditorPacksService, CreditorMeta, BatchRow, BatchDetail, BatchItem, BatchDoc, ItemInput, CreditorAlert, RequiredDoc, CheckFinding, SupplierHit, BooksInvoiceHit } from '../../services/creditor-packs.service';

type View = 'board' | 'batch';
interface NextStep { icon: string; tone: 'info' | 'warn' | 'ok' | 'bad' | 'muted'; title: string; body: string; }

const EMPTY_ITEM: ItemInput = { supplierName: '', supplierVatNumber: '', invoiceNumbers: '', description: '', amount: 0, bankName: '', accountNumber: '', branchCode: '', accountHolder: '', paymentReference: '', stockReturned: false };

/**
 * Finance → Creditors. Payment packs per paying company. The screen is organised around
 * "what do I need to do next": the board lists batches waiting on you first, and every batch
 * opens with a plain-language next-step card and the buttons that go with it.
 */
@Component({
  selector: 'app-finance-creditors',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, MatButtonModule, MatTooltipModule, MatProgressSpinnerModule, MatCheckboxModule],
  template: `
  @if (!meta()) {
    <div class="cr-state"><mat-spinner diameter="36"></mat-spinner><p>Opening creditors…</p></div>
  } @else {

  <!-- ═══════════════════════ BOARD ═══════════════════════ -->
  @if (view() === 'board') {

    <div class="cr-how" [class.open]="howOpen()">
      <button class="hd" (click)="howOpen.set(!howOpen())"><mat-icon>help_outline</mat-icon> How a payment pack moves <mat-icon class="tw">{{ howOpen() ? 'expand_less' : 'expand_more' }}</mat-icon></button>
      @if (howOpen()) {
        <ol>
          <li><strong>Prepare</strong> — a clerk creates a batch, adds each payment (upload the invoice or link one from Books and the details fill in; suppliers are found from past invoices and payments) and attaches the documents the list asks for.</li>
          <li><strong>Checks</strong> — the system reads the PDFs and flags problems (missing docs, old bank letters, duplicates…).</li>
          <li><strong>Accountant</strong> — the company's accountant approves or sends it back.</li>
          <li><strong>Director</strong> — approves / queries / rejects each payment, then signs. The pack locks.</li>
          <li><strong>Bank</strong> — the bank user downloads the bank file, loads it, marks it paid.</li>
          <li><strong>Close</strong> — proof of payment is attached for every payment and the pack is closed.</li>
        </ol>
      }
    </div>

    @if (mine().length) {
      <section class="cr-mine">
        <h3><mat-icon>notifications_active</mat-icon> Needs your action <span class="n">{{ mine().length }}</span></h3>
        <div class="cards">
          @for (r of mine(); track r.id) {
            <button [class]="'mcard tone-' + rowStep(r).tone" (click)="open(r.id)">
              <div class="top"><span class="ref">{{ r.batchNumber }}</span><span class="co">{{ r.companyCode }}</span><span class="amt">R {{ r.totalAmount | number:'1.0-0' }}</span></div>
              <div class="what"><mat-icon>{{ rowStep(r).icon }}</mat-icon> {{ rowStep(r).title }}</div>
              <div class="sub">{{ typeTitle(r.paymentType) }} · {{ r.items }} payment{{ r.items === 1 ? '' : 's' }}@if (r.returnReason && isSentBack(r.status)) { · <em>{{ r.returnReason }}</em> }</div>
            </button>
          }
        </div>
      </section>
    }

    @if (alerts().length) {
      <div class="cr-alerts">
        <mat-icon>gpp_maybe</mat-icon>
        <div class="txt"><strong>{{ alerts().length }} thing{{ alerts().length === 1 ? '' : 's' }} worth a second look</strong> — new bank details, old bank letters, possible duplicates, prepayments still open.</div>
        <button mat-button (click)="showAlerts.set(!showAlerts())">{{ showAlerts() ? 'Hide' : 'Show' }}</button>
      </div>
      @if (showAlerts()) {
        <div class="cr-alert-list">
          @for (a of alerts(); track $index) {
            <button class="cr-alert" [class.fail]="a.severity === 'FAIL'" (click)="open(a.batchId)">
              <span class="b">{{ a.batchNumber }} · {{ a.companyCode }}</span><span class="t">{{ a.title }}</span><span class="d">{{ a.detail }}</span>
            </button>
          }
        </div>
      }
    }

    <div class="cr-toolbar">
      <div class="cr-seg">
        <button [class.on]="statusFilter() === ''" (click)="statusFilter.set('')">All <b>{{ rows().length }}</b></button>
        <button [class.on]="statusFilter() === 'open'" (click)="statusFilter.set('open')">In progress <b>{{ countOpen() }}</b></button>
        <button [class.on]="statusFilter() === 'back'" (click)="statusFilter.set('back')">Sent back <b>{{ count('ChecksFailed') + count('QueriedByAccountant') + count('QueriedByDirector') }}</b></button>
        <button [class.on]="statusFilter() === 'pay'" (click)="statusFilter.set('pay')">To pay <b>{{ count('Approved') + count('LoadedOnBank') }}</b></button>
        <button [class.on]="statusFilter() === 'Paid'" (click)="statusFilter.set('Paid')">Paid · needs POP <b>{{ count('Paid') }}</b></button>
        <button [class.on]="statusFilter() === 'prepay'" (click)="statusFilter.set('prepay')">Open prepayments <b>{{ openPrepay() }}</b></button>
        <button [class.on]="statusFilter() === 'Closed'" (click)="statusFilter.set('Closed')">Closed <b>{{ count('Closed') }}</b></button>
      </div>
      <span class="cr-spacer"></span>
      <select [ngModel]="companyFilter()" (ngModelChange)="companyFilter.set($event)">
        <option value="">All companies</option>
        @for (c of activeCompanies(); track c.code) { <option [value]="c.code">{{ c.code }} — {{ c.name }}</option> }
      </select>
      <select [ngModel]="typeFilter()" (ngModelChange)="typeFilter.set($event)">
        <option value="">All payment types</option>
        @for (p of meta()!.paymentTypes; track p.key) { <option [value]="p.key">{{ p.title }}</option> }
      </select>
      <button mat-icon-button (click)="loadBoard()" matTooltip="Refresh"><mat-icon>refresh</mat-icon></button>
      @if (meta()!.me.isAdmin) { <a mat-stroked-button routerLink="/settings/payment-approvers" matTooltip="Companies & approvers are managed in Settings"><mat-icon>approval</mat-icon> Approvers</a> }
      @if (meta()!.me.clerk) { <button mat-flat-button color="primary" (click)="newOpen.set(true)"><mat-icon>add</mat-icon> New batch</button> }
    </div>

    @if (newOpen()) {
      <div class="cr-card cr-new">
        <h3>Start a new payment batch</h3>
        <p class="lead">One batch = one paying company + one kind of payment. You'll add the individual payments on the next screen.</p>
        <div class="row">
          <label>Which company is paying?
            <select [(ngModel)]="newBatch.companyCode">
              @for (c of activeCompanies(); track c.code) { <option [value]="c.code">{{ c.code }} — {{ c.name }}</option> }
            </select>
          </label>
          <label>What kind of payment?
            <select [(ngModel)]="newBatch.paymentType">
              @for (p of meta()!.paymentTypes; track p.key) { <option [value]="p.key">{{ p.title }}</option> }
            </select>
          </label>
          <label>Payment date <input type="date" [(ngModel)]="newBatch.batchDate"></label>
          <label class="grow">Note for the approvers (optional) <input type="text" [(ngModel)]="newBatch.notes" placeholder="e.g. Week 46 daily creditors"></label>
        </div>
        @if (companyFor(newBatch.companyCode); as co) {
          <p class="hint" [class.warn]="!co.accountantUserId">
            <mat-icon>{{ co.accountantUserId ? 'verified_user' : 'warning' }}</mat-icon>
            <span>This pack will go to <strong>{{ co.accountantName || 'any accountant (none assigned yet)' }}</strong> for approval and then to <strong>{{ co.directorName || 'a director (none assigned yet)' }}</strong> to sign.</span>
          </p>
        }
        <p class="hint"><mat-icon>checklist</mat-icon> <span>Documents needed per payment for <strong>{{ typeTitle(newBatch.paymentType) }}</strong>: {{ rulesSummary(newBatch.paymentType) }}</span></p>
        <div class="actions"><button mat-button (click)="newOpen.set(false)">Cancel</button><button mat-flat-button color="primary" [disabled]="!newBatch.companyCode || busy()" (click)="create()">Create batch</button></div>
      </div>
    }

    @if (loading()) { <div class="cr-state"><mat-spinner diameter="32"></mat-spinner></div> }
    @else if (!filteredRows().length) {
      <div class="cr-state"><mat-icon>inbox</mat-icon><h3>Nothing here</h3><p>No batches match these filters.</p></div>
    } @else {
      <div class="cr-table-wrap">
        <table class="cr-table">
          <thead><tr><th>Batch</th><th>Company</th><th>Payment type</th><th class="num">Amount</th><th>Where it is</th><th>Waiting on</th><th>Last change</th><th></th></tr></thead>
          <tbody>
            @for (r of filteredRows(); track r.id) {
              <tr (click)="open(r.id)">
                <td><span class="ref">{{ r.batchNumber }}</span><br><small class="muted">{{ r.batchDate | date:'dd MMM' }} · {{ r.items }} payment{{ r.items === 1 ? '' : 's' }}</small></td>
                <td><strong>{{ r.companyCode }}</strong><br><small class="muted">{{ companyFor(r.companyCode)?.name }}</small></td>
                <td>{{ typeTitle(r.paymentType) }}</td>
                <td class="num">R {{ r.totalAmount | number:'1.2-2' }}</td>
                <td>
                  <span [class]="'badge ' + badge(r.status)">{{ r.statusTitle }}</span>
                  @if (r.returnReason && isSentBack(r.status)) { <div class="reason">{{ r.returnReason }}</div> }
                  @if (r.openPrepayments) { <div class="reason warn">{{ r.openPrepayments }} prepayment{{ r.openPrepayments === 1 ? '' : 's' }} awaiting invoice + GRV</div> }
                </td>
                <td class="who">{{ waitingOn(r) }}</td>
                <td class="nowrap muted">{{ (r.updatedAt || r.createdAt) | date:'dd MMM HH:mm' }}</td>
                <td class="actions"><mat-icon>chevron_right</mat-icon></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  }

  <!-- ═══════════════════════ BATCH ═══════════════════════ -->
  @if (view() === 'batch' && batch(); as b) {
    <div class="cr-bhead">
      <button mat-icon-button (click)="back()" aria-label="Back to all batches" matTooltip="All batches"><mat-icon>arrow_back</mat-icon></button>
      <div class="ttl">
        <h2>{{ b.batchNumber }} <span [class]="'badge lg ' + badge(b.status)">{{ b.statusTitle }}</span>
          @if (b.lockedAt) { <mat-icon class="lock" matTooltip="Signed and locked — nothing can be changed">lock</mat-icon> }
        </h2>
        <p><strong>{{ b.companyName }}</strong> is paying · {{ b.paymentTypeTitle }} · dated {{ b.batchDate | date:'dd MMM yyyy' }} · prepared by {{ b.preparedByName }}@if (b.notes) { · “{{ b.notes }}” }</p>
      </div>
      <div class="sum">
        @if (b.approvedAmount && b.approvedAmount !== b.totalAmount) {
          <span class="l">Approved to pay</span><span class="v">R {{ b.approvedAmount | number:'1.2-2' }}</span><span class="l">of R {{ b.totalAmount | number:'1.2-2' }} requested</span>
        } @else {
          <span class="l">Total</span><span class="v">R {{ b.totalAmount | number:'1.2-2' }}</span>
        }
      </div>
    </div>

    <ol class="cr-steps">
      @for (s of steps; track s.key) {
        <li [class.done]="stepState(b, s.key) === 'done'" [class.now]="stepState(b, s.key) === 'now'" [class.bad]="stepState(b, s.key) === 'bad'">
          <span class="dot"><mat-icon>{{ stepState(b, s.key) === 'done' ? 'check' : stepState(b, s.key) === 'bad' ? 'priority_high' : s.icon }}</mat-icon></span><span class="t">{{ s.title }}</span>
        </li>
      }
    </ol>

    @if (nextStep(b); as ns) {
      <div [class]="'cr-next tone-' + ns.tone">
        <mat-icon class="big">{{ ns.icon }}</mat-icon>
        <div class="txt"><h3>{{ ns.title }}</h3><p>{{ ns.body }}</p></div>
        <div class="btns">
          @if (b.can.reopen) { <button mat-flat-button color="primary" (click)="setStatus('Draft')"><mat-icon>edit</mat-icon> Reopen & fix</button> }
          @if (b.can.edit) { <button mat-flat-button color="primary" [disabled]="!b.can.submit || busy()" (click)="submit()"><mat-icon>send</mat-icon> Submit to accountant</button> }
          @if (b.can.accountant) {
            <button mat-flat-button color="primary" (click)="accountant('approve')" [disabled]="busy()"><mat-icon>task_alt</mat-icon> Approve</button>
            <button mat-stroked-button (click)="accountant('query')" [disabled]="busy()"><mat-icon>reply</mat-icon> Send back</button>
          }
          @if (b.can.direct) {
            @if (pendingCount(b) > 0) { <button mat-stroked-button (click)="decideAll('Approved')" [disabled]="busy()"><mat-icon>done_all</mat-icon> Approve all {{ pendingCount(b) }} pending</button> }
            <button mat-flat-button color="primary" [disabled]="!b.can.sign || busy()" (click)="signOpen.set(true)"><mat-icon>draw</mat-icon> Sign batch</button>
          }
          @if (b.can.bankFile) { <button mat-stroked-button (click)="bankFile()"><mat-icon>download</mat-icon> Download bank file</button> }
          @if (b.can.markLoaded) { <button mat-flat-button color="primary" (click)="setStatus('LoadedOnBank')"><mat-icon>account_balance</mat-icon> Loaded on bank</button> }
          @if (b.can.markPaid) { <button mat-flat-button color="primary" (click)="setStatus('Paid')"><mat-icon>price_check</mat-icon> Mark as paid</button> }
          @if (b.can.close) { <button mat-flat-button color="primary" (click)="setStatus('Closed')" [disabled]="missingPop(b) > 0 || openPrepayCount(b) > 0"><mat-icon>inventory</mat-icon> Close batch</button> }
          @if (b.can.rerunChecks && b.items.length && b.status !== 'Closed') { <button mat-button (click)="rerun()" [disabled]="busy()"><mat-icon>rule</mat-icon> Re-run checks</button> }
          @if (b.can.edit && b.status === 'Draft') { <button mat-button color="warn" (click)="deleteBatch()"><mat-icon>delete</mat-icon> Delete draft</button> }
        </div>
      </div>
    }

    @if (signOpen()) {
      <div class="cr-card cr-sign">
        <h3><mat-icon>draw</mat-icon> Sign this batch</h3>
        <ul class="facts">
          <li><mat-icon>business</mat-icon><span>{{ b.companyName }} pays <strong>R {{ b.approvedAmount | number:'1.2-2' }}</strong> across <strong>{{ approvedCount(b) }}</strong> approved payment{{ approvedCount(b) === 1 ? '' : 's' }}@if (queriedCount(b)) { · <span class="warn">{{ queriedCount(b) }} queried → pack goes back to the preparer</span> }@if (rejectedCount(b)) { · <span class="bad">{{ rejectedCount(b) }} rejected</span> }</span></li>
          <li><mat-icon>fact_check</mat-icon><span>Accountant <strong>{{ b.accountantName }}</strong> approved on {{ b.accountantApprovedAt | date:'dd MMM HH:mm' }}</span></li>
          <li><mat-icon>lock</mat-icon><span>After signing, the pack and its documents are locked and the bank file becomes available.</span></li>
        </ul>
        <label>Type your full name to sign <input type="text" [(ngModel)]="signName" placeholder="Your full name as on your profile"></label>
        <label>Draw your signature (optional)
          <canvas #sigpad width="520" height="140" class="sigpad" (pointerdown)="padDown($event)" (pointermove)="padMove($event)" (pointerup)="padUp()" (pointerleave)="padUp()"></canvas>
          <button mat-button type="button" (click)="padClear()">Clear</button>
        </label>
        <label>Comment (optional) <input type="text" [(ngModel)]="signComment"></label>
        <div class="actions"><button mat-button (click)="signOpen.set(false)">Cancel</button><button mat-flat-button color="primary" [disabled]="!signName || busy()" (click)="sign()">Sign & lock</button></div>
      </div>
    }

    <div class="cr-grid">
      <div class="cr-main">

        <section class="cr-card">
          <header>
            <h3><mat-icon>list_alt</mat-icon> Payments <span class="cnt">{{ b.items.length }}</span></h3>
            <small>{{ docsFilledItems(b) }} of {{ docsRequiredItems(b) }} required documents attached</small>
            @if (b.can.edit) { <button mat-flat-button color="primary" (click)="startItem()"><mat-icon>add</mat-icon> Add payment</button> }
          </header>

          @if (itemForm()) {
            <div class="cr-itemform">
              <h4>{{ itemForm() === 'new' ? 'New payment' : 'Edit payment' }}</h4>

              <h5>1 · Invoice and recon</h5>
              <div class="inv-src">
                @if (!pendingInvoiceFile && !pendingLink) {
                  <button mat-stroked-button (click)="invFileInput.click()" [disabled]="reading()"><mat-icon>upload_file</mat-icon> Upload invoice</button>
                  <button mat-stroked-button (click)="openPicker()"><mat-icon>link</mat-icon> Link from Books</button>
                  <small class="muted">We read the PDF and fill in who is being paid, the amount, invoice number, description and any bank details printed on it. Or link an invoice already captured in Books.</small>
                  @if (reading()) { <mat-spinner diameter="18"></mat-spinner> }
                } @else if (pendingInvoiceFile) {
                  <span class="chip ok"><mat-icon>picture_as_pdf</mat-icon> {{ pendingInvoiceFile.name }} @if (readInfo()) { · {{ readInfo() }} }</span>
                  <button mat-icon-button (click)="clearInvoice()" matTooltip="Remove"><mat-icon>close</mat-icon></button>
                } @else if (pendingLink) {
                  <span class="chip ok"><mat-icon>link</mat-icon> Books #{{ pendingLink.id }} · {{ pendingLink.supplierName }} · {{ pendingLink.invoiceNumber || 'no number' }} · R {{ pendingLink.total | number:'1.2-2' }}</span>
                  <button mat-icon-button (click)="clearInvoice()" matTooltip="Unlink"><mat-icon>close</mat-icon></button>
                }
                <input #invFileInput type="file" accept="application/pdf" hidden (change)="invoiceChosen($event)">
              </div>
              @if (itemForm() === 'new' && reconSlot()) {
                <div class="inv-src recon" [class.missing]="needsRecon() && !pendingReconFile">
                  @if (!pendingReconFile) {
                    <button mat-stroked-button (click)="reconFileInput.click()"><mat-icon>table_view</mat-icon> Upload supplier recon</button>
                    <small>@if (needsRecon()) { <mat-icon>priority_high</mat-icon> Required — every invoice must come with its recon } @else { Expected with the invoice } (.xlsx, .xls, .csv or .pdf). We read it too and fill in what the invoice didn't.</small>
                  } @else {
                    <span class="chip ok"><mat-icon>table_view</mat-icon> {{ pendingReconFile.name }} @if (reconInfo()) { · {{ reconInfo() }} }</span>
                    <button mat-icon-button (click)="pendingReconFile = null; reconInfo.set('')" matTooltip="Remove"><mat-icon>close</mat-icon></button>
                  }
                  <input #reconFileInput type="file" accept=".xlsx,.xls,.csv,application/pdf" hidden (change)="reconChosen($event)">
                </div>
                @if (sageSlot() && pendingReconFile) {
                  <div class="inv-src recon" [class.missing]="!pendingSageFile">
                    @if (!pendingSageFile) {
                      <button mat-stroked-button (click)="sageFileInput.click()"><mat-icon>picture_as_pdf</mat-icon> Upload Sage aged payables</button>
                      <small><mat-icon>priority_high</mat-icon> Required with the recon — PDF only.</small>
                    } @else {
                      <span class="chip ok"><mat-icon>picture_as_pdf</mat-icon> {{ pendingSageFile.name }}</span>
                      <button mat-icon-button (click)="pendingSageFile = null" matTooltip="Remove"><mat-icon>close</mat-icon></button>
                    }
                    <input #sageFileInput type="file" accept="application/pdf" hidden (change)="sageChosen($event)">
                  </div>
                }
              }
              @if (picker()) {
                <div class="picker">
                  <input [(ngModel)]="pickerQ" (ngModelChange)="searchBooks()" placeholder="Search Books invoices by supplier, number or amount…" autofocus>
                  <ul>
                    @for (h of pickerHits(); track h.id) {
                      <li [class.dis]="h.alreadyLinked" (click)="!h.alreadyLinked && pickBooks(h)">
                        <strong>{{ h.supplierName }}</strong> <span class="ref">{{ h.invoiceNumber || '—' }}</span> <span class="muted">{{ h.invoiceDate | date:'d MMM yy' }} · {{ h.companyName }} · {{ h.status }}</span>
                        <span class="amt">R {{ h.total | number:'1.2-2' }}</span>
                        @if (h.alreadyLinked) { <small>already in a pack</small> } @if (!h.hasPdf) { <small>no PDF</small> }
                      </li>
                    } @empty { <li class="none">{{ pickerQ.length < 2 ? 'Type to search…' : 'Nothing found.' }}</li> }
                  </ul>
                  <button mat-button (click)="picker.set(false)">Close</button>
                </div>
              }

              <h5>2 · Who and how much</h5>
              <div class="row">
                <label class="grow sup">Who is being paid?
                  <input [(ngModel)]="itemDraft.supplierName" (ngModelChange)="searchSuppliers($event)" (focus)="searchSuppliers(itemDraft.supplierName)" (blur)="hideSuppliersSoon()" placeholder="Start typing — we search past invoices, Books and payments" required autocomplete="off">
                  @if (supplierHits().length && showSuppliers()) {
                    <ul class="ac">
                      @for (s of supplierHits(); track s.name) {
                        <li (mousedown)="$event.preventDefault(); pickSupplier(s)">
                          <strong>{{ s.name }}</strong>
                          <small>@if (s.vatNumber) { VAT {{ s.vatNumber }} · } @if (s.bankName) { {{ s.bankName }} ···{{ (s.accountNumber || '').slice(-4) }} · } {{ s.payments }} payment{{ s.payments === 1 ? '' : 's' }}, {{ s.invoices }} invoice{{ s.invoices === 1 ? '' : 's' }}</small>
                        </li>
                      }
                    </ul>
                  }
                </label>
                <label>Amount incl. VAT (R) <input type="number" step="0.01" [(ngModel)]="itemDraft.amount"></label>
              </div>

              <h5>3 · What is it for</h5>
              <div class="row">
                <label class="grow">Invoice / reference numbers being paid <input [(ngModel)]="itemDraft.invoiceNumbers" placeholder="INV123, INV124"></label>
                <label class="grow">Description <input [(ngModel)]="itemDraft.description" placeholder="e.g. March stock, repairs to bakkie…"></label>
              </div>

              <h5>4 · Bank details (as on the bank letter)</h5>
              <div class="row">
                <label>Bank <input [(ngModel)]="itemDraft.bankName"></label>
                <label>Account number <input [(ngModel)]="itemDraft.accountNumber"></label>
                <label>Branch code <input [(ngModel)]="itemDraft.branchCode"></label>
                <label class="grow">Account holder <input [(ngModel)]="itemDraft.accountHolder"></label>
                <label>Reference on their statement <input [(ngModel)]="itemDraft.paymentReference"></label>
              </div>
              @if (b.paymentType === 'CreditNote') {
                <mat-checkbox [(ngModel)]="itemDraft.stockReturned">Stock physically came back (warehouse GRV + collection slip will be required)</mat-checkbox>
              }
              <div class="actions">
                @if (itemForm() === 'new' && needsRecon() && !pendingReconFile) { <small class="warn-txt"><mat-icon>warning</mat-icon> Attach the supplier recon before adding this payment.</small> }
                @else if (itemForm() === 'new' && needsSage()) { <small class="warn-txt"><mat-icon>warning</mat-icon> The recon must come with the Sage aged payables PDF.</small> }
                <button mat-button (click)="cancelItem()">Cancel</button><button mat-flat-button color="primary" [disabled]="!itemDraft.supplierName || !itemDraft.amount || busy() || (itemForm() === 'new' && ((needsRecon() && !pendingReconFile) || needsSage()))" (click)="saveItem()">{{ itemForm() === 'new' ? 'Add payment' : 'Save' }}</button>
              </div>
            </div>
          }

          @if (!b.items.length) {
            <div class="cr-empty"><mat-icon>add_card</mat-icon><p><strong>No payments yet.</strong> Click <em>Add payment</em> for each supplier you want to pay in this batch. The required documents will appear under each one.</p></div>
          }

          @for (it of b.items; track it.id) {
            <div [class]="'cr-item dec-' + it.decisionStatus" [class.open]="openItem() === it.id">
              <div class="head" (click)="openItem.set(openItem() === it.id ? 0 : it.id)">
                <mat-icon class="tw">{{ openItem() === it.id ? 'expand_more' : 'chevron_right' }}</mat-icon>
                <div class="who">
                  <strong>{{ it.supplierName }}</strong>
                  <small>{{ it.invoiceNumbers || it.description || 'no reference' }}@if (it.bankName) { · {{ it.bankName }} ···{{ (it.accountNumber || '').slice(-4) }} }</small>
                </div>
                <span class="docpill" [class.ok]="filledCount(it.required) === it.required.length" [class.none]="!it.required.length" [matTooltip]="missingNames(it.required)">
                  <mat-icon>{{ filledCount(it.required) === it.required.length ? 'check_circle' : 'description' }}</mat-icon>
                  {{ filledCount(it.required) }}/{{ it.required.length }} docs
                </span>
                @if (findingsFor(it.id).length) { <span class="flag" [class.fail]="hasFail(it.id)" [matTooltip]="findingsFor(it.id).length + ' check(s) to look at'"><mat-icon>flag</mat-icon>{{ findingsFor(it.id).length }}</span> }
                @if (it.prepaymentOpen && it.paidAt) { <span class="pre">awaiting invoice + GRV</span> }
                @if (it.decisionStatus !== 'Pending') { <span [class]="'dec ' + it.decisionStatus.toLowerCase()">{{ it.decisionStatus }}</span> }
                <span class="amt">R {{ it.amount | number:'1.2-2' }}</span>
                @if (previewableDocs(it).length) { <button mat-icon-button (click)="$event.stopPropagation(); previewItem(it)" [matTooltip]="'Review ' + (previewableDocs(it).length === 1 ? 'the document' : previewableDocs(it).length + ' documents')"><mat-icon>visibility</mat-icon></button> }
                @if (b.can.edit) {
                  <button mat-icon-button (click)="$event.stopPropagation(); startItem(it)" matTooltip="Edit"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button (click)="$event.stopPropagation(); removeItem(it)" matTooltip="Remove"><mat-icon>delete</mat-icon></button>
                }
              </div>

              @if (b.can.direct) {
                <div class="decide">
                  <span>Your decision:</span>
                  <button mat-stroked-button [class.sel-ok]="it.decisionStatus === 'Approved'" (click)="decide(it, 'Approved')"><mat-icon>thumb_up</mat-icon> Approve</button>
                  <button mat-stroked-button [class.sel-warn]="it.decisionStatus === 'Queried'" (click)="decide(it, 'Queried')"><mat-icon>help</mat-icon> Query</button>
                  <button mat-stroked-button [class.sel-bad]="it.decisionStatus === 'Rejected'" (click)="decide(it, 'Rejected')"><mat-icon>thumb_down</mat-icon> Reject</button>
                  @if (it.decisionComment) { <em>“{{ it.decisionComment }}”</em> }
                </div>
              } @else if (it.decisionComment) { <div class="deccomment"><mat-icon>chat</mat-icon> Director: “{{ it.decisionComment }}”</div> }

              @if (openItem() === it.id) {
                <div class="body">
                  <h5>Documents for this payment</h5>
                  <ng-container *ngTemplateOutlet="checklist; context: { required: it.required, recommended: it.recommended || [], docs: it.documents, itemId: it.id }"></ng-container>
                  @if (findingsFor(it.id).length) {
                    <h5>Checks on this payment</h5>
                    <ul class="cr-findings">
                      @for (f of findingsFor(it.id); track $index) { <li [class]="f.severity.toLowerCase()"><mat-icon>{{ f.severity === 'FAIL' ? 'cancel' : 'error_outline' }}</mat-icon><div><strong>{{ f.title }}</strong><span>{{ f.detail }}</span></div></li> }
                    </ul>
                  }
                  @if (b.can.edit || b.can.uploadAfterLock) {
                    <div class="drop" (dragover)="$event.preventDefault()" (drop)="drop($event, it.id)">
                      <mat-icon>upload_file</mat-icon> Drop PDFs (or an Excel recon) for <strong>{{ it.supplierName }}</strong> here, or <button mat-button (click)="pickFor('', it.id)">choose files</button>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </section>

        <section class="cr-card">
          <header><h3><mat-icon>folder</mat-icon> Documents for the whole batch</h3><small>{{ filledCount(b.requiredBatchDocs) }} of {{ b.requiredBatchDocs.length }} attached</small></header>
          <ng-container *ngTemplateOutlet="checklist; context: { required: b.requiredBatchDocs, recommended: [], docs: b.batchDocuments, itemId: null }"></ng-container>
          @if (b.can.edit || b.can.uploadAfterLock) {
            <div class="drop" (dragover)="$event.preventDefault()" (drop)="drop($event, null)">
              <mat-icon>upload_file</mat-icon> Drop batch PDFs here (payment schedule, creditors recon) or <button mat-button (click)="pickFor('', null)">choose files</button>
            </div>
          }
        </section>
      </div>

      <aside class="cr-side">
        <section class="cr-card">
          <header><h3><mat-icon>rule</mat-icon> System checks</h3>@if (b.checksRunAt) { <small>{{ b.checksRunAt | date:'dd MMM HH:mm' }}</small> }</header>
          @if (!b.checks) { <p class="empty">Run automatically when you submit. They look for missing documents, old bank letters, duplicate invoices, VAT numbers, mismatched totals and new bank accounts.</p> }
          @else {
            <div [class]="'chk-verdict ' + b.checks.status.toLowerCase()">
              <mat-icon>{{ b.checks.status === 'FAIL' ? 'cancel' : b.checks.status === 'REVIEW' ? 'error_outline' : 'check_circle' }}</mat-icon>
              <div>
                <strong>{{ b.checks.status === 'FAIL' ? 'Must be fixed before it can go further' : b.checks.status === 'REVIEW' ? 'Nothing blocking — a few things for the approvers to eyeball' : 'All clear' }}</strong>
                <small>{{ b.checks.fail }} blocking · {{ b.checks.review }} to review · {{ b.checks.pass }} passed</small>
              </div>
            </div>
            <ul class="cr-findings">
              @for (f of visibleFindings(b); track $index) {
                <li [class]="f.severity.toLowerCase()" (click)="f.itemId && openItem.set(f.itemId)">
                  <mat-icon>{{ f.severity === 'FAIL' ? 'cancel' : f.severity === 'REVIEW' ? 'error_outline' : 'check_circle' }}</mat-icon>
                  <div><strong>{{ f.title }}</strong>@if (f.supplier) { <em>{{ f.supplier }}</em> }<span>{{ f.detail }}</span></div>
                </li>
              }
            </ul>
            @if (b.checks.pass > 0) { <button mat-button class="link" (click)="showPassed.set(!showPassed())">{{ showPassed() ? 'Hide' : 'Show' }} {{ b.checks.pass }} passed</button> }
          }
        </section>

        <section class="cr-card">
          <header><h3><mat-icon>verified</mat-icon> Approvals</h3></header>
          <div class="appr-row" [class.done]="b.accountantApprovedAt">
            <mat-icon>{{ b.accountantApprovedAt ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
            <div><strong>1 · Company accountant</strong>
              <small>@if (b.accountantApprovedAt) { {{ b.accountantName }} · {{ b.accountantApprovedAt | date:'dd MMM HH:mm' }} } @else { {{ responsibleName(b.responsible.accountant) || 'Any accountant' }}@if (responsibleName(b.responsible.backup)) { (back-up {{ responsibleName(b.responsible.backup) }}) } }</small>
              @if (b.accountantComment) { <small class="q">“{{ b.accountantComment }}”</small> }
            </div>
          </div>
          <div class="appr-row" [class.done]="b.lockedAt">
            <mat-icon>{{ b.lockedAt ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
            <div><strong>2 · Director signature</strong>
              <small>@if (b.directorSignedAt) { {{ b.directorName }} · {{ b.directorSignedAt | date:'dd MMM HH:mm' }} } @else { {{ responsibleName(b.responsible.director) || 'Any director' }}@if (responsibleName(b.responsible.delegateDirector)) { (or {{ responsibleName(b.responsible.delegateDirector) }}) } }</small>
              @if (b.directorComment) { <small class="q">“{{ b.directorComment }}”</small> }
            </div>
          </div>
          @if (b.lockHash) { <small class="hash" matTooltip="Fingerprint of the batch at signing — proves nothing changed afterwards">Locked · fingerprint {{ b.lockHash | slice:0:12 }}…</small> }
        </section>

        <section class="cr-card">
          <header><h3><mat-icon>history</mat-icon> History</h3></header>
          <ul class="cr-trail">
            @for (e of b.events; track e.id) {
              <li><span class="when">{{ e.at | date:'dd MMM HH:mm' }}</span><span class="what"><strong>{{ e.userName }}</strong> {{ eventText(e) }}</span>@if (e.comment) { <span class="cmt">{{ e.comment }}</span> }</li>
            }
          </ul>
        </section>
      </aside>
    </div>

    <ng-template #checklist let-required="required" let-recommended="recommended" let-docs="docs" let-itemId="itemId">
      <ul class="cr-check">
        @for (r of required; track r.docType) {
          @if (docsOfType(docs, r.docType); as ds) {
            <li [class.ok]="r.filled" [class.missing]="!r.filled">
              <mat-icon class="st">{{ r.filled ? (ds[0]?.isNotApplicable ? 'remove_circle_outline' : 'check_circle') : 'radio_button_unchecked' }}</mat-icon>
              <div class="name"><strong>{{ r.title }}</strong>
                @if (!r.filled) { <small class="miss">Missing</small> }
                @for (d of ds; track d.id) {
                  <small class="file">
                    @if (d.isNotApplicable) { Not applicable — {{ d.naReason }} }
                    @else { {{ d.originalFileName }} · {{ d.textMethod === 'sheet' ? (d.pageCount + ' sheet' + (d.pageCount === 1 ? '' : 's')) : (d.pageCount + ' page' + (d.pageCount === 1 ? '' : 's')) }}@if (d.documentDate) { · dated {{ d.documentDate | date:'dd MMM yyyy' }} }@if (d.extractedAmount) { · R {{ d.extractedAmount | number:'1.2-2' }} }@if (d.version > 1) { · v{{ d.version }} } }
                    @if (d.suggestedDocType && d.suggestedDocType !== d.docType && !d.isNotApplicable) { <span class="sugg">looked like {{ docTitle(d.suggestedDocType) }}</span> }
                    @if (d.versionReason) { <span class="sugg">replaced: {{ d.versionReason }}</span> }
                  </small>
                }
              </div>
              <div class="act">
                @for (d of ds; track d.id) {
                  @if (!d.isNotApplicable) { <button mat-icon-button [matTooltip]="d.textMethod === 'sheet' ? 'Download' : 'Preview'" (click)="openDoc(d)"><mat-icon>{{ d.textMethod === 'sheet' ? 'download' : 'visibility' }}</mat-icon></button> }
                  @if (b.can.edit) { <button mat-icon-button matTooltip="Remove" (click)="removeDoc(d)"><mat-icon>close</mat-icon></button> }
                  @else if (b.can.uploadAfterLock && !d.isNotApplicable) { <button mat-icon-button matTooltip="Replace (reason required)" (click)="replaceDoc(d)"><mat-icon>published_with_changes</mat-icon></button> }
                }
                @if (!r.filled && (b.can.edit || b.can.uploadAfterLock)) {
                  <button mat-stroked-button class="sm" (click)="pickFor(r.docType, itemId)"><mat-icon>upload</mat-icon> Upload</button>
                  @if (b.can.edit) { <button mat-button class="sm" (click)="markNa(r, itemId)">N/A</button> }
                }
              </div>
            </li>
          }
        }
        @if (recommended?.length) {
          <li class="sect"><mat-icon>info_outline</mat-icon> Optional — attach where you have them. Missing ones are flagged for the approvers but don't block.</li>
          @for (r of recommended; track r.docType) {
            @if (docsOfType(docs, r.docType); as ds) {
              <li class="rec" [class.ok]="r.filled" [class.warn]="!r.filled">
                <mat-icon class="st">{{ r.filled ? (ds[0]?.isNotApplicable ? 'remove_circle_outline' : 'check_circle') : 'warning_amber' }}</mat-icon>
                <div class="name"><strong>{{ r.title }}</strong>
                  @if (!r.filled) { <small class="optional">Not attached</small> }
                  @for (d of ds; track d.id) {
                    <small class="file">
                      @if (d.isNotApplicable) { Not applicable — {{ d.naReason }} }
                      @else { {{ d.originalFileName }} · {{ d.pageCount }} page{{ d.pageCount === 1 ? '' : 's' }}@if (d.documentDate) { · dated {{ d.documentDate | date:'dd MMM yyyy' }} }@if (d.version > 1) { · v{{ d.version }} } }
                    </small>
                  }
                </div>
                <div class="act">
                  @for (d of ds; track d.id) {
                    @if (!d.isNotApplicable) { <button mat-icon-button [matTooltip]="d.textMethod === 'sheet' ? 'Download' : 'Preview'" (click)="openDoc(d)"><mat-icon>{{ d.textMethod === 'sheet' ? 'download' : 'visibility' }}</mat-icon></button> }
                    @if (b.can.edit) { <button mat-icon-button matTooltip="Remove" (click)="removeDoc(d)"><mat-icon>close</mat-icon></button> }
                  }
                  @if (b.can.edit || b.can.uploadAfterLock) {
                    <button mat-stroked-button class="sm" (click)="pickFor(r.docType, itemId)"><mat-icon>upload</mat-icon> {{ r.filled ? 'Add another' : 'Upload' }}</button>
                    @if (b.can.edit && !r.filled) { <button mat-button class="sm" (click)="markNa(r, itemId)">N/A</button> }
                  }
                </div>
              </li>
            }
          }
        }
        @for (d of extraDocs(docs, required, recommended); track d.id) {
          <li class="extra">
            <mat-icon class="st">attach_file</mat-icon>
            <div class="name">
              @if (b.can.edit) {
                <select class="type" [ngModel]="d.docType" (ngModelChange)="retype(d, $event)">
                  @for (t of docTypesFor(itemId); track t.key) { <option [value]="t.key">{{ t.title }}</option> }
                </select>
                @if (d.suggestedDocType && d.suggestedDocType !== d.docType) { <small class="sugg">System thinks this is a {{ docTitle(d.suggestedDocType) }} — change the type if so</small> }
              } @else { <strong>{{ d.title }}</strong> }
              <small class="file">{{ d.originalFileName }} · {{ d.pageCount }} page{{ d.pageCount === 1 ? '' : 's' }}</small>
            </div>
            <div class="act">
              <button mat-icon-button [matTooltip]="d.textMethod === 'sheet' ? 'Download' : 'Preview'" (click)="openDoc(d)"><mat-icon>{{ d.textMethod === 'sheet' ? 'download' : 'visibility' }}</mat-icon></button>
              @if (b.can.edit) { <button mat-icon-button matTooltip="Remove" (click)="removeDoc(d)"><mat-icon>close</mat-icon></button> }
            </div>
          </li>
        }
        @if (!required.length && !docs.length) { <li class="none">No documents are required here.</li> }
      </ul>
    </ng-template>
    <input #fileInput type="file" [accept]="pickAccept" multiple hidden (change)="filesChosen($event)">
  }
  }
  `,
  styles: [`
    :host { display: block; }
    .cr-state { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); padding: var(--space-8) var(--space-4); color: var(--color-text-3); text-align: center; mat-icon { font-size: 44px; width: 44px; height: 44px; } h3 { margin: 0; color: var(--color-text); } p { margin: 0; } }
    .cr-spacer { flex: 1; }
    .muted { color: var(--color-text-3); } .nowrap { white-space: nowrap; } .ref { font-family: var(--font-mono); font-weight: 600; }

    .cr-how { border: 1px solid var(--color-line); border-radius: var(--radius-md); background: var(--color-surface); margin-bottom: var(--space-3);
      .hd { display: flex; align-items: center; gap: 6px; width: 100%; padding: 8px 12px; font: inherit; font-size: var(--text-sm); font-weight: 600; color: var(--color-text-2); background: none; border: 0; cursor: pointer; text-align: left; mat-icon { color: var(--color-primary); } .tw { margin-left: auto; color: var(--color-text-3); } }
      ol { margin: 0; padding: 0 16px 12px 36px; font-size: var(--text-sm); color: var(--color-text-2); li { margin: 4px 0; } } }

    .cr-mine { margin-bottom: var(--space-4);
      h3 { display: flex; align-items: center; gap: 6px; margin: 0 0 var(--space-2); font-size: var(--text-md); mat-icon { color: var(--color-warn); } .n { font-size: var(--text-xs); background: var(--color-warn); color: #fff; border-radius: 999px; padding: 1px 8px; } }
      .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-3); }
      .mcard { text-align: left; font: inherit; color: var(--color-text); background: var(--color-surface); border: 1px solid var(--color-line); border-left: 4px solid var(--color-primary); border-radius: var(--radius-md); padding: 10px 12px; cursor: pointer; display: flex; flex-direction: column; gap: 4px;
        &:hover { box-shadow: var(--shadow-sm); border-color: var(--color-primary); }
        .top { display: flex; gap: 8px; align-items: baseline; .co { font-weight: 700; } .amt { margin-left: auto; font-family: var(--font-mono); font-weight: 600; } }
        .what { display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: var(--text-sm); mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--color-primary); } }
        .sub { font-size: var(--text-xs); color: var(--color-text-3); em { color: var(--color-danger); font-style: normal; } }
        &.tone-warn { border-left-color: var(--color-warn); .what mat-icon { color: var(--color-warn); } } &.tone-bad { border-left-color: var(--color-danger); .what mat-icon { color: var(--color-danger); } } &.tone-ok { border-left-color: var(--color-ok); .what mat-icon { color: var(--color-ok); } } } }

    .cr-alerts { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-3); margin-bottom: var(--space-2); background: var(--color-warn-soft); border: 1px solid var(--color-warn); border-radius: var(--radius-md); mat-icon { color: var(--color-warn); } .txt { flex: 1; font-size: var(--text-sm); } }
    .cr-alert-list { display: grid; gap: 4px; margin-bottom: var(--space-3); }
    .cr-alert { display: grid; grid-template-columns: 170px 1fr; gap: 2px 12px; text-align: left; font: inherit; padding: 8px 12px; background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-sm); cursor: pointer; font-size: var(--text-sm); .b { font-weight: 600; } .d { grid-column: 2; color: var(--color-text-2); font-size: var(--text-xs); } &.fail { border-color: var(--color-danger); } &:hover { border-color: var(--color-primary); } }

    .cr-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin-bottom: var(--space-3);
      select { height: 40px; padding: 0 var(--space-3); border: 1px solid var(--color-line-strong); border-radius: var(--radius-control); background: var(--color-surface); color: var(--color-text); font: inherit; } }
    .cr-seg { display: inline-flex; flex-wrap: wrap; border: 1px solid var(--color-line-strong); border-radius: var(--radius-control); overflow: hidden;
      button { font: inherit; font-size: var(--text-sm); height: 38px; padding: 0 12px; border: 0; border-right: 1px solid var(--color-line); background: var(--color-surface); color: var(--color-text-2); cursor: pointer; b { margin-left: 4px; font-size: var(--text-xs); background: var(--color-surface-3); padding: 1px 6px; border-radius: 999px; }
        &:last-child { border-right: 0; } &.on { background: var(--color-primary-soft); color: var(--color-primary); font-weight: 600; b { background: var(--color-primary); color: #fff; } } } }

    .cr-card { background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-lg); padding: var(--space-4); margin-bottom: var(--space-4);
      header { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-3); flex-wrap: wrap; h3 { margin: 0; font-size: var(--text-md); display: flex; align-items: center; gap: 6px; mat-icon { color: var(--color-primary); } .cnt { font-size: var(--text-xs); background: var(--color-surface-3); padding: 1px 8px; border-radius: 999px; } } small { color: var(--color-text-3); flex: 1; } }
      h4 { margin: 0 0 var(--space-2); } h5 { margin: var(--space-3) 0 var(--space-1); font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .04em; color: var(--color-text-3); }
      .lead { margin: -4px 0 var(--space-3); color: var(--color-text-2); font-size: var(--text-sm); }
      .row { display: flex; flex-wrap: wrap; gap: var(--space-3); margin-bottom: var(--space-2); }
      label { display: flex; flex-direction: column; gap: 4px; font-size: var(--text-xs); color: var(--color-text-2); font-weight: 600; &.grow { flex: 1; min-width: 220px; } }
      input, select { height: 38px; padding: 0 var(--space-2); border: 1px solid var(--color-line-strong); border-radius: var(--radius-control); background: var(--color-surface); color: var(--color-text); font: inherit; font-weight: 400; font-size: var(--text-sm); }
      .actions { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-3); }
      .hint { display: flex; align-items: flex-start; gap: 6px; font-size: var(--text-sm); color: var(--color-text-2); margin: var(--space-2) 0 0; mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--color-ok); flex: 0 0 auto; } &.warn mat-icon { color: var(--color-warn); } }
      .empty { color: var(--color-text-3); font-size: var(--text-sm); margin: 0; }
      .link { font-size: var(--text-xs); } }
    .cr-empty { display: flex; gap: var(--space-3); align-items: center; padding: var(--space-4); background: var(--color-surface-2); border-radius: var(--radius-md); color: var(--color-text-2); font-size: var(--text-sm); mat-icon { font-size: 36px; width: 36px; height: 36px; color: var(--color-primary); } p { margin: 0; } }

    .cr-table-wrap { background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-lg); overflow: auto; }
    .cr-table { width: 100%; border-collapse: collapse;
      th { text-align: left; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .04em; color: var(--color-text-3); padding: 10px var(--space-3); background: var(--color-surface-2); border-bottom: 1px solid var(--color-line); }
      td { padding: 10px var(--space-3); border-bottom: 1px solid var(--color-line); font-size: var(--text-sm); vertical-align: top; }
      tbody tr { cursor: pointer; &:hover td { background: var(--color-surface-2); } }
      .num { text-align: right; font-family: var(--font-mono); white-space: nowrap; } .who { color: var(--color-text-2); }
      .reason { font-size: var(--text-xs); color: var(--color-danger); max-width: 320px; margin-top: 2px; &.warn { color: var(--color-warn); } }
      .actions { text-align: right; color: var(--color-text-3); } .ctr { text-align: center; }
      &.admin { tbody tr { cursor: default; } td { vertical-align: middle; } input, select { height: 34px; width: 100%; min-width: 140px; font-size: var(--text-sm); } input.code { width: 70px; min-width: 0; font-family: var(--font-mono); } input.act { margin-top: 4px; font-size: var(--text-xs); } } }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: var(--text-xs); font-weight: 600; background: var(--color-surface-3); color: var(--color-text-2); vertical-align: middle;
      &.ok { background: var(--color-ok-soft); color: var(--color-ok); } &.warn { background: var(--color-warn-soft); color: var(--color-warn); } &.bad { background: var(--color-danger-soft); color: var(--color-danger); } &.info { background: var(--color-primary-soft); color: var(--color-primary); } &.lg { font-size: var(--text-sm); padding: 4px 12px; } }

    .cr-bhead { display: flex; align-items: flex-start; gap: var(--space-3); margin-bottom: var(--space-3);
      .ttl { flex: 1; h2 { margin: 0; display: flex; align-items: center; gap: 10px; font-size: var(--text-xl); flex-wrap: wrap; .lock { color: var(--color-ok); } } p { margin: 4px 0 0; color: var(--color-text-2); font-size: var(--text-sm); } }
      .sum { text-align: right; .l { display: block; font-size: var(--text-xs); color: var(--color-text-3); } .v { display: block; font-size: var(--text-2xl); font-weight: 700; font-family: var(--font-mono); } } }
    .cr-steps { display: flex; list-style: none; margin: 0 0 var(--space-3); padding: 0; overflow: auto;
      li { flex: 1; min-width: 90px; display: flex; flex-direction: column; align-items: center; gap: 4px; position: relative; padding: 4px 0; font-size: var(--text-xs); color: var(--color-text-3);
        &::before { content: ''; position: absolute; top: 18px; left: 50%; right: -50%; height: 2px; background: var(--color-line); z-index: 0; } &:last-child::before { display: none; }
        .dot { z-index: 1; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: var(--color-surface-2); border: 2px solid var(--color-line); mat-icon { font-size: 16px; width: 16px; height: 16px; } }
        &.done { color: var(--color-ok); .dot { background: var(--color-ok); border-color: var(--color-ok); color: #fff; } &::before { background: var(--color-ok); } }
        &.now { color: var(--color-primary); font-weight: 700; .dot { background: var(--color-primary); border-color: var(--color-primary); color: #fff; box-shadow: 0 0 0 4px var(--color-primary-soft); } }
        &.bad { color: var(--color-danger); font-weight: 700; .dot { background: var(--color-danger); border-color: var(--color-danger); color: #fff; } } } }

    .cr-next { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); margin-bottom: var(--space-4); border-radius: var(--radius-lg); border: 1px solid var(--color-primary); background: var(--color-primary-soft); flex-wrap: wrap;
      .big { font-size: 36px; width: 36px; height: 36px; color: var(--color-primary); }
      .txt { flex: 1; min-width: 240px; h3 { margin: 0; font-size: var(--text-md); } p { margin: 2px 0 0; font-size: var(--text-sm); color: var(--color-text-2); } }
      .btns { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
      &.tone-warn { border-color: var(--color-warn); background: var(--color-warn-soft); .big { color: var(--color-warn); } }
      &.tone-bad { border-color: var(--color-danger); background: var(--color-danger-soft); .big { color: var(--color-danger); } }
      &.tone-ok { border-color: var(--color-ok); background: var(--color-ok-soft); .big { color: var(--color-ok); } }
      &.tone-muted { border-color: var(--color-line); background: var(--color-surface-2); .big { color: var(--color-text-3); } } }

    .cr-sign { border-color: var(--color-primary); h3 { display: flex; align-items: center; gap: 6px; margin: 0 0 var(--space-2); }
      .facts { list-style: none; margin: 0 0 var(--space-3); padding: 0; li { display: flex; gap: 8px; align-items: flex-start; font-size: var(--text-sm); padding: 4px 0; mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--color-primary); flex: 0 0 auto; } .warn { color: var(--color-warn); } .bad { color: var(--color-danger); } } }
      label { margin-bottom: var(--space-2); } .sigpad { border: 1px dashed var(--color-line-strong); border-radius: var(--radius-sm); background: #fff; touch-action: none; max-width: 100%; } }

    .cr-grid { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: var(--space-4); @media (max-width: 1100px) { grid-template-columns: 1fr; } }

    .cr-check { list-style: none; margin: 0; padding: 0;
      li { display: flex; align-items: flex-start; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--color-line); &:last-child { border-bottom: 0; }
        .st { color: var(--color-line-strong); flex: 0 0 auto; margin-top: 2px; }
        .name { flex: 1; min-width: 0; strong { display: block; font-size: var(--text-sm); } small { display: block; font-size: var(--text-xs); color: var(--color-text-3); } .miss { color: var(--color-danger); font-weight: 600; } .sugg { display: inline-block; margin-left: 6px; color: var(--color-warn); } .type { height: 30px; font-size: var(--text-sm); max-width: 260px; } }
        .act { display: flex; align-items: center; gap: 2px; flex: 0 0 auto; .sm { height: 30px; line-height: 30px; font-size: var(--text-xs); mat-icon { font-size: 16px; width: 16px; height: 16px; } } }
        &.ok .st { color: var(--color-ok); } &.missing { background: linear-gradient(90deg, var(--color-danger-soft), transparent 40%); margin: 0 -8px; padding-left: 8px; padding-right: 8px; border-radius: var(--radius-sm); }
        &.extra .st { color: var(--color-text-3); } &.none { color: var(--color-text-3); font-size: var(--text-sm); }
        &.sect { display: flex; align-items: center; gap: 6px; padding: 10px 0 4px; margin-top: 4px; border-bottom: 0; color: var(--color-text-3); font-size: var(--text-xs); font-weight: 600; text-transform: uppercase; letter-spacing: .03em; mat-icon { font-size: 16px; width: 16px; height: 16px; } }
        &.rec.warn .st { color: var(--color-warn); } &.rec .optional { color: var(--color-warn); font-weight: 600; } } }
    .drop { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: var(--space-2) var(--space-3); border: 2px dashed var(--color-line-strong); border-radius: var(--radius-md); color: var(--color-text-3); font-size: var(--text-sm); margin-top: var(--space-3); mat-icon { color: var(--color-primary); } }

    .cr-itemform { background: var(--color-surface-2); border-radius: var(--radius-md); padding: var(--space-3); margin-bottom: var(--space-3);
      .inv-src { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; small { flex-basis: 100%; } }
      .inv-src.recon { padding: 8px 10px; border-radius: var(--radius-md); border: 1px dashed var(--color-line); small { display: inline-flex; align-items: center; gap: 4px; flex-basis: auto; color: var(--color-text-3); mat-icon { font-size: 16px; width: 16px; height: 16px; } } &.missing { border-color: var(--color-warn); background: var(--color-warn-soft, rgba(245,158,11,.08)); small { color: var(--color-warn); } } }
      .actions .warn-txt { display: inline-flex; align-items: center; gap: 4px; color: var(--color-warn); font-size: var(--text-xs); margin-right: auto; mat-icon { font-size: 16px; width: 16px; height: 16px; } }
      .chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; font-size: var(--text-sm); background: var(--color-surface-3); mat-icon { font-size: 18px; width: 18px; height: 18px; } &.ok { background: var(--color-ok-soft); color: var(--color-ok); } }
      .picker { background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-md); padding: 10px; margin-bottom: 10px;
        input { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid var(--color-line); border-radius: var(--radius-sm); font: inherit; margin-bottom: 6px; }
        ul { list-style: none; margin: 0; padding: 0; max-height: 260px; overflow: auto; }
        li { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px; border-radius: var(--radius-sm); cursor: pointer; font-size: var(--text-sm); &:hover { background: var(--color-surface-2); } .amt { margin-left: auto; font-weight: 600; } small { color: var(--color-warn); font-size: var(--text-xs); } &.dis { opacity: .55; cursor: not-allowed; } &.none { color: var(--color-text-3); cursor: default; } }
      }
      label.sup { position: relative; }
      .ac { position: absolute; z-index: 30; left: 0; right: 0; top: 100%; list-style: none; margin: 2px 0 0; padding: 4px; background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-md); box-shadow: var(--shadow-md, 0 8px 24px rgba(0,0,0,.15)); max-height: 260px; overflow: auto;
        li { padding: 6px 8px; border-radius: var(--radius-sm); cursor: pointer; &:hover { background: var(--color-surface-2); } strong { display: block; font-size: var(--text-sm); } small { display: block; color: var(--color-text-3); font-size: var(--text-xs); } }
      }
    }
    .cr-item { border: 1px solid var(--color-line); border-radius: var(--radius-md); margin-bottom: 8px; overflow: hidden;
      .head { display: flex; align-items: center; gap: 8px; padding: 10px 10px; cursor: pointer; flex-wrap: wrap; &:hover { background: var(--color-surface-2); }
        .tw { color: var(--color-text-3); } .who { flex: 1; min-width: 160px; strong { display: block; font-size: var(--text-md); } small { display: block; color: var(--color-text-3); font-size: var(--text-xs); } }
        .docpill { display: inline-flex; align-items: center; gap: 4px; font-size: var(--text-xs); font-weight: 600; padding: 3px 10px 3px 6px; border-radius: 999px; background: var(--color-danger-soft); color: var(--color-danger); mat-icon { font-size: 16px; width: 16px; height: 16px; } &.ok { background: var(--color-ok-soft); color: var(--color-ok); } &.none { background: var(--color-surface-3); color: var(--color-text-3); } }
        .flag { display: inline-flex; align-items: center; gap: 2px; font-size: var(--text-xs); font-weight: 700; color: var(--color-warn); mat-icon { font-size: 16px; width: 16px; height: 16px; } &.fail { color: var(--color-danger); } }
        .amt { font-family: var(--font-mono); font-weight: 700; white-space: nowrap; min-width: 120px; text-align: right; font-size: var(--text-md); }
        .dec { font-size: var(--text-xs); font-weight: 700; padding: 2px 8px; border-radius: 999px; &.approved { background: var(--color-ok-soft); color: var(--color-ok); } &.queried { background: var(--color-warn-soft); color: var(--color-warn); } &.rejected { background: var(--color-danger-soft); color: var(--color-danger); } }
        .pre { font-size: var(--text-xs); color: var(--color-warn); font-weight: 600; } }
      .decide { display: flex; align-items: center; gap: 8px; padding: 6px 12px 10px 40px; font-size: var(--text-sm); color: var(--color-text-2); flex-wrap: wrap; border-top: 1px dashed var(--color-line);
        button mat-icon { font-size: 16px; width: 16px; height: 16px; } .sel-ok { background: var(--color-ok-soft); border-color: var(--color-ok); color: var(--color-ok); } .sel-warn { background: var(--color-warn-soft); border-color: var(--color-warn); color: var(--color-warn); } .sel-bad { background: var(--color-danger-soft); border-color: var(--color-danger); color: var(--color-danger); } em { color: var(--color-text-3); } }
      .deccomment { display: flex; align-items: center; gap: 6px; padding: 4px 12px 8px 40px; font-size: var(--text-xs); color: var(--color-text-2); mat-icon { font-size: 14px; width: 14px; height: 14px; } }
      .body { padding: 4px 12px 12px 40px; border-top: 1px solid var(--color-line); background: var(--color-surface); }
      &.dec-Approved { border-left: 4px solid var(--color-ok); } &.dec-Queried { border-left: 4px solid var(--color-warn); } &.dec-Rejected { border-left: 4px solid var(--color-danger); opacity: .8; } }

    .chk-verdict { display: flex; gap: 10px; align-items: center; padding: 10px 12px; border-radius: var(--radius-md); margin-bottom: var(--space-2); strong { display: block; font-size: var(--text-sm); } small { color: var(--color-text-3); font-size: var(--text-xs); }
      &.fail { background: var(--color-danger-soft); mat-icon { color: var(--color-danger); } } &.review { background: var(--color-warn-soft); mat-icon { color: var(--color-warn); } } &.pass { background: var(--color-ok-soft); mat-icon { color: var(--color-ok); } } }
    .cr-findings { list-style: none; margin: 0; padding: 0; li { display: flex; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--color-line); font-size: var(--text-xs); cursor: default; &:last-child { border-bottom: 0; }
      mat-icon { font-size: 18px; width: 18px; height: 18px; flex: 0 0 auto; } div { min-width: 0; } strong { display: block; font-size: var(--text-sm); } em { display: block; color: var(--color-text-2); font-style: normal; font-weight: 600; } span { display: block; color: var(--color-text-2); }
      &.fail mat-icon { color: var(--color-danger); } &.review mat-icon { color: var(--color-warn); } &.pass { opacity: .6; mat-icon { color: var(--color-ok); } } } }

    .appr-row { display: flex; gap: 10px; align-items: flex-start; padding: 8px 0; mat-icon { color: var(--color-text-3); } &.done mat-icon { color: var(--color-ok); } strong { display: block; font-size: var(--text-sm); } small { display: block; color: var(--color-text-3); font-size: var(--text-xs); } .q { color: var(--color-text-2); font-style: italic; } }
    .hash { font-family: var(--font-mono); font-size: 10px; color: var(--color-text-3); }
    .cr-trail { list-style: none; margin: 0; padding: 0; max-height: 440px; overflow: auto; li { display: grid; grid-template-columns: 86px 1fr; gap: 0 8px; padding: 6px 0; border-bottom: 1px solid var(--color-line); font-size: var(--text-xs); .when { color: var(--color-text-3); font-family: var(--font-mono); } .what { color: var(--color-text-2); } .cmt { grid-column: 2; color: var(--color-text-3); white-space: pre-wrap; } } }
    .search { height: 36px; padding: 0 10px; border: 1px solid var(--color-line-strong); border-radius: var(--radius-control); font: inherit; }
  `]
})
export class FinanceCreditorsComponent implements OnInit {
  private api = inject(CreditorPacksService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private dialog = inject(MatDialog);

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('sigpad') sigpad?: ElementRef<HTMLCanvasElement>;

  meta = signal<CreditorMeta | null>(null);
  rows = signal<BatchRow[]>([]);
  alerts = signal<CreditorAlert[]>([]);
  showAlerts = signal(false);
  showPassed = signal(false);
  howOpen = signal(false);
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
  // invoice auto-fill / supplier directory
  reading = signal(false);
  readInfo = signal('');
  supplierHits = signal<SupplierHit[]>([]);
  showSuppliers = signal(false);
  picker = signal(false);
  pickerHits = signal<BooksInvoiceHit[]>([]);
  pickerQ = '';
  pendingInvoiceFile: File | null = null;
  pendingReconFile: File | null = null;
  pendingSageFile: File | null = null;
  reconInfo = signal('');
  pendingLink: BooksInvoiceHit | null = null;
  pickAccept = 'application/pdf';
  private supTimer: any; private bookTimer: any; private hideTimer: any;

  newBatch = { companyCode: '', paymentType: 'DailyCreditor', batchDate: new Date().toISOString().slice(0, 10), notes: '' };
  itemDraft: ItemInput = { ...EMPTY_ITEM };
  signName = ''; signComment = '';
  private pendingType = ''; private pendingItem: number | null = null; private pendingReplace: BatchDoc | null = null;
  private drawing = false; private drew = false;

  readonly steps = [
    { key: 'Draft', title: 'Prepare', icon: 'edit_note' }, { key: 'Checks', title: 'Checks', icon: 'rule' }, { key: 'AwaitingAccountant', title: 'Accountant', icon: 'fact_check' },
    { key: 'AwaitingDirector', title: 'Director', icon: 'draw' }, { key: 'Approved', title: 'Signed', icon: 'lock' }, { key: 'LoadedOnBank', title: 'Bank', icon: 'account_balance' },
    { key: 'Paid', title: 'Paid', icon: 'price_check' }, { key: 'Closed', title: 'Closed', icon: 'inventory' }
  ];
  private readonly order = ['Draft', 'Checks', 'AwaitingAccountant', 'AwaitingDirector', 'Approved', 'LoadedOnBank', 'Paid', 'Closed'];
  private readonly sentBack = ['ChecksFailed', 'QueriedByAccountant', 'QueriedByDirector'];

  activeCompanies = computed(() => (this.meta()?.companies ?? []).filter(c => c.isActive));
  filteredRows = computed(() => {
    const co = this.companyFilter(), st = this.statusFilter(), ty = this.typeFilter();
    return this.rows().filter(r => (!co || r.companyCode === co) && (!ty || r.paymentType === ty) && this.matchStatus(r, st));
  });
  /** Batches the signed-in user can act on right now. */
  mine = computed(() => {
    const me = this.meta()?.me; if (!me) return [];
    return this.rows().filter(r => {
      if (me.clerk && (r.status === 'Draft' || this.sentBack.includes(r.status) || r.status === 'Paid') && (r.preparedByUserId === me.userId || me.isAdmin)) return true;
      if (me.accountant && r.status === 'AwaitingAccountant' && this.responsibleFor(r.companyCode, 'acc')) return true;
      if (me.director && r.status === 'AwaitingDirector' && this.responsibleFor(r.companyCode, 'dir')) return true;
      if (me.bank && (r.status === 'Approved' || r.status === 'LoadedOnBank')) return true;
      return false;
    }).slice(0, 12);
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
    this.api.list().subscribe({ next: r => { this.rows.set(r); this.loading.set(false); this.openPrepay.set(r.filter(x => x.openPrepayments > 0).length); }, error: () => { this.loading.set(false); this.toast.error("Couldn't load batches."); } });
    this.api.alerts().subscribe({ next: a => this.alerts.set(a), error: () => {} });
  }

  // ── lookups & text ──
  private matchStatus(r: BatchRow, st: string): boolean {
    switch (st) {
      case '': return true;
      case 'open': return !['Closed', 'Rejected'].includes(r.status);
      case 'back': return this.sentBack.includes(r.status);
      case 'pay': return r.status === 'Approved' || r.status === 'LoadedOnBank';
      case 'prepay': return r.openPrepayments > 0;
      default: return r.status === st;
    }
  }
  private responsibleFor(code: string, kind: 'acc' | 'dir'): boolean {
    const me = this.meta()!.me; if (me.isAdmin) return true;
    const c = this.companyFor(code); if (!c) return true;
    return kind === 'acc' ? (!c.accountantUserId && !c.backupApproverUserId) || c.accountantUserId === me.userId || c.backupApproverUserId === me.userId
                          : (!c.directorUserId && !c.delegateDirectorUserId) || c.directorUserId === me.userId || c.delegateDirectorUserId === me.userId;
  }
  count(s: string): number { return this.rows().filter(r => r.status === s).length; }
  countOpen(): number { return this.rows().filter(r => !['Closed', 'Rejected'].includes(r.status)).length; }
  isSentBack(s: string) { return this.sentBack.includes(s); }
  companyFor(code: string) { return this.meta()?.companies.find(c => c.code === code); }
  typeTitle(k: string) { return this.meta()?.paymentTypes.find(p => p.key === k)?.title ?? k; }
  statusTitle(k: string) { return this.meta()?.statuses.find(s => s.key === k)?.title ?? k; }
  docTitle(k: string) { return this.meta()?.docTypes.find(d => d.key === k)?.title ?? k; }
  docTypesFor(itemId: number | null) { return (this.meta()?.docTypes ?? []).filter(d => itemId ? d.scope === 'item' || d.key === 'Other' : d.scope === 'batch' || d.key === 'Other'); }
  badge(s: string) { return ['Approved', 'Paid', 'Closed', 'LoadedOnBank'].includes(s) ? 'ok' : s.startsWith('Awaiting') ? 'warn' : this.sentBack.includes(s) || s === 'Rejected' ? 'bad' : s === 'Draft' ? '' : 'info'; }
  rulesSummary(pt: string): string { const rules = this.meta()?.rules[pt] ?? []; const names = rules.filter(r => r.required && !r.afterDelivery && !r.ifReturned).map(r => this.docTitle(r.docType)); const opt = rules.filter(r => !r.required && !r.afterDelivery && !r.ifReturned && !r.withRecon).map(r => this.docTitle(r.docType)); const withRecon = rules.filter(r => r.withRecon).map(r => this.docTitle(r.docType)); return (names.length ? names.join(', ') : 'none beyond the batch schedule') + (withRecon.length ? ` · with every recon: ${withRecon.join(', ')}` : '') + (opt.length ? ` · optional: ${opt.join(', ')}` : ''); }
  reconSlot(): boolean { const pt = this.batch()?.paymentType ?? ''; return (this.meta()?.rules[pt] ?? []).some(r => r.docType === 'SupplierRecon' && !r.afterDelivery); }
  needsRecon(): boolean { return this.reconSlot() && !!(this.pendingInvoiceFile || this.pendingLink); }
  sageSlot(): boolean { const pt = this.batch()?.paymentType ?? ''; return (this.meta()?.rules[pt] ?? []).some(r => r.docType === 'SageAgedPayables' && r.withRecon); }
  needsSage(): boolean { return this.sageSlot() && !!this.pendingReconFile && !this.pendingSageFile; }
  sageChosen(e: Event): void { const inp = e.target as HTMLInputElement; const f = inp.files?.[0]; inp.value = ''; if (!f) return; if (!/\.pdf$/i.test(f.name)) { this.toast.warn('Sage aged payables must be a PDF.'); return; } this.pendingSageFile = f; }
  isSheetSlot(t: string) { return ['SupplierRecon', 'CreditorsRecon', 'PaymentSchedule'].includes(t); }
  responsibleName(id?: number) { if (!id) return ''; for (const x of this.meta()?.companies ?? []) { if (x.accountantUserId === id) return x.accountantName ?? ''; if (x.backupApproverUserId === id) return x.backupApproverName ?? ''; if (x.directorUserId === id) return x.directorName ?? ''; if (x.delegateDirectorUserId === id) return x.delegateDirectorName ?? ''; } return ''; }

  waitingOn(r: BatchRow): string {
    const c = this.companyFor(r.companyCode);
    switch (r.status) {
      case 'Draft': case 'ChecksFailed': case 'QueriedByAccountant': case 'QueriedByDirector': return `${r.preparedByName || 'preparer'} (to fix & submit)`;
      case 'AwaitingAccountant': return c?.accountantName || 'company accountant';
      case 'AwaitingDirector': return c?.directorName || 'director';
      case 'Approved': return 'bank user (load on bank)';
      case 'LoadedOnBank': return 'bank user (mark paid)';
      case 'Paid': return `${r.preparedByName || 'preparer'} (proof of payment)`;
      default: return '—';
    }
  }
  rowStep(r: BatchRow): NextStep {
    switch (r.status) {
      case 'Draft': return { icon: 'edit_note', tone: 'info', title: 'Finish preparing and submit', body: '' };
      case 'ChecksFailed': return { icon: 'report', tone: 'bad', title: 'Checks failed — fix and resubmit', body: '' };
      case 'QueriedByAccountant': return { icon: 'reply', tone: 'bad', title: 'Sent back by the accountant', body: '' };
      case 'QueriedByDirector': return { icon: 'reply', tone: 'bad', title: 'Sent back by the director', body: '' };
      case 'AwaitingAccountant': return { icon: 'fact_check', tone: 'warn', title: 'Review and approve as accountant', body: '' };
      case 'AwaitingDirector': return { icon: 'draw', tone: 'warn', title: 'Decide each payment and sign', body: '' };
      case 'Approved': return { icon: 'account_balance', tone: 'ok', title: 'Download bank file and load', body: '' };
      case 'LoadedOnBank': return { icon: 'price_check', tone: 'ok', title: 'Mark as paid once released', body: '' };
      case 'Paid': return { icon: 'receipt_long', tone: 'info', title: 'Attach proof of payment and close', body: '' };
      default: return { icon: 'info', tone: 'muted', title: r.statusTitle, body: '' };
    }
  }
  nextStep(b: BatchDetail): NextStep {
    const missing = this.docsRequiredItems(b) - this.docsFilledItems(b) + (b.requiredBatchDocs.length - this.filledCount(b.requiredBatchDocs));
    const acc = this.responsibleName(b.responsible.accountant) || 'the company accountant';
    const dir = this.responsibleName(b.responsible.director) || 'a director';
    switch (b.status) {
      case 'Draft':
        if (!b.items.length) return { icon: 'add_card', tone: 'info', title: 'Add the payments', body: 'Start by adding each supplier you want to pay. The documents required for each one will appear underneath it.' };
        if (missing > 0) return { icon: 'upload_file', tone: 'info', title: `${missing} required document${missing === 1 ? '' : 's'} still missing`, body: 'Rows highlighted in red below need a PDF (or an N/A reason). Submit unlocks when everything is attached.' };
        return { icon: 'send', tone: 'ok', title: 'Ready to submit', body: `All required documents are attached. Submitting runs the system checks and sends the pack to ${acc}.` };
      case 'ChecksFailed': return { icon: 'report', tone: 'bad', title: 'The system checks found blocking problems', body: 'See the red items under System checks and on each payment. Click Reopen & fix, correct them, then submit again.' };
      case 'QueriedByAccountant': return { icon: 'reply', tone: 'bad', title: `Sent back by ${b.accountantName || 'the accountant'}`, body: b.returnReason || 'Reopen, fix what was asked, and submit again.' };
      case 'QueriedByDirector': return { icon: 'reply', tone: 'bad', title: `Sent back by ${b.directorName || 'the director'}`, body: b.returnReason || 'The queried payments are marked below. Reopen, fix, and submit again — it will go back through the accountant.' };
      case 'AwaitingAccountant': return b.can.accountant
        ? { icon: 'fact_check', tone: 'warn', title: 'Your approval is needed', body: `Check the schedule against the recon and the supporting documents. Approve to send it to ${dir}, or send it back with a note.` }
        : { icon: 'hourglass_top', tone: 'warn', title: `Waiting for ${acc} to approve`, body: 'Nothing for you to do here right now.' };
      case 'AwaitingDirector': return b.can.direct
        ? { icon: 'draw', tone: 'warn', title: this.pendingCount(b) > 0 ? `Decide on ${this.pendingCount(b)} payment${this.pendingCount(b) === 1 ? '' : 's'}, then sign` : 'All decided — sign the batch', body: `${b.accountantName} has approved. Approve, query or reject each payment below. Queried payments send the pack back; the rest are paid once you sign.` }
        : { icon: 'hourglass_top', tone: 'warn', title: `Waiting for ${dir} to sign`, body: `Approved by ${b.accountantName}. Nothing for you to do until the director signs.` };
      case 'Approved': return { icon: 'account_balance', tone: 'ok', title: 'Signed and locked — ready for the bank', body: `${b.directorName} signed. The bank user downloads the bank file (approved payments only), loads it, and marks it loaded.` };
      case 'LoadedOnBank': return { icon: 'price_check', tone: 'ok', title: 'Loaded on the bank', body: 'Once the payments have been released, mark the batch as paid.' };
      case 'Paid': { const pop = this.missingPop(b), pre = this.openPrepayCount(b);
        return { icon: 'receipt_long', tone: 'info', title: pop || pre ? 'Paid — a few things before it can close' : 'Paid — ready to close', body: [pop ? `Proof of payment still needed for ${pop} payment${pop === 1 ? '' : 's'}` : '', pre ? `${pre} prepayment${pre === 1 ? '' : 's'} still waiting for the tax invoice + GRV after delivery` : ''].filter(Boolean).join(' · ') || 'Everything is attached.' }; }
      case 'Closed': return { icon: 'inventory', tone: 'muted', title: 'Closed', body: `Completed on ${b.closedAt ? new Date(b.closedAt).toLocaleDateString() : '—'}. Everything here is read-only.` };
      case 'Rejected': return { icon: 'block', tone: 'bad', title: 'Rejected by the director', body: b.returnReason || 'You can reopen it as a draft if it should be reworked.' };
      default: return { icon: 'info', tone: 'muted', title: b.statusTitle, body: '' };
    }
  }
  eventText(e: { action: string; toStatus?: string; fromStatus?: string }): string {
    const m: Record<string, string> = { Created: 'created the batch', ItemAdded: 'added a payment', ItemUpdated: 'edited a payment', ItemRemoved: 'removed a payment', DocumentUploaded: 'attached a document', DocumentReplaced: 'replaced a document', DocumentRemoved: 'removed a document', DocumentNA: 'marked a document N/A', Submitted: e.toStatus === 'ChecksFailed' ? 'submitted — checks failed' : 'submitted to the accountant', ChecksRun: 'ran the checks', AccountantApproved: 'approved as accountant', AccountantQueried: 'sent it back', ItemDecision: 'decided on a payment', DirectorSigned: 'signed the batch', DirectorQueried: 'sent it back with queries', DirectorRejected: 'rejected the batch', BankFileExported: 'downloaded the bank file', StatusChanged: `moved it to ${this.statusTitle(e.toStatus || '')}`, Reopened: 'reopened it as a draft', PrepaymentClosed: 'closed a prepayment' };
    return m[e.action] ?? (e.toStatus ? `${e.action} → ${this.statusTitle(e.toStatus)}` : e.action);
  }

  // ── derived counts ──
  stepState(b: BatchDetail, key: string): 'done' | 'now' | 'bad' | '' {
    const cur = b.status === 'ChecksFailed' ? 'Checks' : b.status === 'QueriedByAccountant' ? 'AwaitingAccountant' : b.status === 'QueriedByDirector' || b.status === 'Rejected' ? 'AwaitingDirector' : b.status;
    const ci = this.order.indexOf(cur), ki = this.order.indexOf(key);
    if (ki < ci) return 'done';
    if (ki === ci) return this.sentBack.includes(b.status) || b.status === 'Rejected' ? 'bad' : b.status === 'Closed' ? 'done' : 'now';
    return '';
  }
  approvedCount(b: BatchDetail) { return b.items.filter(i => i.decisionStatus === 'Approved').length; }
  queriedCount(b: BatchDetail) { return b.items.filter(i => i.decisionStatus === 'Queried').length; }
  rejectedCount(b: BatchDetail) { return b.items.filter(i => i.decisionStatus === 'Rejected').length; }
  pendingCount(b: BatchDetail) { return b.items.filter(i => i.decisionStatus === 'Pending').length; }
  filledCount(r: RequiredDoc[]) { return r.filter(x => x.filled).length; }
  missingNames(r: RequiredDoc[]) { const m = r.filter(x => !x.filled).map(x => x.title); return m.length ? 'Missing: ' + m.join(', ') : 'All required documents attached'; }
  docsRequiredItems(b: BatchDetail) { return b.items.reduce((n, i) => n + i.required.length, 0); }
  docsFilledItems(b: BatchDetail) { return b.items.reduce((n, i) => n + this.filledCount(i.required), 0); }
  missingPop(b: BatchDetail) { return b.items.filter(i => i.decisionStatus === 'Approved' && !i.documents.some(d => d.docType === 'ProofOfPayment' && !d.isNotApplicable)).length; }
  openPrepayCount(b: BatchDetail) { return b.items.filter(i => i.prepaymentOpen && i.decisionStatus === 'Approved').length; }
  docsOfType(docs: BatchDoc[], t: string) { return docs.filter(d => d.docType === t); }
  extraDocs(docs: BatchDoc[], required: RequiredDoc[], recommended: RequiredDoc[] = []) { const keys = new Set([...required, ...recommended].map(r => r.docType)); return docs.filter(d => !keys.has(d.docType)); }
  visibleFindings(b: BatchDetail): CheckFinding[] { const w: Record<string, number> = { FAIL: 0, REVIEW: 1, PASS: 2 }; return [...(b.checks?.findings ?? [])].filter(f => this.showPassed() || f.severity !== 'PASS').sort((a, c) => w[a.severity] - w[c.severity]); }
  findingsFor(itemId: number) { return (this.batch()?.checks?.findings ?? []).filter(f => f.itemId === itemId && f.severity !== 'PASS'); }
  hasFail(itemId: number) { return this.findingsFor(itemId).some(f => f.severity === 'FAIL'); }

  // ── navigation ──
  open(id: number): void {
    this.busy.set(true);
    this.api.get(id).subscribe({
      next: b => { this.batch.set(b); this.view.set('batch'); this.busy.set(false); this.signOpen.set(false); this.itemForm.set(null); this.showPassed.set(false);
        if (b.items.length === 1) this.openItem.set(b.items[0].id);
        this.router.navigate([], { relativeTo: this.route, queryParams: { batch: id }, queryParamsHandling: 'merge', replaceUrl: true }); },
      error: () => { this.busy.set(false); this.toast.error("Couldn't open that batch."); }
    });
  }
  back(): void { this.view.set('board'); this.batch.set(null); this.router.navigate([], { relativeTo: this.route, queryParams: { batch: null }, queryParamsHandling: 'merge', replaceUrl: true }); this.loadBoard(); }
  private apply = (b: BatchDetail, msg?: string) => { this.batch.set(b); this.busy.set(false); if (msg) this.toast.done(msg); };
  private fail = (e: any, fallback: string) => { this.busy.set(false); this.toast.error(e?.error?.message || fallback); };

  // ── batch actions ──
  create(): void {
    this.busy.set(true);
    this.api.create({ ...this.newBatch, notes: this.newBatch.notes || undefined }).subscribe({ next: b => { this.newOpen.set(false); this.apply(b, `${b.batchNumber} created — now add the payments`); this.view.set('batch'); }, error: e => this.fail(e, "Couldn't create the batch.") });
  }
  deleteBatch(): void { const b = this.batch()!; if (!confirm(`Delete draft ${b.batchNumber}? This can't be undone.`)) return; this.api.delete(b.id).subscribe({ next: () => { this.toast.done('Draft deleted'); this.back(); }, error: e => this.fail(e, "Couldn't delete.") }); }
  submit(): void { const b = this.batch()!; this.busy.set(true); this.api.submit(b.id).subscribe({ next: r => this.apply(r, r.status === 'ChecksFailed' ? 'Checks found problems — see the red items' : 'Sent to the accountant'), error: e => this.fail(e, "Couldn't submit.") }); }
  rerun(): void { const b = this.batch()!; this.busy.set(true); this.api.rerunChecks(b.id).subscribe({ next: r => this.apply(r, `Checks: ${r.checksStatus}`), error: e => this.fail(e, "Couldn't run the checks.") }); }
  accountant(d: 'approve' | 'query'): void {
    const b = this.batch()!; const c = prompt(d === 'approve' ? 'Add a note for the director (optional):' : 'What needs to be fixed before you can approve?'); if (c === null) return; if (d === 'query' && !c.trim()) return;
    this.busy.set(true); this.api.accountant(b.id, d, c || undefined).subscribe({ next: r => this.apply(r, d === 'approve' ? 'Approved — now with the director' : 'Sent back to the preparer'), error: e => this.fail(e, "Couldn't record your decision.") });
  }
  decide(it: BatchItem, d: string): void {
    const b = this.batch()!; let c: string | null = null;
    if (d !== 'Approved') { c = prompt(d === 'Queried' ? `What do you want checked on ${it.supplierName}?` : `Why is ${it.supplierName} rejected?`); if (!c) return; }
    this.busy.set(true); this.api.decide(b.id, it.id, d, c || undefined).subscribe({ next: r => this.apply(r), error: e => this.fail(e, "Couldn't save the decision.") });
  }
  decideAll(d: string): void { const b = this.batch()!; const pend = b.items.filter(i => i.decisionStatus === 'Pending'); if (!pend.length) return; this.busy.set(true); let n = 0; for (const it of pend) this.api.decide(b.id, it.id, d).subscribe({ next: r => { if (++n === pend.length) this.apply(r, `${n} payment(s) approved — now sign`); }, error: e => this.fail(e, "Couldn't approve all.") }); }
  sign(): void {
    const b = this.batch()!; const img = this.drew && this.sigpad ? this.sigpad.nativeElement.toDataURL('image/png') : undefined;
    this.busy.set(true); this.api.sign(b.id, this.signName, this.signComment || undefined, img).subscribe({ next: r => { this.signOpen.set(false); this.apply(r, r.status === 'Approved' ? 'Signed and locked' : r.status === 'Rejected' ? 'Batch rejected' : 'Queries sent back to the preparer'); }, error: e => this.fail(e, "Couldn't sign.") });
  }
  setStatus(s: 'LoadedOnBank' | 'Paid' | 'Closed' | 'Draft'): void { const b = this.batch()!; this.busy.set(true); this.api.setStatus(b.id, s).subscribe({ next: r => this.apply(r, this.statusTitle(r.status)), error: e => this.fail(e, "Couldn't change the status.") }); }
  bankFile(): void { const b = this.batch()!; this.api.bankFile(b.id).subscribe({ next: blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${b.batchNumber}-bank.csv`; a.click(); URL.revokeObjectURL(a.href); this.open(b.id); }, error: e => this.fail(e, "Couldn't export.") }); }

  // ── items ──
  startItem(it?: BatchItem): void { this.itemDraft = it ? { supplierName: it.supplierName, supplierVatNumber: it.supplierVatNumber ?? '', invoiceNumbers: it.invoiceNumbers ?? '', description: it.description ?? '', amount: it.amount, bankName: it.bankName ?? '', accountNumber: it.accountNumber ?? '', branchCode: it.branchCode ?? '', accountHolder: it.accountHolder ?? '', paymentReference: it.paymentReference ?? '', stockReturned: it.stockReturned } : { ...EMPTY_ITEM }; this.clearInvoice(); this.supplierHits.set([]); this.itemForm.set(it ? it.id : 'new'); }
  cancelItem(): void { this.itemForm.set(null); this.clearInvoice(); }
  saveItem(): void {
    const b = this.batch()!; const f = this.itemForm(); this.busy.set(true);
    const file = this.pendingInvoiceFile, link = this.pendingLink, recon = this.pendingReconFile, sage = this.pendingSageFile;
    const req = f === 'new' ? this.api.addItem(b.id, this.itemDraft) : this.api.updateItem(b.id, f as number, this.itemDraft);
    req.subscribe({
      next: r => {
        const itemId = f === 'new' ? (r.items[r.items.length - 1]?.id ?? 0) : (f as number);
        this.itemForm.set(null); this.apply(r); this.openItem.set(itemId); this.clearInvoice();
        if (!itemId) return;
        const attachSage = (afterMsg: string) => {
          if (!sage) { this.toast.done(afterMsg); return; }
          this.busy.set(true);
          this.api.upload(b.id, sage, 'SageAgedPayables', itemId).subscribe({ next: x => this.apply(x, afterMsg + ' + Sage aged payables'), error: e => this.fail(e, 'Saved, but the Sage aged payables PDF could not be attached — upload it under the payment.') });
        };
        const attachRecon = (afterMsg: string) => {
          if (!recon) { attachSage(afterMsg); return; }
          this.busy.set(true);
          this.api.upload(b.id, recon, 'SupplierRecon', itemId).subscribe({ next: x => { this.batch.set(x); this.busy.set(false); attachSage(afterMsg + ' + recon'); }, error: e => this.fail(e, 'Payment saved but the recon could not be attached — upload it under the payment.') });
        };
        if (file) { this.busy.set(true); this.api.upload(b.id, file, 'TaxInvoice', itemId).subscribe({ next: x => { this.batch.set(x); this.busy.set(false); attachRecon('Payment added and invoice attached'); }, error: e => this.fail(e, 'Payment saved but the invoice could not be attached.') }); }
        else if (link) { this.busy.set(true); this.api.linkInvoice(b.id, itemId, link.id).subscribe({ next: x => { this.batch.set(x); this.busy.set(false); attachRecon('Payment added and linked to the Books invoice'); }, error: e => this.fail(e, 'Payment saved but the Books invoice could not be linked.') }); }
      },
      error: e => this.fail(e, "Couldn't save the payment.")
    });
  }
  removeItem(it: BatchItem): void { const b = this.batch()!; if (!confirm(`Remove ${it.supplierName} and its documents from this batch?`)) return; this.busy.set(true); this.api.deleteItem(b.id, it.id).subscribe({ next: r => this.apply(r), error: e => this.fail(e, "Couldn't remove.") }); }

  // ── supplier directory + invoice auto-fill ──
  searchSuppliers(q: string): void {
    clearTimeout(this.supTimer); this.showSuppliers.set(true);
    if (!q || q.trim().length < 2) { this.supplierHits.set([]); return; }
    this.supTimer = setTimeout(() => this.api.suppliers(q.trim()).subscribe({ next: h => this.supplierHits.set(h), error: () => this.supplierHits.set([]) }), 220);
  }
  hideSuppliersSoon(): void { clearTimeout(this.hideTimer); this.hideTimer = setTimeout(() => this.showSuppliers.set(false), 150); }
  pickSupplier(s: SupplierHit): void {
    const d = this.itemDraft; d.supplierName = s.name;
    if (s.vatNumber) d.supplierVatNumber = s.vatNumber;
    if (s.bankName && !d.bankName) d.bankName = s.bankName;
    if (s.accountNumber && !d.accountNumber) d.accountNumber = s.accountNumber;
    if (s.branchCode && !d.branchCode) d.branchCode = s.branchCode;
    if (s.accountHolder && !d.accountHolder) d.accountHolder = s.accountHolder;
    if (s.paymentReference && !d.paymentReference) d.paymentReference = s.paymentReference;
    this.showSuppliers.set(false); this.supplierHits.set([]);
    if (s.bankName) this.toast.info(`Bank details filled from ${s.payments ? 'the last payment' : 'Books'} — still check them against the bank letter`);
  }
  invoiceChosen(e: Event): void {
    const inp = e.target as HTMLInputElement; const f = inp.files?.[0]; inp.value = ''; if (!f) return;
    if (!/\.pdf$/i.test(f.name)) { this.toast.warn('PDF only.'); return; }
    this.pendingInvoiceFile = f; this.pendingLink = null; this.reading.set(true); this.readInfo.set('');
    this.api.readInvoice(f).subscribe({
      next: r => {
        this.reading.set(false); const d = this.itemDraft; const filled: string[] = [];
        if (r.supplierName && !d.supplierName) { d.supplierName = r.supplierName; filled.push('supplier'); }
        if (r.amount && !d.amount) { d.amount = r.amount; filled.push('amount'); }
        if (r.vatNumber && !d.supplierVatNumber) d.supplierVatNumber = r.vatNumber;
        if (r.invoiceNumber && !d.invoiceNumbers) { d.invoiceNumbers = r.invoiceNumber; filled.push('invoice no.'); }
        if (r.description && !d.description) { d.description = r.description; filled.push('description'); }
        else if (!d.description && r.orderNumber) { d.description = `Order ${r.orderNumber}`; filled.push('order no.'); }
        if (r.customerAccount && !d.paymentReference) { d.paymentReference = r.customerAccount; filled.push('reference'); }
        // Bank details: prefer what we paid last time (verified), else what is printed on the invoice
        if (r.supplier?.bankName && !d.bankName) { const s = r.supplier; d.bankName = s.bankName!; d.accountNumber = s.accountNumber ?? ''; d.branchCode = s.branchCode ?? ''; d.accountHolder = s.accountHolder ?? ''; d.paymentReference ||= s.paymentReference ?? ''; filled.push('bank details from last payment'); }
        else if ((r.bankName || r.accountNumber) && !d.bankName && !d.accountNumber) { d.bankName = r.bankName ?? ''; d.accountNumber = r.accountNumber ?? ''; d.branchCode = r.branchCode ?? ''; d.accountHolder = r.accountHolder ?? d.supplierName; filled.push('bank details printed on the invoice — verify against the bank letter'); }
        this.readInfo.set(!r.readable ? 'could not read the text — fill in by hand' : filled.length ? 'filled: ' + filled.join(', ') : 'read, nothing recognised');
        if (r.suggestedType && r.suggestedType !== 'TaxInvoice' && r.suggestedType !== 'Other') this.toast.warn(`This looks like a ${this.docTitle(r.suggestedType)}, not a tax invoice — it will still be attached as the invoice.`);
      },
      error: e => { this.reading.set(false); this.readInfo.set('could not read'); this.toast.error(e?.error?.message || "Couldn't read the PDF — it will still be attached."); }
    });
  }
  openPicker(): void { this.picker.set(true); this.pickerQ = this.itemDraft.supplierName || ''; this.searchBooks(); }
  searchBooks(): void {
    clearTimeout(this.bookTimer); const q = this.pickerQ.trim(); if (q.length < 2) { this.pickerHits.set([]); return; }
    this.bookTimer = setTimeout(() => this.api.booksInvoices(q, this.batch()?.companyCode).subscribe({ next: h => this.pickerHits.set(h), error: () => this.pickerHits.set([]) }), 220);
  }
  pickBooks(h: BooksInvoiceHit): void {
    const d = this.itemDraft; this.pendingLink = h; this.pendingInvoiceFile = null; this.picker.set(false);
    if (!d.supplierName) d.supplierName = h.supplierName;
    if (!d.amount) d.amount = h.total;
    if (h.invoiceNumber && !d.invoiceNumbers) d.invoiceNumbers = h.invoiceNumber;
    if (h.description && !d.description) d.description = h.description;
    this.api.suppliers(h.supplierName, 1).subscribe({ next: s => { if (s[0]?.bankName && !d.bankName) this.pickSupplier(s[0]); } });
    if (!h.hasPdf) this.toast.warn('That Books invoice has no PDF — the link will be recorded but you may still need to upload the invoice.');
  }
  clearInvoice(): void { this.pendingInvoiceFile = null; this.pendingReconFile = null; this.pendingSageFile = null; this.reconInfo.set(''); this.pendingLink = null; this.readInfo.set(''); this.picker.set(false); this.pickerHits.set([]); }
  reconChosen(e: Event): void {
    const inp = e.target as HTMLInputElement; const f = inp.files?.[0]; inp.value = ''; if (!f) return;
    if (!/\.(xlsx|xls|csv|pdf)$/i.test(f.name)) { this.toast.warn('The recon must be an Excel file (.xlsx/.xls), CSV or PDF.'); return; }
    this.pendingReconFile = f; this.reconInfo.set('reading…');
    this.api.readRecon(f).subscribe({
      next: r => {
        const d = this.itemDraft; const filled: string[] = [];
        if (r.supplierName && !d.supplierName) { d.supplierName = r.supplierName; filled.push('supplier'); }
        if (r.amount && !d.amount) { d.amount = Math.abs(r.amount); filled.push('amount'); }
        if (r.vatNumber && !d.supplierVatNumber) d.supplierVatNumber = r.vatNumber;
        if (!d.invoiceNumbers) { const list = (r.invoiceNumbers?.length ? r.invoiceNumbers : r.invoiceNumber ? [r.invoiceNumber] : []); if (list.length) { d.invoiceNumbers = list.join(', '); filled.push(list.length > 1 ? `${list.length} invoice nos.` : 'invoice no.'); } }
        if (r.customerAccount && !d.paymentReference) { d.paymentReference = r.customerAccount; filled.push('reference'); }
        if (r.supplier?.bankName && !d.bankName) { const s = r.supplier; d.bankName = s.bankName!; d.accountNumber = s.accountNumber ?? ''; d.branchCode = s.branchCode ?? ''; d.accountHolder = s.accountHolder ?? ''; d.paymentReference ||= s.paymentReference ?? ''; filled.push('bank details from last payment'); }
        else if ((r.bankName || r.accountNumber) && !d.bankName && !d.accountNumber) { d.bankName = r.bankName ?? ''; d.accountNumber = r.accountNumber ?? ''; d.branchCode = r.branchCode ?? ''; d.accountHolder = r.accountHolder ?? d.supplierName; filled.push('bank details on the recon — verify'); }
        this.reconInfo.set(!r.readable ? 'could not read' : filled.length ? 'filled: ' + filled.join(', ') : 'read');
      },
      error: () => this.reconInfo.set('could not read — will still be attached')
    });
  }

  // ── documents ──
  pickFor(docType: string, itemId: number | null): void { this.pendingType = docType; this.pendingItem = itemId; this.pendingReplace = null; this.pickAccept = this.isSheetSlot(docType) ? '.xlsx,.xls,.csv,application/pdf' : 'application/pdf'; setTimeout(() => this.fileInput?.nativeElement.click()); }
  replaceDoc(d: BatchDoc): void { const reason = prompt('Why is this document being replaced? (kept in the history)'); if (!reason) return; this.pendingType = d.docType; this.pendingItem = d.itemId ?? null; this.pendingReplace = { ...d, versionReason: reason }; this.pickAccept = this.isSheetSlot(d.docType) ? '.xlsx,.xls,.csv,application/pdf' : 'application/pdf'; setTimeout(() => this.fileInput?.nativeElement.click()); }
  filesChosen(e: Event): void { const inp = e.target as HTMLInputElement; const files = Array.from(inp.files ?? []); inp.value = ''; this.uploadAll(files, this.pendingItem, this.pendingType); }
  drop(e: DragEvent, itemId: number | null): void { e.preventDefault(); this.uploadAll(Array.from(e.dataTransfer?.files ?? []), itemId, ''); }
  private uploadAll(files: File[], itemId: number | null, docType: string): void {
    const b = this.batch()!;
    const sheetOk = this.isSheetSlot(docType);
    const pdfs = files.filter(f => /\.pdf$/i.test(f.name) || (sheetOk && /\.(xlsx|xls|csv)$/i.test(f.name)));
    if (!pdfs.length) { this.toast.warn(sheetOk ? 'PDF or Excel/CSV files only.' : 'PDF files only — one document per file. Excel recons go in the Supplier recon slot (use its Upload button).'); return; }
    if (!sheetOk && files.some(f => /\.(xlsx|xls|csv)$/i.test(f.name))) { const items = this.batch()?.items ?? []; const it = items.find(i => i.id === itemId); const slot = (it?.required ?? []).find(r => r.docType === 'SupplierRecon'); if (slot && files.filter(f => /\.(xlsx|xls|csv)$/i.test(f.name)).length === 1 && pdfs.length === files.length - 1) { /* a spreadsheet dropped with PDFs — send it to the recon slot */ const sheet = files.find(f => /\.(xlsx|xls|csv)$/i.test(f.name))!; this.api.upload(b.id, sheet, 'SupplierRecon', itemId).subscribe({ next: r => { this.batch.set(r); this.toast.done('Spreadsheet attached as the supplier recon'); }, error: e => this.toast.error(`${sheet.name}: ${e?.error?.message || 'upload failed'}`) }); } else this.toast.warn('Spreadsheets are only accepted as the supplier recon — use that slot\'s Upload button.'); }
    this.busy.set(true); let i = 0; this.toast.info(pdfs.length === 1 ? 'Reading the document…' : `Reading ${pdfs.length} documents… scanned PDFs take a little longer`);
    const next = () => { if (i >= pdfs.length) { this.busy.set(false); this.toast.done(docType ? 'Attached' : `${pdfs.length} file(s) attached — check the document type we guessed`); return; }
      const f = pdfs[i++]; const rep = this.pendingReplace;
      this.api.upload(b.id, f, docType || undefined, itemId, rep?.id, rep?.versionReason).subscribe({ next: r => { this.batch.set(r); this.pendingReplace = null; next(); }, error: e => { this.toast.error(`${f.name}: ${e?.error?.message || 'upload failed'}`); next(); } }); };
    next();
  }
  retype(d: BatchDoc, t: string): void { const b = this.batch()!; this.api.updateDoc(b.id, d.id, { docType: t }).subscribe({ next: r => this.batch.set(r), error: e => this.fail(e, "Couldn't change the type.") }); }
  removeDoc(d: BatchDoc): void { const b = this.batch()!; this.api.deleteDoc(b.id, d.id).subscribe({ next: r => this.batch.set(r), error: e => this.fail(e, "Couldn't remove the document.") }); }
  markNa(r: RequiredDoc, itemId: number | null): void { const b = this.batch()!; const reason = prompt(`Why does "${r.title}" not apply to this payment? (the approvers will see this)`); if (!reason) return; this.api.markNa(b.id, r.docType, itemId, reason).subscribe({ next: x => this.batch.set(x), error: e => this.fail(e, "Couldn't mark N/A.") }); }
  openDoc(d: BatchDoc): void {
    const b = this.batch()!;
    if (d.textMethod === 'sheet') { this.api.file(b.id, d.id).subscribe({ next: blob => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = d.originalFileName || 'recon'; a.click(); URL.revokeObjectURL(url); }, error: () => this.toast.error("Couldn't download the file.") }); return; }
    const it = b.items.find(i => i.id === d.itemId);
    PackPreviewDialogComponent.open(this.dialog, { url: this.api.fileUrl(b.id, d.id), title: `${this.docTitle(d.docType)}${it ? ' · ' + it.supplierName : ''}`, subtitle: `${b.batchNumber} · ${d.originalFileName || ''}${d.documentDate ? ' · dated ' + new Date(d.documentDate).toLocaleDateString() : ''}`, fileName: d.originalFileName || 'document.pdf' });
  }
  previewableDocs(it: BatchItem): BatchDoc[] { return it.documents.filter(d => !d.isNotApplicable && d.textMethod !== 'sheet'); }
  /** Review a payment: open its first PDF (tax invoice first) in the preview dialog; the dialog's own buttons handle open/download. */
  previewItem(it: BatchItem): void {
    const docs = this.previewableDocs(it); if (!docs.length) return;
    const order = ['TaxInvoice', 'SupplierRecon', 'BankLetter', 'ProofOfPayment'];
    const first = [...docs].sort((a, c) => (order.indexOf(a.docType) + 1 || 99) - (order.indexOf(c.docType) + 1 || 99))[0];
    this.openItem.set(it.id); this.openDoc(first);
  }

  // ── signature pad ──
  private ctx(): CanvasRenderingContext2D | null { const c = this.sigpad?.nativeElement; if (!c) return null; const x = c.getContext('2d'); if (x) { x.lineWidth = 2; x.lineCap = 'round'; x.strokeStyle = '#111'; } return x; }
  private pos(e: PointerEvent) { const c = this.sigpad!.nativeElement; const r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * c.width / r.width, y: (e.clientY - r.top) * c.height / r.height }; }
  padDown(e: PointerEvent) { const x = this.ctx(); if (!x) return; this.drawing = true; const p = this.pos(e); x.beginPath(); x.moveTo(p.x, p.y); }
  padMove(e: PointerEvent) { if (!this.drawing) return; const x = this.ctx(); if (!x) return; const p = this.pos(e); x.lineTo(p.x, p.y); x.stroke(); this.drew = true; }
  padUp() { this.drawing = false; }
  padClear() { const c = this.sigpad?.nativeElement; c?.getContext('2d')?.clearRect(0, 0, c.width, c.height); this.drew = false; }
}
