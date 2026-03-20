import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
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
    MatProgressBarModule,
    MatProgressBarModule,
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
          <div class="loading-state">
            <div class="loading-card">
              <div class="lc-icon-wrap">
                <mat-icon class="lc-icon pulse-icon">description</mat-icon>
              </div>
              <h3>Loading Collaborative Documents</h3>
              <p class="lc-subtitle">Fetching your team's documents and workspaces</p>
              <div class="lc-progress-wrap">
                <div class="lc-progress-track">
                  <div class="lc-progress-fill" [style.width.%]="loadingProgress"></div>
                </div>
                <div class="lc-progress-info">
                  <span class="lc-progress-message">{{ loadingMessage }}</span>
                  <span class="lc-progress-pct">{{ loadingProgress | number:'1.0-0' }}%</span>
                </div>
              </div>
              <div class="lc-steps">
                @for (step of loadingSteps; track step.label; let i = $index) {
                  <div class="lc-step" [class.active]="loadingStage === i" [class.done]="loadingStage > i">
                    <div class="lc-step-dot">
                      @if (loadingStage > i) {
                        <mat-icon>check</mat-icon>
                      } @else {
                        <mat-icon>{{ step.icon }}</mat-icon>
                      }
                    </div>
                    <span class="lc-step-label">{{ step.label }}</span>
                  </div>
                }
              </div>
            </div>
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

    .loading-state {
      display: flex; justify-content: center; padding: 60px 20px;
    }
    .loading-card {
      background: rgba(255,255,255,0.97); border-radius: 20px;
      padding: 48px 56px; text-align: center; box-shadow: 0 8px 40px rgba(0,0,0,0.18);
      max-width: 520px; width: 100%;
    }
    .loading-card h3 { color: #1a1a2e; margin: 16px 0 6px; font-size: 20px; font-weight: 700; }
    .loading-card p { color: #64748b; margin: 0 0 20px; font-size: 14px; line-height: 1.5; }
    .lc-icon-wrap {
      width: 72px; height: 72px; border-radius: 50%; margin: 0 auto;
      background: linear-gradient(135deg, rgba(102,126,234,0.15), rgba(118,75,162,0.12));
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 20px rgba(102,126,234,0.15);
    }
    .lc-icon { font-size: 36px; width: 36px; height: 36px; color: #667eea; }
    .pulse-icon { animation: pulseGlow 2s ease-in-out infinite; }
    @keyframes pulseGlow {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.7; transform: scale(1.08); }
    }
    .lc-subtitle { color: #94a3b8 !important; font-size: 13px !important; }
    .lc-progress-wrap { margin: 8px 0 24px; }
    .lc-progress-track {
      height: 8px; border-radius: 4px; background: #f1f5f9;
      overflow: hidden; position: relative;
    }
    .lc-progress-fill {
      height: 100%; border-radius: 4px;
      background: linear-gradient(90deg, #667eea, #818cf8, #764ba2);
      background-size: 200% 100%;
      animation: shimmer 2s ease-in-out infinite;
      transition: width 0.15s ease-out;
      position: relative;
    }
    .lc-progress-fill::after {
      content: ''; position: absolute; right: 0; top: 0; bottom: 0; width: 24px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4));
      border-radius: 0 4px 4px 0;
    }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    .lc-progress-info {
      display: flex; justify-content: space-between; align-items: center;
      margin-top: 10px; font-size: 12px;
    }
    .lc-progress-message { color: #64748b; font-weight: 500; transition: opacity 0.3s ease; }
    .lc-progress-pct { color: #667eea; font-weight: 700; font-size: 13px; font-variant-numeric: tabular-nums; }
    .lc-steps {
      display: flex; justify-content: space-between; gap: 4px;
      padding-top: 4px; border-top: 1px solid #e2e8f0;
    }
    .lc-step {
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      flex: 1; padding-top: 16px; opacity: 0.35;
      transition: opacity 0.4s ease, transform 0.3s ease;
    }
    .lc-step.active { opacity: 1; transform: translateY(-2px); }
    .lc-step.done { opacity: 0.65; }
    .lc-step-dot {
      width: 32px; height: 32px; border-radius: 50%;
      background: #f1f5f9; display: flex; align-items: center; justify-content: center;
      transition: background 0.3s ease, box-shadow 0.3s ease;
    }
    .lc-step-dot mat-icon { font-size: 16px; width: 16px; height: 16px; color: #94a3b8; transition: color 0.3s ease; }
    .lc-step.active .lc-step-dot {
      background: linear-gradient(135deg, #667eea, #764ba2);
      box-shadow: 0 2px 10px rgba(102,126,234,0.3);
    }
    .lc-step.active .lc-step-dot mat-icon { color: #fff; }
    .lc-step.done .lc-step-dot { background: #dcfce7; }
    .lc-step.done .lc-step-dot mat-icon { color: #16a34a; }
    .lc-step-label { font-size: 11px; font-weight: 600; color: #94a3b8; white-space: nowrap; }
    .lc-step.active .lc-step-label { color: #667eea; }
    .lc-step.done .lc-step-label { color: #16a34a; }

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

  // Loading progress
  loadingProgress = 0;
  loadingStage = 0;
  loadingMessage = 'Initializing...';
  private progressInterval: any;
  readonly loadingSteps = [
    { icon: 'lock', label: 'Authenticating', detail: 'Securing connection...' },
    { icon: 'cloud_download', label: 'Fetching Docs', detail: 'Retrieving documents...' },
    { icon: 'article', label: 'Processing', detail: 'Organizing workspaces...' },
    { icon: 'dashboard', label: 'Ready', detail: 'Building document view...' }
  ];

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
    this.startLoadingProgress();
    this.docsService.getDocuments().subscribe({
      next: (docs) => {
        this.finishLoadingProgress(() => {
          this.documents = docs;
          this.loading = false;
        });
      },
      error: (err) => {
        console.error('Error loading documents:', err);
        this.stopLoadingProgress();
        this.snackBar.open('Failed to load documents', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  private startLoadingProgress(): void {
    this.loadingProgress = 0;
    this.loadingStage = 0;
    this.loadingMessage = this.loadingSteps[0].detail;
    this.progressInterval = setInterval(() => {
      const max = 88;
      if (this.loadingProgress < max) {
        const increment = Math.max(0.3, (max - this.loadingProgress) * 0.06);
        this.loadingProgress = Math.min(max, this.loadingProgress + increment);
      }
      const newStage = this.loadingProgress < 20 ? 0 : this.loadingProgress < 45 ? 1 : this.loadingProgress < 70 ? 2 : 3;
      if (newStage !== this.loadingStage) {
        this.loadingStage = newStage;
        this.loadingMessage = this.loadingSteps[newStage].detail;
      }
    }, 120);
  }

  private finishLoadingProgress(callback: () => void): void {
    clearInterval(this.progressInterval);
    this.loadingStage = 3;
    this.loadingMessage = 'Almost there...';
    const finish = setInterval(() => {
      this.loadingProgress = Math.min(100, this.loadingProgress + 4);
      if (this.loadingProgress >= 100) {
        clearInterval(finish);
        this.loadingMessage = 'Complete!';
        setTimeout(() => callback(), 300);
      }
    }, 30);
  }

  private stopLoadingProgress(): void {
    clearInterval(this.progressInterval);
    this.loadingProgress = 0;
    this.loadingStage = 0;
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
