import { Component, ElementRef, OnInit, ViewChild, inject, input, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, QuoteFile, QuoteReq } from '../core/api';
import { AuthStore } from '../core/auth';

/**
 * A quotation request at the director step: compare the quotes, choose one and sign — or reject all with a reason.
 * The preparer and requester are e-mailed the outcome with the signed quote approval sheet.
 */
@Component({
  selector: 'app-quote',
  imports: [RouterLink, CurrencyPipe, DatePipe, FormsModule],
  template: `
    <a class="back" routerLink="/">‹ Back</a>
    @if (loading()) { <div class="spinner"></div> }
    @else if (error()) { <p class="err">{{ error() }}</p> }
    @else if (q(); as q) {
      <div class="card head">
        <div>
          <div class="muted sm">{{ q.company || 'Company not set' }} · {{ q.number }}</div>
          <h1>{{ q.subject }}</h1>
          <div class="muted sm">Requested by <b>{{ q.requestedBy }}</b>@if (q.department) { ({{ q.department }}) } · {{ q.submittedAt | date:'d MMM yyyy' }}</div>
          @if (q.preparedByName) { <div class="muted sm">Accepted by {{ q.preparedByName }}@if (q.accountantName) { · approved by {{ q.accountantName }} }</div> }
        </div>
        <span class="pill" [class.ok]="q.status === 'Approved'" [class.bad]="q.status === 'Rejected' || q.status === 'Declined'" [class.warn]="q.status === 'WithDirector'">{{ q.statusTitle }}</span>
      </div>

      @if (done()) {
        <div class="card ok-box"><div class="big">{{ q.status === 'Approved' ? '✓' : '✕' }}</div><h2>{{ done() }}</h2><p class="muted">The preparer and the requester have been e-mailed the signed quote approval sheet.</p>
          <div class="btns c"><button type="button" class="btn ghost" (click)="sheet()">📄 Quote approval sheet</button><a class="btn" routerLink="/">Back to my list</a></div></div>
      }

      @if (q.details) { <div class="card det">{{ q.details }}</div> }
      @if (q.fewerQuotesReason) { <p class="note">Fewer than three quotes: {{ q.fewerQuotesReason }}</p> }
      @if (q.accountantComment) { <p class="note info">Accountant ({{ q.accountantName }}): “{{ q.accountantComment }}”</p> }

      <h2 class="sec">The quotes</h2>
      <div class="quotes">
        @for (f of q.files; track f.id) {
          <label class="card qc" [class.on]="pick === f.id" [class.sel]="q.selectedFileId === f.id" [class.can]="canDecide()">
            @if (canDecide()) { <input type="radio" name="pick" [value]="f.id" [(ngModel)]="pick"> }
            <span class="qn">Quote {{ f.quoteNumber || $index + 1 }}@if (q.selectedFileId === f.id) { · selected } @if (isLowest(f)) { <i class="lo">lowest</i> }</span>
            <b class="sup">{{ f.supplier || 'Supplier not given' }}</b>
            <span class="amt">{{ f.amount != null ? (f.amount | currency:'ZAR':'R ':'1.2-2') : 'Amount not given' }}</span>
            <button type="button" class="btn ghost sm" (click)="view(f); $event.preventDefault()" [disabled]="pdfBusy()">📎 View quote</button>
          </label>
        } @empty { <p class="muted">No quotes attached.</p> }
      </div>

      @if (canDecide()) {
        <div class="card step">
          <h2>Your decision</h2>
          <p class="muted">Choose the quote to approve above and sign — or reject all of them with a reason. The preparer and requester get an e-mail with the signed approval sheet.</p>
          <label class="f">Comment <span class="muted sm">(required to reject all)</span><textarea [(ngModel)]="comment" placeholder="e.g. Best price and delivery included"></textarea></label>
          <div class="sigbox">
            <div class="modes">
              <button type="button" class="mode" [class.on]="sigMode() === 'saved'" (click)="sigMode.set('saved')" [disabled]="!hasSig()">My saved signature</button>
              <button type="button" class="mode" [class.on]="sigMode() === 'draw'" (click)="sigMode.set('draw'); setupPad()">Draw it now</button>
            </div>
            @if (sigMode() === 'saved') {
              @if (hasSig()) { <img class="saved" [src]="sigSrc()" alt="Your saved signature"> }
              @else { <p class="muted sm">No saved signature on your profile yet — draw one below.</p> }
            } @else {
              <canvas #pad class="pad" (pointerdown)="padDown($event)" (pointermove)="padMove($event)" (pointerup)="padUp()" (pointerleave)="padUp()"></canvas>
              <div class="padfoot"><span class="muted sm">{{ drew() ? 'Signature captured.' : 'Sign with your finger or mouse.' }}</span><button type="button" class="btn ghost sm" (click)="padClear()">Clear</button></div>
            }
          </div>
          <div class="btns">
            <button type="button" class="btn ok" (click)="decide('select')" [disabled]="busy() || !pick || !sigReady()">{{ busy() ? 'Signing…' : '✍️ Sign & approve ' + pickLabel() }}</button>
            <button type="button" class="btn bad" (click)="decide('reject')" [disabled]="busy() || !comment.trim() || !sigReady()">Sign &amp; reject all</button>
          </div>
        </div>
      }

      <div class="btns">
        <button type="button" class="btn ghost sm" (click)="sheet()" [disabled]="pdfBusy()">📄 Quote approval sheet</button>
      </div>

      @if (q.history.length) {
        <h2 class="sec">History</h2>
        <div class="card hist">@for (h of q.history.slice().reverse(); track $index) { <div class="ev"><span class="muted sm">{{ h.at | date:'d MMM HH:mm' }}</span> <b>{{ h.by }}</b> {{ actionText(h.action) }}@if (h.note) { <span class="muted"> — {{ h.note }}</span> }</div> }</div>
      }
    }
  `,
  styles: [`
    .back { display: inline-flex; align-items: center; gap: 4px; margin-bottom: 12px; padding: 6px 12px 6px 9px; border-radius: 999px; background: var(--card); border: 1px solid var(--line); box-shadow: var(--shadow-sm); text-decoration: none; font-weight: 600; font-size: 13.5px; color: var(--ink-2); }
    .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; background: linear-gradient(135deg, #faf5ff, #fff 60%); }
    h1 { margin: 2px 0 4px; font-size: 20px; } .sm { font-size: 13px; }
    @media (max-width: 560px) { .head { flex-direction: column-reverse; } }
    .det { white-space: pre-wrap; margin-bottom: 12px; font-size: 14.5px; }
    .note { margin: 0 0 12px; padding: 10px 12px; border-radius: 10px; background: var(--warn-bg); font-size: 14px; } .note.info { background: var(--bg); }
    .quotes { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px; margin-bottom: 14px; }
    .qc { position: relative; display: flex; flex-direction: column; gap: 4px; padding: 14px; border: 1.5px solid var(--line); }
    .qc.can { cursor: pointer; } .qc.can:hover { border-color: #a5b4fc; }
    .qc.on { border: 2px solid var(--brand); background: #eef2ff; } .qc.sel { border: 2px solid var(--ok); background: var(--ok-bg); }
    .qc input[type=radio] { position: absolute; top: 14px; right: 14px; width: 20px; height: 20px; accent-color: var(--brand); }
    .qn { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; font-weight: 700; color: var(--brand); } .lo { font-style: normal; text-transform: none; background: var(--ok-bg); color: var(--ok); border-radius: 999px; padding: 1px 7px; margin-left: 4px; }
    .sup { font-size: 16px; } .amt { font-weight: 800; font-size: 19px; letter-spacing: -.02em; margin-bottom: 6px; }
    .step h2 { margin: 0 0 6px; font-size: 18px; } .step p { margin: 0 0 12px; }
    textarea { min-height: 70px; }
    .sigbox { border: 1px dashed var(--line); border-radius: 12px; padding: 12px; margin: 12px 0 14px; }
    .modes { display: flex; gap: 6px; margin-bottom: 10px; } .mode { flex: 1; min-height: 40px; border-radius: 10px; border: 1px solid var(--line); background: #fff; cursor: pointer; } .mode.on { border-color: var(--brand); background: #eef2ff; color: var(--brand); font-weight: 600; } .mode:disabled { opacity: .5; }
    .saved { display: block; max-height: 90px; max-width: 100%; }
    .pad { width: 100%; height: 150px; border: 1px solid var(--line); border-radius: 10px; background: #fff; touch-action: none; display: block; } .padfoot { display: flex; justify-content: space-between; align-items: center; margin-top: 6px; }
    .btns { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; } .btns.c { justify-content: center; margin-top: 14px; }
    .ok-box { text-align: center; padding: 28px 20px; margin-bottom: 12px; } .big { font-size: 30px; width: 64px; height: 64px; display: grid; place-items: center; margin: 0 auto 6px; border-radius: 50%; background: var(--ok-bg); } .ok-box h2 { margin: 8px 0 4px; }
    .hist .ev { padding: 6px 0; border-bottom: 1px solid var(--line); font-size: 14px; } .hist .ev:last-child { border-bottom: 0; }
  `]
})
export class QuotePage implements OnInit {
  api = inject(Api); auth = inject(AuthStore);
  id = input.required<string>();
  q = signal<QuoteReq | null>(null); loading = signal(true); error = signal(''); busy = signal(false); pdfBusy = signal(false); done = signal('');
  pick: number | null = null; comment = '';
  sigMode = signal<'saved' | 'draw'>('saved'); hasSig = signal(false); sigSrc = signal(''); drew = signal(false);
  @ViewChild('pad') pad?: ElementRef<HTMLCanvasElement>;
  private drawing = false;

