import { Component, ElementRef, ViewChild, inject, signal, computed, AfterViewInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSliderModule } from '@angular/material/slider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ToastService } from '../../ui/toast.service';
import { RequisitionFormService, RequisitionSignature, RequisitionSignSlot, REQUISITION_SIGN_SLOTS } from '../../services/requisition-form.service';

export interface RequisitionPreviewData { req: any; }

/**
 * In-page preview of the Rocket Freight requisition form with Print / Save-as-PDF and
 * "Sign & submit": draw a signature, choose which box it goes in, size and nudge it with a
 * live preview on the form, then submit — it is stored as a tamper-evident electronic signature
 * (api/signatures, EntityType "Requisition") and rendered on every future print of this form.
 */
@Component({
  selector: 'app-requisition-preview-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatIconModule, MatButtonModule, MatTooltipModule, MatSliderModule, MatProgressSpinnerModule],
  template: `
  <div class="pv">
    <header class="pv__head">
      <mat-icon class="pv__icon">receipt_long</mat-icon>
      <div class="pv__title"><b>Requisition {{ data.req.rfNumber ? 'RF ' + data.req.rfNumber : '' }}</b><small>{{ data.req.paidTo }} · {{ data.req.financeStatus || 'Requested' }}@if (saved().length) { · {{ saved().length }} signature{{ saved().length === 1 ? '' : 's' }} }</small></div>
      <button mat-stroked-button type="button" (click)="print()"><mat-icon>picture_as_pdf</mat-icon> Print / Save as PDF</button>
      <button mat-flat-button color="primary" type="button" (click)="toggleSign()" [class.on]="signing()"><mat-icon>draw</mat-icon> {{ signing() ? 'Close signing' : 'Sign & submit' }}</button>
      <button mat-icon-button type="button" (click)="openTab()" matTooltip="Open in new tab"><mat-icon>open_in_new</mat-icon></button>
      <button mat-icon-button type="button" mat-dialog-close aria-label="Close"><mat-icon>close</mat-icon></button>
    </header>

    <div class="pv__main">
      <div class="pv__body">
        @if (loading()) { <div class="pv__spin"><mat-spinner diameter="36"></mat-spinner></div> }
        <iframe #frame [srcdoc]="html()" title="Requisition form"></iframe>
      </div>

      @if (signing()) {
      <aside class="sg">
        <h4><mat-icon>draw</mat-icon> Digital signature</h4>

        <div class="sg__step"><span class="n">1</span> Draw your signature</div>
        <div class="sg__pad" [class.has]="hasInk()">
          <canvas #pad width="520" height="180"
            (pointerdown)="penDown($event)" (pointermove)="penMove($event)" (pointerup)="penUp($event)" (pointerleave)="penUp($event)" (pointercancel)="penUp($event)"></canvas>
          @if (!hasInk()) { <span class="sg__hint">Sign here with mouse, finger or stylus</span> }
          <button mat-icon-button class="sg__clear" type="button" (click)="clearPad()" matTooltip="Clear" [disabled]="!hasInk()"><mat-icon>backspace</mat-icon></button>
        </div>

        <div class="sg__step"><span class="n">2</span> Where does it go?</div>
        <div class="sg__slots">
          @for (s of slots; track s.key) {
            <button type="button" class="sg__slot" [class.on]="slot() === s.key" [class.done]="isSigned(s.key)" (click)="slot.set(s.key); rerender()">
              <mat-icon>{{ isSigned(s.key) ? 'task_alt' : (slot() === s.key ? 'radio_button_checked' : 'radio_button_unchecked') }}</mat-icon>{{ s.label }}
            </button>
          }
        </div>
        @if (isSigned(slot())) { <p class="sg__warn"><mat-icon>info</mat-icon> This box is already signed — submitting will place a new signature over it.</p> }

        <div class="sg__step"><span class="n">3</span> Size &amp; position <small>(live on the form)</small></div>
        <label class="sg__ctl"><span>Size</span><mat-slider min="30" max="140" step="2" discrete><input matSliderThumb [(ngModel)]="size" (ngModelChange)="rerender()"></mat-slider><b>{{ size }}%</b></label>
        <label class="sg__ctl"><span>Left / right</span><mat-slider min="-50" max="50" step="1" discrete><input matSliderThumb [(ngModel)]="dx" (ngModelChange)="rerender()"></mat-slider><b>{{ dx }}</b></label>
        <label class="sg__ctl"><span>Up / down</span><mat-slider min="-30" max="80" step="1" discrete><input matSliderThumb [(ngModel)]="dy" (ngModelChange)="rerender()"></mat-slider><b>{{ dy }}</b></label>

        <div class="sg__step"><span class="n">4</span> Comment <small>(optional)</small></div>
        <input class="sg__comment" type="text" [(ngModel)]="comment" maxlength="300" placeholder="e.g. Approved for payment on 17 Nov">

        <div class="sg__actions">
          <button mat-flat-button color="primary" type="button" (click)="submit()" [disabled]="!hasInk() || saving()">
            @if (saving()) { <mat-spinner diameter="18"></mat-spinner> } @else { <mat-icon>verified</mat-icon> }
            Submit signature
          </button>
          <button mat-button type="button" (click)="toggleSign()" [disabled]="saving()">Cancel</button>
        </div>
        <p class="sg__legal">By submitting you confirm this is your signature and you intend to sign as <b>{{ slotLabel() }}</b>. Your name, time, IP and a hash of the requisition are recorded (ECT Act).</p>
      </aside>
      }
    </div>
  </div>
  `,
  styles: [`
    :host { display:block; }
    .pv { display:flex; flex-direction:column; height: 92vh; }
    .pv__head { display:flex; align-items:center; gap:10px; padding:10px 12px 10px 16px; border-bottom:1px solid var(--color-line); flex-wrap: wrap; }
    .pv__icon { color:#033142; }
    .pv__title { flex:1; min-width:160px; display:flex; flex-direction:column; b { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } small { color: var(--color-text-muted); font-size:.78rem; } }
    .pv__main { flex:1; min-height:0; display:flex; }
    .pv__body { flex:1; min-width:0; position:relative; background:#525659; display:flex; justify-content:center; overflow:auto; padding:16px;
      iframe { width:210mm; max-width:100%; height:297mm; border:0; background:#fff; box-shadow:0 6px 24px rgba(0,0,0,.4); flex-shrink:0; } }
    .pv__spin { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(82,86,89,.6); z-index:2; }
    button.on { background: #0b3d4d !important; }

    .sg { width: 340px; flex-shrink:0; border-left:1px solid var(--color-line); padding: 14px 16px; overflow:auto; display:flex; flex-direction:column; gap:10px; background: var(--color-surface, #fff); }
    .sg h4 { margin:0 0 4px; display:flex; align-items:center; gap:6px; font-size:1rem; }
    .sg__step { display:flex; align-items:center; gap:8px; font-weight:600; font-size:.86rem; margin-top:6px;
      .n { width:20px; height:20px; border-radius:50%; background:#033142; color:#fff; font-size:.72rem; display:inline-flex; align-items:center; justify-content:center; }
      small { font-weight:400; color: var(--color-text-muted); } }
    .sg__pad { position:relative; border:2px dashed #94a3b8; border-radius:10px; background:#fff; touch-action:none;
      &.has { border-style: solid; border-color:#033142; }
      canvas { display:block; width:100%; height:auto; border-radius:8px; cursor: crosshair; }
      .sg__hint { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:.85rem; pointer-events:none; }
      .sg__clear { position:absolute; right:2px; top:2px; } }
    .sg__slots { display:flex; flex-direction:column; gap:4px; }
    .sg__slot { display:flex; align-items:center; gap:8px; padding:7px 10px; border:1px solid var(--color-line); border-radius:8px; background:transparent; cursor:pointer; font: inherit; font-size:.86rem; text-align:left; color: inherit;
      mat-icon { font-size:18px; width:18px; height:18px; color:#64748b; }
      &.on { border-color:#033142; background: rgba(3,49,66,.06); mat-icon { color:#033142; } }
      &.done mat-icon { color:#2e7d32; } }
    .sg__warn { margin:0; display:flex; gap:6px; align-items:flex-start; font-size:.78rem; color:#b26a00; mat-icon { font-size:16px; width:16px; height:16px; } }
    .sg__ctl { display:grid; grid-template-columns: 76px 1fr 44px; align-items:center; gap:6px; font-size:.8rem; mat-slider { width:100%; min-width:0; } b { text-align:right; font-variant-numeric: tabular-nums; } }
    .sg__comment { font: inherit; font-size:.86rem; padding:8px 10px; border:1px solid var(--color-line); border-radius:8px; }
    .sg__actions { display:flex; gap:8px; margin-top:6px; button { display:inline-flex; align-items:center; gap:6px; } }
    .sg__legal { margin:0; font-size:.72rem; color: var(--color-text-muted); line-height:1.4; }
  `]
})
export class RequisitionPreviewDialogComponent implements AfterViewInit {
  private sanitizer = inject(DomSanitizer);
  private form = inject(RequisitionFormService);
  private toast = inject(ToastService);
  data = inject<RequisitionPreviewData>(MAT_DIALOG_DATA);
  @ViewChild('frame') frame?: ElementRef<HTMLIFrameElement>;
  @ViewChild('pad') pad?: ElementRef<HTMLCanvasElement>;

