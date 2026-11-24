import { Component, ElementRef, OnInit, ViewChild, computed, inject, input, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, Batch, Doc, Item } from '../core/api';
import { AuthStore } from '../core/auth';

@Component({
  selector: 'app-pack',
  imports: [RouterLink, FormsModule, CurrencyPipe, DatePipe, NgTemplateOutlet],
  template: `
    <a routerLink="/" class="back">‹ Waiting for you</a>
    @if (loading()) { <div class="spinner"></div> }
    @else if (error()) { <p class="err">{{ error() }}</p> }
    @else if (b(); as b) {
      <div class="card head">
        <div class="t">
          <h1>{{ b.companyName }}</h1>
          <div class="muted">{{ b.batchNumber }} · {{ b.paymentTypeTitle }} · dated {{ b.batchDate | date:'d MMM yyyy' }}</div>
          <div class="muted">Prepared by <b>{{ b.preparedByName }}</b>@if (b.accountantName) { · approved by <b>{{ b.accountantName }}</b> {{ b.accountantApprovedAt | date:'d MMM HH:mm' }} }</div>
          @if (b.notes) { <div class="nt">“{{ b.notes }}”</div> }
          @if (b.accountantComment) { <div class="nt">Accountant: “{{ b.accountantComment }}”</div> }
        </div>
        <div class="sum"><span class="pill" [class]="'pill ' + tone(b.status)">{{ b.statusTitle }}</span><div class="amt">{{ b.totalAmount | currency:'ZAR':'R ':'1.2-2' }}</div><div class="muted sm">{{ b.items.length }} payment{{ b.items.length === 1 ? '' : 's' }}</div></div>
      </div>

      @if (done()) {
        <div class="card ok-box"><div class="big">✅</div><h2>{{ done() }}</h2><p class="muted">Everyone involved has been notified. You can close this page.</p><a routerLink="/" class="btn block">Back to waiting for you</a></div>
      } @else {

      <div class="card act">
        <button type="button" class="btn ghost block" (click)="openPdf(api.reviewPdfUrl(b.id))" [disabled]="pdfBusy()">{{ pdfBusy() ? 'Opening…' : '📄 Read the whole pack (PDF)' }}</button>
        <p class="muted sm">Approval sheet plus every invoice, PO and bank letter in one document — easiest on a phone.</p>
        <div class="dls">
          <button type="button" class="btn ghost sm" (click)="openPdf(api.approvalSheetUrl(b.id))" [disabled]="pdfBusy()">Approval sheet</button>
          @if (b.lockedAt) {
            <button type="button" class="btn ghost sm" (click)="openPdf(api.signedPackUrl(b.id))" [disabled]="pdfBusy()">Signed pack (PDF)</button>
            <button type="button" class="btn ghost sm" (click)="save(api.documentsZipUrl(b.id), 'Documents-' + b.batchNumber + '.zip')" [disabled]="pdfBusy()">All documents (ZIP)</button>
          }
        </div>
      </div>

      @if (b.can.directorConflict) { <p class="note">{{ b.can.directorConflict }}</p> }

      <!-- ─── Accountant step ─── -->
      @if (b.can.accountant) {
        <div class="card step">
          <h2>Approve as accountant</h2>
          <p class="muted">Confirms the pack has been checked. You can approve or send back each payment below: approved ones go to the company's director(s) to sign; sent-back ones return to the preparer with your reason.</p>
          @if (accSendBack() > 0) { <p class="note">{{ accSendBack() }} payment{{ accSendBack() === 1 ? '' : 's' }} will be sent back to the preparer; {{ accLive() - accSendBack() }} go{{ accLive() - accSendBack() === 1 ? 'es' : '' }} to the director.</p> }
          <label class="f">Note for the director (optional) <input type="text" [(ngModel)]="comment"></label>
          <ng-container *ngTemplateOutlet="sig"></ng-container>
          <div class="btns">
            <button type="button" class="btn ok" (click)="accountant('approve')" [disabled]="busy() || !sigReady() || (accLive() > 0 && accSendBack() === accLive())">{{ accSendBack() ? 'Sign: approve ' + (accLive() - accSendBack()) + ', send back ' + accSendBack() : 'Sign & approve' }}</button>
            <button type="button" class="btn ghost" (click)="accountant('query')" [disabled]="busy() || !comment.trim()">Send back</button>
          </div>
          @if (!comment.trim()) { <p class="muted sm">To send the whole pack back, type what needs fixing in the note first.</p> }
        </div>
      }

      <!-- ─── Payments ─── -->
      <h2 class="sec">Payments</h2>
      <div class="items">
        @for (it of b.items; track it.id) {
          <div class="card item" [class.sel-ok]="it.decisionStatus === 'Approved'" [class.sel-warn]="it.decisionStatus === 'Queried'" [class.sel-bad]="it.decisionStatus === 'Rejected' || it.decisionStatus === 'SentBack'" [class.dim]="it.decisionStatus === 'SentBack'">
            <div class="ir">
              <div class="il">
                <div class="sup">{{ it.supplierName }} @if (it.isUrgent) { <span class="pill bad">Urgent</span> }</div>
                @if (it.invoiceNumbers) { <div class="muted sm">{{ isRequisitionBased(b) ? 'Ref' : 'Inv' }} {{ it.invoiceNumbers }}</div> }
                @if (it.complianceTitle) { <div class="sm"><span class="pill neutral">Compliance · {{ it.complianceTitle }}</span></div> }
                @if (it.description) { <div class="sm">{{ it.description }}</div> }
                <div class="muted sm">{{ it.bankName }} · {{ it.accountNumber }}@if (it.paymentReference) { · ref {{ it.paymentReference }} }</div>
              </div>
              <div class="iamt">{{ it.amount | currency:'ZAR':'R ':'1.2-2' }}</div>
            </div>
            @if (files(it).length) {
              <button type="button" class="btn ghost block sm prev" (click)="openPdf(api.itemReviewUrl(b.id, it.id))" [disabled]="pdfBusy()">{{ pdfBusy() ? 'Opening…' : '📄 Preview all — approval sheet + ' + files(it).length + (files(it).length === 1 ? ' document' : ' documents') }}</button>
              <div class="docs">
                @for (d of files(it); track d.id) { <button type="button" class="doc" (click)="openPdf(api.fileUrl(b.id, d.id))">📎 {{ d.title || d.docTypeTitle || d.docType }}</button> }
              </div>
            }
            @for (d of notApplicable(it); track d.id) { <div class="muted sm">✓ {{ d.title || d.docType }} — {{ d.naReason || 'not applicable' }}</div> }
            @if (missing(it).length) { <div class="muted sm">Missing: {{ missing(it).join(', ') }}</div> }
            @if (it.decisionStatus === 'SentBack') {
              <div class="rej"><b>Sent back by {{ b.accountantName || 'the accountant' }}</b><span>{{ it.accountantDecisionComment || it.decisionComment || 'No reason given' }}</span>@if (it.resubmittedAsBatchNumber) { <span class="muted sm">Resubmitted on {{ it.resubmittedAsBatchNumber }}</span> }</div>
            } @else if (b.can.accountant) {
              <div class="dec two">
                <button type="button" class="btn sm" [class.ok]="it.accountantDecision === 'Approved'" [class.ghost]="it.accountantDecision !== 'Approved'" (click)="accDecide(it, it.accountantDecision === 'Approved' ? 'Pending' : 'Approved')" [disabled]="busy()">👍 Approve</button>
                <button type="button" class="btn sm" [class.bad]="it.accountantDecision === 'SentBack'" [class.ghost]="it.accountantDecision !== 'SentBack'" (click)="it.accountantDecision === 'SentBack' ? accDecide(it, 'Pending') : askSendBack(it)" [disabled]="busy()">↩ Send back</button>
              </div>
              @if (sendingBack() === it.id) {
                <div class="askbox">
                  <label class="f">Why is it being sent back? <input type="text" [(ngModel)]="askText" placeholder="e.g. Bank letter older than 3 months" autofocus></label>
                  <div class="btns"><button type="button" class="btn sm bad" (click)="accDecide(it, 'SentBack', askText)" [disabled]="busy() || !askText.trim()">Send back</button><button type="button" class="btn ghost sm" (click)="sendingBack.set(null)">Cancel</button></div>
                </div>
              } @else if (it.accountantDecisionComment) { <div class="muted sm">“{{ it.accountantDecisionComment }}”</div> }
            } @else if (b.can.direct) {
              @if (it.accountantDecisionComment) { <div class="muted sm">Accountant: “{{ it.accountantDecisionComment }}”</div> }
              <div class="dec">
                <button type="button" class="btn sm" [class.ok]="it.decisionStatus === 'Approved'" [class.ghost]="it.decisionStatus !== 'Approved'" (click)="decide(it, 'Approved')" [disabled]="busy()">👍 Approve</button>
                <button type="button" class="btn sm" [class.warn]="it.decisionStatus === 'Queried'" [class.ghost]="it.decisionStatus !== 'Queried'" (click)="ask(it, 'Queried')" [disabled]="busy()">❓ Query</button>
                <button type="button" class="btn sm" [class.bad]="it.decisionStatus === 'Rejected'" [class.ghost]="it.decisionStatus !== 'Rejected'" (click)="ask(it, 'Rejected')" [disabled]="busy()">👎 Reject</button>
              </div>
              @if (asking() === it.id) {
                <div class="askbox">
                  <label class="f">Reason for {{ askKind() === 'Queried' ? 'querying' : 'rejecting' }} <input type="text" [(ngModel)]="askText" placeholder="e.g. Amount doesn't match the invoice" autofocus></label>
                  <div class="btns"><button type="button" class="btn sm" [class.warn]="askKind() === 'Queried'" [class.bad]="askKind() === 'Rejected'" (click)="decide(it, askKind(), askText)" [disabled]="busy() || !askText.trim()">Confirm</button><button type="button" class="btn ghost sm" (click)="asking.set(null)">Cancel</button></div>
                </div>
              } @else if (it.decisionComment && it.decisionStatus !== 'Approved') { <div class="muted sm">“{{ it.decisionComment }}”</div> }
            } @else if (it.decisionStatus === 'Rejected') {
              <div class="rej"><b>Rejected{{ b.directorName ? ' by ' + b.directorName : '' }}</b><span>{{ it.decisionComment || 'No reason given' }}</span></div>
            } @else if (it.decisionStatus !== 'Pending' && !it.queryQuestion) {
              <div class="muted sm">{{ it.decisionStatus }}@if (it.decisionComment) { — “{{ it.decisionComment }}” }</div>
            }
            @if (it.queryQuestion) {
              <div class="qa q"><span class="muted sm">❓ {{ it.queryAskedByName || 'Director' }}@if (it.queryAskedAt) { · {{ it.queryAskedAt | date:'d MMM HH:mm' }} }</span><div>{{ it.queryQuestion }}</div></div>
              @if (it.queryResponse) { <div class="qa a"><span class="muted sm">↩ {{ it.queryRespondedByName }}@if (it.queryRespondedAt) { · {{ it.queryRespondedAt | date:'d MMM HH:mm' }} }</span><div>{{ it.queryResponse }}</div></div> }
              @else if (b.status === 'QueriedByDirector' && it.decisionStatus === 'Queried' && canAnswer()) {
                <div class="askbox">
                  <label class="f">Your answer for the director <textarea rows="2" [(ngModel)]="answers[it.id]" placeholder="Answer the query, or say what you changed"></textarea></label>
                  <button type="button" class="btn sm" (click)="answer(it)" [disabled]="busy() || !(answers[it.id] || '').trim()">Send answer</button>
                </div>
              }
            }
          </div>
        }
      </div>

      <!-- ─── Director sign ─── -->
      @if (b.can.direct) {
        <div class="card step sign">
          <h2>Sign as director</h2>
          @if (pending() > 0) {
            <p class="note">{{ pending() }} payment{{ pending() === 1 ? '' : 's' }} still need{{ pending() === 1 ? 's' : '' }} a decision above.</p>
            <button type="button" class="btn ghost block" (click)="approveAll()" [disabled]="busy()">Approve all {{ pending() }} pending</button>
          } @else {
            <ul class="facts">
              <li>{{ b.companyName }} pays <b>{{ approvedAmount() | currency:'ZAR':'R ':'1.2-2' }}</b> across <b>{{ count('Approved') }}</b> approved payment{{ count('Approved') === 1 ? '' : 's' }}.</li>
              @if (count('Queried')) { <li class="w">{{ count('Queried') }} queried → @if (count('Approved')) { moved to a pack of their own and sent to the preparer / accountant to answer; they come back to you once answered. } @else { the pack goes back for answers, then returns to you. }</li> }
              @if (count('SentBack')) { <li>{{ count('SentBack') }} sent back by the accountant — not for your decision.</li> }
              @if (count('Rejected')) { <li class="w">{{ count('Rejected') }} rejected — excluded from payment.</li> }
              <li>After signing, the pack is locked and released to the treasurer.</li>
            </ul>
            <label class="f">Type your full name to sign <input type="text" [(ngModel)]="typedName" [placeholder]="auth.user()?.name ?? ''" autocomplete="name"></label>
            <ng-container *ngTemplateOutlet="sig"></ng-container>
            <label class="f">Comment (optional) <input type="text" [(ngModel)]="comment"></label>
            <button type="button" class="btn block" (click)="sign()" [disabled]="busy() || !b.can.sign || !typedName.trim() || !sigReady()">{{ busy() ? 'Signing…' : '✍️ Sign & lock the pack' }}</button>
          }
        </div>
      }
      }

      <ng-template #sig>
        <div class="sigbox">
          <div class="modes">
            <button type="button" class="mode" [class.on]="sigMode() === 'saved'" (click)="sigMode.set('saved')" [disabled]="!hasSig()">My saved signature</button>
            <button type="button" class="mode" [class.on]="sigMode() === 'draw'" (click)="sigMode.set('draw'); setupPad()">Draw it now</button>
          </div>
          @if (sigMode() === 'saved') {
            @if (hasSig()) { <img class="saved" [src]="sigSrc()" alt="Your saved signature"> }
            @else { <p class="muted sm">No saved signature on your profile yet — draw one below, or ask an admin to add it under Settings › Users.</p> }
          } @else {
            <canvas #pad class="pad" (pointerdown)="padDown($event)" (pointermove)="padMove($event)" (pointerup)="padUp()" (pointerleave)="padUp()"></canvas>
            <div class="padfoot"><span class="muted sm">{{ drew() ? 'Signature captured.' : 'Sign with your finger or mouse.' }}</span><button type="button" class="btn ghost sm" (click)="padClear()">Clear</button></div>
          }
        </div>
      </ng-template>

      <h2 class="sec">History</h2>
      <div class="card hist">
        @for (e of b.events; track e.id) { <div class="ev"><span class="muted sm">{{ e.at | date:'d MMM HH:mm' }}</span> <b>{{ e.userName }}</b> {{ e.action }}@if (e.comment) { <span class="muted"> — {{ e.comment }}</span> }</div> }
      </div>
    }
  `,
  styles: [`
    .back { display: inline-flex; align-items: center; gap: 4px; margin-bottom: 12px; padding: 6px 12px 6px 9px; border-radius: 999px; background: var(--card); border: 1px solid var(--line); box-shadow: var(--shadow-sm); text-decoration: none; font-weight: 600; font-size: 13.5px; color: var(--ink-2); }
    .back:hover { color: var(--brand); border-color: #c7d2fe; }
    .card.head { align-items: flex-start; background: linear-gradient(135deg, #f5f6ff, #fff 60%); }
    @media (max-width: 560px) {
      .card.head { flex-direction: column-reverse; gap: 6px; } .card.head h1 { font-size: 21px; }
      .card.head .sum { text-align: left; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; width: 100%; } .card.head .sum .amt { margin-top: 0; font-size: 22px; }
    }
    .head { display: flex; justify-content: space-between; gap: 14px; margin-bottom: 12px; } h1 { margin: 0 0 4px; font-size: 20px; } .nt { margin-top: 6px; font-size: 14px; }
    .sum { text-align: right; flex: 0 0 auto; } .amt { font-weight: 800; font-size: 20px; margin-top: 6px; } .sm { font-size: 13px; }
    .act { margin-bottom: 12px; } .act p { margin: 8px 0 0; }
    .items { display: grid; gap: 10px; } .item { position: relative; padding: 15px 16px 15px 19px; overflow: hidden; }
    .item::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--line); transition: background .2s; }
    .item.sel-ok::before { background: var(--ok); } .item.sel-warn::before { background: #f59e0b; } .item.sel-bad::before { background: #ef4444; }
    .ir { display: flex; justify-content: space-between; gap: 12px; } .sup { font-weight: 700; } .iamt { font-weight: 700; white-space: nowrap; }
    .prev { margin-top: 10px; } .docs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; } .doc { border: 1px solid var(--line); background: #fff; border-radius: 999px; padding: 6px 12px; font-size: 13px; cursor: pointer; color: var(--ink-2); transition: border-color .15s, color .15s; } .doc:hover { border-color: #a5b4fc; color: var(--brand); }
    .dec { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 10px; }
    .item.dim { opacity: .85; } .dec.two { grid-template-columns: repeat(2, 1fr); }
    .rej { margin-top: 10px; display: flex; flex-direction: column; gap: 2px; background: var(--bad-bg); color: var(--bad); border-radius: 10px; padding: 10px 12px; font-size: 14px; } .rej span { color: var(--ink); }
    .qa { margin-top: 10px; border-radius: 10px; padding: 10px 12px; font-size: 14px; } .qa.q { background: var(--warn-bg); } .qa.a { background: var(--bg); } .qa div { white-space: pre-wrap; }
    .askbox textarea { min-height: 70px; }
    .dls { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .askbox { margin-top: 10px; } .btns { display: flex; gap: 8px; flex-wrap: wrap; }
    .step { margin-top: 14px; } .step h2 { margin: 0 0 6px; font-size: 18px; } .step p { margin: 0 0 12px; }
    .facts { margin: 0 0 14px; padding-left: 18px; } .facts .w { color: var(--warn); }
    .sigbox { border: 1px dashed var(--line); border-radius: 12px; padding: 12px; margin-bottom: 14px; }
    .modes { display: flex; gap: 6px; margin-bottom: 10px; } .mode { flex: 1; min-height: 40px; border-radius: 10px; border: 1px solid var(--line); background: #fff; cursor: pointer; } .mode.on { border-color: var(--brand); background: #eef2ff; color: var(--brand); font-weight: 600; } .mode:disabled { opacity: .5; }
    .saved { display: block; max-height: 90px; max-width: 100%; }
    .pad { width: 100%; height: 150px; border: 1px solid var(--line); border-radius: 10px; background: #fff; touch-action: none; display: block; } .padfoot { display: flex; justify-content: space-between; align-items: center; margin-top: 6px; }
    .ok-box { text-align: center; padding: 36px 20px; } .big { font-size: 34px; width: 72px; height: 72px; display: grid; place-items: center; margin: 0 auto 6px; border-radius: 50%; background: var(--ok-bg); } .ok-box h2 { margin: 8px 0 4px; } .ok-box .btn { margin-top: 16px; }
    .hist .ev { padding: 6px 0; border-bottom: 1px solid var(--line); font-size: 14px; } .hist .ev:last-child { border-bottom: 0; }
  `]
})
export class PackPage implements OnInit {
  api = inject(Api); auth = inject(AuthStore); private router = inject(Router);
  id = input.required<string>();
  b = signal<Batch | null>(null); loading = signal(true); error = signal(''); busy = signal(false); pdfBusy = signal(false); done = signal('');
  comment = ''; typedName = '';
  asking = signal<number | null>(null); askKind = signal<'Queried' | 'Rejected'>('Queried'); askText = '';
  sigMode = signal<'saved' | 'draw'>('saved'); hasSig = signal(false); sigSrc = signal(''); drew = signal(false);
  @ViewChild('pad') pad?: ElementRef<HTMLCanvasElement>;
  private drawing = false;

