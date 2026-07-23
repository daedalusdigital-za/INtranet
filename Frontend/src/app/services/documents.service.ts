import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpEventType } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

export interface DepartmentInfo {
  name: string;
  documentCount: number;
  icon: string;
}

export interface DocumentFile {
  name: string;
  path: string;
  isFolder: boolean;
  size: number;
  lastModified: Date;
  fileType: string;
  icon: string;
  selected?: boolean;
}

export interface PasswordValidationResponse {
  success: boolean;
  token?: string;
  message?: string;
}

export interface FolderInfo {
  name: string;
  path: string;
  fullPath: string;
}

export interface DocumentPermissions {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canCreateFolders: boolean;
  canMove: boolean;
  userRole: string;
}

export interface ShareUser {
  userId: number;
  name: string;
  email: string;
  role: string;
}

export interface SharedItem {
  id: number;
  name: string;
  isFolder: boolean;
  sourceDepartment: string;
  sharedByName?: string;
  sharedByUserId: number;
  shareWithType: string;
  shareWithDepartment?: string;
  shareWithUserId?: number;
  note?: string;
  createdAt: Date;
  fileType: string;
  icon: string;
}

export interface ShareRequest {
  sourceDepartment: string;
  sourcePath: string;
  shareWithType: 'Department' | 'User';
  shareWithDepartment?: string;
  shareWithUserId?: number;
  note?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DocumentsService {
  private apiUrl = `${environment.apiUrl}/documents`;

  constructor(private http: HttpClient) {}

  // Get all departments with document counts
  getDepartments(): Observable<DepartmentInfo[]> {
    return this.http.get<DepartmentInfo[]>(`${this.apiUrl}/departments`);
  }

  // Validate department password
  validatePassword(department: string, password: string): Observable<PasswordValidationResponse> {
    return this.http.post<PasswordValidationResponse>(`${this.apiUrl}/validate-password`, {
      department,
      password
    });
  }

  // Get files in a department (or subfolder)
  getFiles(department: string, subfolder?: string): Observable<DocumentFile[]> {
    let params = new HttpParams();
    if (subfolder) {
      params = params.set('subfolder', subfolder);
    }
    return this.http.get<DocumentFile[]>(`${this.apiUrl}/files/${encodeURIComponent(department)}`, { params });
  }

  // Get all folders in a department (for move dialog)
  getFolders(department: string): Observable<FolderInfo[]> {
    return this.http.get<FolderInfo[]>(`${this.apiUrl}/folders/${encodeURIComponent(department)}`);
  }

  // Get user permissions for a department
  getPermissions(department: string): Observable<DocumentPermissions> {
    return this.http.get<DocumentPermissions>(`${this.apiUrl}/permissions/${encodeURIComponent(department)}`);
  }

  // Upload file to a department
  uploadFile(department: string, file: File, subfolder?: string): Observable<{ progress: number; file?: DocumentFile }> {
    const formData = new FormData();
    formData.append('file', file);

    let url = `${this.apiUrl}/upload/${encodeURIComponent(department)}`;
    if (subfolder) {
      url += `?subfolder=${encodeURIComponent(subfolder)}`;
    }

    return this.http.post(url, formData, {
      reportProgress: true,
      observe: 'events'
    }).pipe(
      map(event => {
        if (event.type === HttpEventType.UploadProgress) {
          const progress = event.total ? Math.round(100 * event.loaded / event.total) : 0;
          return { progress };
        } else if (event.type === HttpEventType.Response) {
          return { progress: 100, file: event.body as DocumentFile };
        }
        return { progress: 0 };
      })
    );
  }

  // Download a file
  downloadFile(department: string, filePath: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/download/${encodeURIComponent(department)}/${filePath}`, {
      responseType: 'blob'
    });
  }

  // Preview a file (returns blob for inline viewing)
  previewFile(department: string, filePath: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/preview/${encodeURIComponent(department)}/${filePath}`, {
      responseType: 'blob'
    });
  }

  // Get preview URL for a file
  getPreviewUrl(department: string, filePath: string): string {
    return `${this.apiUrl}/preview/${encodeURIComponent(department)}/${filePath}`;
  }

  // Move a file or folder
  moveFile(department: string, sourcePath: string, destinationFolder: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/move/${encodeURIComponent(department)}`, {
      sourcePath,
      destinationFolder
    });
  }

  // Rename a file or folder
  renameFile(department: string, path: string, newName: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/rename/${encodeURIComponent(department)}`, {
      path,
      newName
    });
  }

  // Create a new folder
  createFolder(department: string, folderName: string, parentPath?: string): Observable<DocumentFile> {
    return this.http.post<DocumentFile>(`${this.apiUrl}/create-folder/${encodeURIComponent(department)}`, {
      folderName,
      parentPath
    });
  }

  // Delete a file or folder
  deleteFile(department: string, filePath: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/delete/${encodeURIComponent(department)}/${filePath}`);
  }

  // Search files in a department
  searchFiles(department: string, query: string): Observable<DocumentFile[]> {
    return this.http.get<DocumentFile[]>(`${this.apiUrl}/search/${encodeURIComponent(department)}`, {
      params: { query }
    });
  }

  // Helper to format file size
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Check if file type is previewable
  isPreviewable(fileType: string): boolean {
    return ['pdf', 'image', 'word', 'excel', 'powerpoint', 'text', 'csv'].includes(fileType);
  }

  // -------------------------------------------------------------------------
  // SHARING
  // -------------------------------------------------------------------------

  // Search users for the "share with person" picker
  searchShareUsers(search?: string): Observable<ShareUser[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    return this.http.get<ShareUser[]>(`${this.apiUrl}/users`, { params });
  }

  // Share a file/folder with a department or a person
  shareItem(request: ShareRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/share`, request);
  }

  // Items shared with the current user (or their department)
  getSharedWithMe(): Observable<SharedItem[]> {
    return this.http.get<SharedItem[]>(`${this.apiUrl}/shared-with-me`);
  }

  // Items the current user has shared
  getSharedByMe(): Observable<SharedItem[]> {
    return this.http.get<SharedItem[]>(`${this.apiUrl}/shared-by-me`);
  }

  // Browse inside a shared folder
  getSharedFiles(shareId: number, subfolder?: string): Observable<DocumentFile[]> {
    let params = new HttpParams();
    if (subfolder) params = params.set('subfolder', subfolder);
    return this.http.get<DocumentFile[]>(`${this.apiUrl}/shared/${shareId}/files`, { params });
  }

  // Download a shared file
  downloadSharedFile(shareId: number, path?: string): Observable<Blob> {
    let params = new HttpParams();
    if (path) params = params.set('path', path);
    return this.http.get(`${this.apiUrl}/shared/${shareId}/download`, { params, responseType: 'blob' });
  }

  // Preview URL for a shared file
  getSharedPreviewUrl(shareId: number, path?: string): string {
    const q = path ? `?path=${encodeURIComponent(path)}` : '';
    return `${this.apiUrl}/shared/${shareId}/preview${q}`;
  }

  // Remove a share (unshare)
  unshare(shareId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/share/${shareId}`);
  }
}
