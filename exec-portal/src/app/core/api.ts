import { HttpClient } from '@angular/common/http';
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
  isUrgent?: boolean; paymentModeTitle?: string; payoutMethod?: 'EFT' | 'EWallet' | null; decisionStatus: 'Pending' | 'Approved' | 'Queried' | 'Rejected'; decisionComment?: string;
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
  accountant(id: number, body: { decision: 'approve' | 'query'; comment?: string; directorUserIds?: number[]; signatureImageBase64?: string; useSavedSignature: boolean }) { return this.http.post<Batch>(`${this.cr}/batches/${id}/accountant`, body); }

  blob(url: string) { return this.http.get(url, { responseType: 'blob' }); }
  reviewPdfUrl(id: number) { return `${this.cr}/batches/${id}/review-pack.pdf`; }
  /** One payment: approval sheet + every PDF attached to it. */
  itemReviewUrl(id: number, itemId: number) { return `${this.cr}/batches/${id}/items/${itemId}/review.pdf`; }
  fileUrl(id: number, docId: number) { return `${this.cr}/batches/${id}/documents/${docId}/file`; }
  signatureUrl() { return `${this.base}/api/users/me/signature`; }
}