  slots = REQUISITION_SIGN_SLOTS;
  loading = signal(true);
  saving = signal(false);
  signing = signal(false);
  saved = signal<RequisitionSignature[]>([]);
  hasInk = signal(false);
  slot = signal<RequisitionSignSlot>('AuthorisedBy');
  size = 80; dx = 0; dy = 0; comment = '';
  html = signal<SafeHtml>(this.sanitizer.bypassSecurityTrustHtml(''));
  slotLabel = computed(() => this.slots.find(s => s.key === this.slot())?.label ?? '');

  static open(dialog: MatDialog, req: any) {
    return dialog.open(RequisitionPreviewDialogComponent, { width: 'min(1250px, 97vw)', maxWidth: '97vw', maxHeight: '96vh', data: { req }, autoFocus: false });
  }

  ngAfterViewInit(): void { this.reload(); }

  private reload(): void {
    this.loading.set(true);
    this.form.loadSignatures(this.data.req.id).subscribe(sigs => { this.saved.set(sigs); this.loading.set(false); this.rerender(); });
  }

  /** Form HTML (no toolbar / auto-print) with saved signatures + the pending one previewed live. */
  rerender(): void {
    let sigs = [...this.saved()];
    if (this.signing() && this.hasInk() && this.pad) {
      sigs = sigs.filter(s => s.slot !== this.slot());
      sigs.push({ slot: this.slot(), size: this.size, dx: this.dx, dy: this.dy, imageDataUrl: this.croppedPng(), signerName: 'You (preview)' });
    }
    const raw = this.form.html(this.data.req, false, sigs).replace('</style>', '.toolbar{display:none}</style>');
    this.html.set(this.sanitizer.bypassSecurityTrustHtml(raw));
  }