  canDecide() { const q = this.q(); return !!q && q.status === 'WithDirector' && !!q.can?.director && !this.done(); }
  sigReady() { return this.sigMode() === 'saved' ? this.hasSig() : this.drew(); }
  isLowest(f: QuoteFile) { const a = (this.q()?.files ?? []).map(x => x.amount).filter((x): x is number => x != null); return f.amount != null && a.length > 1 && f.amount === Math.min(...a); }
  pickLabel() { const f = this.q()?.files.find(x => x.id === this.pick); return f ? `quote ${f.quoteNumber}` : 'the chosen quote'; }
  actionText(a: string) {
    return ({ Submitted: 'submitted the request', QuoteAdded: 'added a quote', QuoteUpdated: 'edited a quote', QuoteRemoved: 'removed a quote', Accepted: 'accepted it (Creditors)',
      Declined: 'declined it', AccountantChanged: 'changed the accountant', AccountantSentBack: 'sent it back', AccountantApproved: 'approved it (accountant)',
      QuoteSelected: 'approved a quote', AllRejected: 'rejected all quotes' } as Record<string, string>)[a] ?? a;
  }

  ngOnInit() {
    const has = !!this.auth.user()?.hasSignature; this.hasSig.set(has); if (!has) this.sigMode.set('draw');
    if (has) this.api.blob(this.api.signatureUrl()).subscribe({ next: bl => this.sigSrc.set(URL.createObjectURL(bl)), error: () => { this.hasSig.set(false); this.sigMode.set('draw'); } });
    this.api.quote(Number(this.id())).subscribe({
      next: q => { this.q.set(q); this.loading.set(false); if (!q.can?.director && q.status === 'WithDirector') this.error.set(''); },
      error: e => { this.loading.set(false); this.error.set(e?.status === 404 ? 'This quotation request no longer exists.' : e?.status === 403 ? "You don't have access to this quotation request." : (e?.error?.message ?? "Couldn't load the quotation request.")); }
    });
  }

