import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { sanitizeUntrustedHtml } from '../../utils/sanitize-html';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { environment } from '../../../environments/environment';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state.component';
import { SkeletonRowsComponent } from '../../ui/skeleton-rows/skeleton-rows.component';

interface EmailFolder {
  name: string;
  fullName: string;
  total: number;
  unread: number;
  icon: string;
}

interface EmailSummary {
  uid: number;
  subject: string;
  from: string;
  fromEmail: string;
  to: { name: string; email: string }[];
  cc: { name: string; email: string }[];
  date: string;
  isRead: boolean;
  isFlagged: boolean;
  hasAttachments: boolean;
  size: number;
  preview: string;
}

interface EmailDetail {
  uid: number;
  subject: string;
  from: string;
  fromEmail: string;
  to: { name: string; email: string }[];
  cc: { name: string; email: string }[];
  date: string;
  htmlBody: string | null;
  textBody: string | null;
  attachments: { fileName: string; contentType: string; size: number }[];
  hasAttachments: boolean;
}

@Component({
  selector: 'app-email-viewer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatTooltipModule,
    MatBadgeModule,
    NavbarComponent,
    EmptyStateComponent,
    SkeletonRowsComponent
  ],
  template: `
    <app-navbar></app-navbar>

    <div class="email-container">
      <!-- Folder Sidebar -->
      <div class="email-sidebar">
        <div class="sidebar-header">
          <mat-icon class="sidebar-icon">email</mat-icon>
          <h3>My Emails</h3>
        </div>

        @if (foldersLoading) {
          <div class="sidebar-loading">
            <app-skeleton-rows [rows]="6" [avatar]="false"></app-skeleton-rows>
          </div>
        } @else {
          <div class="folder-list">
            @for (folder of folders; track folder.fullName) {
              <button class="folder-item" 
                      [class.active]="currentFolder === folder.fullName"
                      (click)="selectFolder(folder)">
                <mat-icon class="folder-icon">{{ folder.icon }}</mat-icon>
                <span class="folder-name">{{ folder.name }}</span>
                @if (folder.unread > 0) {
                  <span class="folder-badge">{{ folder.unread }}</span>
                }
              </button>
            }
          </div>
        }

        @if (noAccountConfigured) {
          <div class="no-account-msg">
            <mat-icon>info</mat-icon>
            <p>No email account linked to your profile. Contact IT.</p>
          </div>
        }
      </div>

      <!-- Email List -->
      <div class="email-list-panel">
        <div class="list-toolbar">
          <div class="list-toolbar-left">
            <h3>{{ getFolderDisplayName() }}</h3>
            @if (totalEmails > 0) {
              <span class="email-count">{{ totalEmails }} emails</span>
            }
          </div>
          <div class="list-toolbar-right">
            <div class="search-box">
              <mat-icon>search</mat-icon>
              <input type="text" 
                     placeholder="Search emails..." 
                     [(ngModel)]="searchQuery"
                     (keydown.enter)="searchEmails()">
              @if (searchQuery) {
                <button aria-label="Clear search" class="clear-search" (click)="clearSearch()">
                  <mat-icon>close</mat-icon>
                </button>
              }
            </div>
            <button aria-label="Refresh" class="refresh-btn" (click)="loadEmails()" matTooltip="Refresh">
              <mat-icon [class.spinning]="emailsLoading">refresh</mat-icon>
            </button>
          </div>
        </div>

        @if (emailsLoading && emails.length === 0) {
          <div class="list-loading">
            <app-skeleton-rows [rows]="8"></app-skeleton-rows>
          </div>
        } @else if (emails.length === 0) {
          <app-empty-state class="list-empty" icon="mail_outline"
                           [title]="searchQuery ? 'No emails match your search' : 'No emails in this folder'"
                           [message]="searchQuery ? 'Try a different search term.' : 'New mail will show up here.'">
            @if (searchQuery) {
              <button mat-stroked-button (click)="clearSearch()">Clear search</button>
            }
          </app-empty-state>
        } @else {
          <div class="email-items" (scroll)="onListScroll($event)">
            @for (email of emails; track email.uid) {
              <div class="email-item" 
                   [class.unread]="!email.isRead"
                   [class.selected]="selectedEmail?.uid === email.uid"
                   [class.flagged]="email.isFlagged"
                   (click)="openEmail(email)">
                <div class="email-item-indicator">
                  @if (!email.isRead) {
                    <span class="unread-dot"></span>
                  }
                </div>
                <div class="email-item-content">
                  <div class="email-item-header">
                    <span class="email-from" [class.fw-bold]="!email.isRead">{{ email.from }}</span>
                    <span class="email-date">{{ formatDate(email.date) }}</span>
                  </div>
                  <div class="email-subject" [class.fw-bold]="!email.isRead">{{ email.subject }}</div>
                  <div class="email-meta">
                    @if (email.hasAttachments) {
                      <mat-icon class="attach-icon">attach_file</mat-icon>
                    }
                    @if (email.isFlagged) {
                      <mat-icon class="flag-icon">star</mat-icon>
                    }
                  </div>
                </div>
              </div>
            }
            @if (emailsLoading) {
              <div class="list-loading-more">
                <app-skeleton-rows [rows]="2"></app-skeleton-rows>
              </div>
            }
          </div>

          <!-- Pagination -->
          @if (totalPages > 1) {
            <div class="pagination">
              <button aria-label="Previous" class="page-btn" [disabled]="currentPage <= 1" (click)="goToPage(currentPage - 1)">
                <mat-icon>chevron_left</mat-icon>
              </button>
              <span class="page-info">Page {{ currentPage }} of {{ totalPages }}</span>
              <button aria-label="Next" class="page-btn" [disabled]="currentPage >= totalPages" (click)="goToPage(currentPage + 1)">
                <mat-icon>chevron_right</mat-icon>
              </button>
            </div>
          }
        }
      </div>

      <!-- Email Detail / Reading Pane -->
      <div class="email-detail-panel">
        @if (detailLoading) {
          <div class="detail-loading">
            <app-skeleton-rows [rows]="6" [avatar]="false"></app-skeleton-rows>
          </div>
        } @else if (emailDetail) {
          <div class="detail-content">
            <div class="detail-header">
              <h2 class="detail-subject">{{ emailDetail.subject }}</h2>
              <div class="detail-meta">
                <div class="detail-from-row">
                  <div class="detail-avatar">
                    {{ getInitials(emailDetail.from) }}
                  </div>
                  <div class="detail-from-info">
                    <span class="detail-from-name">{{ emailDetail.from }}</span>
                    <span class="detail-from-email">&lt;{{ emailDetail.fromEmail }}&gt;</span>
                  </div>
                  <span class="detail-date">{{ formatFullDate(emailDetail.date) }}</span>
                </div>
                <div class="detail-recipients">
                  <span class="recipient-label">To:</span>
                  @for (r of emailDetail.to; track r.email) {
                    <span class="recipient-chip">{{ r.name || r.email }}</span>
                  }
                </div>
                @if (emailDetail.cc && emailDetail.cc.length > 0) {
                  <div class="detail-recipients">
                    <span class="recipient-label">Cc:</span>
                    @for (r of emailDetail.cc; track r.email) {
                      <span class="recipient-chip">{{ r.name || r.email }}</span>
                    }
                  </div>
                }
              </div>
            </div>

            @if (emailDetail.hasAttachments && emailDetail.attachments.length > 0) {
              <div class="detail-attachments">
                <mat-icon>attach_file</mat-icon>
                <span class="attach-label">{{ emailDetail.attachments.length }} attachment(s)</span>
                <div class="attachment-chips">
                  @for (att of emailDetail.attachments; track att.fileName) {
                    <span class="attachment-chip">
                      <mat-icon>{{ getFileIcon(att.contentType) }}</mat-icon>
                      {{ att.fileName }}
                      <span class="att-size">({{ formatSize(att.size) }})</span>
                    </span>
                  }
                </div>
              </div>
            }

            <div class="detail-body">
              @if (emailDetail.htmlBody) {
                <div class="email-html-body" [innerHTML]="sanitizedHtml"></div>
              } @else if (emailDetail.textBody) {
                <pre class="email-text-body">{{ emailDetail.textBody }}</pre>
              } @else {
                <p class="no-body">(No email content)</p>
              }
            </div>
          </div>
        } @else {
          <app-empty-state class="detail-empty" icon="markunread_mailbox" title="Select an email to read"
                           message="Choose an email from the list to view its contents."></app-empty-state>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100vh; background: var(--color-canvas); }

    .email-container {
      display: flex;
      height: calc(100vh - 64px);
      overflow: hidden;
    }

    /* ===== Sidebar ===== */
    .email-sidebar {
      width: 220px;
      min-width: 220px;
      background: var(--color-surface);
      border-right: 1px solid var(--color-line);
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }

    .sidebar-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 18px 16px 12px;
      border-bottom: 1px solid var(--color-line);
    }

    .sidebar-icon { color: var(--color-primary); font-size: var(--text-2xl); }
    .sidebar-header h3 { color: var(--color-text); font-size: var(--text-md); font-weight: 600; margin: 0; }

    .sidebar-loading { padding: 8px 0; }

    .folder-list { padding: 8px; }

    .folder-item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 9px 12px;
      border: none;
      border-radius: var(--radius-control);
      background: transparent;
      color: var(--color-text-2);
      font-size: var(--text-sm);
      cursor: pointer;
      transition: background 0.2s, color 0.2s;
      text-align: left;
    }

    .folder-item:hover { background: var(--color-surface-2); color: var(--color-text); }
    .folder-item.active { background: var(--color-primary-soft); color: var(--color-primary); }
    .folder-item.active .folder-icon { color: var(--color-primary); }

    .folder-icon { font-size: var(--text-xl); width: 18px; height: 18px; color: var(--color-text-3); }
    .folder-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .folder-badge {
      background: var(--color-primary);
      color: var(--color-on-primary);
      font-size: var(--text-xs);
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 10px;
      min-width: 18px;
      text-align: center;
    }

    .no-account-msg {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px 16px;
      gap: 8px;
      text-align: center;
    }
    .no-account-msg mat-icon { color: var(--color-warn); font-size: var(--text-3xl); width: 28px; height: 28px; }
    .no-account-msg p { color: var(--color-text-3); font-size: var(--text-xs); margin: 0; }

    /* ===== Email List ===== */
    .email-list-panel {
      width: 380px;
      min-width: 320px;
      display: flex;
      flex-direction: column;
      border-right: 1px solid var(--color-line);
      background: var(--color-surface);
    }

    .list-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      border-bottom: 1px solid var(--color-line);
      gap: 8px;
      flex-wrap: wrap;
    }

    .list-toolbar-left { display: flex; align-items: center; gap: 8px; }
    .list-toolbar-left h3 { color: var(--color-text); font-size: var(--text-md); font-weight: 600; margin: 0; }
    .email-count { color: var(--color-text-3); font-size: var(--text-xs); }

    .list-toolbar-right { display: flex; align-items: center; gap: 6px; }

    .search-box {
      display: flex;
      align-items: center;
      gap: 6px;
      background: var(--color-surface);
      border-radius: var(--radius-control);
      padding: 5px 10px;
      border: 1px solid var(--color-line-strong);
      transition: border-color 0.2s;
    }
    .search-box:focus-within { border-color: var(--color-primary); }
    .search-box mat-icon { font-size: var(--text-lg); width: 16px; height: 16px; color: var(--color-text-3); }
    .search-box input {
      background: none; border: none; outline: none;
      color: var(--color-text); font-size: var(--text-xs); width: 130px;
    }
    .search-box input::placeholder { color: var(--color-text-3); }
    .clear-search {
      background: none; border: none; cursor: pointer; padding: 0;
      display: flex; align-items: center;
    }
    .clear-search mat-icon { font-size: var(--text-md); width: 14px; height: 14px; color: var(--color-text-3); }

    .refresh-btn {
      background: none; border: none; cursor: pointer; padding: 4px;
      border-radius: var(--radius-sm); transition: background 0.2s; display: flex; align-items: center;
    }
    .refresh-btn:hover { background: var(--color-surface-2); }
    .refresh-btn mat-icon { font-size: var(--text-xl); width: 18px; height: 18px; color: var(--color-text-3); }
    .spinning { animation: spin 1s linear infinite; }
    @keyframes spin { 100% { transform: rotate(360deg); } }

    .list-loading { flex: 1; }
    .list-empty { flex: 1; display: block; }

    .email-items { flex: 1; overflow-y: auto; }

    .email-item {
      display: flex;
      gap: 8px;
      padding: 12px 14px;
      cursor: pointer;
      transition: background 0.15s;
      border-bottom: 1px solid var(--color-line);
    }
    .email-item:hover { background: var(--color-surface-2); }
    .email-item.selected { background: var(--color-primary-soft); border-left: 3px solid var(--color-primary); }

    .email-item-indicator { width: 8px; display: flex; align-items: flex-start; padding-top: 6px; }
    .unread-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--color-primary);
    }

    .email-item-content { flex: 1; min-width: 0; }

    .email-item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; }
    .email-from { color: var(--color-text); font-size: var(--text-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px; }
    .email-date { color: var(--color-text-3); font-size: var(--text-xs); white-space: nowrap; }

    .email-subject { color: var(--color-text-2); font-size: var(--text-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .fw-bold { font-weight: 600; color: var(--color-text); }

    .email-meta { display: flex; align-items: center; gap: 4px; margin-top: 3px; }
    .attach-icon { font-size: var(--text-md); width: 14px; height: 14px; color: var(--color-text-3); }
    .flag-icon { font-size: var(--text-md); width: 14px; height: 14px; color: var(--color-warn); }

    .list-loading-more { padding: 4px 0; }

    .pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 10px;
      border-top: 1px solid var(--color-line);
    }
    .page-btn {
      background: var(--color-surface-2);
      border: none; border-radius: var(--radius-sm);
      color: var(--color-text-2);
      cursor: pointer; padding: 4px;
      display: flex; align-items: center;
      transition: background 0.2s;
    }
    .page-btn:hover:not(:disabled) { background: var(--color-surface-3); }
    .page-btn:disabled { opacity: 0.4; cursor: default; }
    .page-btn mat-icon { font-size: var(--text-xl); width: 18px; height: 18px; }
    .page-info { color: var(--color-text-3); font-size: var(--text-xs); }

    /* ===== Email Detail ===== */
    .email-detail-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      background: var(--color-surface);
    }

    .detail-loading { padding: 24px; }
    .detail-empty { display: block; padding-top: 12vh; }

    .detail-content { padding: 24px; }

    .detail-header { margin-bottom: 20px; }
    .detail-subject { color: var(--color-text); font-size: var(--text-2xl); font-weight: 600; margin: 0 0 16px 0; line-height: 1.4; }

    .detail-meta {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .detail-from-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .detail-avatar {
      width: 40px; height: 40px; border-radius: 50%;
      background: var(--color-primary);
      display: flex; align-items: center; justify-content: center;
      color: var(--color-on-primary); font-size: var(--text-md); font-weight: 700;
      flex-shrink: 0;
    }

    .detail-from-info { display: flex; flex-direction: column; flex: 1; }
    .detail-from-name { color: var(--color-text); font-size: var(--text-md); font-weight: 600; }
    .detail-from-email { color: var(--color-text-3); font-size: var(--text-xs); }
    .detail-date { color: var(--color-text-3); font-size: var(--text-xs); white-space: nowrap; }

    .detail-recipients {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      padding-left: 52px;
    }

    .recipient-label { color: var(--color-text-3); font-size: var(--text-xs); font-weight: 600; }
    .recipient-chip {
      background: var(--color-surface-2);
      color: var(--color-text-2);
      padding: 2px 8px;
      border-radius: var(--radius-sm);
      font-size: var(--text-xs);
    }

    .detail-attachments {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 12px 16px;
      margin-bottom: 16px;
      background: var(--color-surface-2);
      border-radius: var(--radius-md);
      border: 1px solid var(--color-line);
      flex-wrap: wrap;
    }
    .detail-attachments > mat-icon { color: var(--color-text-3); font-size: var(--text-xl); width: 18px; height: 18px; margin-top: 2px; }
    .attach-label { color: var(--color-text-2); font-size: var(--text-xs); margin-right: 4px; }

    .attachment-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .attachment-chip {
      display: flex; align-items: center; gap: 4px;
      background: var(--color-primary-soft);
      color: var(--color-primary);
      padding: 4px 10px;
      border-radius: var(--radius-sm);
      font-size: var(--text-xs);
    }
    .attachment-chip mat-icon { font-size: var(--text-md); width: 14px; height: 14px; }
    .att-size { color: var(--color-text-3); font-size: var(--text-xs); }

    .detail-body {
      padding: 16px 0;
      border-top: 1px solid var(--color-line);
    }

    /* Sent HTML is written for a white page, so it sits on a white sheet in both themes */
    .email-html-body {
      background: var(--color-on-dark);
      color: var(--nav-bg);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-md);
      padding: 16px;
      font-size: var(--text-md);
      line-height: 1.6;
      word-break: break-word;
      overflow-x: auto;
    }

    :host ::ng-deep .email-html-body img { max-width: 100%; height: auto; }
    :host ::ng-deep .email-html-body a { color: inherit; text-decoration: underline; }
    :host ::ng-deep .email-html-body table { border-collapse: collapse; max-width: 100%; }
    :host ::ng-deep .email-html-body td, :host ::ng-deep .email-html-body th { padding: 4px 8px; }
    :host ::ng-deep .email-html-body blockquote {
      border-left: 3px solid var(--color-line-strong);
      margin: 8px 0;
      padding: 4px 12px;
      color: inherit;
      opacity: 0.7;
    }

    .email-text-body {
      color: var(--color-text);
      font-size: var(--text-sm);
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: inherit;
      margin: 0;
    }

    .no-body { color: var(--color-text-3); font-style: italic; }

    /* Responsive */
    @media (max-width: 1024px) {
      .email-sidebar { width: 180px; min-width: 180px; }
      .email-list-panel { width: 300px; min-width: 260px; }
    }

    @media (max-width: 768px) {
      .email-container { flex-direction: column; }
      .email-sidebar { width: 100%; min-width: auto; flex-direction: row; overflow-x: auto; border-right: none; border-bottom: 1px solid var(--color-line); }
      .sidebar-header { display: none; }
      .folder-list { display: flex; padding: 6px; gap: 4px; }
      .folder-item { white-space: nowrap; }
      .email-list-panel { width: 100%; min-width: auto; height: 40vh; border-right: none; }
      .email-detail-panel { height: 60vh; }
    }
  `]
})
export class EmailViewerComponent implements OnInit {
  private apiUrl = environment.apiUrl;

