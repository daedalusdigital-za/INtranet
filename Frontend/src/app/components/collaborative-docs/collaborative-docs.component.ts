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
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { CollaborativeDocsService } from '../../services/collaborative-docs.service';
import { CollaborativeDocument, CreateDocumentDto, DocumentUser } from '../../models/collaborative-doc.model';
import * as mammoth from 'mammoth';
import { ConfirmService } from '../../ui/confirm.service';
import { ToastService } from '../../ui/toast.service';
import { SkeletonRowsComponent } from '../../ui/skeleton-rows/skeleton-rows.component';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state.component';

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
    NavbarComponent,
    PageHeaderComponent,
    SkeletonRowsComponent,
    EmptyStateComponent
  ],
  template: `
    <app-navbar></app-navbar>
    
    <div class="docs-container">
      <div class="docs-content">
        <app-page-header class="docs-header" [crumbs]="['Tools', 'Docs']" title="Docs"
                         subtitle="Documents and spreadsheets you edit together with your team">
          <button mat-stroked-button (click)="triggerImport()">
            <mat-icon>upload_file</mat-icon>
            Import
          </button>
          <button mat-stroked-button (click)="openCreateDialog('sheet')">
            <mat-icon>table_chart</mat-icon>
            New spreadsheet
          </button>
          <button mat-flat-button color="primary" (click)="openCreateDialog('doc')">
            <mat-icon>add</mat-icon>
            New document
          </button>
          <input #importInput type="file" hidden
                 accept=".csv,.txt,.html,.htm,.md,.doc,.docx"
                 (change)="onImportFilePicked($event)">
        </app-page-header>

        @if (loading) {
          <div class="loading-state">
            <app-skeleton-rows [rows]="5"></app-skeleton-rows>
          </div>
        } @else if (documents.length === 0) {
          <div class="empty-wrap">
            <app-empty-state icon="article" title="No documents yet"
                             message="Create your first collaborative document or spreadsheet to get started.">
              <button mat-flat-button color="primary" (click)="openCreateDialog('doc')">
                <mat-icon>add</mat-icon>
                Create document
              </button>
              <button mat-stroked-button (click)="openCreateDialog('sheet')">
                <mat-icon>table_chart</mat-icon>
                Create spreadsheet
              </button>
            </app-empty-state>
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
                <button aria-label="More actions" mat-icon-button [matMenuTriggerFor]="docMenu" class="doc-menu-btn" 
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
      background: var(--color-canvas);
      overflow-x: hidden;
    }

    .docs-header {
      margin-bottom: var(--space-5);
    }

    .sheet-card .doc-icon { background: var(--color-cat-teal-soft); }
    .sheet-card .doc-icon mat-icon { color: var(--color-cat-teal); }

    .docs-content {
      padding: var(--space-5) var(--space-8) var(--space-6);
      max-width: 1400px;
      margin: 0 auto;
    }

    .loading-state, .empty-wrap {
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      overflow: hidden;
    }

    .docs-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 24px;
    }

    .doc-card {
      position: relative;
      padding: 24px;
      border-radius: var(--radius-lg);
      border: 1px solid var(--color-line);
      box-shadow: var(--shadow-sm);
      cursor: pointer;
      transition: all 0.3s ease;
      background: var(--color-surface);
    }

    .doc-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
    }

    .doc-icon {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-md);
      background: var(--color-primary-soft);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
    }

    .doc-icon mat-icon {
      color: var(--color-primary);
      font-size: 24px;
    }

    .doc-content h3 {
      margin: 0 0 8px 0;
      font-size: var(--text-xl);
      font-weight: 600;
      color: var(--color-text);
    }

    .doc-description {
      margin: 0 0 16px 0;
      color: var(--color-text-2);
      font-size: var(--text-md);
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
      font-size: var(--text-xs);
      color: var(--color-text-3);
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
      --mdc-chip-elevated-container-color: var(--color-primary-soft);
      --mdc-chip-label-text-color: var(--color-primary);
    }

    .role-editor {
      --mdc-chip-elevated-container-color: var(--color-cat-teal-soft);
      --mdc-chip-label-text-color: var(--color-cat-teal);
    }

    .role-viewer {
      --mdc-chip-elevated-container-color: var(--color-cat-amber-soft);
      --mdc-chip-label-text-color: var(--color-cat-amber);
    }

    .collaborator-count {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: var(--text-xs);
      color: var(--color-text-3);
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
      --mat-menu-item-label-text-color: var(--color-danger);
      --mat-menu-item-icon-color: var(--color-danger);
    }

    @media (max-width: 768px) {
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

  constructor(
    private docsService: CollaborativeDocsService,
    private router: Router,
    private dialog: MatDialog,
    private toast: ToastService,
    private readonly confirmDialog: ConfirmService
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
        this.toast.error('Failed to load documents');
        this.loading = false;
      }
    });
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
      this.toast.error('Could not import that file');
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
        this.toast.info('Importing…');
        this.router.navigate([documentType === 'sheet' ? '/sheets' : '/docs', doc.id]);
      },
      error: (err) => {
        console.error('Error creating document for import:', err);
        this.toast.error('Failed to import');
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
              this.toast.done(`${label} created`);
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
            this.toast.error('Failed to create');
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
            this.toast.done('Document updated');
            this.loadDocuments();
          },
          error: (err) => {
            console.error('Error updating document:', err);
            this.toast.error('Failed to update document');
          }
        });
      }
    });
  }

  async deleteDocument(doc: CollaborativeDocument): Promise<void> {
    if (await this.confirmDialog.ask({
      title: `Delete "${doc.title}"?`,
      confirmText: 'Delete document',
      danger: true
    })) {
      this.docsService.deleteDocument(doc.id).subscribe({
        next: () => {
          this.toast.done('Document deleted');
          this.loadDocuments();
        },
        error: (err) => {
          console.error('Error deleting document:', err);
          this.toast.error('Failed to delete document');
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
      border-top: 1px solid var(--color-line);
      padding-top: 16px;
    }

    .collab-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--color-text-2);
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
      border: 1px solid var(--color-line);
      border-radius: var(--radius-control);
      background: var(--color-surface);
      color: var(--color-text);
      cursor: pointer;
      text-align: left;
      transition: background .15s ease;
    }

    .collab-result:hover { background: var(--color-primary-soft); }
    .collab-result mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--color-primary); }
    .cr-name { font-weight: 600; font-size: var(--text-sm); }
    .cr-email { font-size: var(--text-xs); color: var(--color-text-3); margin-left: auto; }

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
      background: var(--color-primary-soft);
      color: var(--color-primary);
      border-radius: 16px;
      font-size: var(--text-xs);
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
