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
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../ui/toast.service';
import { companyLogo, COMPANY_NAMES } from '../../core/company-logos';
import { Analysis, PACK_KINDS } from './pack-upload-dialog.component';

interface BPage {
  number: number; type: string; typeName: string; confidence: number;
  invoiceNumber: string | null; orderNumber: string | null; confirmationNumber: string | null; customerNumber: string | null; date: string | null;
  textLength: number; continuation: boolean; reason: string | null; thumb: string | null;
}
interface SageHit { company: string | null; customerNumber: string; customerName: string; date: string; total: number; lines: number; orderNumber: string | null; }
interface BGroup {
  id: number; pages: number[];
  invoiceNumber: string; autoInvoice: string; orderNumber: string; confirmationNumber: string; customerNumber: string; customerName: string; company: string | null; notes: string;
  allowDuplicate: boolean; confidence: 'high' | 'medium' | 'low'; reasons: string[]; analysis: Analysis | null;
  sage: SageHit | null; existingPacks: { id: number; packNumber: string }[];
  analysing: boolean; saved: any | null; error: string | null;
}
interface BatchResult {
  batchId: string; fileName: string; method: string; pageCount: number; pages: BPage[];
  groups: { index: number; pages: number[]; invoiceNumber: string | null; orderNumber: string | null; confirmationNumber: string | null; customerNumber: string | null; confidence: 'high' | 'medium' | 'low'; reasons: string[]; analysis: Analysis | null; company: string | null }[];
  unassigned: number[]; notes: string[]; ocrAvailable: boolean; pageTexts: string[];
}

/** One page tile in the splitter (thumbnail, page no., type, number read). Placed directly inside a cdkDropList so CDK can find its parent list. */
@Component({
  selector: 'app-batch-page',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  template: `
    <div class="bp" [class.sel]="selected" [class.unk]="page.type === 'UNK'" [class.faint]="page.textLength < 40" [matTooltip]="tip">
      <div class="bp__thumb">
        @if (page.thumb) { <img [src]="page.thumb" alt="" draggable="false" /> } @else { <mat-icon>description</mat-icon> }
      </div>
      <span class="bp__no">{{ page.number }}</span>
      <span class="bp__type" [class.unk]="page.type === 'UNK'">{{ page.type === 'UNK' ? '?' : page.type }}</span>
      @if (page.invoiceNumber || page.orderNumber || page.confirmationNumber) { <span class="bp__num">{{ page.invoiceNumber || page.orderNumber || page.confirmationNumber }}</span> }
    </div>
    <ng-content></ng-content>
  `,
  styles: [`
    :host { display:block; flex:0 0 104px; width:104px; cursor:grab; user-select:none; &:active { cursor:grabbing; } }
    .bp { position:relative; height:100%; min-height:130px; border:2px solid var(--color-line); border-radius:10px; background: var(--color-surface); overflow:hidden; display:flex; flex-direction:column;
      &.sel { border-color: var(--color-primary); box-shadow:0 0 0 2px rgba(79,70,229,.2); } &.unk { border-style:dashed; } &.faint .bp__thumb { opacity:.5; } }
    .bp__thumb { flex:1; min-height:100px; background:#e5e7eb; display:grid; place-items:center; overflow:hidden; img { width:100%; height:100%; object-fit:cover; object-position:top; display:block; } mat-icon { color:#9ca3af; font-size:32px; width:32px; height:32px; } }
    .bp__no { position:absolute; top:4px; left:4px; background:rgba(17,24,39,.8); color:#fff; font-size:.68rem; font-weight:800; padding:1px 6px; border-radius:999px; }
    .bp__type { position:absolute; top:4px; right:4px; min-width:30px; text-align:center; font-weight:800; font-size:.68rem; padding:1px 5px; border-radius:6px; background: var(--color-primary-soft); color: var(--color-primary); &.unk { background:#f3f4f6; color:#9ca3af; } }
    .bp__num { font-family: ui-monospace, Menlo, Consolas, monospace; font-size:.66rem; padding:3px 4px; text-align:center; background: var(--color-surface); border-top:1px solid var(--color-line); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  `]
})
export class BatchPageComponent {
  @Input({ required: true }) page!: BPage;
  @Input() selected = false;
  get tip(): string {
    const p = this.page;
    return [p.typeName, p.invoiceNumber, p.orderNumber, p.confirmationNumber].filter(Boolean).join(' · ') + (p.reason ? ' — ' + p.reason : '');
  }
}

