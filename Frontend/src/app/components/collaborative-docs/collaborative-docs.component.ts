import { Component, OnInit, Inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
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
import { CollaborativeDocument, CreateDocumentDto, DocumentUser } from '../../models/collaborative-doc.model';
import * as mammoth from 'mammoth';

@Component({
  selector: 'app-collaborative-docs',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
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
          <div class="header-actions">
            <button mat-stroked-button (click)="triggerImport()" class="create-btn create-btn-import">
              <mat-icon>upload_file</mat-icon>
              Import
            </button>
            <button mat-stroked-button (click)="openCreateDialog('sheet')" class="create-btn create-btn-sheet">
              <mat-icon>table_chart</mat-icon>
              New Spreadsheet
            </button>
            <button mat-raised-button color="primary" (click)="openCreateDialog('doc')" class="create-btn">
              <mat-icon>add</mat-icon>
              New Document
            </button>
            <input #importInput type="file" hidden
                   accept=".csv,.txt,.html,.htm,.md,.doc,.docx"
                   (change)="onImportFilePicked($event)">
          </div>
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
            <p>Create your first collaborative document or spreadsheet to get started</p>
            <div class="empty-actions">
              <button mat-raised-button color="primary" (click)="openCreateDialog('doc')">
                <mat-icon>add</mat-icon>
                Create Document
              </button>
              <button mat-stroked-button (click)="openCreateDialog('sheet')">
                <mat-icon>table_chart</mat-icon>
                Create Spreadsheet
              </button>
            </div>
          </div>
        } @else {
          <div class="docs-grid">
            @for (doc of documents; track doc.id) {
              <mat-card class="doc-card" [class.sheet-card]="doc.documentType === 'sheet'" (click)="openDocument(doc)">
                <div class="doc-icon">
                  <mat-icon>{{ doc.documentType === 'sheet' ? 'table_chart' : 'description' }}</mat-icon>
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
                  <button mat-menu-item (click)="openDocument(doc)">
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
      position: relative;
      background: #0f172a;
      background-image:
        radial-gradient(circle at 15% 20%, rgba(99, 102, 241, 0.35) 0%, transparent 45%),
        radial-gradient(circle at 85% 15%, rgba(14, 165, 233, 0.32) 0%, transparent 45%),
        radial-gradient(circle at 75% 85%, rgba(236, 72, 153, 0.26) 0%, transparent 45%),
        radial-gradient(circle at 25% 90%, rgba(16, 185, 129, 0.24) 0%, transparent 45%),
        linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #0f172a 100%);
      background-attachment: fixed;
      overflow-x: hidden;
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

    .header-actions {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .create-btn-sheet {
      background: rgba(255,255,255,0.14) !important;
      color: #fff !important;
      border-color: rgba(255,255,255,0.35) !important;
    }

    .empty-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
    }

    .sheet-card .doc-icon mat-icon { color: #059669; }

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
      background: linear-gradient(135deg, rgba(37,99,235,0.15), rgba(30,64,175,0.12));
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 20px rgba(37,99,235,0.15);
    }
    .lc-icon { font-size: 36px; width: 36px; height: 36px; color: #2563eb; }
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
      background: linear-gradient(90deg, #2563eb, #60a5fa, #1e40af);
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
    .lc-progress-pct { color: #2563eb; font-weight: 700; font-size: 13px; font-variant-numeric: tabular-nums; }
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
      background: linear-gradient(135deg, #2563eb, #1e40af);
      box-shadow: 0 2px 10px rgba(37,99,235,0.3);
    }
    .lc-step.active .lc-step-dot mat-icon { color: #fff; }
    .lc-step.done .lc-step-dot { background: #dcfce7; }
    .lc-step.done .lc-step-dot mat-icon { color: #16a34a; }
    .lc-step-label { font-size: 11px; font-weight: 600; color: #94a3b8; white-space: nowrap; }
    .lc-step.active .lc-step-label { color: #2563eb; }
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
      color: #2563eb;
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
      background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
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
      background-color: #2563eb !important;
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
  @ViewChild('importInput') importInput!: ElementRef<HTMLInputElement>;

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

  openDocument(doc: CollaborativeDocument): void {
    if (doc.documentType === 'sheet') {
      this.router.navigate(['/sheets', doc.id]);
    } else {
      this.router.navigate(['/docs', doc.id]);
    }
  }

  /** Open the hidden file picker for importing an existing document/spreadsheet. */
  triggerImport(): void {
    this.importInput?.nativeElement?.click();
  }

  async onImportFilePicked(evt: Event): Promise<void> {
    const input = evt.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const name = file.name;
    const ext = (name.split('.').pop() || '').toLowerCase();
    const baseTitle = name.replace(/\.[^.]+$/, '') || 'Imported';

    try {
      if (ext === 'csv') {
        // CSV → spreadsheet: seed the sheet editor via sessionStorage.
        const text = await file.text();
        this.createAndSeed('sheet', baseTitle, text);
      } else if (ext === 'docx' || ext === 'doc') {
        // Word → document: convert to HTML with mammoth, then seed the doc editor.
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        this.createAndSeed('doc', baseTitle, result.value || '<p></p>');
      } else if (ext === 'html' || ext === 'htm') {
        const html = await file.text();
        this.createAndSeed('doc', baseTitle, html);
      } else {
        // txt / md and anything else → treat as plain text paragraphs.
        const text = await file.text();
        const html = text
          .split(/\r?\n/)
          .map(line => `<p>${this.escapeHtml(line) || '<br>'}</p>`)
          .join('');
        this.createAndSeed('doc', baseTitle, html);
      }
    } catch (err) {
      console.error('Import failed:', err);
      this.snackBar.open('Could not import that file', 'Close', { duration: 3500 });
    }
  }

  private escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** Create a new doc/sheet, stash the imported content, and open the editor. */
  private createAndSeed(documentType: 'doc' | 'sheet', title: string, content: string): void {
    this.docsService.createDocument({ title, documentType }).subscribe({
      next: (doc) => {
        const key = documentType === 'sheet'
          ? `collab-import-sheet-${doc.id}`
          : `collab-import-doc-${doc.id}`;
        try { sessionStorage.setItem(key, content); } catch { /* quota */ }
        this.snackBar.open('Importing…', 'Close', { duration: 1500 });
        this.router.navigate([documentType === 'sheet' ? '/sheets' : '/docs', doc.id]);
      },
      error: (err) => {
        console.error('Error creating document for import:', err);
        this.snackBar.open('Failed to import', 'Close', { duration: 3000 });
      }
    });
  }

  openCreateDialog(documentType: 'doc' | 'sheet' = 'doc'): void {
    const dialogRef = this.dialog.open(CreateDocumentDialogComponent, {
      width: '480px',
      panelClass: 'modern-dialog',
      data: { documentType }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const collaboratorIds: number[] = result.collaboratorIds || [];
        const { collaboratorIds: _omit, ...createDto } = result;
        this.docsService.createDocument({ ...createDto, documentType }).subscribe({
          next: (doc) => {
            const label = documentType === 'sheet' ? 'Spreadsheet' : 'Document';
            const navigate = () => {
              this.snackBar.open(`${label} created!`, 'Close', { duration: 2000 });
              this.router.navigate([documentType === 'sheet' ? '/sheets' : '/docs', doc.id]);
            };
            if (collaboratorIds.length) {
              let remaining = collaboratorIds.length;
              collaboratorIds.forEach((userId: number) => {
                this.docsService.addCollaborator(doc.id, { userId, role: 'editor' }).subscribe({
                  next: () => { if (--remaining === 0) navigate(); },
                  error: () => { if (--remaining === 0) navigate(); }
                });
              });
            } else {
              navigate();
            }
          },
          error: (err) => {
            console.error('Error creating document:', err);
            this.snackBar.open('Failed to create', 'Close', { duration: 3000 });
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
      <mat-icon>{{ isEdit ? 'edit' : (documentType === 'sheet' ? 'table_chart' : 'add') }}</mat-icon>
      {{ isEdit ? 'Edit' : 'Create New' }} {{ documentType === 'sheet' ? 'Spreadsheet' : 'Document' }}
    </h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Title</mat-label>
        <input matInput [(ngModel)]="title" placeholder="Enter title" required>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Description (optional)</mat-label>
        <textarea matInput [(ngModel)]="description" rows="3" placeholder="Brief description"></textarea>
      </mat-form-field>

      <mat-checkbox [(ngModel)]="isPublic" color="primary">
        Make this public (anyone can view)
      </mat-checkbox>

      @if (!isEdit) {
        <div class="collab-section">
          <label class="collab-label">
            <mat-icon>group_add</mat-icon> Add collaborators (optional)
          </label>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Search people</mat-label>
            <input matInput [(ngModel)]="userSearch" (ngModelChange)="onUserSearch($event)"
                   placeholder="Type a name or email">
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>

          @if (searchResults.length) {
            <div class="collab-results">
              @for (u of searchResults; track u.id) {
                <button type="button" class="collab-result" (click)="addCollaborator(u)">
                  <mat-icon>person_add</mat-icon>
                  <span class="cr-name">{{ u.fullName }}</span>
                  <span class="cr-email">{{ u.email }}</span>
                </button>
              }
            </div>
          }

          @if (selectedCollaborators.length) {
            <div class="collab-chips">
              @for (u of selectedCollaborators; track u.id) {
                <span class="collab-chip">
                  {{ u.fullName }}
                  <mat-icon (click)="removeCollaborator(u)">close</mat-icon>
                </span>
              }
            </div>
          }
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" [disabled]="!title.trim()" (click)="onSubmit()">
        {{ isEdit ? 'Save' : 'Create' }}
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

    .collab-section {
      margin-top: 8px;
      border-top: 1px solid var(--border-color, #e0e0e0);
      padding-top: 16px;
    }

    .collab-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary, #555);
      margin-bottom: 8px;
    }

    .collab-label mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .collab-results {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 180px;
      overflow-y: auto;
      margin-bottom: 12px;
    }

    .collab-result {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border: 1px solid var(--border-color, #e0e0e0);
      border-radius: 8px;
      background: var(--surface, #fff);
      cursor: pointer;
      text-align: left;
      transition: background .15s ease;
    }

    .collab-result:hover { background: rgba(37, 99, 235, .08); }
    .collab-result mat-icon { font-size: 18px; width: 18px; height: 18px; color: #2563eb; }
    .cr-name { font-weight: 600; font-size: 13px; }
    .cr-email { font-size: 12px; color: #888; margin-left: auto; }

    .collab-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .collab-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px 4px 12px;
      background: rgba(37, 99, 235, .1);
      color: #1e40af;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 600;
    }

    .collab-chip mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      cursor: pointer;
    }
  `]
})
export class CreateDocumentDialogComponent {
  title = '';
  description = '';
  isPublic = false;
  isEdit = false;
  documentType: 'doc' | 'sheet' = 'doc';

  userSearch = '';
  searchResults: DocumentUser[] = [];
  selectedCollaborators: DocumentUser[] = [];
  private searchDebounce?: any;

  constructor(
    public dialogRef: MatDialogRef<CreateDocumentDialogComponent>,
    private docsService: CollaborativeDocsService,
    @Inject(MAT_DIALOG_DATA) public data: (CollaborativeDocument & { documentType?: string }) | { documentType?: string } | null
  ) {
    if (data && 'title' in data && data.title) {
      this.title = data.title;
      this.description = data.description || '';
      this.isPublic = data.isPublic;
      this.isEdit = true;
    }
    this.documentType = (data as any)?.documentType === 'sheet' ? 'sheet' : 'doc';
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onUserSearch(term: string): void {
    clearTimeout(this.searchDebounce);
    const q = (term || '').trim();
    if (q.length < 2) { this.searchResults = []; return; }
    this.searchDebounce = setTimeout(() => {
      this.docsService.searchUsers(q).subscribe({
        next: (users) => {
          const chosen = new Set(this.selectedCollaborators.map(u => u.id));
          this.searchResults = users.filter(u => !chosen.has(u.id)).slice(0, 8);
        },
        error: () => { this.searchResults = []; }
      });
    }, 250);
  }

  addCollaborator(u: DocumentUser): void {
    if (!this.selectedCollaborators.some(x => x.id === u.id)) {
      this.selectedCollaborators.push(u);
    }
    this.userSearch = '';
    this.searchResults = [];
  }

  removeCollaborator(u: DocumentUser): void {
    this.selectedCollaborators = this.selectedCollaborators.filter(x => x.id !== u.id);
  }

  onSubmit(): void {
    this.dialogRef.close({
      title: this.title.trim(),
      description: this.description.trim() || undefined,
      isPublic: this.isPublic,
      collaboratorIds: this.selectedCollaborators.map(u => u.id)
    });
  }
}
