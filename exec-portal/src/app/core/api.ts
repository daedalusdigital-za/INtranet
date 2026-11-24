import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';

export interface InboxRow {
  id: number; batchNumber: string; companyCode: string; companyName: string; paymentType: string; paymentTypeTitle: string;
  batchDate: string; status: string; statusTitle: string; totalAmount: number; notes?: string; items: number; pendingItems: number;
  preparedByName: string; accountantName?: string; accountantComment?: string; waitingSince?: string; role: 'accountant' | 'director'; blocked?: string;
}
export interface Doc { id: number; docType: string; title?: string; docTypeTitle?: string; isNotApplicable?: boolean; naReason?: string; originalFileName?: string; fileName: string; contentType?: string; size?: number; version?: number; }
export interface Item {
  id: number; supplierName: string; invoiceNumbers?: string; description?: string; amount: number; bankName?: string; accountNumber?: string; accountHolder?: string; paymentReference?: string;
  isUrgent?: boolean; paymentModeTitle?: string; payoutMethod?: 'EFT' | 'EWallet' | null; decisionStatus: 'Pending' | 'Approved' | 'Queried' | 'Rejected' | 'SentBack'; decisionComment?: string;
  complianceTitle?: string | null;
  /** Accountant's call per payment (applied when they approve): SentBack payments return to the preparer. */
  accountantDecision?: 'Approved' | 'SentBack' | null; accountantDecisionComment?: string | null;
  /** Director's query and the preparer / accountant's answer. */
  queryQuestion?: string | null; queryAskedByName?: string | null; queryAskedAt?: string | null; queryResponse?: string | null; queryRespondedByName?: string | null; queryRespondedAt?: string | null; queriedFromBatchNumber?: string | null;
  resubmittedAsBatchNumber?: string | null;
  required: { key: string; title: string; filled: boolean }[]; documents: Doc[];
}
export interface Batch {
  id: number; batchNumber: string; companyCode: string; companyName: string; paymentType?: string; paymentTypeTitle: string; batchDate: string; status: string; statusTitle: string; notes?: string;
  totalAmount: number; approvedAmount: number; preparedByName: string; submittedAt?: string; checksStatus?: string;
  accountantName?: string; accountantApprovedAt?: string; accountantComment?: string; directorName?: string; directorSignedAt?: string; lockedAt?: string; returnReason?: string;
  requestedDirectorNames?: string; items: Item[]; batchDocuments: Doc[];
  events: { id: number; at: string; userName: string; action: string; comment?: string }[];
  can: { accountant: boolean; direct: boolean; sign: boolean; directorConflict?: string | null };
}
export interface Executive {
  awaitingForMe: number; awaitingAmount: number; nextPayDay: string; paidThisMonth: number; awaitingPopAmount: number; signedLast30: number; signedLast30Amount: number;
  awaiting: { id: number; batchNumber: string; companyName: string; paymentTypeTitle: string; totalAmount: number; items: number; forMe: boolean; waitingDays: number }[];
  pipeline: { status: string; title: string; count: number; amount: number }[];
  schedule: { date: string; count: number; amount: number; paid: number; loaded: number }[];
  paidByMonth: { label: string; total: number }[];
  topSuppliers: { supplier: string; amount: number; payments: number }[];
  perCompany: { code: string; name: string; awaitingDirector: number; awaitingDirectorCount: number; onSchedule: number; paidThisMonth: number; awaitingPop: number }[];
}
export interface PayLine { id: number; supplierName: string; amount: number; invoiceNumbers?: string; description?: string; bankName?: string; accountNumber?: string; paymentReference?: string; paidAt?: string; hasPop?: boolean; popDocId?: number | null; }
export interface PayBatch {
  id: number; batchNumber: string; companyName: string; paymentTypeTitle: string; status: string; statusTitle: string; scheduledPayDate: string; overdue: boolean;
  directorName?: string; directorSignedAt?: string; paidAt?: string; bankExportedAt?: string | null; approvedAmount: number; approvedItems: number; popDone: number; popMissing: number; openPrepayments?: number; items: PayLine[];
  /** What this user may do on the pack (the server checks every action again). */
  can?: { bankFile: boolean; markLoaded: boolean; markPaid: boolean; uploadPop: boolean; close: boolean; reschedule: boolean };
}
export interface IpDoc { id: number; docType: string; title: string; originalFileName?: string; uploadedAt: string; uploadedByName?: string; }
/** A pack still being prepared or approved — read-only for Treasury. stage: 0 preparing, 1 accountant, 2 director. */
export interface IpBatch {
  id: number; batchNumber: string; companyName: string; paymentTypeTitle: string; status: string; statusTitle: string; stage: 0 | 1 | 2; sentBack: boolean;
  preparedByName?: string | null; accountantName?: string | null; returnReason?: string | null; requestedApproverNames?: string | null; requestedDirectorNames?: string | null;
  amount: number; itemCount: number; documentCount: number; expectedPayDate: string; batchDocuments: IpDoc[];
  items: { id: number; supplierName: string; amount: number; invoiceNumbers?: string | null; documents: IpDoc[] }[];
}
export interface PaySchedule {
  nextPayDay: string; totals: { toLoad: number; toLoadCount: number; loaded: number; loadedCount: number; awaitingPop: number; awaitingPopCount: number; overdue: number; inProgress?: number; inProgressCount?: number };
  batches: PayBatch[]; inProgress?: IpBatch[]; me?: { bank: boolean; clerk: boolean };
}
/** A payment the director queried: Open = needs an answer; WithDirector = answered and back with the director. */
export interface QueryRow {
  itemId: number; batchId: number; batchNumber: string; companyName: string; supplierName: string; invoiceNumbers?: string; amount: number;
  question: string; askedBy?: string; askedAt?: string; answer?: string | null; answeredBy?: string | null; answeredAt?: string | null; fromBatch?: string | null; state: 'Open' | 'Answered' | 'WithDirector';
}
export interface HistoryBatch {
  id: number; batchNumber: string; companyName: string; paymentTypeTitle: string; status: string; statusTitle: string; directorName?: string; paidAt?: string; closedAt?: string;
  amount: number; items: number; popDone: number; popMissing: number; lines: PayLine[];
}
export interface History { count: number; total: number; popMissing: number; companies: { code: string; name: string }[]; batches: HistoryBatch[]; }
export interface Meta { me: { isAdmin: boolean; clerk: boolean; accountant: boolean; director: boolean; bank: boolean; hasSignature: boolean } }