  sendingBack = signal<number | null>(null); answers: Record<number, string> = {};
  /** Who may answer a director's query here: the company accountant (or an admin) — the server checks it too. */
  canAnswer = signal(false);
  accLive = computed(() => this.b()?.items.filter(i => i.decisionStatus !== 'SentBack').length ?? 0);
  accSendBack = computed(() => this.b()?.items.filter(i => i.decisionStatus !== 'SentBack' && i.accountantDecision === 'SentBack').length ?? 0);
  pending = computed(() => this.b()?.items.filter(i => i.decisionStatus === 'Pending').length ?? 0);
  approvedAmount = computed(() => this.b()?.items.filter(i => i.decisionStatus === 'Approved').reduce((s, i) => s + i.amount, 0) ?? 0);
  count(s: string) { return this.b()?.items.filter(i => i.decisionStatus === s).length ?? 0; }
  /** Real files on a payment (N/A placeholders have no file to open). */
  files(it: Item) { return it.documents.filter(d => !d.isNotApplicable); }
  notApplicable(it: Item) { return it.documents.filter(d => d.isNotApplicable); }
  isRequisitionBased(b: { paymentType?: string }) { return b.paymentType === 'StaffPayment' || b.paymentType === 'RequisitionForm'; }
  missing(it: Item) { return it.required.filter(r => !r.filled).map(r => r.title); }
  tone(s: string) { return s === 'AwaitingDirector' || s === 'AwaitingAccountant' ? 'warn' : s === 'Approved' || s === 'Paid' || s === 'Closed' ? 'ok' : s.startsWith('Queried') || s === 'Rejected' || s === 'ChecksFailed' ? 'bad' : 'neutral'; }
  sigReady() { return this.sigMode() === 'saved' ? this.hasSig() : this.drew(); }

