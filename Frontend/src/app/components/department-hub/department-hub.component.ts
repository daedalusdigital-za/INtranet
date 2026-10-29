import { Component, OnInit, HostListener, Inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { DocumentsService, DocumentFile, FolderInfo, DocumentPermissions, DepartmentInfo, ShareUser } from '../../services/documents.service';
import { ConfirmService } from '../../ui/confirm.service';
import { ToastService } from '../../ui/toast.service';
import { SkeletonRowsComponent } from '../../ui/skeleton-rows/skeleton-rows.component';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state.component';
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
    MatSelectModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    NavbarComponent,
    SkeletonRowsComponent,
    EmptyStateComponent
  ],
  template: `
    <app-navbar></app-navbar>

    <div class="hub-container">
      <!-- Modern Header -->
      <div class="header-section">
        <div class="header-top">
          <div class="breadcrumb-nav">
            <button aria-label="Back to Documents" mat-icon-button class="back-btn" routerLink="/documents" matTooltip="Back to Documents">
              <mat-icon>arrow_back</mat-icon>
            </button>
            @if (breadcrumbs.length > 0) {
              <button aria-label="Up one level" mat-icon-button class="back-btn" (click)="navigateUp()" matTooltip="Up one level">
                <mat-icon>arrow_upward</mat-icon>
              </button>
            }
            <div class="breadcrumb-trail">
              <span class="dept-name" (click)="navigateToRoot()">
                <mat-icon>folder_special</mat-icon>
                {{ departmentName }}
              </span>
              @for (crumb of breadcrumbs; track crumb; let i = $index) {
                <mat-icon class="separator">chevron_right</mat-icon>
                <span class="crumb" (click)="navigateToBreadcrumb(i)">{{ crumb }}</span>
              }
            </div>
          </div>

          <div class="header-stats">
            <div class="stat-chip">
              <mat-icon>folder</mat-icon>
              <span>{{ folderCount }} Folders</span>
            </div>
            <div class="stat-chip">
              <mat-icon>insert_drive_file</mat-icon>
              <span>{{ fileCount }} Files</span>
            </div>
          </div>
        </div>

        <div class="toolbar">
          <div class="search-box">
            <mat-icon>search</mat-icon>
            <input type="text" placeholder="Search files and folders..." 
                   [(ngModel)]="searchQuery" 
                   (input)="onSearch()"
                   (keyup.escape)="clearSearch()">
            @if (searchQuery) {
              <button aria-label="Close" mat-icon-button (click)="clearSearch()" class="clear-btn">
                <mat-icon>close</mat-icon>
              </button>
            }
          </div>

          <div class="toolbar-actions">
            <div class="view-toggle">
              <button aria-label="Grid View" mat-icon-button [class.active]="viewMode === 'grid'" (click)="viewMode = 'grid'" matTooltip="Grid View">
                <mat-icon>grid_view</mat-icon>
              </button>
              <button aria-label="List View" mat-icon-button [class.active]="viewMode === 'list'" (click)="viewMode = 'list'" matTooltip="List View">
                <mat-icon>view_list</mat-icon>
              </button>
            </div>

            <div class="action-buttons">
              <button mat-flat-button color="primary" (click)="fileInput.click()">
                <mat-icon>cloud_upload</mat-icon>
                Upload Files
              </button>
              <input type="file" #fileInput hidden multiple (change)="onFileSelected($event)">

              <button mat-stroked-button (click)="showNewFolderDialog()">
                <mat-icon>create_new_folder</mat-icon>
                New Folder
              </button>

              <button aria-label="More Options" mat-icon-button [matMenuTriggerFor]="moreMenu" matTooltip="More Options">
                <mat-icon>more_vert</mat-icon>
              </button>
              <mat-menu #moreMenu="matMenu">
                <button mat-menu-item (click)="selectAll()">
                  <mat-icon>select_all</mat-icon>
                  <span>Select All</span>
                </button>
                @if (selectedFiles.length > 0) {
                  <button mat-menu-item (click)="deselectAll()">
                    <mat-icon>deselect</mat-icon>
                    <span>Deselect All</span>
                  </button>
                }
                <button mat-menu-item (click)="loadFiles()">
                  <mat-icon>refresh</mat-icon>
                  <span>Refresh</span>
                </button>
              </mat-menu>
            </div>
          </div>
        </div>

        <!-- Selection Actions Bar -->
        @if (selectedFiles.length > 0) {
          <div class="selection-bar">
            <span class="selection-count">{{ selectedFiles.length }} item(s) selected</span>
            <div class="selection-actions">
              <button mat-button (click)="moveSelectedFiles()">
                <mat-icon>drive_file_move</mat-icon>
                Move
              </button>
              <button mat-button color="warn" (click)="deleteSelectedFiles()">
                <mat-icon>delete</mat-icon>
                Delete
              </button>
              <button mat-button (click)="deselectAll()">
                <mat-icon>close</mat-icon>
                Cancel
              </button>
            </div>
          </div>
        }
      </div>

      <!-- Upload Progress -->
      @if (isUploading) {
        <div class="upload-progress-bar">
          <div class="upload-info">
            <mat-icon>cloud_upload</mat-icon>
            <span>Uploading {{ uploadingFileName }}...</span>
          </div>
          <mat-progress-bar mode="determinate" [value]="uploadProgress"></mat-progress-bar>
        </div>
      }

      <!-- New Folder Dialog Inline -->
      @if (showNewFolder) {
        <div class="new-folder-card">
          <mat-icon class="folder-icon">create_new_folder</mat-icon>
          <mat-form-field appearance="outline" class="folder-input">
            <mat-label>Folder Name</mat-label>
            <input matInput [(ngModel)]="newFolderName" (keyup.enter)="createFolder()">
          </mat-form-field>
          <button mat-flat-button color="primary" (click)="createFolder()">Create</button>
          <button mat-button (click)="showNewFolder = false">Cancel</button>
        </div>
      }

      <!-- Files Container -->
      <div class="files-container">
        <!-- Empty State -->
        @if (files.length === 0 && !isLoading) {
          <div class="empty-panel">
            @if (searchQuery) {
              <app-empty-state icon="search_off" [title]="'Nothing matches ' + searchQuery"
                message="No files or folders in this department match the search.">
                <button mat-stroked-button (click)="clearSearch()">Clear the search</button>
              </app-empty-state>
            } @else {
              <app-empty-state icon="folder_open" title="This folder is empty"
                message="Upload files or create folders to get started">
                <button mat-flat-button color="primary" (click)="fileInput.click()">
                  <mat-icon>cloud_upload</mat-icon>
                  Upload Files
                </button>
                <button mat-stroked-button (click)="showNewFolderDialog()">
                  <mat-icon>create_new_folder</mat-icon>
                  New Folder
                </button>
              </app-empty-state>
            }
          </div>
        }

        <!-- Loading State -->
        @if (isLoading) {
          <div class="loading-panel">
            <app-skeleton-rows [rows]="6"></app-skeleton-rows>
          </div>
        }

        <!-- Grid View -->
        @if (files.length > 0 && viewMode === 'grid' && !isLoading) {
          <div class="files-grid">
            @for (file of files; track file.path) {
              <div class="file-card"
                   [class.folder]="file.isFolder"
                   [class.selected]="file.selected"
                   (click)="onFileClick($event, file)"
                   (dblclick)="onFileDoubleClick(file)"
                   draggable="true"
                   (dragstart)="onDragStart($event, file)"
                   (dragover)="onDragOver($event, file)"
                   (drop)="onDrop($event, file)">
                
                <div class="file-checkbox" (click)="$event.stopPropagation()">
                  <mat-checkbox [(ngModel)]="file.selected" (change)="onSelectionChange()"></mat-checkbox>
                </div>

                <div class="file-icon-wrapper" [class]="file.fileType">
                  <mat-icon>{{ file.icon }}</mat-icon>
                </div>

                <div class="file-details">
                  <span class="file-name" [matTooltip]="file.name">{{ file.name }}</span>
                  <span class="file-meta">
                    {{ file.isFolder ? 'Folder' : formatSize(file.size) + ' • ' + formatDate(file.lastModified) }}
                  </span>
                </div>

                <button aria-label="More actions" mat-icon-button class="file-menu-btn" [matMenuTriggerFor]="fileMenu" 
                        (click)="$event.stopPropagation()">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #fileMenu="matMenu">
                  @if (file.isFolder) {
                    <button mat-menu-item (click)="openFolder(file)">
                      <mat-icon>folder_open</mat-icon>
                      <span>Open</span>
                    </button>
                  }
                  @if (!file.isFolder && isPreviewable(file.fileType)) {
                    <button mat-menu-item (click)="previewFile(file)">
                      <mat-icon>visibility</mat-icon>
                      <span>Preview</span>
                    </button>
                  }
                  @if (!file.isFolder) {
                    <button mat-menu-item (click)="downloadFile(file)">
                      <mat-icon>download</mat-icon>
                      <span>Download</span>
                    </button>
                  }
                  <mat-divider></mat-divider>
                  <button mat-menu-item (click)="renameFile(file)">
                    <mat-icon>edit</mat-icon>
                    <span>Rename</span>
                  </button>
                  <button mat-menu-item (click)="moveFile(file)">
                    <mat-icon>drive_file_move</mat-icon>
                    <span>Move to...</span>
                  </button>
                  <button mat-menu-item (click)="shareItem(file)">
                    <mat-icon>share</mat-icon>
                    <span>Share</span>
                  </button>
                  <mat-divider></mat-divider>
                  <button mat-menu-item class="delete-option" (click)="deleteFile(file)">
                    <mat-icon>delete</mat-icon>
                    <span>Delete</span>
                  </button>
                </mat-menu>
              </div>
            }
          </div>
        }

        <!-- List View -->
        @if (files.length > 0 && viewMode === 'list' && !isLoading) {
          <div class="files-list">
            <div class="list-header">
              <div class="col-checkbox"></div>
              <div class="col-name">Name</div>
              <div class="col-modified">Modified</div>
              <div class="col-size">Size</div>
              <div class="col-actions"></div>
            </div>
            @for (file of files; track file.path) {
              <div class="list-item"
                   [class.folder]="file.isFolder"
                   [class.selected]="file.selected"
                   (click)="onFileClick($event, file)"
                   (dblclick)="onFileDoubleClick(file)">
                
                <div class="col-checkbox" (click)="$event.stopPropagation()">
                  <mat-checkbox [(ngModel)]="file.selected" (change)="onSelectionChange()"></mat-checkbox>
                </div>

                <div class="col-name">
                  <mat-icon [class]="file.fileType">{{ file.icon }}</mat-icon>
                  <span [matTooltip]="file.name">{{ file.name }}</span>
                </div>

                <div class="col-modified">{{ formatDate(file.lastModified) }}</div>
                <div class="col-size">{{ file.isFolder ? '-' : formatSize(file.size) }}</div>

                <div class="col-actions">
                  <button aria-label="More actions" mat-icon-button [matMenuTriggerFor]="listFileMenu" (click)="$event.stopPropagation()">
                    <mat-icon>more_vert</mat-icon>
                  </button>
                  <mat-menu #listFileMenu="matMenu">
                    @if (file.isFolder) {
                      <button mat-menu-item (click)="openFolder(file)">
                        <mat-icon>folder_open</mat-icon>
                        <span>Open</span>
                      </button>
                    }
                    @if (!file.isFolder && isPreviewable(file.fileType)) {
                      <button mat-menu-item (click)="previewFile(file)">
                        <mat-icon>visibility</mat-icon>
                        <span>Preview</span>
                      </button>
                    }
                    @if (!file.isFolder) {
                      <button mat-menu-item (click)="downloadFile(file)">
                        <mat-icon>download</mat-icon>
                        <span>Download</span>
                      </button>
                    }
                    <mat-divider></mat-divider>
                    <button mat-menu-item (click)="renameFile(file)">
                      <mat-icon>edit</mat-icon>
                      <span>Rename</span>
                    </button>
                    <button mat-menu-item (click)="moveFile(file)">
                      <mat-icon>drive_file_move</mat-icon>
                      <span>Move to...</span>
                    </button>
                    <mat-divider></mat-divider>
                    <button mat-menu-item class="delete-option" (click)="deleteFile(file)">
                      <mat-icon>delete</mat-icon>
                      <span>Delete</span>
                    </button>
                  </mat-menu>
                </div>
              </div>
            }
          </div>
        }
      </div>

      <!-- Drop Zone Overlay -->
      @if (isDraggingOver) {
        <div class="drop-zone-overlay"
             (dragover)="onDragOverZone($event)"
             (dragleave)="isDraggingOver = false"
             (drop)="onDropZone($event)">
          <div class="drop-zone-content">
            <mat-icon>cloud_upload</mat-icon>
            <h2>Drop files here to upload</h2>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .hub-container {
      padding: 80px 32px 32px;
      min-height: 100vh;
      position: relative;
      background: var(--color-canvas);
      overflow-x: hidden;
    }

    .header-section {
      max-width: 1600px;
      margin: 0 auto 24px;
    }

    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .breadcrumb-nav {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .back-btn {
      color: var(--color-text-2);
    }

    .breadcrumb-trail {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--color-text);
      font-size: var(--text-xl);
    }

    .dept-name {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      cursor: pointer;
      padding: 8px 16px;
      border-radius: var(--radius-control);
      background: var(--color-surface-2);
      transition: all 0.2s;
    }

    .dept-name mat-icon {
      color: var(--color-primary);
    }

    .dept-name:hover {
      background: var(--color-surface-3);
    }

    .separator {
      color: var(--color-text-3);
      font-size: 20px;
    }

    .crumb {
      cursor: pointer;
      padding: 4px 12px;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .crumb:hover {
      background: var(--color-surface-2);
    }

    .header-stats {
      display: flex;
      gap: 16px;
    }

    .stat-chip {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: 20px;
      color: var(--color-text-2);
      font-size: var(--text-md);
    }

    .stat-chip mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .toolbar {
      display: flex;
      gap: 16px;
      align-items: center;
      flex-wrap: wrap;
    }

    .search-box {
      flex: 1;
      min-width: 280px;
      max-width: 500px;
      display: flex;
      align-items: center;
      gap: 12px;
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-control);
      padding: 8px 16px;
      box-shadow: var(--shadow-sm);
    }

    .search-box mat-icon {
      color: var(--color-text-2);
    }

    .search-box input {
      flex: 1;
      border: none;
      outline: none;
      font-size: var(--text-md);
      color: var(--color-text);
      background: transparent;
    }

    .clear-btn {
      width: 28px;
      height: 28px;
      line-height: 28px;
    }

    .clear-btn mat-icon {
      font-size: 18px;
    }

    .toolbar-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .view-toggle {
      display: flex;
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-control);
      padding: 4px;
    }

    .view-toggle button {
      color: var(--color-text-3);
    }

    .view-toggle button.active {
      background: var(--color-primary-soft);
      color: var(--color-primary);
    }

    .action-buttons {
      display: flex;
      gap: 8px;
    }

    .selection-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--color-primary-soft);
      padding: 8px 20px;
      border-radius: var(--radius-md);
      margin-top: 16px;
      color: var(--color-text);
    }

    .selection-count {
      font-weight: 600;
      color: var(--color-primary);
    }

    .upload-progress-bar {
      max-width: 1600px;
      margin: 0 auto 16px;
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-md);
      padding: 16px 20px;
      box-shadow: var(--shadow-sm);
    }

    .upload-info {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
      color: var(--color-text);
    }

    .upload-info mat-icon {
      color: var(--color-primary);
    }

    .new-folder-card {
      max-width: 600px;
      margin: 0 auto 16px;
      display: flex;
      align-items: center;
      gap: 16px;
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      padding: 16px 24px;
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-sm);
    }

    .folder-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      color: var(--color-cat-amber);
    }

    .folder-input {
      flex: 1;
    }

    .folder-input ::ng-deep .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    .files-container {
      max-width: 1600px;
      margin: 0 auto;
    }

    .empty-panel,
    .loading-panel {
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }

    .files-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 16px;
    }

    .file-card {
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      padding: 20px;
      cursor: pointer;
      transition: all 0.3s ease;
      position: relative;
      border: 2px solid var(--color-line);
    }

    .file-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
    }

    .file-card.selected {
      border-color: var(--color-primary);
      background: var(--color-primary-soft);
    }

    .file-card.folder {
      border-left: 4px solid var(--color-cat-amber);
    }

    .file-checkbox {
      position: absolute;
      top: 12px;
      left: 12px;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .file-card:hover .file-checkbox,
    .file-card.selected .file-checkbox {
      opacity: 1;
    }

    .file-icon-wrapper {
      width: 64px;
      height: 64px;
      margin: 0 auto 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-lg);
      background: var(--color-surface-2);
    }

    .file-icon-wrapper mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
    }

    .file-icon-wrapper.folder { background: var(--color-cat-amber-soft); }
    .file-icon-wrapper.folder mat-icon { color: var(--color-cat-amber); }
    .file-icon-wrapper.pdf { background: var(--color-danger-soft); }
    .file-icon-wrapper.pdf mat-icon { color: var(--color-danger); }
    .file-icon-wrapper.word { background: var(--color-primary-soft); }
    .file-icon-wrapper.word mat-icon { color: var(--color-primary); }
    .file-icon-wrapper.excel { background: var(--color-ok-soft); }
    .file-icon-wrapper.excel mat-icon { color: var(--color-ok); }
    .file-icon-wrapper.powerpoint { background: var(--color-warn-soft); }
    .file-icon-wrapper.powerpoint mat-icon { color: var(--color-warn); }
    .file-icon-wrapper.image { background: var(--color-cat-purple-soft); }
    .file-icon-wrapper.image mat-icon { color: var(--color-cat-purple); }

    .file-details {
      text-align: center;
    }

    .file-name {
      display: block;
      font-weight: 500;
      color: var(--color-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-bottom: 4px;
    }

    .file-meta {
      font-size: var(--text-xs);
      color: var(--color-text-3);
    }

    .file-menu-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      opacity: 0.55;
      transition: opacity 0.2s;
    }

    .file-card:hover .file-menu-btn {
      opacity: 1;
    }

    .files-list {
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }

    .list-header {
      display: grid;
      grid-template-columns: 48px 1fr 150px 100px 48px;
      gap: 16px;
      padding: 12px 20px;
      background: var(--color-surface-2);
      border-bottom: 1px solid var(--color-line);
      font-weight: 600;
      color: var(--color-text-3);
      font-size: var(--text-xs);
      text-transform: uppercase;
    }

    .list-item {
      display: grid;
      grid-template-columns: 48px 1fr 150px 100px 48px;
      gap: 16px;
      padding: var(--row-pad-y) 20px;
      align-items: center;
      border-bottom: 1px solid var(--color-line);
      cursor: pointer;
      transition: background 0.2s;
    }

    .list-item:hover {
      background: var(--color-canvas);
    }

    .list-item.selected {
      background: var(--color-primary-soft);
    }

    .list-item:last-child {
      border-bottom: none;
    }

    .col-name {
      display: flex;
      align-items: center;
      gap: 12px;
      overflow: hidden;
    }

    .col-name mat-icon {
      flex-shrink: 0;
    }

    .col-name mat-icon.folder { color: var(--color-cat-amber); }
    .col-name mat-icon.pdf { color: var(--color-danger); }
    .col-name mat-icon.word { color: var(--color-primary); }
    .col-name mat-icon.excel { color: var(--color-ok); }
    .col-name mat-icon.powerpoint { color: var(--color-warn); }
    .col-name mat-icon.image { color: var(--color-cat-purple); }

    .col-name span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .col-modified, .col-size {
      color: var(--color-text-2);
      font-size: var(--text-md);
    }

    .delete-option {
      --mat-menu-item-label-text-color: var(--color-danger);
      --mat-menu-item-icon-color: var(--color-danger);
    }

    .delete-option mat-icon {
      color: var(--color-danger);
    }

    .drop-zone-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--color-scrim);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .drop-zone-content {
      text-align: center;
      color: var(--color-text);
      background: var(--color-surface);
      border: 2px dashed var(--color-primary);
      border-radius: var(--radius-lg);
      padding: 48px 64px;
      box-shadow: var(--shadow-lg);
      pointer-events: none;
    }

    .drop-zone-content mat-icon {
      font-size: 80px;
      width: 80px;
      height: 80px;
      margin-bottom: 16px;
      color: var(--color-primary);
    }

    .drop-zone-content h2 {
      font-size: var(--text-3xl);
      font-weight: 500;
    }

    @media (max-width: 768px) {
      .hub-container {
        padding: 72px 16px 16px;
      }

      .header-top {
        flex-direction: column;
        align-items: flex-start;
        gap: 16px;
      }

      .toolbar {
        flex-direction: column;
        align-items: stretch;
      }

      .search-box {
        max-width: none;
      }

      .toolbar-actions {
        justify-content: space-between;
      }

      .files-grid {
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      }

      .list-header, .list-item {
        grid-template-columns: 40px 1fr 48px;
      }

      .col-modified, .col-size {
        display: none;
      }
    }
  `]
})
export class DepartmentHubComponent implements OnInit {
  departmentName = '';
  breadcrumbs: string[] = [];
  files: DocumentFile[] = [];
  searchQuery = '';
  isLoading = false;
  isUploading = false;
  uploadProgress = 0;
  uploadingFileName = '';
  showNewFolder = false;
  newFolderName = '';
  viewMode: 'grid' | 'list' = 'grid';
  isDraggingOver = false;
  permissions: DocumentPermissions | null = null;

