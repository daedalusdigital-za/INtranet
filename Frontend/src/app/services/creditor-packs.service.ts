import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CreditorCompany {
  id: number; code: string; name: string; activity?: string; isActive: boolean; sortOrder: number;
  accountantUserId?: number | null; accountantName?: string | null;
  backupApproverUserId?: number | null; backupApproverName?: string | null;
  directorUserId?: number | null; directorName?: string | null;
  delegateDirectorUserId?: number | null; delegateDirectorName?: string | null;
}
export interface DocRule { docType: string; required: boolean; afterDelivery: boolean; ifReturned: boolean; }
export interface CreditorMeta {
  companies: CreditorCompany[];
  paymentTypes: { key: string; title: string }[];
  docTypes: { key: string; title: string; scope: 'batch' | 'item' }[];
  rules: Record<string, DocRule[]>;
  statuses: { key: string; title: string }[];
  roles: { key: string; title: string; description: string }[];
  me: { userId: number; isAdmin: boolean; clerk: boolean; accountant: boolean; director: boolean; bank: boolean; readOnly: boolean };
}
export interface BatchRow {
  id: number; batchNumber: string; companyCode: string; paymentType: string; batchDate: string; status: string; statusTitle: string;
  totalAmount: number; items: number; documents: number; preparedByUserId: number; preparedByName?: string; createdAt: string; submittedAt?: string; updatedAt?: string; checksStatus?: string;
  accountantName?: string; accountantApprovedAt?: string; directorName?: string; directorSignedAt?: string; paidAt?: string; closedAt?: string;
  returnReason?: string; openPrepayments: number; approvedItems: number; queriedItems: number; rejectedItems: number;
}
export interface RequiredDoc { docType: string; title: string; filled: boolean; }
export interface BatchDoc {
  id: number; itemId?: number | null; docType: string; title: string; suggestedDocType?: string; isNotApplicable: boolean; naReason?: string;
  originalFileName?: string; size: number; pageCount: number; textMethod?: string; documentDate?: string; extractedAccountNumber?: string;
  extractedVatNumber?: string; extractedInvoiceNumber?: string; extractedAmount?: number; uploadedByName?: string; uploadedAt: string;
  version: number; supersedesDocumentId?: number; versionReason?: string; sha256?: string;
}
export interface BatchItem {
  id: number; supplierName: string; supplierVatNumber?: string; invoiceNumbers?: string; description?: string; amount: number;
  bankName?: string; accountNumber?: string; branchCode?: string; accountHolder?: string; paymentReference?: string; stockReturned: boolean;
  decisionStatus: 'Pending' | 'Approved' | 'Queried' | 'Rejected'; decisionComment?: string; decidedAt?: string; prepaymentOpen: boolean; paidAt?: string; sortOrder: number;
  required: RequiredDoc[]; documents: BatchDoc[];
}
export interface CheckFinding { code: string; title: string; severity: 'PASS' | 'REVIEW' | 'FAIL'; detail?: string; supplier?: string; itemId?: number; }
export interface BatchDetail {
  id: number; batchNumber: string; companyCode: string; companyName: string; paymentType: string; paymentTypeTitle: string; batchDate: string;
  status: string; statusTitle: string; notes?: string; totalAmount: number; approvedAmount: number;
  preparedByUserId: number; preparedByName?: string; createdAt: string; submittedAt?: string; updatedAt?: string;
  checksRunAt?: string; checksStatus?: string; checks?: { status: string; pass: number; review: number; fail: number; findings: CheckFinding[] } | null;
  accountantUserId?: number; accountantName?: string; accountantApprovedAt?: string; accountantComment?: string;
  directorUserId?: number; directorName?: string; directorSignedAt?: string; directorComment?: string;
  lockedAt?: string; lockHash?: string; bankExportedAt?: string; paidAt?: string; closedAt?: string; returnReason?: string;
  responsible: { accountant?: number; backup?: number; director?: number; delegateDirector?: number };
  items: BatchItem[]; batchDocuments: BatchDoc[]; requiredBatchDocs: RequiredDoc[]; readyToSubmit: boolean;
  events: { id: number; at: string; userName?: string; action: string; fromStatus?: string; toStatus?: string; comment?: string }[];
  signatures: { id: number; context: string; signerName: string; signerRole?: string; action: string; comment?: string; method: string; signedAtUtc: string; payloadHash?: string; hasImage: boolean }[];
  can: { edit: boolean; submit: boolean; reopen: boolean; accountant: boolean; direct: boolean; sign: boolean; bankFile: boolean; markLoaded: boolean; markPaid: boolean; close: boolean; uploadAfterLock: boolean; rerunChecks: boolean };
}
export interface ItemInput {
  supplierName: string; supplierVatNumber?: string; invoiceNumbers?: string; description?: string; amount: number;
  bankName?: string; accountNumber?: string; branchCode?: string; accountHolder?: string; paymentReference?: string; stockReturned: boolean;
}
export interface CreditorAlert { batchId: number; batchNumber: string; companyCode: string; status: string; code: string; title: string; severity: string; detail?: string; supplier?: string; }

