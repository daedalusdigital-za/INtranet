import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { environment } from '../../../environments/environment';

interface CompanyInfo { key: string; label: string; exists: boolean; archiveCount: number; }
interface ArchiveFile { name: string; relativePath: string; sizeBytes: number; modified?: string; }
interface FolderNode { name: string; path: string; count: number; unread: number; children: FolderNode[]; }
interface MessageSummary { index: number; subject: string; from: string; to: string; date?: string; isRead: boolean; hasAttachments: boolean; }
interface MessagePage { total: number; page: number; pageSize: number; totalPages: number; items: MessageSummary[]; }
interface AttachmentInfo { attIndex: number; fileName: string; size: number; }
interface MessageDetail { index: number; subject: string; from: string; to: string; cc: string; date?: string; htmlBody?: string; textBody?: string; hasAttachments: boolean; attachments: AttachmentInfo[]; }

@Component({
  selector: 'app-archives',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  templateUrl: './archives.component.html',
  styleUrls: ['./archives.component.scss']
})
export class ArchivesComponent implements OnInit {
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);
  private api = `${environment.apiUrl}/archives`;

  // State machine: locked -> companies -> files -> browse
  password = signal('');
  unlocked = signal(false);
  unlockError = signal('');
  loading = signal(false);
  error = signal('');

  companies = signal<CompanyInfo[]>([]);
  selectedCompany = signal<CompanyInfo | null>(null);

  files = signal<ArchiveFile[]>([]);
  selectedFile = signal<ArchiveFile | null>(null);

  folders = signal<FolderNode[]>([]);
  selectedFolder = signal<FolderNode | null>(null);

  messages = signal<MessagePage | null>(null);
  page = signal(1);
  search = signal('');

  selectedMessage = signal<MessageDetail | null>(null);

  view = computed<'locked' | 'companies' | 'files' | 'browse'>(() => {
    if (!this.unlocked()) return 'locked';
    if (!this.selectedCompany()) return 'companies';
    if (!this.selectedFile()) return 'files';
    return 'browse';
  });

  ngOnInit(): void {}

  // ngModel bridges to signals
  get passwordModel(): string { return this.password(); }
  set passwordModel(v: string) { this.password.set(v); }
  get searchModel(): string { return this.search(); }
  set searchModel(v: string) { this.search.set(v); }

  private headers(): HttpHeaders {
    return new HttpHeaders({ 'X-Archive-Password': this.password() });
  }

  unlock(): void {
    this.unlockError.set('');
    const pw = this.password().trim();
    if (!pw) { this.unlockError.set('Enter the archives password.'); return; }
    this.loading.set(true);
    this.http.post(`${this.api}/unlock`, { password: pw }).subscribe({
      next: () => { this.unlocked.set(true); this.loading.set(false); this.loadCompanies(); },
      error: () => { this.unlockError.set('Incorrect password.'); this.loading.set(false); }
    });
  }

  loadCompanies(): void {
    this.loading.set(true); this.error.set('');
    this.http.get<CompanyInfo[]>(`${this.api}/companies`, { headers: this.headers() }).subscribe({
      next: c => { this.companies.set(c); this.loading.set(false); },
      error: () => { this.error.set('Could not load companies.'); this.loading.set(false); }
    });
  }

  pickCompany(c: CompanyInfo): void {
    if (!c.exists) return;
    this.selectedCompany.set(c);
    this.files.set([]); this.selectedFile.set(null);
    this.loading.set(true); this.error.set('');
    this.http.get<ArchiveFile[]>(`${this.api}/files`, { headers: this.headers(), params: { company: c.key } }).subscribe({
      next: f => { this.files.set(f); this.loading.set(false); },
      error: () => { this.error.set('Could not load archives.'); this.loading.set(false); }
    });
  }

  pickFile(f: ArchiveFile): void {
    this.selectedFile.set(f);
    this.folders.set([]); this.selectedFolder.set(null);
    this.messages.set(null); this.selectedMessage.set(null);
    this.loading.set(true); this.error.set('');
    const company = this.selectedCompany()!.key;
    this.http.get<FolderNode[]>(`${this.api}/folders`, { headers: this.headers(), params: { company, file: f.relativePath } }).subscribe({
      next: t => { this.folders.set(t); this.loading.set(false); const first = this.firstWithMail(t); if (first) this.pickFolder(first); },
      error: () => { this.error.set('Could not open this archive.'); this.loading.set(false); }
    });
  }

  private firstWithMail(nodes: FolderNode[]): FolderNode | null {
    for (const n of nodes) {
      if (n.count > 0) return n;
      const c = this.firstWithMail(n.children);
      if (c) return c;
    }
    return nodes.length ? nodes[0] : null;
  }

  pickFolder(f: FolderNode): void {
    this.selectedFolder.set(f);
    this.page.set(1); this.selectedMessage.set(null);
    this.loadMessages();
  }

  loadMessages(): void {
    const company = this.selectedCompany()!.key;
    const file = this.selectedFile()!.relativePath;
    const folder = this.selectedFolder()!.path;
    this.loading.set(true); this.error.set('');
    this.http.get<MessagePage>(`${this.api}/messages`, {
      headers: this.headers(),
      params: { company, file, folder, page: this.page(), pageSize: 50, search: this.search() }
    }).subscribe({
      next: m => { this.messages.set(m); this.loading.set(false); },
      error: () => { this.error.set('Could not load messages.'); this.loading.set(false); }
    });
  }

  openMessage(m: MessageSummary): void {
    const company = this.selectedCompany()!.key;
    const file = this.selectedFile()!.relativePath;
    const folder = this.selectedFolder()!.path;
    this.loading.set(true);
    this.http.get<MessageDetail>(`${this.api}/message`, {
      headers: this.headers(),
      params: { company, file, folder, index: m.index }
    }).subscribe({
      next: d => { this.selectedMessage.set(d); this.loading.set(false); },
      error: () => { this.error.set('Could not open message.'); this.loading.set(false); }
    });
  }

  doSearch(): void { this.page.set(1); this.loadMessages(); }

  nextPage(): void { const m = this.messages(); if (m && this.page() < m.totalPages) { this.page.update(p => p + 1); this.loadMessages(); } }
  prevPage(): void { if (this.page() > 1) { this.page.update(p => p - 1); this.loadMessages(); } }

  backToCompanies(): void { this.selectedCompany.set(null); this.selectedFile.set(null); this.files.set([]); this.folders.set([]); this.messages.set(null); this.selectedMessage.set(null); }
  backToFiles(): void { this.selectedFile.set(null); this.folders.set([]); this.messages.set(null); this.selectedMessage.set(null); }

  safeHtml(html: string): SafeHtml { return this.sanitizer.bypassSecurityTrustHtml(html); }

  openAttachment(a: AttachmentInfo): void {
    const d = this.selectedMessage();
    if (!d) return;
    const company = this.selectedCompany()!.key;
    const file = this.selectedFile()!.relativePath;
    const folder = this.selectedFolder()!.path;
    this.loading.set(true);
    this.http.get(`${this.api}/attachment`, {
      headers: this.headers(),
      params: { company, file, folder, index: d.index, att: a.attIndex },
      responseType: 'blob'
    }).subscribe({
      next: blob => {
        this.loading.set(false);
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        // Revoke later to allow the new tab to load.
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      },
      error: () => { this.loading.set(false); this.error.set('Could not open attachment.'); }
    });
  }

  formatSize(bytes: number): string {
    if (bytes >= 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB';
    if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(0) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return bytes + ' B';
  }
}
