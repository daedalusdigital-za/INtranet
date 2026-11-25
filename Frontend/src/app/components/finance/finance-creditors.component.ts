import { Component, OnInit, inject, signal, computed, effect, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { PackPreviewDialogComponent } from './pack-preview-dialog.component';
import { ReconPreviewDialogComponent } from './recon-preview-dialog.component';
import { CompanyBatchesDialogComponent } from './company-batches-dialog.component';
import { PaymentHistoryComponent } from './payment-history.component';
import { ExplainerDialogComponent } from './explainer-dialog.component';
import { SchedulePreviewDialogComponent } from './schedule-preview-dialog.component';
import { SecureSrcDirective } from '../../directives/secure-src.directive';
import { environment } from '../../../environments/environment';
import { companyWideLogo, companyMonogram, companyHue } from '../../core/company-logos';
import { ToastService } from '../../ui/toast.service';
import { Observable } from 'rxjs';
import { CreditorPacksService, CreditorMeta, BatchRow, BatchDetail, BatchItem, BatchDoc, ItemInput, CreditorAlert, RequiredDoc, CheckFinding, SupplierHit, BooksInvoiceHit, GeneratedSchedule, BatchApprovers, InboxRow, QueryRow, RequisitionFormInput, COMPLIANCE_KINDS, complianceKindsLabel } from '../../services/creditor-packs.service';

type View = 'board' | 'batch';
interface NextStep { icon: string; tone: 'info' | 'warn' | 'ok' | 'bad' | 'muted'; title: string; body: string; }

const EMPTY_ITEM: ItemInput = { supplierName: '', supplierVatNumber: '', invoiceNumbers: '', description: '', amount: 0, bankName: '', accountNumber: '', branchCode: '', accountHolder: '', paymentReference: '', stockReturned: false, isUrgent: false, paymentMode: 'Normal', payoutMethod: 'EFT' };

/**
 * Finance → Creditors. Payment packs per paying company. The screen is organised around
 * "what do I need to do next": the board lists batches waiting on you first, and every batch
 * opens with a plain-language next-step card and the buttons that go with it.
 */
@Component({
  selector: 'app-finance-creditors',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, MatButtonModule, MatTooltipModule, MatProgressSpinnerModule, MatProgressBarModule, MatCheckboxModule, SecureSrcDirective, PaymentHistoryComponent],
  template: `
  @if (!meta()) {
    <div class="cr-state"><mat-spinner diameter="36"></mat-spinner><p>Opening creditors…</p></div>
  } @else {

  <!-- ═══════════════════════ BOARD ═══════════════════════ -->
  @if (view() === 'board') {

    <div class="cr-title">
      <h2>Payment packs</h2>
      <button mat-icon-button class="help" (click)="explain()" matTooltip="How a payment pack moves" aria-label="How a payment pack moves"><mat-icon>help_outline</mat-icon></button>
    </div>

    @if (inbox().length) {
      <section class="cr-inbox" aria-label="Packs waiting for you">
        <header>
          <mat-icon>draw</mat-icon>
          <div class="txt"><h3>{{ inbox().length }} pack{{ inbox().length === 1 ? '' : 's' }} waiting for you</h3><p>{{ inboxDirector().length ? inboxDirector().length + ' to sign as director' : '' }}{{ inboxDirector().length && inboxAccountant().length ? ' · ' : '' }}{{ inboxAccountant().length ? inboxAccountant().length + ' to approve as accountant' : '' }} · R {{ inboxTotal() | number:'1.2-2' }} in total</p></div>
        </header>
        <div class="cr-inbox-list">
          @for (r of inbox(); track r.id) {
            <button type="button" class="cr-inbox-row" [class.blocked]="r.blocked" (click)="open(r.id)">
              <ng-container *ngTemplateOutlet="coMark; context: { $implicit: r.companyCode }"></ng-container>
              <span class="who">
                <b>{{ r.batchNumber }} <span [class]="'badge ' + badge(r.status)">{{ r.role === 'director' ? 'Sign' : 'Approve' }}</span></b>
                <small>{{ r.companyName }} · {{ r.paymentTypeTitle }}@if (r.complianceKinds?.length) { ({{ kindsLabel(r.complianceKinds) }}) } · {{ r.items }} payment{{ r.items === 1 ? '' : 's' }}@if (r.role === 'director' && r.pendingItems) { · <em>{{ r.pendingItems }} still to decide</em> }</small>
                <small>Prepared by {{ r.preparedByName }}@if (r.accountantName) { · approved by {{ r.accountantName }} }@if (r.waitingSince) { · waiting {{ ago(r.waitingSince) }} }</small>
                @if (r.blocked) { <small class="bad"><mat-icon>block</mat-icon> {{ r.blocked }}</small> }
                @else if (r.accountantComment) { <small class="note">“{{ r.accountantComment }}”</small> }
              </span>
              <span class="amt">R {{ r.totalAmount | number:'1.2-2' }}</span>
              <mat-icon class="go">chevron_right</mat-icon>
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
        <button [class.on]="statusFilter() === 'queried'" [class.attn]="queriesOpen() > 0" (click)="statusFilter.set('queried')" matTooltip="Payments the director queried: answer them here and they go back to the director">Queried payments <b>{{ queries().length }}</b></button>
        <button [class.on]="statusFilter() === 'pay'" (click)="statusFilter.set('pay')">To pay <b>{{ count('Approved') + count('LoadedOnBank') }}</b></button>
        <button [class.on]="statusFilter() === 'Paid'" (click)="statusFilter.set('Paid')">Paid · needs POP <b>{{ count('Paid') }}</b></button>
        <button [class.on]="statusFilter() === 'prepay'" (click)="statusFilter.set('prepay')">Open prepayments <b>{{ openPrepay() }}</b></button>
        <button [class.on]="statusFilter() === 'Closed'" (click)="statusFilter.set('Closed')">Closed <b>{{ count('Closed') }}</b></button>
      </div>
      <button mat-stroked-button class="cr-hist" [class.on]="historyOpen()" (click)="toggleHistory()" matTooltip="Every pack that has been paid — search by supplier, invoice, reference or amount"><mat-icon>history</mat-icon> Paid history</button>
      <span class="cr-spacer"></span>
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
        <div class="pick-lbl">Which company is paying?</div>
        <div class="cr-pick">
          @for (c of activeCompanies(); track c.code) {
            <button type="button" class="ptile" [class.on]="newBatch.companyCode === c.code" (click)="newBatch.companyCode = c.code" [matTooltip]="c.name">
              <span class="mark">
                @if (logo(c.code); as src) { <img [src]="src" [alt]="c.name"> }
                @else { <span class="mono" [style.--hue]="hue(c.code)">{{ monogram(c.code, c.name) }}</span> }
              </span>
              <b>{{ c.code }}</b><small>{{ c.name }}</small>
              @if (newBatch.companyCode === c.code) { <mat-icon class="tick">check_circle</mat-icon> }
            </button>
          }
        </div>
        <div class="row">
          <label>What kind of payment?
            <select [(ngModel)]="newBatch.paymentType">
              @for (p of meta()!.paymentTypes; track p.key) { <option [value]="p.key">{{ p.title }}</option> }
            </select>
          </label>
          <label>Payment date <input type="date" [(ngModel)]="newBatch.batchDate"></label>
          <label class="grow">Note for the approvers (optional) <input type="text" [(ngModel)]="newBatch.notes" placeholder="e.g. Week 46 daily creditors"></label>
        </div>
        @if (companyFor(newBatch.companyCode); as co) {
          <p class="hint" [class.warn]="!co.approvers?.accountants?.length">
            <mat-icon>{{ co.approvers?.accountants?.length ? 'verified_user' : 'warning' }}</mat-icon>
            <span>This pack will go to <strong>{{ names(co.approvers?.accountants) || 'any accountant (none assigned to this company yet)' }}</strong> for approval and then to <strong>{{ names(co.approvers?.directors) || 'a director (none assigned to this company yet)' }}</strong> to sign.</span>
          </p>
        }
        <p class="hint"><mat-icon>checklist</mat-icon> <span>Documents needed per payment for <strong>{{ typeTitle(newBatch.paymentType) }}</strong>: {{ rulesSummary(newBatch.paymentType) }}</span></p>
        <div class="actions"><button mat-button (click)="newOpen.set(false)">Cancel</button><button mat-flat-button color="primary" [disabled]="!newBatch.companyCode || busy()" (click)="create()">Create batch</button></div>
      </div>
    }

    @if (historyOpen()) {
      <div class="cr-card cr-history">
        <div class="cr-title sm"><h3><mat-icon>history</mat-icon> Paid payment packs</h3><button mat-button (click)="toggleHistory()"><mat-icon>close</mat-icon> Back to open packs</button></div>
        <p class="lead">Everything that has gone through the bank. Search by batch number, supplier, invoice number, payment reference, note or amount; expand a pack to see each payment and its proof of payment.</p>
        <app-payment-history [defaultDays]="historySupplier() ? 0 : 365" [supplier]="historySupplier()" [initialQuery]="historyQuery()"></app-payment-history>
      </div>
    } @else if (statusFilter() === 'queried') {
      <section class="cr-queries" aria-label="Queried payments">
        <p class="lead">When the director queries a payment it is neither approved nor rejected. It waits here for the preparer or the company accountant to answer; once every query on a pack is answered, the pack goes straight back to the director to decide.</p>
        @for (q of queries(); track q.itemId) {
          <article class="cq" [class.done]="q.state !== 'Open'">
            <header>
              <ng-container *ngTemplateOutlet="coMark; context: { $implicit: q.companyCode }"></ng-container>
              <div class="who">
                <b>{{ q.supplierName }}</b>
                <small>{{ q.companyName }} · <a href="" (click)="$event.preventDefault(); open(q.batchId)">{{ q.batchNumber }}</a>@if (q.invoiceNumbers) { · inv {{ q.invoiceNumbers }} }@if (q.fromBatch) { · split from {{ q.fromBatch }} }</small>
              </div>
              <span class="amt">R {{ q.amount | number:'1.2-2' }}</span>
              <span [class]="'qstate ' + q.state">{{ q.state === 'Open' ? 'Needs an answer' : q.state === 'Answered' ? 'Answered' : 'With the director' }}</span>
            </header>
            <div class="qa q"><mat-icon>help</mat-icon><div><small>{{ q.askedBy || 'Director' }}@if (q.askedAt) { · {{ q.askedAt | date:'d MMM HH:mm' }} }</small><p>{{ q.question }}</p></div></div>
            @if (q.answer) {
              <div class="qa a"><mat-icon>reply</mat-icon><div><small>{{ q.answeredBy }}@if (q.answeredAt) { · {{ q.answeredAt | date:'d MMM HH:mm' }} }</small><p>{{ q.answer }}</p></div></div>
            }
            @if (q.state === 'Open' && canAnswer()) {
              <div class="qreply">
                <textarea rows="2" [ngModel]="answerDraft()[q.itemId] || ''" (ngModelChange)="setAnswer(q.itemId, $event)" placeholder="Answer the director, or say what you changed"></textarea>
                <button mat-flat-button color="primary" [disabled]="busy() || !(answerDraft()[q.itemId] || '').trim()" (click)="answer(q)"><mat-icon>send</mat-icon> Send answer</button>
              </div>
            }
          </article>
        } @empty {
          <div class="cr-state"><mat-icon>task_alt</mat-icon><h3>No queried payments</h3><p>Nothing the director has queried is waiting.</p></div>
        }
      </section>
    } @else {
    @if (loading()) { <div class="cr-state"><mat-spinner diameter="32"></mat-spinner></div> }
    @else if (!groups().length) {
      <div class="cr-state"><mat-icon>inbox</mat-icon><h3>Nothing here</h3><p>No batches match these filters.</p></div>
    } @else {
      <div class="cr-cogrid">
      @for (g of groups(); track g.code) {
        <button class="cr-co" type="button" (click)="openCompany(g)" [class.back]="g.back > 0">
          <span class="mark">
            @if (logo(g.code); as src) { <img [src]="src" [alt]="g.name"> }
            @else { <span class="mono" [style.--hue]="hue(g.code)">{{ monogram(g.code, g.name) }}</span> }
          </span>
          <span class="nm">{{ g.name }}</span>
          <span class="stat"><b>{{ g.open }}</b> open batch{{ g.open === 1 ? '' : 'es' }}@if (g.back) { <em>· {{ g.back }} sent back</em> }</span>
          <span class="amt">R {{ g.openAmount | number:'1.2-2' }}</span>
          <span class="foot">{{ g.code }} · {{ g.rows.length }} total <mat-icon>chevron_right</mat-icon></span>
        </button>
      }
      </div>
      @if (meta()!.me.isAdmin && missingLogos().length) {
        <p class="cr-logo-note"><mat-icon>image_not_supported</mat-icon> Logos still to be added for <strong>{{ missingLogos().join(', ') }}</strong> — initials are shown until the artwork is uploaded to <code>/logos</code>.</p>
      }
    }
    }
  }

  <!-- ═══════════════════════ BATCH ═══════════════════════ -->
  @if (view() === 'batch' && batch(); as b) {
    <div class="cr-bhead">
      <button mat-icon-button (click)="back()" aria-label="Back to all batches" matTooltip="All batches"><mat-icon>arrow_back</mat-icon></button>
      <ng-container *ngTemplateOutlet="coMark; context: { $implicit: b.companyCode, size: 'lg' }"></ng-container>
      <div class="ttl">
        <h2>{{ b.batchNumber }} <span [class]="'badge lg ' + badge(b.status)">{{ b.statusTitle }}</span>
          @if (b.lockedAt) { <mat-icon class="lock" matTooltip="Signed and locked — nothing can be changed">lock</mat-icon> }
        </h2>
        <p><strong>{{ b.companyName }}</strong> is paying · {{ b.paymentTypeTitle }} · dated {{ b.batchDate | date:'dd MMM yyyy' }} · prepared by {{ b.preparedByName }}@if (b.notes) { · “{{ b.notes }}” }</p>
        @if (b.status === 'AwaitingAccountant' && b.requestedApproverNames) { <p class="sent-to"><mat-icon>forward_to_inbox</mat-icon> Sent to <strong>{{ b.requestedApproverNames }}</strong> for approval</p> }
        @if (b.status === 'AwaitingDirector' && b.requestedDirectorNames) { <p class="sent-to"><mat-icon>forward_to_inbox</mat-icon> Sent to <strong>{{ b.requestedDirectorNames }}</strong> to sign</p> }
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
          @if (b.can.edit) { <button mat-flat-button color="primary" [disabled]="!b.can.submit || busy()" (click)="openSend('submit')"><mat-icon>send</mat-icon> Submit to accountant</button> }
          @if (b.can.accountant) {
            <button mat-flat-button color="primary" (click)="openSend('approve')" [disabled]="busy() || accSendBackCount(b) === accLiveCount(b)" [matTooltip]="accSendBackCount(b) === accLiveCount(b) ? 'Every payment is marked Send back — use Send back for the whole pack' : ''"><mat-icon>task_alt</mat-icon> @if (accSendBackCount(b)) { Approve {{ accLiveCount(b) - accSendBackCount(b) }} &amp; send back {{ accSendBackCount(b) }} } @else { Approve &amp; send to director }</button>
            <button mat-stroked-button (click)="accountant('query')" [disabled]="busy()"><mat-icon>reply</mat-icon> Send back</button>
          }
          @if (b.can.reassign) { <button mat-flat-button color="primary" (click)="openSend('reassign')" [disabled]="busy()" matTooltip="The accountant you picked isn't available? Send the pack to another accountant — no need to resubmit or sign again"><mat-icon>swap_horiz</mat-icon> Change accountant</button> }
          @if (b.can.recall) { <button mat-stroked-button (click)="recall()" [disabled]="busy()" matTooltip="Pull the pack back to draft to make changes, then submit it again"><mat-icon>undo</mat-icon> Recall to draft</button> }
          @if (b.can.direct) {
            <button mat-stroked-button (click)="previewPack()" matTooltip="Read the whole pack — schedule, recons, invoices — before deciding"><mat-icon>menu_book</mat-icon> Review the pack</button>
            @if (pendingCount(b) > 0) { <button mat-stroked-button (click)="decideAll('Approved')" [disabled]="busy()"><mat-icon>done_all</mat-icon> Approve all {{ pendingCount(b) }} pending</button> }
            <button mat-flat-button color="primary" [disabled]="!b.can.sign || busy()" (click)="openSign()" [matTooltip]="pendingCount(b) > 0 ? 'Decide on every payment first' : ''"><mat-icon>draw</mat-icon> Sign batch</button>
          }
          @if (b.can.bankFile) { <button mat-stroked-button (click)="bankFile()"><mat-icon>download</mat-icon> Download bank file</button> }
          @if (b.items.length) { <button mat-stroked-button (click)="printSchedule()" [disabled]="busy()" matTooltip="Printable A4 landscape list of every payment with bank details, amounts and signature lines"><mat-icon>print</mat-icon> Print schedule</button> }
          @if (b.items.length && b.status !== 'Draft') { <button mat-stroked-button (click)="printApprovalSheet()" [disabled]="busy()" matTooltip="Only the payment pack approval sheet (schedule + signatures so far), without the documents — opens to print or download"><mat-icon>fact_check</mat-icon> Print approval sheet</button> }
          @if (b.lockedAt) { <button mat-stroked-button (click)="downloadSignedPack()" matTooltip="Approval sheet + every PDF in the pack, each stamped with the three signatures"><mat-icon>workspace_premium</mat-icon> Signed pack (PDF)</button> }
          @if (b.can.markLoaded) { <button mat-flat-button color="primary" (click)="setStatus('LoadedOnBank')"><mat-icon>account_balance</mat-icon> Loaded on bank</button> }
          @if (b.can.markPaid) { <button mat-flat-button color="primary" (click)="setStatus('Paid')"><mat-icon>price_check</mat-icon> Mark as paid</button> }
          @if (b.can.close) { <button mat-flat-button color="primary" (click)="setStatus('Closed')" [disabled]="missingPop(b) > 0 || openPrepayCount(b) > 0"><mat-icon>inventory</mat-icon> Close batch</button> }
          @if (b.can.rerunChecks && b.items.length && b.status !== 'Closed') { <button mat-button (click)="rerun()" [disabled]="busy()"><mat-icon>rule</mat-icon> Re-run checks</button> }
          @if (b.can.delete) { <button mat-button color="warn" (click)="deleteBatch()" [matTooltip]="b.status === 'Draft' ? 'Remove this draft' : 'Remove this pack — it has not been signed or paid'"><mat-icon>delete</mat-icon> {{ b.status === 'Draft' ? 'Delete draft' : 'Delete pack' }}</button> }
        </div>
      </div>
    }

    @if (sendOpen(); as mode) {
      <div class="cr-card cr-sign cr-send">
        <h3><mat-icon>{{ mode === 'submit' ? 'send' : mode === 'reassign' ? 'swap_horiz' : 'task_alt' }}</mat-icon> {{ mode === 'submit' ? 'Send this pack for approval' : mode === 'reassign' ? 'Send this pack to a different accountant' : 'Approve and send for signature' }}</h3>
        <p class="muted">
          @if (mode === 'submit') { The pack has been prepared and checked. Choose which accountant(s) must check and approve it — each one gets an intranet notification and an email. }
          @else if (mode === 'reassign') { It's with {{ b.requestedApproverNames || 'the company accountants' }} now. Pick who should approve it instead — they get a notification and an email, and the pack stays ready for approval (no need to resubmit or sign again). }
          @else { Choose which director(s) must sign this pack — each one gets an intranet notification and an email. }
        </p>
        @if (!sendOptions()) { <div class="cr-state"><mat-spinner diameter="24"></mat-spinner></div> }
        @else {
          @let toAcc = mode !== 'approve';
          @let opts = toAcc ? sendOptions()!.accountants : sendOptions()!.directors;
          @let fallback = toAcc ? sendOptions()!.accountantsFallback : sendOptions()!.directorsFallback;
          @if (fallback) { <p class="hint warn"><mat-icon>warning</mat-icon> <span>No {{ toAcc ? 'accountant' : 'director' }} is assigned to {{ b.companyName }} under Settings › Users, so everyone with that role is offered.</span></p> }
          @if (!opts.length) { <p class="hint warn"><mat-icon>person_off</mat-icon> <span>Nobody is available to {{ toAcc ? 'approve' : 'sign' }} this pack. Ask an admin to give someone the {{ toAcc ? 'Accountant' : 'Director' }} role and this company.</span></p> }
          <div class="send-list">
            @for (p of opts; track p.userId) {
              <label class="send-row" [class.on]="sendPick.has(p.userId)">
                <input type="checkbox" [checked]="sendPick.has(p.userId)" (change)="togglePick(p.userId)">
                <span class="av">{{ initials(p.name) }}</span>
                <span class="who"><b>{{ p.name }}@if (mode === 'reassign' && (b.requestedApproverIds ?? []).includes(p.userId)) { <span class="cur"> · has it now</span> }</b><small>{{ p.role }}@if (p.email) { <span class="em">{{ p.email }}</span> }</small></span>
              </label>
            }
          </div>
          @if (mode === 'approve') { <label>Note for the director (optional) <input type="text" [(ngModel)]="sendNote" placeholder="e.g. All recons agree, two new suppliers verified"></label> }
          @if (mode === 'reassign') {
            <label>Note for the accountant (optional) <input type="text" [(ngModel)]="sendNote" placeholder="e.g. Colleen is off today and these must be paid today"></label>
            <div class="actions">
              <button mat-button (click)="sendOpen.set(null)">Cancel</button>
              <button mat-flat-button color="primary" [disabled]="busy() || sendPick.size === 0" (click)="reassign()"><mat-icon>swap_horiz</mat-icon> Send to {{ sendPick.size === 1 ? pickedName(opts) : sendPick.size + ' people' }}</button>
            </div>
          } @else {
          <ng-container *ngTemplateOutlet="sigBlock; context: { $implicit: mode === 'submit' ? 'Sign as the preparer — confirms the pack was prepared and checked' : 'Sign as the accountant — your signature goes on the pack' }"></ng-container>
          <div class="actions">
            <button mat-button (click)="sendOpen.set(null)">Cancel</button>
            <button mat-flat-button color="primary" [disabled]="busy() || (opts.length > 0 && sendPick.size === 0) || !canSign()" (click)="mode === 'submit' ? submit() : accountant('approve')">
              <mat-icon>draw</mat-icon> {{ mode === 'submit' ? 'Sign & send to ' : 'Sign, approve & send to ' }}{{ sendPick.size === 1 ? '1 person' : sendPick.size + ' people' }}
            </button>
          </div>
          }
        }
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
        <ng-container *ngTemplateOutlet="sigBlock; context: { $implicit: 'Sign as the director — locks the pack and releases it to the pay-run' }"></ng-container>
        <label>Comment (optional) <input type="text" [(ngModel)]="signComment"></label>
        <div class="actions"><button mat-button (click)="signOpen.set(false)">Cancel</button><button mat-flat-button color="primary" [disabled]="!signName || busy() || !canSign()" (click)="sign()">Sign & lock</button></div>
      </div>
    }

    <!-- Shared digital-signature block: saved signature from the profile, or draw one now -->
    @if (progress(); as p) {
      <div class="up-strip" role="status" aria-live="polite">
        <div class="up-head">
          <mat-icon>{{ p.pct < 100 ? 'cloud_upload' : 'document_scanner' }}</mat-icon>
          <span class="up-label">{{ p.label }}</span>
          <b class="up-pct">{{ p.pct < 100 ? p.pct + '%' : 'reading…' }}</b>
        </div>
        <mat-progress-bar [mode]="p.pct < 100 ? 'determinate' : 'indeterminate'" [value]="p.pct"></mat-progress-bar>
        <small>{{ p.pct < 100 ? 'Uploading ' + p.file : 'Uploaded — reading the text off the pages (scans take longer)' }}@if (p.total > 1) { · file {{ p.index }} of {{ p.total }} }</small>
      </div>
    }

    <ng-template #sigBlock let-caption>
      <div class="sig-block">
        <div class="sig-head"><mat-icon>verified_user</mat-icon> <b>Digital signature</b> <small>{{ caption }}</small></div>
        <div class="sig-modes">
          <button type="button" class="sig-mode" [class.on]="sigMode() === 'saved'" [disabled]="!meta()!.me.hasSignature" (click)="sigMode.set('saved')" [matTooltip]="meta()!.me.hasSignature ? '' : 'No saved signature yet — add one under your profile menu › My signature'">
            <mat-icon>{{ meta()!.me.hasSignature ? 'how_to_reg' : 'person_off' }}</mat-icon> Use my saved signature
          </button>
          <button type="button" class="sig-mode" [class.on]="sigMode() === 'draw'" (click)="sigMode.set('draw')"><mat-icon>gesture</mat-icon> Draw it now</button>
        </div>
        @if (sigMode() === 'saved') {
          <div class="sig-saved"><img [appSecureSrc]="mySignatureUrl" alt="Your saved signature"><small>Applied to the approval sheet and every PDF in this pack with your name, date, time and a tamper-evident hash.</small></div>
        } @else {
          <div class="sig-draw">
            <canvas #sigpad width="520" height="140" class="sigpad" (pointerdown)="padDown($event)" (pointermove)="padMove($event)" (pointerup)="padUp()" (pointerleave)="padUp()"></canvas>
            <div class="sig-draw-foot"><small>{{ drewSig() ? 'Signature captured.' : 'Draw your signature with the mouse or finger.' }}</small><button mat-button type="button" (click)="padClear()">Clear</button></div>
          </div>
        }
      </div>
    </ng-template>

    <div class="cr-grid">
      <div class="cr-main">

        <section class="cr-card">
          <header>
            <h3><mat-icon>list_alt</mat-icon> Payments <span class="cnt">{{ b.items.length }}</span></h3>
            <small>{{ docsFilledItems(b) }} of {{ docsRequiredItems(b) }} required documents attached</small>
            @if (b.items.length) { <button mat-icon-button (click)="previewPack()" matTooltip="Preview all — approval sheet + every document in the pack, in one scroll"><mat-icon>visibility</mat-icon></button> }
            @if (b.can.edit) { <button mat-flat-button color="primary" (click)="startItem()"><mat-icon>add</mat-icon> Add payment</button> }
          </header>

          @if (itemForm() && isStaff()) {
            <div class="cr-itemform">
              <h4>{{ itemForm() === 'new' ? 'New' : 'Edit' }} {{ isReqPay() ? 'requisition payment' : 'staff payment' }}</h4>

              <h5>1 · Requisition form</h5>
              <div class="sig-modes">
                <button type="button" class="sig-mode" [class.on]="reqMode() === 'upload'" (click)="reqMode.set('upload')"><mat-icon>upload_file</mat-icon> Upload a filled-in requisition</button>
                <button type="button" class="sig-mode" [class.on]="reqMode() === 'fill'" (click)="reqMode.set('fill'); pendingInvoiceFile = null; readInfo.set('')"><mat-icon>edit_document</mat-icon> Fill one in here</button>
              </div>
              @if (reqMode() === 'upload') {
                <div class="inv-src">
                  @if (!pendingInvoiceFile) {
                    <button mat-stroked-button (click)="invFileInput.click()" [disabled]="reading()"><mat-icon>upload_file</mat-icon> Upload requisition form</button>
                    <small class="muted">No invoice needed. We read the PDF and fill in {{ isReqPay() ? 'who is being paid' : 'the employee' }}, the amount and the reason{{ stmtIncluded() ? ', plus the bank details from the bank statement scanned in with it' : '' }}.</small>
                    @if (reading()) { <mat-spinner diameter="18"></mat-spinner> }
                  } @else {
                    <span class="chip ok"><mat-icon>picture_as_pdf</mat-icon> {{ pendingInvoiceFile.name }} @if (readInfo()) { · {{ readInfo() }} }</span>
                    @if (reading()) { <mat-spinner diameter="18"></mat-spinner> }
                    <button mat-icon-button (click)="pendingInvoiceFile = null; readInfo.set('')" matTooltip="Remove"><mat-icon>close</mat-icon></button>
                  }
                  <input #invFileInput type="file" accept="application/pdf" hidden (change)="staffFileChosen($event, 'req')">
                </div>
                <mat-checkbox [checked]="!stmtIncluded()" (change)="stmtIncluded.set(!$event.checked)">Uploaded without the bank statement (upload it separately)</mat-checkbox>
              } @else {
                <div class="row">
                  <label>Date <input type="date" [(ngModel)]="reqForm.date"></label>
                  <label class="grow">Requested by <input [(ngModel)]="reqForm.requestedBy" placeholder="leave blank for yourself"></label>
                  <label class="grow">Authorised by (manager) <input [(ngModel)]="reqForm.authorisedBy" placeholder="optional"></label>
                </div>
                <div class="row">
                  <label class="grow">Notes <input [(ngModel)]="reqForm.notes" placeholder="optional"></label>
                </div>
              }

              <h5>2 · Who and how much</h5>
              <div class="row">
                <label class="grow">{{ isReqPay() ? 'Paid to' : 'Employee name' }} <input [(ngModel)]="itemDraft.supplierName" [placeholder]="isReqPay() ? 'Name as on the requisition' : 'Full name as on the requisition'" required autocomplete="off"></label>
                @if (reqMode() === 'fill') {
                  <label>{{ isReqPay() ? 'ID / reference no.' : 'Employee ID / no.' }} <input [(ngModel)]="reqForm.employeeNumber" placeholder="optional"></label>
                  <label>Department <input [(ngModel)]="reqForm.department" placeholder="optional"></label>
                }
                <label>Amount (R) <input type="number" step="0.01" [(ngModel)]="itemDraft.amount"></label>
              </div>
              <div class="row">
                <label class="grow">Reason for the payment <input [(ngModel)]="itemDraft.description" placeholder="e.g. travel reimbursement, salary advance…"></label>
                <label>Reference no. <input [(ngModel)]="itemDraft.invoiceNumbers" placeholder="optional"></label>
              </div>

              @if (reqMode() === 'fill' || !stmtIncluded()) {
                <h5>3 · Bank statement</h5>
                <div class="inv-src recon">
                  @if (!pendingStatementFile) {
                    <button mat-stroked-button (click)="stmtFileInput.click()"><mat-icon>account_balance</mat-icon> Upload bank statement</button>
                    <small>{{ isEWallet() ? 'Not needed for an eWallet payment.' : 'PDF. We read the bank details off it — or add it under the payment later.' }}</small>
                  } @else {
                    <span class="chip ok"><mat-icon>account_balance</mat-icon> {{ pendingStatementFile.name }} @if (statementInfo()) { · {{ statementInfo() }} }</span>
                    <button mat-icon-button (click)="pendingStatementFile = null; statementInfo.set('')" matTooltip="Remove"><mat-icon>close</mat-icon></button>
                  }
                  <input #stmtFileInput type="file" accept="application/pdf" hidden (change)="staffFileChosen($event, 'stmt')">
                </div>
              }

              <h5>{{ staffStep('pay') }} · eWallet or EFT</h5>
              <div class="sig-modes">
                <button type="button" class="sig-mode" [class.on]="!isEWallet()" (click)="setPayout('EFT')"><mat-icon>account_balance</mat-icon> EFT to a bank account</button>
                <button type="button" class="sig-mode" [class.on]="isEWallet()" (click)="setPayout('EWallet')"><mat-icon>smartphone</mat-icon> eWallet</button>
              </div>
              @if (isEWallet()) {
                <div class="row">
                  <label>eWallet cellphone number <input [(ngModel)]="itemDraft.accountNumber" inputmode="tel" placeholder="082 123 4567"></label>
                  <label class="grow">Reference <input [(ngModel)]="itemDraft.paymentReference" placeholder="optional"></label>
                </div>
              } @else {
                <div class="row">
                  <label>Bank <input [(ngModel)]="itemDraft.bankName"></label>
                  <label>Account number <input [(ngModel)]="itemDraft.accountNumber"></label>
                  <label>Branch code <input [(ngModel)]="itemDraft.branchCode"></label>
                  <label class="grow">Account holder <input [(ngModel)]="itemDraft.accountHolder"></label>
                  <label>Reference on their statement <input [(ngModel)]="itemDraft.paymentReference"></label>
                </div>
                <p class="hint"><mat-icon>account_balance</mat-icon> <span>{{ hasReadBank() ? 'Read from the bank statement — check them and correct anything that is off.' : 'Filled in from the bank statement when we can read it, or type them in.' }}</span></p>
              }

              <h5>{{ staffStep('when') }} · How it should be paid</h5>
              <div class="row mode">
                <mat-checkbox [(ngModel)]="itemDraft.isUrgent" class="urgent"><mat-icon>priority_high</mat-icon> Urgent — must go out ahead of the normal run</mat-checkbox>
              </div>
              <div class="actions">
                <button mat-button (click)="cancelItem()">Cancel</button><button mat-flat-button color="primary" [disabled]="!itemDraft.supplierName || !itemDraft.amount || busy() || reading()" (click)="saveItem()">{{ itemForm() === 'new' ? 'Add payment' : 'Save' }}</button>
              </div>
            </div>
          } @else if (itemForm()) {
            <div class="cr-itemform">
              <h4>{{ itemForm() === 'new' ? 'New payment' : 'Edit payment' }}</h4>

              <h5>1 · {{ isPrepayment() ? 'Request form' : isCompliance() ? 'Supporting document (optional)' : 'Invoice and recon' }}</h5>
              <div class="inv-src">
                @if (!pendingInvoiceFile && !pendingLink) {
                  <button mat-stroked-button (click)="invFileInput.click()" [disabled]="reading()"><mat-icon>upload_file</mat-icon> {{ isPrepayment() ? 'Upload request form' : isCompliance() ? 'Upload document' : 'Upload invoice' }}</button>
                  @if (!isPrepayment() && !isCompliance()) { <button mat-stroked-button (click)="openPicker()"><mat-icon>link</mat-icon> Link from Books</button> }
                  @if (isPrepayment()) { <small class="muted">A prepayment starts from the signed <strong>request form</strong> — we read it and fill in who is being paid, the amount and what it's for. Once the payment is added, attach the <strong>quote</strong>, <strong>bank letter</strong> and <strong>purchase order</strong> under it. The tax invoice comes later, once the goods are delivered.</small> }
                  @else if (isCompliance()) { <small class="muted">Attach the invoice, licence or payment instruction behind this payment if you have it. The amount is typed in below — it isn't taken from an invoice in the system.</small> }
                  @else { <small class="muted">We read the PDF and fill in who is being paid, the amount, invoice number, description and any bank details printed on it. Or link an invoice already captured in Books.</small> }
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
                  <input [(ngModel)]="itemDraft.supplierName" (ngModelChange)="searchSuppliers($event)" (focus)="searchSuppliers(itemDraft.supplierName)" (blur)="hideSuppliersSoon()" placeholder="Start typing a vendor from the aging, Books or a past payment — or type a new name" required autocomplete="off">
                  @if (showSuppliers() && (supplierHits().length || (supSearched() && itemDraft.supplierName?.trim()))) {
                    <ul class="ac">
                      @for (s of supplierHits(); track s.name) {
                        <li (mousedown)="$event.preventDefault(); pickSupplier(s)">
                          <strong>{{ s.name }}</strong>
                          <small>@if (s.vendorCode) { <span class="vc">{{ s.vendorCode }}</span> } @if (s.agingCompany) { <span class="vc co" [class.other]="s.agingCompany !== b.companyCode" [matTooltip]="s.agingCompany === b.companyCode ? 'On the creditors aging of this company' : 'On the creditors aging of ' + s.agingCompany">{{ s.agingCompany }} aging</span> } @if (s.vendorCode || s.agingCompany) { · } @if (s.agingBalance != null) { <span class="agb" [class.neg]="s.agingBalance < 0">owes R {{ s.agingBalance | number:'1.0-0' }}</span>@if (s.agingOverdue) { <em> ({{ s.agingOverdue | number:'1.0-0' }} overdue)</em> } · } @if (s.vatNumber) { VAT {{ s.vatNumber }} · } @if (s.bankName) { {{ s.bankName }} ···{{ (s.accountNumber || '').slice(-4) }} · } {{ s.payments }} payment{{ s.payments === 1 ? '' : 's' }}, {{ s.invoices }} invoice{{ s.invoices === 1 ? '' : 's' }}</small>
                        </li>
                      }
                      @if (itemDraft.supplierName?.trim() && !supExact()) {
                        <li class="ac-new" (mousedown)="$event.preventDefault(); showSuppliers.set(false)">
                          <mat-icon>add_business</mat-icon>
                          <span><strong>Use “{{ itemDraft.supplierName.trim() }}” as a new supplier</strong><small>{{ supplierHits().length ? 'Not the one you mean? Keep what you typed.' : 'Not on any creditors aging, in Books or in a past pack — bank details will need to come from the bank letter.' }}</small></span>
                        </li>
                      }
                    </ul>
                  }
                </label>
                <label>{{ isCompliance() ? 'Amount to pay (R)' : 'Amount incl. VAT (R)' }} <input type="number" step="0.01" [(ngModel)]="itemDraft.amount"></label>
              </div>

              <h5>3 · What is it for</h5>
              @if (isCompliance()) {
                <div class="row">
                  <label>Compliance payment type
                    <select [(ngModel)]="itemDraft.complianceKind" required>
                      <option [ngValue]="null" disabled>Choose…</option>
                      @for (k of complianceKinds; track k.key) { <option [ngValue]="k.key">{{ k.title }}</option> }
                    </select>
                  </label>
                  @if (itemDraft.complianceKind === 'Other') {
                    <label class="grow">What is it for? <input [(ngModel)]="itemDraft.complianceDetail" maxlength="200" placeholder="e.g. SAHPRA annual fee, import permit…" required></label>
                  }
                </div>
              }
              <div class="row">
                <label class="grow">{{ isPrepayment() ? 'Request / quote / PO numbers' : isCompliance() ? 'Invoice / licence / reference numbers' : 'Invoice / reference numbers being paid' }} <input [(ngModel)]="itemDraft.invoiceNumbers" [placeholder]="isPrepayment() ? 'REQ12, Q1234, PO5678' : 'INV123, INV124'"></label>
                <label class="grow">Description <input [(ngModel)]="itemDraft.description" placeholder="e.g. March stock, repairs to bakkie…"></label>
              </div>

              @if (isPrepayment()) {
                <p class="hint"><mat-icon>account_balance</mat-icon> <span>Bank details are not captured on prepayments — Treasury loads the beneficiary manually from the bank letter when the payment is made.</span></p>
              } @else {
              <h5>4 · Bank details (as on the bank letter)</h5>
              <div class="row">
                <label>Bank <input [(ngModel)]="itemDraft.bankName"></label>
                <label>Account number <input [(ngModel)]="itemDraft.accountNumber"></label>
                <label>Branch code <input [(ngModel)]="itemDraft.branchCode"></label>
                <label class="grow">Account holder <input [(ngModel)]="itemDraft.accountHolder"></label>
                <label>Reference on their statement <input [(ngModel)]="itemDraft.paymentReference"></label>
              </div>
              }
              @if (b.paymentType === 'CreditNote') {
                <mat-checkbox [(ngModel)]="itemDraft.stockReturned">Stock physically came back (warehouse GRV + collection slip will be required)</mat-checkbox>
              }
              <h5>{{ isPrepayment() ? '4' : '5' }} · How it should be paid</h5>
              <div class="row mode">
                <label class="grow">Payment
                  <select [(ngModel)]="itemDraft.paymentMode">
                    <option value="Normal">Normal payment (default)</option>
                    <option value="PayAndClear">Pay and clear — settle and clear the supplier account</option>
                  </select>
                </label>
                <mat-checkbox [(ngModel)]="itemDraft.isUrgent" class="urgent"><mat-icon>priority_high</mat-icon> Urgent — must go out ahead of the normal run</mat-checkbox>
              </div>
              <div class="actions">
                @if (itemForm() === 'new' && needsRecon() && !pendingReconFile) { <small class="warn-txt"><mat-icon>warning</mat-icon> Attach the supplier recon before adding this payment.</small> }
                @else if (!complianceOk()) { <small class="warn-txt"><mat-icon>warning</mat-icon> {{ itemDraft.complianceKind === 'Other' ? 'Say what the compliance payment is for.' : 'Choose the compliance payment type.' }}</small> }
                @else if (itemForm() === 'new' && needsSage()) { <small class="warn-txt"><mat-icon>warning</mat-icon> The recon must come with the Sage aged payables PDF.</small> }
                <button mat-button (click)="cancelItem()">Cancel</button><button mat-flat-button color="primary" [disabled]="!itemDraft.supplierName || !itemDraft.amount || busy() || !complianceOk() || (itemForm() === 'new' && ((needsRecon() && !pendingReconFile) || needsSage()))" (click)="saveItem()">{{ itemForm() === 'new' ? 'Add payment' : 'Save' }}</button>
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
                @if (it.complianceTitle) { <span class="cmp" matTooltip="Compliance payment">Compliance · {{ it.complianceTitle }}</span> }
                @if (it.isUrgent) { <span class="urg" matTooltip="Flagged urgent by the preparer"><mat-icon>priority_high</mat-icon> Urgent</span> }
                @if (it.paymentMode === 'PayAndClear') { <span class="pre pac" matTooltip="Pay and clear the supplier account">pay &amp; clear</span> }
                @if (it.prepaymentOpen && it.paidAt) { <span class="pre">awaiting invoice + GRV</span> }
                @if (it.decisionStatus !== 'Pending') { <span [class]="'dec ' + it.decisionStatus.toLowerCase()">{{ it.decisionStatus === 'SentBack' ? 'Sent back' : it.decisionStatus }}</span> }
                <span class="amt">R {{ it.amount | number:'1.2-2' }}</span>
                @if (previewableDocs(it).length) { <button mat-icon-button (click)="$event.stopPropagation(); previewItem(it)" [matTooltip]="'Preview all — approval sheet + ' + (previewableDocs(it).length === 1 ? 'the document' : previewableDocs(it).length + ' documents') + ' for this payment'"><mat-icon>visibility</mat-icon></button> }
                @if (b.can.edit) {
                  <button mat-icon-button (click)="$event.stopPropagation(); startItem(it)" matTooltip="Edit"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button (click)="$event.stopPropagation(); removeItem(it)" matTooltip="Remove"><mat-icon>delete</mat-icon></button>
                }
              </div>

              @if (b.can.accountant && it.decisionStatus !== 'SentBack') {
                <div class="decide">
                  <span>Accountant:</span>
                  <button mat-stroked-button [class.sel-ok]="it.accountantDecision === 'Approved'" (click)="accDecide(it, it.accountantDecision === 'Approved' ? 'Pending' : 'Approved')" matTooltip="Send this payment forward to the director"><mat-icon>thumb_up</mat-icon> Approve</button>
                  <button mat-stroked-button [class.sel-bad]="it.accountantDecision === 'SentBack'" (click)="accDecide(it, it.accountantDecision === 'SentBack' ? 'Pending' : 'SentBack')" matTooltip="Send this one payment back to the preparer; the rest can still go to the director"><mat-icon>reply</mat-icon> Send back</button>
                  @if (it.accountantDecisionComment) { <em>“{{ it.accountantDecisionComment }}”</em> }
                </div>
              }
              @if (b.can.direct && it.decisionStatus !== 'SentBack') {
                <div class="decide">
                  <span>Your decision:</span>
                  <button mat-stroked-button [class.sel-ok]="it.decisionStatus === 'Approved'" (click)="decide(it, 'Approved')"><mat-icon>thumb_up</mat-icon> Approve</button>
                  <button mat-stroked-button [class.sel-warn]="it.decisionStatus === 'Queried'" (click)="decide(it, 'Queried')"><mat-icon>help</mat-icon> Query</button>
                  <button mat-stroked-button [class.sel-bad]="it.decisionStatus === 'Rejected'" (click)="decide(it, 'Rejected')"><mat-icon>thumb_down</mat-icon> Reject</button>
                  @if (it.decisionComment) { <em>“{{ it.decisionComment }}”</em> }
                </div>
              } @else if (it.decisionStatus === 'SentBack') {
                <div class="itrej">
                  <mat-icon>reply</mat-icon>
                  <div class="t"><b>Sent back by {{ b.accountantName || 'the accountant' }}</b><span>{{ it.accountantDecisionComment || it.decisionComment || 'No reason given' }}</span></div>
                  @if (it.resubmittedAsBatchNumber) { <span class="re">Resubmitted on {{ it.resubmittedAsBatchNumber }}</span> }
                  @else if (meta()!.me.clerk || meta()!.me.isAdmin) { <button mat-stroked-button [disabled]="busy()" (click)="$event.stopPropagation(); resubmit(b, it)" matTooltip="Put a copy of this payment, with its documents, on a new draft pack to correct and send through again"><mat-icon>restart_alt</mat-icon> Fix and resubmit</button> }
                </div>
              } @else if (it.decisionStatus === 'Rejected' && b.directorSignedAt) {
                <div class="itrej">
                  <mat-icon>block</mat-icon>
                  <div class="t"><b>Rejected by {{ b.directorName || 'the director' }}</b><span>{{ it.decisionComment || 'No reason given' }}</span></div>
                  @if (it.resubmittedAsBatchNumber) { <span class="re">Resubmitted on {{ it.resubmittedAsBatchNumber }}</span> }
                  @else if (meta()!.me.clerk || meta()!.me.isAdmin) { <button mat-stroked-button [disabled]="busy()" (click)="$event.stopPropagation(); resubmit(b, it)" matTooltip="Put a copy of this payment, with its documents, on a new draft pack to correct and send through again"><mat-icon>restart_alt</mat-icon> Fix and resubmit</button> }
                </div>
              } @else if (it.decisionComment && !it.queryQuestion) { <div class="deccomment"><mat-icon>chat</mat-icon> Director: “{{ it.decisionComment }}”</div> }
              @if (it.accountantDecisionComment && it.decisionStatus !== 'SentBack' && !b.can.accountant) { <div class="deccomment"><mat-icon>fact_check</mat-icon> Accountant: “{{ it.accountantDecisionComment }}”</div> }
              @if (it.queryQuestion) {
                <div class="itq">
                  <div class="qa q"><mat-icon>help</mat-icon><div><small>Query from {{ it.queryAskedByName || 'the director' }}@if (it.queryAskedAt) { · {{ it.queryAskedAt | date:'d MMM HH:mm' }} }@if (it.queriedFromBatchNumber) { · split from {{ it.queriedFromBatchNumber }} }</small><p>{{ it.queryQuestion }}</p></div></div>
                  @if (it.queryResponse) { <div class="qa a"><mat-icon>reply</mat-icon><div><small>{{ it.queryRespondedByName }}@if (it.queryRespondedAt) { · {{ it.queryRespondedAt | date:'d MMM HH:mm' }} }</small><p>{{ it.queryResponse }}</p></div></div> }
                  @else if (b.status === 'QueriedByDirector' && it.decisionStatus === 'Queried' && canAnswer()) {
                    <div class="qreply">
                      <textarea rows="2" [ngModel]="answerDraft()[it.id] || ''" (ngModelChange)="setAnswer(it.id, $event)" placeholder="Answer the director, or say what you changed"></textarea>
                      <button mat-flat-button color="primary" [disabled]="busy() || !(answerDraft()[it.id] || '').trim()" (click)="answerItem(b, it)"><mat-icon>send</mat-icon> Send answer</button>
                    </div>
                  }
                </div>
              }

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

        <section class="cr-card cr-sched">
          <header>
            <h3><mat-icon>event_repeat</mat-icon> Payment schedule</h3>
            <small>Generated from the payments below — updates as you add them. Nothing to upload.</small>
            @if (b.items.length) {
              <button mat-icon-button (click)="previewSchedule()" [disabled]="!schedule()?.lines?.length" matTooltip="Preview the schedule"><mat-icon>visibility</mat-icon></button>
              <button mat-stroked-button (click)="downloadSchedule()" [disabled]="busy()"><mat-icon>download</mat-icon> Download Excel</button>
            }
          </header>
          @if (schedule(); as s) {
            @if (s.lines.length) {
              <div class="meta"><span><b>{{ s.head.company }}</b> · {{ s.head.paymentType }}</span><span>Payment run <b>{{ s.head.paymentRunDate | date:'dd MMM yyyy' }}</b></span><span>{{ s.head.count }} payment{{ s.head.count === 1 ? '' : 's' }}</span>
                @if (s.head.missingInvoiceDates || s.head.missingDocNumbers) { <span class="gap"><mat-icon>info</mat-icon>@if (s.head.missingDocNumbers) { {{ s.head.missingDocNumbers }} without a document number } @if (s.head.missingInvoiceDates && s.head.missingDocNumbers) { · } @if (s.head.missingInvoiceDates) { {{ s.head.missingInvoiceDates }} without an invoice date } — attach the tax invoice and they fill in</span> }
              </div>
              <div class="tbl">
                <table>
                  <thead><tr><th>#</th><th>Supplier</th><th>Invoice date</th><th>Document number</th><th>Payable by</th><th class="num">Amount</th></tr></thead>
                  <tbody>
                    @for (l of s.lines; track l.itemId) {
                      <tr [class.rej]="l.decision === 'Rejected'">
                        <td class="muted">{{ l.no }}</td>
                        <td><strong>{{ l.supplier }}</strong>@if (l.description) { <small class="muted"> · {{ l.description }}</small> }</td>
                        <td>{{ l.invoiceDate ? (l.invoiceDate | date:'dd MMM yyyy') : '—' }}</td>
                        <td class="ref">{{ l.documentNumber || '—' }}</td>
                        <td>{{ l.payableBy | date:'dd MMM yyyy' }}</td>
                        <td class="num">R {{ l.amount | number:'1.2-2' }}</td>
                      </tr>
                    }
                  </tbody>
                  <tfoot><tr><td colspan="5">Total</td><td class="num">R {{ s.head.total | number:'1.2-2' }}</td></tr></tfoot>
                </table>
              </div>
            } @else { <p class="empty">Add the first payment and the schedule appears here.</p> }
          } @else { <p class="empty">Loading…</p> }
        </section>

        <section class="cr-card">
          <header><h3><mat-icon>folder</mat-icon> Documents for the whole batch</h3><small>{{ filledCount(b.requiredBatchDocs) }} of {{ b.requiredBatchDocs.length }} attached</small></header>
          <ng-container *ngTemplateOutlet="checklist; context: { required: b.requiredBatchDocs, recommended: [], docs: b.batchDocuments, itemId: null }"></ng-container>
          @if (b.can.edit || b.can.uploadAfterLock) {
            <div class="drop" (dragover)="$event.preventDefault()" (drop)="drop($event, null)">
              <mat-icon>upload_file</mat-icon> Drop batch PDFs here (creditors recon) or <button mat-button (click)="pickFor('', null)">choose files</button>
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
                  @if (!d.isNotApplicable) { <button mat-icon-button matTooltip="Preview" (click)="openDoc(d)"><mat-icon>visibility</mat-icon></button> }
                  @if (b.can.edit) { <button mat-icon-button matTooltip="Remove" (click)="removeDoc(d)"><mat-icon>close</mat-icon></button> }
                  @else if (b.can.uploadAfterLock && !d.isNotApplicable) { <button mat-icon-button matTooltip="Replace (reason required)" (click)="replaceDoc(d)"><mat-icon>published_with_changes</mat-icon></button> }
                }
                @if (!r.filled && (b.can.edit || b.can.uploadAfterLock)) {
                  <button mat-stroked-button class="sm" [disabled]="busy()" (click)="pickFor(r.docType, itemId)"><mat-icon>upload</mat-icon> Upload</button>
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
                    @if (!d.isNotApplicable) { <button mat-icon-button matTooltip="Preview" (click)="openDoc(d)"><mat-icon>visibility</mat-icon></button> }
                    @if (b.can.edit) { <button mat-icon-button matTooltip="Remove" (click)="removeDoc(d)"><mat-icon>close</mat-icon></button> }
                  }
                  @if (b.can.edit || b.can.uploadAfterLock) {
                    <button mat-stroked-button class="sm" [disabled]="busy()" (click)="pickFor(r.docType, itemId)"><mat-icon>upload</mat-icon> {{ r.filled ? 'Add another' : 'Upload' }}</button>
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
              <button mat-icon-button matTooltip="Preview" (click)="openDoc(d)"><mat-icon>visibility</mat-icon></button>
              @if (b.can.edit) { <button mat-icon-button matTooltip="Remove" (click)="removeDoc(d)"><mat-icon>close</mat-icon></button> }
            </div>
          </li>
        }
        @if (!required.length && !docs.length) { <li class="none">No documents are required here.</li> }
      </ul>
    </ng-template>
    <input #fileInput type="file" [accept]="pickAccept" multiple hidden (change)="filesChosen($event)">
  }

  <!-- Company mark: the full brand logo, or an initials placeholder when none has been uploaded yet. -->
  <ng-template #coMark let-code let-size="size">
    <span [class]="'comark ' + (size || 'sm')" [class.nologo]="!logo(code)" [matTooltip]="logo(code) ? '' : 'Logo not uploaded yet'">
      @if (logo(code); as src) { <img [src]="src" [alt]="companyFor(code)?.name || code"> }
      @else { <span class="mono" [style.--hue]="hue(code)">{{ monogram(code, companyFor(code)?.name) }}</span> }
    </span>
  </ng-template>
  }
  `,
  styles: [`
    :host { display: block; }
    .cr-state { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); padding: var(--space-8) var(--space-4); color: var(--color-text-3); text-align: center; mat-icon { font-size: 44px; width: 44px; height: 44px; } h3 { margin: 0; color: var(--color-text); } p { margin: 0; } }
    .cr-spacer { flex: 1; }
    .muted { color: var(--color-text-3); } .nowrap { white-space: nowrap; } .ref { font-family: var(--font-mono); font-weight: 600; }

    .cr-title { display: flex; align-items: center; gap: 4px; margin-bottom: var(--space-3); h2 { margin: 0; font-size: var(--text-xl); } .help { color: var(--color-text-3); &:hover { color: var(--color-primary); } }
      &.sm { margin-bottom: var(--space-1); h3 { margin: 0; display: inline-flex; align-items: center; gap: 6px; font-size: var(--text-lg); mat-icon { color: var(--color-primary); } } button { margin-left: auto; } } }
    .cr-hist { &.on { background: var(--color-primary); color: var(--color-on-primary); border-color: var(--color-primary); } }
    .ac .vc.co { background: var(--color-primary-soft); color: var(--color-primary); &.other { background: var(--color-surface-2); color: var(--color-text-3); } }
    .ac .ac-new { display: flex; align-items: center; gap: 10px; border-top: 1px dashed var(--color-line-strong); background: var(--color-surface-2); mat-icon { color: var(--color-primary); } span { display: flex; flex-direction: column; } }
    .cr-history { .lead { margin: 0 0 var(--space-3); color: var(--color-text-2); font-size: var(--text-sm); } }

    .cr-inbox { margin-bottom: var(--space-3); border: 2px solid var(--color-primary); border-radius: var(--radius-md); background: var(--color-surface); overflow: hidden;
      header { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3); background: var(--color-primary-soft, color-mix(in srgb, var(--color-primary) 8%, transparent)); > mat-icon { color: var(--color-primary); font-size: 28px; width: 28px; height: 28px; } h3 { margin: 0; font-size: var(--text-lg); } p { margin: 2px 0 0; color: var(--color-text-3); font-size: var(--text-sm); } }
      .cr-inbox-list { display: flex; flex-direction: column; }
      .cr-inbox-row { display: flex; align-items: center; gap: var(--space-3); width: 100%; text-align: left; padding: var(--space-3); background: none; border: 0; border-top: 1px solid var(--color-line); cursor: pointer; font: inherit; color: inherit; min-height: 64px;
        &:hover { background: var(--color-surface-2); } &.blocked { opacity: .75; }
        .who { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; b { display: flex; align-items: center; gap: var(--space-2); } small { color: var(--color-text-3); font-size: var(--text-sm); em { color: var(--color-warn); font-style: normal; font-weight: 600; } } .bad { color: var(--color-danger); display: flex; align-items: center; gap: 4px; mat-icon { font-size: 16px; width: 16px; height: 16px; } } .note { font-style: italic; } }
        .amt { font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; font-size: var(--text-lg); } .go { color: var(--color-text-3); } }
      @media (max-width: 640px) { .cr-inbox-row { flex-wrap: wrap; .amt { width: 100%; order: 3; } .go { display: none; } } } }
    .cr-seg button.attn:not(.on) { border-color: var(--color-warn); }
    .cr-seg button.attn b { background: var(--color-warn); color: var(--color-on-warn, #fff); }
    .cr-queries { display: flex; flex-direction: column; gap: var(--space-3); .lead { margin: 0; color: var(--color-text-3); font-size: var(--text-sm); } }
    .cq { border: 1px solid var(--color-warn); border-left-width: 4px; border-radius: var(--radius-md); background: var(--color-surface); padding: var(--space-3); display: flex; flex-direction: column; gap: var(--space-2);
      &.done { border-color: var(--color-line); border-left-color: var(--color-info); }
      header { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; .who { flex: 1; min-width: 180px; display: flex; flex-direction: column; small { color: var(--color-text-3); font-size: var(--text-sm); } } .amt { font-weight: 700; font-variant-numeric: tabular-nums; font-size: var(--text-lg); } }
      .qstate { font-size: var(--text-xs); font-weight: 600; padding: 2px 8px; border-radius: var(--radius-pill, 999px); &.Open { background: var(--color-warn-soft); color: var(--color-warn); } &.Answered, &.WithDirector { background: var(--color-info-soft, var(--color-surface-2)); color: var(--color-info); } } }
    .qa { display: flex; gap: var(--space-2); align-items: flex-start; padding: var(--space-2); border-radius: var(--radius-sm); font-size: var(--text-sm);
      mat-icon { font-size: 18px; width: 18px; height: 18px; flex: none; } p { margin: 2px 0 0; white-space: pre-wrap; } small { color: var(--color-text-3); font-size: var(--text-xs); }
      &.q { background: var(--color-warn-soft); mat-icon { color: var(--color-warn); } } &.a { background: var(--color-surface-2); mat-icon { color: var(--color-info); } } }
    .qreply { display: flex; gap: var(--space-2); align-items: flex-end; textarea { flex: 1; min-width: 0; font: inherit; font-size: var(--text-sm); padding: var(--space-2); border: 1px solid var(--color-line); border-radius: var(--radius-sm); background: var(--color-surface); color: inherit; resize: vertical; }
      @media (max-width: 640px) { flex-direction: column; align-items: stretch; } }
    .itrej { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; margin: 0 12px 10px 40px; padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm); background: var(--color-danger-soft); border: 1px solid var(--color-danger); color: var(--color-danger); font-size: var(--text-sm);
      > mat-icon { font-size: 18px; width: 18px; height: 18px; } .t { flex: 1; min-width: 180px; display: flex; flex-direction: column; span { color: var(--color-text); } } .re { font-size: var(--text-xs); font-weight: 600; } }
    .itq { display: flex; flex-direction: column; gap: 6px; padding: 0 12px 10px 40px; }
    .cr-alerts { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-3); margin-bottom: var(--space-2); background: var(--color-warn-soft); border: 1px solid var(--color-warn); border-radius: var(--radius-md); mat-icon { color: var(--color-warn); } .txt { flex: 1; font-size: var(--text-sm); } }
    .cr-alert-list { display: grid; gap: 4px; margin-bottom: var(--space-3); }
    .cr-alert { display: grid; grid-template-columns: 170px 1fr; gap: 2px 12px; text-align: left; font: inherit; padding: 8px 12px; background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-sm); cursor: pointer; font-size: var(--text-sm); .b { font-weight: 600; } .d { grid-column: 2; color: var(--color-text-2); font-size: var(--text-xs); } &.fail { border-color: var(--color-danger); } &:hover { border-color: var(--color-primary); } }

    .cr-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin-bottom: var(--space-3);
      select { height: 40px; padding: 0 var(--space-3); border: 1px solid var(--color-line-strong); border-radius: var(--radius-control); background: var(--color-surface); color: var(--color-text); font: inherit; } }

    /* ---- company marks (logo or initials) ---- */
    .comark { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-sm); overflow: hidden; vertical-align: middle;
      img { max-width: 86%; max-height: 80%; width: auto; height: auto; object-fit: contain; display: block; }
      .mono { width: 100%; height: 100%; display: grid; place-items: center; font-weight: 800; letter-spacing: .04em; color: hsl(var(--hue) 45% 32%); background: linear-gradient(135deg, hsl(var(--hue) 55% 94%), hsl(var(--hue) 45% 86%)); }
      &.xs { width: 34px; height: 22px; .mono { font-size: var(--text-xs); } } &.sm { width: 56px; height: 34px; .mono { font-size: var(--text-xs); } } &.md { width: 76px; height: 44px; .mono { font-size: var(--text-md); } } &.lg { width: 112px; height: 64px; border-radius: var(--radius-md); img { padding: 6px; } .mono { font-size: var(--text-2xl); } } }
    .cr-cogrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-3); margin-bottom: var(--space-3); align-items: start;
      @media (max-width: 1000px) { grid-template-columns: repeat(2, minmax(0, 1fr)); } @media (max-width: 640px) { grid-template-columns: 1fr; } }
    .cr-co { display: flex; flex-direction: column; align-items: stretch; gap: 4px; padding: 16px 16px 12px; font: inherit; text-align: left; color: var(--color-text); background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-lg); cursor: pointer; min-width: 0; transition: border-color .12s, box-shadow .12s, transform .12s;
      .mark { aspect-ratio: 5 / 2; width: 100%; display: grid; place-items: center; background: #fff; border-radius: var(--radius-md); overflow: hidden; margin-bottom: 10px; img { max-width: 82%; max-height: 78%; width: auto; height: auto; object-fit: contain; display: block; } }
      .mono { width: 100%; height: 100%; display: grid; place-items: center; font-weight: 800; font-size: var(--text-4xl); letter-spacing: .1em; color: hsl(var(--hue) 45% 32%); background: linear-gradient(135deg, hsl(var(--hue) 55% 94%), hsl(var(--hue) 45% 86%)); }
      .nm { font-weight: 700; font-size: var(--text-md); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .stat { font-size: var(--text-sm); color: var(--color-text-2); b { color: var(--color-primary); font-size: var(--text-lg); font-weight: 700; } em { color: var(--color-danger); font-style: normal; font-weight: 600; font-size: var(--text-xs); } }
      .amt { font-family: var(--font-mono); font-weight: 700; font-size: var(--text-lg); white-space: nowrap; }
      .foot { display: flex; align-items: center; justify-content: space-between; margin-top: 6px; padding-top: 8px; border-top: 1px solid var(--color-line); font-size: var(--text-xs); color: var(--color-text-3); mat-icon { font-size: 18px; width: 18px; height: 18px; } }
      &:hover { border-color: var(--color-primary); box-shadow: var(--shadow-md); transform: translateY(-2px); .foot { color: var(--color-primary); } }
      &.back { border-top: 3px solid var(--color-danger); } }
    .cr-logo-note { display: flex; align-items: center; gap: 6px; margin: 0 0 var(--space-3); font-size: var(--text-xs); color: var(--color-text-3); mat-icon { font-size: 16px; width: 16px; height: 16px; } code { font-family: var(--font-mono); background: var(--color-surface-3); padding: 0 4px; border-radius: 3px; } }
    .pick-lbl { font-size: var(--text-xs); color: var(--color-text-2); font-weight: 600; margin-bottom: 6px; }
    .cr-pick { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--space-2); margin-bottom: var(--space-3); }
    .ptile { position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 8px 8px; font: inherit; color: var(--color-text); background: var(--color-surface); border: 1px solid var(--color-line-strong); border-radius: var(--radius-md); cursor: pointer; transition: border-color .12s, box-shadow .12s;
      .mark { width: 100%; height: 52px; display: grid; place-items: center; background: #fff; border-radius: var(--radius-sm); overflow: hidden; img { max-width: 84%; max-height: 80%; width: auto; height: auto; object-fit: contain; display: block; } }
      .mono { width: 100%; height: 100%; display: grid; place-items: center; font-weight: 800; font-size: var(--text-lg); letter-spacing: .06em; color: hsl(var(--hue) 45% 32%); background: linear-gradient(135deg, hsl(var(--hue) 55% 94%), hsl(var(--hue) 45% 86%)); }
      b { font-size: var(--text-sm); } small { font-size: var(--text-xs); color: var(--color-text-3); text-align: center; line-height: 1.2; }
      .tick { position: absolute; top: 6px; right: 6px; color: var(--color-primary); font-size: 18px; width: 18px; height: 18px; background: var(--color-surface); border-radius: 50%; }
      &:hover { border-color: var(--color-primary); } &.on { border-color: var(--color-primary); box-shadow: 0 0 0 2px var(--color-primary-soft); background: var(--color-primary-soft); } }
    .cocell { display: flex; align-items: center; gap: 8px; }
    .cr-seg { display: flex; flex-wrap: wrap; gap: 8px; flex: 1 1 100%;
      button { display: inline-flex; align-items: center; gap: 8px; font: inherit; font-size: var(--text-md, 15px); font-weight: 600; min-height: 46px; padding: 0 16px; border: 1.5px solid var(--color-line-strong); border-radius: 999px; background: var(--color-surface); color: var(--color-text); cursor: pointer; box-shadow: 0 1px 2px rgba(15, 23, 42, .06); transition: background .12s, border-color .12s, box-shadow .12s, transform .12s;
        b { min-width: 26px; text-align: center; font-size: var(--text-sm); font-weight: 700; background: var(--color-surface-3); color: var(--color-text); padding: 2px 8px; border-radius: 999px; }
        &:hover { border-color: var(--color-primary); color: var(--color-primary); transform: translateY(-1px); box-shadow: 0 3px 8px rgba(15, 23, 42, .10); }
        &:focus-visible { outline: 3px solid var(--color-primary-soft); outline-offset: 2px; }
        &.on { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-on-primary, #fff); box-shadow: 0 4px 12px color-mix(in srgb, var(--color-primary) 35%, transparent); b { background: rgba(255, 255, 255, .25); color: var(--color-on-primary, #fff); } } }
      @media (max-width: 640px) { button { flex: 1 1 calc(50% - 8px); justify-content: space-between; min-height: 48px; } } }

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
    .cr-sched {
      .meta { display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: var(--text-sm); color: var(--color-text-2); margin-bottom: var(--space-2); .gap { display: inline-flex; align-items: center; gap: 4px; color: var(--color-warn); mat-icon { font-size: 16px; width: 16px; height: 16px; } } }
      .tbl { overflow: auto; border: 1px solid var(--color-line); border-radius: var(--radius-md); }
      table { width: 100%; border-collapse: collapse; font-size: var(--text-sm);
        th { text-align: left; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .04em; color: var(--color-text-3); padding: 8px 12px; background: var(--color-surface-2); border-bottom: 1px solid var(--color-line); }
        td { padding: 8px 12px; border-bottom: 1px solid var(--color-line); }
        tbody tr:last-child td { border-bottom: 0; } tr.rej td { text-decoration: line-through; color: var(--color-text-3); }
        tfoot td { font-weight: 700; border-top: 2px solid var(--color-line); border-bottom: 0; text-align: right; }
        .num { text-align: right; font-family: var(--font-mono); white-space: nowrap; } .ref { font-family: var(--font-mono); } } }
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

    .cr-bhead { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-3);
      .ttl { flex: 1; h2 { margin: 0; display: flex; align-items: center; gap: 10px; font-size: var(--text-xl); flex-wrap: wrap; .lock { color: var(--color-ok); } } p { margin: 4px 0 0; color: var(--color-text-2); font-size: var(--text-sm); } }
      .sum { text-align: right; .l { display: block; font-size: var(--text-xs); color: var(--color-text-3); } .v { display: block; font-size: var(--text-2xl); font-weight: 700; font-family: var(--font-mono); } } }
    .cr-steps { display: flex; list-style: none; margin: 0 0 var(--space-3); padding: 0; overflow: auto;
      li { flex: 1; min-width: 90px; display: flex; flex-direction: column; align-items: center; gap: 4px; position: relative; padding: 4px 0; font-size: var(--text-xs); color: var(--color-text-3);
        &::before { content: ''; position: absolute; top: 18px; left: 50%; right: -50%; height: 2px; background: var(--color-line); z-index: 0; } &:last-child::before { display: none; }
        .dot { z-index: 1; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: var(--color-surface-2); border: 2px solid var(--color-line); mat-icon { font-size: 16px; width: 16px; height: 16px; } }
        &.done { color: var(--color-ok); .dot { background: var(--color-ok); border-color: var(--color-ok); color: var(--color-on-primary); } &::before { background: var(--color-ok); } }
        &.now { color: var(--color-primary); font-weight: 700; .dot { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-on-primary); box-shadow: 0 0 0 4px var(--color-primary-soft); } }
        &.bad { color: var(--color-danger); font-weight: 700; .dot { background: var(--color-danger); border-color: var(--color-danger); color: var(--color-on-primary); } } } }

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
      label { margin-bottom: var(--space-2); } .sigpad { border: 1px dashed var(--color-line-strong); border-radius: var(--radius-sm); background: var(--color-surface); touch-action: none; max-width: 100%; } }

    .cr-send { .muted { color: var(--color-text-2); font-size: var(--text-sm); margin: 0 0 var(--space-3); }
      .send-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 8px; margin: 0 0 var(--space-3); }
      .send-row .cur { font-weight: 500; font-size: var(--text-xs); color: var(--color-warn); }
      .send-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid var(--color-line); border-radius: var(--radius-sm); cursor: pointer; background: var(--color-surface); margin: 0; min-width: 0; overflow: hidden;
        &.on { border-color: var(--color-primary); background: var(--color-primary-soft); }
        input { width: 16px; height: 16px; margin: 0; flex: 0 0 auto; }
        .av { width: 30px; height: 30px; border-radius: 50%; background: var(--color-primary); color: var(--color-on-primary); font-size: var(--text-xs); font-weight: 700; display: flex; align-items: center; justify-content: center; flex: 0 0 auto; }
        .who { flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; overflow: hidden; b { font-size: var(--text-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } small { color: var(--color-text-3); font-size: var(--text-xs); line-height: 1.3; overflow-wrap: anywhere; word-break: break-all; } small .em { display: block; } } }
      .hint.warn { color: var(--color-warn); mat-icon { color: inherit; } } }
    .sent-to { display: flex; align-items: center; gap: 6px; margin: 2px 0 0; font-size: var(--text-sm); color: var(--color-primary); mat-icon { font-size: 18px; width: 18px; height: 18px; } }
    .up-strip { position: fixed; right: 20px; bottom: 20px; z-index: 1200; width: min(380px, calc(100vw - 40px)); background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-md, 10px); box-shadow: 0 10px 30px rgba(0,0,0,.18); padding: 10px 14px 12px; display: grid; gap: 6px;
      .up-head { display: flex; align-items: center; gap: 8px; mat-icon { color: var(--color-primary); } .up-label { flex: 1; font-weight: 600; font-size: var(--text-sm); } .up-pct { font-variant-numeric: tabular-nums; color: var(--color-primary); } }
      small { color: var(--color-text-2); font-size: var(--text-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } }
    .sig-block { border: 1px solid var(--color-line); border-radius: var(--radius-sm); padding: 10px 12px; margin: 0 0 var(--space-3); background: var(--color-canvas);
      .sig-head { display: flex; align-items: center; gap: 6px; font-size: var(--text-sm); margin-bottom: 8px; mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--color-primary); } small { color: var(--color-text-3); } }
      .sig-modes { display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
      .sig-mode { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: 1px solid var(--color-line-strong); border-radius: 999px; background: var(--color-surface); font: inherit; font-size: var(--text-xs); cursor: pointer; color: var(--color-text-2);
        mat-icon { font-size: 16px; width: 16px; height: 16px; } &.on { border-color: var(--color-primary); background: var(--color-primary-soft); color: var(--color-primary); font-weight: 600; } &:disabled { opacity: .55; cursor: not-allowed; } }
      .sig-saved { display: flex; align-items: center; gap: 14px; img { height: 64px; max-width: 260px; object-fit: contain; background: var(--color-surface); border: 1px solid var(--color-line); border-radius: 6px; padding: 4px 10px; } small { color: var(--color-text-2); line-height: 1.4; } }
      .sig-draw-foot { display: flex; align-items: center; justify-content: space-between; small { color: var(--color-text-3); } } }

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
      .inv-src.recon { padding: 8px 10px; border-radius: var(--radius-md); border: 1px dashed var(--color-line); small { display: inline-flex; align-items: center; gap: 4px; flex-basis: auto; color: var(--color-text-3); mat-icon { font-size: 16px; width: 16px; height: 16px; } } &.missing { border-color: var(--color-warn); background: var(--color-warn-soft, color-mix(in srgb, var(--color-warn) 8%, transparent)); small { color: var(--color-warn); } } }
      .actions .warn-txt { display: inline-flex; align-items: center; gap: 4px; color: var(--color-warn); font-size: var(--text-xs); margin-right: auto; mat-icon { font-size: 16px; width: 16px; height: 16px; } }
      .row.mode { align-items: flex-end; select { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid var(--color-line); border-radius: var(--radius-sm); font: inherit; background: var(--color-surface); } .urgent { padding-bottom: 4px; mat-icon { font-size: 16px; width: 16px; height: 16px; vertical-align: -3px; color: var(--color-danger); } } }
      .chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; font-size: var(--text-sm); background: var(--color-surface-3); mat-icon { font-size: 18px; width: 18px; height: 18px; } &.ok { background: var(--color-ok-soft); color: var(--color-ok); } }
      .picker { background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-md); padding: 10px; margin-bottom: 10px;
        input { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid var(--color-line); border-radius: var(--radius-sm); font: inherit; margin-bottom: 6px; }
        ul { list-style: none; margin: 0; padding: 0; max-height: 260px; overflow: auto; }
        li { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px; border-radius: var(--radius-sm); cursor: pointer; font-size: var(--text-sm); &:hover { background: var(--color-surface-2); } .amt { margin-left: auto; font-weight: 600; } small { color: var(--color-warn); font-size: var(--text-xs); } &.dis { opacity: .55; cursor: not-allowed; } &.none { color: var(--color-text-3); cursor: default; } }
      }
      label.sup { position: relative; }
      .ac { position: absolute; z-index: 30; left: 0; right: 0; top: 100%; list-style: none; margin: 2px 0 0; padding: 4px; background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-md); box-shadow: var(--shadow-md, 0 8px 24px rgba(0,0,0,.15)); max-height: 260px; overflow: auto;
        li { padding: 6px 8px; border-radius: var(--radius-sm); cursor: pointer; &:hover { background: var(--color-surface-2); } strong { display: block; font-size: var(--text-sm); } small { display: block; color: var(--color-text-3); font-size: var(--text-xs); .vc { font-family: var(--font-mono); } .agb { color: var(--color-danger); font-weight: 600; &.neg { color: var(--color-ok); } } em { font-style: normal; color: var(--color-warn); } } }
      }
    }
    .cr-item { border: 1px solid var(--color-line); border-radius: var(--radius-md); margin-bottom: 8px; overflow: hidden;
      .head { display: flex; align-items: center; gap: 8px; padding: 10px 10px; cursor: pointer; flex-wrap: wrap; &:hover { background: var(--color-surface-2); }
        .tw { color: var(--color-text-3); } .who { flex: 1; min-width: 160px; strong { display: block; font-size: var(--text-md); } small { display: block; color: var(--color-text-3); font-size: var(--text-xs); } }
        .docpill { display: inline-flex; align-items: center; gap: 4px; font-size: var(--text-xs); font-weight: 600; padding: 3px 10px 3px 6px; border-radius: 999px; background: var(--color-danger-soft); color: var(--color-danger); mat-icon { font-size: 16px; width: 16px; height: 16px; } &.ok { background: var(--color-ok-soft); color: var(--color-ok); } &.none { background: var(--color-surface-3); color: var(--color-text-3); } }
        .flag { display: inline-flex; align-items: center; gap: 2px; font-size: var(--text-xs); font-weight: 700; color: var(--color-warn); mat-icon { font-size: 16px; width: 16px; height: 16px; } &.fail { color: var(--color-danger); } }
        .amt { font-family: var(--font-mono); font-weight: 700; white-space: nowrap; min-width: 120px; text-align: right; font-size: var(--text-md); }
        .dec { font-size: var(--text-xs); font-weight: 700; padding: 2px 8px; border-radius: 999px; &.approved { background: var(--color-ok-soft); color: var(--color-ok); } &.queried { background: var(--color-warn-soft); color: var(--color-warn); } &.rejected, &.sentback { background: var(--color-danger-soft); color: var(--color-danger); } }
        .pre { font-size: var(--text-xs); color: var(--color-warn); font-weight: 600; &.pac { color: var(--color-info); } }
        .cmp { font-size: var(--text-xs); font-weight: 600; padding: 2px var(--space-2); border-radius: 999px; background: var(--color-cat-purple-soft); color: var(--color-cat-purple); white-space: nowrap; }
        .urg { display: inline-flex; align-items: center; gap: 2px; font-size: var(--text-xs); font-weight: 700; padding: 2px 8px 2px 4px; border-radius: 999px; background: var(--color-danger-soft); color: var(--color-danger); mat-icon { font-size: 14px; width: 14px; height: 14px; } } }
      .decide { display: flex; align-items: center; gap: 8px; padding: 6px 12px 10px 40px; font-size: var(--text-sm); color: var(--color-text-2); flex-wrap: wrap; border-top: 1px dashed var(--color-line);
        button mat-icon { font-size: 16px; width: 16px; height: 16px; } .sel-ok { background: var(--color-ok-soft); border-color: var(--color-ok); color: var(--color-ok); } .sel-warn { background: var(--color-warn-soft); border-color: var(--color-warn); color: var(--color-warn); } .sel-bad { background: var(--color-danger-soft); border-color: var(--color-danger); color: var(--color-danger); } em { color: var(--color-text-3); } }
      .deccomment { display: flex; align-items: center; gap: 6px; padding: 4px 12px 8px 40px; font-size: var(--text-xs); color: var(--color-text-2); mat-icon { font-size: 14px; width: 14px; height: 14px; } }
      .body { padding: 4px 12px 12px 40px; border-top: 1px solid var(--color-line); background: var(--color-surface); }
      &.dec-Approved { border-left: 4px solid var(--color-ok); } &.dec-Queried { border-left: 4px solid var(--color-warn); } &.dec-Rejected { border-left: 4px solid var(--color-danger); opacity: .8; } &.dec-SentBack { border-left: 4px solid var(--color-danger); opacity: .85; } }

    .chk-verdict { display: flex; gap: 10px; align-items: center; padding: 10px 12px; border-radius: var(--radius-md); margin-bottom: var(--space-2); strong { display: block; font-size: var(--text-sm); } small { color: var(--color-text-3); font-size: var(--text-xs); }
      &.fail { background: var(--color-danger-soft); mat-icon { color: var(--color-danger); } } &.review { background: var(--color-warn-soft); mat-icon { color: var(--color-warn); } } &.pass { background: var(--color-ok-soft); mat-icon { color: var(--color-ok); } } }
    .cr-findings { list-style: none; margin: 0; padding: 0; li { display: flex; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--color-line); font-size: var(--text-xs); cursor: default; &:last-child { border-bottom: 0; }
      mat-icon { font-size: 18px; width: 18px; height: 18px; flex: 0 0 auto; } div { min-width: 0; } strong { display: block; font-size: var(--text-sm); } em { display: block; color: var(--color-text-2); font-style: normal; font-weight: 600; } span { display: block; color: var(--color-text-2); }
      &.fail mat-icon { color: var(--color-danger); } &.review mat-icon { color: var(--color-warn); } &.pass { opacity: .6; mat-icon { color: var(--color-ok); } } } }

    .appr-row { display: flex; gap: 10px; align-items: flex-start; padding: 8px 0; mat-icon { color: var(--color-text-3); } &.done mat-icon { color: var(--color-ok); } strong { display: block; font-size: var(--text-sm); } small { display: block; color: var(--color-text-3); font-size: var(--text-xs); } .q { color: var(--color-text-2); font-style: italic; } }
    .hash { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--color-text-3); }
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
  inbox = signal<InboxRow[]>([]);
  /** Payments the director queried (open, answered, or back with the director). */
  queries = signal<QueryRow[]>([]);
  queriesOpen = computed(() => this.queries().filter(q => q.state === 'Open').length);
  answerDraft = signal<Record<number, string>>({});
  canAnswer = computed(() => { const me = this.meta()?.me; return !!me && !me.readOnly && (me.clerk || me.accountant || me.isAdmin); });
  inboxDirector = computed(() => this.inbox().filter(r => r.role === 'director'));
  inboxAccountant = computed(() => this.inbox().filter(r => r.role === 'accountant'));
  inboxTotal = computed(() => this.inbox().reduce((s, r) => s + (r.totalAmount || 0), 0));
  showPassed = signal(false);
  explain(): void {
    ExplainerDialogComponent.open(this.dialog, {
      title: 'How a payment pack moves', intro: 'One pack = one paying company + one kind of payment. Every pack goes through the same six steps.',
      steps: [
        { icon: 'edit_note', title: 'Prepare', body: 'A clerk creates the batch and adds each payment — upload the invoice (or link one from Books) and the details fill in. Every invoice needs its supplier recon; the checklist shows what else is expected.' },
        { icon: 'rule', title: 'Checks', body: 'On submit the system reads the documents and flags problems: missing papers, old bank letters, amounts that don\'t match the recon, possible duplicates.' },
        { icon: 'fact_check', title: 'Accountant', body: 'The company\'s accountant reviews and approves, or sends the pack back with a reason.' },
        { icon: 'draw', title: 'Director', body: 'The director approves, queries or rejects each payment, then signs. The pack locks — nothing can change after this.' },
        { icon: 'account_balance', title: 'Bank', body: 'The bank user downloads the bank file, loads it, and marks the pack as paid.' },
        { icon: 'inventory', title: 'Close', body: 'Proof of payment is attached for every payment and the pack is closed.' },
      ]
    });
  }
  openPrepay = signal(0);
  loading = signal(false);
  busy = signal(false);
  view = signal<View>('board');
  batch = signal<BatchDetail | null>(null);
  /** Generated payment schedule for the open batch; refreshed whenever the batch changes. */
  schedule = signal<GeneratedSchedule | null>(null);
  private scheduleFx = effect(() => {
    const b = this.batch(); if (!b) { this.schedule.set(null); return; }
    const key = b.id + ':' + b.items.map(i => `${i.id}/${i.amount}/${i.invoiceNumbers}/${i.decisionStatus}/${i.documents.length}`).join(',') + ':' + b.batchDate;
    if (key === this.scheduleKey) return; this.scheduleKey = key;
    this.api.generatedSchedule(b.id).subscribe({ next: s => this.schedule.set(s), error: () => this.schedule.set({ head: { batchNumber: b.batchNumber, company: b.companyName ?? b.companyCode, companyCode: b.companyCode, paymentType: b.paymentTypeTitle ?? '', paymentRunDate: b.batchDate, preparedBy: b.preparedByName ?? '', generatedAt: '', total: 0, totalPayable: 0, count: 0, missingInvoiceDates: 0, missingDocNumbers: 0 }, lines: [] }) });
  }, { allowSignalWrites: true });
  private scheduleKey = '';
  downloadSchedule(): void {
    const b = this.batch()!;
    this.api.generatedScheduleXlsx(b.id).subscribe({ next: blob => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `Payment-schedule-${b.batchNumber}.xlsx`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }, error: () => this.toast.error("Couldn't build the schedule.") });
  }
  previewSchedule(): void {
    const s = this.schedule(); const b = this.batch(); if (!s || !b) return;
    SchedulePreviewDialogComponent.open(this.dialog, { schedule: s, logo: companyWideLogo(b.companyCode), onDownload: () => this.downloadSchedule() });
  }
  companyFilter = signal('');
  statusFilter = signal('');
  typeFilter = signal('');
  newOpen = signal(false);
  /** Paid-history panel on the board (replaces the company grid while open). */
  historyOpen = signal(false);
  historySupplier = signal('');
  historyQuery = signal('');
  toggleHistory(): void { if (this.historyOpen()) { this.historyOpen.set(false); this.historySupplier.set(''); this.historyQuery.set(''); } else this.historyOpen.set(true); }
  /** From the aging: show every paid pack for one supplier. */
  showPaidHistory(supplierName: string): void { this.view.set('board'); this.batch.set(null); this.historySupplier.set(supplierName); this.historyQuery.set(''); this.historyOpen.set(true); }
  signOpen = signal(false);
  /** "Send to" picker: 'submit' (preparer → accountants) or 'approve' (accountant → directors). */
  sendOpen = signal<'submit' | 'approve' | 'reassign' | null>(null);
  sendOptions = signal<BatchApprovers | null>(null);
  sendPick = new Set<number>();
  sendNote = '';
  /** Digital signature source for the current step. Defaults to the saved one when the profile has it. */
  sigMode = signal<'saved' | 'draw'>('draw');
  drewSig = signal(false);
  get mySignatureUrl(): string { return `${environment.apiUrl}/users/me/signature`; }
  canSign(): boolean { return this.sigMode() === 'saved' ? !!this.meta()?.me.hasSignature : this.drewSig(); }
  private resetSig(): void { this.sigMode.set(this.meta()?.me.hasSignature ? 'saved' : 'draw'); this.drewSig.set(false); this.drew = false; }
  private sigPayload(): { signatureImageBase64?: string; useSavedSignature: boolean } {
    if (this.sigMode() === 'draw' && this.drew && this.sigpad) return { signatureImageBase64: this.sigpad.nativeElement.toDataURL('image/png'), useSavedSignature: false };
    return { useSavedSignature: true };
  }
  /** Just the approval sheet (no documents) in a new tab to print or save; downloads it if pop-ups are blocked. */
  printApprovalSheet(): void {
    const b = this.batch()!; this.busy.set(true);
    const w = window.open('', '_blank'); // open now, while the click still counts, so pop-up blockers allow it
    this.api.approvalSheet(b.id).subscribe({
      next: blob => { this.busy.set(false); const url = URL.createObjectURL(blob); if (w) { w.location.href = url; setTimeout(() => URL.revokeObjectURL(url), 60_000); } else this.saveBlob(blob, `Approval-sheet-${b.batchNumber}.pdf`); },
      error: e => { w?.close(); this.fail(e, "Couldn't build the approval sheet."); }
    });
  }
  printSchedule(): void {
    const b = this.batch()!; this.busy.set(true);
    this.api.schedulePdf(b.id).subscribe({
      next: blob => { this.busy.set(false); const url = URL.createObjectURL(blob); const w = window.open(url, '_blank'); if (!w) this.saveBlob(blob, `Payment-schedule-${b.batchNumber}.pdf`); else setTimeout(() => URL.revokeObjectURL(url), 60_000); },
      error: e => this.fail(e, "Couldn't build the payment schedule.")
    });
  }
  downloadSignedPack(): void { const b = this.batch()!; this.busy.set(true); this.api.signedPack(b.id).subscribe({ next: blob => { this.busy.set(false); this.saveBlob(blob, `Signed-pack-${b.batchNumber}.pdf`); }, error: e => this.fail(e, "Couldn't build the signed pack.") }); }
  private saveBlob(blob: Blob, name: string): void { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
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
  // staff payments: requisition (upload or fill in) + bank statement + EFT / eWallet
  reqMode = signal<'upload' | 'fill'>('upload');
  /** Upload mode: the bank statement is scanned into the same PDF as the requisition (default). Unticked = separate statement upload. */
  stmtIncluded = signal(true);
  /** Bank details on the form came from a statement (separate, or inside the requisition PDF). */
  hasReadBank = signal(false);
  reqForm: { employeeNumber: string; department: string; authorisedBy: string; requestedBy: string; date: string; notes: string } = this.blankReqForm();
  pendingStatementFile: File | null = null;
  statementInfo = signal('');
  /** Bank details set aside while the clerk flips to eWallet, restored if they flip back. */
  private eftStash: { bankName?: string; accountNumber?: string; branchCode?: string; accountHolder?: string } | null = null;
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
  /** Company branding: full logo where we have artwork, otherwise initials. Admins see which ones still need a file. */
  logo = companyWideLogo; monogram = companyMonogram; hue = companyHue;
  missingLogos = computed(() => this.activeCompanies().filter(c => !companyWideLogo(c.code)).map(c => c.code));
  /** Board grouped by paying company: one section per company, its batches listed underneath (newest first). */
  groups = computed(() => {
    const by = new Map<string, BatchRow[]>();
    for (const r of this.filteredRows()) { (by.get(r.companyCode) ?? by.set(r.companyCode, []).get(r.companyCode)!).push(r); }
    const order = this.activeCompanies().map(c => c.code);
    return [...by.entries()]
      .sort((a, b) => (order.indexOf(a[0]) + 1 || 99) - (order.indexOf(b[0]) + 1 || 99))
      .map(([code, rows]) => ({
        code, name: this.companyFor(code)?.name ?? code, rows: [...rows].sort((a, b) => b.batchNumber.localeCompare(a.batchNumber)),
        open: rows.filter(r => r.status !== 'Closed').length, back: rows.filter(r => this.isSentBack(r.status)).length,
        openAmount: rows.filter(r => r.status !== 'Closed').reduce((s, r) => s + (r.totalAmount || 0), 0)
      }));
  });
  openCompany(g: { code: string; name: string; rows: BatchRow[] }): void {
    CompanyBatchesDialogComponent.open(this.dialog, {
      code: g.code, name: g.name, logo: companyWideLogo(g.code), monogram: companyMonogram(g.code, g.name), hue: companyHue(g.code), rows: g.rows,
      typeTitle: k => this.typeTitle(k), badge: s => this.badge(s), waitingOn: r => this.waitingOn(r), isSentBack: s => this.isSentBack(s)
    }).afterClosed().subscribe(id => { if (id) this.open(id); });
  }
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
    this.api.inbox().subscribe({ next: i => this.inbox.set(i), error: () => {} });
    this.api.queries().subscribe({ next: q => this.queries.set(q), error: () => {} });
  }
  setAnswer(itemId: number, v: string): void { this.answerDraft.update(m => ({ ...m, [itemId]: v })); }
  private sentAnswer(itemId: number, r: BatchDetail): string {
    this.answerDraft.update(m => { const n = { ...m }; delete n[itemId]; return n; });
    return r.status === 'AwaitingDirector' ? `Answer sent — every query on ${r.batchNumber} is answered, so it's back with the director` : 'Answer sent — other queries on this pack still need answers';
  }
  /** Answer from the Queried payments tab. */
  answer(q: QueryRow): void {
    const text = (this.answerDraft()[q.itemId] || '').trim(); if (!text) return;
    this.busy.set(true);
    this.api.answerQuery(q.batchId, q.itemId, text).subscribe({
      next: r => { this.busy.set(false); this.toast.done(this.sentAnswer(q.itemId, r)); this.loadBoard(); },
      error: e => this.fail(e, "Couldn't send the answer.")
    });
  }
  accLiveCount(b: BatchDetail): number { return b.items.filter(i => i.decisionStatus !== 'SentBack').length; }
  accSendBackCount(b: BatchDetail): number { return b.items.filter(i => i.decisionStatus !== 'SentBack' && i.accountantDecision === 'SentBack').length; }
  /** Accountant's call on one payment. Send back needs a reason; clicking the chosen button again clears it. */
  accDecide(it: BatchItem, d: 'Approved' | 'SentBack' | 'Pending'): void {
    const b = this.batch()!; let c: string | null = null;
    if (d === 'SentBack') { c = prompt(`Why is ${it.supplierName} being sent back? The preparer sees this.`); if (!c?.trim()) return; }
    this.busy.set(true);
    this.api.accountantDecide(b.id, it.id, d, c || undefined).subscribe({ next: r => this.apply(r), error: e => this.fail(e, "Couldn't save your decision.") });
  }
  /** Copy a rejected payment (with its documents) onto a new draft pack and open it to fix. */
  resubmit(b: BatchDetail, it: BatchItem): void {
    if (!confirm(`Put ${it.supplierName} (R ${it.amount.toFixed(2)}) on a new draft pack so you can fix it and send it through again?`)) return;
    this.busy.set(true);
    this.api.resubmitRejected(b.id, it.id).subscribe({
      next: r => { this.apply(r, `${it.supplierName} copied to ${r.batchNumber} — fix it, then submit`); this.router.navigate([], { relativeTo: this.route, queryParams: { batch: r.id }, queryParamsHandling: 'merge', replaceUrl: true }); },
      error: e => this.fail(e, "Couldn't resubmit the payment.")
    });
  }
  /** Answer from inside the pack. */
  answerItem(b: BatchDetail, it: BatchItem): void {
    const text = (this.answerDraft()[it.id] || '').trim(); if (!text) return;
    this.busy.set(true);
    this.api.answerQuery(b.id, it.id, text).subscribe({ next: r => this.apply(r, this.sentAnswer(it.id, r)), error: e => this.fail(e, "Couldn't send the answer.") });
  }

  /** Whole pack (approval sheet + every PDF) in the preview dialog — what the accountant / director reads before deciding. */
  previewPack(): void {
    const b = this.batch()!;
    PackPreviewDialogComponent.open(this.dialog, { url: this.api.reviewPackUrl(b.id), title: `${b.batchNumber} — full pack`, subtitle: `${b.companyName} · ${b.paymentTypeTitle} · ${b.items.length} payment${b.items.length === 1 ? '' : 's'} · R ${b.totalAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`, fileName: `Pack-${b.batchNumber}.pdf` });
  }
  ago(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime(); const h = Math.floor(ms / 3.6e6);
    if (h < 1) return 'under an hour'; if (h < 24) return `${h} hour${h === 1 ? '' : 's'}`; const d = Math.floor(h / 24); return `${d} day${d === 1 ? '' : 's'}`;
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
    const list = (kind === 'acc' ? c.approvers?.accountants : c.approvers?.directors) ?? [];
    return list.length === 0 || list.some(p => p.userId === me.userId);
  }
  count(s: string): number { return this.rows().filter(r => r.status === s).length; }
  countOpen(): number { return this.rows().filter(r => !['Closed', 'Rejected'].includes(r.status)).length; }
  isSentBack(s: string) { return this.sentBack.includes(s); }
  companyFor(code: string) { return this.meta()?.companies.find(c => c.code === code); }
  names(list?: { name: string }[] | null): string { return (list ?? []).map(p => p.name).join(' / '); }
  typeTitle(k: string) { return this.meta()?.paymentTypes.find(p => p.key === k)?.title ?? k; }
  statusTitle(k: string) { return this.meta()?.statuses.find(s => s.key === k)?.title ?? k; }
  docTitle(k: string) { return this.meta()?.docTypes.find(d => d.key === k)?.title ?? k; }
  docTypesFor(itemId: number | null) { return (this.meta()?.docTypes ?? []).filter(d => itemId ? d.scope === 'item' || d.key === 'Other' : d.scope === 'batch' || d.key === 'Other'); }
  badge(s: string) { return ['Approved', 'Paid', 'Closed', 'LoadedOnBank'].includes(s) ? 'ok' : s.startsWith('Awaiting') ? 'warn' : this.sentBack.includes(s) || s === 'Rejected' ? 'bad' : s === 'Draft' ? '' : 'info'; }
  rulesSummary(pt: string): string { const rules = this.meta()?.rules[pt] ?? []; const names = rules.filter(r => r.required && !r.afterDelivery && !r.ifReturned).map(r => this.docTitle(r.docType)); const opt = rules.filter(r => !r.required && !r.afterDelivery && !r.ifReturned && !r.withRecon).map(r => this.docTitle(r.docType)); const withRecon = rules.filter(r => r.withRecon).map(r => this.docTitle(r.docType)); return (names.length ? names.join(', ') : 'none beyond the batch schedule') + (withRecon.length ? ` · with every recon: ${withRecon.join(', ')}` : '') + (opt.length ? ` · optional: ${opt.join(', ')}` : ''); }
  isPrepayment(): boolean { return this.batch()?.paymentType === 'Prepayment'; }
  /** Paid off a requisition (no invoice): staff payments and requisition-form payments share the same form and rules. */
  isStaff(): boolean { const t = this.batch()?.paymentType; return t === 'StaffPayment' || t === 'RequisitionForm'; }
  /** Requisition-form pack (payee need not be an employee) — only the wording differs from a staff payment. */
  isCompliance(): boolean { return this.batch()?.paymentType === 'Compliance'; }
  readonly complianceKinds = COMPLIANCE_KINDS;
  kindsLabel(keys?: string[] | null): string { return complianceKindsLabel(keys); }
  /** Compliance payments need a sub-kind, and a description when it's Other. Always true for other payment types. */
  complianceOk(): boolean { const d = this.itemDraft; return !this.isCompliance() || (!!d.complianceKind && (d.complianceKind !== 'Other' || !!d.complianceDetail?.trim())); }
  isReqPay(): boolean { return this.batch()?.paymentType === 'RequisitionForm'; }
  /** Doc type the "first upload" in the add-payment form is stored as: the request form for prepayments, the requisition for staff payments, the tax invoice otherwise. */
  primaryDocType(): string { return this.isPrepayment() || this.isStaff() ? 'Requisition' : this.isCompliance() ? 'ComplianceDocument' : 'TaxInvoice'; }
  /** Human name of the step-1 document ("request form" / "requisition form" / "invoice"). */
  primaryName(): string { return this.isPrepayment() ? 'request form' : this.isStaff() ? 'requisition form' : this.isCompliance() ? 'supporting document' : 'invoice'; }
  /** Step numbers on the staff / requisition form: the bank statement step only shows when it is a separate file. */
  staffStep(k: 'pay' | 'when'): number { const stmt = this.reqMode() === 'fill' || !this.stmtIncluded() ? 1 : 0; return (k === 'pay' ? 3 : 4) + stmt; }
  isEWallet(): boolean { return this.itemDraft.payoutMethod === 'EWallet'; }
  private blankReqForm() { return { employeeNumber: '', department: '', authorisedBy: '', requestedBy: '', date: new Date().toISOString().slice(0, 10), notes: '' }; }
  setPayout(m: 'EFT' | 'EWallet'): void {
    const d = this.itemDraft; if ((d.payoutMethod ?? 'EFT') === m) return;
    if (m === 'EWallet') { this.eftStash = { bankName: d.bankName, accountNumber: d.accountNumber, branchCode: d.branchCode, accountHolder: d.accountHolder }; d.bankName = ''; d.accountNumber = ''; d.branchCode = ''; }
    else { const s = this.eftStash; d.bankName = s?.bankName ?? ''; d.accountNumber = s?.accountNumber ?? ''; d.branchCode = s?.branchCode ?? ''; d.accountHolder = s?.accountHolder ?? d.accountHolder; this.eftStash = null; }
    d.payoutMethod = m;
  }
  /** Staff form: a file picked for the requisition ('req') or the separate bank statement ('stmt'). */
  staffFileChosen(e: Event, kind: 'req' | 'stmt'): void { const inp = e.target as HTMLInputElement; const f = inp.files?.[0]; inp.value = ''; if (f) this.staffFile(f, kind); }
  private staffFile(f: File, kind: 'req' | 'stmt'): void {
    if (!/\.pdf$/i.test(f.name)) { this.toast.warn(kind === 'req' ? 'The requisition must be a PDF.' : 'The bank statement must be a PDF.'); return; }
    if (kind === 'stmt') { this.pendingStatementFile = f; this.statementInfo.set('Reading…'); }
    else { this.pendingInvoiceFile = f; this.reading.set(true); this.readInfo.set(''); }
    this.api.readInvoice(f, this.track(kind === 'req' ? 'Reading the requisition' : 'Reading the bank statement', f)).subscribe({
      next: r => {
        this.untrack(); if (kind === 'req') this.reading.set(false);
        const info = (s: string) => kind === 'req' ? this.readInfo.set(s) : this.statementInfo.set(s);
        if (!r.readable) { info("Couldn't read the text (poor scan?) — it will still be attached; fill the details in below"); return; }
        const d = this.itemDraft; const filled: string[] = [];
        if (kind === 'req') {
          // A requisition names the employee; the issuer line at the top is the company, so only take a labelled name.
          if (r.employeeName && !d.supplierName) { d.supplierName = r.employeeName; filled.push('employee name'); }
          if (r.employeeNumber && !this.reqForm.employeeNumber) this.reqForm.employeeNumber = r.employeeNumber;
          if (r.department && !this.reqForm.department) this.reqForm.department = r.department;
          if (r.amount && !d.amount) { d.amount = r.amount; filled.push('amount'); }
          if (r.reason && !d.description) { d.description = r.reason; filled.push('reason'); }
          else if (r.description && !d.description) { d.description = r.description; filled.push('reason'); }
        }
        // Bank details: from a separate statement, or from the requisition PDF when the statement is scanned in with it.
        if (kind === 'stmt' || this.stmtIncluded()) {
          if (d.payoutMethod !== 'EWallet') {
            let any = false;
            if (r.bankName) { d.bankName = r.bankName; any = true; }
            if (r.accountNumber) { d.accountNumber = r.accountNumber; any = true; }
            if (r.branchCode) { d.branchCode = r.branchCode; any = true; }
            if (r.accountHolder) { d.accountHolder = r.accountHolder; any = true; }
            if (any) { filled.push('bank details'); this.hasReadBank.set(true); }
          } else if (r.bankName || r.accountNumber) {
            this.eftStash = { bankName: r.bankName ?? '', accountNumber: r.accountNumber ?? '', branchCode: r.branchCode ?? '', accountHolder: r.accountHolder ?? d.supplierName };
          }
          if (!d.supplierName && r.accountHolder) { d.supplierName = r.accountHolder; filled.push('name'); }
        }
        info(filled.length ? 'Filled in: ' + filled.join(', ') + ' — check below' : 'Read — nothing recognised, fill the details in below');
      },
      error: () => { this.untrack(); if (kind === 'req') { this.reading.set(false); this.readInfo.set("Couldn't read it — it will still be attached"); } else this.statementInfo.set("Couldn't read it — it will still be attached"); }
    });
  }
  reconSlot(): boolean { const pt = this.batch()?.paymentType ?? ''; return (this.meta()?.rules[pt] ?? []).some(r => r.docType === 'SupplierRecon' && !r.afterDelivery); }
  needsRecon(): boolean { return this.reconSlot() && !!(this.pendingInvoiceFile || this.pendingLink); }
  sageSlot(): boolean { const pt = this.batch()?.paymentType ?? ''; return (this.meta()?.rules[pt] ?? []).some(r => r.docType === 'SageAgedPayables' && r.withRecon); }
  needsSage(): boolean { return this.sageSlot() && !!this.pendingReconFile && !this.pendingSageFile; }
  sageChosen(e: Event): void { const inp = e.target as HTMLInputElement; const f = inp.files?.[0]; inp.value = ''; if (!f) return; if (!/\.pdf$/i.test(f.name)) { this.toast.warn('Sage aged payables must be a PDF.'); return; } this.pendingSageFile = f; }
  isSheetSlot(t: string) { return ['SupplierRecon', 'CreditorsRecon', 'PaymentSchedule'].includes(t); }
  responsibleName(id?: number) { if (!id) return ''; for (const x of this.meta()?.companies ?? []) { const a = x.approvers; const hit = [...(a?.accountants ?? []), ...(a?.directors ?? []), ...(a?.treasurers ?? []), ...(a?.clerks ?? [])].find(p => p.userId === id); if (hit) return hit.name; } return ''; }

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
      case 'QueriedByDirector': return { icon: 'reply', tone: 'bad', title: `Sent back by ${b.directorName || 'the director'}`, body: (b.returnReason ? b.returnReason + ' — ' : '') + 'Answer each query below (or on the Queried payments tab). Once all are answered the pack goes straight back to the director.' };
      case 'AwaitingAccountant': return b.can.accountant
        ? { icon: 'fact_check', tone: 'warn', title: 'Your approval is needed', body: `Check the schedule against the recon and the supporting documents. You can approve or send back each payment below: when you sign, approved payments go to ${dir} and sent-back ones return to the preparer with your reason. Or send the whole pack back with a note.` }
        : { icon: 'hourglass_top', tone: 'warn', title: `Waiting for ${acc} to approve`, body: b.can.reassign
            ? 'If they are not available, use Change accountant to send it to someone who is, or Recall to draft to make changes first.'
            : 'Nothing for you to do here right now.' };
      case 'AwaitingDirector':
        if (b.can.directorConflict) return { icon: 'block', tone: 'warn', title: 'Another director must sign this one', body: b.can.directorConflict };
        return b.can.direct
        ? { icon: 'draw', tone: 'warn', title: this.pendingCount(b) > 0 ? `Decide on ${this.pendingCount(b)} payment${this.pendingCount(b) === 1 ? '' : 's'}, then sign` : 'All decided — sign the batch', body: `${b.accountantName} has approved. Open “Review the pack” to read every document, then approve, query or reject each payment below. When you sign, approved payments go to pay; queried ones move to their own pack and wait on the Queried payments tab for an answer, then come back to you.` }
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
    const m: Record<string, string> = { Created: 'created the batch', ItemAdded: 'added a payment', ItemUpdated: 'edited a payment', ItemRemoved: 'removed a payment', DocumentUploaded: 'attached a document', DocumentReplaced: 'replaced a document', DocumentRemoved: 'removed a document', DocumentNA: 'marked a document N/A', Submitted: e.toStatus === 'ChecksFailed' ? 'submitted — checks failed' : 'submitted to the accountant', ChecksRun: 'ran the checks', AccountantApproved: 'approved as accountant', AccountantQueried: 'sent it back', ItemDecision: 'decided on a payment', DirectorSigned: 'signed the batch', DirectorQueried: 'sent it back with queries', DirectorRejected: 'rejected the batch', BankFileExported: 'downloaded the bank file', StatusChanged: `moved it to ${this.statusTitle(e.toStatus || '')}`, Reopened: 'reopened it as a draft', AccountantChanged: 'changed the accountant', Recalled: 'recalled it to draft', PrepaymentClosed: 'closed a prepayment' };
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
  /**
   * From the creditors aging: pay a vendor. Opens the company's newest editable draft (or creates one) and
   * starts the payment form with the supplier filled in.
   */
  payFromAging(companyCode: string, vendorName: string): void {
    const open = (b: BatchDetail) => { this.batch.set(b); this.view.set('batch'); setTimeout(() => { this.startItem(); this.itemDraft.supplierName = vendorName; this.searchSuppliers(vendorName); }, 50); };
    const draft = this.rows().find(r => r.companyCode === companyCode && r.status === 'Draft');
    if (draft) { this.api.get(draft.id).subscribe({ next: open, error: e => this.fail(e, "Couldn't open the draft.") }); return; }
    this.busy.set(true);
    this.api.create({ companyCode, paymentType: 'DailyCreditor', batchDate: new Date().toISOString().slice(0, 10) }).subscribe({
      next: b => { this.busy.set(false); this.toast.done(`${b.batchNumber} created for ${vendorName}`); this.loadBoard(); open(b); },
      error: e => this.fail(e, "Couldn't create the batch.")
    });
  }
  deleteBatch(): void {
    const b = this.batch()!;
    const what = b.status === 'Draft' ? `draft ${b.batchNumber}` : `${b.batchNumber} (${b.statusTitle}, ${b.items.length} payment${b.items.length === 1 ? '' : 's'}, R ${b.totalAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })})`;
    if (!confirm(`Delete ${what}? Its documents are removed too. This can't be undone.`)) return;
    this.busy.set(true);
    this.api.delete(b.id).subscribe({ next: () => { this.busy.set(false); this.toast.done(`${b.batchNumber} deleted`); this.back(); }, error: e => this.fail(e, "Couldn't delete.") });
  }
  openSend(mode: 'submit' | 'approve' | 'reassign'): void {
    const b = this.batch()!; this.sendOpen.set(mode); this.sendOptions.set(null); this.sendPick = new Set(); this.sendNote = ''; this.signOpen.set(false); this.resetSig();
    this.api.batchApprovers(b.id).subscribe({
      // Changing accountant: nobody pre-ticked — the point is to choose someone else.
      next: o => { this.sendOptions.set(o); if (mode !== 'reassign') for (const p of (mode === 'submit' ? o.accountants : o.directors)) this.sendPick.add(p.userId); },
      error: e => { this.sendOpen.set(null); this.fail(e, "Couldn't load the approvers."); }
    });
  }
  togglePick(id: number): void { if (this.sendPick.has(id)) this.sendPick.delete(id); else this.sendPick.add(id); }
  openSign(): void { this.sendOpen.set(null); this.resetSig(); this.signOpen.set(true); }
  initials(n: string): string { return n.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase(); }
  submit(): void {
    const b = this.batch()!; const ids = [...this.sendPick]; this.busy.set(true);
    this.api.submit(b.id, ids.length ? ids : undefined, this.sigPayload()).subscribe({ next: r => { this.sendOpen.set(null); this.apply(r, r.status === 'ChecksFailed' ? 'Checks found problems — see the red items' : `Signed and sent to ${r.requestedApproverNames || 'the accountant'} — they've been notified and emailed`); }, error: e => this.fail(e, "Couldn't submit.") });
  }
  pickedName(opts: { userId: number; name: string }[]): string { const id = [...this.sendPick][0]; return opts.find(p => p.userId === id)?.name ?? '1 person'; }
  reassign(): void {
    const b = this.batch()!; const ids = [...this.sendPick]; this.busy.set(true);
    this.api.reassignAccountant(b.id, ids, this.sendNote.trim() || undefined).subscribe({
      next: r => { this.sendOpen.set(null); this.apply(r, `Moved to ${r.requestedApproverNames || 'the new accountant'} — they've been notified and emailed`); },
      error: e => this.fail(e, "Couldn't change the accountant.")
    });
  }
  recall(): void {
    const b = this.batch()!;
    const reason = prompt(`Recall ${b.batchNumber} to draft?\n\nIt leaves ${b.requestedApproverNames || 'the accountant'}'s queue so you can change it. When you submit again the checks re-run and you sign again.\n\nReason (optional):`, '');
    if (reason === null) return;
    this.busy.set(true);
    this.api.recall(b.id, reason.trim() || undefined).subscribe({ next: r => this.apply(r, 'Recalled to draft — make your changes and submit again'), error: e => this.fail(e, "Couldn't recall the pack.") });
  }
  rerun(): void { const b = this.batch()!; this.busy.set(true); this.api.rerunChecks(b.id).subscribe({ next: r => this.apply(r, `Checks: ${r.checksStatus}`), error: e => this.fail(e, "Couldn't run the checks.") }); }
  accountant(d: 'approve' | 'query'): void {
    const b = this.batch()!;
    if (d === 'approve') {
      const ids = [...this.sendPick]; this.busy.set(true);
      this.api.accountant(b.id, d, this.sendNote || undefined, ids.length ? ids : undefined, this.sigPayload()).subscribe({ next: r => { this.sendOpen.set(null); this.apply(r, `Signed and approved — sent to ${r.requestedDirectorNames || 'the director'} to sign; they've been notified and emailed`); }, error: e => this.fail(e, "Couldn't record your decision.") });
      return;
    }
    const c = prompt('What needs to be fixed before you can approve?'); if (c === null || !c.trim()) return;
    this.busy.set(true); this.api.accountant(b.id, d, c).subscribe({ next: r => this.apply(r, 'Sent back to the preparer'), error: e => this.fail(e, "Couldn't record your decision.") });
  }
  decide(it: BatchItem, d: string): void {
    const b = this.batch()!; let c: string | null = null;
    if (d !== 'Approved') { c = prompt(d === 'Queried' ? `What do you want checked on ${it.supplierName}?` : `Why is ${it.supplierName} rejected?`); if (!c) return; }
    this.busy.set(true); this.api.decide(b.id, it.id, d, c || undefined).subscribe({ next: r => this.apply(r), error: e => this.fail(e, "Couldn't save the decision.") });
  }
  decideAll(d: string): void { const b = this.batch()!; const pend = b.items.filter(i => i.decisionStatus === 'Pending'); if (!pend.length) return; this.busy.set(true); let n = 0; for (const it of pend) this.api.decide(b.id, it.id, d).subscribe({ next: r => { if (++n === pend.length) this.apply(r, `${n} payment(s) approved — now sign`); }, error: e => this.fail(e, "Couldn't approve all.") }); }
  sign(): void {
    const b = this.batch()!; const p = this.sigPayload();
    this.busy.set(true); this.api.sign(b.id, this.signName, this.signComment || undefined, p.signatureImageBase64, p.useSavedSignature).subscribe({ next: r => { this.signOpen.set(false); this.apply(r, r.status === 'Approved' ? 'Signed and locked' : r.status === 'Rejected' ? 'Batch rejected' : 'Queries sent back to the preparer'); }, error: e => this.fail(e, "Couldn't sign.") });
  }
  setStatus(s: 'LoadedOnBank' | 'Paid' | 'Closed' | 'Draft'): void { const b = this.batch()!; this.busy.set(true); this.api.setStatus(b.id, s).subscribe({ next: r => this.apply(r, this.statusTitle(r.status)), error: e => this.fail(e, "Couldn't change the status.") }); }
  bankFile(): void { const b = this.batch()!; this.api.bankFile(b.id).subscribe({ next: blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${b.batchNumber}-bank.csv`; a.click(); URL.revokeObjectURL(a.href); this.open(b.id); }, error: e => this.fail(e, "Couldn't export.") }); }

  // ── items ──
  startItem(it?: BatchItem): void { this.itemDraft = it ? { supplierName: it.supplierName, supplierVatNumber: it.supplierVatNumber ?? '', invoiceNumbers: it.invoiceNumbers ?? '', description: it.description ?? '', amount: it.amount, bankName: it.bankName ?? '', accountNumber: it.accountNumber ?? '', branchCode: it.branchCode ?? '', accountHolder: it.accountHolder ?? '', paymentReference: it.paymentReference ?? '', stockReturned: it.stockReturned, isUrgent: !!it.isUrgent, paymentMode: it.paymentMode === 'PayAndClear' ? 'PayAndClear' : 'Normal', payoutMethod: it.payoutMethod === 'EWallet' ? 'EWallet' : 'EFT', complianceKind: it.complianceKind ?? null, complianceDetail: it.complianceDetail ?? '' } : { ...EMPTY_ITEM, complianceKind: null, complianceDetail: '' }; this.clearInvoice(); this.supplierHits.set([]); this.itemForm.set(it ? it.id : 'new');
    if (this.itemDraft.payoutMethod === 'EWallet') { this.itemDraft.bankName = ''; this.itemDraft.branchCode = ''; }
    this.reqForm = this.blankReqForm(); this.eftStash = null;
    // A new staff payment defaults to filling the requisition in; an existing one that already has a requisition defaults to upload (replace).
    // Staff: uploading the filled-in requisition (with the bank statement scanned in) is the usual case.
    this.reqMode.set('upload'); this.stmtIncluded.set(true); }
  cancelItem(): void { this.itemForm.set(null); this.clearInvoice(); }
  saveItem(): void {
    const b = this.batch()!; const f = this.itemForm(); this.busy.set(true);
    if (this.isPrepayment()) { const d = this.itemDraft; d.bankName = ''; d.accountNumber = ''; d.branchCode = ''; d.accountHolder = ''; }
    if (this.isStaff()) { const d = this.itemDraft; d.payoutMethod = d.payoutMethod === 'EWallet' ? 'EWallet' : 'EFT'; d.paymentMode = 'Normal'; d.supplierVatNumber = ''; if (d.payoutMethod === 'EWallet') { d.bankName = ''; d.branchCode = ''; } }
    else delete this.itemDraft.payoutMethod;
    const file = this.pendingInvoiceFile, link = this.pendingLink, recon = this.pendingReconFile, sage = this.pendingSageFile;
    const staff = this.isStaff(), ewallet = this.itemDraft.payoutMethod === 'EWallet';
    // Upload mode with the statement scanned into the requisition PDF: no separate statement file (even if one was picked before ticking back).
    const stmtInReq = staff && this.reqMode() === 'upload' && this.stmtIncluded() && !!file;
    const statement = staff && (this.reqMode() === 'fill' || !this.stmtIncluded()) ? this.pendingStatementFile : null;
    const fillReq = staff && this.reqMode() === 'fill' && !file ? { ...this.reqForm, employeeName: this.itemDraft.supplierName, amount: this.itemDraft.amount, reason: this.itemDraft.description || this.itemDraft.invoiceNumbers || 'Staff payment' } : null;
    const req = f === 'new' ? this.api.addItem(b.id, this.itemDraft) : this.api.updateItem(b.id, f as number, this.itemDraft);
    req.subscribe({
      next: r => {
        const itemId = f === 'new' ? (r.items[r.items.length - 1]?.id ?? 0) : (f as number);
        this.itemForm.set(null); this.apply(r); this.openItem.set(itemId); this.clearInvoice();
        if (!itemId) return;
        if (staff) { this.attachStaffDocs(b.id, itemId, file, fillReq, statement, stmtInReq && !ewallet, ewallet); return; }
        const total = (file ? 1 : 0) + (recon ? 1 : 0) + (sage ? 1 : 0); let n = 0;
        const attachSage = (afterMsg: string) => {
          if (!sage) { this.untrack(); this.toast.done(afterMsg); return; }
          this.busy.set(true);
          this.api.upload(b.id, sage, 'SageAgedPayables', itemId, undefined, undefined, this.track('Attaching Sage aged payables', sage, ++n, total)).subscribe({ next: x => { this.untrack(); this.apply(x, afterMsg + ' + Sage aged payables'); }, error: e => { this.untrack(); this.fail(e, 'Saved, but the Sage aged payables PDF could not be attached — upload it under the payment.'); } });
        };
        const attachRecon = (afterMsg: string) => {
          if (!recon) { attachSage(afterMsg); return; }
          this.busy.set(true);
          this.api.upload(b.id, recon, 'SupplierRecon', itemId, undefined, undefined, this.track('Attaching the recon', recon, ++n, total)).subscribe({ next: x => { this.batch.set(x); this.busy.set(false); attachSage(afterMsg + ' + recon'); }, error: e => { this.untrack(); this.fail(e, 'Payment saved but the recon could not be attached — upload it under the payment.'); } });
        };
        if (file) { this.busy.set(true); this.api.upload(b.id, file, this.primaryDocType(), itemId, undefined, undefined, this.track(`Attaching the ${this.primaryName()}`, file, ++n, total)).subscribe({ next: x => { this.batch.set(x); this.busy.set(false); attachRecon(this.isPrepayment() ? 'Payment added and request form attached — now add the quote, bank letter and purchase order below' : `Payment added and ${this.primaryName()} attached`); }, error: e => { this.untrack(); this.fail(e, `Payment saved but the ${this.primaryName()} could not be attached.`); } }); }
        else if (link) { this.busy.set(true); this.api.linkInvoice(b.id, itemId, link.id).subscribe({ next: x => { this.batch.set(x); this.busy.set(false); attachRecon('Payment added and linked to the Books invoice'); }, error: e => this.fail(e, 'Payment saved but the Books invoice could not be linked.') }); }
      },
      error: e => this.fail(e, "Couldn't save the payment.")
    });
  }
  /** Staff payment saved: attach the requisition (uploaded file, or generate it from the form), then the bank statement. Each step is optional. */
  private attachStaffDocs(batchId: number, itemId: number, reqFile: File | null, fillReq: RequisitionFormInput | null, statement: File | null, stmtInReq: boolean, ewallet: boolean): void {
    const total = (reqFile || fillReq ? 1 : 0) + (statement ? 1 : 0); let n = 0; const done: string[] = [];
    const steps: { run: () => Observable<BatchDetail>; ok: string; fail: string }[] = [];
    if (reqFile) steps.push({ run: () => this.api.upload(batchId, reqFile, 'Requisition', itemId, undefined, undefined, this.track('Attaching the requisition form', reqFile, ++n, total)), ok: 'requisition attached', fail: 'the requisition form could not be attached — upload it under the payment' });
    else if (fillReq) steps.push({ run: () => this.api.fillRequisition(batchId, itemId, fillReq), ok: 'requisition form generated', fail: 'the requisition form could not be generated — try again from Edit, or upload one' });
    // Statement scanned in with the requisition: record that on the statement slot so nobody asks for it again.
    if (stmtInReq && reqFile) steps.push({ run: () => this.api.markNa(batchId, 'BankStatement', itemId, `Included in the requisition PDF (${reqFile.name})`), ok: 'bank statement included', fail: 'the bank statement could not be marked as included — upload it under the payment' });
    if (statement) steps.push({ run: () => this.api.upload(batchId, statement, 'BankStatement', itemId, undefined, undefined, this.track('Attaching the bank statement', statement, ++n, total)), ok: 'bank statement attached', fail: 'the bank statement could not be attached — upload it under the payment' });
    const next = (i: number) => {
      if (i >= steps.length) {
        this.untrack(); this.busy.set(false);
        const later = statement || stmtInReq || ewallet ? '' : ' — upload the bank statement under it when you have it';
        this.toast.done(`Payment saved${done.length ? ', ' + done.join(', ') : ''}${later}`);
        return;
      }
      this.busy.set(true);
      steps[i].run().subscribe({ next: x => { this.batch.set(x); done.push(steps[i].ok); next(i + 1); }, error: e => { this.untrack(); this.busy.set(false); this.toast.error(e?.error?.message || `Payment saved, but ${steps[i].fail}.`); next(i + 1); } });
    };
    next(0);
  }
  removeItem(it: BatchItem): void { const b = this.batch()!; if (!confirm(`Remove ${it.supplierName} and its documents from this batch?`)) return; this.busy.set(true); this.api.deleteItem(b.id, it.id).subscribe({ next: r => this.apply(r), error: e => this.fail(e, "Couldn't remove.") }); }

  // ── supplier directory + invoice auto-fill ──
  searchSuppliers(q: string): void {
    clearTimeout(this.supTimer); this.showSuppliers.set(true); this.supSearched.set(false);
    const co = this.batch()?.companyCode;
    // With no text yet, offer the company's aging vendors (biggest balances first) so the usual suppliers are one click away.
    if (!q || !q.trim()) { if (co) this.api.suppliers('', 15, co).subscribe({ next: h => { this.supplierHits.set(h.filter(x => x.agingBalance)); this.supSearched.set(true); }, error: () => this.supplierHits.set([]) }); else this.supplierHits.set([]); return; }
    this.supTimer = setTimeout(() => this.api.suppliers(q.trim(), 15, co).subscribe({ next: h => { this.supplierHits.set(h); this.supSearched.set(true); }, error: () => this.supplierHits.set([]) }), 180);
  }
  /** True once the last search returned, so "no matches" can be shown without flashing while typing. */
  supSearched = signal(false);
  /** Exact (case-insensitive) match already in the list — then no "add as new" row is needed. */
  supExact(): boolean { const n = (this.itemDraft.supplierName || '').trim().toLowerCase(); return !!n && this.supplierHits().some(h => h.name.trim().toLowerCase() === n); }
  hideSuppliersSoon(): void { clearTimeout(this.hideTimer); this.hideTimer = setTimeout(() => this.showSuppliers.set(false), 150); }
  pickSupplier(s: SupplierHit): void {
    const d = this.itemDraft; d.supplierName = s.name;
    if (s.vatNumber) d.supplierVatNumber = s.vatNumber;
    if (this.isPrepayment() || (this.isStaff() && this.isEWallet())) { this.showSuppliers.set(false); this.supplierHits.set([]); return; }
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
    this.api.readInvoice(f, this.track(`Reading the ${this.primaryName()}`, f)).subscribe({
      next: r => {
        this.untrack(); this.reading.set(false); const d = this.itemDraft; const filled: string[] = [];
        if (r.supplierName && !d.supplierName) { d.supplierName = r.supplierName; filled.push('supplier'); }
        if (r.amount && !d.amount) { d.amount = r.amount; filled.push('amount'); }
        if (r.vatNumber && !d.supplierVatNumber) d.supplierVatNumber = r.vatNumber;
        if (r.invoiceNumber && !d.invoiceNumbers) { d.invoiceNumbers = r.invoiceNumber; filled.push(this.isPrepayment() ? 'reference no.' : 'invoice no.'); }
        if (r.description && !d.description) { d.description = r.description; filled.push('description'); }
        else if (!d.description && r.orderNumber) { d.description = `Order ${r.orderNumber}`; filled.push('order no.'); }
        if (r.customerAccount && !d.paymentReference) { d.paymentReference = r.customerAccount; filled.push('reference'); }
        // Bank details: prefer what we paid last time (verified), else what is printed on the invoice. Never on prepayments — Treasury captures those.
        if (this.isPrepayment() || (this.isStaff() && this.isEWallet())) { /* no bank capture: prepayments are loaded by Treasury; eWallet has no bank account */ }
        else if (r.supplier?.bankName && !d.bankName) { const s = r.supplier; d.bankName = s.bankName!; d.accountNumber = s.accountNumber ?? ''; d.branchCode = s.branchCode ?? ''; d.accountHolder = s.accountHolder ?? ''; d.paymentReference ||= s.paymentReference ?? ''; filled.push('bank details from last payment'); }
        else if ((r.bankName || r.accountNumber) && !d.bankName && !d.accountNumber) { d.bankName = r.bankName ?? ''; d.accountNumber = r.accountNumber ?? ''; d.branchCode = r.branchCode ?? ''; d.accountHolder = r.accountHolder ?? d.supplierName; filled.push('bank details printed on the invoice — verify against the bank letter'); }
        this.readInfo.set(!r.readable ? 'could not read the text — fill in by hand' : filled.length ? 'filled: ' + filled.join(', ') : 'read, nothing recognised');
        const want = this.primaryDocType();
        if (r.suggestedType && r.suggestedType !== want && r.suggestedType !== 'Other') this.toast.warn(`This looks like a ${this.docTitle(r.suggestedType)}, not a ${this.isPrepayment() ? 'request form' : 'tax invoice'} — it will still be attached as the ${this.primaryName()}.`);
      },
      error: e => { this.untrack(); this.reading.set(false); this.readInfo.set('could not read'); this.toast.error(e?.error?.message || "Couldn't read the PDF — it will still be attached."); }
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
  clearInvoice(): void { this.hasReadBank.set(false); this.pendingStatementFile = null; this.statementInfo.set(''); this.pendingInvoiceFile = null; this.pendingReconFile = null; this.pendingSageFile = null; this.reconInfo.set(''); this.pendingLink = null; this.readInfo.set(''); this.picker.set(false); this.pickerHits.set([]); }
  /** Upload progress strip (bottom-right): pct <100 = bytes going up, 100 = server is reading the document. */
  progress = signal<{ label: string; file: string; pct: number; index: number; total: number } | null>(null);
  private track(label: string, file: File, index = 1, total = 1): (pct: number) => void {
    this.progress.set({ label, file: file.name, pct: 0, index, total });
    return pct => this.progress.update(p => p ? { ...p, pct } : p);
  }
  private untrack(): void { this.progress.set(null); }
  reconChosen(e: Event): void {
    const inp = e.target as HTMLInputElement; const f = inp.files?.[0]; inp.value = ''; if (!f) return;
    if (!/\.(xlsx|xls|csv|pdf)$/i.test(f.name)) { this.toast.warn('The recon must be an Excel file (.xlsx/.xls), CSV or PDF.'); return; }
    this.pendingReconFile = f; this.reconInfo.set('reading…');
    this.api.readRecon(f, this.track('Reading the recon', f)).subscribe({
      next: r => {
        this.untrack();
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
  pickFor(docType: string, itemId: number | null): void { if (this.busy()) { this.toast.info('Still attaching the previous file — one moment.'); return; } this.pendingType = docType; this.pendingItem = itemId; this.pendingReplace = null; this.pickAccept = this.isSheetSlot(docType) ? '.xlsx,.xls,.csv,application/pdf' : 'application/pdf'; setTimeout(() => this.fileInput?.nativeElement.click()); }
  replaceDoc(d: BatchDoc): void { const reason = prompt('Why is this document being replaced? (kept in the history)'); if (!reason) return; this.pendingType = d.docType; this.pendingItem = d.itemId ?? null; this.pendingReplace = { ...d, versionReason: reason }; this.pickAccept = this.isSheetSlot(d.docType) ? '.xlsx,.xls,.csv,application/pdf' : 'application/pdf'; setTimeout(() => this.fileInput?.nativeElement.click()); }
  filesChosen(e: Event): void { const inp = e.target as HTMLInputElement; const files = Array.from(inp.files ?? []); inp.value = ''; this.uploadAll(files, this.pendingItem, this.pendingType); }
  drop(e: DragEvent, itemId: number | null): void { e.preventDefault(); if (this.busy()) { this.toast.info('Still attaching the previous file — one moment.'); return; } this.uploadAll(Array.from(e.dataTransfer?.files ?? []), itemId, ''); }
  private uploadAll(files: File[], itemId: number | null, docType: string): void {
    const b = this.batch()!;
    const sheetOk = this.isSheetSlot(docType);
    const pdfs = files.filter(f => /\.pdf$/i.test(f.name) || (sheetOk && /\.(xlsx|xls|csv)$/i.test(f.name)));
    if (!pdfs.length) { this.toast.warn(sheetOk ? 'PDF or Excel/CSV files only.' : 'PDF files only — one document per file. Excel recons go in the Supplier recon slot (use its Upload button).'); return; }
    if (!sheetOk && files.some(f => /\.(xlsx|xls|csv)$/i.test(f.name))) { const items = this.batch()?.items ?? []; const it = items.find(i => i.id === itemId); const slot = (it?.required ?? []).find(r => r.docType === 'SupplierRecon'); if (slot && files.filter(f => /\.(xlsx|xls|csv)$/i.test(f.name)).length === 1 && pdfs.length === files.length - 1) { /* a spreadsheet dropped with PDFs — send it to the recon slot */ const sheet = files.find(f => /\.(xlsx|xls|csv)$/i.test(f.name))!; this.api.upload(b.id, sheet, 'SupplierRecon', itemId).subscribe({ next: r => { this.batch.set(r); this.toast.done('Spreadsheet attached as the supplier recon'); }, error: e => this.toast.error(`${sheet.name}: ${e?.error?.message || 'upload failed'}`) }); } else this.toast.warn('Spreadsheets are only accepted as the supplier recon — use that slot\'s Upload button.'); }
    this.busy.set(true); let i = 0;
    const next = () => { if (i >= pdfs.length) { this.untrack(); this.busy.set(false); this.toast.done(docType ? 'Attached' : `${pdfs.length} file(s) attached — check the document type we guessed`); return; }
      const f = pdfs[i++]; const rep = this.pendingReplace;
      this.api.upload(b.id, f, docType || undefined, itemId, rep?.id, rep?.versionReason, this.track(docType ? `Attaching ${this.docTitle(docType)}` : 'Attaching document', f, i, pdfs.length)).subscribe({ next: r => { this.batch.set(r); this.pendingReplace = null; next(); }, error: e => { this.toast.error(`${f.name}: ${e?.error?.message || 'upload failed'}`); next(); } }); };
    next();
  }
  retype(d: BatchDoc, t: string): void { const b = this.batch()!; this.api.updateDoc(b.id, d.id, { docType: t }).subscribe({ next: r => this.batch.set(r), error: e => this.fail(e, "Couldn't change the type.") }); }
  removeDoc(d: BatchDoc): void { const b = this.batch()!; this.api.deleteDoc(b.id, d.id).subscribe({ next: r => this.batch.set(r), error: e => this.fail(e, "Couldn't remove the document.") }); }
  markNa(r: RequiredDoc, itemId: number | null): void { const b = this.batch()!; const reason = prompt(`Why does "${r.title}" not apply to this payment? (the approvers will see this)`); if (!reason) return; this.api.markNa(b.id, r.docType, itemId, reason).subscribe({ next: x => this.batch.set(x), error: e => this.fail(e, "Couldn't mark N/A.") }); }
  openDoc(d: BatchDoc): void {
    const b = this.batch()!;
    const it = b.items.find(i => i.id === d.itemId);
    if (d.textMethod === 'sheet') {
      ReconPreviewDialogComponent.open(this.dialog, { sheetUrl: this.api.sheetUrl(b.id, d.id), fileUrl: this.api.fileUrl(b.id, d.id), title: `${this.docTitle(d.docType)}${it ? ' · ' + it.supplierName : ''}`, subtitle: `${b.batchNumber} · ${d.originalFileName || ''}`, fileName: d.originalFileName || 'recon.xlsx' });
      return;
    }
    PackPreviewDialogComponent.open(this.dialog, { url: this.api.fileUrl(b.id, d.id), title: `${this.docTitle(d.docType)}${it ? ' · ' + it.supplierName : ''}`, subtitle: `${b.batchNumber} · ${d.originalFileName || ''}${d.documentDate ? ' · dated ' + new Date(d.documentDate).toLocaleDateString() : ''}`, fileName: d.originalFileName || 'document.pdf' });
  }
  previewableDocs(it: BatchItem): BatchDoc[] { return it.documents.filter(d => !d.isNotApplicable); }
  /** Review a payment: open its first PDF (tax invoice first) in the preview dialog; the dialog's own buttons handle open/download. */
  previewItem(it: BatchItem): void {
    // One scroll: the approval sheet, then every PDF on this payment (spreadsheet recons keep their own preview).
    const b = this.batch()!; const docs = this.previewableDocs(it); if (!docs.length) return;
    const sheets = docs.filter(d => d.textMethod === 'sheet').length;
    this.openItem.set(it.id);
    PackPreviewDialogComponent.open(this.dialog, {
      url: this.api.itemReviewUrl(b.id, it.id),
      title: `${it.supplierName} — approval sheet + ${docs.length - sheets} document${docs.length - sheets === 1 ? '' : 's'}`,
      subtitle: `${b.batchNumber} · R ${it.amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}${sheets ? ` · ${sheets} Excel recon${sheets === 1 ? '' : 's'} open from their own preview below` : ''}`,
      fileName: `${b.batchNumber}-${it.supplierName}.pdf`
    });
  }

  // ── signature pad ──
  private ctx(): CanvasRenderingContext2D | null { const c = this.sigpad?.nativeElement; if (!c) return null; const x = c.getContext('2d'); if (x) { x.lineWidth = 2; x.lineCap = 'round'; x.strokeStyle = '#111'; } return x; }
  private pos(e: PointerEvent) { const c = this.sigpad!.nativeElement; const r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * c.width / r.width, y: (e.clientY - r.top) * c.height / r.height }; }
  padDown(e: PointerEvent) { const x = this.ctx(); if (!x) return; this.drawing = true; const p = this.pos(e); x.beginPath(); x.moveTo(p.x, p.y); }
  padMove(e: PointerEvent) { if (!this.drawing) return; const x = this.ctx(); if (!x) return; const p = this.pos(e); x.lineTo(p.x, p.y); x.stroke(); if (!this.drew) { this.drew = true; this.drewSig.set(true); } }
  padUp() { this.drawing = false; }
  padClear() { const c = this.sigpad?.nativeElement; c?.getContext('2d')?.clearRect(0, 0, c.width, c.height); this.drew = false; this.drewSig.set(false); }
}