@Injectable({ providedIn: 'root' })
export class CreditorPacksService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/finance/creditors`;

  meta(): Observable<CreditorMeta> { return this.http.get<CreditorMeta>(`${this.base}/meta`); }
  users(search?: string): Observable<{ id: number; name: string; email: string; role: string; permissions?: string }[]> {
    return this.http.get<any[]>(`${this.base}/users`, { params: search ? { search } : {} });
  }
  toggleRole(userId: number, role: string, grant: boolean) { return this.http.post<{ id: number; permissions: string }>(`${this.base}/roles`, { userId, role, grant }); }
  updateCompany(id: number, dto: Partial<CreditorCompany>) { return this.http.put<CreditorCompany>(`${this.base}/companies/${id}`, dto); }
  addCompany(dto: Partial<CreditorCompany>) { return this.http.post<CreditorCompany>(`${this.base}/companies`, dto); }

  list(f: { company?: string; status?: string; type?: string } = {}): Observable<BatchRow[]> {
    let p = new HttpParams();
    if (f.company) p = p.set('company', f.company);
    if (f.status) p = p.set('status', f.status);
    if (f.type) p = p.set('type', f.type);
    return this.http.get<BatchRow[]>(`${this.base}/batches`, { params: p });
  }
  summary() { return this.http.get<{ byStatus: { status: string; count: number; amount: number }[]; openPrepayments: number }>(`${this.base}/summary`); }
  alerts() { return this.http.get<CreditorAlert[]>(`${this.base}/alerts`); }
  get(id: number) { return this.http.get<BatchDetail>(`${this.base}/batches/${id}`); }
  create(dto: { companyCode: string; paymentType: string; batchDate?: string; notes?: string }) { return this.http.post<BatchDetail>(`${this.base}/batches`, dto); }
  update(id: number, dto: { batchDate?: string; notes?: string; paymentType?: string }) { return this.http.put<BatchDetail>(`${this.base}/batches/${id}`, dto); }
  delete(id: number) { return this.http.delete(`${this.base}/batches/${id}`); }

  addItem(id: number, dto: ItemInput) { return this.http.post<BatchDetail>(`${this.base}/batches/${id}/items`, dto); }
  updateItem(id: number, itemId: number, dto: ItemInput) { return this.http.put<BatchDetail>(`${this.base}/batches/${id}/items/${itemId}`, dto); }
  deleteItem(id: number, itemId: number) { return this.http.delete<BatchDetail>(`${this.base}/batches/${id}/items/${itemId}`); }

  upload(id: number, file: File, docType?: string, itemId?: number | null, supersedesDocumentId?: number, versionReason?: string) {
    const fd = new FormData();
    fd.append('file', file, file.name);
    if (docType) fd.append('docType', docType);
    if (itemId) fd.append('itemId', String(itemId));
    if (supersedesDocumentId) fd.append('supersedesDocumentId', String(supersedesDocumentId));
    if (versionReason) fd.append('versionReason', versionReason);
    return this.http.post<BatchDetail>(`${this.base}/batches/${id}/documents`, fd);
  }
  markNa(id: number, docType: string, itemId: number | null, reason: string) { return this.http.post<BatchDetail>(`${this.base}/batches/${id}/documents/na`, { docType, itemId, reason }); }
  updateDoc(id: number, docId: number, dto: { docType?: string; itemId?: number; documentDate?: string }) { return this.http.put<BatchDetail>(`${this.base}/batches/${id}/documents/${docId}`, dto); }
  deleteDoc(id: number, docId: number) { return this.http.delete<BatchDetail>(`${this.base}/batches/${id}/documents/${docId}`); }
  fileUrl(id: number, docId: number, download = false) { return `${this.base}/batches/${id}/documents/${docId}/file${download ? '?download=true' : ''}`; }
  file(id: number, docId: number) { return this.http.get(this.fileUrl(id, docId), { responseType: 'blob' }); }

  submit(id: number) { return this.http.post<BatchDetail>(`${this.base}/batches/${id}/submit`, {}); }
  rerunChecks(id: number) { return this.http.post<BatchDetail>(`${this.base}/batches/${id}/checks`, {}); }
  accountant(id: number, decision: 'approve' | 'query', comment?: string) { return this.http.post<BatchDetail>(`${this.base}/batches/${id}/accountant`, { decision, comment }); }
  decide(id: number, itemId: number, decision: string, comment?: string) { return this.http.post<BatchDetail>(`${this.base}/batches/${id}/items/${itemId}/decision`, { decision, comment }); }
  sign(id: number, typedName: string, comment?: string, signatureImageBase64?: string) { return this.http.post<BatchDetail>(`${this.base}/batches/${id}/sign`, { typedName, comment, signatureImageBase64 }); }
  bankFile(id: number) { return this.http.get(`${this.base}/batches/${id}/bank-file`, { responseType: 'blob' }); }
  setStatus(id: number, decision: 'LoadedOnBank' | 'Paid' | 'Closed' | 'Draft', comment?: string) { return this.http.post<BatchDetail>(`${this.base}/batches/${id}/status`, { decision, comment }); }

  // ── Payment schedule (treasury) ──
  schedule() { return this.http.get<PaymentSchedule>(`${this.base}/schedule`); }
  reschedule(id: number, date: string, comment?: string) { return this.http.post<BatchDetail>(`${this.base}/batches/${id}/schedule`, { date, comment }); }

  // ── Executive (directors) ──
  executive() { return this.http.get<ExecutiveOverview>(`${this.base}/executive`); }

  // ── History (paid / closed) ──
  history(f: { from?: string; to?: string; company?: string; q?: string } = {}) {
    let p = new HttpParams();
    Object.entries(f).forEach(([k, v]) => { if (v) p = p.set(k, v); });
    return this.http.get<PaymentHistory>(`${this.base}/history`, { params: p });
  }
}

export interface HistoryLine { id: number; supplierName: string; amount: number; invoiceNumbers?: string; description?: string; bankName?: string; accountNumber?: string; paymentReference?: string; paidAt?: string; popDocId?: number | null; }
export interface HistoryBatch {
  id: number; batchNumber: string; companyCode: string; companyName: string; paymentType: string; paymentTypeTitle: string; status: string; statusTitle: string;
  scheduledPayDate?: string; directorName?: string; directorSignedAt?: string; accountantName?: string; accountantApprovedAt?: string; preparedByName?: string; bankExportedAt?: string; paidAt?: string; closedAt?: string;
  amount: number; items: number; popDone: number; popMissing: number; lines: HistoryLine[];
}
export interface PaymentHistory { count: number; total: number; popMissing: number; companies: { code: string; name: string }[]; batches: HistoryBatch[]; }

export interface ScheduleItem {
  id: number; supplierName: string; amount: number; invoiceNumbers?: string; description?: string; bankName?: string; accountNumber?: string; branchCode?: string;
  accountHolder?: string; paymentReference?: string; paidAt?: string; prepaymentOpen: boolean; hasPop: boolean; popDocId?: number | null;
}
export interface ScheduleBatch {
  id: number; batchNumber: string; companyCode: string; companyName: string; paymentType: string; paymentTypeTitle: string; status: string; statusTitle: string;
  scheduledPayDate: string; overdue: boolean; directorName?: string; directorSignedAt?: string; accountantName?: string; preparedByName?: string; bankExportedAt?: string; paidAt?: string;
  approvedAmount: number; approvedItems: number; popDone: number; popMissing: number; openPrepayments: number; items: ScheduleItem[];
  can: { bankFile: boolean; markLoaded: boolean; markPaid: boolean; uploadPop: boolean; close: boolean; reschedule: boolean };
}
export interface PaymentSchedule {
  payDays: string[]; nextPayDay: string; me: { bank: boolean; clerk: boolean };
  totals: { toLoad: number; toLoadCount: number; loaded: number; loadedCount: number; awaitingPop: number; awaitingPopCount: number; overdue: number };
  batches: ScheduleBatch[];
}
export interface ExecutiveAwaiting {
  id: number; batchNumber: string; companyCode: string; companyName: string; paymentType: string; paymentTypeTitle: string; totalAmount: number; items: number; decided: number;
  preparedByName?: string; submittedAt?: string; accountantName?: string; accountantApprovedAt?: string; checksStatus?: string; forMe: boolean; waitingDays: number;
  suppliers: { supplierName: string; amount: number }[];
}
export interface ExecutiveOverview {
  generatedAt: string; me: { userId: number; isDirector: boolean; isAdmin: boolean };
  awaiting: ExecutiveAwaiting[]; awaitingForMe: number; awaitingAmount: number;
  pipeline: { status: string; title: string; count: number; amount: number }[];
  schedule: { date: string; count: number; amount: number; paid: number; loaded: number }[];
  nextPayDay: string;
  paidByMonth: { month: string; label: string; total: number; byCompany: { code: string; amount: number }[] }[];
  spendByType: { type: string; title: string; amount: number; count: number }[];
  topSuppliers: { supplier: string; amount: number; payments: number; companies: number }[];
  perCompany: { code: string; name: string; activity?: string; directorName?: string; accountantName?: string; awaitingDirector: number; awaitingDirectorCount: number; inPreparation: number; onSchedule: number; paidThisMonth: number; paidLast90: number; awaitingPop: number }[];
  signedLast30: number; signedLast30Amount: number; paidThisMonth: number; awaitingPopAmount: number;
}
