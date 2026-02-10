import { Component, OnInit, Inject, ViewChild, ElementRef } from '@angular/core';
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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { DocumentsService, DocumentFile, FolderInfo, DocumentPermissions } from '../../services/documents.service';

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
    MatSelectModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    NavbarComponent
  ],
  template: `
    <app-navbar></app-navbar>

    <div class="hub-container">
      <!-- Modern Header -->
      <div class="header-section">
        <div class="header-top">
          <div class="breadcrumb-nav">
            <button mat-icon-button class="back-btn" routerLink="/documents" matTooltip="Back to Documents">
              <mat-icon>arrow_back</mat-icon>
            </button>
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
              <button mat-icon-button (click)="clearSearch()" class="clear-btn">
                <mat-icon>close</mat-icon>
              </button>
            }
          </div>

          <div class="toolbar-actions">
            <div class="view-toggle">
              <button mat-icon-button [class.active]="viewMode === 'grid'" (click)="viewMode = 'grid'" matTooltip="Grid View">
                <mat-icon>grid_view</mat-icon>
              </button>
              <button mat-icon-button [class.active]="viewMode === 'list'" (click)="viewMode = 'list'" matTooltip="List View">
                <mat-icon>view_list</mat-icon>
              </button>
            </div>

            <div class="action-buttons">
              <button mat-raised-button class="upload-btn" (click)="fileInput.click()">
                <mat-icon>cloud_upload</mat-icon>
                Upload Files
              </button>
              <input type="file" #fileInput hidden multiple (change)="onFileSelected($event)">

              <button mat-raised-button class="folder-btn" (click)="showNewFolderDialog()">
                <mat-icon>create_new_folder</mat-icon>
                New Folder
              </button>

              <button mat-icon-button [matMenuTriggerFor]="moreMenu" matTooltip="More Options">
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
          <button mat-raised-button color="primary" (click)="createFolder()">Create</button>
          <button mat-button (click)="showNewFolder = false">Cancel</button>
        </div>
      }

      <!-- Files Container -->
      <div class="files-container">
        <!-- Empty State -->
        @if (files.length === 0 && !isLoading) {
          <div class="empty-state">
            <div class="empty-icon">
              <mat-icon>folder_open</mat-icon>
            </div>
            <h2>This folder is empty</h2>
            <p>Upload files or create folders to get started</p>
            <div class="empty-actions">
              <button mat-raised-button class="upload-btn" (click)="fileInput.click()">
                <mat-icon>cloud_upload</mat-icon>
                Upload Files
              </button>
              <button mat-raised-button class="folder-btn" (click)="showNewFolderDialog()">
                <mat-icon>create_new_folder</mat-icon>
                New Folder
              </button>
            </div>
          </div>
        }

        <!-- Loading State -->
        @if (isLoading) {
          <div class="loading-state">
            <mat-spinner diameter="48"></mat-spinner>
            <p>Loading files...</p>
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

                <button mat-icon-button class="file-menu-btn" [matMenuTriggerFor]="fileMenu" 
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
                  <button mat-icon-button [matMenuTriggerFor]="listFileMenu" (click)="$event.stopPropagation()">
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
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      position: relative;
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
      background: rgba(255, 255, 255, 0.1);
      color: white;
    }

    .back-btn:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .breadcrumb-trail {
      display: flex;
      align-items: center;
      gap: 8px;
      color: white;
      font-size: 18px;
    }

    .dept-name {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      cursor: pointer;
      padding: 8px 16px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.1);
      transition: all 0.2s;
    }

    .dept-name:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .separator {
      color: rgba(255, 255, 255, 0.5);
      font-size: 20px !important;
    }

    .crumb {
      cursor: pointer;
      padding: 4px 12px;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .crumb:hover {
      background: rgba(255, 255, 255, 0.1);
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
      background: rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
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
      background: rgba(255, 255, 255, 0.95);
      border-radius: 12px;
      padding: 12px 16px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    }

    .search-box mat-icon {
      color: #666;
    }

    .search-box input {
      flex: 1;
      border: none;
      outline: none;
      font-size: 15px;
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
      background: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 4px;
    }

    .view-toggle button {
      color: rgba(255, 255, 255, 0.6);
    }

    .view-toggle button.active {
      background: rgba(255, 255, 255, 0.2);
      color: white;
    }

    .action-buttons {
      display: flex;
      gap: 8px;
    }

    .upload-btn {
      background: linear-gradient(135deg, #00b4db 0%, #0083b0 100%) !important;
      color: white !important;
      font-weight: 500 !important;
    }

    .folder-btn {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%) !important;
      color: white !important;
      font-weight: 500 !important;
    }

    .selection-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(33, 150, 243, 0.9);
      padding: 12px 20px;
      border-radius: 12px;
      margin-top: 16px;
      color: white;
    }

    .selection-count {
      font-weight: 500;
    }

    .selection-actions button {
      color: white;
    }

    .upload-progress-bar {
      max-width: 1600px;
      margin: 0 auto 16px;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 12px;
      padding: 16px 20px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    }

    .upload-info {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
      color: #333;
    }

    .upload-info mat-icon {
      color: #2196f3;
    }

    .new-folder-card {
      max-width: 600px;
      margin: 0 auto 16px;
      display: flex;
      align-items: center;
      gap: 16px;
      background: rgba(255, 255, 255, 0.95);
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    }

    .folder-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      color: #ffc107;
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

    .empty-state {
      text-align: center;
      padding: 80px 40px;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 20px;
      box-shadow: 0 8px 40px rgba(0, 0, 0, 0.2);
    }

    .empty-icon mat-icon {
      font-size: 100px;
      width: 100px;
      height: 100px;
      color: #e0e0e0;
    }

    .empty-state h2 {
      color: #333;
      margin: 24px 0 8px;
      font-weight: 600;
    }

    .empty-state p {
      color: #666;
      margin-bottom: 32px;
    }

    .empty-actions {
      display: flex;
      gap: 16px;
      justify-content: center;
    }

    .loading-state {
      text-align: center;
      padding: 80px;
      color: white;
    }

    .loading-state p {
      margin-top: 16px;
      opacity: 0.8;
    }

    .files-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 16px;
    }

    .file-card {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 16px;
      padding: 20px;
      cursor: pointer;
      transition: all 0.3s ease;
      position: relative;
      border: 2px solid transparent;
    }

    .file-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
    }

    .file-card.selected {
      border-color: #2196f3;
      background: rgba(33, 150, 243, 0.1);
    }

    .file-card.folder {
      border-left: 4px solid #ffc107;
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
      border-radius: 16px;
      background: #f5f5f5;
    }

    .file-icon-wrapper mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
    }

    .file-icon-wrapper.folder { background: #fff8e1; }
    .file-icon-wrapper.folder mat-icon { color: #ffc107; }
    .file-icon-wrapper.pdf { background: #ffebee; }
    .file-icon-wrapper.pdf mat-icon { color: #e53935; }
    .file-icon-wrapper.word { background: #e3f2fd; }
    .file-icon-wrapper.word mat-icon { color: #1976d2; }
    .file-icon-wrapper.excel { background: #e8f5e9; }
    .file-icon-wrapper.excel mat-icon { color: #388e3c; }
    .file-icon-wrapper.powerpoint { background: #fff3e0; }
    .file-icon-wrapper.powerpoint mat-icon { color: #f57c00; }
    .file-icon-wrapper.image { background: #f3e5f5; }
    .file-icon-wrapper.image mat-icon { color: #7b1fa2; }

    .file-details {
      text-align: center;
    }

    .file-name {
      display: block;
      font-weight: 500;
      color: #333;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-bottom: 4px;
    }

    .file-meta {
      font-size: 12px;
      color: #999;
    }

    .file-menu-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .file-card:hover .file-menu-btn {
      opacity: 1;
    }

    .files-list {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 8px 40px rgba(0, 0, 0, 0.2);
    }

    .list-header {
      display: grid;
      grid-template-columns: 48px 1fr 150px 100px 48px;
      gap: 16px;
      padding: 16px 20px;
      background: #f5f5f5;
      font-weight: 600;
      color: #666;
      font-size: 13px;
      text-transform: uppercase;
    }

    .list-item {
      display: grid;
      grid-template-columns: 48px 1fr 150px 100px 48px;
      gap: 16px;
      padding: 16px 20px;
      align-items: center;
      border-bottom: 1px solid #eee;
      cursor: pointer;
      transition: background 0.2s;
    }

    .list-item:hover {
      background: #f9f9f9;
    }

    .list-item.selected {
      background: rgba(33, 150, 243, 0.1);
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

    .col-name mat-icon.folder { color: #ffc107; }
    .col-name mat-icon.pdf { color: #e53935; }
    .col-name mat-icon.word { color: #1976d2; }
    .col-name mat-icon.excel { color: #388e3c; }
    .col-name mat-icon.powerpoint { color: #f57c00; }
    .col-name mat-icon.image { color: #7b1fa2; }

    .col-name span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .col-modified, .col-size {
      color: #666;
      font-size: 14px;
    }

    .delete-option {
      color: #e53935 !important;
    }

    .delete-option mat-icon {
      color: #e53935;
    }

    .drop-zone-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(33, 150, 243, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .drop-zone-content {
      text-align: center;
      color: white;
    }

    .drop-zone-content mat-icon {
      font-size: 80px;
      width: 80px;
      height: 80px;
      margin-bottom: 16px;
    }

    .drop-zone-content h2 {
      font-size: 28px;
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
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private sanitizer: DomSanitizer
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
        this.snackBar.open('Failed to load files', 'Close', { duration: 3000 });
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
      error: () => this.snackBar.open('Download failed', 'Close', { duration: 3000 })
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
            this.snackBar.open('Renamed successfully', 'Close', { duration: 3000 });
            this.loadFiles();
          },
          error: () => this.snackBar.open('Failed to rename', 'Close', { duration: 3000 })
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
            this.snackBar.open('Moved successfully', 'Close', { duration: 3000 });
            this.loadFiles();
          },
          error: () => this.snackBar.open('Failed to move file', 'Close', { duration: 3000 })
        });
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
                this.snackBar.open(`Moved ${completed} items`, 'Close', { duration: 3000 });
                this.loadFiles();
              }
            }
          });
        });
      }
    });
  }

  deleteFile(file: DocumentFile): void {
    if (confirm(`Are you sure you want to delete "${file.name}"?`)) {
      this.documentsService.deleteFile(this.departmentName, file.path).subscribe({
        next: () => {
          this.snackBar.open(`Deleted "${file.name}"`, 'Close', { duration: 3000 });
          this.loadFiles();
        },
        error: () => this.snackBar.open('Failed to delete', 'Close', { duration: 3000 })
      });
    }
  }

  deleteSelectedFiles(): void {
    const selected = this.selectedFiles;
    if (selected.length === 0) return;

    if (confirm(`Are you sure you want to delete ${selected.length} item(s)?`)) {
      let completed = 0;
      selected.forEach(file => {
        this.documentsService.deleteFile(this.departmentName, file.path).subscribe({
          next: () => {
            completed++;
            if (completed === selected.length) {
              this.snackBar.open(`Deleted ${completed} items`, 'Close', { duration: 3000 });
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
          this.snackBar.open('Moved successfully', 'Close', { duration: 3000 });
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
          <button mat-icon-button (click)="download()" matTooltip="Download">
            <mat-icon>download</mat-icon>
          </button>
          <button mat-icon-button (click)="openInNewTab()" matTooltip="Open in new tab">
            <mat-icon>open_in_new</mat-icon>
          </button>
          <button mat-icon-button mat-dialog-close matTooltip="Close">
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
          <img [src]="safeUrl" class="image-viewer" (load)="isLoading = false">
        }

        @if (isOfficeDoc && !isLoading) {
          <div class="office-notice">
            <mat-icon>description</mat-icon>
            <h3>{{ data.file.name }}</h3>
            <p>Office documents require download to view</p>
            <div class="office-actions">
              <button mat-raised-button color="primary" (click)="download()">
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
    .preview-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-bottom: 1px solid #eee; background: #fafafa; }
    .file-info { display: flex; align-items: center; gap: 12px; font-weight: 500; }
    .file-info mat-icon.pdf { color: #e53935; }
    .file-info mat-icon.word { color: #1976d2; }
    .file-info mat-icon.excel { color: #388e3c; }
    .file-info mat-icon.image { color: #7b1fa2; }
    .header-actions { display: flex; gap: 8px; }
    .preview-content { flex: 1; overflow: auto; background: #f0f0f0; display: flex; align-items: center; justify-content: center; }
    .loading { text-align: center; color: #666; }
    .loading p { margin-top: 16px; }
    .pdf-viewer { width: 100%; height: 100%; border: none; }
    .image-viewer { max-width: 100%; max-height: 100%; object-fit: contain; }
    .office-notice { text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1); }
    .office-notice mat-icon { font-size: 64px; width: 64px; height: 64px; color: #1976d2; }
    .office-notice h3 { margin: 16px 0 8px; color: #333; }
    .office-notice p { color: #666; margin-bottom: 24px; }
    .office-actions { display: flex; gap: 12px; justify-content: center; }
    .text-viewer { width: 100%; height: 100%; margin: 0; padding: 24px; background: white; font-family: 'Consolas', monospace; font-size: 14px; overflow: auto; white-space: pre-wrap; word-wrap: break-word; }
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
      <button mat-raised-button color="primary" (click)="save()">Rename</button>
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
  imports: [CommonModule, MatDialogModule, MatFormFieldModule, MatSelectModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>drive_file_move</mat-icon>
      Move to Folder
    </h2>
    <mat-dialog-content>
      <p class="move-info">Select destination folder:</p>
      
      @if (isLoading) {
        <div class="loading">
          <mat-spinner diameter="32"></mat-spinner>
        </div>
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
      <button mat-raised-button color="primary" [disabled]="selectedFolder === undefined" (click)="move()">
        <mat-icon>drive_file_move</mat-icon>
        Move Here
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 { display: flex; align-items: center; gap: 8px; }
    .move-info { color: #666; margin-bottom: 16px; }
    .loading { display: flex; justify-content: center; padding: 24px; }
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