/**
 * Split one long scan into several invoice packs. The server reads and classifies every page and proposes a
 * grouping; the user drags pages between packs (or into the "unplaced" tray), fixes numbers, and saves them all.
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
        <h2>Split a multi-pack scan</h2>
        <p>One PDF with several packs in it → we read every page, group them into packs, you check and save them all.</p>
      </div>
      @if (result(); as r) { <div class="bt__meta"><b>{{ r.fileName }}</b><small>{{ r.pageCount }} pages · {{ groups.length }} pack(s) · {{ unassigned.length }} unplaced{{ r.method === 'ocr' ? ' · OCR' : '' }}</small></div> }
      <button mat-icon-button type="button" (click)="close()" aria-label="Close"><mat-icon>close</mat-icon></button>
    </header>

    <!-- ───── step 1: file ───── -->
    @if (!result()) {
      <div class="bt__start">
        @if (!busy()) {
          <label class="bt__drop" [class.drag]="dragging()" (dragover)="$event.preventDefault(); dragging.set(true)" (dragleave)="dragging.set(false)" (drop)="onDrop($event)">
            <input type="file" hidden accept=".pdf" (change)="onPick($event)" />
            <mat-icon>upload_file</mat-icon>
            <b>Drop the scanned PDF here</b>
            <span>Feed the whole pile through the scanner as one PDF · up to 150 pages · 200 MB</span>
          </label>
          <ul class="bt__how">
            <li><mat-icon>document_scanner</mat-icon> Every page is read and classified (delivery note, tax invoice, order confirmation, e-mail, official order).</li>
            <li><mat-icon>hub</mat-icon> Pages that share an invoice, order or confirmation number become one pack; a new delivery note or invoice starts the next pack.</li>
            <li><mat-icon>drag_indicator</mat-icon> Where the split is wrong, drag pages between packs or into the unplaced tray, then save — one pack per group.</li>
          </ul>
        } @else {
          <div class="bt__busy">
            <mat-spinner diameter="40"></mat-spinner>
            <b>Reading {{ fileName() }}…</b>
            <span>Each page is OCR'd, rotated upright and classified. A long scan can take a couple of minutes — leave this open.</span>
          </div>
        }
        @if (error()) { <div class="bt__err"><mat-icon>error</mat-icon> {{ error() }}</div> }
      </div>
    }

    <!-- ───── step 2: arrange ───── -->
    @if (result(); as r) {
      <div class="bt__body" cdkDropListGroup>
        <section class="bt__groups">
          <!-- unplaced tray -->
          <div class="bt__tray" [class.empty]="!unassigned.length">
            <div class="bt__trayhead">
              <mat-icon>inbox</mat-icon><b>Unplaced pages</b>
              <small>{{ unassigned.length ? 'Drag these into the pack they belong to — unplaced pages are not saved.' : 'Drop a page here to leave it out.' }}</small>
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
                <span class="bt__conf" [class]="'bt__conf ' + g.confidence" [matTooltip]="g.reasons.join(' ')">{{ g.confidence === 'high' ? 'Sure' : g.confidence === 'medium' ? 'Probably' : 'Check' }}</span>
                @if (g.analysis; as a) {
                  <span class="bt__vstat" [class]="'bt__vstat ' + a.status.toLowerCase()" [matTooltip]="ruleTip(a)"><mat-icon>{{ a.status === 'PASS' ? 'verified' : a.status === 'FAIL' ? 'cancel' : a.status === 'REVIEW' ? 'rule' : 'help' }}</mat-icon>{{ a.status }}</span>
                }
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
                  <label>Order no.<input class="bt__input mono" [(ngModel)]="g.orderNumber" placeholder="OR000190" [disabled]="!!g.saved" /></label>
                  <label>Confirmation<input class="bt__input mono" [(ngModel)]="g.confirmationNumber" placeholder="ORD107038" [disabled]="!!g.saved" /></label>
                  <label>Customer no.<input class="bt__input mono" [(ngModel)]="g.customerNumber" placeholder="04-BLO-001" [disabled]="!!g.saved" /></label>
                  <label>Customer<input class="bt__input" [(ngModel)]="g.customerName" placeholder="Customer" [disabled]="!!g.saved" /></label>
                  <label class="wide">Notes<input class="bt__input" [(ngModel)]="g.notes" placeholder="Optional" [disabled]="!!g.saved" /></label>
                </div>
              }

              <div class="bt__strip" cdkDropList [cdkDropListData]="g.pages" cdkDropListOrientation="horizontal" (cdkDropListDropped)="drop($event, g)" [cdkDropListDisabled]="!!g.saved">
                @for (n of g.pages; track n) {
                  <app-batch-page cdkDrag [cdkDragData]="n" [page]="page(n)" [selected]="selPageNo() === n" (click)="selectPage(n); $event.stopPropagation()"><div class="bt__ghost" *cdkDragPlaceholder></div></app-batch-page>
                }
                @if (!g.pages.length) { <div class="bt__emptystrip">Drop pages here</div> }
              </div>

              <div class="bt__gfoot">
                <div class="bt__kinds">
                  @for (k of kinds; track k.key) { <mat-icon [class.on]="hasKind(g, k.code)" [matTooltip]="k.label">{{ k.icon }}</mat-icon> }
                </div>
                @for (why of g.reasons; track why) { <small class="bt__why"><mat-icon>info</mat-icon>{{ why }}</small> }
                @if (g.existingPacks.length && !g.saved) {
                  <small class="bt__why warn"><mat-icon>warning_amber</mat-icon>A pack already exists for {{ g.invoiceNumber }} ({{ g.existingPacks[0].packNumber }}).
                    <label class="bt__cb"><input type="checkbox" [(ngModel)]="g.allowDuplicate" /> Add anyway</label></small>
                }
                @if (g.saved) { <small class="bt__why ok"><mat-icon>check_circle</mat-icon>Saved as {{ g.saved.packNumber }}</small> }
                @if (g.error) { <small class="bt__why bad"><mat-icon>error</mat-icon>{{ g.error }}</small> }
              </div>
            </div>
          }

          <button type="button" class="bt__newgroup" (click)="addGroup()"><mat-icon>add</mat-icon> New pack (then drag pages into it)</button>
        </section>

        <!-- page preview + what we read -->
        <aside class="bt__aside">
          @if (selPage(); as p) {
            <div class="bt__ahead"><b>Page {{ p.number }}</b><span class="bt__ptype" [class.unk]="p.type === 'UNK'">{{ p.type === 'UNK' ? '?' : p.type }}</span><small>{{ p.typeName }}</small>
              <span class="bt__sp"></span>
              <button mat-icon-button type="button" (click)="bigPreview.set(!bigPreview())" [matTooltip]="bigPreview() ? 'Show thumbnail' : 'Open full page (PDF viewer)'"><mat-icon>{{ bigPreview() ? 'photo' : 'zoom_in' }}</mat-icon></button>
            </div>
            <div class="bt__apreview">
              @if (bigPreview() && pdfUrl()) { <iframe [src]="pageUrl(p.number)!" title="Page"></iframe> }
              @else if (p.thumb) { <img [src]="p.thumb" alt="" /> }
              @else { <div class="bt__nothumb"><mat-icon>image_not_supported</mat-icon><span>No preview</span></div> }
            </div>
            <dl class="bt__dl">
              <dt>Invoice</dt><dd class="mono">{{ p.invoiceNumber || '—' }}</dd>
              <dt>Order</dt><dd class="mono">{{ p.orderNumber || '—' }}</dd>
              <dt>Confirmation</dt><dd class="mono">{{ p.confirmationNumber || '—' }}</dd>
              <dt>Customer</dt><dd class="mono">{{ p.customerNumber || '—' }}</dd>
              <dt>Date</dt><dd>{{ p.date || '—' }}</dd>
              <dt>Placed because</dt><dd>{{ p.reason || '—' }}</dd>
              <dt>Text read</dt><dd>{{ p.textLength < 40 ? 'almost none — faint or image-only page' : p.textLength + ' characters' }}</dd>
            </dl>
            <div class="bt__moveto">
              <small>Move to:</small>
              @for (g of groups; track g.id; let gi = $index) { @if (!g.pages.includes(p.number) && !g.saved) { <button type="button" class="bt__chip" (click)="moveTo(p.number, g)">Pack {{ gi + 1 }}{{ g.invoiceNumber ? ' · ' + g.invoiceNumber : '' }}</button> } }
              @if (!unassigned.includes(p.number)) { <button type="button" class="bt__chip" (click)="moveTo(p.number, null)">Unplaced</button> }
            </div>
          } @else {
            <div class="bt__ahint"><mat-icon>touch_app</mat-icon><p>Click a page to see it here, with what was read on it and why it was placed where it is. Drag pages to re-arrange.</p>
              @for (n of r.notes; track n) { <small>{{ n }}</small> }</div>
          }
        </aside>
      </div>

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
    .bt__sp { flex:1; }

    .bt__start { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:18px; padding:24px; }
    .bt__drop { display:flex; flex-direction:column; align-items:center; gap:4px; padding:40px 48px; border:2px dashed var(--color-line); border-radius:16px; cursor:pointer; text-align:center; color: var(--color-text-muted); background: var(--color-surface); width:min(560px, 100%);
      mat-icon { font-size:44px; width:44px; height:44px; color: var(--color-primary); margin-bottom:6px; } b { color: var(--color-text); font-size:1.05rem; } span { font-size:.8rem; }
      &:hover, &.drag { border-color: var(--color-primary); background: var(--color-primary-soft); } }
    .bt__how { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; width:min(560px, 100%); font-size:.86rem; color: var(--color-text-muted);
      li { display:flex; gap:10px; align-items:flex-start; mat-icon { color: var(--color-primary); font-size:20px; width:20px; height:20px; flex:0 0 auto; } } }
    .bt__busy { display:flex; flex-direction:column; align-items:center; gap:10px; text-align:center; color: var(--color-text-muted); max-width:460px; b { color: var(--color-text); } span { font-size:.84rem; } }
    .bt__err { display:flex; align-items:center; gap:6px; color:#b91c1c; font-size:.88rem; }

    .bt__body { flex:1; min-height:0; display:grid; grid-template-columns: minmax(0, 1fr) 340px; }
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
    .bt__conf { font-size:.7rem; font-weight:800; text-transform:uppercase; letter-spacing:.04em; padding:3px 8px; border-radius:999px; background:#f3f4f6; color:#6b7280;
      &.high { background:#ecfdf5; color:#065f46; } &.medium { background:#fffbeb; color:#92400e; } &.low { background:#fef2f2; color:#991b1b; } }
    .bt__vstat { display:inline-flex; align-items:center; gap:3px; font-size:.7rem; font-weight:800; padding:3px 8px 3px 5px; border-radius:999px; background:#f3f4f6; color:#6b7280; mat-icon { font-size:14px; width:14px; height:14px; }
      &.pass { background:#ecfdf5; color:#065f46; } &.review { background:#fffbeb; color:#92400e; } &.fail { background:#fef2f2; color:#991b1b; } }
    .bt__cos { display:flex; gap:4px; }
    .bt__co { width:30px; height:30px; padding:0; border-radius:50%; border:2px solid transparent; background:transparent; cursor:pointer; opacity:.45; img { width:100%; height:100%; border-radius:50%; object-fit:cover; display:block; }
      &.on { border-color: var(--color-primary); opacity:1; } &:hover { opacity:1; } &:disabled { cursor:default; } }
    .bt__gdetails { display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap:8px; margin-top:10px; label { display:flex; flex-direction:column; gap:3px; font-size:.7rem; font-weight:700; color: var(--color-text-muted); text-transform:uppercase; letter-spacing:.04em; &.wide { grid-column: 1 / -1; } } }

    .bt__strip { display:flex; gap:8px; overflow-x:auto; padding:8px 2px; min-height:150px; align-items:stretch;
      &--tray { min-height:70px; } &.cdk-drop-list-dragging .bt__page:not(.cdk-drag-placeholder) { transition: transform 200ms cubic-bezier(0,0,.2,1); } }
    .bt__emptystrip { flex:1; display:grid; place-items:center; border:2px dashed var(--color-line); border-radius:10px; color: var(--color-text-muted); font-size:.82rem; min-height:120px; }
    .bt__ghost { flex:0 0 104px; width:104px; min-height:130px; border:2px dashed var(--color-primary); border-radius:10px; background: var(--color-primary-soft); }
    .cdk-drag-preview { box-shadow: 0 8px 24px rgba(0,0,0,.25); border-radius:10px; }
    .cdk-drag-animating { transition: transform 200ms cubic-bezier(0,0,.2,1); }

    .bt__gfoot { display:flex; flex-wrap:wrap; align-items:center; gap:6px 14px; margin-top:4px; }
    .bt__kinds { display:inline-flex; gap:2px; padding:3px 6px; border-radius:999px; background: var(--color-surface-2, #f3f4f6); mat-icon { font-size:16px; width:16px; height:16px; color:#cbd5e1; &.on { color:#059669; } } }
    .bt__why { display:inline-flex; align-items:center; gap:4px; font-size:.75rem; color: var(--color-text-muted); mat-icon { font-size:14px; width:14px; height:14px; } &.warn { color:#92400e; } &.ok { color:#065f46; } &.bad { color:#b91c1c; } }
    .bt__cb { display:inline-flex; align-items:center; gap:4px; margin-left:6px; font-weight:700; cursor:pointer; }
    .bt__newgroup { display:flex; align-items:center; justify-content:center; gap:6px; padding:12px; border:2px dashed var(--color-line); border-radius:14px; background:transparent; font: inherit; font-weight:600; color: var(--color-text-muted); cursor:pointer; &:hover { border-color: var(--color-primary); color: var(--color-primary); } }

    .bt__ahead { display:flex; align-items:center; gap:8px; b { font-size:.95rem; } small { color: var(--color-text-muted); } }
    .bt__ptype { display:inline-block; min-width:30px; text-align:center; font-weight:800; font-size:.68rem; padding:1px 5px; border-radius:6px; background: var(--color-primary-soft); color: var(--color-primary); &.unk { background:#f3f4f6; color:#9ca3af; } }
    .bt__apreview { border:1px solid var(--color-line); border-radius:10px; overflow:hidden; background:#525659; min-height:300px; display:flex; align-items:center; justify-content:center;
      img { width:100%; display:block; } iframe { width:100%; height:520px; border:0; } }
    .bt__nothumb { display:flex; flex-direction:column; align-items:center; gap:6px; color:#d1d5db; padding:40px; mat-icon { font-size:36px; width:36px; height:36px; } }
    .bt__dl { display:grid; grid-template-columns: auto 1fr; gap:4px 12px; margin:0; font-size:.82rem; dt { color: var(--color-text-muted); } dd { margin:0; } }
    .bt__moveto { display:flex; flex-wrap:wrap; align-items:center; gap:6px; small { color: var(--color-text-muted); } }
    .bt__chip { font: inherit; font-size:.76rem; padding:4px 10px; border-radius:999px; border:1px solid var(--color-line); background: var(--color-surface); cursor:pointer; &:hover { border-color: var(--color-primary); color: var(--color-primary); } }
    .bt__ahint { display:flex; flex-direction:column; align-items:center; gap:8px; text-align:center; padding:32px 10px; color: var(--color-text-muted); mat-icon { font-size:36px; width:36px; height:36px; color: var(--color-primary); } p { margin:0; font-size:.88rem; } small { font-size:.78rem; } }

    .bt__foot { display:flex; align-items:center; gap:10px; padding:10px 18px; border-top:1px solid var(--color-line); .bt__status { flex:1; display:flex; align-items:center; gap:6px; font-size:.86rem; color: var(--color-text-muted); mat-icon { font-size:18px; width:18px; height:18px; } } }
    @media (max-width: 980px) { .bt__body { grid-template-columns: 1fr; } .bt__aside { display:none; } .bt__gdetails { grid-template-columns: repeat(2, minmax(0,1fr)); } }
  `]
})
export class PackBatchDialogComponent implements OnDestroy {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private sanitizer = inject(DomSanitizer);
  private ref = inject(MatDialogRef<PackBatchDialogComponent>);
  private api = environment.apiUrl;

  static open(dialog: MatDialog) {
    return dialog.open(PackBatchDialogComponent, { width: 'min(1400px, 97vw)', maxWidth: '97vw', maxHeight: '96vh', panelClass: 'pack-dialog-panel', disableClose: true, autoFocus: false });
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
  pdfUrl = signal<string | null>(null);
  bigPreview = signal(false);
  selPageNo = signal<number | null>(null);
  selGroup = signal<number | null>(null);
  details = new Set<number>();

  groups: BGroup[] = [];
  unassigned: number[] = [];
  private pagesByNo = new Map<number, BPage>();
  private nextId = 1;
  private savedAny = false;

  selPage = computed(() => { const n = this.selPageNo(); return n == null ? null : this.pagesByNo.get(n) ?? null; });
  pendingGroups = () => this.groups.filter(g => !g.saved && g.pages.length > 0);
  readyCount = () => this.pendingGroups().filter(g => this.invValid(g) && !!g.company && !(g.existingPacks.length && !g.allowDuplicate)).length;
  allSaved = () => this.groups.length > 0 && this.groups.every(g => g.saved || g.pages.length === 0);
  anyAnalysing = () => this.groups.some(g => g.analysing);

  page(n: number): BPage { return this.pagesByNo.get(n) ?? { number: n, type: 'UNK', typeName: 'Unrecognised', confidence: 0, invoiceNumber: null, orderNumber: null, confirmationNumber: null, customerNumber: null, date: null, textLength: 0, continuation: false, reason: null, thumb: null }; }
  pageUrl(n: number): SafeResourceUrl | null { const u = this.pdfUrl(); return u ? this.sanitizer.bypassSecurityTrustResourceUrl(`${u}#page=${n}&toolbar=0`) : null; }
  invValid(g: BGroup): boolean { return /^IN\d{5,7}$/.test(this.normalize(g.invoiceNumber)); }
  private normalize(v: string): string { return (v ?? '').toUpperCase().replace(/[\s\-_.:#]/g, ''); }
  hasKind(g: BGroup, code: string): boolean { return g.pages.some(n => this.page(n).type === code); }
  ruleTip(a: Analysis): string { return a.rules.map(r => `${r.pass ? '✓' : '✗'} ${r.code} ${r.detail}`).concat(a.warnings.map(w => `⚠ ${w}`)).join('\n'); }
  toggleDetails(g: BGroup): void { if (this.details.has(g.id)) this.details.delete(g.id); else this.details.add(g.id); }
  selectPage(n: number): void { this.selPageNo.set(n); }

  // ───── file ─────
  onDrop(e: DragEvent): void { e.preventDefault(); this.dragging.set(false); const f = e.dataTransfer?.files?.[0]; if (f) this.start(f); }
  onPick(e: Event): void { const input = e.target as HTMLInputElement; const f = input.files?.[0]; if (f) this.start(f); input.value = ''; }

  private async start(file: File): Promise<void> {
    if (!/\.pdf$/i.test(file.name)) { this.toast.warn('A multi-pack scan must be a PDF.'); return; }
    this.busy.set(true); this.error.set(''); this.fileName.set(file.name);
    this.pdfUrl.set(URL.createObjectURL(file));
    try {
      const form = new FormData(); form.append('file', file);
      const r = await firstValueFrom(this.http.post<BatchResult>(`${this.api}/finance/packs/batch`, form));
      this.result.set(r);
      this.pagesByNo = new Map(r.pages.map(p => [p.number, p]));
      this.groups = r.groups.map(g => this.makeGroup(g.pages, g.invoiceNumber, g.orderNumber, g.confirmationNumber, g.customerNumber, g.company, g.confidence, g.reasons, g.analysis));
      this.unassigned = [...r.unassigned];
      if (this.groups.length) this.selGroup.set(this.groups[0].id);
      // Sage lookups for the proposed invoice numbers (customer name, duplicates).
      for (const g of this.groups) if (this.invValid(g)) this.lookup(g);
      if (!r.ocrAvailable && r.method === 'none') this.toast.warn('OCR is not available on the server — pages could not be read. Group them by hand.');
    } catch (e: any) {
      this.error.set(e?.error?.error || 'The scan could not be processed.');
    } finally { this.busy.set(false); }
  }

  private makeGroup(pages: number[], inv: string | null, ord: string | null, conf: string | null, cust: string | null, company: string | null, confidence: 'high' | 'medium' | 'low', reasons: string[], analysis: Analysis | null): BGroup {
    return { id: this.nextId++, pages: [...pages], invoiceNumber: inv ?? '', autoInvoice: inv ?? '', orderNumber: ord ?? '', confirmationNumber: conf ?? '', customerNumber: cust ?? '', customerName: '', company, notes: '', allowDuplicate: false, confidence, reasons, analysis, sage: null, existingPacks: [], analysing: false, saved: null, error: null };
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
    else transferArrayItem(e.previousContainer.data, e.container.data, e.previousIndex, e.currentIndex);
    const src = this.groups.find(g => g.pages === e.previousContainer.data) ?? null;
    this.afterMove(src, target);
  }

  moveTo(n: number, target: BGroup | null): void {
    const src = this.groups.find(g => g.pages.includes(n)) ?? null;
    if (src) src.pages.splice(src.pages.indexOf(n), 1); else this.unassigned.splice(this.unassigned.indexOf(n), 1);
    const dest = target ? target.pages : this.unassigned;
    // Keep page order natural when dropping via the side panel.
    const at = dest.findIndex(x => x > n); dest.splice(at < 0 ? dest.length : at, 0, n);
    this.afterMove(src, target);
  }

  private afterMove(src: BGroup | null, dest: BGroup | null): void {
    for (const g of [src, dest]) if (g) { g.error = null; g.saved = null; this.reanalyse(g); }
  }

  addGroup(): void { const g = this.makeGroup([], null, null, null, null, null, 'low', ['Drag pages in, then enter the invoice number.'], null); this.groups.push(g); this.selGroup.set(g.id); }
  removeGroup(i: number): void { const g = this.groups[i]; this.unassigned.push(...g.pages); this.unassigned.sort((a, b) => a - b); this.groups.splice(i, 1); }

  private async reanalyse(g: BGroup): Promise<void> {
    const r = this.result(); if (!r) return;
    if (!g.pages.length) { g.analysis = null; g.reasons = ['Empty — drag pages in or remove it.']; g.confidence = 'low'; return; }
    g.analysing = true;
    try {
      const a = await firstValueFrom(this.http.post<any>(`${this.api}/finance/packs/batch/${r.batchId}/analyse`, g.pages));
      g.analysis = a.analysis ?? null;
      // Only overwrite what the user has not typed themselves.
      if (a.invoiceNumber && (!g.invoiceNumber || g.invoiceNumber === g.autoInvoice)) { g.invoiceNumber = a.invoiceNumber; g.autoInvoice = a.invoiceNumber; }
      g.orderNumber ||= a.orderNumber ?? ''; g.confirmationNumber ||= a.confirmationNumber ?? ''; g.customerNumber ||= a.customerNumber ?? '';
      g.company ||= a.company ?? null;
      g.sage = a.sage ?? g.sage; g.existingPacks = a.existingPacks ?? [];
      if (a.sage) { g.customerName ||= a.sage.customerName; g.customerNumber ||= a.sage.customerNumber; }
      const types = new Set(g.pages.map(n => this.page(n).type).filter(t => t !== 'UNK'));
      const invs = new Set(g.pages.map(n => this.page(n).invoiceNumber).filter(Boolean));
      g.reasons = [];
      if (invs.size > 1) g.reasons.push('Pages carry different invoice numbers: ' + [...invs].join(', ') + '.');
      if (!g.invoiceNumber) g.reasons.push('No invoice number could be read — type it in.');
      g.confidence = invs.size <= 1 && !!g.invoiceNumber && types.size >= 3 ? 'high' : invs.size <= 1 && (!!g.invoiceNumber || types.size >= 2) ? 'medium' : 'low';
    } catch (e: any) { this.toast.warn(e?.error?.error || 'Re-check failed for a pack.'); }
    finally { g.analysing = false; }
  }

  reanalyseAll(): void { for (const g of this.groups) if (!g.saved) this.reanalyse(g); }

  // ───── save ─────
  async save(): Promise<void> {
    const r = this.result(); if (!r || this.saving()) return;
    const todo = this.pendingGroups().filter(g => this.invValid(g) && !!g.company && !(g.existingPacks.length && !g.allowDuplicate));
    if (!todo.length) return;
    this.saving.set(true); this.error.set('');
    try {
      const body = { groups: todo.map(g => ({ pages: g.pages, invoiceNumber: this.normalize(g.invoiceNumber), orderNumber: g.orderNumber || null, confirmationNumber: g.confirmationNumber || null, customerNumber: g.customerNumber || null, customerName: g.customerName || null, company: g.company, notes: g.notes || null, allowDuplicate: g.allowDuplicate })) };
      const res = await firstValueFrom(this.http.post<{ saved: { index: number; pack: any }[]; errors: { index: number; error: string }[]; batchKept: boolean }>(`${this.api}/finance/packs/batch/${r.batchId}/commit`, body));
      for (const s of res.saved) { todo[s.index].saved = s.pack; todo[s.index].error = null; this.savedAny = true; }
      for (const e of res.errors) todo[e.index].error = e.error;
      if (res.saved.length) this.toast.info(`${res.saved.length} pack(s) saved${res.errors.length ? `, ${res.errors.length} need attention` : ''}.`);
      if (!res.batchKept && this.allSaved()) { this.ref.close(true); }
    } catch (e: any) { this.error.set(e?.error?.error || 'Saving failed.'); }
    finally { this.saving.set(false); }
  }

  close(): void {
    const r = this.result();
    if (r && !this.allSaved()) {
      // Discard the server-side batch unless something was saved and a retry might be wanted.
      if (!this.savedAny) this.http.delete(`${this.api}/finance/packs/batch/${r.batchId}`).subscribe({ error: () => {} });
    }
    this.ref.close(this.savedAny);
  }

  ngOnDestroy(): void { const u = this.pdfUrl(); if (u) URL.revokeObjectURL(u); }
}
