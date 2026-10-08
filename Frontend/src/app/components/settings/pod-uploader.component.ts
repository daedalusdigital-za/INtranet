import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

type PodStatus = 'pending' | 'uploading' | 'done' | 'error';

interface PodEntry {
  file: File;
  invoiceNumbers: string;   // raw, comma/space separated
  notes: string;
  status: PodStatus;
  message?: string;
  matched?: string[];
  unmatched?: string[];
  loadNumber?: string | null;
  duplicateWarning?: string | null;   // set if a POD with the same filename already exists
  previewUrl?: string | null;
  isImage: boolean;
  isPdf?: boolean;      // true when the file is a PDF (previewable in an iframe)
  rotation: number;   // 0, 90, 180, 270 — baked into the file on upload
  detecting?: boolean;      // Welly OCR detection in progress
  detectMsg?: string;       // result message from detection
  detectElapsed?: number;   // seconds elapsed during detection (for progress feedback)
  deliveryDate?: string;    // yyyy-MM-dd — per-file delivery date (overrides the batch date)
  dateFromName?: boolean;   // true when the date was auto-parsed from the filename
}

/**
 * Admin Center — multi-POD uploader.
 *
 * Upload many Proof-of-Delivery files at once and, per file, tag the invoice
 * numbers that POD covers (no driver — unlike the sales POD uploader). Each
 * file is posted to /api/PodDocuments/upload-with-invoices, which stores the
 * file and links the typed invoice numbers (OCR-tolerant) to the POD.
 */
