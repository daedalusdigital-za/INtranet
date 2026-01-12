import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { DocumentsService, DocumentFile } from '../../services/documents.service';

@Component({
  selector: 'app-department-hub',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatMenuModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatTableModule,
    MatSortModule,
    NavbarComponent
  ],
  template: `
    <app-navbar></app-navbar>

    <div class="hub-container">
      <!-- Header -->
      <div class="header-section">
        <div class="breadcrumb">
          <a routerLink="/documents" class="back-link">
            <mat-icon>arrow_back</mat-icon>
            Documents
          </a>
          <span class="separator">/</span>
          <span class="current" (click)="navigateToRoot()">{{ departmentName }}</span>
          <ng-container *ngFor="let crumb of breadcrumbs; let i = index">
            <span class="separator">/</span>
            <span class="crumb" (click)="navigateToBreadcrumb(i)">{{ crumb }}</span>
          </ng-container>
        </div>

        <div class="actions">
          <mat-form-field appearance="outline" class="search-field">
            <mat-icon matPrefix>search</mat-icon>
            <input matInput placeholder="Search files..." [(ngModel)]="searchQuery" (input)="onSearch()">
          </mat-form-field>

          <button mat-raised-button color="primary" (click)="fileInput.click()">
            <mat-icon>upload</mat-icon>
            Upload
          </button>
          <input type="file" #fileInput hidden multiple (change)="onFileSelected($event)">

          <button mat-raised-button color="accent" (click)="showNewFolderDialog()">
            <mat-icon>create_new_folder</mat-icon>
            New Folder
          </button>
        </div>
      </div>

      <!-- Upload progress -->
      <div class="upload-progress" *ngIf="isUploading">
        <mat-icon>cloud_upload</mat-icon>
        <span>Uploading {{ uploadingFileName }}...</span>
        <mat-progress-bar mode="determinate" [value]="uploadProgress"></mat-progress-bar>
      </div>

      <!-- New folder input -->
      <div class="new-folder-input" *ngIf="showNewFolder">
        <mat-form-field appearance="outline">
          <mat-label>Folder Name</mat-label>
          <input matInput [(ngModel)]="newFolderName" (keyup.enter)="createFolder()">
        </mat-form-field>
        <button mat-raised-button color="primary" (click)="createFolder()">Create</button>
        <button mat-button (click)="showNewFolder = false">Cancel</button>
      </div>

      <!-- Files Grid -->
      <div class="files-container">
        <div class="empty-state" *ngIf="files.length === 0 && !isLoading">
          <mat-icon>folder_open</mat-icon>
          <h3>No files yet</h3>
          <p>Upload files or create folders to get started</p>
        </div>

        <div class="files-grid" *ngIf="files.length > 0">
          <mat-card class="file-card" *ngFor="let file of files" 
                    [class.folder]="file.isFolder"
                    (dblclick)="onFileDoubleClick(file)">
            <mat-card-content>
              <div class="file-icon">
                <mat-icon [class]="file.fileType">{{ file.icon }}</mat-icon>
              </div>
              <div class="file-info">
                <span class="file-name" [matTooltip]="file.name">{{ file.name }}</span>
                <span class="file-meta" *ngIf="!file.isFolder">
                  {{ formatSize(file.size) }} • {{ formatDate(file.lastModified) }}
                </span>
                <span class="file-meta" *ngIf="file.isFolder">Folder</span>
              </div>
              <div class="file-actions">
                <button mat-icon-button [matMenuTriggerFor]="fileMenu">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #fileMenu="matMenu">
                  <button mat-menu-item *ngIf="file.isFolder" (click)="openFolder(file)">
                    <mat-icon>folder_open</mat-icon>
                    <span>Open</span>
                  </button>
                  <button mat-menu-item *ngIf="!file.isFolder" (click)="downloadFile(file)">
                    <mat-icon>download</mat-icon>
                    <span>Download</span>
                  </button>
                  <button mat-menu-item *ngIf="!file.isFolder" (click)="previewFile(file)">
                    <mat-icon>visibility</mat-icon>
                    <span>Preview</span>
                  </button>
                  <button mat-menu-item class="delete-option" (click)="deleteFile(file)">
                    <mat-icon>delete</mat-icon>
                    <span>Delete</span>
                  </button>
                </mat-menu>
              </div>
            </mat-card-content>
          </mat-card>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .hub-container {
      padding: 80px 40px 40px;
      min-height: calc(100vh - 64px);
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .header-section {
      max-width: 1400px;
      margin: 0 auto 24px;
    }

    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 8px;
      color: white;
      font-size: 18px;
      margin-bottom: 16px;
    }

    .back-link {
      display: flex;
      align-items: center;
      gap: 4px;
      color: rgba(255, 255, 255, 0.8);
      text-decoration: none;
      transition: color 0.2s;
    }

    .back-link:hover {
      color: white;
    }

    .separator {
      color: rgba(255, 255, 255, 0.5);
    }

    .current, .crumb {
      cursor: pointer;
      transition: color 0.2s;
    }

    .current:hover, .crumb:hover {
      color: rgba(255, 255, 255, 0.8);
    }

    .actions {
      display: flex;
      gap: 16px;
      align-items: center;
    }

    .search-field {
      flex: 1;
      max-width: 400px;
    }

    .search-field ::ng-deep .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    .search-field ::ng-deep .mat-mdc-text-field-wrapper {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 8px;
    }

    .upload-progress {
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(255, 255, 255, 0.95);
      padding: 12px 20px;
      border-radius: 8px;
      max-width: 1400px;
      margin: 0 auto 16px;
    }

    .upload-progress mat-progress-bar {
      flex: 1;
    }

    .new-folder-input {
      display: flex;
      gap: 12px;
      align-items: center;
      background: rgba(255, 255, 255, 0.95);
      padding: 12px 20px;
      border-radius: 8px;
      max-width: 500px;
      margin: 0 auto 16px;
    }

    .new-folder-input mat-form-field {
      flex: 1;
    }

    .new-folder-input ::ng-deep .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    .files-container {
      max-width: 1400px;
      margin: 0 auto;
    }

    .empty-state {
      text-align: center;
      padding: 80px 40px;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 16px;
    }

    .empty-state mat-icon {
      font-size: 80px;
      width: 80px;
      height: 80px;
      color: #ccc;
    }

    .empty-state h3 {
      color: #666;
      margin: 16px 0 8px;
    }

    .empty-state p {
      color: #999;
    }

    .files-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }

    .file-card {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 12px !important;
      transition: all 0.3s ease;
      cursor: pointer;
    }

    .file-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2) !important;
    }

    .file-card.folder {
      border-left: 4px solid #ffc107;
    }

    .file-card mat-card-content {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px !important;
    }

    .file-icon {
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      background: #f5f5f5;
    }

    .file-icon mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .file-icon mat-icon.folder { color: #ffc107; }
    .file-icon mat-icon.pdf { color: #e53935; }
    .file-icon mat-icon.word { color: #2196f3; }
    .file-icon mat-icon.excel { color: #4caf50; }
    .file-icon mat-icon.powerpoint { color: #ff9800; }
    .file-icon mat-icon.image { color: #9c27b0; }
    .file-icon mat-icon.video { color: #673ab7; }
    .file-icon mat-icon.audio { color: #00bcd4; }
    .file-icon mat-icon.archive { color: #795548; }

    .file-info {
      flex: 1;
      min-width: 0;
    }

    .file-name {
      display: block;
      font-weight: 500;
      color: #333;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .file-meta {
      display: block;
      font-size: 12px;
      color: #999;
      margin-top: 4px;
    }

    .file-actions button {
      color: #666;
    }

    .delete-option {
      color: #e53935 !important;
    }

    .delete-option mat-icon {
      color: #e53935;
    }
  `]
})
export class DepartmentHubComponent implements OnInit {
  departmentName: string = '';
  currentPath: string = '';
  breadcrumbs: string[] = [];
  files: DocumentFile[] = [];
  searchQuery: string = '';
  isLoading: boolean = false;
  isUploading: boolean = false;
  uploadProgress: number = 0;
  uploadingFileName: string = '';
  showNewFolder: boolean = false;
  newFolderName: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private documentsService: DocumentsService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.departmentName = params['department'];
      this.loadFiles();
    });
  }

  loadFiles(): void {
    this.isLoading = true;
    const subfolder = this.breadcrumbs.length > 0 ? this.breadcrumbs.join('/') : undefined;
    
    this.documentsService.getFiles(this.departmentName, subfolder).subscribe({
      next: (files) => {
        this.files = files;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading files:', error);
        this.snackBar.open('Failed to load files', 'Close', { duration: 3000 });
        this.isLoading = false;
      }
    });
  }

  onSearch(): void {
    if (this.searchQuery.length > 2) {
      this.documentsService.searchFiles(this.departmentName, this.searchQuery).subscribe({
        next: (files) => {
          this.files = files;
        }
      });
    } else if (this.searchQuery.length === 0) {
      this.loadFiles();
    }
  }

  onFileDoubleClick(file: DocumentFile): void {
    if (file.isFolder) {
      this.openFolder(file);
    } else {
      this.previewFile(file);
    }
  }

  openFolder(file: DocumentFile): void {
    this.breadcrumbs.push(file.name);
    this.loadFiles();
  }

  navigateToRoot(): void {
    this.breadcrumbs = [];
    this.loadFiles();
  }

  navigateToBreadcrumb(index: number): void {
    this.breadcrumbs = this.breadcrumbs.slice(0, index + 1);
    this.loadFiles();
  }

  onFileSelected(event: any): void {
    const files: FileList = event.target.files;
    if (files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      this.uploadFile(files[i]);
    }
    event.target.value = ''; // Reset input
  }

  uploadFile(file: File): void {
    this.isUploading = true;
    this.uploadingFileName = file.name;
    this.uploadProgress = 0;

    const subfolder = this.breadcrumbs.length > 0 ? this.breadcrumbs.join('/') : undefined;

    this.documentsService.uploadFile(this.departmentName, file, subfolder).subscribe({
      next: (result) => {
        this.uploadProgress = result.progress;
        if (result.file) {
          this.isUploading = false;
          this.snackBar.open(`Uploaded ${file.name}`, 'Close', { duration: 3000 });
          this.loadFiles();
        }
      },
      error: (error) => {
        console.error('Upload error:', error);
        this.isUploading = false;
        this.snackBar.open('Upload failed', 'Close', { duration: 3000 });
      }
    });
  }

  showNewFolderDialog(): void {
    this.showNewFolder = true;
    this.newFolderName = '';
  }

  createFolder(): void {
    if (!this.newFolderName.trim()) {
      this.snackBar.open('Please enter a folder name', 'Close', { duration: 3000 });
      return;
    }

    const parentPath = this.breadcrumbs.length > 0 ? this.breadcrumbs.join('/') : undefined;

    this.documentsService.createFolder(this.departmentName, this.newFolderName, parentPath).subscribe({
      next: () => {
        this.showNewFolder = false;
        this.snackBar.open(`Folder "${this.newFolderName}" created`, 'Close', { duration: 3000 });
        this.loadFiles();
      },
      error: (error) => {
        console.error('Error creating folder:', error);
        this.snackBar.open('Failed to create folder', 'Close', { duration: 3000 });
      }
    });
  }

  downloadFile(file: DocumentFile): void {
    this.documentsService.downloadFile(this.departmentName, file.path).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        console.error('Download error:', error);
        this.snackBar.open('Download failed', 'Close', { duration: 3000 });
      }
    });
  }

  previewFile(file: DocumentFile): void {
    // For images and PDFs, open in new tab
    if (['image', 'pdf'].includes(file.fileType)) {
      this.documentsService.downloadFile(this.departmentName, file.path).subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          window.open(url, '_blank');
        }
      });
    } else {
      // For other files, just download
      this.downloadFile(file);
    }
  }

  deleteFile(file: DocumentFile): void {
    if (confirm(`Are you sure you want to delete "${file.name}"?`)) {
      this.documentsService.deleteFile(this.departmentName, file.path).subscribe({
        next: () => {
          this.snackBar.open(`Deleted "${file.name}"`, 'Close', { duration: 3000 });
          this.loadFiles();
        },
        error: (error) => {
          console.error('Delete error:', error);
          this.snackBar.open('Failed to delete', 'Close', { duration: 3000 });
        }
      });
    }
  }

  formatSize(bytes: number): string {
    return this.documentsService.formatFileSize(bytes);
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString();
  }
}
