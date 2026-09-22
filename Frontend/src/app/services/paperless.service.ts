import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AssetTrackingService, ResolveResult } from './asset-tracking.service';

/**
 * Which edge a Paperless drawer slides in from.
 * The two drawers are visually distinguished purely by their panel class
 * (`paperless-panel--left` vs `paperless-panel--right`).
 */
export type PaperlessSide = 'left' | 'right';

/**
 * Document lifecycle, modelled on Adobe Acrobat Sign agreement states.
 *  draft             — being prepared, not yet sent
 *  out_for_signature — sent to recipients, none have finished yet
 *  in_progress       — at least one recipient has acted, not all
 *  completed         — every required recipient signed / approved
 *  declined          — a recipient declined -> workflow stops
 *  cancelled         — sender cancelled the workflow
 */
export type PaperlessStatus =
  | 'draft'
  | 'out_for_signature'
  | 'in_progress'
  | 'completed'
  | 'declined'
  | 'cancelled';

/** Role a recipient plays in the workflow (Adobe: signer / approver / CC). */
export type RecipientRole = 'signer' | 'approver' | 'viewer';

/** Per-recipient progress state. */
export type RecipientState =
  | 'waiting'   // not their turn yet (sequential) or not acted
  | 'viewed'    // opened but not completed
  | 'signed'
  | 'approved'
  | 'declined';

export interface PaperlessRecipient {
  id: string;
  name: string;
  email?: string;
  role: RecipientRole;
  /** 1-based routing order (used for sequential routing). */
  order: number;
  state: RecipientState;
  actedAt?: string;
}

/** Immutable audit-trail entry (Adobe "Activity"). */
export type ActivityType =
  | 'created' | 'shared' | 'viewed' | 'signed' | 'approved'
  | 'declined' | 'annotated' | 'completed' | 'reminder' | 'cancelled';

export interface PaperlessActivity {
  id: string;
  at: string;
  actor: string;
  type: ActivityType;
  detail: string;
}

export interface PaperlessSignature {
  id: string;
  /** data-url PNG of the drawn signature */
  dataUrl: string;
  signedBy: string;
  signedAt: string;
  /** placement on the page, percentage based so it scales */
  xPct: number;
  yPct: number;
}

export interface PaperlessAnnotation {
  id: string;
  text: string;
  xPct: number;
  yPct: number;
  colour: string;
  createdAt: string;
}

/** Sequential = one after another; parallel = everyone at once. */
export type RoutingMode = 'sequential' | 'parallel';

/** A system user returned by the recipient / share search. */
export interface PaperlessUser { id: number; name: string; email: string; title?: string; }

/** A document assigned to / shared with the current user (in-app inbox). */
export interface PaperlessInboxItem {
  id: string;
  name: string;
  mime: string;
  status: PaperlessStatus;
  progress: number;
  routing: RoutingMode;
  myRole?: RecipientRole | null;
  myState?: string | null;
  createdBy?: string | null;
  updatedAt: string;
}

/** Type of a stacked (attached) supporting document. */
export type StackKind =
  | 'GRV' | 'PurchaseOrder' | 'DeliveryNote' | 'ProofOfDelivery'
  | 'Invoice' | 'Statement' | 'PaymentSchedule' | 'Recon';

/**
 * Business workflow category chosen up-front for every Paperless workflow
 * (asked via a card picker before the upload/link proceeds).
 */
export type PaperlessCategory =
  | 'InterCompanies' | 'InterCode' | 'ThreeQuote' | 'TaxPayment'
  | 'Payment' | 'CreditRequest' | 'Recon' | 'Other';

/** All categories in display order, with their card label + icon. */
export const PAPERLESS_CATEGORIES: { value: PaperlessCategory; label: string; icon: string }[] = [
  { value: 'InterCompanies', label: 'Inter-Companies', icon: 'business' },
  { value: 'InterCode',      label: 'Inter-Code',      icon: 'swap_horiz' },
  { value: 'ThreeQuote',     label: 'Three-Quote',     icon: 'format_list_numbered' },
  { value: 'TaxPayment',     label: 'Tax Payment',     icon: 'account_balance' },
  { value: 'Payment',        label: 'Payment',         icon: 'payments' },
  { value: 'CreditRequest',  label: 'Credit-Request',  icon: 'request_quote' },
  { value: 'Recon',          label: 'Recon',           icon: 'rule' },
  { value: 'Other',          label: 'Other',           icon: 'more_horiz' }
];