@Component({
  selector: 'app-pod-uploader',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
  <div class="pu">
    <div class="pu__intro">
      <mat-icon>fact_check</mat-icon>
      <div>
        <h3>Upload PODs — auto-dated &amp; AI-matched</h3>
        <p>Drop in multiple proof-of-delivery files. Welly reads a delivery <strong>date from each file name</strong> and <strong>scans the document</strong> to find &amp; match the invoice numbers automatically. Review, correct or add numbers per file, then upload — unmatched numbers are kept <strong>pending</strong> and linked when those invoices arrive.</p>
      </div>
    </div>

    <!-- Delivery date (back-dating supported) -->
    <div class="pu__date">
      <mat-icon>event</mat-icon>
      <label for="pu-date">Delivery date</label>
      <input id="pu-date" type="date" [(ngModel)]="deliveryDate" [max]="today" />
      <span class="pu__date-hint">Batch fallback date · used only when a file has no date. Dates found in file names are applied automatically per file.</span>
    </div>

    <!-- Drop / pick zone -->
    <label class="pu__drop" [class.pu__drop--drag]="dragging()"
           (dragover)="onDragOver($event)" (dragleave)="dragging.set(false)" (drop)="onDrop($event)">
      <input type="file" multiple hidden
             accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.zip"
             (change)="onPick($event)" />
      <mat-icon>cloud_upload</mat-icon>
      <span class="pu__drop-title">Drag &amp; drop PODs here, or click to browse</span>
      <span class="pu__drop-hint">PDF, images, Excel or ZIP · up to 20 MB each · multiple files supported</span>
    </label>

    @if (entries().length) {
      <div class="pu__bulkbar">
        <span class="pu__bulkstat">{{ entries().length }} file(s) · {{ readyCount() }} ready · {{ doneCount() }} uploaded @if (matchedTotal() > 0) { · <strong>{{ matchedTotal() }} invoice(s) matched</strong> }</span>
        <span class="pu__spacer"></span>
        <label class="pu__autoscan" title="Automatically run Welly on each file as it is added">
          <input type="checkbox" [(ngModel)]="autoScan" />
          <mat-icon>auto_awesome</mat-icon> Auto-scan on add
        </label>
        <button class="pu__btn" (click)="clearAll()" [disabled]="uploadingAny() || scanningAny()">
          <mat-icon>clear_all</mat-icon> Clear
        </button>
        <button class="pu__btn pu__btn--scan" (click)="scanAll()" [disabled]="scanningAny() || uploadingAny() || pendingScanCount() === 0"
                title="Run Welly on every file that hasn't been scanned yet">
          @if (scanningAny()) {
            <mat-icon class="pu-spin">radar</mat-icon> Scanning {{ scanDoneCount() }}/{{ scanTotal() }}…
          } @else {
            <mat-icon>document_scanner</mat-icon> Scan all ({{ pendingScanCount() }})
          }
        </button>
        <button class="pu__btn pu__btn--primary" (click)="uploadAll()" [disabled]="uploadingAny() || scanningAny() || readyCount() === 0">
          <mat-icon>upload</mat-icon> Upload all ({{ readyCount() }})
        </button>
      </div>

      <div class="pu__list">
        @for (e of entries(); track e.file.name + e.file.size + $index) {
          <div class="pu-row" [class.pu-row--done]="e.status==='done'" [class.pu-row--error]="e.status==='error'">
            <div class="pu-row__thumb" [class.pu-row__thumb--clickable]="e.isImage || e.isPdf"
                 (click)="(e.isImage || e.isPdf) && openPreview($index)"
                 [title]="(e.isImage || e.isPdf) ? 'Click to preview' : ''">
              @if (e.isImage && e.previewUrl) {
                <img [src]="e.previewUrl" alt="preview" [style.transform]="'rotate(' + e.rotation + 'deg)'" />
              } @else {
                <mat-icon>{{ fileIcon(e.file.name) }}</mat-icon>
              }
              @if (e.isImage || e.isPdf) {
                <span class="pu-row__thumb-eye"><mat-icon>zoom_in</mat-icon></span>
              }
            </div>

            @if (e.isImage && e.previewUrl && e.status !== 'done') {
              <div class="pu-row__rotate">
                <button type="button" (click)="rotate($index, -90)" title="Rotate left"><mat-icon>rotate_left</mat-icon></button>
                <button type="button" (click)="rotate($index, 90)" title="Rotate right"><mat-icon>rotate_right</mat-icon></button>
              </div>
            }

            <div class="pu-row__body">
              <div class="pu-row__name" [title]="e.file.name">{{ e.file.name }}</div>
              <div class="pu-row__meta">
                {{ humanSize(e.file.size) }}
                @if (e.isImage || e.isPdf) {
                  <button type="button" class="pu-row__view" (click)="openPreview($index)">
                    <mat-icon>visibility</mat-icon> Preview
                  </button>
                }
              </div>

              @if (e.duplicateWarning) {
                <div class="pu-row__dup">
                  <mat-icon>warning</mat-icon>
                  {{ e.duplicateWarning }}
                </div>
              }

              <label class="pu-row__label">Invoice number(s)</label>
              <div class="pu-row__invrow">
                <input class="pu-row__input" type="text"
                       [(ngModel)]="e.invoiceNumbers"
                       [disabled]="e.status==='uploading' || e.status==='done'"
                       placeholder="e.g. IN123456, IN123457" />
                @if (e.status !== 'done') {
                  <button type="button" class="pu-row__detect"
                          (click)="detectInvoices($index)"
                          [disabled]="e.detecting || e.status==='uploading'"
                          title="Welly reads invoice numbers off the scan (auto-rotates pages)">
                    @if (e.detecting) {
                      <mat-icon class="pu-spin">progress_activity</mat-icon> Scanning…
                    } @else {
                      <mat-icon>auto_awesome</mat-icon> Detect
                    }
                  </button>
                }
              </div>
              @if (e.detecting) {
                <div class="pu-row__scanning">
                  <div class="pu-row__scanbar"><span class="pu-row__scanfill"></span></div>
                  <div class="pu-row__scanlabel">
                    <mat-icon class="pu-spin">radar</mat-icon>
                    Welly is reading the document (auto-rotating &amp; scanning)… {{ e.detectElapsed || 0 }}s
                  </div>
                </div>
              }
              @if (e.detectMsg) {
                <div class="pu-row__detectmsg">{{ e.detectMsg }}</div>
              }

              <input class="pu-row__notes" type="text"
                     [(ngModel)]="e.notes"
                     [disabled]="e.status==='uploading' || e.status==='done'"
                     placeholder="Notes (optional)" />

              <div class="pu-row__daterow">
                <label class="pu-row__label" [for]="'pu-date-' + $index">Delivery date</label>
                <input class="pu-row__date" type="date" [id]="'pu-date-' + $index"
                       [(ngModel)]="e.deliveryDate" [max]="today"
                       (ngModelChange)="e.dateFromName = false"
                       [disabled]="e.status==='uploading' || e.status==='done'" />
                @if (e.dateFromName) {
                  <span class="pu-row__datehint pu-row__datehint--auto" title="Detected from the file name">
                    <mat-icon>auto_awesome</mat-icon> from filename
                  </span>
                } @else if (!e.deliveryDate) {
                  <span class="pu-row__datehint">uses batch date ({{ deliveryDate }})</span>
                }
              </div>

              @if (e.message) {
                <div class="pu-row__msg" [class.ok]="e.status==='done'" [class.err]="e.status==='error'">
                  <mat-icon>{{ e.status==='done' ? 'check_circle' : (e.status==='error' ? 'error' : 'info') }}</mat-icon>
                  {{ e.message }}
                </div>
              }
              @if (e.matched?.length) {
                <div class="pu-row__chips">
                  @for (n of e.matched; track n) { <span class="pu-chip pu-chip--ok">{{ n }}</span> }
                  @for (n of e.unmatched || []; track n) { <span class="pu-chip pu-chip--warn" title="Not found">{{ n }}?</span> }
                </div>
              }
            </div>

            <div class="pu-row__ops">
              @if (e.status==='uploading') {
                <mat-icon class="pu-spin">progress_activity</mat-icon>
              } @else if (e.status==='done') {
                <mat-icon class="pu-ok">check_circle</mat-icon>
              } @else {
                <button class="pu-row__x" (click)="removeAt($index)" title="Remove">
                  <mat-icon>close</mat-icon>
                </button>
              }
            </div>
          </div>
        }
      </div>
    }

    <!-- Full-size POD previewer (lightbox) -->
    @if (preview(); as p) {
      <div class="pu-lb" (click)="closePreview()">
        <div class="pu-lb__panel" (click)="$event.stopPropagation()">
          <div class="pu-lb__bar">
            <mat-icon>{{ p.isPdf ? 'picture_as_pdf' : 'image' }}</mat-icon>
            <span class="pu-lb__name" [title]="p.file.name">{{ p.file.name }}</span>
            @if (p.isImage) {
              <button class="pu-lb__iconbtn" (click)="rotatePreview(-90)" title="Rotate left"><mat-icon>rotate_left</mat-icon></button>
              <button class="pu-lb__iconbtn" (click)="rotatePreview(90)" title="Rotate right"><mat-icon>rotate_right</mat-icon></button>
            }
            <span class="pu-lb__spacer"></span>
            <button class="pu-lb__iconbtn" (click)="closePreview()" title="Close"><mat-icon>close</mat-icon></button>
          </div>
          <div class="pu-lb__stage">
            @if (p.isImage && p.previewUrl) {
              <img [src]="p.previewUrl" alt="POD preview" [style.transform]="'rotate(' + p.rotation + 'deg)'" />
            } @else if (p.isPdf && previewSafeUrl()) {
              <iframe [src]="previewSafeUrl()" title="POD PDF preview"></iframe>
            }
          </div>
          <div class="pu-lb__hint">
            Read the invoice number(s) off the document, then close this preview and type them into the field.
          </div>
        </div>
      </div>
    }
  </div>
  `,
  styles: [`
    .pu { padding: 8px 4px; }
    .pu__intro { display:flex; gap:12px; align-items:flex-start; margin-bottom:16px; }
    .pu__intro > mat-icon { color:#4f46e5; font-size:32px; width:32px; height:32px; }
    .pu__intro h3 { margin:0; font-size:1.05rem; color:#0f172a; }
    .pu__intro p { margin:2px 0 0; font-size:0.85rem; color:#64748b; max-width:640px; }

    .pu__drop {
      display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px;
      border:2px dashed #c7cbf5; border-radius:16px; padding:32px 16px; cursor:pointer;
      background:linear-gradient(180deg,#fbfbff,#f4f4ff); transition:border-color .2s, background .2s;
    }
    .pu__drop:hover, .pu__drop--drag { border-color:#6366f1; background:#eef0ff; }
    .pu__drop > mat-icon { font-size:40px; width:40px; height:40px; color:#6366f1; }
    .pu__drop-title { font-weight:700; color:#334155; }
    .pu__drop-hint { font-size:0.78rem; color:#94a3b8; }

    .pu__bulkbar { display:flex; align-items:center; gap:10px; margin:16px 0 10px; font-size:0.84rem; color:#475569; flex-wrap:wrap; }
    .pu__bulkstat strong { color:#4f46e5; }
    .pu__spacer { flex:1; }
    .pu__autoscan { display:inline-flex; align-items:center; gap:5px; font-size:0.8rem; color:#4f46e5; font-weight:600; cursor:pointer; user-select:none; padding:4px 8px; background:#eef2ff; border-radius:20px; }
    .pu__autoscan input { accent-color:#4f46e5; cursor:pointer; }
    .pu__autoscan mat-icon { font-size:16px; width:16px; height:16px; }
    .pu__btn {
      display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border:1px solid #e2e8f0;
      border-radius:10px; background:#fff; color:#334155; font-weight:600; font-size:0.82rem; cursor:pointer;
    }
    .pu__btn:hover { background:#f8fafc; }
    .pu__btn--scan { border-color:#c7d2fe; background:#eef2ff; color:#4f46e5; }
    .pu__btn--scan:hover { background:#e0e7ff; }
    .pu__btn--primary { background:linear-gradient(120deg,#6366f1,#4f46e5); border-color:transparent; color:#fff; }
    .pu__btn--primary:hover { background:linear-gradient(120deg,#4f46e5,#4338ca); }
    .pu__btn[disabled] { opacity:0.5; cursor:not-allowed; }
    .pu__btn mat-icon { font-size:18px; width:18px; height:18px; }

    .pu__list { display:flex; flex-direction:column; gap:10px; }
    .pu-row {
      display:flex; gap:12px; align-items:flex-start; padding:12px;
      border:1px solid #e2e8f0; border-radius:14px; background:#fff;
    }
    .pu-row--done { border-color:#a7f3d0; background:#f0fdf9; }
    .pu-row--error { border-color:#fca5a5; background:#fef2f2; }
    .pu-row__thumb {
      width:56px; height:56px; border-radius:10px; overflow:hidden; flex-shrink:0;
      display:flex; align-items:center; justify-content:center; background:#f1f5f9; color:#6366f1;
      position:relative;
    }
    .pu-row__thumb--clickable { cursor:zoom-in; }
    .pu-row__thumb--clickable:hover .pu-row__thumb-eye { opacity:1; }
    .pu-row__thumb-eye {
      position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
      background:rgba(15,23,42,0.45); color:#fff; opacity:0; transition:opacity .15s ease;
    }
    .pu-row__thumb-eye mat-icon { font-size:22px; width:22px; height:22px; }
    .pu-row__thumb img { width:100%; height:100%; object-fit:cover; transition:transform .2s ease; }
    .pu-row__thumb mat-icon { font-size:28px; width:28px; height:28px; }
    .pu-row__rotate { display:flex; flex-direction:column; gap:4px; flex-shrink:0; }
    .pu-row__rotate button {
      border:1px solid #e2e8f0; background:#fff; border-radius:8px; cursor:pointer;
      color:#6366f1; display:inline-flex; align-items:center; justify-content:center; padding:4px;
    }
    .pu-row__rotate button:hover { background:#eef0ff; }
    .pu-row__rotate mat-icon { font-size:18px; width:18px; height:18px; }
    .pu-row__body { flex:1; min-width:0; }
    .pu-row__name { font-weight:700; color:#0f172a; font-size:0.9rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .pu-row__meta { font-size:0.72rem; color:#94a3b8; margin-bottom:6px; display:flex; align-items:center; gap:8px; }
    .pu-row__view {
      display:inline-flex; align-items:center; gap:3px; border:1px solid #e2e8f0; background:#fff;
      border-radius:7px; padding:2px 7px; font-size:0.72rem; font-weight:600; color:#4f46e5; cursor:pointer;
    }
    .pu-row__view:hover { background:#eef0ff; }
    .pu-row__view mat-icon { font-size:14px; width:14px; height:14px; }
    .pu-row__label { display:block; font-size:0.68rem; text-transform:uppercase; letter-spacing:0.4px; color:#64748b; font-weight:700; margin-bottom:3px; }
    .pu-row__input, .pu-row__notes {
      width:100%; padding:8px 11px; border:1px solid #cbd5e1; border-radius:9px; font-size:0.86rem; margin-bottom:6px;
    }
    .pu-row__input { font-family:monospace; }
    .pu-row__input:focus, .pu-row__notes:focus { outline:none; border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,0.15); }
    .pu-row__invrow { display:flex; align-items:flex-start; gap:8px; }
    .pu-row__invrow .pu-row__input { flex:1; margin-bottom:6px; }
    .pu-row__detect {
      flex:0 0 auto; display:inline-flex; align-items:center; gap:5px; white-space:nowrap;
      padding:8px 12px; border:1px solid #c7d2fe; background:#eef2ff; color:#4f46e5;
      border-radius:9px; cursor:pointer; font-size:0.8rem; font-weight:600; height:37px;
    }
    .pu-row__detect:hover:not(:disabled) { background:#e0e7ff; }
    .pu-row__detect:disabled { opacity:0.6; cursor:default; }
    .pu-row__detect mat-icon { font-size:17px; width:17px; height:17px; }
    .pu-row__detectmsg { font-size:0.76rem; color:#475569; margin:-2px 0 6px; }
    .pu-row__daterow { display:flex; align-items:center; gap:8px; margin:2px 0 6px; flex-wrap:wrap; }
    .pu-row__daterow .pu-row__label { margin:0; }
    .pu-row__date { border:1px solid #cbd5e1; border-radius:8px; padding:6px 9px; font-size:0.82rem; }
    .pu-row__date:focus { outline:none; border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,0.15); }
    .pu-row__datehint { font-size:0.74rem; color:#94a3b8; }
    .pu-row__datehint--auto { display:inline-flex; align-items:center; gap:3px; color:#4f46e5; font-weight:600; background:#eef2ff; padding:2px 7px; border-radius:20px; }
    .pu-row__datehint--auto mat-icon { font-size:14px; width:14px; height:14px; }
    .pu-row__scanning { margin:2px 0 8px; }
    .pu-row__scanbar { position:relative; height:6px; border-radius:6px; background:#e0e7ff; overflow:hidden; }
    .pu-row__scanfill {
      position:absolute; left:0; top:0; height:100%; width:40%; border-radius:6px;
      background:linear-gradient(90deg,#6366f1,#818cf8); animation:pu-scan 1.2s ease-in-out infinite;
    }
    @keyframes pu-scan {
      0% { left:-40%; } 100% { left:100%; }
    }
    .pu-row__scanlabel { display:flex; align-items:center; gap:6px; font-size:0.76rem; color:#4f46e5; margin-top:5px; }
    .pu-row__scanlabel mat-icon { font-size:16px; width:16px; height:16px; }
    .pu__date { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:14px; padding:10px 12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; }
    .pu__date > mat-icon { color:#4f46e5; }
    .pu__date label { font-size:0.85rem; font-weight:600; color:#334155; }
    .pu__date input[type=date] { border:1px solid #cbd5e1; border-radius:8px; padding:6px 10px; font-size:0.85rem; }
    .pu__date input[type=date]:focus { outline:none; border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,0.15); }
    .pu__date-hint { font-size:0.78rem; color:#64748b; }
    .pu-row__dup { display:flex; align-items:center; gap:5px; font-size:0.78rem; font-weight:600; color:#b45309; background:#fffbeb; border:1px solid #fde68a; border-radius:6px; padding:4px 8px; margin:4px 0; }
    .pu-row__dup mat-icon { font-size:16px; width:16px; height:16px; }
    .pu-row__msg { display:flex; align-items:center; gap:5px; font-size:0.78rem; color:#475569; margin-top:2px; }
    .pu-row__msg.ok { color:#047857; } .pu-row__msg.err { color:#b91c1c; }
    .pu-row__msg mat-icon { font-size:16px; width:16px; height:16px; }
    .pu-row__chips { display:flex; flex-wrap:wrap; gap:5px; margin-top:6px; }
    .pu-chip { font-size:0.7rem; font-weight:700; padding:2px 8px; border-radius:999px; font-family:monospace; }
    .pu-chip--ok { background:#ecfdf5; color:#047857; }
    .pu-chip--warn { background:#fffbeb; color:#b45309; }
    .pu-row__ops { display:flex; align-items:center; }
    .pu-row__x { border:none; background:transparent; cursor:pointer; color:#94a3b8; display:inline-flex; }
    .pu-row__x:hover { color:#ef4444; }
    .pu-ok { color:#10b981; } .pu-spin { color:#6366f1; animation:pu-spin 1s linear infinite; }
    @keyframes pu-spin { to { transform:rotate(360deg); } }

    /* Lightbox previewer */
    .pu-lb {
      position:fixed; inset:0; z-index:1200; background:rgba(15,23,42,0.72);
      display:flex; align-items:center; justify-content:center; padding:24px;
      animation:pu-fade .12s ease;
    }
    @keyframes pu-fade { from { opacity:0; } to { opacity:1; } }
    .pu-lb__panel {
      background:#fff; border-radius:14px; width:min(920px, 96vw); height:min(90vh, 900px);
      display:flex; flex-direction:column; overflow:hidden; box-shadow:0 24px 60px rgba(0,0,0,0.4);
    }
    .pu-lb__bar { display:flex; align-items:center; gap:10px; padding:12px 14px; border-bottom:1px solid #e2e8f0; }
    .pu-lb__bar > mat-icon { color:#4f46e5; }
    .pu-lb__name { font-weight:700; color:#0f172a; font-size:0.9rem; max-width:420px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .pu-lb__spacer { flex:1; }
    .pu-lb__iconbtn {
      border:1px solid #e2e8f0; background:#fff; border-radius:8px; cursor:pointer;
      color:#475569; display:inline-flex; align-items:center; justify-content:center; padding:5px;
    }
    .pu-lb__iconbtn:hover { background:#f1f5f9; color:#4f46e5; }
    .pu-lb__iconbtn mat-icon { font-size:18px; width:18px; height:18px; }
    .pu-lb__stage { flex:1; min-height:0; background:#0f172a; display:flex; align-items:center; justify-content:center; overflow:auto; }
    .pu-lb__stage img { max-width:100%; max-height:100%; object-fit:contain; transition:transform .2s ease; }
    .pu-lb__stage iframe { width:100%; height:100%; border:0; background:#fff; }
    .pu-lb__hint { padding:9px 14px; font-size:0.78rem; color:#64748b; background:#f8fafc; border-top:1px solid #e2e8f0; }
  `]
})
export class PodUploaderComponent {
  private readonly http = inject(HttpClient);
  private readonly snack = inject(MatSnackBar);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly apiUrl = environment.apiUrl;

  readonly entries = signal<PodEntry[]>([]);
  readonly dragging = signal(false);

  /** Index of the entry currently open in the lightbox, or null. */
  private readonly previewIndex = signal<number | null>(null);
  /** The entry currently open in the previewer (null when closed). */
  readonly preview = signal<PodEntry | null>(null);
  /** Sanitized blob URL for embedding a PDF in the preview iframe. */
  readonly previewSafeUrl = signal<SafeResourceUrl | null>(null);

  /** yyyy-MM-dd — today's date, used as the max and default for the picker. */
  readonly today = new Date().toISOString().slice(0, 10);
  /** Bulk delivery date applied to every POD in the batch (back-datable). */
  deliveryDate = this.today;
  /** When true, Welly automatically scans each file for invoices as it's added. */
  autoScan = true;

  readyCount(): number { return this.entries().filter(e => e.status === 'pending' || e.status === 'error').length; }
  doneCount(): number { return this.entries().filter(e => e.status === 'done').length; }
  uploadingAny(): boolean { return this.entries().some(e => e.status === 'uploading'); }
  scanningAny(): boolean { return this.entries().some(e => e.detecting); }
  matchedTotal(): number { return this.entries().reduce((n, e) => n + (e.matched?.length || 0), 0); }
  /** Files that can be scanned (image/PDF) and haven't been scanned yet. */
  pendingScanCount(): number {
    return this.entries().filter(e => (e.isImage || e.isPdf) && !e.detecting && !e.detectMsg && e.status !== 'done').length;
  }
  scanTotal(): number { return this.entries().filter(e => e.isImage || e.isPdf).length; }
  scanDoneCount(): number { return this.entries().filter(e => (e.isImage || e.isPdf) && !!e.detectMsg).length; }

  onPick(evt: Event): void {
    const input = evt.target as HTMLInputElement;
    if (input.files?.length) this.addFiles(input.files);
    input.value = '';
  }
  onDragOver(evt: DragEvent): void { evt.preventDefault(); this.dragging.set(true); }
  onDrop(evt: DragEvent): void {
    evt.preventDefault();
    this.dragging.set(false);
    if (evt.dataTransfer?.files?.length) this.addFiles(evt.dataTransfer.files);
  }

  private addFiles(files: FileList): void {
    const additions: PodEntry[] = Array.from(files).map(file => {
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const parsed = this.parseDateFromFilename(file.name);
      return {
        file, invoiceNumbers: '', notes: '', status: 'pending' as PodStatus,
        isImage, isPdf,
        previewUrl: (isImage || isPdf) ? URL.createObjectURL(file) : null, rotation: 0,
        deliveryDate: parsed ?? undefined,
        dateFromName: !!parsed
      };
    });
    const startIndex = this.entries().length;
    this.entries.update(list => [...list, ...additions]);
    this.checkDuplicates(additions.map(a => a.file.name));

    // Auto-scan newly added image/PDF files with Welly (throttled to 2 at a time).
    if (this.autoScan) {
      const toScan = additions
        .map((a, i) => ({ a, index: startIndex + i }))
        .filter(x => x.a.isImage || x.a.isPdf)
        .map(x => x.index);
      this.runScanQueue(toScan, 2);
    }
  }

  /** Scan every not-yet-scanned image/PDF file now (Scan all button). */
  scanAll(): void {
    const indices = this.entries()
      .map((e, i) => ({ e, i }))
      .filter(x => (x.e.isImage || x.e.isPdf) && !x.e.detecting && !x.e.detectMsg && x.e.status !== 'done')
      .map(x => x.i);
    this.runScanQueue(indices, 2);
  }

  /** Run detection over a list of entry indices with limited concurrency. */
  private async runScanQueue(indices: number[], concurrency: number): Promise<void> {
    const queue = [...indices];
    const workers: Promise<void>[] = [];
    const next = async (): Promise<void> => {
      const idx = queue.shift();
      if (idx === undefined) return;
      await this.detectInvoices(idx);
      return next();
    };
    for (let i = 0; i < Math.min(concurrency, queue.length); i++) workers.push(next());
    await Promise.all(workers);
  }

  /**
   * Try to extract a delivery date from a POD file name. Handles the common patterns we see:
   *   KZN_Unknown_20260219_1.pdf      → 2026-02-19  (yyyymmdd)
   *   POD 19-02-2026.pdf              → 2026-02-19  (dd-mm-yyyy)
   *   driver_2026-02-19.jpg           → 2026-02-19  (yyyy-mm-dd)
   *   Delivery 19.02.26.pdf           → 2026-02-19  (dd.mm.yy)
   * Returns yyyy-MM-dd, or null if no plausible (not-in-the-future) date is found.
   */
  private parseDateFromFilename(name: string): string | null {
    const base = name.replace(/\.[^.]+$/, ''); // drop extension
    const todayStr = this.today;

    const valid = (y: number, m: number, d: number): string | null => {
      if (m < 1 || m > 12 || d < 1 || d > 31) return null;
      const dt = new Date(y, m - 1, d);
      if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null; // real calendar date
      const iso = `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      if (iso > todayStr) return null;          // never accept a future date
      if (y < 2015) return null;                // guard against random 8-digit numbers
      return iso;
    };
    const y2 = (yy: number) => 2000 + yy;       // 2-digit year → 20yy

    // 1) yyyymmdd (8 contiguous digits) — must not be part of a longer digit run.
    for (const m of base.matchAll(/(?<!\d)(\d{4})(\d{2})(\d{2})(?!\d)/g)) {
      const r = valid(+m[1], +m[2], +m[3]);
      if (r) return r;
    }
    // 2) yyyy-mm-dd / yyyy.mm.dd / yyyy_mm_dd
    for (const m of base.matchAll(/(?<!\d)(\d{4})[-_.](\d{1,2})[-_.](\d{1,2})(?!\d)/g)) {
      const r = valid(+m[1], +m[2], +m[3]);
      if (r) return r;
    }
    // 3) dd-mm-yyyy / dd.mm.yyyy / dd_mm_yyyy
    for (const m of base.matchAll(/(?<!\d)(\d{1,2})[-_.](\d{1,2})[-_.](\d{4})(?!\d)/g)) {
      const r = valid(+m[3], +m[2], +m[1]);
      if (r) return r;
    }
    // 4) dd-mm-yy / dd.mm.yy (2-digit year, last so it doesn't shadow 4-digit years)
    for (const m of base.matchAll(/(?<!\d)(\d{1,2})[-_.](\d{1,2})[-_.](\d{2})(?!\d)/g)) {
      const r = valid(y2(+m[3]), +m[2], +m[1]);
      if (r) return r;
    }
    return null;
  }

  /** Open the full-size previewer for an entry (image or PDF). */
  openPreview(index: number): void {
    const e = this.entries()[index];
    if (!e || !(e.isImage || e.isPdf) || !e.previewUrl) return;
    this.previewIndex.set(index);
    this.preview.set(e);
    this.previewSafeUrl.set(
      e.isPdf ? this.sanitizer.bypassSecurityTrustResourceUrl(e.previewUrl) : null
    );
  }

  /** Close the previewer. */
  closePreview(): void {
    this.previewIndex.set(null);
    this.preview.set(null);
    this.previewSafeUrl.set(null);
  }

  /** Rotate the previewed image (also updates the underlying entry so it bakes in on upload). */
  rotatePreview(delta: number): void {
    const i = this.previewIndex();
    if (i === null) return;
    this.rotate(i, delta);
    this.preview.set(this.entries()[i] ?? null);
  }

  /** Ask the backend whether any of these filenames were uploaded before, and flag those rows. */
  private checkDuplicates(fileNames: string[]): void {
    const names = fileNames.filter(n => !!n);
    if (!names.length) return;
    this.http.post<any>(`${this.apiUrl}/PodDocuments/check-duplicates`, { fileNames: names }).subscribe({
      next: (res) => {
        const dups: any[] = res?.duplicates || [];
        const byName: Record<string, any> = {};
        for (const d of dups) { if (d?.fileName) byName[String(d.fileName).toLowerCase()] = d; }
        this.entries.update(list => list.map(e => {
          const hit = byName[e.file.name.toLowerCase()];
          if (hit && e.status === 'pending' && !e.duplicateWarning) {
            const when = hit.mostRecent?.uploadedAt || hit.mostRecent?.deliveryDate;
            const dateStr = when ? new Date(when).toLocaleDateString() : 'previously';
            return { ...e, duplicateWarning: `Already uploaded ${hit.count > 1 ? hit.count + '\u00d7 ' : ''}(most recent ${dateStr}). Uploading again will create a duplicate.` };
          }
          return e;
        }));
      },
      error: () => { /* non-blocking — duplicate check is best-effort */ }
    });
  }

  removeAt(i: number): void {
    this.entries.update(list => {
      const e = list[i];
      if (e?.previewUrl) URL.revokeObjectURL(e.previewUrl);
      return list.filter((_, idx) => idx !== i);
    });
  }

  /** Rotate an image entry's preview by +/-90 degrees (baked in on upload). */
  rotate(index: number, delta: number): void {
    this.entries.update(list => list.map((e, i) => {
      if (i !== index) return e;
      const rotation = (((e.rotation + delta) % 360) + 360) % 360;
      return { ...e, rotation };
    }));
  }

  /** Render a rotated copy of an image file to a new File via canvas. */
  private bakeRotation(file: File, rotation: number): Promise<File> {
    return new Promise((resolve) => {
      if (!rotation) { resolve(file); return; }
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const swap = rotation === 90 || rotation === 270;
        const canvas = document.createElement('canvas');
        canvas.width = swap ? img.height : img.width;
        canvas.height = swap ? img.width : img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { URL.revokeObjectURL(url); resolve(file); return; }
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return; }
          resolve(new File([blob], file.name, { type: blob.type || file.type }));
        }, file.type || 'image/jpeg', 0.92);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  clearAll(): void {
    this.entries().forEach(e => { if (e.previewUrl) URL.revokeObjectURL(e.previewUrl); });
    this.entries.set([]);
  }

  /** Ask Welly to read invoice numbers off the scan (server OCR, auto-rotating pages). */
  async detectInvoices(index: number): Promise<void> {
    const e = this.entries()[index];
    if (!e || e.detecting) return;
    this.patch(index, { detecting: true, detectMsg: undefined, detectElapsed: 0 });

    // Live elapsed-time ticker so the user has feedback while the server OCR runs.
    const startedAt = Date.now();
    const ticker = setInterval(() => {
      this.patch(index, { detectElapsed: Math.round((Date.now() - startedAt) / 1000) });
    }, 1000);

    // Bake any manual rotation into the image first so the OCR sees it upright too.
    const fileToSend = e.isImage && e.rotation ? await this.bakeRotation(e.file, e.rotation) : e.file;

    const form = new FormData();
    form.append('file', fileToSend);

    try {
      const res: any = await firstValueFrom(
        this.http.post<any>(`${this.apiUrl}/PodDocuments/detect-invoices`, form)
      );
      clearInterval(ticker);
      const matched: string[] = (res?.matches || [])
        .map((m: any) => m.transactionNumber || m.TransactionNumber)
        .filter((n: any) => !!n);
      const candidates: string[] = res?.candidates || [];
      // Merge detected numbers into the existing field (dedupe, keep user's typed ones).
      const existing = (this.entries()[index].invoiceNumbers || '')
        .split(/[\s,;]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
      const all = Array.from(new Set([...existing, ...matched.map(m => m.toUpperCase())]));
      const unmatchedExtra = candidates.filter(c => !all.includes(c.toUpperCase()));

      let msg: string;
      if (matched.length > 0) {
        msg = `Welly found ${matched.length} matching invoice${matched.length === 1 ? '' : 's'}.` +
              (unmatchedExtra.length ? ` (${unmatchedExtra.length} unrecognised: ${unmatchedExtra.join(', ')})` : '');
      } else if (candidates.length > 0) {
        msg = `Read ${candidates.join(', ')} but none matched a known invoice — check & edit.`;
      } else {
        msg = 'No invoice numbers detected. Enter them manually.';
      }
      this.patch(index, {
        detecting: false,
        detectMsg: msg,
        matched,
        invoiceNumbers: all.join(', ')
      });
    } catch (err: any) {
      clearInterval(ticker);
      this.patch(index, {
        detecting: false,
        detectMsg: err?.status === 503
          ? 'Auto-detection engine unavailable on the server.'
          : 'Welly could not scan this file. Enter numbers manually.'
      });
    }
  }

  async uploadAll(): Promise<void> {
    const list = this.entries();
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.status === 'pending' || e.status === 'error') {
        await this.uploadOne(i);
      }
    }
    const done = this.doneCount();
    if (done) this.snack.open(`${done} POD(s) uploaded.`, 'OK', { duration: 3500 });
  }

  private uploadOne(index: number): Promise<void> {
    return new Promise(async (resolve) => {
      const e = this.entries()[index];
      if (!e) { resolve(); return; }
      this.patch(index, { status: 'uploading', message: undefined });

      // Bake any preview rotation into the uploaded image so scans are saved upright.
      const fileToSend = e.isImage && e.rotation ? await this.bakeRotation(e.file, e.rotation) : e.file;

      const form = new FormData();
      form.append('file', fileToSend);
      form.append('invoiceNumbers', e.invoiceNumbers.trim());
      // Per-file date (parsed from the filename or edited by the user) takes precedence
      // over the batch date.
      const effectiveDate = e.deliveryDate || this.deliveryDate;
      if (effectiveDate) form.append('deliveryDate', effectiveDate);
      if (e.notes.trim()) form.append('notes', e.notes.trim());

      this.http.post<any>(`${this.apiUrl}/PodDocuments/upload-with-invoices`, form).subscribe({
        next: (res) => {
          this.patch(index, {
            status: 'done',
            message: res?.message || 'Uploaded.',
            matched: res?.matchedInvoiceNumbers || [],
            unmatched: res?.unmatchedInvoiceNumbers || [],
            loadNumber: res?.loadNumber ?? null
          });
          resolve();
        },
        error: (err) => {
          this.patch(index, { status: 'error', message: err?.error?.message || err?.error || 'Upload failed.' });
          resolve();
        }
      });
    });
  }

  private patch(index: number, changes: Partial<PodEntry>): void {
    this.entries.update(list => list.map((e, i) => i === index ? { ...e, ...changes } : e));
  }

  fileIcon(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'pdf') return 'picture_as_pdf';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
    if (['xlsx', 'xls'].includes(ext)) return 'table_chart';
    if (ext === 'zip') return 'folder_zip';
    return 'insert_drive_file';
  }

  humanSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}