  @ViewChild('fileInput') fileInput!: ElementRef;

  get selectedFiles(): DocumentFile[] {
    return this.files.filter(f => f.selected);
  }

  get folderCount(): number {
    return this.files.filter(f => f.isFolder).length;
  }

  get fileCount(): number {
    return this.files.filter(f => !f.isFolder).length;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private documentsService: DocumentsService,
    private toast: ToastService,
    private dialog: MatDialog,
    private sanitizer: DomSanitizer,
    private readonly confirmDialog: ConfirmService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.departmentName = params['department'];
      this.loadFiles();
      this.loadPermissions();
    });

    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer?.types.includes('Files')) {
        this.isDraggingOver = true;
      }
    });
  }

  /**
   * Intercept the browser Back button. When the user is inside a subfolder,
   * a synthetic history state was pushed by openFolder(). Pressing Back
   * consumes that state and fires popstate here, so instead of leaving the
   * department hub (which felt like being logged out), we navigate up one
   * folder level. When already at the department root we let the browser
   * navigate away normally.
   */
  @HostListener('window:popstate')
  onPopState(): void {
    if (this.breadcrumbs.length > 0) {
      this.breadcrumbs.pop();
      this.loadFiles();
    }
  }

  loadPermissions(): void {
    this.documentsService.getPermissions(this.departmentName).subscribe({
      next: (permissions) => this.permissions = permissions
    });
  }

  loadFiles(): void {
    this.isLoading = true;
    const subfolder = this.breadcrumbs.length > 0 ? this.breadcrumbs.join('/') : undefined;
    
    this.documentsService.getFiles(this.departmentName, subfolder).subscribe({
      next: (files) => {
        this.files = files.map(f => ({ ...f, selected: false }));
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading files:', error);
        this.toast.error('Failed to load files');
        this.isLoading = false;
      }
    });
  }

  onSearch(): void {
    if (this.searchQuery.length > 2) {
      this.documentsService.searchFiles(this.departmentName, this.searchQuery).subscribe({
        next: (files) => this.files = files.map(f => ({ ...f, selected: false }))
      });
    } else if (this.searchQuery.length === 0) {
      this.loadFiles();
    }
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.loadFiles();
  }

  onFileClick(event: MouseEvent, file: DocumentFile): void {
    if (event.ctrlKey || event.metaKey) {
      file.selected = !file.selected;
    } else if (!event.shiftKey) {
      this.files.forEach(f => f.selected = false);
      file.selected = true;
    }
  }

  onFileDoubleClick(file: DocumentFile): void {
    if (file.isFolder) {
      this.openFolder(file);
    } else if (this.isPreviewable(file.fileType)) {
      this.previewFile(file);
    } else {
      this.downloadFile(file);
    }
  }

  onSelectionChange(): void {}

  selectAll(): void {
    this.files.forEach(f => f.selected = true);
  }

  deselectAll(): void {
    this.files.forEach(f => f.selected = false);
  }

  openFolder(file: DocumentFile): void {
    this.breadcrumbs.push(file.name);
    // Push a synthetic history entry so the browser Back button navigates
    // up one folder (handled in onPopState) instead of leaving the module.
    history.pushState({ folderDepth: this.breadcrumbs.length }, '');
    this.loadFiles();
  }

  /** Go up one folder level, keeping browser history in sync. */
  navigateUp(): void {
    if (this.breadcrumbs.length > 0) {
      // Triggers onPopState which pops the breadcrumb and reloads.
      history.back();
    }
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
    event.target.value = '';
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
          this.toast.done(`Uploaded ${file.name}`);
          this.loadFiles();
        }
      },
      error: (error) => {
        console.error('Upload error:', error);
        this.isUploading = false;
        this.toast.error('Upload failed');
      }
    });
  }

  showNewFolderDialog(): void {
    this.showNewFolder = true;
    this.newFolderName = '';
  }

  createFolder(): void {
    if (!this.newFolderName.trim()) {
      this.toast.warn('Please enter a folder name');
      return;
    }

    const parentPath = this.breadcrumbs.length > 0 ? this.breadcrumbs.join('/') : undefined;

    this.documentsService.createFolder(this.departmentName, this.newFolderName, parentPath).subscribe({
      next: () => {
        this.showNewFolder = false;
        this.toast.done(`Folder "${this.newFolderName}" created`);
        this.loadFiles();
      },
      error: (error) => {
        console.error('Error creating folder:', error);
        this.toast.error('Failed to create folder');
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
      error: () => this.toast.error('Download failed')
    });
  }

  isPreviewable(fileType: string): boolean {
    return this.documentsService.isPreviewable(fileType);
  }

  previewFile(file: DocumentFile): void {
    this.dialog.open(DocumentPreviewDialogComponent, {
      width: '90vw',
      maxWidth: '1200px',
      height: '90vh',
      data: {
        file,
        department: this.departmentName,
        previewUrl: this.documentsService.getPreviewUrl(this.departmentName, file.path)
      }
    });
  }

  renameFile(file: DocumentFile): void {
    const dialogRef = this.dialog.open(RenameDialogComponent, {
      width: '400px',
      data: { currentName: file.name, isFolder: file.isFolder }
    });

    dialogRef.afterClosed().subscribe(newName => {
      if (newName && newName !== file.name) {
        this.documentsService.renameFile(this.departmentName, file.path, newName).subscribe({
          next: () => {
            this.toast.done('Renamed successfully');
            this.loadFiles();
          },
          error: () => this.toast.error('Failed to rename')
        });
      }
    });
  }

  moveFile(file: DocumentFile): void {
    this.dialog.open(MoveDialogComponent, {
      width: '500px',
      data: { file, department: this.departmentName }
    }).afterClosed().subscribe(destinationFolder => {
      if (destinationFolder !== undefined) {
        this.documentsService.moveFile(this.departmentName, file.path, destinationFolder).subscribe({
          next: () => {
            this.toast.done('Moved successfully');
            this.loadFiles();
          },
          error: () => this.toast.error('Failed to move file')
        });
      }
    });
  }

  shareItem(file: DocumentFile): void {
    const subfolder = this.breadcrumbs.length > 0 ? this.breadcrumbs.join('/') : '';
    const sourcePath = subfolder ? `${subfolder}/${file.name}` : file.name;

    this.dialog.open(ShareDialogComponent, {
      width: '480px',
      panelClass: 'modern-dialog',
      data: {
        itemName: file.name,
        isFolder: file.isFolder,
        department: this.departmentName,
        sourcePath
      }
    });
  }

  moveSelectedFiles(): void {
    const selected = this.selectedFiles;
    if (selected.length === 0) return;
    this.dialog.open(MoveDialogComponent, {
      width: '500px',
      data: { files: selected, department: this.departmentName }
    }).afterClosed().subscribe(destinationFolder => {
      if (destinationFolder !== undefined) {
        let completed = 0;
        selected.forEach(file => {
          this.documentsService.moveFile(this.departmentName, file.path, destinationFolder).subscribe({
            next: () => {
              completed++;
              if (completed === selected.length) {
                this.toast.done(`Moved ${completed} items`);
                this.loadFiles();
              }
            }
          });
        });
      }
    });
  }

  async deleteFile(file: DocumentFile): Promise<void> {
    if (await this.confirmDialog.ask({
      title: `Delete "${file.name}"?`,
      confirmText: file.isFolder ? 'Delete folder' : 'Delete file',
      danger: true
    })) {
      this.documentsService.deleteFile(this.departmentName, file.path).subscribe({
        next: () => {
          this.toast.done(`Deleted "${file.name}"`);
          this.loadFiles();
        },
        error: () => this.toast.error('Failed to delete')
      });
    }
  }

  async deleteSelectedFiles(): Promise<void> {
    const selected = this.selectedFiles;
    if (selected.length === 0) return;

    if (await this.confirmDialog.ask({
      title: `Delete ${selected.length} ${selected.length === 1 ? 'item' : 'items'}?`,
      message: 'All selected files and folders are deleted.',
      confirmText: 'Delete items',
      danger: true
    })) {
      let completed = 0;
      selected.forEach(file => {
        this.documentsService.deleteFile(this.departmentName, file.path).subscribe({
          next: () => {
            completed++;
            if (completed === selected.length) {
              this.toast.done(`Deleted ${completed} items`);
              this.loadFiles();
            }
          }
        });
      });
    }
  }

  onDragStart(event: DragEvent, file: DocumentFile): void {
    event.dataTransfer?.setData('text/plain', file.path);
  }

  onDragOver(event: DragEvent, file: DocumentFile): void {
    if (file.isFolder) event.preventDefault();
  }

  onDrop(event: DragEvent, targetFolder: DocumentFile): void {
    event.preventDefault();
    if (!targetFolder.isFolder) return;

    const sourcePath = event.dataTransfer?.getData('text/plain');
    if (sourcePath) {
      const destinationPath = this.breadcrumbs.length > 0 
        ? this.breadcrumbs.join('/') + '/' + targetFolder.name 
        : targetFolder.name;

      this.documentsService.moveFile(this.departmentName, sourcePath, destinationPath).subscribe({
        next: () => {
          this.toast.done('Moved successfully');
          this.loadFiles();
        }
      });
    }
  }

  onDragOverZone(event: DragEvent): void {
    event.preventDefault();
  }

  onDropZone(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingOver = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        this.uploadFile(files[i]);
      }
    }
  }

  formatSize(bytes: number): string {
    return this.documentsService.formatFileSize(bytes);
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString();
  }
}

