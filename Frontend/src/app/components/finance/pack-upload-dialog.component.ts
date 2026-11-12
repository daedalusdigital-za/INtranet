import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../ui/toast.service';
import { companyLogo, COMPANY_NAMES } from '../../core/company-logos';

export type PackMode = 'scan' | 'assemble';

/** The five documents that make a pack. `code` matches the backend analyser (DN/INV/OC/EML/PO). */
export const PACK_KINDS: { key: string; code: string; label: string; icon: string; hint: string }[] = [
  { key: 'DeliveryNote',      code: 'DN',  label: 'Delivery note',          icon: 'local_shipping', hint: 'Signed by the customer on delivery; carries the IN number' },
  { key: 'TaxInvoice',        code: 'INV', label: 'Tax invoice',            icon: 'receipt_long',   hint: 'Sage tax invoice (IN number, VAT, amount due)' },
  { key: 'OrderConfirmation', code: 'OC',  label: 'Order confirmation',     icon: 'task_alt',       hint: 'Our acceptance of the order (ORD number)' },
  { key: 'OrderEmail',        code: 'EML', label: 'Customer order e-mail',  icon: 'mail',           hint: 'Print / screenshot of the customer ordering; order no. in the subject' },
  { key: 'OrderForm',         code: 'PO',  label: 'Official order',         icon: 'description',    hint: 'Customer purchase order (OR- number), may be amended by hand' },
];

export interface PageResult { page: number; type: string; confidence: number; invoiceNumber?: string; orderNumber?: string; orderNumberRaw?: string; confirmationNumber?: string; customerNumber?: string; date?: string; signed: boolean; stamped: boolean; partDelivery: boolean; amended: boolean; duplicate: boolean; textLength: number; }
export interface RuleResult { code: string; title: string; pass: boolean; detail: string; }
export interface Analysis { status: 'PASS' | 'FAIL' | 'REVIEW' | 'UNKNOWN'; pages: PageResult[]; typesFound: string[]; typesMissing: string[]; rules: RuleResult[]; warnings: string[]; notes: string[]; invoiceNumber?: string; orderNumber?: string; confirmationNumber?: string; customerNumber?: string; proofOfDelivery: boolean; partDelivery: boolean; amended: boolean; }

interface Part { file: File; kind: string; isPdf: boolean; }
interface SageHit { company: string | null; customerNumber: string; customerName: string; date: string; total: number; lines: number; loadId: number | null; orderNumber: string | null; pods: number; otherCompanies: string[]; }
interface DetectResult {
  method: 'text' | 'ocr' | 'none'; pages: number;
  invoiceNumber: string | null; candidates: string[]; sageMatches: string[];
  orderNumber: string | null; confirmationNumber: string | null; customerNumber: string | null; company: string | null;
  sage: SageHit | null; existingPacks: { id: number; packNumber: string; uploadedAt: string }[];
  ocrAvailable: boolean; analysis: Analysis | null;
}

/**
 * Upload (scan) or assemble an invoice pack.
 * Left: the file(s) and what we read on each page. Right: confirm the invoice number → details → save.
 */
