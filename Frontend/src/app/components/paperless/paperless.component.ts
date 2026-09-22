import {
  Component, HostListener, inject, signal, ViewChild, ElementRef, computed, effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import * as pdfjsLib from 'pdfjs-dist';
import {
  PaperlessService, PaperlessDocument, PaperlessStatus,
  RecipientRole, RoutingMode, PaperlessRecipient, ActivityType,
  StackKind, PaperlessUser, PaperlessCategory, PAPERLESS_CATEGORIES
} from '../../services/paperless.service';
import { NotificationService } from '../../services/notification.service';

// Use the bundled pdf.js worker so we can render PDFs into scrollable canvases
// (an <iframe> viewer scrolls internally and detaches the annotation overlay).
// The worker is copied to the site root by angular.json ("pdf.worker.min.mjs"),
// so reference it by its served path rather than import.meta.url (which emits a
// hashed path that 404s at runtime). Resolve against the document base URL so it
// still works on deep SPA routes (e.g. /paperless).
(pdfjsLib as any).GlobalWorkerOptions.workerSrc =
  new URL('pdf.worker.min.mjs', document.baseURI).toString();
type ViewerTool = 'none' | 'annotate' | 'sign' | 'stack';

/**
 * Paperless — global off-canvas (slide-over) drawer system.
 *
 * Rendered ONCE at the app root so it is available inside every module.
 * It is NOT a mat-sidenav: these are fixed-position slide-over panels that
 * animate in from the screen edges. The left and right panels are
 * distinguished by their panel class (`paperless-panel--left` /
 * `paperless-panel--right`).
 *
 *  - RIGHT panel — controller / workflow rail: upload, recipient routing
 *    (Adobe-style signer / approver / viewer with sequential or parallel
 *    order), live delivery progress, activity trail, suggestions.
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
  private readonly notify = inject(NotificationService);

  // Right panel expand/collapse (default compact controller, expands to 92vw)
  readonly rightExpanded = signal(false);

  // Drag-over highlight on the upload zone
  readonly dragActive = signal(false);

  // ── Workflow category picker ───────────────────────────────
  // Every upload/link first asks "what kind of workflow is this?" via a card
  // grid. The pending files/action are stashed until the user picks a category.
  readonly categories = PAPERLESS_CATEGORIES;
  readonly catPickerOpen = signal(false);
  private pendingAction: ((cat: PaperlessCategory) => void | Promise<void>) | null = null;
  /** Short human summary of what's being categorised (shown in the picker). */
  readonly catPickerSubject = signal<string>('');

  /** Open the category picker, remembering what to do once a card is chosen. */
  private askCategory(subject: string, run: (cat: PaperlessCategory) => void | Promise<void>): void {
    this.pendingAction = run;
    this.catPickerSubject.set(subject);
    this.catPickerOpen.set(true);
  }
  /** User picked a category card — run the pending upload/link with it. */
  async chooseCategory(cat: PaperlessCategory): Promise<void> {
    const run = this.pendingAction;
    this.catPickerOpen.set(false);
    this.pendingAction = null;
    this.catPickerSubject.set('');
    if (run) await run(cat);
  }
  /** Dismiss the picker without uploading. */
  cancelCategory(): void {
    this.catPickerOpen.set(false);
    this.pendingAction = null;
    this.catPickerSubject.set('');
  }
  categoryLabel(cat?: PaperlessCategory | null): string {
    return this.categories.find(c => c.value === cat)?.label ?? '';
  }
  categoryIcon(cat?: PaperlessCategory | null): string {
    return this.categories.find(c => c.value === cat)?.icon ?? 'label';
  }

  // Which document card is expanded to show its workflow builder
  readonly expandedDocId = signal<string | null>(null);

  // Recipient builder inputs (per document)
  recipName: Record<string, string> = {};
  recipEmail: Record<string, string> = {};
  recipRole: Record<string, RecipientRole> = {};
  // Live user-directory suggestions for the recipient picker (per document)
  recipSuggestions: Record<string, PaperlessUser[]> = {};
  private recipSearchTimer: any = null;

  // ── Share dialog ───────────────────────────────────────────
  readonly shareOpen = signal(false);
  shareDoc: PaperlessDocument | null = null;
  shareQuery = '';
  readonly shareResults = signal<PaperlessUser[]>([]);
  shareSelected: PaperlessUser[] = [];
  shareMessage = '';
  readonly sharing = signal(false);
  private shareSearchTimer: any = null;

  // Selected stack kind per document (right controller)
  docStackKind: Record<string, StackKind> = {};

  // ── Left viewer state ──────────────────────────────────────
  readonly tool = signal<ViewerTool>('none');
  readonly annotationColour = signal('#f59e0b');

  // Signature pad
  @ViewChild('sigPad') sigPad?: ElementRef<HTMLCanvasElement>;
  @ViewChild('sigUpload') sigUpload?: ElementRef<HTMLInputElement>;
  private sigCtx: CanvasRenderingContext2D | null = null;
  private drawing = false;
  private sigDirty = false;
  signBy = '';
  /** How the signature is being provided: draw, upload a PNG, or reuse saved. */
  readonly sigMode = signal<'draw' | 'upload' | 'saved'>('draw');
  /** data-url of an uploaded/selected signature image (upload mode). */
  readonly uploadedSig = signal<string | null>(null);
  /** The user's saved signature (persisted in localStorage), if any. */
  readonly savedSig = signal<string | null>(this.loadSavedSig());
  /** When true, apply also stores the current signature as the saved default. */
  rememberSig = false;
  private readonly SAVED_SIG_KEY = 'paperless.savedSignature.v1';

  // ── Stack (attach supporting documents) ────────────────────
  @ViewChild('stackInput') stackInput?: ElementRef<HTMLInputElement>;
  stackKind: StackKind = 'ProofOfDelivery';
  readonly stackKinds: StackKind[] = [
    'GRV', 'PurchaseOrder', 'DeliveryNote', 'ProofOfDelivery',
    'Invoice', 'Statement', 'PaymentSchedule', 'Recon'
  ];
  stackKindLabel(k: StackKind): string { return this.paperless.stackKindLabel(k); }
  stackKindIcon(k: StackKind): string {
    return {
      GRV: 'inventory', PurchaseOrder: 'shopping_cart', DeliveryNote: 'local_shipping',
      ProofOfDelivery: 'task_alt', Invoice: 'receipt_long', Statement: 'account_balance',
      PaymentSchedule: 'event_repeat', Recon: 'rule'
    }[k];
  }
  triggerStackPicker(): void { this.stackInput?.nativeElement.click(); }
  async onStackPicked(evt: Event): Promise<void> {
    const input = evt.target as HTMLInputElement;
    const d = this.doc();
    if (d && input.files?.length) {
      const files = Array.from(input.files);
      const kind = this.stackKind;
      const subject = files.length === 1 ? files[0].name : `${files.length} files`;
      this.askCategory(subject, async cat => {
        let lastId: string | null = null;
        for (const f of files) {
          lastId = await this.paperless.addStackItem(d.id, kind, f, cat);
        }
        if (lastId) this.paperless.openInViewer(lastId);
      });
    }
    input.value = '';
  }
  /** Documents stacked under the given (or currently viewed) document. */
  stackChildren(d?: PaperlessDocument | null): PaperlessDocument[] {
    const doc = d ?? this.doc();
    return doc ? this.paperless.stackChildren(doc.id) : [];
  }
  stackCount(d: PaperlessDocument): number { return this.paperless.stackCount(d.id); }
  removeStackChild(childId: string): void { this.paperless.removeStackItem(childId); }
  openStackChild(childId: string): void { this.tool.set('none'); this.paperless.openInViewer(childId); }
  /** Parent document of the currently viewed child, if any. */
  parentOf(d?: PaperlessDocument | null): PaperlessDocument | null {
    const doc = d ?? this.doc();
    if (!doc?.parentId) return null;
    return this.paperless.documents().find(x => x.id === doc.parentId) ?? null;
  }
  async addStackToDoc(d: PaperlessDocument, kind: StackKind, evt: Event): Promise<void> {
    const input = evt.target as HTMLInputElement;
    if (input.files?.length) {
      const files = Array.from(input.files);
      const subject = files.length === 1 ? files[0].name : `${files.length} files`;
      this.askCategory(subject, async cat => {
        for (const f of files) {
          await this.paperless.addStackItem(d.id, kind, f, cat);
        }
      });
    }
    input.value = '';
  }
  fileKindIcon(mime: string): string { return this.fileIcon(mime); }

  // ── Viewer film-strip (stacked documents side nav) ─────────
  /**
   * The set of documents shown in the left side-nav of the viewer: the parent
   * (root) document followed by all of its stacked children. Lets the user jump
   * between the main document and its supporting files without leaving the view.
   */
  filmstripDocs(d?: PaperlessDocument | null): PaperlessDocument[] {
    const cur = d ?? this.doc();
    if (!cur) return [];
    const root = this.parentOf(cur) ?? cur;
    return [root, ...this.paperless.stackChildren(root.id)];
  }
  /** A document counts as "signed" once it has one or more signatures. */
  isDocSigned(d: PaperlessDocument): boolean {
    return (d.signatures?.length ?? 0) > 0 || d.status === 'completed';
  }
  /** Whether the film-strip should show (more than one document in the stack). */
  hasFilmstrip(d?: PaperlessDocument | null): boolean {
    return this.filmstripDocs(d).length > 1;
  }
  isCurrentDoc(d: PaperlessDocument): boolean {
    return this.doc()?.id === d.id;
  }

  /** Open a document from the "Shared with me" inbox in the viewer. */
  openInboxItem(i: { id: string }): void {
    this.tool.set('none');
    this.paperless.openInViewer(i.id);
  }

  // ── Rotation (persisted orientation) ───────────────────────
  readonly rotation = computed(() => this.doc()?.rotation ?? 0);
  rotate(delta: number): void {
    const d = this.doc();
    if (d) this.paperless.rotateDocument(d.id, delta);
  }

  readonly doc = computed(() => this.paperless.selectedDocument());
  readonly isImage = computed(() => (this.doc()?.mime ?? '').startsWith('image/'));
  readonly isPdf = computed(() => (this.doc()?.mime ?? '') === 'application/pdf');
  /** Sanitised URL so the PDF data-url can be bound to an iframe src. */
  readonly pdfUrl = computed<SafeResourceUrl | null>(() => {
    const d = this.doc();
    return d && this.isPdf() ? this.sanitizer.bypassSecurityTrustResourceUrl(d.dataUrl) : null;
  });

  // ── PDF canvas rendering (scrollable, annotation-anchored) ──
  /** Host element that receives the rendered <canvas> pages. */
  @ViewChild('pdfHost') pdfHost?: ElementRef<HTMLDivElement>;
  /** Bumped on every render request so stale async renders bail out. */
  private renderToken = 0;
  readonly pdfRendering = signal(false);

  constructor() {
    // Re-render the PDF whenever the open document, its loaded bytes, or the
    // persisted rotation change. A microtask/timeout lets the @if host element
    // materialise first. Rendering our own canvases (instead of an <iframe>)
    // keeps the annotation overlay glued to the page while scrolling.
    effect(() => {
      const d = this.doc();
      const url = d?.dataUrl;          // track: re-render once bytes arrive
      const rot = this.rotation();     // track: re-render on rotate
      const pdf = this.isPdf();
      // touch vars to satisfy the linter without side effects
      void url; void rot;
      if (pdf) {
        setTimeout(() => this.renderPdf(), 0);
      } else {
        const host = this.pdfHost?.nativeElement;
        if (host) host.innerHTML = '';
      }
    });
  }

  private dataUrlToUint8(dataUrl: string): Uint8Array | null {
    const i = dataUrl.indexOf(',');
    if (i < 0) return null;
    try {
      const bin = atob(dataUrl.slice(i + 1));
      const arr = new Uint8Array(bin.length);
      for (let k = 0; k < bin.length; k++) arr[k] = bin.charCodeAt(k);
      return arr;
    } catch { return null; }
  }

  /** Read a document's bytes from its URL (blob: object URL or data: URL). */
  private async fetchBytes(url: string): Promise<Uint8Array | null> {
    // Fast path for base64 data URLs (avoids a network round-trip).
    if (url.startsWith('data:')) return this.dataUrlToUint8(url);
    try {
      const res = await fetch(url);
      const buf = await res.arrayBuffer();
      return new Uint8Array(buf);
    } catch {
      return null;
    }
  }

  /** Render the current PDF's pages into stacked canvases inside #pdfHost. */
  private async renderPdf(): Promise<void> {
    const host = this.pdfHost?.nativeElement;
    const d = this.doc();
    if (!host) return;
    if (!d || !this.isPdf() || !d.dataUrl) { host.innerHTML = ''; return; }

    const token = ++this.renderToken;
    const data = await this.fetchBytes(d.dataUrl);
    if (token !== this.renderToken) return;
    if (!data) { host.innerHTML = ''; return; }

    this.pdfRendering.set(true);
    try {
      const loadingTask = (pdfjsLib as any).getDocument({ data });
      const pdf = await loadingTask.promise;
      if (token !== this.renderToken) { try { pdf.destroy(); } catch { /* ignore */ } return; }

      const rotation = ((this.rotation() % 360) + 360) % 360;
      const containerWidth = host.clientWidth || 880;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      // Build all canvases into a fragment, then swap in one go to avoid flicker.
      const frag = document.createDocumentFragment();
      for (let n = 1; n <= pdf.numPages; n++) {
        if (token !== this.renderToken) return;
        const page = await pdf.getPage(n);
        const base = page.getViewport({ scale: 1, rotation });
        const scale = containerWidth / base.width;
        const viewport = page.getViewport({ scale, rotation });

        const canvas = document.createElement('canvas');
        canvas.className = 'pl-page__canvas';
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        const ctx = canvas.getContext('2d');
        if (ctx) {
          await page.render({
            canvasContext: ctx,
            viewport,
            transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined
          }).promise;
        }
        if (token !== this.renderToken) return;
        frag.appendChild(canvas);
      }
      if (token !== this.renderToken) return;
      host.innerHTML = '';
      host.appendChild(frag);
    } catch {
      if (token === this.renderToken) {
        host.innerHTML = '<div class="pl-pdf-error">Unable to render this PDF.</div>';
      }
    } finally {
      if (token === this.renderToken) this.pdfRendering.set(false);
    }
  }

  // ── Controller search (invoice / item / barcode) ──────────
  panelSearch = '';
  runPanelSearch(): void { this.paperless.search(this.panelSearch); }
  clearSearch(): void { this.panelSearch = ''; this.paperless.clearSearch(); }

  previewInvoice(inv: any): void { this.tool.set('none'); this.paperless.previewInvoice(inv); }
  previewStock(b: any): void { this.tool.set('none'); this.paperless.previewStock(b); }
  previewAsset(a: any): void { this.tool.set('none'); this.paperless.previewAsset(a); }
  previewCommodity(c: any): void { this.tool.set('none'); this.paperless.previewCommodity(c); }
  previewTripsheet(l: any): void { this.tool.set('none'); this.paperless.previewTripsheet(l); }
  previewPod(p: any): void { this.tool.set('none'); this.paperless.previewPod(p); }

  /** The read-only left-panel preview (a drilled-in search result). */
  readonly preview = computed(() => this.paperless.preview());
  /** Sanitised tripsheet PDF url for the preview iframe. */
  readonly previewPdfUrl = computed<SafeResourceUrl | null>(() => {
    const p = this.paperless.preview();
    return p?.pdfDataUrl ? this.sanitizer.bypassSecurityTrustResourceUrl(p.pdfDataUrl) : null;
  });

  // ── Keyboard / backdrop ────────────────────────────────────
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.paperless.anyOpen()) this.paperless.closeAll();
  }

  closeAll(): void { this.paperless.closeAll(); }
  close(side: 'left' | 'right'): void { this.paperless.close(side); }

  toggleRightExpanded(): void { this.rightExpanded.update(v => !v); }

  toggleExpanded(id: string): void {
    this.expandedDocId.set(this.expandedDocId() === id ? null : id);
    if (!this.recipRole[id]) this.recipRole[id] = 'signer';
  }
  isExpanded(id: string): boolean { return this.expandedDocId() === id; }

  // ── Upload ─────────────────────────────────────────────────
  onFilePicked(evt: Event): void {
    const input = evt.target as HTMLInputElement;
    if (input.files && input.files.length) {
      const files = Array.from(input.files);
      input.value = '';
      const subject = files.length === 1 ? files[0].name : `${files.length} files`;
      this.askCategory(subject, cat => this.paperless.addFiles(files, cat));
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
      const files = Array.from(evt.dataTransfer.files);
      const subject = files.length === 1 ? files[0].name : `${files.length} files`;
      this.askCategory(subject, cat => this.paperless.addFiles(files, cat));
    }
  }

  // ── Document actions (right panel) ─────────────────────────
  openDoc(d: PaperlessDocument): void {
    this.tool.set('none');
    this.paperless.openInViewer(d.id);
  }

  remove(d: PaperlessDocument): void {
    if (confirm(`Remove "${d.name}" from Paperless?`)) {
      this.paperless.removeDocument(d.id);
    }
  }

  /** Rename a document's friendly display name. */
  rename(d: PaperlessDocument): void {
    const name = prompt('Rename document', d.name);
    if (name && name.trim() && name.trim() !== d.name) {
      this.paperless.renameDocument(d.id, name.trim());
    }
  }

  // ── Share dialog ───────────────────────────────────────────
  openShare(d: PaperlessDocument): void {
    this.shareDoc = d;
    this.shareQuery = '';
    this.shareMessage = '';
    this.shareSelected = [];
    this.shareResults.set([]);
    this.shareOpen.set(true);
    // Pre-load a few users so the list isn't empty.
    this.paperless.searchUsers('').subscribe({
      next: (u) => this.shareResults.set(u),
      error: () => this.shareResults.set([])
    });
  }

  closeShare(): void {
    this.shareOpen.set(false);
    this.shareDoc = null;
  }

  onShareInput(): void {
    if (this.shareSearchTimer) clearTimeout(this.shareSearchTimer);
    this.shareSearchTimer = setTimeout(() => {
      this.paperless.searchUsers(this.shareQuery).subscribe({
        next: (u) => this.shareResults.set(u),
        error: () => this.shareResults.set([])
      });
    }, 220);
  }

  isShareSelected(u: PaperlessUser): boolean {
    return this.shareSelected.some(s => s.id === u.id);
  }

  toggleShareUser(u: PaperlessUser): void {
    if (this.isShareSelected(u)) {
      this.shareSelected = this.shareSelected.filter(s => s.id !== u.id);
    } else if (u.email) {
      this.shareSelected = [...this.shareSelected, u];
    }
  }

  doShare(): void {
    const d = this.shareDoc;
    if (!d) return;
    const emails = this.shareSelected.map(u => u.email).filter(Boolean);
    if (emails.length === 0) {
      this.notify.showNotification({
        title: 'Nothing to share',
        message: 'Select at least one person to share with.',
        type: 'warning', playSound: false
      });
      return;
    }
    this.sharing.set(true);
    this.paperless.shareDocument(d.id, emails, this.shareMessage).subscribe({
      next: (res) => {
        this.sharing.set(false);
        this.closeShare();
        const people = `${res.shared} ${res.shared === 1 ? 'person' : 'people'}`;
        if (res.emailSent) {
          this.notify.showNotification({
            title: 'Email sent',
            message: `“${d.name}” and its attachments were emailed to ${people}.`,
            type: 'success'
          });
        } else {
          this.notify.showNotification({
            title: 'Shared, but email failed',
            message: `Access was granted to ${people}, but the email could not be sent. Check the mail settings and try again.`,
            type: 'warning', duration: 8000
          });
        }
      },
      error: () => {
        this.sharing.set(false);
        this.notify.showNotification({
          title: 'Sharing failed',
          message: 'The document could not be shared. Please try again.',
          type: 'error', duration: 8000
        });
      }
    });
  }

  // ── Workflow: recipients & routing ─────────────────────────
  setRole(id: string, role: RecipientRole): void { this.recipRole[id] = role; }

  /**
   * Recipients can be added at any point in an *active* workflow — while the
   * document is still a draft, out for signature, or in progress. Only a
   * finished workflow (completed / declined / cancelled) locks the list.
   */
  canAddRecipients(d: PaperlessDocument): boolean {
    return d.status === 'draft'
        || d.status === 'out_for_signature'
        || d.status === 'in_progress';
  }

  /** Live-search the system user directory as the user types a recipient name. */
  onRecipInput(d: PaperlessDocument): void {
    const q = (this.recipName[d.id] || '').trim();
    if (this.recipSearchTimer) clearTimeout(this.recipSearchTimer);
    if (q.length < 2) { this.recipSuggestions[d.id] = []; return; }
    this.recipSearchTimer = setTimeout(() => {
      this.paperless.searchUsers(q).subscribe({
        next: (users) => this.recipSuggestions[d.id] = users,
        error: () => this.recipSuggestions[d.id] = []
      });
    }, 220);
  }

  /** Pick a user from the suggestion list as the recipient. */
  pickRecipUser(d: PaperlessDocument, u: PaperlessUser): void {
    this.recipName[d.id] = u.name;
    this.recipEmail[d.id] = u.email;
    this.recipSuggestions[d.id] = [];
    this.addRecipient(d);
  }

  addRecipient(d: PaperlessDocument): void {
    const name = this.recipName[d.id];
    if (!name || !name.trim()) return;
    this.paperless.addRecipient(d.id, name, this.recipRole[d.id] || 'signer', this.recipEmail[d.id]);
    this.recipName[d.id] = '';
    this.recipEmail[d.id] = '';
    this.recipSuggestions[d.id] = [];
  }

  removeRecipient(d: PaperlessDocument, rId: string): void {
    this.paperless.removeRecipient(d.id, rId);
  }
  moveRecipient(d: PaperlessDocument, rId: string, dir: -1 | 1): void {
    this.paperless.moveRecipient(d.id, rId, dir);
  }
  setRouting(d: PaperlessDocument, mode: RoutingMode): void {
    this.paperless.setRouting(d.id, mode);
  }
  send(d: PaperlessDocument): void {
    if (d.recipients.length === 0) { alert('Add at least one recipient first.'); return; }
    this.paperless.sendForSignature(d.id);
  }
  markActed(d: PaperlessDocument, r: PaperlessRecipient): void {
    this.paperless.recordAction(d.id, r.id);
  }
  markDeclined(d: PaperlessDocument, r: PaperlessRecipient): void {
    const reason = prompt(`Decline reason for ${r.name} (optional):`) ?? undefined;
    this.paperless.recordDecline(d.id, r.id, reason || undefined);
  }
  remind(d: PaperlessDocument, r: PaperlessRecipient): void {
    this.paperless.remind(d.id, r.id);
  }
  cancel(d: PaperlessDocument): void {
    if (confirm(`Cancel the workflow for "${d.name}"?`)) this.paperless.cancelWorkflow(d.id);
  }

  isActive(d: PaperlessDocument, r: PaperlessRecipient): boolean {
    return this.paperless.isRecipientActive(d, r.id);
  }
  canSend(d: PaperlessDocument): boolean {
    return d.status === 'draft' && d.recipients.length > 0;
  }
  isLive(d: PaperlessDocument): boolean {
    return d.status === 'out_for_signature' || d.status === 'in_progress';
  }

  // ── Suggestions (heuristic, no backend yet) ────────────────
  readonly suggestions = computed<string[]>(() => {
    const docs = this.paperless.documents();
    const out: string[] = [];
    if (docs.length === 0) {
      out.push('Drop a file above to start — invoices, PODs, contracts. Everything stays paperless.');
      return out;
    }
    const readyToSend = docs.filter(d => d.status === 'draft' && d.recipients.length > 0);
    if (readyToSend.length) out.push(`${readyToSend.length} document${readyToSend.length > 1 ? 's are' : ' is'} ready to send for signature.`);
    const noRecipients = docs.filter(d => d.status === 'draft' && d.recipients.length === 0);
    if (noRecipients.length) out.push(`${noRecipients.length} draft${noRecipients.length > 1 ? 's have' : ' has'} no recipients — add signers to start the workflow.`);
    const live = docs.filter(d => this.isLive(d));
    if (live.length) out.push(`${live.length} agreement${live.length > 1 ? 's are' : ' is'} in flight — send a reminder to keep things moving.`);
    return out;
  });

  // ── Status helpers ─────────────────────────────────────────
  statusLabel(s: PaperlessStatus): string {
    return {
      draft: 'Draft',
      out_for_signature: 'Out for signature',
      in_progress: 'In progress',
      completed: 'Completed',
      declined: 'Declined',
      cancelled: 'Cancelled'
    }[s];
  }
  statusColour(s: PaperlessStatus): string {
    return {
      draft: '#64748b',
      out_for_signature: '#6366f1',
      in_progress: '#0ea5e9',
      completed: '#10b981',
      declined: '#ef4444',
      cancelled: '#94a3b8'
    }[s];
  }
  statusIcon(s: PaperlessStatus): string {
    return {
      draft: 'edit_document',
      out_for_signature: 'send',
      in_progress: 'autorenew',
      completed: 'verified',
      declined: 'cancel',
      cancelled: 'block'
    }[s];
  }

  roleLabel(r: RecipientRole): string {
    return { signer: 'Signer', approver: 'Approver', viewer: 'Viewer' }[r];
  }
  roleIcon(r: RecipientRole): string {
    return { signer: 'draw', approver: 'thumb_up', viewer: 'visibility' }[r];
  }
  recipStateColour(state: string): string {
    return {
      waiting: '#94a3b8', viewed: '#0ea5e9',
      signed: '#10b981', approved: '#10b981', declined: '#ef4444'
    }[state] ?? '#94a3b8';
  }
  recipStateIcon(state: string): string {
    return {
      waiting: 'schedule', viewed: 'visibility',
      signed: 'draw', approved: 'thumb_up', declined: 'cancel'
    }[state] ?? 'schedule';
  }

  activityIcon(t: ActivityType): string {
    return {
      created: 'upload_file', shared: 'send', viewed: 'visibility',
      signed: 'draw', approved: 'thumb_up', declined: 'cancel',
      annotated: 'edit_note', completed: 'verified', reminder: 'notifications_active',
      cancelled: 'block'
    }[t] ?? 'circle';
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
      // Default to the saved signature if the user has one.
      this.sigMode.set(this.savedSig() ? 'saved' : 'draw');
      setTimeout(() => this.initSigPad(), 0);
    }
  }

  setSigMode(m: 'draw' | 'upload' | 'saved'): void {
    this.sigMode.set(m);
    if (m === 'draw') setTimeout(() => this.initSigPad(), 0);
  }

  triggerSigUpload(): void { this.sigUpload?.nativeElement.click(); }

  onSigPicked(evt: Event): void {
    const input = evt.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => this.uploadedSig.set(reader.result as string);
      reader.readAsDataURL(file);
    }
    input.value = '';
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
    if (!d) return;

    let dataUrl: string | null = null;
    const mode = this.sigMode();
    if (mode === 'draw') {
      const canvas = this.sigPad?.nativeElement;
      if (!canvas) return;
      if (!this.sigDirty) { alert('Please draw your signature first.'); return; }
      dataUrl = canvas.toDataURL('image/png');
    } else if (mode === 'upload') {
      dataUrl = this.uploadedSig();
      if (!dataUrl) { alert('Please choose a signature image first.'); return; }
    } else { // saved
      dataUrl = this.savedSig();
      if (!dataUrl) { alert('No saved signature yet. Draw or upload one first.'); return; }
    }

    // Optionally remember this signature as the user's default.
    if (this.rememberSig && dataUrl && mode !== 'saved') this.persistSavedSig(dataUrl);

    this.paperless.addSignature(d.id, {
      dataUrl,
      signedBy: this.signBy.trim() || 'Me',
      xPct: 62,
      yPct: 82
    });
    this.clearPad();
    this.uploadedSig.set(null);
    this.tool.set('none');
  }

  // ── Saved signature (per-browser default) ──────────────────
  private loadSavedSig(): string | null {
    try { return localStorage.getItem('paperless.savedSignature.v1'); }
    catch { return null; }
  }
  private persistSavedSig(dataUrl: string): void {
    try { localStorage.setItem(this.SAVED_SIG_KEY, dataUrl); } catch { /* ignore */ }
    this.savedSig.set(dataUrl);
  }
  saveCurrentAsDefault(): void {
    const mode = this.sigMode();
    let dataUrl: string | null = null;
    if (mode === 'draw') {
      const canvas = this.sigPad?.nativeElement;
      if (canvas && this.sigDirty) dataUrl = canvas.toDataURL('image/png');
    } else if (mode === 'upload') {
      dataUrl = this.uploadedSig();
    }
    if (dataUrl) this.persistSavedSig(dataUrl);
    else alert('Draw or upload a signature first, then save it as default.');
  }
  clearSavedSig(): void {
    try { localStorage.removeItem(this.SAVED_SIG_KEY); } catch { /* ignore */ }
    this.savedSig.set(null);
    if (this.sigMode() === 'saved') this.sigMode.set('draw');
  }
}