// Document Preview Dialog
@Component({
  selector: 'app-document-preview-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule],
  template: `
    <div class="preview-dialog">
      <div class="preview-header">
        <div class="file-info">
          <mat-icon [class]="data.file.fileType">{{ data.file.icon }}</mat-icon>
          <span>{{ data.file.name }}</span>
        </div>
        <div class="header-actions">
          <button aria-label="Download" mat-icon-button (click)="download()" matTooltip="Download">
            <mat-icon>download</mat-icon>
          </button>
          <button aria-label="Open in new tab" mat-icon-button (click)="openInNewTab()" matTooltip="Open in new tab">
            <mat-icon>open_in_new</mat-icon>
          </button>
          <button aria-label="Close" mat-icon-button mat-dialog-close matTooltip="Close">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>
      <div class="preview-content">
        @if (isLoading) {
          <div class="loading">
            <mat-spinner diameter="48"></mat-spinner>
            <p>Loading preview...</p>
          </div>
        }

        @if (data.file.fileType === 'pdf' && !isLoading) {
          <iframe [src]="safeUrl" class="pdf-viewer"></iframe>
        }

        @if (data.file.fileType === 'image' && !isLoading) {
          <img [src]="safeUrl" [alt]="data.file.name" class="image-viewer" (load)="isLoading = false">
        }

        @if (isOfficeDoc && !isLoading) {
          <div class="office-notice">
            <mat-icon>description</mat-icon>
            <h3>{{ data.file.name }}</h3>
            <p>Office documents require download to view</p>
            <div class="office-actions">
              <button mat-flat-button color="primary" (click)="download()">
                <mat-icon>download</mat-icon>
                Download to View
              </button>
            </div>
          </div>
        }

        @if ((data.file.fileType === 'text' || data.file.fileType === 'csv') && textContent) {
          <pre class="text-viewer">{{ textContent }}</pre>
        }
      </div>
    </div>
  `,
  styles: [`
    .preview-dialog { display: flex; flex-direction: column; height: 100%; }
    .preview-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-bottom: 1px solid var(--color-line); background: var(--color-canvas); }
    .file-info { display: flex; align-items: center; gap: 12px; font-weight: 500; }
    .file-info mat-icon.pdf { color: var(--color-danger); }
    .file-info mat-icon.word { color: var(--color-primary); }
    .file-info mat-icon.excel { color: var(--color-ok); }
    .file-info mat-icon.image { color: var(--color-cat-purple); }
    .header-actions { display: flex; gap: 8px; }
    .preview-content { flex: 1; overflow: auto; background: var(--color-surface-2); display: flex; align-items: center; justify-content: center; }
    .loading { text-align: center; color: var(--color-text-2); }
    .loading p { margin-top: 16px; }
    .pdf-viewer { width: 100%; height: 100%; border: none; }
    .image-viewer { max-width: 100%; max-height: 100%; object-fit: contain; }
    .office-notice { text-align: center; padding: 40px; background: var(--color-surface); border-radius: var(--radius-md); box-shadow: var(--shadow-md); }
    .office-notice mat-icon { font-size: 64px; width: 64px; height: 64px; color: var(--color-primary); }
    .office-notice h3 { margin: 16px 0 8px; color: var(--color-text); }
    .office-notice p { color: var(--color-text-2); margin-bottom: 24px; }
    .office-actions { display: flex; gap: 12px; justify-content: center; }
    .text-viewer { width: 100%; height: 100%; margin: 0; padding: 24px; background: var(--color-surface); color: var(--color-text); font-family: var(--font-mono); font-size: var(--text-md); overflow: auto; white-space: pre-wrap; word-wrap: break-word; }
  `]
})
export class DocumentPreviewDialogComponent implements OnInit {
  safeUrl: SafeResourceUrl = '';
  isLoading = true;
  textContent = '';

