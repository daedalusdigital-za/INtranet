import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { DocumentsService, SharedItem, DocumentFile } from '../../services/documents.service';
import { AuthService } from '../../services/auth.service';
import { ConfirmService } from '../../ui/confirm.service';
import { ToastService } from '../../ui/toast.service';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state.component';
import { SkeletonRowsComponent } from '../../ui/skeleton-rows/skeleton-rows.component';

@Component({
  selector: 'app-shared-with-me',
  standalone: true,
  imports: [
    CommonModule, MatButtonModule, MatIconModule, MatTooltipModule,
    MatMenuModule, NavbarComponent, EmptyStateComponent, SkeletonRowsComponent
  ],
  template: `
    <app-navbar></app-navbar>

    <div class="hub-container">
      <div class="header-section">
        <div class="header-top">
          <div class="breadcrumb-nav">
            <button aria-label="Back" mat-icon-button class="back-btn" (click)="onBack()" matTooltip="Back">
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
          <div class="loading-state"><app-skeleton-rows [rows]="6" [avatar]="false"></app-skeleton-rows></div>
        }

        <!-- Top level: list of shared items -->
        @if (!isLoading && !activeShare) {
          @if (sharedItems.length === 0) {
            <app-empty-state icon="folder_off" title="Nothing shared with you yet"
                             message="When a colleague shares a file or folder, it will appear here."></app-empty-state>
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
                  <button aria-label="More actions" mat-icon-button class="file-menu-btn" [matMenuTriggerFor]="menu"
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
            <app-empty-state icon="folder_open" title="This folder is empty"></app-empty-state>
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
                    <button aria-label="Download" mat-icon-button class="file-menu-btn" (click)="$event.stopPropagation(); downloadFile(file)"
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
      background: var(--color-canvas);
      overflow-x: hidden;
    }
    .header-section { max-width: 1600px; margin: 0 auto 24px; }
    .header-top { display: flex; align-items: center; margin-bottom: 20px; }
    .breadcrumb-nav { display: flex; align-items: center; gap: 12px; }
    .back-btn { background: var(--color-surface-2); color: var(--color-text-2); }
    .back-btn:hover { background: var(--color-surface-3); }
    .breadcrumb-trail { display: flex; align-items: center; gap: 8px; color: var(--color-text); font-size: var(--text-xl); }
    .dept-name { display: flex; align-items: center; gap: 8px; font-weight: 600; cursor: pointer;
      padding: 8px 16px; border-radius: var(--radius-control); background: var(--color-surface); border: 1px solid var(--color-line); }
    .separator { color: var(--color-text-3); font-size: var(--text-2xl); }
    .crumb { cursor: pointer; padding: 4px 12px; border-radius: var(--radius-sm); }
    .crumb:hover { background: var(--color-surface-2); }
    .files-container { max-width: 1600px; margin: 0 auto; }
    .loading-state { background: var(--color-surface); border: 1px solid var(--color-line);
      border-radius: var(--radius-lg); overflow: hidden; }
    .files-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
    .file-card { background: var(--color-surface); border-radius: var(--radius-lg); padding: 20px; cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease; position: relative; border: 1px solid var(--color-line); }
    .file-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
    .file-card.folder { border-left: 4px solid var(--color-cat-amber); }
    .file-icon-wrapper { width: 64px; height: 64px; margin: 0 auto 16px; display: flex;
      align-items: center; justify-content: center; border-radius: var(--radius-lg); background: var(--color-surface-2); }
    .file-icon-wrapper mat-icon { font-size: var(--text-4xl); width: 32px; height: 32px; }
    .file-icon-wrapper.folder { background: var(--color-cat-amber-soft); } .file-icon-wrapper.folder mat-icon { color: var(--color-cat-amber); }
    .file-icon-wrapper.pdf { background: var(--color-cat-pink-soft); } .file-icon-wrapper.pdf mat-icon { color: var(--color-cat-pink); }
    .file-icon-wrapper.word { background: var(--color-primary-soft); } .file-icon-wrapper.word mat-icon { color: var(--color-primary); }
    .file-icon-wrapper.excel { background: var(--color-cat-teal-soft); } .file-icon-wrapper.excel mat-icon { color: var(--color-cat-teal); }
    .file-icon-wrapper.powerpoint { background: var(--color-cat-amber-soft); } .file-icon-wrapper.powerpoint mat-icon { color: var(--color-cat-amber); }
    .file-icon-wrapper.image { background: var(--color-cat-purple-soft); } .file-icon-wrapper.image mat-icon { color: var(--color-cat-purple); }
    .file-details { text-align: center; }
    .file-name { display: block; font-weight: 500; color: var(--color-text); overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap; margin-bottom: 4px; }
    .file-meta { font-size: var(--text-xs); color: var(--color-text-3); }
    .file-note { display: block; font-size: var(--text-xs); color: var(--color-primary); font-style: italic; margin-top: 4px; }
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
    private toast: ToastService,
    private router: Router,
    private authService: AuthService,
    private readonly confirmDialog: ConfirmService
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
      error: () => { this.isLoading = false; this.toast.error('Failed to load shared items'); }
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
        error: () => this.toast.error('Download failed')
      });
    }
  }

  loadFiles(): void {
    if (!this.activeShare) return;
    this.isLoading = true;
    const subfolder = this.breadcrumbs.length > 0 ? this.breadcrumbs.join('/') : undefined;
    this.documentsService.getSharedFiles(this.activeShare.id, subfolder).subscribe({
      next: (files) => { this.files = files; this.isLoading = false; },
      error: () => { this.isLoading = false; this.toast.error('Failed to load folder'); }
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
      error: () => this.toast.error('Download failed')
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

  async removeShare(item: SharedItem): Promise<void> {
    if (!(await this.confirmDialog.ask({
      title: `Stop sharing "${item.name}"?`,
      confirmText: 'Stop sharing',
      danger: true
    }))) return;
    this.documentsService.unshare(item.id).subscribe({
      next: () => { this.toast.done('Share removed'); this.loadShared(); },
      error: () => this.toast.error('Failed to remove share')
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
