import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ArtworkAnnotation {
  id: number;
  type: string;
  x: number;
  y: number;
  text: string;
  color: string;
  createdByUserId?: number;
  createdByUserName?: string;
  createdAt: string;
}

export interface ArtworkFile {
  id: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  companyCode: string;
  category: string;
  tenderId?: number;
  tenderNumber?: string;
  notes?: string;
  uploadedByUserId?: number;
  uploadedByUserName?: string;
  uploadedAt: string;
  sentToMarketing: boolean;
  sentToMarketingAt?: string;
  annotations: ArtworkAnnotation[];
  // Client-side properties for viewer
  safeUrl?: any;
  blobUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ArtworkService {
  private apiUrl = `${environment.apiUrl}/artwork`;

  constructor(private http: HttpClient) {}

  // Get all artwork files with optional filters
  getArtworkFiles(companyCode?: string, category?: string, search?: string): Observable<ArtworkFile[]> {
    let params = new HttpParams();
    if (companyCode) params = params.set('companyCode', companyCode);
    if (category) params = params.set('category', category);
    if (search) params = params.set('search', search);
    return this.http.get<ArtworkFile[]>(this.apiUrl, { params });
  }

  // Get single artwork file by ID
  getArtworkFile(id: number): Observable<ArtworkFile> {
    return this.http.get<ArtworkFile>(`${this.apiUrl}/${id}`);
  }

  // Upload artwork file
  uploadArtwork(file: File, companyCode: string, category: string, tenderId?: number, tenderNumber?: string, notes?: string, uploadedByUserId?: number, uploadedByUserName?: string): Observable<ArtworkFile> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('companyCode', companyCode);
    formData.append('category', category);
    if (tenderId) formData.append('tenderId', tenderId.toString());
    if (tenderNumber) formData.append('tenderNumber', tenderNumber);
    if (notes) formData.append('notes', notes);
    if (uploadedByUserId) formData.append('uploadedByUserId', uploadedByUserId.toString());
    if (uploadedByUserName) formData.append('uploadedByUserName', uploadedByUserName);
    return this.http.post<ArtworkFile>(`${this.apiUrl}/upload`, formData);
  }

  // Download artwork file as blob
  downloadArtwork(id: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/download`, { responseType: 'blob' });
  }

  // Delete artwork file
  deleteArtwork(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // Add annotation to artwork
  addAnnotation(artworkId: number, annotation: { type: string; x: number; y: number; text?: string; color?: string; createdByUserId?: number; createdByUserName?: string }): Observable<ArtworkAnnotation> {
    return this.http.post<ArtworkAnnotation>(`${this.apiUrl}/${artworkId}/annotations`, annotation);
  }

  // Update annotation
  updateAnnotation(annotationId: number, update: { text?: string; x?: number; y?: number; color?: string }): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/annotations/${annotationId}`, update);
  }

  // Delete annotation
  deleteAnnotation(annotationId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/annotations/${annotationId}`);
  }

  // Clear all annotations for an artwork
  clearAnnotations(artworkId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${artworkId}/annotations`);
  }

  // Send to marketing
  sendToMarketing(artworkId: number, request: { recipients: string; priority?: string; message?: string; requestedByDate?: string; requestedByUser?: string }): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.apiUrl}/${artworkId}/send-to-marketing`, request);
  }

  // Link artwork to tender
  linkToTender(artworkId: number, tenderId: number | null, tenderNumber: string | null): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${artworkId}/link-tender`, { tenderId, tenderNumber });
  }
}
