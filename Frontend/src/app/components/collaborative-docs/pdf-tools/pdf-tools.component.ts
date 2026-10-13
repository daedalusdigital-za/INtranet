import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PdfTool {
  id: string;
  label: string;
  description: string;
  icon: string;
  hue: string;
  multi?: boolean;      // accepts multiple files
  accept?: string;      // file input accept
}

@Component({
  selector: 'app-pdf-tools',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatButtonModule, MatIconModule, MatTooltipModule, MatProgressSpinnerModule, MatSnackBarModule],
  template: `
    <div class="tools-page">
      <div class="tools-header">
        <button mat-icon-button routerLink="/docs" matTooltip="Back to Documents">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <mat-icon class="tools-logo">handyman</mat-icon>
        <div>
          <h1>PDF Tools</h1>
          <p>Combine, split, organize and convert PDFs — everything runs in your browser, nothing is uploaded.</p>
        </div>
      </div>

      @if (!activeTool) {
        <div class="tool-grid">
          @for (t of tools; track t.id) {
            <button class="tool-card" [style.--hue]="t.hue" (click)="selectTool(t)">
              <div class="tool-icon"><mat-icon>{{ t.icon }}</mat-icon></div>
              <div class="tool-label">{{ t.label }}</div>
              <div class="tool-desc">{{ t.description }}</div>
            </button>
          }
        </div>
      } @else {
        <div class="tool-workspace">
          <div class="workspace-head" [style.--hue]="activeTool.hue">
            <button mat-icon-button (click)="reset()" matTooltip="All tools">
              <mat-icon>arrow_back</mat-icon>
            </button>
            <mat-icon class="ws-icon">{{ activeTool.icon }}</mat-icon>
            <h2>{{ activeTool.label }}</h2>
          </div>

          <!-- File drop zone -->
          <div class="drop-zone" [class.has-files]="files.length"
               (dragover)="$event.preventDefault()" (drop)="onDrop($event)">
            <input type="file" #fileInput hidden [accept]="activeTool.accept || '.pdf'" [multiple]="activeTool.multi ?? false" (change)="onFiles($event)">
            @if (!files.length) {
              <mat-icon class="drop-icon">upload_file</mat-icon>
              <p>Drop {{ activeTool.multi ? 'files' : 'a file' }} here or</p>
              <button mat-flat-button color="primary" (click)="fileInput.click()">Choose {{ activeTool.multi ? 'Files' : 'File' }}</button>
            } @else {
              <div class="file-list">
                @for (f of files; track f.name; let i = $index) {
                  <div class="file-row">
                    <mat-icon>{{ f.type.startsWith('image/') ? 'image' : 'picture_as_pdf' }}</mat-icon>
                    <span class="file-name">{{ f.name }}</span>
                    <span class="file-size">{{ (f.size / 1024 / 1024).toFixed(2) }} MB</span>
                    @if (activeTool.multi) {
                      <button mat-icon-button (click)="moveFile(i, -1)" [disabled]="i === 0" matTooltip="Move up"><mat-icon>arrow_upward</mat-icon></button>
                      <button mat-icon-button (click)="moveFile(i, 1)" [disabled]="i === files.length - 1" matTooltip="Move down"><mat-icon>arrow_downward</mat-icon></button>
                    }
                    <button mat-icon-button (click)="removeFile(i)" matTooltip="Remove"><mat-icon>close</mat-icon></button>
                  </div>
                }
              </div>
              @if (activeTool.multi) {
                <button mat-stroked-button (click)="fileInput.click()"><mat-icon>add</mat-icon> Add more files</button>
              }
              @if (pageCount) {
                <p class="page-info">{{ pageCount }} pages</p>
              }
            }
          </div>

          <!-- Tool options -->
          @if (files.length) {
            <div class="tool-options">
              @switch (activeTool.id) {
                @case ('split') {
                  <label>Split every
                    <input type="number" min="1" [(ngModel)]="splitEvery" class="num-input"> pages
                  </label>
                }
                @case ('extract') {
                  <label>Pages to extract (e.g. 1-3, 6, 9):
                    <input type="text" [(ngModel)]="pageRange" placeholder="1-3, 6" class="text-input">
                  </label>
                }
                @case ('delete') {
                  <label>Pages to delete (e.g. 2, 4-5):
                    <input type="text" [(ngModel)]="pageRange" placeholder="2, 4-5" class="text-input">
                  </label>
                }
                @case ('rotate') {
                  <label>Pages (blank = all):
                    <input type="text" [(ngModel)]="pageRange" placeholder="all" class="text-input">
                  </label>
                  <label>Rotate by:
                    <select [(ngModel)]="rotateDeg" class="text-input">
                      <option [ngValue]="90">90° clockwise</option>
                      <option [ngValue]="180">180°</option>
                      <option [ngValue]="270">90° counter-clockwise</option>
                    </select>
                  </label>
                }
                @case ('watermark') {
                  <label>Watermark text:
                    <input type="text" [(ngModel)]="watermarkText" placeholder="CONFIDENTIAL" class="text-input">
                  </label>
                  <label>Opacity:
                    <input type="range" min="5" max="60" [(ngModel)]="watermarkOpacity"> {{ watermarkOpacity }}%
                  </label>
                }
                @case ('pagenumbers') {
                  <label>Position:
                    <select [(ngModel)]="numberPos" class="text-input">
                      <option value="bottom-center">Bottom centre</option>
                      <option value="bottom-right">Bottom right</option>
                      <option value="top-right">Top right</option>
                    </select>
                  </label>
                }
                @case ('toimages') {
                  <label>Resolution:
                    <select [(ngModel)]="renderScale" class="text-input">
                      <option [ngValue]="1">Standard (96 dpi)</option>
                      <option [ngValue]="2">High (192 dpi)</option>
                      <option [ngValue]="3">Very high (288 dpi)</option>
                    </select>
                  </label>
                }
              }
              <button mat-flat-button color="primary" class="run-btn" [disabled]="busy" (click)="run()">
                @if (busy) { <mat-spinner diameter="18"></mat-spinner> } @else { <mat-icon>play_arrow</mat-icon> }
                {{ busy ? progressText : 'Run ' + activeTool.label }}
              </button>
            </div>
          }

          @if (textResult) {
            <div class="text-result">
              <div class="text-result-head">
                <h3>Extracted text</h3>
                <button mat-stroked-button (click)="copyText()"><mat-icon>content_copy</mat-icon> Copy</button>
                <button mat-stroked-button (click)="downloadText()"><mat-icon>download</mat-icon> Download .txt</button>
              </div>
              <pre>{{ textResult }}</pre>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .tools-page {
      max-width: 1100px;
      margin: 0 auto;
      padding: 24px;
      font-family: 'Segoe UI', Roboto, sans-serif;
    }
    .tools-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 28px;
    }
    .tools-logo { font-size: 42px; width: 42px; height: 42px; color: #d93025; }
    .tools-header h1 { margin: 0; font-size: 26px; font-weight: 600; }
    .tools-header p { margin: 2px 0 0; color: #5f6368; font-size: 13px; }

    .tool-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
      gap: 16px;
    }
    .tool-card {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      padding: 18px;
      cursor: pointer;
      text-align: left;
      transition: box-shadow 0.15s, transform 0.15s, border-color 0.15s;
    }
    .tool-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.12); transform: translateY(-2px); border-color: var(--hue); }
    .tool-icon {
      width: 44px; height: 44px; border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      background: color-mix(in srgb, var(--hue) 14%, white);
    }
    .tool-icon mat-icon { color: var(--hue); }
    .tool-label { font-weight: 600; font-size: 15px; }
    .tool-desc { font-size: 12px; color: #5f6368; line-height: 1.4; }

    .tool-workspace { max-width: 760px; margin: 0 auto; }
    .workspace-head {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 18px;
    }
    .workspace-head h2 { margin: 0; font-size: 20px; }
    .ws-icon { color: var(--hue); }

    .drop-zone {
      border: 2px dashed #c0c4c9;
      border-radius: 12px;
      padding: 32px;
      text-align: center;
      background: #fafbfc;
      display: flex; flex-direction: column; align-items: center; gap: 10px;
    }
    .drop-zone.has-files { text-align: left; align-items: stretch; }
    .drop-icon { font-size: 48px; width: 48px; height: 48px; color: #9aa0a6; }
    .file-list { display: flex; flex-direction: column; gap: 4px; }
    .file-row {
      display: flex; align-items: center; gap: 8px;
      background: white; border: 1px solid #e8eaed; border-radius: 8px;
      padding: 6px 10px;
    }
    .file-row mat-icon:first-child { color: #d93025; }
    .file-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
    .file-size { font-size: 12px; color: #80868b; }
    .page-info { font-size: 13px; color: #5f6368; margin: 4px 0 0; }

    .tool-options {
      margin-top: 18px;
      display: flex; flex-direction: column; gap: 12px;
      background: white; border: 1px solid #e0e0e0; border-radius: 12px;
      padding: 18px;
    }
    .tool-options label { font-size: 14px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .num-input { width: 70px; padding: 6px; border: 1px solid #dadce0; border-radius: 6px; }
    .text-input { padding: 6px 10px; border: 1px solid #dadce0; border-radius: 6px; min-width: 180px; }
    .run-btn { align-self: flex-start; display: inline-flex; align-items: center; gap: 8px; }

    .text-result { margin-top: 18px; background: white; border: 1px solid #e0e0e0; border-radius: 12px; padding: 18px; }
    .text-result-head { display: flex; align-items: center; gap: 10px; }
    .text-result-head h3 { flex: 1; margin: 0; }
    .text-result pre {
      max-height: 400px; overflow: auto; background: #f8f9fa;
      padding: 12px; border-radius: 8px; font-size: 12px; white-space: pre-wrap;
    }
  `]
})
export class PdfToolsComponent {
  tools: PdfTool[] = [
    { id: 'combine', label: 'Combine files', description: 'Merge PDFs and images into one PDF, in the order you choose.', icon: 'library_books', hue: '#1a73e8', multi: true, accept: '.pdf,.png,.jpg,.jpeg' },
    { id: 'split', label: 'Split a PDF', description: 'Divide a document into parts every N pages.', icon: 'call_split', hue: '#e8710a' },
    { id: 'extract', label: 'Extract pages', description: 'Copy chosen pages into a new PDF.', icon: 'file_copy', hue: '#188038' },
    { id: 'delete', label: 'Delete pages', description: 'Remove pages and save a new PDF.', icon: 'delete_sweep', hue: '#d93025' },
    { id: 'rotate', label: 'Rotate pages', description: 'Rotate all or selected pages by 90, 180 or 270 degrees.', icon: 'rotate_right', hue: '#9334e6' },
    { id: 'compress', label: 'Reduce file size', description: 'Rewrite the PDF with object streams to shrink it.', icon: 'compress', hue: '#d93025' },
    { id: 'images2pdf', label: 'Images to PDF', description: 'Turn PNG and JPEG images into a PDF, one page each.', icon: 'photo_library', hue: '#188038', multi: true, accept: '.png,.jpg,.jpeg' },
    { id: 'toimages', label: 'PDF to images', description: 'Render every page as a PNG download.', icon: 'image', hue: '#1a73e8' },
    { id: 'text', label: 'Extract text', description: 'Pull all text out of a PDF to copy or save.', icon: 'notes', hue: '#5f6368' },
    { id: 'watermark', label: 'Watermark', description: 'Stamp diagonal text across every page.', icon: 'branding_watermark', hue: '#e8710a' },
    { id: 'pagenumbers', label: 'Number pages', description: 'Add page numbers to the header or footer.', icon: 'format_list_numbered', hue: '#9334e6' },
  ];