  view(f: QuoteFile) { this.pdfBusy.set(true); this.api.openPdf(this.api.quoteFileUrl(this.q()!.id, f.id), () => this.pdfBusy.set(false)); }
  sheet() { this.pdfBusy.set(true); this.api.openPdf(this.api.quoteSheetUrl(this.q()!.id), () => this.pdfBusy.set(false)); }

  decide(d: 'select' | 'reject') {
    const q = this.q()!;
    if (d === 'reject' && !confirm(`Reject all ${q.files.length} quotes? The preparer and requester will be e-mailed.`)) return;
    this.busy.set(true);
    const sig = this.sigMode() === 'draw' && this.drew() && this.pad ? { signatureImageBase64: this.pad.nativeElement.toDataURL('image/png'), useSavedSignature: false } : { useSavedSignature: true };
    this.api.quoteDirector(q.id, { decision: d, fileId: d === 'select' ? this.pick : null, comment: this.comment.trim() || undefined, ...sig }).subscribe({
      next: nq => { this.busy.set(false); this.q.set(nq); this.done.set(d === 'select' ? `Approved ${this.labelOf(nq)}` : 'All quotes rejected'); window.scrollTo({ top: 0, behavior: 'smooth' }); },
      error: e => { this.busy.set(false); alert(e?.error?.message ?? "Couldn't record your decision."); }
    });
  }
  private labelOf(q: QuoteReq) { const f = q.files.find(x => x.id === q.selectedFileId); return f ? `quote ${f.quoteNumber}: ${f.supplier || f.fileName}` : 'the quote'; }

  // ─── signature pad ───
  setupPad() { setTimeout(() => { const c = this.pad?.nativeElement; if (!c) return; const r = c.getBoundingClientRect(); c.width = Math.round(r.width * devicePixelRatio); c.height = Math.round(r.height * devicePixelRatio); const ctx = c.getContext('2d')!; ctx.scale(devicePixelRatio, devicePixelRatio); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111'; }, 0); }
  private pos(e: PointerEvent) { const c = this.pad!.nativeElement; const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  padDown(e: PointerEvent) { if (!this.pad) return; this.drawing = true; const ctx = this.pad.nativeElement.getContext('2d')!; const p = this.pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); this.pad.nativeElement.setPointerCapture(e.pointerId); }
  padMove(e: PointerEvent) { if (!this.drawing || !this.pad) return; const ctx = this.pad.nativeElement.getContext('2d')!; const p = this.pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); this.drew.set(true); }
  padUp() { this.drawing = false; }
  padClear() { const c = this.pad?.nativeElement; if (!c) return; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); this.drew.set(false); }
}
