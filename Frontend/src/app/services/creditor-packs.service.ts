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
  /** Resolved from job role + Users › Companies (or the pinned override above). */
  approvers?: CompanyApprovers;
}
export interface Approver { userId: number; name: string; role: string; email?: string | null; pinned: boolean; }
export interface CompanyApprovers {
  accountants: Approver[]; directors: Approver[]; treasurers: Approver[]; clerks: Approver[];
  accountantsPinned: boolean; directorsPinned: boolean;
}
export interface DocRule { docType: string; required: boolean; afterDelivery: boolean; ifReturned: boolean; withRecon?: boolean; }
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
  required: RequiredDoc[]; recommended: RequiredDoc[]; documents: BatchDoc[];
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
export interface SupplierHit { name: string; vatNumber?: string; bankName?: string; accountNumber?: string; branchCode?: string; accountHolder?: string; paymentReference?: string; supplierAccount?: string; payments: number; invoices: number; lastUsed?: string; source: string; vendorCode?: string | null; agingBalance?: number | null; agingOverdue?: number | null; }
export interface InvoiceRead { supplierName?: string; knownSupplier: boolean; supplier?: SupplierHit; amount?: number; vatAmount?: number; vatNumber?: string; invoiceNumber?: string; documentDate?: string; description?: string; orderNumber?: string; customerAccount?: string; bankName?: string; accountNumber?: string; branchCode?: string; accountHolder?: string; suggestedType?: string; pages: number; method?: string; scanned: boolean; readable: boolean; }
export interface BooksInvoiceHit { id: number; supplierName: string; supplierAccount?: string; invoiceNumber?: string; invoiceDate?: string; total: number; vatAmount?: number; companyName?: string; departmentName?: string; description?: string; status: string; paymentDate?: string; hasPdf: boolean; fileName?: string; alreadyLinked: boolean; }

