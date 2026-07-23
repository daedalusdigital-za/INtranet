import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { DocumentsService, SharedItem, DocumentFile } from '../../services/documents.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-shared-with-me',
  standalone: true,
  imports: [
    CommonModule, MatButtonModule, MatIconModule, MatTooltipModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatMenuModule, NavbarComponent
  ],
  template: `
    <app-navbar></app-navbar>

    <div class="hub-container">
      <div class="header-section">
        <div class="header-top">
          <div class="breadcrumb-nav">
            <button mat-icon-button class="back-btn" (click)="onBack()" matTooltip="Back">
              <mat-icon>arrow_back</mat-icon>
            </button>
            <div class="breadcrumb-trail">
              <span class="dept-name" (click)="exitFolder()">
                <mat-icon>folder_shared</mat-icon>
                Shared with Me
              </span>
              @if (activeShare) {
                <mat-icon class="separator">chevron_right</mat-icon>
                <span class="crumb" (click)="goToShareRoot()">{{ activeShare.name }}</span>
                @for (crumb of breadcrumbs; track crumb; let i = $index) {
                  <mat-icon class="separator">chevron_right</mat-icon>
                  <span class="crumb" (click)="navigateToBreadcrumb(i)">{{ crumb }}</span>
                }
              }
            </div>
          </div>
        </div>
      </div>

      <div class="files-container">
        @if (isLoading) {
          <div class="loading-state"><mat-spinner diameter="48"></mat-spinner></div>
        }

        <!-- Top level: list of shared items -->
        @if (!isLoading && !activeShare) {
          @if (sharedItems.length === 0) {
            <div class="empty-state">
              <mat-icon>folder_off</mat-icon>
              <h2>Nothing shared with you yet</h2>
              <p>When a colleague shares a file or folder, it will appear here.</p>
            </div>
          } @else {
            <div class="files-grid">
              @for (item of sharedItems; track item.id) {
                <div class="file-card" [class.folder]="item.isFolder" (click)="openShare(item)">
                  <div class="file-icon-wrapper" [class]="item.fileType">
                    <mat-icon>{{ item.icon }}</mat-icon>
                  </div>
                  <div class="file-details">
                    <span class="file-name" [matTooltip]="item.name">{{ item.name }}</span>
                    <span class="file-meta">
                      From {{ item.sourceDepartment }} · {{ item.sharedByName || 'Unknown' }}
                    </span>
                    @if (item.note) { <span class="file-note">"{{ item.note }}"</span> }
                  </div>
                  <button mat-icon-button class="file-menu-btn" [matMenuTriggerFor]="menu"
                          (click)="$event.stopPropagation()">
                    <mat-icon>more_vert</mat-icon>
                  </button>
                  <mat-menu #menu="matMenu">
                    <button mat-menu-item (click)="openShare(item)">
                      <mat-icon>{{ item.isFolder ? 'folder_open' : 'download' }}</mat-icon>
                      <span>{{ item.isFolder ? 'Open' : 'Download' }}</span>
                    </button>
                    @if (canRemove(item)) {
                      <button mat-menu-item (click)="removeShare(item)">
                        <mat-icon>link_off</mat-icon>
                        <span>Remove share</span>
                      </button>
                    }
                  </mat-menu>
                </div>
              }
            </div>
          }
        }

        <!-- Inside a shared folder -->
        @if (!isLoading && activeShare) {
          @if (files.length === 0) {
            <div class="empty-state">
              <mat-icon>folder_open</mat-icon>
              <h2>This folder is empty</h2>
            </div>
          } @else {
            <div class="files-grid">
              @for (file of files; track file.path) {
                <div class="file-card" [class.folder]="file.isFolder"
                     (click)="onFileClick(file)">
                  <div class="file-icon-wrapper" [class]="file.fileType">
                    <mat-icon>{{ file.icon }}</mat-icon>
                  </div>
                  <div class="file-details">
                    <span class="file-name" [matTooltip]="file.name">{{ file.name }}</span>
                    <span class="file-meta">
                      {{ file.isFolder ? 'Folder' : formatSize(file.size) }}
                    </span>
                  </div>
                  @if (!file.isFolder) {
                    <button mat-icon-button class="file-menu-btn" (click)="$event.stopPropagation(); downloadFile(file)"
                            matTooltip="Download">
                      <mat-icon>download</mat-icon>
                    </button>
                  }
                </div>
              }
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .hub-container {
      padding: 80px 32px 32px; min-height: 100vh;
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
    .header-section { max-width: 1600px; margin: 0 auto 24px; }
    .header-top { display: flex; align-items: center; margin-bottom: 20px; }
    .breadcrumb-nav { display: flex; align-items: center; gap: 12px; }
    .back-btn { background: rgba(255,255,255,0.1); color: white; }
    .back-btn:hover { background: rgba(255,255,255,0.2); }
    .breadcrumb-trail { display: flex; align-items: center; gap: 8px; color: white; font-size: 18px; }
    .dept-name { display: flex; align-items: center; gap: 8px; font-weight: 600; cursor: pointer;
      padding: 8px 16px; border-radius: 8px; background: rgba(255,255,255,0.1); }
    .separator { color: rgba(255,255,255,0.5); font-size: 20px !important; }
    .crumb { cursor: pointer; padding: 4px 12px; border-radius: 4px; }
    .crumb:hover { background: rgba(255,255,255,0.1); }
    .files-container { max-width: 1600px; margin: 0 auto; }
    .loading-state { display: flex; justify-content: center; padding: 80px; }
    .empty-state { text-align: center; padding: 80px 40px; background: rgba(255,255,255,0.95);
      border-radius: 20px; }
    .empty-state mat-icon { font-size: 100px; width: 100px; height: 100px; color: #e0e0e0; }
    .empty-state h2 { color: #333; margin: 24px 0 8px; }
    .empty-state p { color: #666; }
    .files-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
    .file-card { background: rgba(255,255,255,0.95); border-radius: 16px; padding: 20px; cursor: pointer;
      transition: all 0.3s ease; position: relative; border: 2px solid transparent; }
    .file-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0,0,0,0.25); }
    .file-card.folder { border-left: 4px solid #ffc107; }
    .file-icon-wrapper { width: 64px; height: 64px; margin: 0 auto 16px; display: flex;
      align-items: center; justify-content: center; border-radius: 16px; background: #f5f5f5; }
    .file-icon-wrapper mat-icon { font-size: 36px; width: 36px; height: 36px; }
    .file-icon-wrapper.folder { background: #fff8e1; } .file-icon-wrapper.folder mat-icon { color: #ffc107; }
    .file-icon-wrapper.pdf { background: #ffebee; } .file-icon-wrapper.pdf mat-icon { color: #e53935; }
    .file-icon-wrapper.word { background: #e3f2fd; } .file-icon-wrapper.word mat-icon { color: #1976d2; }
    .file-icon-wrapper.excel { background: #e8f5e9; } .file-icon-wrapper.excel mat-icon { color: #388e3c; }
    .file-icon-wrapper.powerpoint { background: #fff3e0; } .file-icon-wrapper.powerpoint mat-icon { color: #f57c00; }
    .file-icon-wrapper.image { background: #f3e5f5; } .file-icon-wrapper.image mat-icon { color: #7b1fa2; }
    .file-details { text-align: center; }
    .file-name { display: block; font-weight: 500; color: #333; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap; margin-bottom: 4px; }
    .file-meta { font-size: 12px; color: #999; }
    .file-note { display: block; font-size: 12px; color: #1e90ff; font-style: italic; margin-top: 4px; }
    .file-menu-btn { position: absolute; top: 8px; right: 8px; }
  `]
})
export class SharedWithMeComponent implements OnInit {
  sharedItems: SharedItem[] = [];
  isLoading = false;