@Component({
  selector: 'app-pack-upload-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatIconModule, MatButtonModule, MatTooltipModule, MatProgressSpinnerModule],
  template: `
  <div class="pk">
    <!-- ───────── header ───────── -->
    <header class="pk__head">
      <div class="pk__title">
        <mat-icon>inventory_2</mat-icon>
        <div>
          <h2>{{ mode() === 'scan' ? 'Upload a scanned pack' : 'Create a pack from documents' }}</h2>
          <p>Delivery note · Tax invoice · Order confirmation · Customer order e-mail · Official order</p>
        </div>
      </div>
      <div class="pk__modes" role="tablist">
        <button type="button" role="tab" [class.on]="mode() === 'scan'" (click)="setMode('scan')"><mat-icon>document_scanner</mat-icon> One scanned PDF</button>
        <button type="button" role="tab" [class.on]="mode() === 'assemble'" (click)="setMode('assemble')"><mat-icon>auto_awesome_motion</mat-icon> Combine documents</button>
      </div>
      <button mat-icon-button mat-dialog-close aria-label="Close" class="pk__close"><mat-icon>close</mat-icon></button>
    </header>

    <div class="pk__body">
      <!-- ───────── LEFT: document(s) ───────── -->
      <section class="pk__col pk__col--doc">
        <h3 class="pk__h">1 · Document{{ mode() === 'assemble' ? 's' : '' }}</h3>

        @if (mode() === 'scan') {
          @if (!scanFile()) {
            <label class="pk__drop" [class.drag]="dragging()" (dragover)="onDragOver($event)" (dragleave)="dragging.set(false)" (drop)="onDrop($event)">
              <input type="file" hidden accept=".pdf,.jpg,.jpeg,.png" (change)="onPick($event)" />
              <mat-icon>upload_file</mat-icon>
              <b>Drop the scanned pack here</b>
              <span>or click to browse · PDF preferred · up to 60 MB</span>
            </label>
          } @else {
            <div class="pk__file">
              <mat-icon class="pk__fileicon">{{ scanIsPdf() ? 'picture_as_pdf' : 'image' }}</mat-icon>
              <div class="pk__filemeta"><b>{{ scanFile()!.name }}</b><small>{{ fmtSize(scanFile()!.size) }}@if (detect()?.pages) { · {{ detect()!.pages }} page(s) }@if (detect()?.method === 'ocr') { · OCR }</small></div>
              <button mat-icon-button type="button" (click)="showPreview.set(!showPreview())" [matTooltip]="showPreview() ? 'Hide preview' : 'Preview'"><mat-icon>{{ showPreview() ? 'visibility_off' : 'visibility' }}</mat-icon></button>
              <button mat-icon-button type="button" (click)="clearScan()" matTooltip="Remove"><mat-icon>delete_outline</mat-icon></button>
            </div>
            @if (showPreview() && scanUrl()) {
              <div class="pk__preview">
                @if (scanIsPdf()) { <iframe [src]="scanUrl()!" title="Pack preview"></iframe> } @else { <img [src]="scanUrl()!" alt="Pack preview" /> }
              </div>
            }
          }
        } @else {
          @for (p of parts(); track p; let i = $index) {
            <div class="pk__file pk__file--part">
              <span class="pk__no">{{ i + 1 }}</span>
              <mat-icon class="pk__fileicon">{{ p.isPdf ? 'picture_as_pdf' : 'image' }}</mat-icon>
              <div class="pk__filemeta"><b>{{ p.file.name }}</b><small>{{ fmtSize(p.file.size) }}</small></div>
              <select [(ngModel)]="p.kind" class="pk__select" aria-label="Document type">
                @for (k of kinds; track k.key) { <option [value]="k.key">{{ k.label }}</option> }
                <option value="Other">Other</option>
              </select>
              <button mat-icon-button type="button" (click)="movePart(i, -1)" [disabled]="i === 0" matTooltip="Up"><mat-icon>expand_less</mat-icon></button>
              <button mat-icon-button type="button" (click)="movePart(i, 1)" [disabled]="i === parts().length - 1" matTooltip="Down"><mat-icon>expand_more</mat-icon></button>
              <button mat-icon-button type="button" (click)="removePart(i)" matTooltip="Remove"><mat-icon>delete_outline</mat-icon></button>
            </div>
          }
          <label class="pk__drop pk__drop--sm" [class.drag]="dragging()" (dragover)="onDragOver($event)" (dragleave)="dragging.set(false)" (drop)="onDrop($event)">
            <input type="file" hidden multiple accept=".pdf,.jpg,.jpeg,.png" (change)="onPick($event)" />
            <mat-icon>add</mat-icon> <b>Add documents</b> <span>PDF / JPG / PNG — type is guessed from the file name</span>
          </label>
        }

        <!-- Contents + rules -->
        <h3 class="pk__h pk__h--mt">What's in the pack</h3>
        @if (detecting()) {
          <div class="pk__busy"><mat-spinner diameter="18"></mat-spinner> Reading each page…</div>
        }
        <ul class="pk__contents">
          @for (k of kinds; track k.key) {
            <li [class.on]="kindPresent(k)" [class.manual]="mode() === 'scan'" (click)="mode() === 'scan' && toggleContent(k.key)" [matTooltip]="k.hint">
              <mat-icon class="pk__ci">{{ k.icon }}</mat-icon>
              <span class="pk__cl">{{ k.label }}</span>
              <span class="pk__cp">{{ pagesFor(k.code) }}</span>
              <mat-icon class="pk__ck">{{ kindPresent(k) ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
            </li>
          }
        </ul>
        @if (mode() === 'scan' && detect()) { <small class="pk__hint">Ticks come from the scan; click a row to correct it if the OCR missed a page.</small> }

        @if (analysis(); as a) {
          <div class="pk__rules" [class.pass]="a.status === 'PASS'" [class.fail]="a.status === 'FAIL'" [class.review]="a.status === 'REVIEW'" [class.unknown]="a.status === 'UNKNOWN'">
            <div class="pk__rules-head">
              <mat-icon>{{ a.status === 'PASS' ? 'verified' : a.status === 'FAIL' ? 'cancel' : a.status === 'REVIEW' ? 'rule' : 'help' }}</mat-icon>
              <b>{{ a.status === 'PASS' ? 'Pack checks passed' : a.status === 'FAIL' ? 'Pack checks failed' : a.status === 'REVIEW' ? 'Passed — needs a look' : 'Could not read the pack' }}</b>
              @if (a.proofOfDelivery) { <span class="pk__tag ok">POD</span> }
              @if (a.partDelivery) { <span class="pk__tag">Part delivery</span> }
              @if (a.amended) { <span class="pk__tag">Amended order</span> }
            </div>
            <ul class="pk__rulelist">
              @for (r of a.rules; track r.code) { <li [class.ok]="r.pass"><mat-icon>{{ r.pass ? 'check' : 'close' }}</mat-icon><span><b>{{ r.code }}</b> {{ r.detail }}</span></li> }
              @for (w of a.warnings; track w) { <li class="warn"><mat-icon>warning_amber</mat-icon><span>{{ w }}</span></li> }
              @for (n of a.notes; track n) { <li class="note"><mat-icon>info</mat-icon><span>{{ n }}</span></li> }
            </ul>
            @if (a.status === 'FAIL') { <small>A failed pack can still be saved — it will be flagged for Finance to fix.</small> }
          </div>
        }
      </section>

      <!-- ───────── RIGHT: confirm + details ───────── -->
      <section class="pk__col pk__col--form" [class.muted]="!hasFiles()">
        <h3 class="pk__h">2 · Invoice number</h3>
        <p class="pk__lead">
          @if (detecting()) { Looking for the invoice number… }
          @else if (!detect()) { Add the document and we'll read the invoice number off it. }
          @else {
            @if (detect(); as d) {
              @if (d.invoiceNumber && d.sageMatches.includes(d.invoiceNumber)) { We read <b>{{ d.invoiceNumber }}</b> and it matches a Sage invoice. Confirm it is the number on the paper. }
              @else if (d.invoiceNumber) { We read <b>{{ d.invoiceNumber }}</b> but it is not in Sage yet — check it against the paper. }
              @else if (d.method === 'none') { This is a scan and the OCR engine is not available — type the invoice number from the document. }
              @else { No invoice number was found — type it in from the paper copy. }
            }
          }
        </p>
        <div class="pk__invrow">
          <input class="pk__input pk__input--inv" [ngModel]="invoice()" (ngModelChange)="onInvoiceInput($event)" placeholder="IN123456" [disabled]="!hasFiles()" autocomplete="off" spellcheck="false" aria-label="Invoice number" />
          <button mat-flat-button color="primary" type="button" [disabled]="!invoiceValid() || verifying() || verified()" (click)="verify()">
            @if (verifying()) { <mat-spinner diameter="16"></mat-spinner> } @else { <mat-icon>{{ verified() ? 'check_circle' : 'fact_check' }}</mat-icon> }
            {{ verified() ? 'Confirmed' : 'Confirm' }}
          </button>
        </div>
        @if ((detect()?.candidates?.length ?? 0) > 1) {
          <div class="pk__cands">
            <small>Also seen:</small>
            @for (c of detect()!.candidates; track c) {
              <button type="button" class="pk__cand" [class.on]="invoice() === c" [class.sage]="detect()!.sageMatches.includes(c)" (click)="pickCandidate(c)">{{ c }}</button>
            }
          </div>
        }
        @if (invoice() && !invoiceValid()) { <small class="pk__err">Format is IN followed by 5–7 digits.</small> }
        @if (verified() && lookup(); as l) {
          @if (l.existingPacks.length) {
            <div class="pk__note warn">
              <mat-icon>warning_amber</mat-icon>
              <span>A pack already exists for {{ invoice() }} — {{ l.existingPacks[0].packNumber }}, {{ l.existingPacks[0].uploadedAt | date:'d MMM yyyy' }}.</span>
              <label class="pk__cb"><input type="checkbox" [(ngModel)]="allowDuplicate" /> Add anyway</label>
            </div>
          }
          @if (!l.inSage) { <div class="pk__note info"><mat-icon>info</mat-icon><span>Not in the Sage sales history yet; it will link up on the next import.</span></div> }
          @if (l.sage; as s) {
            <div class="pk__sage">
              <img [src]="logo(s.company)" alt="" />
              <div><b>{{ s.customerName }}</b> <span class="mono">{{ s.customerNumber }}</span><br><small>{{ s.date | date:'d MMM yyyy' }} · R {{ s.total | number:'1.2-2' }} · {{ s.lines }} line(s) · {{ s.pods ? s.pods + ' POD(s) on file' : 'no POD yet' }}</small></div>
            </div>
          }
        }

        <h3 class="pk__h pk__h--mt">3 · Details</h3>
        <div class="pk__details" [class.muted]="!verified()">
          <div class="pk__field pk__field--full">
            <label>Company</label>
            <div class="pk__cos">
              @for (c of companyCodes; track c) {
                <button type="button" class="pk__co" [class.on]="company === c" (click)="company = c" [matTooltip]="companyNames[c]"><img [src]="logo(c)" [alt]="companyNames[c]" /><span>{{ c }}</span></button>
              }
            </div>
          </div>
          <div class="pk__field"><label>Order no. <small>(OR-…)</small></label><input class="pk__input mono" [(ngModel)]="orderNumber" placeholder="OR000190" /></div>
          <div class="pk__field"><label>Confirmation no. <small>(ORD…)</small></label><input class="pk__input mono" [(ngModel)]="confirmationNumber" placeholder="ORD107038" /></div>
          <div class="pk__field"><label>Customer no.</label><input class="pk__input mono" [(ngModel)]="customerNumber" placeholder="04-BLO-001" /></div>
          <div class="pk__field"><label>Invoice date</label><input class="pk__input" type="date" [(ngModel)]="invoiceDate" /></div>
          <div class="pk__field pk__field--full"><label>Customer name</label><input class="pk__input" [(ngModel)]="customerName" placeholder="Customer" /></div>
          <div class="pk__field"><label>Invoice total (R)</label><input class="pk__input" type="number" step="0.01" [(ngModel)]="invoiceTotal" /></div>
          <div class="pk__field"><label>Notes</label><input class="pk__input" [(ngModel)]="notes" placeholder="Optional" /></div>
        </div>
      </section>
    </div>

    <!-- ───────── footer ───────── -->
    <footer class="pk__foot">
      <div class="pk__status">
        @if (error()) { <span class="pk__err"><mat-icon>error</mat-icon> {{ error() }}</span> }
        @else if (!hasFiles()) { <mat-icon>looks_one</mat-icon> Add the document{{ mode() === 'assemble' ? 's' : '' }} to begin. }
        @else if (!verified()) { <mat-icon>looks_two</mat-icon> Confirm the invoice number. }
        @else if (!company) { <mat-icon>looks_3</mat-icon> Pick the company the invoice was issued from. }
        @else { <mat-icon>check_circle</mat-icon> Ready to save{{ mode() === 'assemble' ? ' — ' + parts().length + ' document(s) become one PDF' : '' }}. }
      </div>
      <button mat-button mat-dialog-close type="button">Cancel</button>
      <button mat-flat-button color="primary" type="button" [disabled]="!canSave() || saving()" (click)="save()">
        @if (saving()) { <mat-spinner diameter="16"></mat-spinner> } @else { <mat-icon>{{ mode() === 'scan' ? 'cloud_upload' : 'merge' }}</mat-icon> }
        {{ mode() === 'scan' ? 'Save pack' : 'Combine & save' }}
      </button>
    </footer>
  </div>
  `,
  styles: [`
    :host { display:block; }
    .mono { font-family: ui-monospace, Menlo, Consolas, monospace; letter-spacing:.03em; }
    .pk { display:flex; flex-direction:column; height: min(92vh, 900px); }

    .pk__head { display:flex; align-items:center; gap:16px; padding:14px 20px; border-bottom:1px solid var(--color-line); }
    .pk__title { display:flex; align-items:center; gap:12px; flex:1; min-width:0; > mat-icon { color: var(--color-primary); font-size:28px; width:28px; height:28px; }
      h2 { margin:0; font-size:1.1rem; } p { margin:2px 0 0; font-size:.8rem; color: var(--color-text-muted); } }
    .pk__modes { display:flex; gap:2px; background: var(--color-surface-2, #f3f4f6); border-radius:999px; padding:3px;
      button { display:inline-flex; align-items:center; gap:6px; border:0; background:transparent; font:inherit; font-weight:600; font-size:.82rem; padding:6px 12px; border-radius:999px; cursor:pointer; color: var(--color-text-muted);
        mat-icon { font-size:17px; width:17px; height:17px; } &.on { background: var(--color-surface); color: var(--color-primary); box-shadow:0 1px 3px rgba(0,0,0,.12); } } }

    .pk__body { flex:1; min-height:0; display:grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); }
    .pk__col { overflow:auto; padding:16px 20px; &--doc { border-right:1px solid var(--color-line); background: var(--color-surface-2, #fafafa); } &.muted { opacity:.5; pointer-events:none; } }
    .pk__h { margin:0 0 10px; font-size:.78rem; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color: var(--color-text-muted); &--mt { margin-top:20px; } }
    .pk__lead { margin:0 0 10px; font-size:.9rem; color: var(--color-text); b { font-family: ui-monospace, Menlo, Consolas, monospace; } }

    .pk__drop { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; padding:28px 16px; border:2px dashed var(--color-line); border-radius:14px; cursor:pointer; text-align:center; color: var(--color-text-muted); background: var(--color-surface); transition: border-color .15s, background .15s;
      mat-icon { font-size:36px; width:36px; height:36px; color: var(--color-primary); margin-bottom:4px; } b { color: var(--color-text); } span { font-size:.8rem; }
      &:hover, &.drag { border-color: var(--color-primary); background: var(--color-primary-soft); }
      &--sm { flex-direction:row; padding:10px 14px; gap:8px; mat-icon { font-size:20px; width:20px; height:20px; margin:0; } } }
    .pk__file { display:flex; align-items:center; gap:10px; padding:8px 10px; border:1px solid var(--color-line); border-radius:12px; background: var(--color-surface); &--part { margin-bottom:6px; } }
    .pk__fileicon { color:#dc2626; flex:0 0 auto; }
    .pk__no { width:22px; height:22px; border-radius:50%; background: var(--color-surface-2, #f3f4f6); display:grid; place-items:center; font-size:.72rem; font-weight:800; flex:0 0 22px; }
    .pk__filemeta { flex:1; min-width:0; display:flex; flex-direction:column; b { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:.9rem; } small { color: var(--color-text-muted); font-size:.75rem; } }
    .pk__preview { margin-top:8px; border:1px solid var(--color-line); border-radius:12px; overflow:hidden; background:#525659; iframe, img { width:100%; height:360px; border:0; display:block; object-fit:contain; } }
    .pk__select, .pk__input { font: inherit; font-size:.9rem; padding:8px 10px; border:1px solid var(--color-line); border-radius:8px; background: var(--color-surface); color: inherit; &:focus { outline:2px solid var(--color-primary); outline-offset:-1px; } }
    .pk__select { max-width:170px; }
    .pk__busy { display:flex; align-items:center; gap:8px; font-size:.85rem; color: var(--color-text-muted); margin-bottom:8px; }

    .pk__contents { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:4px;
      li { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:10px; border:1px solid var(--color-line); background: var(--color-surface); color: var(--color-text-muted); font-size:.88rem;
        .pk__ci { font-size:20px; width:20px; height:20px; } .pk__cl { flex:1; font-weight:600; } .pk__cp { font-size:.75rem; } .pk__ck { font-size:20px; width:20px; height:20px; color:#cbd5e1; }
        &.manual { cursor:pointer; } &.on { border-color:#10b981; background:#ecfdf5; color:#065f46; .pk__ck { color:#059669; } } } }
    .pk__hint { display:block; margin-top:6px; font-size:.75rem; color: var(--color-text-muted); }

    .pk__rules { margin-top:12px; padding:10px 12px; border-radius:12px; border:1px solid var(--color-line); background: var(--color-surface);
      &.pass { border-color:#10b981; background:#ecfdf5; } &.fail { border-color:#ef4444; background:#fef2f2; } &.review { border-color:#f59e0b; background:#fffbeb; }
      small { display:block; margin-top:6px; color: var(--color-text-muted); } }
    .pk__rules-head { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:6px; b { font-size:.92rem; } }
    .pk__tag { font-size:.7rem; font-weight:800; text-transform:uppercase; letter-spacing:.04em; padding:2px 8px; border-radius:999px; background: rgba(0,0,0,.06); &.ok { background:#059669; color:#fff; } }
    .pk__rulelist { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:3px; font-size:.82rem;
      li { display:flex; align-items:flex-start; gap:6px; color:#b91c1c; mat-icon { font-size:16px; width:16px; height:16px; margin-top:1px; flex:0 0 auto; } &.ok { color:#065f46; } &.warn { color:#92400e; } &.note { color: var(--color-text-muted); } } }

    .pk__invrow { display:flex; gap:8px; align-items:stretch; .pk__input--inv { flex:1; font-size:1.15rem; font-weight:800; font-family: ui-monospace, Menlo, Consolas, monospace; text-transform:uppercase; letter-spacing:.06em; } button { min-width:130px; mat-spinner { display:inline-block; margin-right:6px; } } }
    .pk__cands { display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin-top:8px; small { color: var(--color-text-muted); } }
    .pk__cand { font: inherit; font-family: ui-monospace, Menlo, Consolas, monospace; font-size:.8rem; padding:4px 10px; border-radius:999px; border:1px solid var(--color-line); background: var(--color-surface); cursor:pointer;
      &.sage { border-color:#10b981; color:#065f46; } &.on { background: var(--color-primary); border-color: var(--color-primary); color:#fff; } }
    .pk__err { display:inline-flex; align-items:center; gap:6px; color:#b91c1c; font-size:.82rem; margin-top:6px; mat-icon { font-size:18px; width:18px; height:18px; } }
    .pk__note { display:flex; align-items:center; gap:8px; margin-top:10px; padding:8px 10px; border-radius:10px; font-size:.85rem; span { flex:1; } mat-icon { font-size:20px; width:20px; height:20px; }
      &.warn { background:#fffbeb; color:#92400e; } &.info { background:#eff6ff; color:#1e40af; } }
    .pk__cb { display:inline-flex; align-items:center; gap:6px; font-weight:700; white-space:nowrap; cursor:pointer; }
    .pk__sage { display:flex; align-items:center; gap:10px; margin-top:10px; padding:8px 10px; border-radius:12px; background: var(--color-surface-2, #f3f4f6); font-size:.88rem;
      img { width:36px; height:36px; border-radius:50%; object-fit:cover; } small { color: var(--color-text-muted); } }

    .pk__details { display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:10px 12px; &.muted { opacity:.5; pointer-events:none; } }
    .pk__field { display:flex; flex-direction:column; gap:4px; min-width:0; &--full { grid-column: 1 / -1; }
      label { font-size:.72rem; font-weight:700; color: var(--color-text-muted); text-transform:uppercase; letter-spacing:.04em; small { text-transform:none; font-weight:500; } } .pk__input { width:100%; } }
    .pk__cos { display:flex; gap:6px; flex-wrap:wrap; }
    .pk__co { display:inline-flex; align-items:center; gap:6px; padding:4px 10px 4px 4px; border-radius:999px; border:2px solid var(--color-line); background: var(--color-surface); font: inherit; font-size:.85rem; font-weight:800; cursor:pointer;
      img { width:26px; height:26px; border-radius:50%; object-fit:cover; } &.on { border-color: var(--color-primary); background: var(--color-primary-soft); color: var(--color-primary); } }

    .pk__foot { display:flex; align-items:center; gap:10px; padding:10px 20px; border-top:1px solid var(--color-line); background: var(--color-surface);
      .pk__status { flex:1; display:flex; align-items:center; gap:6px; font-size:.86rem; color: var(--color-text-muted); mat-icon { font-size:18px; width:18px; height:18px; } } mat-spinner { display:inline-block; margin-right:6px; } }

    @media (max-width: 860px) { .pk { height: 94vh; } .pk__body { grid-template-columns: 1fr; overflow:auto; } .pk__col { overflow:visible; &--doc { border-right:0; border-bottom:1px solid var(--color-line); } } .pk__head { flex-wrap:wrap; } .pk__modes { order:3; width:100%; } }
  `]
})
export class PackUploadDialogComponent {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private sanitizer = inject(DomSanitizer);
  private ref = inject(MatDialogRef<PackUploadDialogComponent>);
  private data = inject<{ mode?: PackMode; invoiceNumber?: string } | null>(MAT_DIALOG_DATA, { optional: true });
  private api = environment.apiUrl;

