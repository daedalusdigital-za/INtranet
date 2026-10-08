import { Component, inject, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { PDFDocument, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

// Use the bundled pdf.js worker (copied to the site root by angular.json).
(pdfjsLib as any).GlobalWorkerOptions.workerSrc =
  new URL('pdf.worker.min.mjs', document.baseURI).toString();

type Mode = 'home' | 'split' | 'merge' | 'compress' | 'stamp';

/** A company stamp available to apply. PNGs live in /public/stamps. */
interface StampAsset {
  key: string;
  name: string;
  url: string;
}

/** A stamp instance placed on a page (all geometry stored as page fractions). */
interface PlacedStamp {
  id: string;
  pageIndex: number;
  assetKey: string;
  xPct: number;   // left edge, fraction of page width (0..1)
  yPct: number;   // top edge, fraction of page height (0..1)
  wPct: number;   // width, fraction of page width
  aspect: number; // image height / width
}

/** A rendered PDF page used as the stamping canvas. */
interface StampPageView {
  index: number;
  dataUrl: string;
  wPt: number;    // page width in PDF points
  hPt: number;    // page height in PDF points
}

interface PageThumb {
  index: number;      // 0-based page index
  dataUrl: string;    // thumbnail image
  selected: boolean;  // included in the extract
}

interface MergeItem {
  id: string;
  name: string;
  size: number;
  bytes: Uint8Array;
  pageCount: number;
  rotation: number;   // 0 | 90 | 180 | 270 applied to all pages of this file
  thumb: string;      // first-page thumbnail
}

interface CompressLevel {
  key: 'light' | 'balanced' | 'strong';
  label: string;
  blurb: string;
  icon: string;
  scale: number;      // rasterisation scale (higher = sharper, bigger)
  quality: number;    // JPEG quality 0–1
}

/**
 * "I Hate PDF" — a self-contained toolbox dialog with two tools:
 *  • PDF Splitter   — extract selected pages into a new PDF (lossless, pdf-lib)
 *  • PDF Compressor — rasterise + re-encode pages as JPEG to shrink the file,
 *    with three strength levels, live preview and size comparison.
 * Everything runs client-side; nothing is uploaded to the server.
 */
@Component({
  selector: 'app-i-hate-pdf-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule],
  templateUrl: './i-hate-pdf-dialog.component.html',
  styleUrls: ['./i-hate-pdf-dialog.component.scss']
})
export class IHatePdfDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<IHatePdfDialogComponent>);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  readonly mode = signal<Mode>('home');
  readonly busy = signal(false);
  readonly busyMsg = signal('');
  readonly error = signal('');

  // ── Loaded source file ─────────────────────────────────────
  readonly fileName = signal('');
  readonly fileSize = signal(0);
  private sourceBytes: Uint8Array | null = null;

  // ── Splitter state ─────────────────────────────────────────
  readonly pages = signal<PageThumb[]>([]);
  readonly selectedCount = computed(() => this.pages().filter(p => p.selected).length);
  rangeText = '';

  // ── Compressor state ───────────────────────────────────────
  readonly levels: CompressLevel[] = [
    { key: 'light',    label: 'Light',    blurb: 'Best quality · mild shrink',    icon: 'compress',      scale: 2.0, quality: 0.82 },
    { key: 'balanced', label: 'Balanced', blurb: 'Smart · great size vs quality', icon: 'auto_awesome',  scale: 1.4, quality: 0.65 },
    { key: 'strong',   label: 'Strong',   blurb: 'Smallest file · email-friendly', icon: 'bolt',          scale: 1.0, quality: 0.5 }
  ];
  readonly selectedLevel = signal<CompressLevel['key']>('balanced');
  readonly compressedSize = signal(0);
  readonly compressedUrl = signal<SafeResourceUrl | null>(null);
  private compressedObjectUrl: string | null = null;
  private compressedBlob: Blob | null = null;

  // ── Merger state ───────────────────────────────────────────
  readonly mergeItems = signal<MergeItem[]>([]);
  readonly mergedBytes = signal<Uint8Array | null>(null);
  readonly mergedSize = signal(0);
  readonly mergedUrl = signal<SafeResourceUrl | null>(null);
  private mergedObjectUrl: string | null = null;
  private mergedBlob: Blob | null = null;
  readonly mergeTotalPages = computed(() => this.mergeItems().reduce((s, it) => s + it.pageCount, 0));
  // Email dialog state
  readonly showEmailForm = signal(false);
  emailTo = '';
  emailSubject = 'Merged PDF document';
  emailMessage = '';
  readonly sendingEmail = signal(false);

  // ── Stamp state ────────────────────────────────────────────
  readonly stampAssets: StampAsset[] = [
    { key: 'Access',       name: 'Access Medical',  url: 'stamps/Access.png' },
    { key: 'Liamed',       name: 'Liamed',          url: 'stamps/Liamed.png' },
    { key: 'NewAge',       name: 'New Age',         url: 'stamps/NewAge.png' },
    { key: 'Promed',       name: 'Promed',          url: 'stamps/Promed.png' },
    { key: 'Sebenzani',    name: 'Sebenzani',       url: 'stamps/Sebenzani.png' },
    { key: 'ShakaHolding', name: 'Shaka Holding',   url: 'stamps/ShakaHolding.png' }
  ];
  readonly selectedStamp = signal<string | null>(null);
  readonly stampPages = signal<StampPageView[]>([]);
  readonly placedStamps = signal<PlacedStamp[]>([]);
  readonly stampSaving = signal(false);
  readonly stampSaved = signal(false);
  /** natural aspect (h/w) of each stamp image, populated as they load. */
  private stampAspect = new Map<string, number>();
  // drag/resize bookkeeping
  private dragId: string | null = null;
  private dragMode: 'move' | 'resize' | null = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragOrig: PlacedStamp | null = null;
  private dragPageEl: HTMLElement | null = null;

  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('mergeInput') mergeInput?: ElementRef<HTMLInputElement>;

  constructor() {
    // Preload each stamp so its true aspect ratio is known up-front. This makes
    // the first placement land exactly where the user clicks (no post-load jump).
    for (const s of this.stampAssets) {
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth > 0) {
          this.stampAspect.set(s.key, img.naturalHeight / img.naturalWidth);
        }
      };
      img.src = s.url;
    }
  }

  // ── Navigation ─────────────────────────────────────────────
  choose(mode: Mode): void {
    this.reset();
    this.mode.set(mode);
  }
  back(): void {
    this.reset();
    this.mode.set('home');
  }
  close(): void { this.dialogRef.close(); }

  private reset(): void {
    this.error.set('');
    this.busy.set(false);
    this.busyMsg.set('');
    this.fileName.set('');
    this.fileSize.set(0);
    this.sourceBytes = null;
    this.pages.set([]);
    this.rangeText = '';
    this.selectedLevel.set('balanced');
    this.compressedSize.set(0);
    this.revokeCompressed();
    this.resetMerge();
    this.resetStamp();
  }

  private resetStamp(): void {
    this.selectedStamp.set(null);
    this.stampPages.set([]);
    this.placedStamps.set([]);
    this.stampSaving.set(false);
    this.stampSaved.set(false);
    this.dragId = null;
    this.dragMode = null;
    this.dragOrig = null;
    this.dragPageEl = null;
  }

  private resetMerge(): void {
    this.mergeItems.set([]);
    this.revokeMerged();
    this.showEmailForm.set(false);
    this.emailTo = '';
    this.emailSubject = 'Merged PDF document';
    this.emailMessage = '';
  }

  private revokeMerged(): void {
    if (this.mergedObjectUrl) URL.revokeObjectURL(this.mergedObjectUrl);
    this.mergedObjectUrl = null;
    this.mergedUrl.set(null);
    this.mergedBlob = null;
    this.mergedBytes.set(null);
    this.mergedSize.set(0);
  }

  private revokeCompressed(): void {
    if (this.compressedObjectUrl) URL.revokeObjectURL(this.compressedObjectUrl);
    this.compressedObjectUrl = null;
    this.compressedUrl.set(null);
    this.compressedBlob = null;
  }

  // ── File intake ────────────────────────────────────────────
  triggerPicker(): void { this.fileInput?.nativeElement.click(); }

  async onFilePicked(evt: Event): Promise<void> {
    const input = evt.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) await this.loadFile(file);
  }

  async onDrop(evt: DragEvent): Promise<void> {
    evt.preventDefault();
    const file = evt.dataTransfer?.files?.[0];
    if (file) await this.loadFile(file);
  }
  onDragOver(evt: DragEvent): void { evt.preventDefault(); }

  private async loadFile(file: File): Promise<void> {
    this.error.set('');
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      this.error.set('Please choose a PDF file.');
      return;
    }
    this.revokeCompressed();
    this.compressedSize.set(0);
    this.pages.set([]);
    this.fileName.set(file.name);
    this.fileSize.set(file.size);
    this.sourceBytes = new Uint8Array(await file.arrayBuffer());

    if (this.mode() === 'split') {
      await this.renderThumbnails();
    }
    if (this.mode() === 'stamp') {
      await this.renderStampPages();
    }
  }

  // ── Splitter: thumbnails ───────────────────────────────────
  private async renderThumbnails(): Promise<void> {
    if (!this.sourceBytes) return;
    this.busy.set(true);
    this.busyMsg.set('Rendering pages…');
    try {
      const doc = await (pdfjsLib as any).getDocument({ data: this.sourceBytes.slice() }).promise;
      const thumbs: PageThumb[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 0.35 });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        thumbs.push({ index: i - 1, dataUrl: canvas.toDataURL('image/jpeg', 0.7), selected: true });
        this.busyMsg.set(`Rendering pages… ${i}/${doc.numPages}`);
      }
      this.pages.set(thumbs);
    } catch (e) {
      this.error.set('Could not read this PDF. It may be corrupted or password-protected.');
    } finally {
      this.busy.set(false);
      this.busyMsg.set('');
    }
  }

  togglePage(p: PageThumb): void {
    this.pages.update(list => list.map(x => x.index === p.index ? { ...x, selected: !x.selected } : x));
  }
  selectAll(): void { this.pages.update(l => l.map(x => ({ ...x, selected: true }))); }
  selectNone(): void { this.pages.update(l => l.map(x => ({ ...x, selected: false }))); }

  /** Apply a "1-3, 5, 8-10" style range to the page selection. */
  applyRange(): void {
    const text = this.rangeText.trim();
    if (!text) return;
    const total = this.pages().length;
    const wanted = new Set<number>();
    for (const part of text.split(',')) {
      const seg = part.trim();
      if (!seg) continue;
      const m = seg.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m) {
        let a = parseInt(m[1], 10), b = parseInt(m[2], 10);
        if (a > b) [a, b] = [b, a];
        for (let n = a; n <= b; n++) if (n >= 1 && n <= total) wanted.add(n - 1);
      } else if (/^\d+$/.test(seg)) {
        const n = parseInt(seg, 10);
        if (n >= 1 && n <= total) wanted.add(n - 1);
      }
    }
    if (wanted.size === 0) { this.error.set('No valid pages in that range.'); return; }
    this.error.set('');
    this.pages.update(l => l.map(x => ({ ...x, selected: wanted.has(x.index) })));
  }

  /** Build and download a PDF containing only the selected pages. */
  async downloadSplit(): Promise<void> {
    if (!this.sourceBytes) return;
    const indices = this.pages().filter(p => p.selected).map(p => p.index);
    if (indices.length === 0) { this.error.set('Select at least one page.'); return; }
    this.busy.set(true);
    this.busyMsg.set('Building your PDF…');
    try {
      const src = await PDFDocument.load(this.sourceBytes.slice());
      const out = await PDFDocument.create();
      const copied = await out.copyPages(src, indices);
      copied.forEach(pg => out.addPage(pg));
      const bytes = await out.save();
      this.downloadBytes(bytes, this.suffixedName('pages'), 'application/pdf');
    } catch (e) {
      this.error.set('Failed to extract pages. The PDF may be protected.');
    } finally {
      this.busy.set(false);
      this.busyMsg.set('');
    }
  }

  /** Download each selected page as its own separate PDF. */
  async downloadEachSeparately(): Promise<void> {
    if (!this.sourceBytes) return;
    const indices = this.pages().filter(p => p.selected).map(p => p.index);
    if (indices.length === 0) { this.error.set('Select at least one page.'); return; }
    this.busy.set(true);
    try {
      const src = await PDFDocument.load(this.sourceBytes.slice());
      for (const idx of indices) {
        this.busyMsg.set(`Exporting page ${idx + 1}…`);
        const out = await PDFDocument.create();
        const [pg] = await out.copyPages(src, [idx]);
        out.addPage(pg);
        const bytes = await out.save();
        this.downloadBytes(bytes, this.suffixedName(`page-${idx + 1}`), 'application/pdf');
        await new Promise(r => setTimeout(r, 150)); // let each download register
      }
    } catch (e) {
      this.error.set('Failed to export pages.');
    } finally {
      this.busy.set(false);
      this.busyMsg.set('');
    }
  }

  // ── Compressor ─────────────────────────────────────────────
  pickLevel(key: CompressLevel['key']): void {
    this.selectedLevel.set(key);
    this.revokeCompressed();
    this.compressedSize.set(0);
  }

  async runCompression(): Promise<void> {
    if (!this.sourceBytes) { this.error.set('Upload a PDF first.'); return; }
    const level = this.levels.find(l => l.key === this.selectedLevel())!;
    this.busy.set(true);
    this.busyMsg.set('Compressing…');
    this.error.set('');
    this.revokeCompressed();
    try {
      const doc = await (pdfjsLib as any).getDocument({ data: this.sourceBytes.slice() }).promise;
      let pdf: jsPDF | null = null;

      for (let i = 1; i <= doc.numPages; i++) {
        this.busyMsg.set(`Compressing… page ${i}/${doc.numPages}`);
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: level.scale });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        // White background so transparent regions don't turn black in JPEG.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        const img = canvas.toDataURL('image/jpeg', level.quality);

        // Page size in PDF points (72 dpi). Keep the page's real proportions.
        const base = page.getViewport({ scale: 1 });
        const wPt = base.width;
        const hPt = base.height;
        const orientation = wPt > hPt ? 'l' : 'p';
        if (!pdf) {
          pdf = new jsPDF({ orientation, unit: 'pt', format: [wPt, hPt], compress: true });
        } else {
          pdf.addPage([wPt, hPt], orientation);
        }
        pdf.addImage(img, 'JPEG', 0, 0, wPt, hPt, undefined, 'FAST');
      }

      if (!pdf) throw new Error('empty');
      const blob = pdf.output('blob');
      this.compressedBlob = blob;
      this.compressedSize.set(blob.size);
      this.compressedObjectUrl = URL.createObjectURL(blob);
      this.compressedUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.compressedObjectUrl));
    } catch (e) {
      this.error.set('Compression failed. The PDF may be protected or unusually large.');
    } finally {
      this.busy.set(false);
      this.busyMsg.set('');
    }
  }

  downloadCompressed(): void {
    if (!this.compressedBlob) return;
    const url = URL.createObjectURL(this.compressedBlob);
    this.triggerDownload(url, this.suffixedName('compressed'));
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  readonly savingsPct = computed(() => {
    const before = this.fileSize();
    const after = this.compressedSize();
    if (!before || !after) return 0;
    return Math.max(0, Math.round((1 - after / before) * 100));
  });

  // ── Merger ─────────────────────────────────────────────────
  triggerMergePicker(): void { this.mergeInput?.nativeElement.click(); }

  async onMergeFilesPicked(evt: Event): Promise<void> {
    const input = evt.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    input.value = '';
    await this.addMergeFiles(files);
  }

  async onMergeDrop(evt: DragEvent): Promise<void> {
    evt.preventDefault();
    const files = evt.dataTransfer?.files ? Array.from(evt.dataTransfer.files) : [];
    await this.addMergeFiles(files);
  }

  private async addMergeFiles(files: File[]): Promise<void> {
    const pdfs = files.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (pdfs.length === 0) {
      this.error.set('Please choose PDF files only.');
      return;
    }
    this.error.set('');
    this.revokeMerged(); // new inputs invalidate any previous merge
    this.busy.set(true);
    try {
      for (const file of pdfs) {
        this.busyMsg.set(`Loading ${file.name}…`);
        const bytes = new Uint8Array(await file.arrayBuffer());
        let pageCount = 0;
        let thumb = '';
        try {
          const doc = await (pdfjsLib as any).getDocument({ data: bytes.slice() }).promise;
          pageCount = doc.numPages;
          const page = await doc.getPage(1);
          const viewport = page.getViewport({ scale: 0.3 });
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          await page.render({ canvasContext: ctx, viewport }).promise;
          thumb = canvas.toDataURL('image/jpeg', 0.7);
        } catch {
          // Unreadable/encrypted preview — still allow the file, just no thumb.
        }
        this.mergeItems.update(list => [...list, {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          size: file.size,
          bytes,
          pageCount,
          rotation: 0,
          thumb
        }]);
      }
    } finally {
      this.busy.set(false);
      this.busyMsg.set('');
    }
  }

  removeMergeItem(id: string): void {
    this.mergeItems.update(list => list.filter(x => x.id !== id));
    this.revokeMerged();
  }

  moveMergeItem(id: string, dir: -1 | 1): void {
    this.mergeItems.update(list => {
      const idx = list.findIndex(x => x.id === id);
      const to = idx + dir;
      if (idx < 0 || to < 0 || to >= list.length) return list;
      const copy = [...list];
      [copy[idx], copy[to]] = [copy[to], copy[idx]];
      return copy;
    });
    this.revokeMerged();
  }

  rotateMergeItem(id: string, delta: 90 | -90): void {
    this.mergeItems.update(list => list.map(x =>
      x.id === id ? { ...x, rotation: (((x.rotation + delta) % 360) + 360) % 360 } : x
    ));
    this.revokeMerged();
  }

  /** Merge all files (in order, with per-file rotation) into one PDF. */
  async runMerge(): Promise<void> {
    const items = this.mergeItems();
    if (items.length < 1) { this.error.set('Add at least one PDF to merge.'); return; }
    this.busy.set(true);
    this.busyMsg.set('Merging…');
    this.error.set('');
    this.revokeMerged();
    try {
      const out = await PDFDocument.create();
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        this.busyMsg.set(`Merging ${i + 1}/${items.length}…`);
        const src = await PDFDocument.load(it.bytes.slice(), { ignoreEncryption: true });
        const pageIndices = src.getPageIndices();
        const copied = await out.copyPages(src, pageIndices);
        copied.forEach(pg => {
          if (it.rotation) {
            const current = pg.getRotation().angle || 0;
            pg.setRotation(degrees((current + it.rotation) % 360));
          }
          out.addPage(pg);
        });
      }
      const bytes = await out.save();
      this.mergedBytes.set(bytes);
      const buf = bytes.slice().buffer as ArrayBuffer;
      const blob = new Blob([buf], { type: 'application/pdf' });
      this.mergedBlob = blob;
      this.mergedSize.set(blob.size);
      this.mergedObjectUrl = URL.createObjectURL(blob);
      this.mergedUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.mergedObjectUrl));
    } catch (e) {
      this.error.set('Merge failed. One of the PDFs may be corrupted or password-protected.');
    } finally {
      this.busy.set(false);
      this.busyMsg.set('');
    }
  }

  downloadMerged(): void {
    if (!this.mergedBlob) return;
    const url = URL.createObjectURL(this.mergedBlob);
    this.triggerDownload(url, 'merged.pdf');
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** Feed the merged result into the compressor to shrink it further. */
  async compressMerged(): Promise<void> {
    const bytes = this.mergedBytes();
    if (!bytes) return;
    // Reuse the compressor pipeline: set source to merged bytes, switch mode.
    this.sourceBytes = bytes.slice();
    this.fileName.set('merged.pdf');
    this.fileSize.set(this.mergedSize());
    this.pages.set([]);
    this.revokeCompressed();
    this.compressedSize.set(0);
    this.selectedLevel.set('balanced');
    this.mode.set('compress');
  }

  // ── Email merged ───────────────────────────────────────────
  openEmailForm(): void {
    this.showEmailForm.set(true);
  }
  cancelEmail(): void {
    this.showEmailForm.set(false);
  }

  async sendMergedEmail(): Promise<void> {
    if (!this.mergedBlob) { this.error.set('Merge a PDF first.'); return; }
    const to = this.emailTo.trim();
    if (!to) { this.error.set('Enter at least one recipient email.'); return; }
    this.sendingEmail.set(true);
    this.error.set('');
    try {
      const form = new FormData();
      form.append('to', to);
      form.append('subject', this.emailSubject || 'Merged PDF document');
      form.append('message', this.emailMessage || '');
      form.append('file', this.mergedBlob, 'merged.pdf');
      await this.http.post(`${this.apiUrl}/tools/email-pdf`, form).toPromise();
      this.showEmailForm.set(false);
      this.busyMsg.set('');
      this.emailSent.set(true);
      setTimeout(() => this.emailSent.set(false), 4000);
    } catch (e: any) {
      const msg = e?.error?.message || 'Failed to send email. Please try again.';
      this.error.set(msg);
    } finally {
      this.sendingEmail.set(false);
    }
  }
  readonly emailSent = signal(false);

  // ── Stamp tool ─────────────────────────────────────────────
  /** Render every page as an image so the user can drop stamps onto it. */
  private async renderStampPages(): Promise<void> {
    if (!this.sourceBytes) return;
    this.busy.set(true);
    this.busyMsg.set('Rendering pages…');
    this.placedStamps.set([]);
    try {
      const doc = await (pdfjsLib as any).getDocument({ data: this.sourceBytes.slice() }).promise;
      const views: StampPageView[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        const base = page.getViewport({ scale: 1 });
        views.push({
          index: i - 1,
          dataUrl: canvas.toDataURL('image/jpeg', 0.72),
          wPt: base.width,
          hPt: base.height
        });
        this.busyMsg.set(`Rendering pages… ${i}/${doc.numPages}`);
      }
      this.stampPages.set(views);
    } catch {
      this.error.set('Could not read this PDF. It may be corrupted or password-protected.');
    } finally {
      this.busy.set(false);
      this.busyMsg.set('');
    }
  }

  pickStamp(key: string): void {
    this.selectedStamp.set(this.selectedStamp() === key ? null : key);
    this.stampSaved.set(false);
  }

  /** True once a company stamp has been chosen (gates the placement preview). */
  readonly stampReady = computed(() => this.selectedStamp() !== null);

  /** Chooser-card click: select this stamp and advance to the placement step. */
  chooseStamp(key: string): void {
    this.selectedStamp.set(key);
    this.stampSaved.set(false);
  }

  /** Go back to the company-stamp chooser without losing placed stamps. */
  changeStamp(): void {
    this.selectedStamp.set(null);
  }

  stampUrl(key: string): string {
    return this.stampAssets.find(s => s.key === key)?.url ?? '';
  }
  stampName(key: string): string {
    return this.stampAssets.find(s => s.key === key)?.name ?? key;
  }

  /** Capture the natural aspect ratio of a stamp thumbnail once it loads. */
  onStampImgLoad(key: string, evt: Event): void {
    const img = evt.target as HTMLImageElement;
    if (img.naturalWidth > 0) {
      this.stampAspect.set(key, img.naturalHeight / img.naturalWidth);
    }
  }

  /** Click on a page to drop the selected stamp there (centred on the click). */
  onPageClick(pageIndex: number, evt: MouseEvent): void {
    const key = this.selectedStamp();
    if (!key) { this.error.set('Pick a company stamp first.'); return; }
    this.error.set('');
    const el = evt.currentTarget as HTMLElement;
    // Measure against the actual rendered page image so the drop lands exactly
    // under the cursor (the wrapper can differ from the image by sub-pixels).
    const imgEl = el.querySelector('.ihp-stamp-page__img') as HTMLElement | null;
    const rect = (imgEl ?? el).getBoundingClientRect();
    const aspect = this.stampAspect.get(key) || 0.4;
    const wPct = 0.22; // default stamp is 22% of page width
    const hPct = (wPct * rect.width * aspect) / rect.height;
    let xPct = (evt.clientX - rect.left) / rect.width - wPct / 2;
    let yPct = (evt.clientY - rect.top) / rect.height - hPct / 2;
    xPct = Math.max(0, Math.min(1 - wPct, xPct));
    yPct = Math.max(0, Math.min(1 - hPct, yPct));
    const placed: PlacedStamp = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      pageIndex, assetKey: key, xPct, yPct, wPct, aspect
    };
    this.placedStamps.update(list => [...list, placed]);
    this.stampSaved.set(false);
  }

  placedForPage(pageIndex: number): PlacedStamp[] {
    return this.placedStamps().filter(p => p.pageIndex === pageIndex);
  }

  removePlaced(id: string, evt?: Event): void {
    evt?.stopPropagation();
    this.placedStamps.update(list => list.filter(p => p.id !== id));
    this.stampSaved.set(false);
  }

  // ── Drag & resize placed stamps ────────────────────────────
  startDrag(id: string, mode: 'move' | 'resize', evt: MouseEvent): void {
    evt.preventDefault();
    evt.stopPropagation();
    const placed = this.placedStamps().find(p => p.id === id);
    if (!placed) return;
    this.dragId = id;
    this.dragMode = mode;
    this.dragStartX = evt.clientX;
    this.dragStartY = evt.clientY;
    this.dragOrig = { ...placed };
    // The page surface is the stamp overlay's offset parent.
    let node = (evt.currentTarget as HTMLElement).closest('.ihp-stamp-page') as HTMLElement | null;
    this.dragPageEl = node;
    window.addEventListener('mousemove', this.onDragMove);
    window.addEventListener('mouseup', this.onDragEnd);
  }

  private onDragMove = (evt: MouseEvent): void => {
    if (!this.dragId || !this.dragOrig || !this.dragPageEl) return;
    const rect = this.dragPageEl.getBoundingClientRect();
    const dxPct = (evt.clientX - this.dragStartX) / rect.width;
    const dyPct = (evt.clientY - this.dragStartY) / rect.height;
    this.placedStamps.update(list => list.map(p => {
      if (p.id !== this.dragId) return p;
      const o = this.dragOrig!;
      if (this.dragMode === 'move') {
        let x = o.xPct + dxPct;
        let y = o.yPct + dyPct;
        const hPct = (o.wPct * rect.width * o.aspect) / rect.height;
        x = Math.max(0, Math.min(1 - o.wPct, x));
        y = Math.max(0, Math.min(1 - hPct, y));
        return { ...p, xPct: x, yPct: y };
      } else {
        let w = o.wPct + dxPct;
        w = Math.max(0.05, Math.min(1 - o.xPct, w));
        return { ...p, wPct: w };
      }
    }));
    this.stampSaved.set(false);
  };

  private onDragEnd = (): void => {
    this.dragId = null;
    this.dragMode = null;
    this.dragOrig = null;
    this.dragPageEl = null;
    window.removeEventListener('mousemove', this.onDragMove);
    window.removeEventListener('mouseup', this.onDragEnd);
  };

  readonly stampCount = computed(() => this.placedStamps().length);

  /** Burn the placed stamps into the PDF and return the stamped bytes. */
  private async buildStampedPdf(): Promise<Uint8Array> {
    if (!this.sourceBytes) throw new Error('no source');
    const pdf = await PDFDocument.load(this.sourceBytes.slice());
    const pages = pdf.getPages();
    const embedded = new Map<string, any>();
    for (const placed of this.placedStamps()) {
      const page = pages[placed.pageIndex];
      if (!page) continue;
      let img = embedded.get(placed.assetKey);
      if (!img) {
        const url = this.stampUrl(placed.assetKey);
        const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
        img = await pdf.embedPng(bytes);
        embedded.set(placed.assetKey, img);
      }
      const { width, height } = page.getSize();
      const w = placed.wPct * width;
      const h = w * placed.aspect;
      const x = placed.xPct * width;
      const y = height - (placed.yPct * height) - h; // pdf-lib origin is bottom-left
      page.drawImage(img, { x, y, width: w, height: h });
    }
    return await pdf.save();
  }

  /** Apply stamps, download the file, then persist a copy + audit log server-side. */
  async applyAndDownloadStamp(): Promise<void> {
    if (!this.sourceBytes) { this.error.set('Upload a PDF first.'); return; }
    if (this.placedStamps().length === 0) { this.error.set('Place at least one stamp.'); return; }
    this.busy.set(true);
    this.busyMsg.set('Applying stamps…');
    this.error.set('');
    try {
      const bytes = await this.buildStampedPdf();
      const stampedName = this.suffixedName('stamped');
      this.downloadBytes(bytes, stampedName, 'application/pdf');

      // Save a copy + record the activity in the IT portal / admin log.
      this.stampSaving.set(true);
      this.busyMsg.set('Saving copy to IT portal…');
      const buf = bytes.slice().buffer as ArrayBuffer;
      const blob = new Blob([buf], { type: 'application/pdf' });
      const usedStamps = Array.from(new Set(this.placedStamps().map(p => this.stampName(p.assetKey)))).join(', ');
      const form = new FormData();
      form.append('originalName', this.fileName() || 'document.pdf');
      form.append('stampName', usedStamps);
      form.append('file', blob, stampedName);
      try {
        await this.http.post(`${this.apiUrl}/tools/stamp-pdf`, form).toPromise();
        this.stampSaved.set(true);
      } catch {
        // Download already succeeded — only the archival copy failed.
        this.error.set('Stamped PDF downloaded, but saving the archive copy failed.');
      }
    } catch {
      this.error.set('Stamping failed. The PDF may be protected or unusually large.');
    } finally {
      this.stampSaving.set(false);
      this.busy.set(false);
      this.busyMsg.set('');
    }
  }

  // ── Helpers ────────────────────────────────────────────────
  private suffixedName(suffix: string): string {
    const base = this.fileName().replace(/\.pdf$/i, '') || 'document';
    return `${base}-${suffix}.pdf`;
  }
  private downloadBytes(bytes: Uint8Array, name: string, type: string): void {
    const buf = bytes.slice().buffer as ArrayBuffer;
    const blob = new Blob([buf], { type });
    const url = URL.createObjectURL(blob);
    this.triggerDownload(url, name);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  private triggerDownload(url: string, name: string): void {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  humanSize(bytes: number): string {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  }
}