@Injectable({ providedIn: 'root' })
export class CreditorPacksService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/finance/creditors`;

  meta(): Observable<CreditorMeta> { return this.http.get<CreditorMeta>(`${this.base}/meta`); }
  users(search?: string): Observable<{ id: number; name: string; email: string; role: string; title?: string | null; department?: string | null; permissions?: string; effective?: string[] }[]> {
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

  // ── Supplier directory / invoice auto-fill ──
  suppliers(q: string, take = 12, company?: string) { let p = new HttpParams().set('q', q).set('take', take); if (company) p = p.set('company', company); return this.http.get<SupplierHit[]>(`${this.base}/suppliers`, { params: p }); }

  // ── Creditors aging (Sage A/P aged payables per company) ──
  apAgingSnapshots() { return this.http.get<ApAgingIndex>(`${this.base}/aging/snapshots`); }
  apAging(id: number, search?: string, activeOnly = true) { let p = new HttpParams().set('activeOnly', activeOnly); if (search) p = p.set('search', search); return this.http.get<ApAging>(`${this.base}/aging/snapshots/${id}`, { params: p }); }
  apAgingDelete(id: number) { return this.http.delete(`${this.base}/aging/snapshots/${id}`); }
  apAgingExport(id: number, activeOnly = true) { return this.http.get(`${this.base}/aging/snapshots/${id}/export`, { params: { activeOnly }, responseType: 'blob' }); }
  apAgingHistory(company: string, code: string) { return this.http.get<ApAgingHistoryRow[]>(`${this.base}/aging/vendors/${company}/${encodeURIComponent(code)}/history`); }
  apAgingVendorDocs(snapshotId: number, code: string) { return this.http.get<ApAgingVendorDocs>(`${this.base}/aging/snapshots/${snapshotId}/vendors/${encodeURIComponent(code)}/documents`); }
  apAgingDocuments(snapshotId: number, f: { bucket?: number | null; type?: string; search?: string } = {}) { let p = new HttpParams(); if (f.bucket !== undefined && f.bucket !== null) p = p.set('bucket', f.bucket); if (f.type) p = p.set('type', f.type); if (f.search) p = p.set('search', f.search); return this.http.get<ApAgingDocument[]>(`${this.base}/aging/snapshots/${snapshotId}/documents`, { params: p }); }
  apAgingImport(file: File, company?: string, notes?: string) { const fd = new FormData(); fd.append('file', file); if (company) fd.append('company', company); if (notes) fd.append('notes', notes); return this.http.post<ApAgingSnapshot>(`${this.base}/aging/import`, fd); }
  readInvoice(file: File) { const fd = new FormData(); fd.append('file', file, file.name); return this.http.post<InvoiceRead>(`${this.base}/read-invoice`, fd); }
  readRecon(file: File) { const fd = new FormData(); fd.append('file', file, file.name); return this.http.post<InvoiceRead & { invoiceNumbers?: string[] }>(`${this.base}/read-recon`, fd); }
  booksInvoices(q: string, company?: string, take = 20) { let p = new HttpParams().set('q', q).set('take', take); if (company) p = p.set('company', company); return this.http.get<BooksInvoiceHit[]>(`${this.base}/books-invoices`, { params: p }); }
  linkInvoice(id: number, itemId: number, bookInvoiceId: number) { return this.http.post<BatchDetail>(`${this.base}/batches/${id}/items/${itemId}/link-invoice`, { bookInvoiceId }); }

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
  /** Parsed grid + extracted facts for a spreadsheet document (recon / schedule). */
  sheetUrl(id: number, docId: number) { return `${this.base}/batches/${id}/documents/${docId}/sheet`; }
  /** Payment schedule generated from the batch's payments (not uploaded). */
  generatedSchedule(id: number) { return this.http.get<GeneratedSchedule>(`${this.base}/batches/${id}/schedule`); }
  generatedScheduleXlsx(id: number) { return this.http.get(`${this.base}/batches/${id}/schedule?format=xlsx`, { responseType: 'blob' }); }

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

  // ── Group cashflow (template: Balance − Payments − Debit orders − Monthly = Closing) ──
  cashflow(asAt?: string) { return this.http.get<Cashflow>(`${this.base}/cashflow`, { params: asAt ? new HttpParams().set('asAt', asAt) : undefined }); }
  cashflowXlsx(asAt?: string) { return this.http.get(`${this.base}/cashflow/export`, { params: asAt ? new HttpParams().set('asAt', asAt) : undefined, responseType: 'blob' }); }
  setCashBalance(b: { companyCode: string; asAt: string; balance: number; note?: string }) { return this.http.put<Cashflow>(`${this.base}/cashflow/balance`, b); }
  cashBalanceHistory(code: string) { return this.http.get<CashBalance[]>(`${this.base}/cashflow/balance/${code}/history`); }
  addCashLine(l: CashLineInput) { return this.http.post<Cashflow>(`${this.base}/cashflow/lines`, l); }
  updateCashLine(id: number, l: CashLineInput) { return this.http.put<Cashflow>(`${this.base}/cashflow/lines/${id}`, l); }
  deleteCashLine(id: number) { return this.http.delete<Cashflow>(`${this.base}/cashflow/lines/${id}`); }

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
export interface GeneratedScheduleLine { no: number; itemId: number; supplier: string; invoiceDate?: string | null; documentNumber: string; description?: string | null; payableBy: string; amount: number; payable: number; bank?: string | null; accountNumber?: string | null; branchCode?: string | null; reference?: string | null; decision: string; hasInvoice: boolean; }
export interface GeneratedSchedule {
  head: { batchNumber: string; company: string; companyCode: string; paymentType: string; paymentRunDate: string; preparedBy: string; generatedAt: string; total: number; totalPayable: number; count: number; missingInvoiceDates: number; missingDocNumbers: number; };
  lines: GeneratedScheduleLine[];
}
export interface PaymentSchedule {
  payDays: string[]; nextPayDay: string; me: { bank: boolean; clerk: boolean };
  totals: { toLoad: number; toLoadCount: number; loaded: number; loadedCount: number; awaitingPop: number; awaitingPopCount: number; overdue: number };
  batches: ScheduleBatch[];
}
export interface ApAgingSnapshot { id: number; companyCode: string; reportCompany?: string | null; asOfDate: string; sourceFileName?: string | null; uploadedAt: string; uploadedByName?: string | null; vendorCount: number; activeVendorCount: number; totalCurrent: number; totalOverdue: number; totalPayables: number; notes?: string | null; hasDetail?: boolean; documentCount?: number; }
export interface ApAgingIndex { companies: { code: string; name: string }[]; snapshots: ApAgingSnapshot[]; }
export interface ApAgingVendor { id: number; code: string; name: string; currency?: string | null; current: number; d30: number; d60: number; d90: number; over90: number; overdue: number; total: number; oldestBucket: number; inPacks: number; packs?: { batchId: number; batchNumber: string; status: string }[] | null; docCount?: number; }
export interface ApAgingDocument { id: number; vendorCode?: string; vendorName?: string; docType: string; typeLabel: string; docNumber: string; docDate?: string | null; dueDate?: string | null; current: number; d30: number; d60: number; d90: number; over90: number; overdue: number; total: number; bucket: number; daysOverdue: number; packs?: { batchId: number; batchNumber: string; status: string }[] | null; }
export interface ApAgingVendorDocs { snapshot: { id: number; companyCode: string; asOfDate: string; hasDetail: boolean }; documents: ApAgingDocument[]; totals: { current: number; d30: number; d60: number; d90: number; over90: number; overdue: number; total: number }; }
export interface ApAging { snapshot: ApAgingSnapshot; buckets: { index: number; label: string; amount: number; pct: number }[]; total: number; overdue: number; vendors: ApAgingVendor[]; }
export interface ApAgingHistoryRow { asOfDate: string; id: number; current: number; d30: number; d60: number; d90: number; over90: number; overdue: number; total: number; }
export type CashSection = 'DebitOrder' | 'Monthly';
export interface CashLineInput { companyCode: string; section: CashSection; payee: string; reference?: string | null; description?: string | null; frequency?: string | null; dueDay?: number | null; amount: number; isActive: boolean; }
export interface CashLine extends CashLineInput { id: number; sortOrder: number; updatedAt?: string | null; updatedByName?: string | null; }
export interface CashBalance { id: number; companyCode: string; asAt: string; balance: number; note?: string | null; updatedByName?: string | null; updatedAt: string; }
export interface CashBatchRef { id: number; batchNumber: string; status: string; paymentType: string; batchDate: string; amount: number; approved: boolean; }
export interface CashPaymentLine { no: number; supplier: string; invoiceDate?: string | null; documentNumber: string; description?: string | null; payableBy: string; amount: number; batchNumber: string; status: string; }
export interface CashCompany {
  code: string; name: string; balance?: number | null; balanceAsAt?: string | null; balanceNote?: string | null;
  payments: number; paymentsApproved: number; batchCount: number; debitOrders: number; monthly: number; closing: number;
  batches: CashBatchRef[]; paymentLines: CashPaymentLine[]; lines: CashLine[];
}
export interface Cashflow {
  asAt: string; generatedAt: string; companies: CashCompany[]; canEdit: boolean;
  totals: { balance: number; payments: number; paymentsApproved: number; debitOrders: number; monthly: number; closing: number };
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