  activeTool: PdfTool | null = null;
  files: File[] = [];
  pageCount = 0;
  busy = false;
  progressText = 'Working…';
  textResult = '';

  // options
  splitEvery = 1;
  pageRange = '';
  rotateDeg = 90;
  watermarkText = 'CONFIDENTIAL';
  watermarkOpacity = 18;
  numberPos = 'bottom-center';
  renderScale = 2;

  constructor(private snackBar: MatSnackBar) {}

  selectTool(t: PdfTool): void { this.activeTool = t; this.files = []; this.pageCount = 0; this.textResult = ''; }
  reset(): void { this.activeTool = null; this.files = []; this.pageCount = 0; this.textResult = ''; }

  onFiles(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    if (input.files) this.addFiles(Array.from(input.files));
    input.value = '';
  }

  onDrop(ev: DragEvent): void {
    ev.preventDefault();
    if (ev.dataTransfer?.files) this.addFiles(Array.from(ev.dataTransfer.files));
  }

  private async addFiles(list: File[]): Promise<void> {
    if (this.activeTool?.multi) this.files.push(...list);
    else this.files = list.slice(0, 1);
    this.pageCount = 0;
    const first = this.files[0];
    if (first && first.type === 'application/pdf' && !this.activeTool?.multi) {
      try {
        const doc = await PDFDocument.load(await first.arrayBuffer(), { ignoreEncryption: true });
        this.pageCount = doc.getPageCount();
      } catch { /* ignore */ }
    }
  }