  static open(dialog: MatDialog, data: { mode?: PackMode; invoiceNumber?: string } = {}) {
    return dialog.open(PackUploadDialogComponent, { width: 'min(1120px, 96vw)', maxWidth: '96vw', maxHeight: '94vh', panelClass: 'pack-dialog-panel', data, disableClose: true, autoFocus: false });
  }

  kinds = PACK_KINDS;
  companyCodes = ['PMT', 'ACM', 'PHT', 'SBT'];
  companyNames = COMPANY_NAMES;
  logo = companyLogo;

  mode = signal<PackMode>(this.data?.mode ?? 'scan');
  dragging = signal(false);
  scanFile = signal<File | null>(null);
  scanUrl = signal<SafeResourceUrl | null>(null);
  scanIsPdf = signal(true);
  showPreview = signal(false);
  parts = signal<Part[]>([]);

  detecting = signal(false);
  detect = signal<DetectResult | null>(null);
  analysis = computed(() => this.detect()?.analysis ?? null);
  invoice = signal(this.data?.invoiceNumber ?? '');
  verified = signal(false);
  verifying = signal(false);
  lookup = signal<{ invoiceNumber: string; inSage: boolean; sage: SageHit | null; existingPacks: { id: number; packNumber: string; uploadedAt: string }[] } | null>(null);
  allowDuplicate = false;

