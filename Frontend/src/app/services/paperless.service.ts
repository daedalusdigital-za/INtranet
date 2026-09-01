import { Injectable, signal, computed } from '@angular/core';

/**
 * Which edge a Paperless drawer slides in from.
 * The two drawers are visually distinguished purely by their panel class
 * (`paperless-panel--left` vs `paperless-panel--right`).
 */
export type PaperlessSide = 'left' | 'right';

/** Lifecycle of a paperless document as it moves through the pipeline. */
export type PaperlessStatus =
  | 'draft'      // just uploaded, not yet actioned
  | 'pipeline'   // being prepared / in progress
  | 'sent'       // shared, awaiting confirmation
  | 'received'   // recipient confirmed receipt
  | 'signed';    // signed / completed

export interface PaperlessShare {
  recipient: string;
  sharedAt: string;
  acknowledged: boolean;
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
  shares: PaperlessShare[];
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

const STORAGE_KEY = 'paperless.documents.v1';

/**
 * Global state + document store for the Paperless off-canvas drawer system.
 *
 * Paperless is a slide-over / off-canvas drawer pattern (NOT mat-sidenav):
 *  - LEFT  panel — near full-screen document viewer (open, annotate, e-sign)
 *  - RIGHT panel — controller/navigation rail (upload, share, delivery
 *    progress, notifications, suggestions)
 *
 * Documents are persisted to localStorage for now; the API / finance
 * integration can be layered on later behind these same methods.
 */
@Injectable({ providedIn: 'root' })
export class PaperlessService {
  private readonly left = signal<PaperlessDrawerState>({ open: false, context: null });
  private readonly right = signal<PaperlessDrawerState>({ open: false, context: null });

  /** Read-only views for the drawer component / consumers. */
  readonly leftState = this.left.asReadonly();
  readonly rightState = this.right.asReadonly();

  /** True when either drawer is open — used to show the shared backdrop. */
  readonly anyOpen = computed(() => this.left().open || this.right().open);

  private readonly docs = signal<PaperlessDocument[]>(this.load());
  readonly documents = this.docs.asReadonly();

  /** Document currently open in the LEFT viewer. */
  private readonly selectedId = signal<string | null>(null);
  readonly selectedDocument = computed(
    () => this.docs().find(d => d.id === this.selectedId()) ?? null
  );

  // ── Pipeline / notification helpers ────────────────────────
  readonly pipelineCount = computed(
    () => this.docs().filter(d => d.status === 'pipeline' || d.status === 'draft').length
  );
  readonly awaitingCount = computed(
    () => this.docs().filter(d => d.status === 'sent').length
  );
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
    const target = side === 'left' ? this.left : this.right;
    target.set({ open: true, context });
  }

  close(side: PaperlessSide): void {
    const target = side === 'left' ? this.left : this.right;
    target.update(s => ({ ...s, open: false }));
  }

  toggle(side: PaperlessSide, context: string | null = null): void {
    if (this.isOpen(side)) {
      this.close(side);
    } else {
      this.open(side, context);
    }
  }

  closeAll(): void {
    this.left.update(s => ({ ...s, open: false }));
    this.right.update(s => ({ ...s, open: false }));
  }

  // ── Document operations ────────────────────────────────────
  async addFiles(files: FileList | File[]): Promise<void> {
    const arr = Array.from(files);
    for (const file of arr) {
      const dataUrl = await this.readAsDataUrl(file);
      const now = new Date().toISOString();
      const doc: PaperlessDocument = {
        id: this.uid(),
        name: file.name,
        mime: file.type || this.guessMime(file.name),
        dataUrl,
        sizeBytes: file.size,
        status: 'draft',
        progress: 15,
        shares: [],
        annotations: [],
        signatures: [],
        createdAt: now,
        updatedAt: now
      };
      this.docs.update(list => [doc, ...list]);
    }
    this.persist();
  }

  removeDocument(id: string): void {
    this.docs.update(list => list.filter(d => d.id !== id));
    if (this.selectedId() === id) this.selectedId.set(null);
    this.persist();
  }

  openInViewer(id: string): void {
    this.selectedId.set(id);
    this.open('left', id);
  }

  share(id: string, recipient: string): void {
    const trimmed = recipient.trim();
    if (!trimmed) return;
    this.mutate(id, d => {
      d.shares = [...d.shares, { recipient: trimmed, sharedAt: new Date().toISOString(), acknowledged: false }];
      d.status = 'sent';
      d.progress = Math.max(d.progress, 60);
    });
  }

  /** Simulate a recipient acknowledging receipt (until backend/webhooks exist). */
  acknowledge(id: string, recipient: string): void {
    this.mutate(id, d => {
      d.shares = d.shares.map(s => s.recipient === recipient ? { ...s, acknowledged: true } : s);
      if (d.shares.length > 0 && d.shares.every(s => s.acknowledged)) {
        d.status = 'received';
        d.progress = Math.max(d.progress, 80);
      }
    });
  }

  setStatus(id: string, status: PaperlessStatus): void {
    const progressByStatus: Record<PaperlessStatus, number> = {
      draft: 15, pipeline: 40, sent: 60, received: 80, signed: 100
    };
    this.mutate(id, d => { d.status = status; d.progress = progressByStatus[status]; });
  }

  addAnnotation(id: string, ann: Omit<PaperlessAnnotation, 'id' | 'createdAt'>): void {
    this.mutate(id, d => {
      d.annotations = [...d.annotations, { ...ann, id: this.uid(), createdAt: new Date().toISOString() }];
      if (d.status === 'draft') { d.status = 'pipeline'; d.progress = Math.max(d.progress, 40); }
    });
  }

  removeAnnotation(id: string, annId: string): void {
    this.mutate(id, d => { d.annotations = d.annotations.filter(a => a.id !== annId); });
  }

  addSignature(id: string, sig: Omit<PaperlessSignature, 'id' | 'signedAt'>): void {
    this.mutate(id, d => {
      d.signatures = [...d.signatures, { ...sig, id: this.uid(), signedAt: new Date().toISOString() }];
      d.status = 'signed';
      d.progress = 100;
    });
  }

  removeSignature(id: string, sigId: string): void {
    this.mutate(id, d => { d.signatures = d.signatures.filter(s => s.id !== sigId); });
  }

  // ── internals ──────────────────────────────────────────────
  private mutate(id: string, fn: (d: PaperlessDocument) => void): void {
    this.docs.update(list => list.map(d => {
      if (d.id !== id) return d;
      const copy: PaperlessDocument = { ...d };
      fn(copy);
      copy.updatedAt = new Date().toISOString();
      return copy;
    }));
    this.persist();
  }

  private readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private guessMime(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    const map: Record<string, string> = {
      pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      gif: 'image/gif', webp: 'image/webp', doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
    return map[ext] ?? 'application/octet-stream';
  }

  private uid(): string {
    return 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  private persist(): void {
    try {
      // Cap storage to avoid blowing the localStorage quota with big files.
      const light = this.docs().slice(0, 40);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(light));
    } catch {
      /* storage full / unavailable — ignore for this first version */
    }
  }

  private load(): PaperlessDocument[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) as PaperlessDocument[] : [];
    } catch {
      return [];
    }
  }
}
