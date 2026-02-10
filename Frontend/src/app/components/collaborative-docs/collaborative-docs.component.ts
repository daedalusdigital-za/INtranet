import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { CollaborativeDocsService } from '../../services/collaborative-docs.service';
import { CollaborativeDocument, CreateDocumentDto } from '../../models/collaborative-doc.model';

@Component({
  selector: 'app-collaborative-docs',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatMenuModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
    NavbarComponent
  ],
  template: `
    <app-navbar></app-navbar>
    
    <div class="docs-container">
      <div class="docs-header">
        <div class="header-content">
          <div class="title-section">
            <mat-icon class="header-icon">description</mat-icon>
            <div>
              <h1>Collaborative Documents</h1>
              <p>Create and edit documents in real-time with your team</p>
            </div>
          </div>
          <button mat-raised-button color="primary" (click)="openCreateDialog()" class="create-btn">
            <mat-icon>add</mat-icon>
            New Document
          </button>
        </div>
      </div>

      <div class="docs-content">
        @if (loading) {
          <div class="loading-container">
            <mat-spinner diameter="48"></mat-spinner>
            <p>Loading documents...</p>
          </div>
        } @else if (documents.length === 0) {
          <div class="empty-state">
            <mat-icon>article</mat-icon>
            <h2>No Documents Yet</h2>
            <p>Create your first collaborative document to get started</p>
            <button mat-raised-button color="primary" (click)="openCreateDialog()">
              <mat-icon>add</mat-icon>
              Create Document
            </button>
          </div>
        } @else {
          <div class="docs-grid">
            @for (doc of documents; track doc.id) {
              <mat-card class="doc-card" (click)="openDocument(doc.id)">
                <div class="doc-icon">
                  <mat-icon>{{ doc.isPublic ? 'public' : 'lock' }}</mat-icon>
                </div>
                <div class="doc-content">
                  <h3>{{ doc.title }}</h3>
                  <p class="doc-description">{{ doc.description || 'No description' }}</p>
                  <div class="doc-meta">
                    <span class="meta-item">
                      <mat-icon>person</mat-icon>
                      {{ doc.createdByName }}
                    </span>
                    <span class="meta-item">
                      <mat-icon>schedule</mat-icon>
                      {{ formatDate(doc.updatedAt) }}
                    </span>
                  </div>
                  <div class="doc-footer">
                    <mat-chip-set>
                      <mat-chip [class]="'role-' + doc.userRole">{{ doc.userRole }}</mat-chip>
                    </mat-chip-set>
                    @if (doc.collaboratorCount > 1) {
                      <span class="collaborator-count">
                        <mat-icon>group</mat-icon>
                        {{ doc.collaboratorCount }}
                      </span>
                    }
                  </div>
                </div>
                <button mat-icon-button [matMenuTriggerFor]="docMenu" class="doc-menu-btn" 
                        (click)="$event.stopPropagation()">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #docMenu="matMenu">
                  <button mat-menu-item (click)="openDocument(doc.id)">
                    <mat-icon>edit</mat-icon>
                    <span>Open</span>
                  </button>
                  @if (doc.userRole === 'owner') {
                    <button mat-menu-item (click)="openEditDialog(doc)">
                      <mat-icon>settings</mat-icon>
                      <span>Settings</span>
                    </button>
                    <button mat-menu-item (click)="deleteDocument(doc)" class="delete-item">
                      <mat-icon>delete</mat-icon>
                      <span>Delete</span>
                    </button>
                  }
                </mat-menu>
              </mat-card>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .docs-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .docs-header {
      padding: 32px 48px;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
    }

    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      max-width: 1400px;
      margin: 0 auto;
    }

    .title-section {
      display: flex;
      align-items: center;
      gap: 16px;
      color: white;
    }

    .header-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
    }

    .title-section h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 600;
    }

    .title-section p {
      margin: 4px 0 0 0;
      opacity: 0.8;
    }

    .create-btn {
      padding: 12px 24px !important;
      font-size: 16px !important;
    }

    .docs-content {
      padding: 32px 48px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px;
      color: white;
    }

    .loading-container p {
      margin-top: 16px;
      font-size: 16px;
    }

    .empty-state {
      text-align: center;
      padding: 80px 40px;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    }

    .empty-state mat-icon {
      font-size: 80px;
      width: 80px;
      height: 80px;
      color: #667eea;
      margin-bottom: 16px;
    }

    .empty-state h2 {
      margin: 0 0 8px 0;
      color: #333;
    }

    .empty-state p {
      margin: 0 0 24px 0;
      color: #666;
    }

    .docs-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 24px;
    }

    .doc-card {
      position: relative;
      padding: 24px !important;
      border-radius: 12px !important;
      cursor: pointer;
      transition: all 0.3s ease;
      background: white !important;
    }

    .doc-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2) !important;
    }

    .doc-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
    }

    .doc-icon mat-icon {
      color: white;
      font-size: 24px;
    }

    .doc-content h3 {
      margin: 0 0 8px 0;
      font-size: 18px;
      font-weight: 600;
      color: #333;
    }

    .doc-description {
      margin: 0 0 16px 0;
      color: #666;
      font-size: 14px;
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .doc-meta {
      display: flex;
      gap: 16px;
      margin-bottom: 12px;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #888;
    }

    .meta-item mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .doc-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .role-owner {
      background-color: #667eea !important;
      color: white !important;
    }

    .role-editor {
      background-color: #4caf50 !important;
      color: white !important;
    }

    .role-viewer {
      background-color: #ff9800 !important;
      color: white !important;
    }

    .collaborator-count {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #888;
    }

    .collaborator-count mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .doc-menu-btn {
      position: absolute;
      top: 12px;
      right: 12px;
    }

    .delete-item {
      color: #f44336 !important;
    }

    @media (max-width: 768px) {
      .docs-header {
        padding: 24px;
      }

      .header-content {
        flex-direction: column;
        gap: 16px;
        text-align: center;
      }

      .title-section {
        flex-direction: column;
      }

      .docs-content {
        padding: 24px;
      }

      .docs-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class CollaborativeDocsComponent implements OnInit {
  documents: CollaborativeDocument[] = [];
  loading = true;

  constructor(
    private docsService: CollaborativeDocsService,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadDocuments();
  }

  loadDocuments(): void {
    this.loading = true;
    this.docsService.getDocuments().subscribe({
      next: (docs) => {
        this.documents = docs;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading documents:', err);
        this.snackBar.open('Failed to load documents', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  openDocument(id: number): void {
    this.router.navigate(['/docs', id]);
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(CreateDocumentDialogComponent, {
      width: '480px',
      panelClass: 'modern-dialog'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.docsService.createDocument(result).subscribe({
          next: (doc) => {
            this.snackBar.open('Document created!', 'Close', { duration: 2000 });
            this.router.navigate(['/docs', doc.id]);
          },
          error: (err) => {
            console.error('Error creating document:', err);
            this.snackBar.open('Failed to create document', 'Close', { duration: 3000 });
          }
        });
      }
    });
  }

  openEditDialog(doc: CollaborativeDocument): void {
    const dialogRef = this.dialog.open(CreateDocumentDialogComponent, {
      width: '480px',
      panelClass: 'modern-dialog',
      data: doc
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.docsService.updateDocument(doc.id, result).subscribe({
          next: () => {
            this.snackBar.open('Document updated!', 'Close', { duration: 2000 });
            this.loadDocuments();
          },
          error: (err) => {
            console.error('Error updating document:', err);
            this.snackBar.open('Failed to update document', 'Close', { duration: 3000 });
          }
        });
      }
    });
  }

  deleteDocument(doc: CollaborativeDocument): void {
    if (confirm(`Are you sure you want to delete "${doc.title}"?`)) {
      this.docsService.deleteDocument(doc.id).subscribe({
        next: () => {
          this.snackBar.open('Document deleted', 'Close', { duration: 2000 });
          this.loadDocuments();
        },
        error: (err) => {
          console.error('Error deleting document:', err);
          this.snackBar.open('Failed to delete document', 'Close', { duration: 3000 });
        }
      });
    }
  }

  formatDate(date: Date | string): string {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        return minutes <= 1 ? 'Just now' : `${minutes} minutes ago`;
      }
      return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
    }
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return d.toLocaleDateString();
  }
}

// Create/Edit Document Dialog
@Component({
  selector: 'app-create-document-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>{{ data ? 'edit' : 'add' }}</mat-icon>
      {{ data ? 'Edit Document' : 'Create New Document' }}
    </h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Title</mat-label>
        <input matInput [(ngModel)]="title" placeholder="Enter document title" required>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Description (optional)</mat-label>
        <textarea matInput [(ngModel)]="description" rows="3" placeholder="Brief description"></textarea>
      </mat-form-field>

      <mat-checkbox [(ngModel)]="isPublic" color="primary">
        Make this document public (anyone can view)
      </mat-checkbox>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" [disabled]="!title.trim()" (click)="onSubmit()">
        {{ data ? 'Save' : 'Create' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
    }

    mat-dialog-content {
      padding-top: 16px;
    }

    .full-width {
      width: 100%;
      margin-bottom: 16px;
    }

    mat-checkbox {
      margin-bottom: 16px;
    }
  `]
})
export class CreateDocumentDialogComponent {
  title = '';
  description = '';
  isPublic = false;

  constructor(
    public dialogRef: MatDialogRef<CreateDocumentDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CollaborativeDocument | null
  ) {
    if (data) {
      this.title = data.title;
      this.description = data.description || '';
      this.isPublic = data.isPublic;
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    this.dialogRef.close({
      title: this.title.trim(),
      description: this.description.trim() || undefined,
      isPublic: this.isPublic
    });
  }
}