  company: string | null = null;
  orderNumber = ''; confirmationNumber = ''; customerNumber = ''; customerName = ''; invoiceDate = ''; invoiceTotal: number | null = null; notes = '';
  /** Scan mode checklist — seeded from the analysis, user can override. */
  contents = signal<Record<string, boolean>>({ DeliveryNote: false, TaxInvoice: false, OrderConfirmation: false, OrderEmail: false, OrderForm: false });

  saving = signal(false);
  error = signal('');

  hasFiles = computed(() => this.mode() === 'scan' ? !!this.scanFile() : this.parts().length > 0);
  invoiceValid = computed(() => /^IN\d{5,7}$/.test(this.normalize(this.invoice())));
  canSave = computed(() => this.hasFiles() && this.verified() && !!this.company && !(this.lookup()?.existingPacks.length && !this.allowDuplicate));

  setMode(m: PackMode): void { if (m !== this.mode()) { this.mode.set(m); this.error.set(''); } }

  // ───── files ─────
  onDragOver(e: DragEvent): void { e.preventDefault(); this.dragging.set(true); }
  onDrop(e: DragEvent): void { e.preventDefault(); this.dragging.set(false); if (e.dataTransfer?.files?.length) this.addFiles(e.dataTransfer.files); }
  onPick(e: Event): void { const input = e.target as HTMLInputElement; if (input.files?.length) this.addFiles(input.files); input.value = ''; }

