import { Component, inject, signal, computed, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../ui/toast.service';
import { companyLogo, COMPANY_NAMES } from '../../core/company-logos';
import { Analysis, PACK_KINDS } from './pack-upload-dialog.component';

interface BPage {
  number: number; fileIndex: number; fileName: string; pageInFile: number;
  type: string; typeName: string; confidence: number;
  invoiceNumber: string | null; orderNumber: string | null; orderNumbers: string[]; confirmationNumber: string | null; customerNumber: string | null; supplier: string | null; date: string | null;
  textLength: number; continuation: boolean; reason: string | null; groups: number[];
  rotation: number; ocrConfidence: number; enhanced: boolean; hasImage: boolean; hasWords: boolean; thumb: string | null;
}
interface BFile { index: number; name: string; status: 'OK' | 'ERROR'; error: string | null; method: string; pageCount: number; firstPage: number; }
interface SageHit { company: string | null; customerNumber: string; customerName: string; date: string; total: number; lines: number; orderNumber: string | null; }
interface Word { t: string; c: number; x: number; y: number; w: number; h: number; }
/** Per-pack record as returned by the server (snake_case — it is the agreed export shape). */
interface PackRecord {
  pack_id: string; source_files: string[]; status: string; error?: string | null; confidence: string; needs_review: boolean;
  documents_found: string[]; documents_missing: string[]; doc_count: string;
  invoice_number: string | null; order_number: string | null; oc_number: string | null; customer_number: string | null; supplier: string | null; customer: string | null;
  lines: { item_number: string; description: string; qty_ordered: number | null; qty_shipped: number | null; qty_backorder: number | null; unit_price: number | null }[] | null;
  invoice_total: number | null; order_total: number | null; outstanding_value: number | null;
  hard_rules: Record<string, { result: 'pass' | 'fail'; title: string; detail: string }> | null; warnings: string[];
  pages: { page: number; file: string; page_in_file: number; type: string; rotation: number; confidence: number; shared: boolean }[];
}
interface BGroup {
  id: number; pages: number[];
  invoiceNumber: string; autoInvoice: string; orderNumber: string; confirmationNumber: string; customerNumber: string; customerName: string; supplier: string; company: string | null; notes: string;
  allowDuplicate: boolean; confidence: 'high' | 'medium' | 'low'; needsReview: boolean; reasons: string[]; analysis: Analysis | null; record: PackRecord | null;
  sage: SageHit | null; existingPacks: { id: number; packNumber: string }[];
  analysing: boolean; saved: any | null; error: string | null;
}
interface BatchResult {
  batchId: string; fileName: string; method: string; pageCount: number; files: BFile[]; pages: BPage[];
  groups: { index: number; pages: number[]; sharedPages: number[]; sourceFiles: string[]; invoiceNumber: string | null; orderNumber: string | null; confirmationNumber: string | null; customerNumber: string | null; supplier: string | null; confidence: 'high' | 'medium' | 'low'; needsReview: boolean; reasons: string[]; analysis: Analysis | null; company: string | null; record: PackRecord }[];
  unassigned: number[]; unassignedReasons: { page: number; reason: string | null }[]; splitLog: { page: number; file: string; pageInFile: number; type: string; placed: string; reason: string }[]; notes: string[]; ocrAvailable: boolean; pageTexts: string[];
}

/** One page tile in the splitter (thumbnail, page no., type, number read, shared badge). Placed directly inside a cdkDropList so CDK can find its parent list. */
@Component({
  selector: 'app-batch-page',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="bp" [class.sel]="selected" [class.unk]="page.type === 'UNK'" [class.faint]="page.textLength < 40" [class.shared]="shared" [matTooltip]="tip">
      <div class="bp__thumb">
        @if (page.thumb) { <img [src]="page.thumb" alt="" draggable="false" /> } @else { <mat-icon>description</mat-icon> }
      </div>
      <span class="bp__no" [matTooltip]="page.fileName + ' · page ' + page.pageInFile">{{ page.number }}</span>
      <span class="bp__type" [class.unk]="page.type === 'UNK'">{{ page.type === 'UNK' ? '?' : page.type }}</span>
      @if (shared) { <span class="bp__shared"><mat-icon>link</mat-icon> shared</span> }
      @if (page.rotation) { <span class="bp__rot" matTooltip="Rotated upright for reading"><mat-icon>rotate_right</mat-icon></span> }
      @if (page.invoiceNumber || page.orderNumber || page.confirmationNumber) { <span class="bp__num">{{ page.invoiceNumber || page.orderNumber || page.confirmationNumber }}</span> }
    </div>
    <ng-content></ng-content>
  `,
  styles: [`
    :host { display:block; flex:0 0 104px; width:104px; cursor:grab; user-select:none; &:active { cursor:grabbing; } }
    .bp { position:relative; height:100%; min-height:130px; border:2px solid var(--color-line); border-radius:10px; background: var(--color-surface); overflow:hidden; display:flex; flex-direction:column;
      &.sel { border-color: var(--color-primary); box-shadow:0 0 0 2px rgba(79,70,229,.2); } &.unk { border-style:dashed; } &.faint .bp__thumb { opacity:.5; } &.shared { border-color:#0ea5e9; } }
    .bp__thumb { flex:1; min-height:100px; background:#e5e7eb; display:grid; place-items:center; overflow:hidden; img { width:100%; height:100%; object-fit:cover; object-position:top; display:block; } mat-icon { color:#9ca3af; font-size:32px; width:32px; height:32px; } }
    .bp__no { position:absolute; top:4px; left:4px; background:rgba(17,24,39,.8); color:#fff; font-size:.68rem; font-weight:800; padding:1px 6px; border-radius:999px; }
    .bp__type { position:absolute; top:4px; right:4px; min-width:30px; text-align:center; font-weight:800; font-size:.68rem; padding:1px 5px; border-radius:6px; background: var(--color-primary-soft); color: var(--color-primary); &.unk { background:#f3f4f6; color:#9ca3af; } }
    .bp__shared { position:absolute; bottom:22px; left:4px; display:inline-flex; align-items:center; gap:2px; background:#0ea5e9; color:#fff; font-size:.6rem; font-weight:800; padding:1px 5px; border-radius:999px; mat-icon { font-size:11px; width:11px; height:11px; } }
    .bp__rot { position:absolute; bottom:22px; right:4px; color:#fff; background:rgba(17,24,39,.6); border-radius:50%; width:16px; height:16px; display:grid; place-items:center; mat-icon { font-size:12px; width:12px; height:12px; } }
    .bp__num { font-family: ui-monospace, Menlo, Consolas, monospace; font-size:.66rem; padding:3px 4px; text-align:center; background: var(--color-surface); border-top:1px solid var(--color-line); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  `]
})
export class BatchPageComponent {
  @Input({ required: true }) page!: BPage;
  @Input() selected = false;
  @Input() shared = false;
  get tip(): string {
    const p = this.page;
    return [p.typeName, p.invoiceNumber, p.orderNumber, p.confirmationNumber].filter(Boolean).join(' · ') + (p.reason ? ' — ' + p.reason : '');
  }
}

/**
 * Batch upload: one or many scans (PDF / JPG / PNG) that together hold several invoice packs. The server reads
 * and classifies every page and proposes one pack per invoice (supporting paperwork attached by order number and
 * shared where one order was invoiced twice); the user drags pages between packs, fixes numbers, reviews the
 * summary table and saves them all. Nothing is dropped — unplaced pages stay in the tray with a reason.
 */
@Component({
  selector: 'app-pack-batch-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatIconModule, MatButtonModule, MatTooltipModule, MatProgressSpinnerModule, DragDropModule, BatchPageComponent],
  template: `
  <div class="bt">
    <header class="bt__head">
      <mat-icon class="bt__hicon">call_split</mat-icon>
      <div class="bt__title">
        <h2>Batch upload — split into packs</h2>
        <p>Drop one or many scans → every page is read, grouped one pack per invoice, you check the summary and save them all.</p>
      </div>
      @if (result(); as r) {
        <div class="bt__meta"><b>{{ r.fileName }}</b><small>{{ r.pageCount }} pages · {{ groups.length }} pack(s) · {{ unassigned.length }} unplaced{{ r.method === 'ocr' ? ' · OCR' : '' }}@if (fileErrors().length) { · <span class="bt__bad">{{ fileErrors().length }} file error(s)</span> }</small></div>
        <div class="bt__tabs">
          <button type="button" [class.on]="view() === 'arrange'" (click)="view.set('arrange')"><mat-icon>view_agenda</mat-icon> Arrange</button>
          <button type="button" [class.on]="view() === 'summary'" (click)="view.set('summary')"><mat-icon>table_chart</mat-icon> Summary</button>
        </div>
      }
      <button mat-icon-button type="button" (click)="close()" aria-label="Close"><mat-icon>close</mat-icon></button>
    </header>

    <!-- ───── step 1: files ───── -->
    @if (!result()) {
      <div class="bt__start">
        @if (!busy()) {
          <label class="bt__drop" [class.drag]="dragging()" (dragover)="$event.preventDefault(); dragging.set(true)" (dragleave)="dragging.set(false)" (drop)="onDrop($event)">
            <input type="file" hidden multiple accept=".pdf,.jpg,.jpeg,.png" (change)="onPick($event)" />
            <mat-icon>upload_file</mat-icon>
            <b>Drop the scans here</b>
            <span>PDF, JPG or PNG · as many files as you like · up to 200 pages per batch</span>
          </label>
          @if (pending.length) {
            <div class="bt__pending">
              <ul>@for (f of pending; track f.name + f.size) { <li><mat-icon>{{ f.type.includes('pdf') ? 'picture_as_pdf' : 'image' }}</mat-icon><span>{{ f.name }}</span><small>{{ f.size / 1048576 | number:'1.1-1' }} MB</small><button mat-icon-button type="button" (click)="removePending(f)"><mat-icon>close</mat-icon></button></li> }</ul>
              <button mat-flat-button color="primary" type="button" (click)="start()"><mat-icon>play_arrow</mat-icon> Read {{ pending.length }} file{{ pending.length === 1 ? '' : 's' }}</button>
            </div>
          }
          <ul class="bt__how">
            <li><mat-icon>document_scanner</mat-icon> Pages are straightened, OCR'd (faint pages get a contrast boost) and classified: delivery note, tax invoice, order confirmation, e-mail, official order.</li>
            <li><mat-icon>hub</mat-icon> One pack per invoice number. Order confirmations, e-mails and official orders attach by order number — to every pack with that order, marked <i>shared</i>.</li>
            <li><mat-icon>drag_indicator</mat-icon> Where the split is wrong, drag pages between packs or into the unplaced tray; review the summary table; save — one pack per group.</li>
          </ul>
        } @else {
          <div class="bt__busy">
            <mat-spinner diameter="40"></mat-spinner>
            <b>Reading {{ fileName() }}…</b>
            <span>Files are read in parallel; each page is rotated upright, OCR'd and classified. A big batch can take a few minutes — leave this open.</span>
          </div>
        }
        @if (error()) { <div class="bt__err"><mat-icon>error</mat-icon> {{ error() }}</div> }
      </div>
    }

    <!-- ───── step 2: arrange ───── -->
    @if (result(); as r) {
      @if (view() === 'arrange') {
      <div class="bt__body" cdkDropListGroup>
        <section class="bt__groups">
          @if (fileErrors().length) {
            <div class="bt__ferr">
              <mat-icon>error</mat-icon>
              <div>@for (f of fileErrors(); track f.index) { <div><b>{{ f.name }}</b> — {{ f.error }}</div> }<small>The other files were processed normally.</small></div>
            </div>
          }
          <!-- unplaced tray -->
          <div class="bt__tray" [class.empty]="!unassigned.length">
            <div class="bt__trayhead">
              <mat-icon>inbox</mat-icon><b>Unplaced pages</b>
              <small>{{ unassigned.length ? 'Nothing is dropped — drag these into the pack they belong to. Unplaced pages are not saved.' : 'Drop a page here to leave it out.' }}</small>
            </div>
            <div class="bt__strip bt__strip--tray" cdkDropList [cdkDropListData]="unassigned" cdkDropListOrientation="horizontal" (cdkDropListDropped)="drop($event, null)">
              @for (n of unassigned; track n) {
                <app-batch-page cdkDrag [cdkDragData]="n" [page]="page(n)" [selected]="selPageNo() === n" (click)="selectPage(n); $event.stopPropagation()"><div class="bt__ghost" *cdkDragPlaceholder></div></app-batch-page>
              }
            </div>
          </div>

          @for (g of groups; track g.id; let gi = $index) {
            <div class="bt__group" [class.saved]="g.saved" [class.failed]="g.error" [class.sel]="selGroup() === g.id" (click)="selGroup.set(g.id)">
              <div class="bt__ghead">
                <span class="bt__gno">{{ gi + 1 }}</span>
                <div class="bt__ginv">
                  <input class="bt__input bt__input--inv" [(ngModel)]="g.invoiceNumber" (ngModelChange)="g.error = null" placeholder="IN123456" [disabled]="!!g.saved" spellcheck="false" aria-label="Invoice number" />
                  @if (g.invoiceNumber && !invValid(g)) { <small class="bt__bad">IN + 5–7 digits</small> }
                  @else if (g.sage) { <small class="bt__ok"><mat-icon>check_circle</mat-icon> In Sage · {{ g.sage.customerName }} · R {{ g.sage.total | number:'1.2-2' }}</small> }
                  @else if (invValid(g)) { <small class="bt__muted">Not in Sage yet</small> }
                </div>
                <span class="bt__badge" [class]="'bt__badge ' + badge(g)" [matTooltip]="badgeTip(g)"><mat-icon>{{ badge(g) === 'green' ? 'check_circle' : badge(g) === 'amber' ? 'warning_amber' : 'cancel' }}</mat-icon>{{ badgeLabel(g) }}</span>
                <span class="bt__conf" [class]="'bt__conf ' + g.confidence" [matTooltip]="g.reasons.join(' ')">{{ g.confidence === 'high' ? 'Sure' : g.confidence === 'medium' ? 'Probably' : 'Check' }}</span>
                @if (g.orderNumber) { <span class="bt__ord mono" matTooltip="Order number">{{ g.orderNumber }}</span> }
                @if (g.supplier) { <span class="bt__sup" matTooltip="Supplier">{{ g.supplier }}</span> }
                @if (g.analysing) { <mat-spinner diameter="16"></mat-spinner> }
                <span class="bt__sp"></span>
                <div class="bt__cos">
                  @for (c of companyCodes; track c) { <button type="button" class="bt__co" [class.on]="g.company === c" (click)="g.company = c; $event.stopPropagation()" [matTooltip]="companyNames[c]" [disabled]="!!g.saved"><img [src]="logo(c)" [alt]="c" /></button> }
                </div>
                <button mat-icon-button type="button" (click)="toggleDetails(g); $event.stopPropagation()" [matTooltip]="details.has(g.id) ? 'Hide details' : 'Order / customer / notes'"><mat-icon>{{ details.has(g.id) ? 'expand_less' : 'expand_more' }}</mat-icon></button>
                <button mat-icon-button type="button" (click)="removeGroup(gi); $event.stopPropagation()" matTooltip="Dissolve this pack (pages go to unplaced)" [disabled]="!!g.saved"><mat-icon>playlist_remove</mat-icon></button>
              </div>

              @if (details.has(g.id)) {
                <div class="bt__gdetails" (click)="$event.stopPropagation()">
                  <label>Order no.<input class="bt__input mono" [(ngModel)]="g.orderNumber" placeholder="PT-ORD/26-07-36872" [disabled]="!!g.saved" /></label>
                  <label>Confirmation<input class="bt__input mono" [(ngModel)]="g.confirmationNumber" placeholder="ORD107038" [disabled]="!!g.saved" /></label>
                  <label>Customer no.<input class="bt__input mono" [(ngModel)]="g.customerNumber" placeholder="04-BLO-001" [disabled]="!!g.saved" /></label>
                  <label>Customer<input class="bt__input" [(ngModel)]="g.customerName" placeholder="Customer" [disabled]="!!g.saved" /></label>
                  <label class="wide">Notes<input class="bt__input" [(ngModel)]="g.notes" placeholder="Optional" [disabled]="!!g.saved" /></label>
                </div>
              }

              <div class="bt__strip" cdkDropList [cdkDropListData]="g.pages" cdkDropListOrientation="horizontal" (cdkDropListDropped)="drop($event, g)" [cdkDropListDisabled]="!!g.saved">
                @for (n of g.pages; track n) {
                  <app-batch-page cdkDrag [cdkDragData]="n" [page]="page(n)" [selected]="selPageNo() === n" [shared]="isShared(n)" (click)="selectPage(n); $event.stopPropagation()"><div class="bt__ghost" *cdkDragPlaceholder></div></app-batch-page>
                }
                @if (!g.pages.length) { <div class="bt__emptystrip">Drop pages here</div> }
              </div>

              <div class="bt__gfoot">
                <div class="bt__kinds" [matTooltip]="'Documents found: ' + docCount(g)">
                  @for (k of kinds; track k.key) { <mat-icon [class.on]="hasKind(g, k.code)" [matTooltip]="k.label">{{ k.icon }}</mat-icon> }
                </div>
                @if (g.record?.invoice_total != null) { <small class="bt__why"><mat-icon>receipt_long</mat-icon>Invoice R {{ g.record!.invoice_total | number:'1.2-2' }}</small> }
                @if (g.record?.outstanding_value) { <small class="bt__why warn"><mat-icon>pending_actions</mat-icon>Outstanding R {{ g.record!.outstanding_value | number:'1.2-2' }}</small> }
                @for (why of g.reasons; track why) { <small class="bt__why"><mat-icon>info</mat-icon>{{ why }}</small> }
                @if (g.existingPacks.length && !g.saved) {
                  <small class="bt__why warn"><mat-icon>warning_amber</mat-icon>A pack already exists for {{ g.invoiceNumber }} ({{ g.existingPacks[0].packNumber }}).
                    <label class="bt__cb"><input type="checkbox" [(ngModel)]="g.allowDuplicate" /> Add anyway</label></small>
                }
                @if (g.saved) { <small class="bt__why ok"><mat-icon>check_circle</mat-icon>Saved as {{ g.saved.packNumber }} · {{ g.saved.originalFileName }}</small> }
                @if (g.error) { <small class="bt__why bad"><mat-icon>error</mat-icon>{{ g.error }}</small> }
              </div>
            </div>
          }

          <button type="button" class="bt__newgroup" (click)="addGroup()"><mat-icon>add</mat-icon> New pack (then drag pages into it)</button>
        </section>

        <!-- page viewer + what we read -->
        <aside class="bt__aside">
          @if (selPage(); as p) {
            <div class="bt__ahead"><b>Page {{ p.number }}</b><span class="bt__ptype" [class.unk]="p.type === 'UNK'">{{ p.type === 'UNK' ? '?' : p.type }}</span><small>{{ p.typeName }}</small>
              <span class="bt__sp"></span>
              <small class="bt__muted">{{ p.fileName }} · p{{ p.pageInFile }}</small>
              <button mat-icon-button type="button" (click)="toggleBig()" [matTooltip]="bigPreview() ? 'Show thumbnail' : 'Open full page with highlights'"><mat-icon>{{ bigPreview() ? 'photo' : 'zoom_in' }}</mat-icon></button>
            </div>
            <div class="bt__apreview" [class.big]="bigPreview()">
              @if (bigPreview()) {
                @if (imgUrl()) {
                  <div class="bt__viewer">
                    <img [src]="imgUrl()!" alt="" (load)="imgLoaded.set(true)" />
                    @if (showWords()) { @for (w of highlights(); track $index) { <span class="bt__hl" [class]="'bt__hl ' + w.kind" [style.left.%]="w.x * 100" [style.top.%]="w.y * 100" [style.width.%]="w.w * 100" [style.height.%]="w.h * 100" [matTooltip]="w.label + ' · ' + w.t + ' (' + (w.c * 100 | number:'1.0-0') + '%)'"></span> } }
                  </div>
                } @else if (imgLoading()) { <mat-spinner diameter="28"></mat-spinner> }
                @else { <div class="bt__nothumb"><mat-icon>image_not_supported</mat-icon><span>No preview for this page</span></div> }
              }
              @else if (p.thumb) { <img [src]="p.thumb" alt="" /> }
              @else { <div class="bt__nothumb"><mat-icon>image_not_supported</mat-icon><span>No preview</span></div> }
            </div>
            @if (bigPreview() && imgUrl()) {
              <div class="bt__legend">
                <label class="bt__cb"><input type="checkbox" [(ngModel)]="wordsOn" /> Highlight extracted fields</label>
                <span class="bt__lg inv">invoice</span><span class="bt__lg ord">order</span><span class="bt__lg conf">confirmation</span><span class="bt__lg cust">customer</span>
                @if (!p.hasWords) { <small class="bt__muted">(no word positions — text-layer PDF)</small> }
              </div>
            }
            <dl class="bt__dl">
              <dt>Invoice</dt><dd class="mono">{{ p.invoiceNumber || '—' }}</dd>
              <dt>Order</dt><dd class="mono">{{ p.orderNumbers.length ? p.orderNumbers.join(', ') : (p.orderNumber || '—') }}</dd>
              <dt>Confirmation</dt><dd class="mono">{{ p.confirmationNumber || '—' }}</dd>
              <dt>Customer</dt><dd class="mono">{{ p.customerNumber || '—' }}</dd>
              <dt>Supplier</dt><dd>{{ p.supplier || '—' }}</dd>
              <dt>Date</dt><dd>{{ p.date || '—' }}</dd>
              <dt>Placed because</dt><dd>{{ p.reason || '—' }}</dd>
              <dt>Read quality</dt><dd>{{ p.textLength < 40 ? 'almost none — faint or image-only page' : p.textLength + ' chars' + (p.ocrConfidence ? ' · ' + (p.ocrConfidence * 100 | number:'1.0-0') + '% confidence' : '') + (p.rotation ? ' · rotated ' + p.rotation + '°' : '') + (p.enhanced ? ' · contrast boosted' : '') }}</dd>
            </dl>
            <div class="bt__moveto">
              <small>Move to:</small>
              @for (g of groups; track g.id; let gi = $index) { @if (!g.pages.includes(p.number) && !g.saved) { <button type="button" class="bt__chip" (click)="moveTo(p.number, g)">Pack {{ gi + 1 }}{{ g.invoiceNumber ? ' · ' + g.invoiceNumber : '' }}</button> } }
              @if (!unassigned.includes(p.number)) { <button type="button" class="bt__chip" (click)="moveTo(p.number, null)">Unplaced</button> }
            </div>
            @if (p.type === 'OC' || p.type === 'EML' || p.type === 'PO') {
              <div class="bt__moveto">
                <small>Also share with:</small>
                @for (g of groups; track g.id; let gi = $index) { @if (!g.pages.includes(p.number) && !g.saved) { <button type="button" class="bt__chip share" (click)="shareWith(p.number, g)"><mat-icon>link</mat-icon>Pack {{ gi + 1 }}{{ g.invoiceNumber ? ' · ' + g.invoiceNumber : '' }}</button> } }
              </div>
            }
          } @else {
            <div class="bt__ahint"><mat-icon>touch_app</mat-icon><p>Click a page to see it here with what was read on it, why it was placed where it is, and the fields highlighted on the page. Drag pages to re-arrange.</p>
              @for (n of r.notes; track n) { <small>{{ n }}</small> }</div>
          }
        </aside>
      </div>
      } @else {
      <!-- ───── summary table ───── -->
      <div class="bt__summary">
        <div class="bt__sumbar">
          <b>{{ groups.length }} pack(s)</b><small>· {{ unassigned.length }} unplaced page(s) · {{ r.files.length }} file(s)</small>
          <span class="bt__sp"></span>
          <button mat-stroked-button type="button" (click)="exportCsv()"><mat-icon>download</mat-icon> Export CSV</button>
          <button mat-stroked-button type="button" (click)="exportLog()"><mat-icon>list_alt</mat-icon> Split log</button>
        </div>
        <div class="bt__tablewrap">
          <table class="bt__table">
            <thead><tr><th>Pack</th><th>Status</th><th>Invoice</th><th>Order</th><th>Confirmation</th><th>Supplier</th><th>Docs</th><th>Missing</th><th>Pages</th><th>Source files</th><th class="num">Invoice total</th><th class="num">Outstanding</th><th>Reasons</th></tr></thead>
            <tbody>
              @for (g of groups; track g.id; let gi = $index) {
                <tr [class.saved]="g.saved" (click)="view.set('arrange'); selGroup.set(g.id)">
                  <td><b>{{ g.saved?.packNumber || ('Pack ' + (gi + 1)) }}</b></td>
                  <td><span class="bt__badge" [class]="'bt__badge ' + badge(g)"><mat-icon>{{ badge(g) === 'green' ? 'check_circle' : badge(g) === 'amber' ? 'warning_amber' : 'cancel' }}</mat-icon>{{ badgeLabel(g) }}</span></td>
                  <td class="mono">{{ g.invoiceNumber || '—' }}</td>
                  <td class="mono">{{ g.orderNumber || '—' }}</td>
                  <td class="mono">{{ g.confirmationNumber || '—' }}</td>
                  <td>{{ g.supplier || '—' }}</td>
                  <td>{{ docCount(g) }}</td>
                  <td><small>{{ missing(g).join(', ') || '—' }}</small></td>
                  <td>{{ g.pages.join(', ') }}</td>
                  <td><small>{{ sourceFiles(g).join(', ') }}</small></td>
                  <td class="num">{{ g.record?.invoice_total != null ? (g.record!.invoice_total | number:'1.2-2') : '—' }}</td>
                  <td class="num">{{ g.record?.outstanding_value ? (g.record!.outstanding_value | number:'1.2-2') : '—' }}</td>
                  <td><small>{{ reasonsText(g) }}</small></td>
                </tr>
              }
              @if (unassigned.length) {
                <tr class="un"><td><b>Unassigned</b></td><td><span class="bt__badge red"><mat-icon>help</mat-icon>UNASSIGNED</span></td><td colspan="6"></td><td>{{ unassigned.join(', ') }}</td><td colspan="3"></td>
                  <td><small>@for (u of r.unassignedReasons; track u.page) { p{{ u.page }}: {{ u.reason }}; }</small></td></tr>
              }
            </tbody>
          </table>
        </div>
        @if (r.files.length > 1 || fileErrors().length) {
          <div class="bt__files">
            @for (f of r.files; track f.index) { <span class="bt__file" [class.err]="f.status === 'ERROR'"><mat-icon>{{ f.status === 'ERROR' ? 'error' : 'check_circle' }}</mat-icon>{{ f.name }} <small>· {{ f.status === 'ERROR' ? f.error : f.pageCount + ' page(s), ' + f.method }}</small></span> }
          </div>
        }
      </div>
      }

      <footer class="bt__foot">
        <div class="bt__status">
          @if (saving()) { <mat-spinner diameter="16"></mat-spinner> Saving packs… }
          @else if (error()) { <span class="bt__bad"><mat-icon>error</mat-icon> {{ error() }}</span> }
          @else if (allSaved()) { <mat-icon class="bt__ok">check_circle</mat-icon> All packs saved. }
          @else if (!readyCount()) { <mat-icon>info</mat-icon> Give each pack a valid invoice number and a company. }
          @else { <mat-icon>check_circle</mat-icon> {{ readyCount() }} of {{ pendingGroups().length }} pack(s) ready{{ unassigned.length ? ' · ' + unassigned.length + ' unplaced page(s) will not be saved' : '' }}. }
        </div>
        <button mat-button type="button" (click)="close()">{{ allSaved() ? 'Done' : 'Cancel' }}</button>
        <button mat-stroked-button type="button" (click)="reanalyseAll()" [disabled]="saving() || anyAnalysing()" matTooltip="Re-run the checks on every pack after moving pages"><mat-icon>refresh</mat-icon> Re-check</button>
        <button mat-flat-button color="primary" type="button" [disabled]="!readyCount() || saving() || anyAnalysing()" (click)="save()">
          <mat-icon>save</mat-icon> Save {{ readyCount() }} pack{{ readyCount() === 1 ? '' : 's' }}
        </button>
      </footer>
    }
  </div>
  `,
  styles: [`
    :host { display:block; }
    .mono { font-family: ui-monospace, Menlo, Consolas, monospace; letter-spacing:.03em; }
    .bt { display:flex; flex-direction:column; height: min(94vh, 980px); }
    .bt__head { display:flex; align-items:center; gap:14px; padding:12px 18px; border-bottom:1px solid var(--color-line); }
    .bt__hicon { color: var(--color-primary); font-size:28px; width:28px; height:28px; }
    .bt__title { flex:1; min-width:0; h2 { margin:0; font-size:1.05rem; } p { margin:2px 0 0; font-size:.78rem; color: var(--color-text-muted); } }
    .bt__meta { display:flex; flex-direction:column; align-items:flex-end; font-size:.82rem; b { max-width:320px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } small { color: var(--color-text-muted); } }
    .bt__tabs { display:inline-flex; border:1px solid var(--color-line); border-radius:999px; overflow:hidden; button { display:inline-flex; align-items:center; gap:4px; font: inherit; font-size:.8rem; font-weight:700; padding:6px 12px; border:0; background:transparent; color: var(--color-text-muted); cursor:pointer; mat-icon { font-size:16px; width:16px; height:16px; } &.on { background: var(--color-primary); color:#fff; } } }
    .bt__sp { flex:1; }

    .bt__start { flex:1; overflow:auto; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:18px; padding:24px; }
    .bt__drop { display:flex; flex-direction:column; align-items:center; gap:4px; padding:36px 48px; border:2px dashed var(--color-line); border-radius:16px; cursor:pointer; text-align:center; color: var(--color-text-muted); background: var(--color-surface); width:min(600px, 100%);
      mat-icon { font-size:44px; width:44px; height:44px; color: var(--color-primary); margin-bottom:6px; } b { color: var(--color-text); font-size:1.05rem; } span { font-size:.8rem; }
      &:hover, &.drag { border-color: var(--color-primary); background: var(--color-primary-soft); } }
    .bt__pending { width:min(600px, 100%); display:flex; flex-direction:column; gap:10px; align-items:flex-end; ul { list-style:none; margin:0; padding:0; width:100%; display:flex; flex-direction:column; gap:4px; max-height:200px; overflow:auto; }
      li { display:flex; align-items:center; gap:8px; padding:4px 8px; border:1px solid var(--color-line); border-radius:8px; font-size:.84rem; span { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; } small { color: var(--color-text-muted); } mat-icon { color: var(--color-primary); font-size:18px; width:18px; height:18px; } } }
    .bt__how { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; width:min(600px, 100%); font-size:.86rem; color: var(--color-text-muted);
      li { display:flex; gap:10px; align-items:flex-start; mat-icon { color: var(--color-primary); font-size:20px; width:20px; height:20px; flex:0 0 auto; } } }
    .bt__busy { display:flex; flex-direction:column; align-items:center; gap:10px; text-align:center; color: var(--color-text-muted); max-width:460px; b { color: var(--color-text); } span { font-size:.84rem; } }
    .bt__err { display:flex; align-items:center; gap:6px; color:#b91c1c; font-size:.88rem; }
    .bt__ferr { display:flex; gap:10px; align-items:flex-start; padding:10px 12px; border:1px solid #fecaca; background:#fef2f2; border-radius:12px; font-size:.84rem; color:#991b1b; mat-icon { flex:0 0 auto; } small { color:#b91c1c; opacity:.8; } }

    .bt__body { flex:1; min-height:0; display:grid; grid-template-columns: minmax(0, 1fr) 380px; }
    .bt__groups { overflow:auto; padding:14px 16px; display:flex; flex-direction:column; gap:12px; background: var(--color-surface-2, #fafafa); }
    .bt__aside { border-left:1px solid var(--color-line); overflow:auto; padding:12px 14px; display:flex; flex-direction:column; gap:10px; }

    .bt__tray { border:1px dashed var(--color-line); border-radius:12px; padding:8px 10px; background: var(--color-surface); &.empty { opacity:.75; } }
    .bt__trayhead { display:flex; align-items:center; gap:8px; font-size:.84rem; margin-bottom:6px; mat-icon { font-size:18px; width:18px; height:18px; color: var(--color-text-muted); } small { color: var(--color-text-muted); } }

    .bt__group { border:1px solid var(--color-line); border-radius:14px; background: var(--color-surface); padding:10px 12px; transition: box-shadow .15s, border-color .15s;
      &.sel { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(79,70,229,.12); } &.saved { border-color:#10b981; background:#f0fdf4; } &.failed { border-color:#ef4444; } }
    .bt__ghead { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .bt__gno { width:26px; height:26px; border-radius:50%; background: var(--color-primary); color:#fff; display:grid; place-items:center; font-size:.8rem; font-weight:800; flex:0 0 26px; }
    .bt__ginv { display:flex; flex-direction:column; gap:2px; min-width:200px; small { font-size:.72rem; display:inline-flex; align-items:center; gap:3px; mat-icon { font-size:14px; width:14px; height:14px; } } }
    .bt__input { font: inherit; font-size:.88rem; padding:6px 9px; border:1px solid var(--color-line); border-radius:8px; background: var(--color-surface); color: inherit; &:focus { outline:2px solid var(--color-primary); outline-offset:-1px; }
      &--inv { font-family: ui-monospace, Menlo, Consolas, monospace; font-weight:800; font-size:1rem; text-transform:uppercase; letter-spacing:.05em; width:180px; } }
    .bt__ok { color:#065f46; } .bt__bad { color:#b91c1c; display:inline-flex; align-items:center; gap:4px; } .bt__muted { color: var(--color-text-muted); }
    .bt__badge { display:inline-flex; align-items:center; gap:3px; font-size:.7rem; font-weight:800; padding:3px 8px 3px 5px; border-radius:999px; background:#f3f4f6; color:#6b7280; mat-icon { font-size:14px; width:14px; height:14px; }
      &.green { background:#ecfdf5; color:#065f46; } &.amber { background:#fffbeb; color:#92400e; } &.red { background:#fef2f2; color:#991b1b; } }
    .bt__conf { font-size:.7rem; font-weight:800; text-transform:uppercase; letter-spacing:.04em; padding:3px 8px; border-radius:999px; background:#f3f4f6; color:#6b7280;
      &.high { background:#ecfdf5; color:#065f46; } &.medium { background:#fffbeb; color:#92400e; } &.low { background:#fef2f2; color:#991b1b; } }
    .bt__ord { font-size:.76rem; padding:3px 8px; border-radius:6px; background: var(--color-surface-2, #f3f4f6); }
    .bt__sup { font-size:.74rem; padding:3px 8px; border-radius:6px; border:1px solid var(--color-line); color: var(--color-text-muted); }
    .bt__cos { display:flex; gap:4px; }
    .bt__co { width:30px; height:30px; padding:0; border-radius:50%; border:2px solid transparent; background:transparent; cursor:pointer; opacity:.45; img { width:100%; height:100%; border-radius:50%; object-fit:cover; display:block; }
      &.on { border-color: var(--color-primary); opacity:1; } &:hover { opacity:1; } &:disabled { cursor:default; } }
    .bt__gdetails { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap:8px; margin-top:10px; label { display:flex; flex-direction:column; gap:3px; font-size:.7rem; font-weight:700; color: var(--color-text-muted); text-transform:uppercase; letter-spacing:.04em; &.wide { grid-column: 1 / -1; } } }

    .bt__strip { display:flex; gap:8px; overflow-x:auto; padding:8px 2px; min-height:150px; align-items:stretch; &--tray { min-height:70px; } }
    .bt__emptystrip { flex:1; display:grid; place-items:center; border:2px dashed var(--color-line); border-radius:10px; color: var(--color-text-muted); font-size:.82rem; min-height:120px; }
    .bt__ghost { flex:0 0 104px; width:104px; min-height:130px; border:2px dashed var(--color-primary); border-radius:10px; background: var(--color-primary-soft); }
    .cdk-drag-preview { box-shadow: 0 8px 24px rgba(0,0,0,.25); border-radius:10px; }
    .cdk-drag-animating { transition: transform 200ms cubic-bezier(0,0,.2,1); }

    .bt__gfoot { display:flex; flex-wrap:wrap; align-items:center; gap:6px 14px; margin-top:4px; }
    .bt__kinds { display:inline-flex; gap:2px; padding:3px 6px; border-radius:999px; background: var(--color-surface-2, #f3f4f6); mat-icon { font-size:16px; width:16px; height:16px; color:#cbd5e1; &.on { color:#059669; } } }
    .bt__why { display:inline-flex; align-items:center; gap:4px; font-size:.75rem; color: var(--color-text-muted); mat-icon { font-size:14px; width:14px; height:14px; } &.warn { color:#92400e; } &.ok { color:#065f46; } &.bad { color:#b91c1c; } }
    .bt__cb { display:inline-flex; align-items:center; gap:4px; margin-left:6px; font-weight:700; cursor:pointer; font-size:.76rem; }
    .bt__newgroup { display:flex; align-items:center; justify-content:center; gap:6px; padding:12px; border:2px dashed var(--color-line); border-radius:14px; background:transparent; font: inherit; font-weight:600; color: var(--color-text-muted); cursor:pointer; &:hover { border-color: var(--color-primary); color: var(--color-primary); } }

    .bt__ahead { display:flex; align-items:center; gap:8px; flex-wrap:wrap; b { font-size:.95rem; } small { color: var(--color-text-muted); } }
    .bt__ptype { display:inline-block; min-width:30px; text-align:center; font-weight:800; font-size:.68rem; padding:1px 5px; border-radius:6px; background: var(--color-primary-soft); color: var(--color-primary); &.unk { background:#f3f4f6; color:#9ca3af; } }
    .bt__apreview { border:1px solid var(--color-line); border-radius:10px; overflow:auto; background:#525659; min-height:300px; display:flex; align-items:flex-start; justify-content:center; img { width:100%; display:block; } &.big { max-height:60vh; } }
    .bt__viewer { position:relative; width:100%; img { width:100%; display:block; } }
    .bt__hl { position:absolute; border:2px solid; border-radius:3px; pointer-events:auto; box-sizing:border-box; &.inv { border-color:#10b981; background:rgba(16,185,129,.22); } &.ord { border-color:#6366f1; background:rgba(99,102,241,.22); } &.conf { border-color:#f59e0b; background:rgba(245,158,11,.22); } &.cust { border-color:#ec4899; background:rgba(236,72,153,.22); } }
    .bt__legend { display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:.74rem; }
    .bt__lg { padding:1px 7px; border-radius:999px; border:2px solid; &.inv { border-color:#10b981; } &.ord { border-color:#6366f1; } &.conf { border-color:#f59e0b; } &.cust { border-color:#ec4899; } }
    .bt__nothumb { display:flex; flex-direction:column; align-items:center; gap:6px; color:#d1d5db; padding:40px; mat-icon { font-size:36px; width:36px; height:36px; } }
    .bt__dl { display:grid; grid-template-columns: auto 1fr; gap:4px 12px; margin:0; font-size:.82rem; dt { color: var(--color-text-muted); } dd { margin:0; } }
    .bt__moveto { display:flex; flex-wrap:wrap; align-items:center; gap:6px; small { color: var(--color-text-muted); } }
    .bt__chip { display:inline-flex; align-items:center; gap:3px; font: inherit; font-size:.76rem; padding:4px 10px; border-radius:999px; border:1px solid var(--color-line); background: var(--color-surface); cursor:pointer; mat-icon { font-size:14px; width:14px; height:14px; } &:hover { border-color: var(--color-primary); color: var(--color-primary); } &.share { border-color:#bae6fd; color:#0369a1; } }
    .bt__ahint { display:flex; flex-direction:column; align-items:center; gap:8px; text-align:center; padding:32px 10px; color: var(--color-text-muted); mat-icon { font-size:36px; width:36px; height:36px; color: var(--color-primary); } p { margin:0; font-size:.88rem; } small { font-size:.78rem; } }

    .bt__summary { flex:1; min-height:0; display:flex; flex-direction:column; gap:10px; padding:14px 16px; overflow:hidden; }
    .bt__sumbar { display:flex; align-items:center; gap:8px; small { color: var(--color-text-muted); } }
    .bt__tablewrap { flex:1; overflow:auto; border:1px solid var(--color-line); border-radius:12px; }
    .bt__table { width:100%; border-collapse:collapse; font-size:.8rem; th, td { padding:7px 10px; border-bottom:1px solid var(--color-line); text-align:left; vertical-align:top; white-space:nowrap; } th { position:sticky; top:0; background: var(--color-surface-2, #f3f4f6); font-size:.7rem; text-transform:uppercase; letter-spacing:.04em; color: var(--color-text-muted); }
      td.num, th.num { text-align:right; font-variant-numeric: tabular-nums; } td small { white-space:normal; display:block; max-width:360px; } tbody tr { cursor:pointer; &:hover { background: var(--color-primary-soft); } &.saved { background:#f0fdf4; } &.un { background:#fff7ed; } } }
    .bt__files { display:flex; flex-wrap:wrap; gap:6px; }
    .bt__file { display:inline-flex; align-items:center; gap:4px; font-size:.76rem; padding:3px 10px; border-radius:999px; border:1px solid var(--color-line); mat-icon { font-size:14px; width:14px; height:14px; color:#059669; } small { color: var(--color-text-muted); } &.err { border-color:#fecaca; background:#fef2f2; mat-icon { color:#dc2626; } } }

    .bt__foot { display:flex; align-items:center; gap:10px; padding:10px 18px; border-top:1px solid var(--color-line); .bt__status { flex:1; display:flex; align-items:center; gap:6px; font-size:.86rem; color: var(--color-text-muted); mat-icon { font-size:18px; width:18px; height:18px; } } }
    @media (max-width: 980px) { .bt__body { grid-template-columns: 1fr; } .bt__aside { display:none; } .bt__gdetails { grid-template-columns: repeat(2, minmax(0,1fr)); } }
  `]
})
export class PackBatchDialogComponent implements OnDestroy {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private ref = inject(MatDialogRef<PackBatchDialogComponent>);
  private api = environment.apiUrl;

  static open(dialog: MatDialog) {
    return dialog.open(PackBatchDialogComponent, { width: 'min(1500px, 97vw)', maxWidth: '97vw', maxHeight: '96vh', panelClass: 'pack-dialog-panel', disableClose: true, autoFocus: false });
  }

  kinds = PACK_KINDS;
  companyCodes = ['PMT', 'ACM', 'PHT', 'SBT'];
  companyNames = COMPANY_NAMES;
  logo = companyLogo;

  dragging = signal(false);
  busy = signal(false);
  saving = signal(false);
  error = signal('');
  fileName = signal('');
  result = signal<BatchResult | null>(null);
  view = signal<'arrange' | 'summary'>('arrange');
  bigPreview = signal(false);
  selPageNo = signal<number | null>(null);
  selGroup = signal<number | null>(null);
  imgUrl = signal<string | null>(null);
  imgLoading = signal(false);
  imgLoaded = signal(false);
  words = signal<Word[]>([]);
  wordsOn = true;
  showWords = () => this.wordsOn && this.imgLoaded();
  details = new Set<number>();

  pending: File[] = [];
  groups: BGroup[] = [];
  unassigned: number[] = [];
  private pagesByNo = new Map<number, BPage>();
  private nextId = 1;
  private savedAny = false;
  private imgCache = new Map<number, string>();

  selPage = computed(() => { const n = this.selPageNo(); return n == null ? null : this.pagesByNo.get(n) ?? null; });
  fileErrors = computed(() => (this.result()?.files ?? []).filter(f => f.status === 'ERROR'));
  pendingGroups = () => this.groups.filter(g => !g.saved && g.pages.length > 0);
  readyCount = () => this.pendingGroups().filter(g => this.invValid(g) && !!g.company && !(g.existingPacks.length && !g.allowDuplicate)).length;
  allSaved = () => this.groups.length > 0 && this.groups.every(g => g.saved || g.pages.length === 0);
  anyAnalysing = () => this.groups.some(g => g.analysing);

  /** Words on the open page that belong to an extracted field, for the overlay. */
  highlights = computed(() => {
    const p = this.selPage(); const ws = this.words(); if (!p || !ws.length) return [] as (Word & { kind: string; label: string })[];
    const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const targets: { kind: string; label: string; v: string }[] = [];
    if (p.invoiceNumber) targets.push({ kind: 'inv', label: 'Invoice', v: norm(p.invoiceNumber) });
    for (const o of (p.orderNumbers.length ? p.orderNumbers : p.orderNumber ? [p.orderNumber] : [])) targets.push({ kind: 'ord', label: 'Order', v: norm(o) });
    if (p.confirmationNumber) targets.push({ kind: 'conf', label: 'Confirmation', v: norm(p.confirmationNumber) });
    if (p.customerNumber) targets.push({ kind: 'cust', label: 'Customer', v: norm(p.customerNumber) });
    const out: (Word & { kind: string; label: string })[] = [];
    for (let i = 0; i < ws.length; i++) {
      const w1 = norm(ws[i].t); if (!w1) continue;
      for (const t of targets) {
        // Whole token, or the digits-only tail of a long order (PT-ORD/26-07-36872 → "36872"), or two adjacent tokens ("IN" "148281").
        if (w1 === t.v || (t.v.length >= 8 && w1.length >= 5 && t.v.endsWith(w1) && /^\d+$/.test(w1)) || (w1.length >= 5 && t.v.includes(w1) && w1.length >= t.v.length * 0.6)) { out.push({ ...ws[i], kind: t.kind, label: t.label }); break; }
        if (i + 1 < ws.length && norm(ws[i].t + ws[i + 1].t) === t.v) { out.push({ ...ws[i], kind: t.kind, label: t.label }); out.push({ ...ws[i + 1], kind: t.kind, label: t.label }); break; }
      }
    }
    return out;
  });

  page(n: number): BPage { return this.pagesByNo.get(n) ?? { number: n, fileIndex: 0, fileName: '', pageInFile: n, type: 'UNK', typeName: 'Unrecognised', confidence: 0, invoiceNumber: null, orderNumber: null, orderNumbers: [], confirmationNumber: null, customerNumber: null, supplier: null, date: null, textLength: 0, continuation: false, reason: null, groups: [], rotation: 0, ocrConfidence: 0, enhanced: false, hasImage: false, hasWords: false, thumb: null }; }
  invValid(g: BGroup): boolean { return /^IN\d{5,7}$/.test(this.normalize(g.invoiceNumber)); }
  private normalize(v: string): string { return (v ?? '').toUpperCase().replace(/[\s\-_.:#]/g, ''); }
  hasKind(g: BGroup, code: string): boolean { return g.pages.some(n => this.page(n).type === code); }
  isShared(n: number): boolean { return this.groups.filter(g => g.pages.includes(n)).length > 1; }
  docCount(g: BGroup): string { const f = new Set(g.pages.map(n => this.page(n).type).filter(t => t !== 'UNK')); return `${f.size} of 5`; }
  missing(g: BGroup): string[] { const f = new Set(g.pages.map(n => this.page(n).type)); return ['DN', 'INV', 'OC', 'EML', 'PO'].filter(t => !f.has(t)); }
  sourceFiles(g: BGroup): string[] { return [...new Set(g.pages.map(n => this.page(n).fileName))]; }
  reasonsText(g: BGroup): string { return [g.error, ...g.reasons, ...(g.analysis?.warnings ?? [])].filter(Boolean).join(' · '); }
  toggleDetails(g: BGroup): void { if (this.details.has(g.id)) this.details.delete(g.id); else this.details.add(g.id); }

  /** Red / amber / green per pack: red = failed or cannot save; amber = review / missing docs / low confidence; green = PASS and sure. */
  badge(g: BGroup): 'red' | 'amber' | 'green' {
    if (g.error) return 'red';
    const s = g.analysis?.status;
    if (s === 'FAIL' || !this.invValid(g)) return 'red';
    if (s === 'PASS' && g.confidence !== 'low' && !g.needsReview && !this.missing(g).length) return 'green';
    return 'amber';
  }
  badgeLabel(g: BGroup): string { if (g.error) return 'ERROR'; if (!this.invValid(g)) return 'NO INVOICE'; return g.analysis?.status ?? 'UNKNOWN'; }
  badgeTip(g: BGroup): string { const a = g.analysis; return (a ? a.rules.map(r => `${r.pass ? '✓' : '✗'} ${r.code} ${r.detail}`).concat(a.warnings.map(w => `⚠ ${w}`)) : []).concat(g.reasons.map(r => `• ${r}`)).join('\n'); }

  // ───── page viewer ─────
  selectPage(n: number): void { this.selPageNo.set(n); if (this.bigPreview()) this.loadImage(n); }
  toggleBig(): void { this.bigPreview.set(!this.bigPreview()); const n = this.selPageNo(); if (this.bigPreview() && n != null) this.loadImage(n); }
  private async loadImage(n: number): Promise<void> {
    const r = this.result(); if (!r) return;
    this.words.set([]); this.imgLoaded.set(false);
    const p = this.page(n);
    if (!p.hasImage) { this.imgUrl.set(null); return; }
    const cached = this.imgCache.get(n);
    if (cached) this.imgUrl.set(cached);
    else {
      this.imgUrl.set(null); this.imgLoading.set(true);
      try {
        const blob = await firstValueFrom(this.http.get(`${this.api}/finance/packs/batch/${r.batchId}/page/${n}/image`, { responseType: 'blob' }));
        const url = URL.createObjectURL(blob); this.imgCache.set(n, url);
        if (this.selPageNo() === n) this.imgUrl.set(url);
      } catch { this.imgUrl.set(null); }
      finally { this.imgLoading.set(false); }
    }
    if (p.hasWords) {
      try { const w = await firstValueFrom(this.http.get<{ words: Word[] }>(`${this.api}/finance/packs/batch/${r.batchId}/page/${n}/words`)); if (this.selPageNo() === n) this.words.set(w.words ?? []); } catch { /* overlay is optional */ }
    }
  }

  // ───── files ─────
  onDrop(e: DragEvent): void { e.preventDefault(); this.dragging.set(false); this.addFiles(Array.from(e.dataTransfer?.files ?? [])); }
  onPick(e: Event): void { const input = e.target as HTMLInputElement; this.addFiles(Array.from(input.files ?? [])); input.value = ''; }
  removePending(f: File): void { this.pending = this.pending.filter(x => x !== f); }
  private addFiles(files: File[]): void {
    const ok = files.filter(f => /\.(pdf|jpe?g|png)$/i.test(f.name));
    if (ok.length < files.length) this.toast.warn('Only PDF, JPG or PNG files are accepted.');
    for (const f of ok) if (!this.pending.some(p => p.name === f.name && p.size === f.size)) this.pending.push(f);
    // One drop with a single PDF → start straight away, the common case.
    if (this.pending.length === 1 && ok.length === 1 && /\.pdf$/i.test(ok[0].name) && files.length === 1) this.start();
  }

  async start(): Promise<void> {
    if (!this.pending.length) return;
    const files = this.pending;
    this.busy.set(true); this.error.set(''); this.fileName.set(files.length === 1 ? files[0].name : `${files.length} files`);
    try {
      const form = new FormData(); for (const f of files) form.append('files', f, f.name);
      const r = await firstValueFrom(this.http.post<BatchResult>(`${this.api}/finance/packs/batch`, form));
      this.result.set(r);
      this.pagesByNo = new Map(r.pages.map(p => [p.number, p]));
      this.groups = r.groups.map(g => this.makeGroup(g.pages, g.invoiceNumber, g.orderNumber, g.confirmationNumber, g.customerNumber, g.supplier, g.company, g.confidence, g.needsReview, g.reasons, g.analysis, g.record));
      this.unassigned = [...r.unassigned];
      if (this.groups.length) this.selGroup.set(this.groups[0].id);
      for (const g of this.groups) if (this.invValid(g)) this.lookup(g);
      if (!r.ocrAvailable && r.method === 'none') this.toast.warn('OCR is not available on the server — pages could not be read. Group them by hand.');
      if (r.files.some(f => f.status === 'ERROR')) this.toast.warn(`${r.files.filter(f => f.status === 'ERROR').length} file(s) could not be read — see the red note at the top.`);
      this.pending = [];
    } catch (e: any) {
      this.error.set(e?.error?.error || 'The files could not be processed.');
    } finally { this.busy.set(false); }
  }

  private makeGroup(pages: number[], inv: string | null, ord: string | null, conf: string | null, cust: string | null, sup: string | null, company: string | null, confidence: 'high' | 'medium' | 'low', needsReview: boolean, reasons: string[], analysis: Analysis | null, record: PackRecord | null): BGroup {
    return { id: this.nextId++, pages: [...pages], invoiceNumber: inv ?? '', autoInvoice: inv ?? '', orderNumber: ord ?? '', confirmationNumber: conf ?? '', customerNumber: cust ?? '', customerName: '', supplier: sup ?? '', company, notes: '', allowDuplicate: false, confidence, needsReview, reasons, analysis, record, sage: null, existingPacks: [], analysing: false, saved: null, error: null };
  }

  private async lookup(g: BGroup): Promise<void> {
    const inv = this.normalize(g.invoiceNumber); if (!/^IN\d{5,7}$/.test(inv)) return;
    try {
      const r = await firstValueFrom(this.http.get<any>(`${this.api}/finance/packs/lookup/${encodeURIComponent(inv)}`, { params: g.company ? { company: g.company } : {} }));
      g.sage = r.sage ?? null; g.existingPacks = r.existingPacks ?? [];
      if (r.sage) { g.company ||= r.sage.company; g.customerNumber ||= r.sage.customerNumber; g.customerName ||= r.sage.customerName; g.orderNumber ||= r.sage.orderNumber ?? ''; }
    } catch { /* non-fatal */ }
  }

  // ───── arranging ─────
  drop(e: CdkDragDrop<number[]>, target: BGroup | null): void {
    if (e.previousContainer === e.container) moveItemInArray(e.container.data, e.previousIndex, e.currentIndex);
    else {
      const n = e.previousContainer.data[e.previousIndex];
      if (e.container.data.includes(n)) { e.previousContainer.data.splice(e.previousIndex, 1); } // already shared into the target — just un-share from the source
      else transferArrayItem(e.previousContainer.data, e.container.data, e.previousIndex, e.currentIndex);
    }
    const src = this.groups.find(g => g.pages === e.previousContainer.data) ?? null;
    this.afterMove(src, target);
  }

  moveTo(n: number, target: BGroup | null): void {
    const src = this.groups.find(g => g.pages.includes(n)) ?? null;
    if (src) src.pages.splice(src.pages.indexOf(n), 1); else this.unassigned.splice(this.unassigned.indexOf(n), 1);
    const dest = target ? target.pages : this.unassigned;
    if (!dest.includes(n)) { const at = dest.findIndex(x => x > n); dest.splice(at < 0 ? dest.length : at, 0, n); }
    this.afterMove(src, target);
  }

  /** Copy a supporting page into another pack as well (same order invoiced twice). */
  shareWith(n: number, target: BGroup): void {
    if (target.pages.includes(n)) return;
    const i = this.unassigned.indexOf(n); if (i >= 0) this.unassigned.splice(i, 1);
    const at = target.pages.findIndex(x => x > n); target.pages.splice(at < 0 ? target.pages.length : at, 0, n);
    this.afterMove(null, target);
  }

  private afterMove(src: BGroup | null, dest: BGroup | null): void {
    for (const g of [src, dest]) if (g) { g.error = null; g.saved = null; this.reanalyse(g); }
  }

  addGroup(): void { const g = this.makeGroup([], null, null, null, null, null, null, 'low', false, ['Drag pages in, then enter the invoice number.'], null, null); this.groups.push(g); this.selGroup.set(g.id); }
  removeGroup(i: number): void { const g = this.groups[i]; for (const n of g.pages) if (!this.unassigned.includes(n) && !this.groups.some((o, oi) => oi !== i && o.pages.includes(n))) this.unassigned.push(n); this.unassigned.sort((a, b) => a - b); this.groups.splice(i, 1); }

  private async reanalyse(g: BGroup): Promise<void> {
    const r = this.result(); if (!r) return;
    if (!g.pages.length) { g.analysis = null; g.record = null; g.reasons = ['Empty — drag pages in or remove it.']; g.confidence = 'low'; return; }
    g.analysing = true;
    try {
      const a = await firstValueFrom(this.http.post<any>(`${this.api}/finance/packs/batch/${r.batchId}/analyse`, g.pages));
      g.analysis = a.analysis ?? null; g.record = a.record ?? null;
      if (a.invoiceNumber && (!g.invoiceNumber || g.invoiceNumber === g.autoInvoice)) { g.invoiceNumber = a.invoiceNumber; g.autoInvoice = a.invoiceNumber; }
      g.orderNumber ||= a.orderNumber ?? ''; g.confirmationNumber ||= a.confirmationNumber ?? ''; g.customerNumber ||= a.customerNumber ?? ''; g.supplier ||= a.supplier ?? '';
      g.company ||= a.company ?? null;
      g.sage = a.sage ?? g.sage; g.existingPacks = a.existingPacks ?? [];
      if (a.sage) { g.customerName ||= a.sage.customerName; g.customerNumber ||= a.sage.customerNumber; }
      const types = new Set(g.pages.map(n => this.page(n).type).filter(t => t !== 'UNK'));
      const invs = new Set(g.pages.map(n => this.page(n).invoiceNumber).filter(Boolean));
      g.reasons = []; g.needsReview = false;
      if (invs.size > 1) { g.reasons.push('Pages carry different invoice numbers: ' + [...invs].join(', ') + '.'); g.needsReview = true; }
      if (!g.invoiceNumber) g.reasons.push('No invoice number could be read — type it in.');
      if (this.sourceFiles(g).length > 1) g.reasons.push(`Pack spans ${this.sourceFiles(g).length} files.`);
      g.confidence = invs.size <= 1 && !!g.invoiceNumber && types.size >= 3 ? 'high' : invs.size <= 1 && (!!g.invoiceNumber || types.size >= 2) ? 'medium' : 'low';
    } catch (e: any) { this.toast.warn(e?.error?.error || 'Re-check failed for a pack.'); }
    finally { g.analysing = false; }
  }

  reanalyseAll(): void { for (const g of this.groups) if (!g.saved) this.reanalyse(g); }

  // ───── export ─────
  private csvRows(): string[][] {
    const r = this.result()!;
    const head = ['Pack', 'Status', 'Confidence', 'Invoice', 'Order', 'Confirmation', 'Customer no', 'Supplier', 'Company', 'Docs found', 'Missing', 'Pages', 'Shared pages', 'Source files', 'Invoice total', 'Order total', 'Outstanding', 'H1', 'H2', 'H3', 'Reasons / warnings'];
    const rows = this.groups.map((g, gi) => {
      const hr = g.record?.hard_rules ?? {};
      return [g.saved?.packNumber || `Pack ${gi + 1}`, this.badgeLabel(g), g.confidence, g.invoiceNumber, g.orderNumber, g.confirmationNumber, g.customerNumber, g.supplier, g.company ?? '', this.docCount(g), this.missing(g).join(' '), g.pages.join(' '), g.pages.filter(n => this.isShared(n)).join(' '), this.sourceFiles(g).join('; '),
        g.record?.invoice_total?.toFixed(2) ?? '', g.record?.order_total?.toFixed(2) ?? '', g.record?.outstanding_value?.toFixed(2) ?? '', hr['H1']?.result ?? '', hr['H2']?.result ?? '', hr['H3']?.result ?? '', [g.error, ...g.reasons, ...(g.analysis?.warnings ?? [])].filter(Boolean).join(' | ')];
    });
    for (const u of r.unassignedReasons) rows.push(['UNASSIGNED', 'UNASSIGNED', '', '', '', '', '', '', '', '', '', String(u.page), '', this.page(u.page).fileName, '', '', '', '', '', '', u.reason ?? '']);
    return [head, ...rows];
  }
  exportCsv(): void { this.download(this.csvRows(), `batch-summary-${new Date().toISOString().slice(0, 10)}.csv`); }
  exportLog(): void {
    const r = this.result()!;
    const rows: string[][] = [['Page', 'File', 'Page in file', 'Type', 'Placed', 'Reason']];
    for (const p of r.pages) { const gs = this.groups.map((g, gi) => g.pages.includes(p.number) ? `Pack ${gi + 1}${g.invoiceNumber ? ' (' + g.invoiceNumber + ')' : ''}` : '').filter(Boolean); rows.push([String(p.number), p.fileName, String(p.pageInFile), p.type, gs.join(' + ') || 'UNASSIGNED', p.reason ?? '']); }
    this.download(rows, `batch-split-log-${new Date().toISOString().slice(0, 10)}.csv`);
  }
  private download(rows: string[][], name: string): void {
    const esc = (v: string) => /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    const blob = new Blob(['\ufeff' + rows.map(r => r.map(v => esc(v ?? '')).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // ───── save ─────
  async save(): Promise<void> {
    const r = this.result(); if (!r || this.saving()) return;
    const todo = this.pendingGroups().filter(g => this.invValid(g) && !!g.company && !(g.existingPacks.length && !g.allowDuplicate));
    if (!todo.length) return;
    this.saving.set(true); this.error.set('');
    try {
      const body = { groups: todo.map(g => ({ pages: g.pages, sharedPages: g.pages.filter(n => this.isShared(n)), invoiceNumber: this.normalize(g.invoiceNumber), orderNumber: g.orderNumber || null, confirmationNumber: g.confirmationNumber || null, customerNumber: g.customerNumber || null, customerName: g.customerName || null, company: g.company, notes: g.notes || null, allowDuplicate: g.allowDuplicate })) };
      const res = await firstValueFrom(this.http.post<{ saved: { index: number; pack: any }[]; errors: { index: number; error: string }[]; records: PackRecord[]; batchKept: boolean }>(`${this.api}/finance/packs/batch/${r.batchId}/commit`, body));
      for (const s of res.saved) { todo[s.index].saved = s.pack; todo[s.index].error = null; this.savedAny = true; }
      for (const e of res.errors) todo[e.index].error = e.error;
      for (const rec of res.records ?? []) { const g = todo.find(x => x.saved?.packNumber === rec.pack_id); if (g) g.record = rec; }
      if (res.saved.length) this.toast.info(`${res.saved.length} pack(s) saved${res.errors.length ? `, ${res.errors.length} need attention` : ''}.`);
      if (res.errors.length) this.view.set('summary');
      if (!res.batchKept && this.allSaved()) { this.ref.close(true); }
    } catch (e: any) { this.error.set(e?.error?.error || 'Saving failed.'); }
    finally { this.saving.set(false); }
  }

  close(): void {
    const r = this.result();
    if (r && !this.allSaved() && !this.savedAny) this.http.delete(`${this.api}/finance/packs/batch/${r.batchId}`).subscribe({ error: () => {} });
    this.ref.close(this.savedAny);
  }

  ngOnDestroy(): void { for (const u of this.imgCache.values()) URL.revokeObjectURL(u); }
}
