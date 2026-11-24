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
  directorName?: string; directorSignedAt?: string; paidAt?: string; approvedAmount: number; approvedItems: number; popDone: number; popMissing: number; items: PayLine[];
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
  batches: PayBatch[]; inProgress?: IpBatch[];
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
  history(f: { from?: string; to?: string; company?: string; q?: string }) {
    let params = new HttpParams().set('take', 300);
    for (const [k, v] of Object.entries(f)) if (v) params = params.set(k, v);
    return this.http.get<History>(`${this.cr}/history`, { params });
  }

  blob(url: string) { return this.http.get(url, { responseType: 'blob' }); }
  /** Fetch a PDF with the exec token and open it in a new tab (falls back to the same tab on phones that block pop-ups). */
  openPdf(url: string, done?: (ok: boolean) => void) {
    this.blob(url).subscribe({
      next: bl => { const u = URL.createObjectURL(bl); const w = window.open(u, '_blank'); if (!w) location.href = u; done?.(true); },
      error: () => { done?.(false); alert("Couldn't open the document."); }
    });
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
      error: () => { done?.(false); alert("Couldn't download that."); }
    });
  }
  /** One payment: approval sheet + every PDF attached to it. */
  itemReviewUrl(id: number, itemId: number) { return `${this.cr}/batches/${id}/items/${itemId}/review.pdf`; }
  fileUrl(id: number, docId: number) { return `${this.cr}/batches/${id}/documents/${docId}/file`; }
  signatureUrl() { return `${this.base}/api/users/me/signature`; }
}