  moveFile(i: number, dir: number): void {
    const j = i + dir;
    [this.files[i], this.files[j]] = [this.files[j], this.files[i]];
  }

  removeFile(i: number): void { this.files.splice(i, 1); }

  private parseRange(input: string, max: number): number[] {
    if (!input.trim()) return Array.from({ length: max }, (_, i) => i);
    const out = new Set<number>();
    for (const part of input.split(',')) {
      const p = part.trim();
      if (!p) continue;
      const m = p.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m) {
        for (let n = +m[1]; n <= +m[2]; n++) if (n >= 1 && n <= max) out.add(n - 1);
      } else if (/^\d+$/.test(p)) {
        const n = +p;
        if (n >= 1 && n <= max) out.add(n - 1);
      }
    }
    return [...out].sort((a, b) => a - b);
  }

  private download(bytes: Uint8Array | Blob, name: string): void {
    const blob = bytes instanceof Blob ? bytes : new Blob([bytes as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }

  private baseName(): string {
    return (this.files[0]?.name || 'document').replace(/\.[^.]+$/, '');
  }

  async run(): Promise<void> {
    if (!this.activeTool || !this.files.length) return;
    this.busy = true;
    this.textResult = '';
    this.progressText = 'Working…';
    try {
      switch (this.activeTool.id) {
        case 'combine': await this.combine(); break;
        case 'split': await this.split(); break;
        case 'extract': await this.extractPages(); break;
        case 'delete': await this.deletePages(); break;
        case 'rotate': await this.rotatePages(); break;
        case 'compress': await this.compress(); break;
        case 'images2pdf': await this.imagesToPdf(); break;
        case 'toimages': await this.pdfToImages(); break;
        case 'text': await this.extractText(); break;
        case 'watermark': await this.watermark(); break;
        case 'pagenumbers': await this.addPageNumbers(); break;
      }
    } catch (e: any) {
      this.snackBar.open('Failed: ' + (e?.message || e), 'Close', { duration: 5000 });
    }
    this.busy = false;
  }

  private async combine(): Promise<void> {
    const out = await PDFDocument.create();
    for (const f of this.files) {
      this.progressText = `Adding ${f.name}…`;
      const bytes = await f.arrayBuffer();
      if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach(p => out.addPage(p));
      } else {
        const img = f.type.includes('png') ? await out.embedPng(bytes) : await out.embedJpg(bytes);
        const page = out.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      }
    }
    this.download(await out.save(), 'combined.pdf');
    this.snackBar.open(`Combined ${this.files.length} files`, 'Close', { duration: 3000 });
  }

  private async split(): Promise<void> {
    const src = await PDFDocument.load(await this.files[0].arrayBuffer(), { ignoreEncryption: true });
    const total = src.getPageCount();
    const n = Math.max(1, this.splitEvery);
    let part = 1;
    for (let start = 0; start < total; start += n, part++) {
      this.progressText = `Writing part ${part}…`;
      const out = await PDFDocument.create();
      const idx = Array.from({ length: Math.min(n, total - start) }, (_, i) => start + i);
      const pages = await out.copyPages(src, idx);
      pages.forEach(p => out.addPage(p));
      this.download(await out.save(), `${this.baseName()}-part${part}.pdf`);
    }
    this.snackBar.open(`Split into ${part - 1} files`, 'Close', { duration: 3000 });
  }

  private async extractPages(): Promise<void> {
    const src = await PDFDocument.load(await this.files[0].arrayBuffer(), { ignoreEncryption: true });
    const idx = this.parseRange(this.pageRange, src.getPageCount());
    if (!idx.length) { this.snackBar.open('No valid pages in range', 'Close', { duration: 3000 }); return; }
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, idx);
    pages.forEach(p => out.addPage(p));
    this.download(await out.save(), `${this.baseName()}-extract.pdf`);
    this.snackBar.open(`Extracted ${idx.length} pages`, 'Close', { duration: 3000 });
  }

  private async deletePages(): Promise<void> {
    const src = await PDFDocument.load(await this.files[0].arrayBuffer(), { ignoreEncryption: true });
    const toDelete = new Set(this.parseRange(this.pageRange, src.getPageCount()));
    if (!toDelete.size) { this.snackBar.open('No valid pages in range', 'Close', { duration: 3000 }); return; }
    const keep = src.getPageIndices().filter(i => !toDelete.has(i));
    if (!keep.length) { this.snackBar.open('Cannot delete every page', 'Close', { duration: 3000 }); return; }
    const out = await PDFDocument.create();
    const pages = await out.copyPages(src, keep);
    pages.forEach(p => out.addPage(p));
    this.download(await out.save(), `${this.baseName()}-deleted.pdf`);
    this.snackBar.open(`Deleted ${toDelete.size} pages`, 'Close', { duration: 3000 });
  }

  private async rotatePages(): Promise<void> {
    const doc = await PDFDocument.load(await this.files[0].arrayBuffer(), { ignoreEncryption: true });
    const idx = this.parseRange(this.pageRange, doc.getPageCount());
    for (const i of idx) {
      const page = doc.getPage(i);
      page.setRotation(degrees(((page.getRotation().angle + this.rotateDeg) % 360)));
    }
    this.download(await doc.save(), `${this.baseName()}-rotated.pdf`);
    this.snackBar.open(`Rotated ${idx.length} pages`, 'Close', { duration: 3000 });
  }

  private async compress(): Promise<void> {
    const original = await this.files[0].arrayBuffer();
    const doc = await PDFDocument.load(original, { ignoreEncryption: true });
    const bytes = await doc.save({ useObjectStreams: true });
    const saved = original.byteLength - bytes.byteLength;
    this.download(bytes, `${this.baseName()}-compressed.pdf`);
    this.snackBar.open(saved > 0
      ? `Reduced by ${(saved / 1024).toFixed(0)} KB (${((saved / original.byteLength) * 100).toFixed(1)}%)`
      : 'File was already optimally packed', 'Close', { duration: 4000 });
  }

  private async imagesToPdf(): Promise<void> {
    const out = await PDFDocument.create();
    for (const f of this.files) {
      this.progressText = `Adding ${f.name}…`;
      const bytes = await f.arrayBuffer();
      const img = f.type.includes('png') ? await out.embedPng(bytes) : await out.embedJpg(bytes);
      const page = out.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    }
    this.download(await out.save(), 'images.pdf');
    this.snackBar.open(`Created PDF from ${this.files.length} images`, 'Close', { duration: 3000 });
  }

  private async pdfToImages(): Promise<void> {
    const data = await this.files[0].arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    for (let i = 1; i <= pdf.numPages; i++) {
      this.progressText = `Rendering page ${i} of ${pdf.numPages}…`;
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: this.renderScale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d')!, viewport } as any).promise;
      const blob: Blob = await new Promise(res => canvas.toBlob(b => res(b!), 'image/png'));
      this.download(blob, `${this.baseName()}-page${i}.png`);
    }
    this.snackBar.open(`Rendered ${pdf.numPages} pages as PNG`, 'Close', { duration: 3000 });
  }

  private async extractText(): Promise<void> {
    const data = await this.files[0].arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const parts: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      this.progressText = `Reading page ${i} of ${pdf.numPages}…`;
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      parts.push(content.items.map((it: any) => it.str).join(' '));
    }
    this.textResult = parts.join('\n\n— page break —\n\n');
    this.snackBar.open('Text extracted', 'Close', { duration: 2000 });
  }

  copyText(): void {
    navigator.clipboard.writeText(this.textResult);
    this.snackBar.open('Copied to clipboard', 'Close', { duration: 2000 });
  }

  downloadText(): void {
    this.download(new Blob([this.textResult], { type: 'text/plain' }), `${this.baseName()}.txt`);
  }

  private async watermark(): Promise<void> {
    const doc = await PDFDocument.load(await this.files[0].arrayBuffer(), { ignoreEncryption: true });
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const text = this.watermarkText || 'CONFIDENTIAL';
    for (const page of doc.getPages()) {
      const { width, height } = page.getSize();
      const size = Math.min(width, height) / (text.length * 0.45);
      page.drawText(text, {
        x: width / 2 - font.widthOfTextAtSize(text, size) / 2.6,
        y: height / 2.6,
        size,
        font,
        color: rgb(0.6, 0.6, 0.6),
        opacity: this.watermarkOpacity / 100,
        rotate: degrees(35),
      });
    }
    this.download(await doc.save(), `${this.baseName()}-watermarked.pdf`);
    this.snackBar.open('Watermark added', 'Close', { duration: 3000 });
  }

  private async addPageNumbers(): Promise<void> {
    const doc = await PDFDocument.load(await this.files[0].arrayBuffer(), { ignoreEncryption: true });
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const total = doc.getPageCount();
    doc.getPages().forEach((page, i) => {
      const { width, height } = page.getSize();
      const label = `${i + 1} / ${total}`;
      const tw = font.widthOfTextAtSize(label, 10);
      let x = width / 2 - tw / 2, y = 24;
      if (this.numberPos === 'bottom-right') { x = width - tw - 36; }
      if (this.numberPos === 'top-right') { x = width - tw - 36; y = height - 30; }
      page.drawText(label, { x, y, size: 10, font, color: rgb(0.35, 0.35, 0.35) });
    });
    this.download(await doc.save(), `${this.baseName()}-numbered.pdf`);
    this.snackBar.open('Page numbers added', 'Close', { duration: 3000 });
  }
}