  get isOfficeDoc(): boolean {
    return ['word', 'excel', 'powerpoint'].includes(this.data.file.fileType);
  }

  constructor(
    public dialogRef: MatDialogRef<DocumentPreviewDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { file: DocumentFile; department: string; previewUrl: string },
    private sanitizer: DomSanitizer,
    private documentsService: DocumentsService
  ) {}

  ngOnInit(): void {
    this.loadPreview();
  }

  loadPreview(): void {
    if (this.data.file.fileType === 'pdf' || this.data.file.fileType === 'image') {
      this.documentsService.previewFile(this.data.department, this.data.file.path).subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
          this.isLoading = false;
        },
        error: () => this.isLoading = false
      });
    } else if (this.data.file.fileType === 'text' || this.data.file.fileType === 'csv') {
      this.documentsService.previewFile(this.data.department, this.data.file.path).subscribe({
        next: (blob) => {
          blob.text().then(text => {
            this.textContent = text;
            this.isLoading = false;
          });
        }
      });
    } else {
      this.isLoading = false;
    }
  }

  download(): void {
    this.documentsService.downloadFile(this.data.department, this.data.file.path).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.data.file.name;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  }

  openInNewTab(): void {
    this.documentsService.previewFile(this.data.department, this.data.file.path).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      }
    });
  }
}