export interface PaperlessDocument {
  id: string;
  name: string;
  mime: string;
  /** data-url of the file content (kept client-side for this first version) */
  dataUrl: string;
  sizeBytes: number;
  status: PaperlessStatus;
  /** 0–100 progress used by the ring in the right panel */
  progress: number;
  routing: RoutingMode;
  dueDate?: string | null;
  /** Page rotation in degrees (0, 90, 180, 270), persisted server-side. */
  rotation?: number;
  /** If set, this document is stacked under another (its parent). */
  parentId?: string | null;
  /** For stacked children: what kind of supporting document this is. */
  stackKind?: StackKind | null;
  /** Business workflow category chosen when the document was uploaded/linked. */
  category?: PaperlessCategory | null;
  recipients: PaperlessRecipient[];
  activity: PaperlessActivity[];
  annotations: PaperlessAnnotation[];
  signatures: PaperlessSignature[];
  createdAt: string;
  updatedAt: string;
}

export interface PaperlessDrawerState {
  open: boolean;
  /** Optional contextual key so a module can tell the drawer what to show. */
  context?: string | null;
}

/** A single label/value line shown in a left-panel preview. */
export interface PaperlessPreviewField { label: string; value: string; }

/**
 * A read-only preview shown in the LEFT panel when the user drills into a
 * search result (invoice / item / barcode / tripsheet) from the controller.
 * This is distinct from an uploaded PaperlessDocument (which is editable).
 */
export interface PaperlessPreview {
  kind: 'tripsheet' | 'invoice' | 'stock' | 'asset' | 'commodity' | 'pod';
  icon: string;
  title: string;
  subtitle?: string;
  status?: string;
  fields: PaperlessPreviewField[];
  /** For tripsheets: the rendered PDF as a data-url (loaded on demand). */
  pdfDataUrl?: string | null;
}

/**
 * Global state + document store for the Paperless off-canvas drawer system.
 *
 * Paperless is a slide-over / off-canvas drawer pattern (NOT mat-sidenav):
 *  - LEFT  panel — near full-screen document viewer (open, annotate, e-sign)
 *  - RIGHT panel — controller/navigation rail (upload, recipient routing,
 *    delivery progress, activity trail, suggestions)
 *
 * The workflow model mirrors Adobe Acrobat Sign: documents are routed to
 * ordered recipients (signer / approver / viewer), each recipient's action is
 * recorded in an immutable activity trail, and the agreement status is derived
 * from recipient progress. Documents persist to localStorage for now; a server
 * + Finance integration can slot in behind these same methods.
 */