  private addFiles(list: FileList): void {
    const files = Array.from(list).filter(f => /\.(pdf|jpe?g|png)$/i.test(f.name));
    if (!files.length) { this.toast.warn('Only PDF, JPG or PNG files are accepted.'); return; }
    if (this.mode() === 'scan') {
      const f = files[0];
      this.scanFile.set(f);
      this.scanIsPdf.set(f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
      this.scanUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(URL.createObjectURL(f)));
      this.runDetect(f);
    } else {
      const added: Part[] = files.map(f => ({ file: f, kind: this.guessKind(f.name), isPdf: /\.pdf$/i.test(f.name) }));
      this.parts.update(p => [...p, ...added]);
      if (!this.invoice() && !this.detect()) {
        const probe = added.find(p => p.kind === 'TaxInvoice') ?? added.find(p => p.isPdf) ?? added[0];
        if (probe) this.runDetect(probe.file);
      }
    }
  }

  private guessKind(name: string): string {
    const n = name.toLowerCase();
    if (/deliver|\bdn\b|pod/.test(n)) return 'DeliveryNote';
    if (/invoice|\binv\b|^in\d/.test(n)) return 'TaxInvoice';
    if (/confirm|\bord\d/.test(n)) return 'OrderConfirmation';
    if (/mail|screenshot|screen/.test(n)) return 'OrderEmail';
    if (/order|\bpo\b|\bor-?\d/.test(n)) return 'OrderForm';
    return 'Other';
  }