// Rename Dialog
@Component({
  selector: 'app-rename-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, FormsModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>edit</mat-icon>
      Rename {{ data.isFolder ? 'Folder' : 'File' }}
    </h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" style="width: 100%;">
        <mat-label>New Name</mat-label>
        <input matInput [(ngModel)]="newName" (keyup.enter)="save()">
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" (click)="save()">Rename</button>
    </mat-dialog-actions>
  `,
  styles: [`h2 { display: flex; align-items: center; gap: 8px; }`]
})
export class RenameDialogComponent {
  newName: string;

  constructor(
    public dialogRef: MatDialogRef<RenameDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { currentName: string; isFolder: boolean }
  ) {
    this.newName = data.currentName;
  }

  save(): void {
    if (this.newName.trim()) {
      this.dialogRef.close(this.newName.trim());
    }
  }
}

// Move Dialog
@Component({
  selector: 'app-move-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatFormFieldModule, MatSelectModule, MatButtonModule, MatIconModule, SkeletonRowsComponent],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>drive_file_move</mat-icon>
      Move to Folder
    </h2>
    <mat-dialog-content>
      <p class="move-info">Select destination folder:</p>
      
      @if (isLoading) {
        <app-skeleton-rows [rows]="3" [avatar]="false"></app-skeleton-rows>
      }

      @if (!isLoading) {
        <mat-form-field appearance="outline" style="width: 100%;">
          <mat-label>Destination Folder</mat-label>
          <mat-select [(value)]="selectedFolder">
            @for (folder of folders; track folder.path) {
              <mat-option [value]="folder.path">{{ folder.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="selectedFolder === undefined" (click)="move()">
        <mat-icon>drive_file_move</mat-icon>
        Move Here
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 { display: flex; align-items: center; gap: 8px; }
    .move-info { color: var(--color-text-2); margin-bottom: 16px; }
  `]
})
export class MoveDialogComponent implements OnInit {
  folders: FolderInfo[] = [];
  selectedFolder?: string;
  isLoading = true;