  isSigned(slot: RequisitionSignSlot): boolean { return this.saved().some(s => s.slot === slot); }

  toggleSign(): void {
    this.signing.update(v => !v);
    if (!this.signing()) { this.hasInk.set(false); }
    else { setTimeout(() => this.initPad()); }
    this.rerender();
  }

  // ── Signature pad ──
  private drawing = false; private last: { x: number; y: number } | null = null;
  private initPad(): void {
    const c = this.pad?.nativeElement; if (!c) return;
    const ctx = c.getContext('2d')!; ctx.clearRect(0, 0, c.width, c.height);
    ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0b1f5c';
    this.hasInk.set(false);
  }
  private pos(e: PointerEvent): { x: number; y: number } {
    const c = this.pad!.nativeElement; const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  }
  penDown(e: PointerEvent): void { if (!this.pad) return; this.pad.nativeElement.setPointerCapture(e.pointerId); this.drawing = true; this.last = this.pos(e); }
  penMove(e: PointerEvent): void {
    if (!this.drawing || !this.pad || !this.last) return;
    const ctx = this.pad.nativeElement.getContext('2d')!; const p = this.pos(e);
    ctx.beginPath(); ctx.moveTo(this.last.x, this.last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    this.last = p; if (!this.hasInk()) this.hasInk.set(true);
  }
  penUp(_e: PointerEvent): void { if (!this.drawing) return; this.drawing = false; this.last = null; this.rerender(); }
  clearPad(): void { this.initPad(); this.rerender(); }

  /** Crop the drawn strokes to their bounding box so the placed image has no dead space. */
  private croppedPng(): string {
    const c = this.pad!.nativeElement; const ctx = c.getContext('2d')!;
    const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 10) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
    if (maxX < 0) return c.toDataURL('image/png');
    const pad = 6, w = maxX - minX + 1 + pad * 2, h = maxY - minY + 1 + pad * 2;
    const out = document.createElement('canvas'); out.width = w; out.height = h;
    out.getContext('2d')!.drawImage(c, minX - pad, minY - pad, w, h, 0, 0, w, h);
    return out.toDataURL('image/png');
  }

  submit(): void {
    if (!this.hasInk() || this.saving()) return;
    this.saving.set(true);
    const sig: RequisitionSignature = { slot: this.slot(), size: this.size, dx: this.dx, dy: this.dy, imageDataUrl: this.croppedPng(), signerName: '' };
    this.form.saveSignature(this.data.req, sig, this.comment.trim() || undefined).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.done(`Signed as ${this.slotLabel()} — RF ${this.data.req.rfNumber || this.data.req.id}`);
        this.signing.set(false); this.hasInk.set(false); this.comment = '';
        this.reload();
      },
      error: (e) => { this.saving.set(false); this.toast.error(e?.error?.error || 'Could not save the signature'); }
    });
  }

  print(): void {
    const w = this.frame?.nativeElement.contentWindow;
    if (w) { w.focus(); w.print(); }
  }

  openTab(): void { this.form.open(this.data.req, false); }
}