@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);
  readonly base = environment.apiBase.replace(/\/$/, '');
  private cr = `${this.base}/api/finance/creditors`;

  login(email: string, password: string) { return this.http.post<any>(`${this.base}/api/exec/auth/login`, { email, password }); }
  verify(challenge: string, code: string) { return this.http.post<any>(`${this.base}/api/exec/auth/verify`, { challenge, code }); }

  meta() { return this.http.get<Meta>(`${this.cr}/meta`); }
  inbox() { return this.http.get<InboxRow[]>(`${this.cr}/inbox`); }
  batch(id: number) { return this.http.get<Batch>(`${this.cr}/batches/${id}`); }
  decide(id: number, itemId: number, decision: string, comment?: string) { return this.http.post<Batch>(`${this.cr}/batches/${id}/items/${itemId}/decision`, { decision, comment }); }
  sign(id: number, body: { typedName: string; comment?: string; signatureImageBase64?: string; useSavedSignature: boolean }) { return this.http.post<Batch>(`${this.cr}/batches/${id}/sign`, body); }
  accountantDecide(id: number, itemId: number, decision: string, comment?: string) { return this.http.post<Batch>(`${this.cr}/batches/${id}/items/${itemId}/accountant-decision`, { decision, comment }); }
  queries() { return this.http.get<QueryRow[]>(`${this.cr}/queries`); }
  answerQuery(id: number, itemId: number, answer: string) { return this.http.post<Batch>(`${this.cr}/batches/${id}/items/${itemId}/query-answer`, { answer }); }
  accountant(id: number, body: { decision: 'approve' | 'query'; comment?: string; directorUserIds?: number[]; signatureImageBase64?: string; useSavedSignature: boolean }) { return this.http.post<Batch>(`${this.cr}/batches/${id}/accountant`, body); }

  // Read-only director views
  executive() { return this.http.get<Executive>(`${this.cr}/executive`); }
  schedule() { return this.http.get<PaySchedule>(`${this.cr}/schedule`); }
  // Treasury
  setStatus(id: number, decision: 'LoadedOnBank' | 'Paid' | 'Closed', comment?: string) { return this.http.post<unknown>(`${this.cr}/batches/${id}/status`, { decision, comment }); }
  uploadPop(id: number, itemId: number, file: File) {
    const fd = new FormData(); fd.append('file', file, file.name); fd.append('docType', 'ProofOfPayment'); fd.append('itemId', String(itemId));
    return this.http.post<unknown>(`${this.cr}/batches/${id}/documents`, fd);
  }
  bankFileUrl(id: number) { return `${this.cr}/batches/${id}/bank-file`; }

  history(f: { from?: string; to?: string; company?: string; q?: string }) {
    let params = new HttpParams().set('take', 300);
    for (const [k, v] of Object.entries(f)) if (v) params = params.set(k, v);
    return this.http.get<History>(`${this.cr}/history`, { params });
  }

  blob(url: string) { return this.http.get(url, { responseType: 'blob' }); }
  /** Fetch a PDF with the exec token and open it in a new tab (falls back to the same tab on phones that block pop-ups). */
  openPdf(url: string, done?: (ok: boolean) => void) {
    const w = window.open('', '_blank');
    if (w) { try { w.document.title = 'Opening…'; w.document.body.style.font = '16px system-ui, sans-serif'; w.document.body.textContent = 'Opening the document…'; } catch { } }
    this.blob(url).subscribe({
      next: bl => {
        const u = URL.createObjectURL(bl);
        if (w && !w.closed) w.location.href = u;
        else { const a = document.createElement('a'); a.href = u; a.target = '_blank'; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); }
        setTimeout(() => URL.revokeObjectURL(u), 5 * 60_000);
        done?.(true);
      },
      error: async e => { try { w?.close(); } catch { } done?.(false); alert(await Api.errorText(e, "Couldn't open the document.")); }
    });
  }
  /** The server's message from a failed request, including blob (file) requests. */
  static async errorText(e: any, fallback: string): Promise<string> {
    if (e?.name === 'TimeoutError') return 'The server took too long. Try again.';
    if (e?.status === 0) return 'Could not reach the server. Check your connection.';
    let body = e?.error;
    if (body instanceof Blob) { try { body = JSON.parse(await body.text()); } catch { body = null; } }
    return body?.message ?? (e?.status === 403 ? "You don't have access to that." : e?.status === 404 ? 'Not found — it may have moved on. Refresh.' : fallback);
  }
  reviewPdfUrl(id: number) { return `${this.cr}/batches/${id}/review-pack.pdf`; }
  approvalSheetUrl(id: number) { return `${this.cr}/batches/${id}/approval-sheet.pdf`; }
  signedPackUrl(id: number) { return `${this.cr}/batches/${id}/signed-pack.pdf`; }
  schedulePdfUrl(id: number) { return `${this.cr}/batches/${id}/schedule.pdf`; }
  documentsZipUrl(id: number) { return `${this.cr}/batches/${id}/documents.zip`; }
  /** Fetch a file with the exec token and save it under a name (ZIP / PDF downloads). */
  download(url: string, name: string, done?: (ok: boolean) => void) {
    this.blob(url).subscribe({
      next: bl => { const a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60_000); done?.(true); },
      error: async e => { done?.(false); alert(await Api.errorText(e, "Couldn't download that.")); }
    });
  }
  /** One payment: approval sheet + every PDF attached to it. */
  itemReviewUrl(id: number, itemId: number) { return `${this.cr}/batches/${id}/items/${itemId}/review.pdf`; }
  fileUrl(id: number, docId: number) { return `${this.cr}/batches/${id}/documents/${docId}/file`; }
  signatureUrl() { return `${this.base}/api/users/me/signature`; }
}