  constructor(
    public dialogRef: MatDialogRef<MoveDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { file?: DocumentFile; files?: DocumentFile[]; department: string },
    private documentsService: DocumentsService
  ) {}

  ngOnInit(): void {
    this.documentsService.getFolders(this.data.department).subscribe({
      next: (folders) => {
        this.folders = folders;
        this.isLoading = false;
      },
      error: () => this.isLoading = false
    });
  }

  move(): void {
    if (this.selectedFolder !== undefined) {
      this.dialogRef.close(this.selectedFolder);
    }
  }
}

// Share Dialog
@Component({
  selector: 'app-share-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule, SkeletonRowsComponent
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>share</mat-icon>
      Share "{{ data.itemName }}"
    </h2>
    <mat-dialog-content>
      <p class="share-info">
        {{ data.isFolder ? 'Folder' : 'File' }} will appear in the recipient's
        <strong>Shared with Me</strong> hub. The original is not moved or copied.
      </p>

      <div class="mode-toggle">
        <button type="button" [class.active]="mode === 'Department'" (click)="mode = 'Department'">
          <mat-icon>groups</mat-icon> Department
        </button>
        <button type="button" [class.active]="mode === 'User'" (click)="mode = 'User'">
          <mat-icon>person</mat-icon> Person
        </button>
      </div>

      @if (mode === 'Department') {
        <mat-form-field appearance="outline" style="width: 100%;">
          <mat-label>Share with department</mat-label>
          <mat-select [(value)]="selectedDepartment">
            @for (dept of departments; track dept.name) {
              <mat-option [value]="dept.name">{{ dept.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      }

      @if (mode === 'User') {
        <mat-form-field appearance="outline" style="width: 100%;">
          <mat-label>Search person by name or email</mat-label>
          <input matInput [(ngModel)]="userSearch" (ngModelChange)="onUserSearch()" placeholder="Start typing...">
        </mat-form-field>
        @if (searchingUsers) {
          <div class="user-list"><app-skeleton-rows [rows]="3"></app-skeleton-rows></div>
        }
        @if (!searchingUsers && users.length > 0) {
          <div class="user-list">
            @for (u of users; track u.userId) {
              <div class="user-row" [class.selected]="selectedUser?.userId === u.userId" (click)="selectedUser = u">
                <mat-icon>account_circle</mat-icon>
                <div class="user-meta">
                  <span class="user-name">{{ u.name }}</span>
                  <span class="user-email">{{ u.email }}</span>
                </div>
                @if (selectedUser?.userId === u.userId) { <mat-icon class="check">check_circle</mat-icon> }
              </div>
            }
          </div>
        }
      }

      <mat-form-field appearance="outline" style="width: 100%;">
        <mat-label>Note (optional)</mat-label>
        <input matInput [(ngModel)]="note" placeholder="Add a short message">
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="!canShare() || sharing" (click)="share()">
        <mat-icon>share</mat-icon>
        Share
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 { display: flex; align-items: center; gap: 8px; }
    .share-info { color: var(--color-text-2); margin-bottom: 16px; font-size: var(--text-md); line-height: 1.5; }
    .mode-toggle { display: flex; gap: 8px; margin-bottom: 16px; }
    .mode-toggle button {
      flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
      padding: 10px; border: 1px solid var(--color-line); border-radius: var(--radius-control); background: var(--color-surface);
      cursor: pointer; color: var(--color-text-2); font-weight: 500; transition: all 0.2s;
    }
    .mode-toggle button.active { background: var(--color-primary); color: var(--color-on-primary); border-color: var(--color-primary); }
    .user-list { max-height: 220px; overflow-y: auto; margin-bottom: 16px; border: 1px solid var(--color-line); border-radius: var(--radius-control); }
    .user-row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; cursor: pointer; border-bottom: 1px solid var(--color-line); }
    .user-row:last-child { border-bottom: none; }
    .user-row:hover { background: var(--color-surface-2); }
    .user-row.selected { background: var(--color-primary-soft); }
    .user-meta { display: flex; flex-direction: column; flex: 1; }
    .user-name { font-weight: 500; color: var(--color-text); }
    .user-email { font-size: var(--text-xs); color: var(--color-text-3); }
    .check { color: var(--color-primary); }
  `]
})
export class ShareDialogComponent implements OnInit {
  mode: 'Department' | 'User' = 'Department';
  departments: DepartmentInfo[] = [];
  selectedDepartment?: string;
  users: ShareUser[] = [];
  selectedUser?: ShareUser;
  userSearch = '';
  searchingUsers = false;
  note = '';
  sharing = false;
  private searchTimer: any;

  constructor(
    public dialogRef: MatDialogRef<ShareDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { itemName: string; isFolder: boolean; department: string; sourcePath: string },
    private documentsService: DocumentsService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.documentsService.getDepartments().subscribe({
      next: (depts) => {
        // Don't offer to share back into the same department
        this.departments = depts.filter(d => d.name !== this.data.department);
      }
    });
  }

  onUserSearch(): void {
    clearTimeout(this.searchTimer);
    if (!this.userSearch || this.userSearch.trim().length < 2) {
      this.users = [];
      return;
    }
    this.searchingUsers = true;
    this.searchTimer = setTimeout(() => {
      this.documentsService.searchShareUsers(this.userSearch.trim()).subscribe({
        next: (users) => { this.users = users; this.searchingUsers = false; },
        error: () => { this.searchingUsers = false; }
      });
    }, 350);
  }

  canShare(): boolean {
    return this.mode === 'Department' ? !!this.selectedDepartment : !!this.selectedUser;
  }

  share(): void {
    if (!this.canShare()) return;
    this.sharing = true;

    this.documentsService.shareItem({
      sourceDepartment: this.data.department,
      sourcePath: this.data.sourcePath,
      shareWithType: this.mode,
      shareWithDepartment: this.mode === 'Department' ? this.selectedDepartment : undefined,
      shareWithUserId: this.mode === 'User' ? this.selectedUser?.userId : undefined,
      note: this.note?.trim() || undefined
    }).subscribe({
      next: (res: any) => {
        this.sharing = false;
        this.toast.done(res?.message || 'Shared successfully');
        this.dialogRef.close(true);
      },
      error: () => {
        this.sharing = false;
        this.toast.error('Failed to share');
      }
    });
  }
}