  folders: EmailFolder[] = [];
  emails: EmailSummary[] = [];
  emailDetail: EmailDetail | null = null;
  selectedEmail: EmailSummary | null = null;
  sanitizedHtml: SafeHtml | null = null;

  currentFolder: string = 'INBOX';
  searchQuery: string = '';
  currentPage: number = 1;
  totalPages: number = 1;
  totalEmails: number = 0;

  foldersLoading: boolean = false;
  emailsLoading: boolean = false;
  detailLoading: boolean = false;
  noAccountConfigured: boolean = false;

  constructor(
    private http: HttpClient,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.loadFolders();
    this.loadEmails();
  }

  loadFolders(): void {
    this.foldersLoading = true;
    const token = localStorage.getItem('token');
    const headers: any = token ? { Authorization: `Bearer ${token}` } : {};

    this.http.get<any>(`${this.apiUrl}/emailsearch/my-folders`, { headers }).subscribe({
      next: (data) => {
        this.folders = data || [];
        this.foldersLoading = false;
        if (this.folders.length === 0) {
          this.noAccountConfigured = true;
        }
      },
      error: () => {
        this.foldersLoading = false;
        this.noAccountConfigured = true;
      }
    });
  }

  loadEmails(): void {
    this.emailsLoading = true;
    const token = localStorage.getItem('token');
    const headers: any = token ? { Authorization: `Bearer ${token}` } : {};

    let url = `${this.apiUrl}/emailsearch/my-inbox?folder=${encodeURIComponent(this.currentFolder)}&page=${this.currentPage}&pageSize=30`;
    if (this.searchQuery) {
      url += `&search=${encodeURIComponent(this.searchQuery)}`;
    }

    this.http.get<any>(url, { headers }).subscribe({
      next: (data) => {
        this.emails = data.emails || [];
        this.totalEmails = data.total || 0;
        this.totalPages = data.totalPages || 1;
        this.emailsLoading = false;

        if (data.message && this.emails.length === 0) {
          this.noAccountConfigured = true;
        }
      },
      error: () => {
        this.emailsLoading = false;
        this.emails = [];
      }
    });
  }