@Injectable({ providedIn: 'root' })
export class PaperlessService {
  private readonly assets = inject(AssetTrackingService);
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/Paperless`;

  /** Object URLs for fetched file blobs, keyed by document id. */
  private readonly fileUrls = new Map<string, string>();

  constructor() {
    this.loadFromServer();
    this.loadInbox();
    // Refresh the inbox periodically so recipients see newly-assigned docs
    // without a full reload (the web app has no SignalR push).
    setInterval(() => this.loadInbox(), 60_000);
  }

  private readonly left = signal<PaperlessDrawerState>({ open: false, context: null });
  private readonly right = signal<PaperlessDrawerState>({ open: false, context: null });

  readonly leftState = this.left.asReadonly();
  readonly rightState = this.right.asReadonly();
  readonly anyOpen = computed(() => this.left().open || this.right().open);

  // ── Controller search (invoice / item / barcode lookup) ────
  readonly searchQuery = signal('');
  readonly searching = signal(false);
  readonly searchResult = signal<ResolveResult | null>(null);
  readonly searchError = signal<string | null>(null);

  // ── Left-panel read-only preview (drill-in from a result) ──
  readonly preview = signal<PaperlessPreview | null>(null);
  readonly previewLoading = signal(false);

  private readonly docs = signal<PaperlessDocument[]>([]);
  readonly documents = this.docs.asReadonly();
  /** Only primary documents (excludes stacked children) for the main list. */
  readonly topLevelDocuments = computed(() => this.docs().filter(d => !d.parentId));

  /** Documents assigned to / shared with the current user (in-app inbox). */
  readonly inbox = signal<PaperlessInboxItem[]>([]);
  readonly inboxCount = computed(() => this.inbox().length);
  /** Items still needing my action (I'm a signer/approver and haven't acted). */
  readonly inboxPending = computed(() =>
    this.inbox().filter(i =>
      (i.myRole === 'signer' || i.myRole === 'approver') &&
      i.myState !== 'signed' && i.myState !== 'approved'));

  /** Document currently open in the LEFT viewer. */
  private readonly selectedId = signal<string | null>(null);
  readonly selectedDocument = computed(
    () => this.docs().find(d => d.id === this.selectedId()) ?? null
  );

  /** Who is acting in this browser session (used for the audit trail). */
  private readonly me = this.resolveMe();

  // ── Pipeline / notification helpers ────────────────────────
  readonly draftCount = computed(() => this.docs().filter(d => d.status === 'draft').length);
  readonly awaitingCount = computed(
    () => this.docs().filter(d => d.status === 'out_for_signature' || d.status === 'in_progress').length
  );
  readonly completedCount = computed(() => this.docs().filter(d => d.status === 'completed').length);
  readonly overallProgress = computed(() => {
    const list = this.docs();
    if (list.length === 0) return 0;
    return Math.round(list.reduce((s, d) => s + d.progress, 0) / list.length);
  });

  // ── Drawer control ─────────────────────────────────────────
  isOpen(side: PaperlessSide): boolean {
    return (side === 'left' ? this.left() : this.right()).open;
  }
  open(side: PaperlessSide, context: string | null = null): void {
    (side === 'left' ? this.left : this.right).set({ open: true, context });
  }
  close(side: PaperlessSide): void {
    (side === 'left' ? this.left : this.right).update(s => ({ ...s, open: false }));
  }
  toggle(side: PaperlessSide, context: string | null = null): void {
    this.isOpen(side) ? this.close(side) : this.open(side, context);
  }
  closeAll(): void {
    this.left.update(s => ({ ...s, open: false }));
    this.right.update(s => ({ ...s, open: false }));
  }

  // ── Document operations ────────────────────────────────────
  /**
   * Upload a single primary file and return the created document (also adds it
   * to the in-memory store). Used by request flows (e.g. Finance Payment) that
   * need the new document id to stack supporting files and attach recipients.
   */
  async uploadPrimary(file: File, category?: PaperlessCategory | null): Promise<PaperlessDocument | null> {
    const form = new FormData();
    form.append('file', file, file.name);
    if (category) form.append('category', category);
    try {
      const dto = await this.http.post<PaperlessDto>(`${this.apiUrl}/upload`, form).toPromise();
      if (dto) {
        const doc = this.fromDto(dto);
        this.docs.update(list => [doc, ...list]);
        return doc;
      }
    } catch {
      /* upload failed */
    }
    return null;
  }

  async addFiles(files: FileList | File[], category?: PaperlessCategory | null): Promise<void> {
    const arr = Array.from(files);
    for (const file of arr) {
      const form = new FormData();
      form.append('file', file, file.name);
      if (category) form.append('category', category);
      try {
        const dto = await this.http.post<PaperlessDto>(`${this.apiUrl}/upload`, form).toPromise();
        if (dto) {
          const doc = this.fromDto(dto);
          this.docs.update(list => [doc, ...list]);
        }
      } catch {
        /* upload failed — ignore this file */
      }
    }
  }

  removeDocument(id: string): void {
    this.http.delete(`${this.apiUrl}/${id}`).subscribe({ next: () => {}, error: () => {} });
    // Remove the document plus any stacked descendants locally.
    const ids = this.collectDescendantIds(id);
    this.docs.update(list => list.filter(d => !ids.has(d.id)));
    ids.forEach(x => this.revokeFile(x));
    if (this.selectedId() && ids.has(this.selectedId()!)) this.selectedId.set(null);
  }

  openInViewer(id: string): void {
    this.preview.set(null);
    this.selectedId.set(id);
    this.open('left', id);
    void this.ensureFile(id);
  }

  // ── Controller search + left preview ───────────────────────
  /**
   * Run an invoice / item / barcode lookup and show the matches in the RIGHT
   * controller. Reuses the logistics AssetTag resolver, so a barcode, a load
   * number, an invoice number or a product code all resolve here.
   */
  search(query: string): void {
    const q = (query || '').trim();
    this.searchQuery.set(q);
    this.searchResult.set(null);
    this.searchError.set(null);
    if (!q) { this.close('left'); return; }
    this.open('right');
    this.searching.set(true);
    this.assets.resolve(q, true).subscribe({
      next: (res) => { this.searchResult.set(res); this.searching.set(false); },
      error: () => { this.searching.set(false); this.searchError.set('Lookup failed. Check your connection.'); }
    });
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.searchResult.set(null);
    this.searchError.set(null);
    this.searching.set(false);
  }

  // ── System-user directory (recipient / share pickers) ──────
  /** Search active system users by name or email. */
  searchUsers(q: string) {
    return this.http.get<PaperlessUser[]>(`${this.apiUrl}/users`, { params: { q: q || '' } });
  }

  /** Share a document with system users by email (sends notifications). */
  shareDocument(id: string, emails: string[], message?: string) {
    return this.http.post<{ shared: number; emailSent: boolean }>(
      `${this.apiUrl}/${id}/share`, { emails, message: message || '' });
  }

  /** Rename a document's friendly display name (persisted server-side). */
  renameDocument(id: string, name: string): void {
    const clean = (name || '').trim();
    if (!clean) return;
    // Optimistic local update.
    this.docs.update(list => list.map(d => d.id === id ? { ...d, name: clean } : d));
    this.http.post(`${this.apiUrl}/${id}/rename`, { name: clean }).subscribe({ next: () => {}, error: () => {} });
  }

  private showPreview(p: PaperlessPreview): void {
    this.selectedId.set(null); // ensure the editable doc viewer steps aside
    this.preview.set(p);
    this.open('left');
  }

  previewInvoice(inv: any): void {
    this.showPreview({
      kind: 'invoice', icon: 'receipt_long',
      title: inv?.transactionNumber || 'Invoice',
      subtitle: inv?.customerName || undefined,
      status: inv?.status || undefined,
      fields: [
        { label: 'Customer', value: inv?.customerName ?? '—' },
        { label: 'Product', value: inv?.productDescription ?? '—' },
        { label: 'Product code', value: inv?.productCode ?? '—' },
        { label: 'Quantity', value: inv?.quantity != null ? String(inv.quantity) : '—' },
        { label: 'Delivery city', value: inv?.deliveryCity ?? '—' },
        { label: 'Status', value: inv?.status ?? '—' }
      ]
    });
  }

  previewStock(b: any): void {
    this.showPreview({
      kind: 'stock', icon: 'inventory_2',
      title: b?.itemCode || 'Stock item',
      subtitle: b?.itemDescription || undefined,
      fields: [
        { label: 'Item code', value: b?.itemCode ?? '—' },
        { label: 'Description', value: b?.itemDescription ?? '—' },
        { label: 'On hand', value: b?.quantityOnHand != null ? String(b.quantityOnHand) : '—' },
        { label: 'UoM', value: b?.uom ?? '—' },
        { label: 'Building', value: b?.buildingId != null ? '#' + b.buildingId : '—' }
      ]
    });
  }

  previewAsset(a: any): void {
    this.showPreview({
      kind: 'asset', icon: 'chair',
      title: a?.assetCode || a?.category || 'Asset',
      subtitle: a?.category || undefined,
      status: a?.condition || undefined,
      fields: [
        { label: 'Asset code', value: a?.assetCode ?? '—' },
        { label: 'Category', value: a?.category ?? '—' },
        { label: 'Make / model', value: [a?.manufacturer, a?.model].filter(Boolean).join(' ') || '—' },
        { label: 'Serial', value: a?.serialNumber ?? '—' },
        { label: 'Assigned to', value: a?.assignedTo ?? '—' },
        { label: 'Condition', value: a?.condition ?? '—' }
      ]
    });
  }

  previewCommodity(c: any): void {
    this.showPreview({
      kind: 'commodity', icon: 'category',
      title: c?.name || 'Commodity',
      subtitle: c?.category || undefined,
      fields: [
        { label: 'Name', value: c?.name ?? '—' },
        { label: 'Code', value: c?.code ?? '—' },
        { label: 'Category', value: c?.category ?? '—' }
      ]
    });
  }

  /** Open a tripsheet preview and lazily load its rendered PDF into the viewer. */
  previewTripsheet(load: any): void {
    this.showPreview({
      kind: 'tripsheet', icon: 'local_shipping',
      title: load?.loadNumber || 'Tripsheet',
      subtitle: load?.customerName || undefined,
      status: load?.status || undefined,
      fields: [
        { label: 'Load number', value: load?.loadNumber ?? '—' },
        { label: 'Customer', value: load?.customerName ?? '—' },
        { label: 'Driver', value: load?.driver ?? '—' },
        { label: 'Vehicle', value: load?.vehicle ?? '—' },
        { label: 'Status', value: load?.status ?? '—' }
      ],
      pdfDataUrl: null
    });
    if (load?.id == null) return;
    this.previewLoading.set(true);
    this.http.get(`${environment.apiUrl}/logistics/TripSheet/${load.id}/pdf`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const reader = new FileReader();
        reader.onload = () => {
          this.preview.update(p => (p && p.kind === 'tripsheet') ? { ...p, pdfDataUrl: reader.result as string } : p);
          this.previewLoading.set(false);
        };
        reader.onerror = () => this.previewLoading.set(false);
        reader.readAsDataURL(blob);
      },
      error: () => this.previewLoading.set(false)
    });
  }

  /** Open a POD preview and lazily load its file (PDF/image) into the viewer. */
  previewPod(pod: any): void {
    const dateStr = pod?.deliveryDate ? new Date(pod.deliveryDate).toLocaleDateString() : '—';
    this.showPreview({
      kind: 'pod', icon: 'local_shipping',
      title: pod?.podNumber || ('POD' + (pod?.id ?? '')),
      subtitle: pod?.driverName || undefined,
      status: pod?.region || undefined,
      fields: [
        { label: 'POD number', value: pod?.podNumber ?? '—' },
        { label: 'Driver', value: pod?.driverName || '—' },
        { label: 'Delivery date', value: dateStr },
        { label: 'Region', value: pod?.region ?? '—' },
        { label: 'File', value: pod?.originalFileName || pod?.fileName || '—' },
        { label: 'Notes', value: pod?.notes ?? '—' }
      ],
      pdfDataUrl: null
    });
    if (pod?.id == null) return;
    this.previewLoading.set(true);
    this.http.get(`${environment.apiUrl}/PodDocuments/${pod.id}/view`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const reader = new FileReader();
        reader.onload = () => {
          this.preview.update(p => (p && p.kind === 'pod') ? { ...p, pdfDataUrl: reader.result as string } : p);
          this.previewLoading.set(false);
        };
        reader.onerror = () => this.previewLoading.set(false);
        reader.readAsDataURL(blob);
      },
      error: () => this.previewLoading.set(false)
    });
  }

  // ── Recipients & routing ───────────────────────────────────
  addRecipient(id: string, name: string, role: RecipientRole, email?: string): void {
    const clean = name.trim();
    if (!clean) return;
    this.mutate(id, d => {
      const order = d.recipients.length + 1;
      d.recipients = [...d.recipients, {
        id: this.uid(), name: clean, email: email?.trim() || undefined,
        role, order, state: 'waiting'
      }];
    });
  }

  removeRecipient(id: string, recipientId: string): void {
    this.mutate(id, d => {
      d.recipients = d.recipients
        .filter(r => r.id !== recipientId)
        .map((r, i) => ({ ...r, order: i + 1 }));
    });
  }

  moveRecipient(id: string, recipientId: string, dir: -1 | 1): void {
    this.mutate(id, d => {
      const arr = [...d.recipients].sort((a, b) => a.order - b.order);
      const i = arr.findIndex(r => r.id === recipientId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      d.recipients = arr.map((r, k) => ({ ...r, order: k + 1 }));
    });
  }

  setRouting(id: string, mode: RoutingMode): void {
    this.mutate(id, d => { d.routing = mode; });
  }

  setDueDate(id: string, due: string | null): void {
    this.mutate(id, d => { d.dueDate = due; });
  }

  /** Send the agreement out to recipients (Adobe: "Send for signature"). */
  sendForSignature(id: string): void {
    this.mutate(id, d => {
      if (d.recipients.length === 0) return;
      d.status = 'out_for_signature';
      d.activity = [...d.activity, {
        id: this.uid(), at: new Date().toISOString(), actor: this.me, type: 'shared',
        detail: `Sent for ${d.recipients.some(r => r.role === 'signer') ? 'signature' : 'approval'} to ${d.recipients.length} recipient${d.recipients.length > 1 ? 's' : ''} (${d.routing})`
      }];
      this.recompute(d);
    });
  }

  /** The recipient whose turn it is (sequential) or all pending (parallel). */
  currentRecipients(d: PaperlessDocument): PaperlessRecipient[] {
    const pending = d.recipients
      .filter(r => r.state === 'waiting' || r.state === 'viewed')
      .sort((a, b) => a.order - b.order);
    if (d.routing === 'parallel') return pending;
    return pending.length ? [pending[0]] : [];
  }

  /** Is this recipient allowed to act right now given the routing mode? */
  isRecipientActive(d: PaperlessDocument, recipientId: string): boolean {
    if (d.status === 'draft' || d.status === 'completed' ||
        d.status === 'declined' || d.status === 'cancelled') return false;
    return this.currentRecipients(d).some(r => r.id === recipientId);
  }

  recordView(id: string, recipientId: string): void {
    this.mutate(id, d => {
      const r = d.recipients.find(x => x.id === recipientId);
      if (!r || r.state !== 'waiting') return;
      r.state = 'viewed';
      d.activity = [...d.activity, { id: this.uid(), at: new Date().toISOString(), actor: r.name, type: 'viewed', detail: `${r.name} viewed the document` }];
      this.recompute(d);
    });
  }

  /** Record the recipient completing their step (sign / approve / acknowledge). */
  recordAction(id: string, recipientId: string): void {
    this.mutate(id, d => {
      const r = d.recipients.find(x => x.id === recipientId);
      if (!r) return;
      const now = new Date().toISOString();
      if (r.role === 'signer') { r.state = 'signed'; }
      else if (r.role === 'approver') { r.state = 'approved'; }
      else { r.state = 'viewed'; }
      r.actedAt = now;
      const verb = r.role === 'signer' ? 'signed' : r.role === 'approver' ? 'approved' : 'acknowledged';
      d.activity = [...d.activity, { id: this.uid(), at: now, actor: r.name, type: r.role === 'approver' ? 'approved' : 'signed', detail: `${r.name} ${verb} the document` }];
      this.recompute(d);
    });
  }

  recordDecline(id: string, recipientId: string, reason?: string): void {
    this.mutate(id, d => {
      const r = d.recipients.find(x => x.id === recipientId);
      if (!r) return;
      const now = new Date().toISOString();
      r.state = 'declined';
      r.actedAt = now;
      d.status = 'declined';
      d.activity = [...d.activity, { id: this.uid(), at: now, actor: r.name, type: 'declined', detail: `${r.name} declined${reason ? ': ' + reason : ''}` }];
    });
  }

  remind(id: string, recipientId: string): void {
    this.mutate(id, d => {
      const r = d.recipients.find(x => x.id === recipientId);
      if (!r) return;
      d.activity = [...d.activity, { id: this.uid(), at: new Date().toISOString(), actor: this.me, type: 'reminder', detail: `Reminder sent to ${r.name}` }];
    });
  }

  cancelWorkflow(id: string): void {
    this.mutate(id, d => {
      d.status = 'cancelled';
      d.activity = [...d.activity, { id: this.uid(), at: new Date().toISOString(), actor: this.me, type: 'cancelled', detail: 'Workflow cancelled' }];
    });
  }

  // ── Annotations & signatures (viewer) ──────────────────────
  addAnnotation(id: string, ann: Omit<PaperlessAnnotation, 'id' | 'createdAt'>): void {
    this.mutate(id, d => {
      d.annotations = [...d.annotations, { ...ann, id: this.uid(), createdAt: new Date().toISOString() }];
      d.activity = [...d.activity, { id: this.uid(), at: new Date().toISOString(), actor: this.me, type: 'annotated', detail: 'Added an annotation' }];
    });
  }
  removeAnnotation(id: string, annId: string): void {
    this.mutate(id, d => { d.annotations = d.annotations.filter(a => a.id !== annId); });
  }

  addSignature(id: string, sig: Omit<PaperlessSignature, 'id' | 'signedAt'>): void {
    this.mutate(id, d => {
      const now = new Date().toISOString();
      d.signatures = [...d.signatures, { ...sig, id: this.uid(), signedAt: now }];
      // If the signer is a listed recipient, advance their state too.
      const match = d.recipients.find(r => r.role === 'signer' && (r.state === 'waiting' || r.state === 'viewed') &&
        r.name.toLowerCase() === sig.signedBy.trim().toLowerCase());
      if (match) {
        match.state = 'signed';
        match.actedAt = now;
      }
      d.activity = [...d.activity, { id: this.uid(), at: now, actor: sig.signedBy || this.me, type: 'signed', detail: `${sig.signedBy || 'Someone'} applied a signature` }];
      this.recompute(d);
    });
  }
  removeSignature(id: string, sigId: string): void {
    this.mutate(id, d => { d.signatures = d.signatures.filter(s => s.id !== sigId); });
  }

  /** Rotate a document by ±90° and persist the orientation for everyone. */
  rotateDocument(id: string, delta: number): void {
    this.mutate(id, d => {
      d.rotation = (((d.rotation ?? 0) + delta) % 360 + 360) % 360;
      d.activity = [...d.activity, {
        id: this.uid(), at: new Date().toISOString(), actor: this.me, type: 'annotated',
        detail: `Rotated document to ${d.rotation}°`
      }];
    });
  }

  // ── Stacked supporting documents ─────────────────────
  /**
   * Attach a supporting file (GRV, PO, POD, invoice…) to a document.
   * The file becomes a full child document with its own annotate / sign /
   * stack capabilities, linked to the parent via parentId.
   * @returns the id of the newly created child document.
   */
  async addStackItem(parentId: string, kind: StackKind, file: File, category?: PaperlessCategory | null): Promise<string> {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('parentId', parentId);
    form.append('stackKind', kind);
    if (category) form.append('category', category);
    try {
      const dto = await this.http.post<PaperlessDto>(`${this.apiUrl}/upload`, form).toPromise();
      if (dto) {
        const child = this.fromDto(dto);
        this.docs.update(list => [child, ...list]);
        // Reflect the stack action in the parent's activity trail.
        this.mutate(parentId, d => {
          d.activity = [...d.activity, {
            id: this.uid(), at: new Date().toISOString(), actor: this.me, type: 'annotated',
            detail: `Stacked ${this.stackKindLabel(kind)} “${file.name}”`
          }];
        });
        return child.id;
      }
    } catch {
      /* upload failed */
    }
    return '';
  }

  /** All documents stacked directly under the given document. */
  stackChildren(parentId: string): PaperlessDocument[] {
    return this.docs().filter(d => d.parentId === parentId);
  }

  /** Number of documents stacked directly under the given document. */
  stackCount(parentId: string): number {
    return this.stackChildren(parentId).length;
  }

  removeStackItem(childId: string): void {
    this.removeDocument(childId);
  }

  stackKindLabel(kind: StackKind): string {
    return {
      GRV: 'GRV', PurchaseOrder: 'Purchase Order', DeliveryNote: 'Delivery Note',
      ProofOfDelivery: 'Proof of Delivery', Invoice: 'Invoice', Statement: 'Statement',
      PaymentSchedule: 'Payment Schedule', Recon: 'Recon'
    }[kind];
  }

  // ── internals ──────────────────────────────────────────────
  /** Derive status + progress from recipient states. */
  private recompute(d: PaperlessDocument): void {
    if (d.status === 'declined' || d.status === 'cancelled') return;
    const recips = d.recipients;
    if (recips.length === 0) { d.status = 'draft'; d.progress = 8; return; }

    const done = recips.filter(r => r.state === 'signed' || r.state === 'approved').length;
    const total = recips.length;
    const anyActivity = recips.some(r => r.state !== 'waiting');

    if (done === total) {
      d.status = 'completed';
      d.progress = 100;
      if (!d.activity.some(a => a.type === 'completed')) {
        d.activity = [...d.activity, { id: this.uid(), at: new Date().toISOString(), actor: 'System', type: 'completed', detail: 'All recipients completed — agreement complete' }];
      }
      return;
    }
    if (d.status === 'draft') { d.progress = 8; return; }

    // out_for_signature / in_progress
    d.status = anyActivity && done > 0 ? 'in_progress' : 'out_for_signature';
    // 25% for being sent, remaining 70% shared across recipients, cap below 100.
    d.progress = Math.min(96, 25 + Math.round((done / total) * 70));
  }

  private mutate(id: string, fn: (d: PaperlessDocument) => void): void {
    let changed: PaperlessDocument | null = null;
    this.docs.update(list => list.map(d => {
      if (d.id !== id) return d;
      const copy: PaperlessDocument = {
        ...d,
        recipients: d.recipients.map(r => ({ ...r })),
        activity: [...d.activity],
        annotations: [...d.annotations],
        signatures: [...d.signatures]
      };
      fn(copy);
      copy.updatedAt = new Date().toISOString();
      changed = copy;
      return copy;
    }));
    if (changed) this.persistDoc(changed);
  }

  /** Push a document's workflow state to the server. */
  private persistDoc(d: PaperlessDocument): void {
    const body = {
      status: d.status,
      progress: d.progress,
      routing: d.routing,
      dueDate: d.dueDate ?? null,
      rotation: d.rotation ?? 0,
      stackKind: d.stackKind ?? null,
      category: d.category ?? null,
      recipientsJson: JSON.stringify(d.recipients ?? []),
      activityJson: JSON.stringify(d.activity ?? []),
      annotationsJson: JSON.stringify(d.annotations ?? []),
      signaturesJson: JSON.stringify(d.signatures ?? [])
    };
    this.http.put(`${this.apiUrl}/${d.id}`, body).subscribe({ next: () => {}, error: () => {} });
  }

  private resolveMe(): string {
    try {
      const raw = localStorage.getItem('currentUser') || localStorage.getItem('user');
      if (raw) {
        const u = JSON.parse(raw);
        return u.name || u.fullName || u.email || 'Me';
      }
    } catch { /* ignore */ }
    return 'Me';
  }

  private uid(): string {
    return 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  // ── Server sync ────────────────────────────────────────────
  /** Load every document's metadata from the server on startup. */
  private loadFromServer(): void {
    this.http.get<PaperlessDto[]>(this.apiUrl).subscribe({
      next: (dtos) => this.docs.set((dtos || []).map(dto => this.fromDto(dto))),
      error: () => { /* offline / not signed in — leave empty */ }
    });
  }

  /** Load the current user's Paperless inbox (assigned / shared docs). */
  loadInbox(): void {
    this.http.get<PaperlessInboxItem[]>(`${this.apiUrl}/inbox`).subscribe({
      next: (items) => this.inbox.set(items || []),
      error: () => { /* not signed in — leave empty */ }
    });
  }

  /** Map a server DTO to the client document model. */
  private fromDto(dto: PaperlessDto): PaperlessDocument {
    return {
      id: dto.id,
      name: dto.name,
      mime: dto.mime,
      dataUrl: '',            // fetched lazily via ensureFile()
      sizeBytes: dto.sizeBytes,
      status: dto.status as PaperlessStatus,
      progress: dto.progress,
      routing: (dto.routing as RoutingMode) || 'sequential',
      dueDate: dto.dueDate ?? null,
      rotation: dto.rotation ?? 0,
      parentId: dto.parentId ?? null,
      stackKind: (dto.stackKind as StackKind) ?? null,
      category: (dto.category as PaperlessCategory) ?? null,
      recipients: (dto.recipients as PaperlessRecipient[]) ?? [],
      activity: (dto.activity as PaperlessActivity[]) ?? [],
      annotations: (dto.annotations as PaperlessAnnotation[]) ?? [],
      signatures: (dto.signatures as PaperlessSignature[]) ?? [],
      createdAt: dto.createdAt,
      updatedAt: dto.updatedAt
    };
  }

  /** Ensure a document's binary is fetched and its dataUrl set. */
  private async ensureFile(id: string): Promise<void> {
    const doc = this.docs().find(d => d.id === id);
    if (!doc || doc.dataUrl) return;
    const cached = this.fileUrls.get(id);
    if (cached) { this.setDataUrl(id, cached); return; }
    try {
      // Fetch as a base64 data URL wrapped in JSON — avoids cross-origin
      // binary/blob pitfalls (range + compression) that showed up as
      // "net::ERR_FAILED 200 (OK)" for large PDFs.
      const res = await this.http.get<{ dataUrl: string }>(`${this.apiUrl}/${id}/filedata`).toPromise();
      if (!res?.dataUrl) return;
      // Chrome blocks `data:` URLs from loading inside an iframe, so convert to
      // a blob object URL for rendering (object URLs are allowed).
      const objectUrl = this.dataUrlToObjectUrl(res.dataUrl);
      this.fileUrls.set(id, objectUrl);
      this.setDataUrl(id, objectUrl);
    } catch {
      /* file missing — leave blank, viewer shows an unsupported message */
    }
  }

  /** Convert a base64 data URL into a blob object URL (safe for iframes). */
  private dataUrlToObjectUrl(dataUrl: string): string {
    const [meta, b64] = dataUrl.split(',', 2);
    const mime = /data:([^;]+)/.exec(meta)?.[1] || 'application/octet-stream';
    const bin = atob(b64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  }

  private setDataUrl(id: string, url: string): void {
    this.docs.update(list => list.map(d => d.id === id ? { ...d, dataUrl: url } : d));
  }

  private revokeFile(id: string): void {
    const url = this.fileUrls.get(id);
    if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
    this.fileUrls.delete(id);
  }

  /** Ids of a document plus all of its stacked descendants. */
  private collectDescendantIds(id: string): Set<string> {
    const all = this.docs();
    const ids = new Set<string>([id]);
    const walk = (pid: string) => {
      for (const c of all.filter(d => d.parentId === pid)) {
        if (!ids.has(c.id)) { ids.add(c.id); walk(c.id); }
      }
    };
    walk(id);
    return ids;
  }
}

/** Shape returned by the Paperless API. */
interface PaperlessDto {
  id: string;
  name: string;
  mime: string;
  sizeBytes: number;
  status: string;
  progress: number;
  routing: string;
  dueDate?: string | null;
  rotation?: number;
  parentId?: string | null;
  stackKind?: string | null;
  category?: string | null;
  recipients: unknown;
  activity: unknown;
  annotations: unknown;
  signatures: unknown;
  createdAt: string;
  updatedAt: string;
}