  ngOnInit() {
    this.typedName = this.auth.user()?.name ?? '';
    const has = !!this.auth.user()?.hasSignature; this.hasSig.set(has); if (!has) this.sigMode.set('draw');
    if (has) this.api.blob(this.api.signatureUrl()).subscribe({ next: bl => this.sigSrc.set(URL.createObjectURL(bl)), error: () => { this.hasSig.set(false); this.sigMode.set('draw'); } });
    this.api.meta().subscribe({ next: m => this.canAnswer.set(!!(m.me.accountant || m.me.clerk || m.me.isAdmin)), error: () => {} });
    this.load();
  }
  load() {
    this.api.batch(Number(this.id())).subscribe({
      next: b => { this.b.set(b); this.loading.set(false); },
      error: e => { this.loading.set(false); this.error.set(e?.status === 404 ? 'This pack no longer exists or you are not one of its approvers.' : (e?.error?.message ?? "Couldn't load the pack.")); }
    });
  }
  openPdf(url: string) {
    this.pdfBusy.set(true);
    this.api.blob(url).subscribe({
      next: bl => { this.pdfBusy.set(false); const u = URL.createObjectURL(bl); const w = window.open(u, '_blank'); if (!w) location.href = u; },
      error: () => { this.pdfBusy.set(false); alert("Couldn't open the document."); }
    });
  }
  save(url: string, name: string) { this.pdfBusy.set(true); this.api.download(url, name, () => this.pdfBusy.set(false)); }
  askSendBack(it: Item) { this.askText = it.accountantDecisionComment ?? ''; this.sendingBack.set(it.id); }
  accDecide(it: Item, d: 'Approved' | 'SentBack' | 'Pending', comment?: string) {
    const b = this.b()!; this.busy.set(true);
    this.api.accountantDecide(b.id, it.id, d, comment?.trim() || undefined).subscribe({
      next: nb => { this.b.set(nb); this.busy.set(false); this.sendingBack.set(null); },
      error: e => { this.busy.set(false); alert(e?.error?.message ?? "Couldn't save that decision."); }
    });
  }
  answer(it: Item) {
    const b = this.b()!; const text = (this.answers[it.id] || '').trim(); if (!text) return;
    this.busy.set(true);
    this.api.answerQuery(b.id, it.id, text).subscribe({
      next: nb => { this.b.set(nb); this.busy.set(false); delete this.answers[it.id]; if (nb.status === 'AwaitingDirector') this.done.set('Answered — every query is answered, so the pack is back with the director.'); },
      error: e => { this.busy.set(false); alert(e?.error?.message ?? "Couldn't send the answer."); }
    });
  }
  ask(it: Item, kind: 'Queried' | 'Rejected') { this.askKind.set(kind); this.askText = it.decisionComment ?? ''; this.asking.set(it.id); }
  decide(it: Item, d: string, comment?: string) {
    const b = this.b()!; this.busy.set(true);
    this.api.decide(b.id, it.id, d, comment?.trim() || undefined).subscribe({
      next: nb => { this.b.set(nb); this.busy.set(false); this.asking.set(null); },
      error: e => { this.busy.set(false); alert(e?.error?.message ?? "Couldn't save that decision."); }
    });
  }
  approveAll() {
    const b = this.b()!; const todo = b.items.filter(i => i.decisionStatus === 'Pending');
    this.busy.set(true);
    const next = (idx: number) => {
      if (idx >= todo.length) { this.busy.set(false); return; }
      this.api.decide(b.id, todo[idx].id, 'Approved').subscribe({ next: nb => { this.b.set(nb); next(idx + 1); }, error: e => { this.busy.set(false); alert(e?.error?.message ?? "Couldn't approve."); } });
    };
    next(0);
  }
  private sigPayload() {
    if (this.sigMode() === 'draw' && this.drew() && this.pad) return { signatureImageBase64: this.pad.nativeElement.toDataURL('image/png'), useSavedSignature: false };
    return { useSavedSignature: true };
  }
  sign() {
    const b = this.b()!; this.busy.set(true);
    this.api.sign(b.id, { typedName: this.typedName.trim(), comment: this.comment.trim() || undefined, ...this.sigPayload() }).subscribe({
      next: nb => { this.busy.set(false); this.b.set(nb); this.done.set(nb.status === 'Approved' ? 'Signed — the pack is locked and released for payment.' : nb.status === 'QueriedByDirector' ? 'Signed — your queries have been sent back to the preparer.' : 'Signed — the pack has been rejected.'); window.scrollTo({ top: 0, behavior: 'smooth' }); },
      error: e => { this.busy.set(false); alert(e?.error?.message ?? "Couldn't sign the pack."); }
    });
  }
  accountant(decision: 'approve' | 'query') {
    const b = this.b()!; this.busy.set(true);
    this.api.accountant(b.id, { decision, comment: this.comment.trim() || undefined, ...this.sigPayload() }).subscribe({
      next: nb => { this.busy.set(false); this.b.set(nb); this.done.set(decision === 'approve' ? (nb.items.some(i => i.decisionStatus === 'SentBack') ? 'Approved — the approved payments have gone to the director(s); the sent-back ones are with the preparer.' : 'Approved — the pack has gone to the director(s) to sign.') : 'Sent back to the preparer with your note.'); window.scrollTo({ top: 0, behavior: 'smooth' }); },
      error: e => { this.busy.set(false); alert(e?.error?.message ?? "Couldn't complete that."); }
    });
  }

  // ─── signature pad ───
  setupPad() { setTimeout(() => { const c = this.pad?.nativeElement; if (!c) return; const r = c.getBoundingClientRect(); c.width = Math.round(r.width * devicePixelRatio); c.height = Math.round(r.height * devicePixelRatio); const ctx = c.getContext('2d')!; ctx.scale(devicePixelRatio, devicePixelRatio); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111'; }, 0); }
  private pos(e: PointerEvent) { const c = this.pad!.nativeElement; const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  padDown(e: PointerEvent) { if (!this.pad) return; this.drawing = true; const ctx = this.pad.nativeElement.getContext('2d')!; const p = this.pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); this.pad.nativeElement.setPointerCapture(e.pointerId); }
  padMove(e: PointerEvent) { if (!this.drawing || !this.pad) return; const ctx = this.pad.nativeElement.getContext('2d')!; const p = this.pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); this.drew.set(true); }
  padUp() { this.drawing = false; }
  padClear() { const c = this.pad?.nativeElement; if (!c) return; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); this.drew.set(false); }
}