  clearScan(): void { this.scanFile.set(null); this.scanUrl.set(null); this.detect.set(null); this.showPreview.set(false); this.resetVerify(); }
  removePart(i: number): void { this.parts.update(p => p.filter((_, idx) => idx !== i)); }
  movePart(i: number, dir: -1 | 1): void { this.parts.update(p => { const a = [...p]; const j = i + dir; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; }); }

  // ───── contents ─────
  kindPresent(k: { key: string }): boolean { return this.mode() === 'scan' ? !!this.contents()[k.key] : this.parts().some(p => p.kind === k.key); }
  toggleContent(key: string): void { this.contents.update(c => ({ ...c, [key]: !c[key] })); }
  pagesFor(code: string): string {
    const a = this.analysis(); if (!a) return '';
    const pages = a.pages.filter(p => p.type === code && !p.duplicate).map(p => p.page);
    return pages.length ? `p${pages.join(', p')}` : '';
  }

  // ───── detect ─────
  private async runDetect(file: File): Promise<void> {
    this.detecting.set(true); this.detect.set(null); this.error.set('');
    try {
      const form = new FormData(); form.append('file', file);
      const r = await firstValueFrom(this.http.post<DetectResult>(`${this.api}/finance/packs/detect`, form));
      this.detect.set(r);
      if (r.analysis && r.analysis.status !== 'UNKNOWN') {
        const found = new Set(r.analysis.typesFound);
        this.contents.set(Object.fromEntries(this.kinds.map(k => [k.key, found.has(k.code)])));
      } else if (this.mode() === 'scan') {
        // Unreadable scan: assume complete and let the user untick.
        this.contents.set(Object.fromEntries(this.kinds.map(k => [k.key, true])));
      }
      if (r.invoiceNumber && !this.invoice()) this.invoice.set(r.invoiceNumber);
      if (r.orderNumber && !this.orderNumber) this.orderNumber = r.orderNumber;
      if (r.confirmationNumber && !this.confirmationNumber) this.confirmationNumber = r.confirmationNumber;
      if (r.customerNumber && !this.customerNumber) this.customerNumber = r.customerNumber;
      if (r.company && !this.company) this.company = r.company;
      if (r.sage) this.applySage(r.sage);
    } catch (e: any) {
      this.detect.set({ method: 'none', pages: 0, invoiceNumber: null, candidates: [], sageMatches: [], orderNumber: null, confirmationNumber: null, customerNumber: null, company: null, sage: null, existingPacks: [], ocrAvailable: false, analysis: null });
      if (this.mode() === 'scan') this.contents.set(Object.fromEntries(this.kinds.map(k => [k.key, true])));
      this.toast.warn(e?.error?.error || "Couldn't read the document automatically — type the invoice number in.");
    } finally { this.detecting.set(false); }
  }