  activeShare: SharedItem | null = null;
  breadcrumbs: string[] = [];
  files: DocumentFile[] = [];
  private currentUserId = 0;

  constructor(
    private documentsService: DocumentsService,
    private snackBar: MatSnackBar,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const user = this.authService.currentUserValue;
    this.currentUserId = user?.userId ?? 0;
    this.loadShared();
  }

  loadShared(): void {
    this.isLoading = true;
    this.documentsService.getSharedWithMe().subscribe({
      next: (items) => { this.sharedItems = items; this.isLoading = false; },
      error: () => { this.isLoading = false; this.snackBar.open('Failed to load shared items', 'Close', { duration: 3000 }); }
    });
  }

  openShare(item: SharedItem): void {
    if (item.isFolder) {
      this.activeShare = item;
      this.breadcrumbs = [];
      this.loadFiles();
    } else {
      this.documentsService.downloadSharedFile(item.id).subscribe({
        next: (blob) => this.saveBlob(blob, item.name),
        error: () => this.snackBar.open('Download failed', 'Close', { duration: 3000 })
      });
    }
  }

  loadFiles(): void {
    if (!this.activeShare) return;
    this.isLoading = true;
    const subfolder = this.breadcrumbs.length > 0 ? this.breadcrumbs.join('/') : undefined;
    this.documentsService.getSharedFiles(this.activeShare.id, subfolder).subscribe({
      next: (files) => { this.files = files; this.isLoading = false; },
      error: () => { this.isLoading = false; this.snackBar.open('Failed to load folder', 'Close', { duration: 3000 }); }
    });
  }

  onFileClick(file: DocumentFile): void {
    if (file.isFolder) {
      this.breadcrumbs.push(file.name);
      this.loadFiles();
    } else {
      this.downloadFile(file);
    }
  }

  downloadFile(file: DocumentFile): void {
    if (!this.activeShare) return;
    this.documentsService.downloadSharedFile(this.activeShare.id, file.path).subscribe({
      next: (blob) => this.saveBlob(blob, file.name),
      error: () => this.snackBar.open('Download failed', 'Close', { duration: 3000 })
    });
  }

  onBack(): void {
    if (this.activeShare && this.breadcrumbs.length > 0) {
      this.breadcrumbs.pop();
      this.loadFiles();
    } else if (this.activeShare) {
      this.exitFolder();
    } else {
      this.router.navigate(['/documents']);
    }
  }

  exitFolder(): void {
    this.activeShare = null;
    this.breadcrumbs = [];
    this.files = [];
  }

  goToShareRoot(): void {
    this.breadcrumbs = [];
    this.loadFiles();
  }

  navigateToBreadcrumb(index: number): void {
    this.breadcrumbs = this.breadcrumbs.slice(0, index + 1);
    this.loadFiles();
  }

  canRemove(item: SharedItem): boolean {
    return item.sharedByUserId === this.currentUserId;
  }

  removeShare(item: SharedItem): void {
    if (!confirm(`Remove sharing of "${item.name}"?`)) return;
    this.documentsService.unshare(item.id).subscribe({
      next: () => { this.snackBar.open('Share removed', 'Close', { duration: 3000 }); this.loadShared(); },
      error: () => this.snackBar.open('Failed to remove share', 'Close', { duration: 3000 })
    });
  }

  formatSize(bytes: number): string {
    return this.documentsService.formatFileSize(bytes);
  }

  private saveBlob(blob: Blob, name: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
