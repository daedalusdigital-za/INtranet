import {
  Component, HostListener, inject, signal, ViewChild, ElementRef, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  PaperlessService, PaperlessDocument, PaperlessStatus
} from '../../services/paperless.service';

type ViewerTool = 'none' | 'annotate' | 'sign';

/**
 * Paperless — global off-canvas (slide-over) drawer system.
 *
 * Rendered ONCE at the app root so it is available inside every module.
 * It is NOT a mat-sidenav: these are fixed-position slide-over panels that
 * animate in from the screen edges. The left and right panels are
 * distinguished by their panel class (`paperless-panel--left` /
 * `paperless-panel--right`).
 *
 *  - RIGHT panel — controller/navigation rail: upload, share, delivery
 *    progress, notifications & suggestions. Default ~440px, expands to 92vw.
 *  - LEFT  panel — near full-screen viewer: open documents, annotate, e-sign.
 */
@Component({
  selector: 'app-paperless',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './paperless.component.html',
  styleUrls: ['./paperless.component.scss']
})
export class PaperlessComponent {
  readonly paperless = inject(PaperlessService);
  private readonly sanitizer = inject(DomSanitizer);

  // Right panel expand/collapse (default compact controller, expands to 92vw)
  readonly rightExpanded = signal(false);

  // Drag-over highlight on the upload zone
  readonly dragActive = signal(false);

  // Per-document share input model
  shareInputs: Record<string, string> = {};

  // ── Left viewer state ──────────────────────────────────────
  readonly tool = signal<ViewerTool>('none');
  readonly annotationColour = signal('#eab308');

  // Signature pad
  @ViewChild('sigPad') sigPad?: ElementRef<HTMLCanvasElement>;
  private sigCtx: CanvasRenderingContext2D | null = null;
  private drawing = false;
  private sigDirty = false;
  signBy = '';

  readonly doc = computed(() => this.paperless.selectedDocument());
  readonly isImage = computed(() => (this.doc()?.mime ?? '').startsWith('image/'));
  readonly isPdf = computed(() => (this.doc()?.mime ?? '') === 'application/pdf');
  /** Sanitised URL so the PDF data-url can be bound to an iframe src. */
  readonly pdfUrl = computed<SafeResourceUrl | null>(() => {
    const d = this.doc();
    return d && this.isPdf() ? this.sanitizer.bypassSecurityTrustResourceUrl(d.dataUrl) : null;
  });

