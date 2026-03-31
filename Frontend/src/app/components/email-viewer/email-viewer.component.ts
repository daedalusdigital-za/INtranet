import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { environment } from '../../../environments/environment';

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
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatBadgeModule,
    NavbarComponent
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
            <mat-spinner diameter="24"></mat-spinner>
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
                <button class="clear-search" (click)="clearSearch()">
                  <mat-icon>close</mat-icon>
                </button>
              }
            </div>
            <button class="refresh-btn" (click)="loadEmails()" matTooltip="Refresh">
              <mat-icon [class.spinning]="emailsLoading">refresh</mat-icon>
            </button>
          </div>
        </div>

        @if (emailsLoading && emails.length === 0) {
          <div class="list-loading">
            <mat-spinner diameter="36"></mat-spinner>
            <p>Loading emails...</p>
          </div>
        } @else if (emails.length === 0) {
          <div class="list-empty">
            <mat-icon>mail_outline</mat-icon>
            <p>No emails found</p>
            <span>{{ searchQuery ? 'Try a different search' : 'This folder is empty' }}</span>
          </div>
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
                <mat-spinner diameter="24"></mat-spinner>
              </div>
            }
          </div>

          <!-- Pagination -->
          @if (totalPages > 1) {
            <div class="pagination">
              <button class="page-btn" [disabled]="currentPage <= 1" (click)="goToPage(currentPage - 1)">
                <mat-icon>chevron_left</mat-icon>
              </button>
              <span class="page-info">Page {{ currentPage }} of {{ totalPages }}</span>
              <button class="page-btn" [disabled]="currentPage >= totalPages" (click)="goToPage(currentPage + 1)">
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
            <mat-spinner diameter="36"></mat-spinner>
            <p>Loading email...</p>
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
          <div class="detail-empty">
            <mat-icon>markunread_mailbox</mat-icon>
            <h3>Select an email to read</h3>
            <p>Choose an email from the list to view its contents</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100vh; background: #0d1117; }

    .email-container {
      display: flex;
      height: calc(100vh - 64px);
      overflow: hidden;
    }

    /* ===== Sidebar ===== */
    .email-sidebar {
      width: 220px;
      min-width: 220px;
      background: linear-gradient(180deg, #161b22 0%, #0d1117 100%);
      border-right: 1px solid rgba(255,255,255,0.06);
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }

    .sidebar-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 18px 16px 12px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }

    .sidebar-icon { color: #58a6ff; font-size: 22px; }
    .sidebar-header h3 { color: #e6edf3; font-size: 15px; font-weight: 600; margin: 0; }

    .sidebar-loading { display: flex; justify-content: center; padding: 30px; }

    .folder-list { padding: 8px; }

    .folder-item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 9px 12px;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: rgba(255,255,255,0.65);
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
      text-align: left;
    }

    .folder-item:hover { background: rgba(255,255,255,0.06); color: #e6edf3; }
    .folder-item.active { background: rgba(88,166,255,0.12); color: #58a6ff; }
    .folder-item.active .folder-icon { color: #58a6ff; }

    .folder-icon { font-size: 18px; width: 18px; height: 18px; color: rgba(255,255,255,0.4); }
    .folder-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .folder-badge {
      background: #58a6ff;
      color: #0d1117;
      font-size: 10px;
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
    .no-account-msg mat-icon { color: #f0883e; font-size: 28px; width: 28px; height: 28px; }
    .no-account-msg p { color: rgba(255,255,255,0.5); font-size: 12px; margin: 0; }

    /* ===== Email List ===== */
    .email-list-panel {
      width: 380px;
      min-width: 320px;
      display: flex;
      flex-direction: column;
      border-right: 1px solid rgba(255,255,255,0.06);
      background: #0d1117;
    }

    .list-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      gap: 8px;
      flex-wrap: wrap;
    }

    .list-toolbar-left { display: flex; align-items: center; gap: 8px; }
    .list-toolbar-left h3 { color: #e6edf3; font-size: 14px; font-weight: 600; margin: 0; }
    .email-count { color: rgba(255,255,255,0.35); font-size: 11px; }

    .list-toolbar-right { display: flex; align-items: center; gap: 6px; }

    .search-box {
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(255,255,255,0.06);
      border-radius: 8px;
      padding: 5px 10px;
      border: 1px solid rgba(255,255,255,0.08);
      transition: border-color 0.2s;
    }
    .search-box:focus-within { border-color: #58a6ff; }
    .search-box mat-icon { font-size: 16px; width: 16px; height: 16px; color: rgba(255,255,255,0.35); }
    .search-box input {
      background: none; border: none; outline: none;
      color: #e6edf3; font-size: 12px; width: 130px;
    }
    .search-box input::placeholder { color: rgba(255,255,255,0.3); }
    .clear-search {
      background: none; border: none; cursor: pointer; padding: 0;
      display: flex; align-items: center;
    }
    .clear-search mat-icon { font-size: 14px; width: 14px; height: 14px; color: rgba(255,255,255,0.4); }

    .refresh-btn {
      background: none; border: none; cursor: pointer; padding: 4px;
      border-radius: 6px; transition: background 0.2s; display: flex; align-items: center;
    }
    .refresh-btn:hover { background: rgba(255,255,255,0.08); }
    .refresh-btn mat-icon { font-size: 18px; width: 18px; height: 18px; color: rgba(255,255,255,0.5); }
    .spinning { animation: spin 1s linear infinite; }
    @keyframes spin { 100% { transform: rotate(360deg); } }

    .list-loading, .list-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      gap: 12px;
      flex: 1;
    }
    .list-loading p, .list-empty p { color: rgba(255,255,255,0.5); font-size: 13px; margin: 0; }
    .list-empty mat-icon { font-size: 40px; width: 40px; height: 40px; color: rgba(255,255,255,0.15); }
    .list-empty span { color: rgba(255,255,255,0.3); font-size: 12px; }

    .email-items { flex: 1; overflow-y: auto; }

    .email-item {
      display: flex;
      gap: 8px;
      padding: 12px 14px;
      cursor: pointer;
      transition: background 0.15s;
      border-bottom: 1px solid rgba(255,255,255,0.04);
    }
    .email-item:hover { background: rgba(255,255,255,0.04); }
    .email-item.selected { background: rgba(88,166,255,0.08); border-left: 3px solid #58a6ff; }
    .email-item.unread { background: rgba(255,255,255,0.02); }

    .email-item-indicator { width: 8px; display: flex; align-items: flex-start; padding-top: 6px; }
    .unread-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #58a6ff;
    }

    .email-item-content { flex: 1; min-width: 0; }

    .email-item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; }
    .email-from { color: rgba(255,255,255,0.8); font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px; }
    .email-date { color: rgba(255,255,255,0.3); font-size: 10.5px; white-space: nowrap; }

    .email-subject { color: rgba(255,255,255,0.65); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .fw-bold { font-weight: 600 !important; color: #e6edf3 !important; }

    .email-meta { display: flex; align-items: center; gap: 4px; margin-top: 3px; }
    .attach-icon { font-size: 14px; width: 14px; height: 14px; color: rgba(255,255,255,0.3); }
    .flag-icon { font-size: 14px; width: 14px; height: 14px; color: #f0883e; }

    .list-loading-more { display: flex; justify-content: center; padding: 16px; }

    .pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 10px;
      border-top: 1px solid rgba(255,255,255,0.06);
    }
    .page-btn {
      background: rgba(255,255,255,0.06);
      border: none; border-radius: 6px;
      color: rgba(255,255,255,0.6);
      cursor: pointer; padding: 4px;
      display: flex; align-items: center;
      transition: background 0.2s;
    }
    .page-btn:hover:not(:disabled) { background: rgba(255,255,255,0.1); }
    .page-btn:disabled { opacity: 0.3; cursor: default; }
    .page-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .page-info { color: rgba(255,255,255,0.4); font-size: 12px; }

    /* ===== Email Detail ===== */
    .email-detail-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      background: #0d1117;
    }

    .detail-loading, .detail-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 12px;
    }
    .detail-loading p { color: rgba(255,255,255,0.5); font-size: 13px; }
    .detail-empty mat-icon { font-size: 56px; width: 56px; height: 56px; color: rgba(255,255,255,0.08); }
    .detail-empty h3 { color: rgba(255,255,255,0.5); font-size: 16px; margin: 0; font-weight: 500; }
    .detail-empty p { color: rgba(255,255,255,0.25); font-size: 13px; margin: 0; }

    .detail-content { padding: 24px; }

    .detail-header { margin-bottom: 20px; }
    .detail-subject { color: #e6edf3; font-size: 20px; font-weight: 600; margin: 0 0 16px 0; line-height: 1.4; }

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
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex; align-items: center; justify-content: center;
      color: white; font-size: 14px; font-weight: 700;
      flex-shrink: 0;
    }

    .detail-from-info { display: flex; flex-direction: column; flex: 1; }
    .detail-from-name { color: #e6edf3; font-size: 14px; font-weight: 600; }
    .detail-from-email { color: rgba(255,255,255,0.4); font-size: 12px; }
    .detail-date { color: rgba(255,255,255,0.35); font-size: 12px; white-space: nowrap; }

    .detail-recipients {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      padding-left: 52px;
    }

    .recipient-label { color: rgba(255,255,255,0.35); font-size: 11.5px; font-weight: 600; }
    .recipient-chip {
      background: rgba(255,255,255,0.06);
      color: rgba(255,255,255,0.6);
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 11.5px;
    }

    .detail-attachments {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 12px 16px;
      margin-bottom: 16px;
      background: rgba(255,255,255,0.03);
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.06);
      flex-wrap: wrap;
    }
    .detail-attachments > mat-icon { color: rgba(255,255,255,0.4); font-size: 18px; width: 18px; height: 18px; margin-top: 2px; }
    .attach-label { color: rgba(255,255,255,0.5); font-size: 12px; margin-right: 4px; }

    .attachment-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .attachment-chip {
      display: flex; align-items: center; gap: 4px;
      background: rgba(88,166,255,0.08);
      color: #58a6ff;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11.5px;
    }
    .attachment-chip mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .att-size { color: rgba(255,255,255,0.3); font-size: 10px; }

    .detail-body {
      padding: 16px 0;
      border-top: 1px solid rgba(255,255,255,0.06);
    }

    .email-html-body {
      color: #e6edf3;
      font-size: 14px;
      line-height: 1.6;
      word-break: break-word;
      overflow-x: auto;
    }

    :host ::ng-deep .email-html-body img { max-width: 100%; height: auto; }
    :host ::ng-deep .email-html-body a { color: #58a6ff; }
    :host ::ng-deep .email-html-body table { border-collapse: collapse; max-width: 100%; }
    :host ::ng-deep .email-html-body td, :host ::ng-deep .email-html-body th { padding: 4px 8px; }
    :host ::ng-deep .email-html-body blockquote {
      border-left: 3px solid rgba(255,255,255,0.15);
      margin: 8px 0;
      padding: 4px 12px;
      color: rgba(255,255,255,0.55);
    }

    .email-text-body {
      color: rgba(255,255,255,0.75);
      font-size: 13px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: inherit;
      margin: 0;
    }

    .no-body { color: rgba(255,255,255,0.3); font-style: italic; }

    /* Responsive */
    @media (max-width: 1024px) {
      .email-sidebar { width: 180px; min-width: 180px; }
      .email-list-panel { width: 300px; min-width: 260px; }
    }

    @media (max-width: 768px) {
      .email-container { flex-direction: column; }
      .email-sidebar { width: 100%; min-width: auto; flex-direction: row; overflow-x: auto; border-right: none; border-bottom: 1px solid rgba(255,255,255,0.06); }
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
        this.sanitizedHtml = detail.htmlBody
          ? this.sanitizer.bypassSecurityTrustHtml(detail.htmlBody)
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