  pickCandidate(c: string): void { this.invoice.set(c); this.resetVerify(); }
  onInvoiceInput(v: string): void { this.invoice.set((v ?? '').toUpperCase()); this.resetVerify(); }
  private resetVerify(): void { this.verified.set(false); this.lookup.set(null); this.allowDuplicate = false; }
  private normalize(v: string): string { return (v ?? '').toUpperCase().replace(/[\s\-_.:#]/g, ''); }

  // ───── verify ─────
  async verify(): Promise<void> {
    const inv = this.normalize(this.invoice());
    if (!/^IN\d{5,7}$/.test(inv)) return;
    this.invoice.set(inv); this.verifying.set(true); this.error.set('');
    try {
      const r = await firstValueFrom(this.http.get<any>(`${this.api}/finance/packs/lookup/${encodeURIComponent(inv)}`, { params: this.company ? { company: this.company } : {} }));
      this.lookup.set(r);
      if (r.sage) this.applySage(r.sage);
      this.verified.set(true);
    } catch { this.error.set("Couldn't check the invoice against Sage. Try again."); }
    finally { this.verifying.set(false); }
  }

  private applySage(s: SageHit): void {
    if (!this.company && s.company) this.company = s.company;
    if (!this.customerNumber) this.customerNumber = s.customerNumber;
    if (!this.customerName) this.customerName = s.customerName;
    if (!this.orderNumber && s.orderNumber) this.orderNumber = s.orderNumber;
    if (!this.invoiceDate && s.date) this.invoiceDate = s.date.substring(0, 10);
    if (this.invoiceTotal == null && s.total != null) this.invoiceTotal = Math.round(s.total * 100) / 100;
  }

  // ───── save ─────
  save(): void {
    if (!this.canSave()) return;
    this.saving.set(true); this.error.set('');
    const form = new FormData();
    form.append('invoiceNumber', this.invoice());
    form.append('invoiceVerified', 'true');
    form.append('allowDuplicate', String(this.allowDuplicate));
    if (this.company) form.append('company', this.company);
    if (this.orderNumber) form.append('orderNumber', this.orderNumber.trim());
    if (this.confirmationNumber) form.append('confirmationNumber', this.confirmationNumber.trim());
    if (this.customerNumber) form.append('customerNumber', this.customerNumber.trim());
    if (this.customerName) form.append('customerName', this.customerName.trim());
    if (this.invoiceDate) form.append('invoiceDate', this.invoiceDate);
    if (this.invoiceTotal != null) form.append('invoiceTotal', String(this.invoiceTotal));
    if (this.notes) form.append('notes', this.notes.trim());

    let url: string;
    if (this.mode() === 'scan') {
      url = `${this.api}/finance/packs/upload`;
      form.append('file', this.scanFile()!);
      const c = this.contents();
      for (const k of this.kinds) form.append(`has${k.key}`, String(!!c[k.key]));
      const a = this.analysis(); if (a) form.append('analysisJson', JSON.stringify(a));
    } else {
      url = `${this.api}/finance/packs/assemble`;
      this.parts().forEach(p => { form.append('files', p.file); form.append('kinds', p.kind); });
    }
    this.http.post<any>(url, form).subscribe({
      next: r => { this.saving.set(false); this.toast.info(`Pack ${r?.pack?.packNumber ?? ''} saved for ${this.invoice()}.`); this.ref.close(r?.pack ?? true); },
      error: e => { this.saving.set(false); this.error.set(e?.error?.error || e?.error?.message || 'Saving the pack failed.'); },
    });
  }

  fmtSize(b: number): string { return b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`; }
}