  // ── Keyboard / backdrop ────────────────────────────────────
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.paperless.anyOpen()) this.paperless.closeAll();
  }

  closeAll(): void { this.paperless.closeAll(); }
  close(side: 'left' | 'right'): void { this.paperless.close(side); }

  toggleRightExpanded(): void { this.rightExpanded.update(v => !v); }

  // ── Upload ─────────────────────────────────────────────────
  onFilePicked(evt: Event): void {
    const input = evt.target as HTMLInputElement;
    if (input.files && input.files.length) {
      this.paperless.addFiles(input.files);
      input.value = '';
    }
  }

  onDragOver(evt: DragEvent): void {
    evt.preventDefault();
    this.dragActive.set(true);
  }
  onDragLeave(): void { this.dragActive.set(false); }
  onDrop(evt: DragEvent): void {
    evt.preventDefault();
    this.dragActive.set(false);
    if (evt.dataTransfer?.files?.length) {
      this.paperless.addFiles(evt.dataTransfer.files);
    }
  }

  // ── Document actions (right panel) ─────────────────────────
  openDoc(d: PaperlessDocument): void {
    this.tool.set('none');
    this.paperless.openInViewer(d.id);
  }

  shareDoc(d: PaperlessDocument): void {
    const val = this.shareInputs[d.id];
    if (val && val.trim()) {
      this.paperless.share(d.id, val);
      this.shareInputs[d.id] = '';
    }
  }

  ack(docId: string, recipient: string): void {
    this.paperless.acknowledge(docId, recipient);
  }

  remove(d: PaperlessDocument): void {
    if (confirm(`Remove "${d.name}" from Paperless?`)) {
      this.paperless.removeDocument(d.id);
    }
  }

  advance(d: PaperlessDocument): void {
    const flow: PaperlessStatus[] = ['draft', 'pipeline', 'sent', 'received', 'signed'];
    const next = flow[Math.min(flow.indexOf(d.status) + 1, flow.length - 1)];
    this.paperless.setStatus(d.id, next);
  }

  // ── Suggestions (heuristic, no backend yet) ────────────────
  readonly suggestions = computed<string[]>(() => {
    const docs = this.paperless.documents();
    const out: string[] = [];
    const drafts = docs.filter(d => d.status === 'draft');
    if (drafts.length) out.push(`You have ${drafts.length} draft${drafts.length > 1 ? 's' : ''} not yet shared — open one to annotate or send it.`);
    const unsigned = docs.filter(d => d.annotations.length > 0 && d.signatures.length === 0);
    if (unsigned.length) out.push(`${unsigned.length} annotated document${unsigned.length > 1 ? 's' : ''} still need a signature.`);
    const awaiting = docs.filter(d => d.status === 'sent');
    if (awaiting.length) out.push(`${awaiting.length} shared document${awaiting.length > 1 ? 's are' : ' is'} awaiting confirmation of receipt.`);
    if (docs.length === 0) out.push('Drop a file above to start — invoices, PODs, contracts. Everything stays paperless.');
    return out;
  });

  // ── Status helpers ─────────────────────────────────────────
  statusLabel(s: PaperlessStatus): string {
    return { draft: 'Draft', pipeline: 'In pipeline', sent: 'Sent', received: 'Received', signed: 'Signed' }[s];
  }
  statusColour(s: PaperlessStatus): string {
    return { draft: '#64748b', pipeline: '#d97706', sent: '#2563eb', received: '#0891b2', signed: '#16a34a' }[s];
  }
  fileIcon(mime: string): string {
    if (mime.startsWith('image/')) return 'image';
    if (mime === 'application/pdf') return 'picture_as_pdf';
    if (mime.includes('word')) return 'description';
    return 'insert_drive_file';
  }
  humanSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
  // circumference for the progress ring (r=16)
  readonly ringCirc = 2 * Math.PI * 16;
  ringOffset(progress: number): number {
    return this.ringCirc * (1 - progress / 100);
  }

  // ── Left viewer: annotations ───────────────────────────────
  onPageClick(evt: MouseEvent): void {
    if (this.tool() !== 'annotate') return;
    const d = this.doc();
    if (!d) return;
    const el = evt.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const xPct = ((evt.clientX - rect.left) / rect.width) * 100;
    const yPct = ((evt.clientY - rect.top) / rect.height) * 100;
    const text = prompt('Annotation note:');
    if (text && text.trim()) {
      this.paperless.addAnnotation(d.id, { text: text.trim(), xPct, yPct, colour: this.annotationColour() });
    }
  }

  deleteAnnotation(annId: string): void {
    const d = this.doc();
    if (d) this.paperless.removeAnnotation(d.id, annId);
  }

  deleteSignature(sigId: string): void {
    const d = this.doc();
    if (d) this.paperless.removeSignature(d.id, sigId);
  }

  setTool(t: ViewerTool): void {
    this.tool.set(this.tool() === t ? 'none' : t);
    if (this.tool() === 'sign') {
      // init pad after it renders
      setTimeout(() => this.initSigPad(), 0);
    }
  }

  // ── Left viewer: signature pad ─────────────────────────────
  private initSigPad(): void {
    const canvas = this.sigPad?.nativeElement;
    if (!canvas) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    this.sigCtx = canvas.getContext('2d');
    if (this.sigCtx) {
      this.sigCtx.lineWidth = 2.5;
      this.sigCtx.lineCap = 'round';
      this.sigCtx.strokeStyle = '#0f172a';
    }
    this.sigDirty = false;
  }

  private padPos(e: MouseEvent | TouchEvent): { x: number; y: number } {
    const canvas = this.sigPad!.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const p = 'touches' in e ? e.touches[0] : e;
    return { x: p.clientX - rect.left, y: p.clientY - rect.top };
  }

  padDown(e: MouseEvent | TouchEvent): void {
    if (!this.sigCtx) this.initSigPad();
    this.drawing = true;
    const { x, y } = this.padPos(e);
    this.sigCtx!.beginPath();
    this.sigCtx!.moveTo(x, y);
    e.preventDefault();
  }
  padMove(e: MouseEvent | TouchEvent): void {
    if (!this.drawing || !this.sigCtx) return;
    const { x, y } = this.padPos(e);
    this.sigCtx.lineTo(x, y);
    this.sigCtx.stroke();
    this.sigDirty = true;
    e.preventDefault();
  }
  padUp(): void { this.drawing = false; }

  clearPad(): void {
    const canvas = this.sigPad?.nativeElement;
    if (canvas && this.sigCtx) this.sigCtx.clearRect(0, 0, canvas.width, canvas.height);
    this.sigDirty = false;
  }

  applySignature(): void {
    const d = this.doc();
    const canvas = this.sigPad?.nativeElement;
    if (!d || !canvas) return;
    if (!this.sigDirty) { alert('Please draw your signature first.'); return; }
    const dataUrl = canvas.toDataURL('image/png');
    this.paperless.addSignature(d.id, {
      dataUrl,
      signedBy: this.signBy.trim() || 'Me',
      xPct: 62,
      yPct: 82
    });
    this.clearPad();
    this.tool.set('none');
  }
}