  selectFolder(folder: EmailFolder): void {
    this.currentFolder = folder.fullName;
    this.currentPage = 1;
    this.emailDetail = null;
    this.selectedEmail = null;
    this.loadEmails();
  }

  openEmail(email: EmailSummary): void {
    this.selectedEmail = email;
    this.detailLoading = true;

    const token = localStorage.getItem('token');
    const headers: any = token ? { Authorization: `Bearer ${token}` } : {};

    this.http.get<EmailDetail>(
      `${this.apiUrl}/emailsearch/my-inbox/${email.uid}?folder=${encodeURIComponent(this.currentFolder)}`,
      { headers }
    ).subscribe({
      next: (detail) => {
        this.emailDetail = detail;
        // External email HTML: DOMPurify strips scripts/handlers/forms/embeds first; only the
        // purified output is marked trusted (Angular's own sanitizer would drop inline styles).
        this.sanitizedHtml = detail.htmlBody
          ? this.sanitizer.bypassSecurityTrustHtml(sanitizeUntrustedHtml(detail.htmlBody))
          : null;
        this.detailLoading = false;

        // Mark as read locally
        email.isRead = true;
      },
      error: () => {
        this.detailLoading = false;
      }
    });
  }

  searchEmails(): void {
    this.currentPage = 1;
    this.loadEmails();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.currentPage = 1;
    this.loadEmails();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadEmails();
  }

  onListScroll(event: Event): void {
    // Could add infinite scroll here if needed
  }

  getFolderDisplayName(): string {
    const folder = this.folders.find(f => f.fullName === this.currentFolder);
    return folder?.name || this.currentFolder;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const emailDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (emailDate.getTime() === today.getTime()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (emailDate.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    }

    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }

  formatFullDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
      + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.replace(/[<>"]/g, '').trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  }

  getFileIcon(contentType: string): string {
    if (contentType.includes('pdf')) return 'picture_as_pdf';
    if (contentType.includes('image')) return 'image';
    if (contentType.includes('spreadsheet') || contentType.includes('excel') || contentType.includes('csv')) return 'table_chart';
    if (contentType.includes('word') || contentType.includes('document')) return 'description';
    if (contentType.includes('zip') || contentType.includes('compressed')) return 'folder_zip';
    return 'insert_drive_file';
  }

  formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }
}
