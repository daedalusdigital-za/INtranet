import { Component, OnInit, OnDestroy, NgZone, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription } from 'rxjs';
import * as Y from 'yjs';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { CollaborativeDocsService } from '../../../services/collaborative-docs.service';
import { AuthService } from '../../../services/auth.service';
import { DocumentDetail, UserPresence } from '../../../models/collaborative-doc.model';

interface RemoteSelection {
  userId: number;
  userName: string;
  color: string;
  cell: string;
}

@Component({
  selector: 'app-sheet-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    NavbarComponent
  ],
  template: `
    <app-navbar></app-navbar>

    <div class="sheet-shell">
      @if (loading) {
        <div class="sheet-loading">
          <mat-spinner diameter="42"></mat-spinner>
          <p>Opening spreadsheet…</p>
        </div>
      } @else {
        <!-- Toolbar -->
        <div class="sheet-toolbar">
          <button mat-icon-button class="back-btn" (click)="goBack()" matTooltip="Back to documents">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <mat-icon class="sheet-glyph">table_chart</mat-icon>
          <div class="title-block">
            <span class="sheet-title">{{ title }}</span>
            <span class="sheet-sub">
              <span class="sync-dot" [class.online]="connected"></span>
              {{ connected ? 'Live · changes sync instantly' : 'Offline · reconnecting…' }}
            </span>
          </div>

          <div class="spacer"></div>

          <!-- Presence -->
          <div class="presence-stack">
            @for (u of activeUsers; track u.userId) {
              <div class="presence-avatar" [style.background]="u.color"
                   [matTooltip]="u.userName">
                {{ initials(u.userName) }}
              </div>
            }
          </div>

          <button mat-stroked-button class="save-btn" (click)="importCsv()" matTooltip="Import a CSV file into this sheet">
            <mat-icon>upload_file</mat-icon> Import
          </button>
          <button mat-stroked-button class="save-btn" (click)="downloadCsv()" matTooltip="Download this sheet as CSV">
            <mat-icon>download</mat-icon> Download
          </button>
          <button mat-stroked-button class="save-btn" (click)="manualSave()" matTooltip="Save a version snapshot">
            <mat-icon>save</mat-icon> Save
          </button>
          <input #csvInput type="file" accept=".csv,text/csv" hidden (change)="onCsvPicked($event)">
        </div>

        <!-- Formula bar -->
        <div class="formula-bar">
          <span class="cell-ref">{{ selected ? selected : '—' }}</span>
          <mat-icon class="fx">functions</mat-icon>
          <input class="formula-input"
                 [ngModel]="editValue"
                 (ngModelChange)="editValue = $event"
                 (focus)="editing = true"
                 (keydown.enter)="commit('down')"
                 [disabled]="!selected"
                 placeholder="Enter a value or a formula like =SUM(A1:A5)">
        </div>

        <!-- Grid -->
        <div class="grid-scroll">
          <table class="grid" (mouseleave)="null">
            <thead>
              <tr>
                <th class="corner"></th>
                @for (c of cols; track c) {
                  <th class="col-head" [class.active-head]="selCol === c">{{ colLetter(c) }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (r of rows; track r) {
                <tr>
                  <th class="row-head" [class.active-head]="selRow === r">{{ r + 1 }}</th>
                  @for (c of cols; track c) {
                    <td class="cell"
                        [class.selected]="selRow === r && selCol === c"
                        [class.numeric]="isNumeric(cellName(r, c))"
                        [style.borderColor]="remoteBorder(cellName(r, c))"
                        (click)="select(r, c)"
                        (dblclick)="startEdit(r, c)">
                      @if (editing && selRow === r && selCol === c) {
                        <input class="cell-input" #ci
                               [ngModel]="editValue"
                               (ngModelChange)="editValue = $event"
                               (keydown)="onCellKey($event)"
                               (blur)="commit('none')"
                               autofocus>
                      } @else {
                        <span class="cell-val">{{ display(r, c) }}</span>
                        @if (remoteTag(cellName(r, c)); as tag) {
                          <span class="remote-tag" [style.background]="tag.color">{{ tag.userName }}</span>
                        }
                      }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .sheet-shell { height: calc(100vh - 64px); display: flex; flex-direction: column; background: var(--canvas, #f5f7fa); }

    .sheet-loading { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; color: var(--ink-500, #64748b); }

    .sheet-toolbar {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 16px; background: #fff; border-bottom: 1px solid var(--ink-100, #eef2f7);
    }
    .sheet-glyph { color: #059669; }
    .title-block { display: flex; flex-direction: column; line-height: 1.15; }
    .sheet-title { font-family: var(--font-heading, inherit); font-weight: 700; font-size: 16px; color: var(--ink-900, #0f172a); }
    .sheet-sub { font-size: 12px; color: var(--ink-500, #64748b); display: flex; align-items: center; gap: 6px; }
    .sync-dot { width: 8px; height: 8px; border-radius: 50%; background: #cbd5e1; }
    .sync-dot.online { background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,0.18); }
    .spacer { flex: 1; }

    .presence-stack { display: flex; }
    .presence-avatar {
      width: 30px; height: 30px; border-radius: 50%; margin-left: -8px;
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 12px; font-weight: 700; border: 2px solid #fff;
    }

    .save-btn { margin-left: 8px; }

    .formula-bar {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 16px; background: #fff; border-bottom: 1px solid var(--ink-100, #eef2f7);
    }
    .cell-ref {
      min-width: 48px; text-align: center; font-weight: 700; font-size: 13px;
      color: var(--ink-700, #334155); background: var(--ink-100, #f1f5f9);
      border-radius: 6px; padding: 4px 8px; font-variant-numeric: tabular-nums;
    }
    .fx { color: var(--ink-500, #64748b); font-size: 20px; }
    .formula-input {
      flex: 1; border: 1px solid var(--ink-300, #cbd5e1); border-radius: 8px;
      padding: 8px 12px; font-size: 14px; outline: none; font-family: var(--font-body, inherit);
    }
    .formula-input:focus { border-color: var(--brand-500, #3b82f6); box-shadow: 0 0 0 3px var(--brand-100, #dbeafe); }

    .grid-scroll { flex: 1; overflow: auto; }
    .grid { border-collapse: separate; border-spacing: 0; table-layout: fixed; }

    .grid th, .grid td { border-right: 1px solid #e6ebf2; border-bottom: 1px solid #e6ebf2; }

    .corner { width: 46px; position: sticky; left: 0; top: 0; z-index: 3; background: #f1f5f9; }
    thead th { position: sticky; top: 0; z-index: 2; }
    .col-head {
      width: 104px; height: 26px; background: #f1f5f9; color: #475569;
      font-size: 12px; font-weight: 600; text-align: center;
    }
    .row-head {
      width: 46px; background: #f1f5f9; color: #475569; font-size: 12px; font-weight: 600;
      text-align: center; position: sticky; left: 0; z-index: 1;
    }
    .active-head { background: #dbeafe; color: #1d4ed8; }

    .cell {
      width: 104px; height: 26px; padding: 0; background: #fff;
      position: relative; cursor: cell; overflow: hidden;
    }
    .cell-val {
      display: block; padding: 3px 6px; font-size: 13px; color: #0f172a;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 20px;
    }
    .cell.numeric .cell-val { text-align: right; font-variant-numeric: tabular-nums; }
    .cell.selected { outline: 2px solid var(--brand-600, #2563eb); outline-offset: -2px; z-index: 1; }

    .cell-input {
      width: 100%; height: 100%; border: none; outline: none; padding: 3px 6px;
      font-size: 13px; font-family: var(--font-body, inherit); box-sizing: border-box;
    }

    .remote-tag {
      position: absolute; top: -1px; right: -1px; font-size: 9px; color: #fff;
      padding: 1px 4px; border-radius: 0 0 0 4px; font-weight: 700; pointer-events: none;
      max-width: 90%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
  `]
})
export class SheetEditorComponent implements OnInit, OnDestroy {
  private readonly ROWS = 60;
  private readonly COLS = 26; // A..Z

  @ViewChild('csvInput') csvInput!: ElementRef<HTMLInputElement>;

  rows: number[] = [];
  cols: number[] = [];

  documentId = 0;
  title = 'Spreadsheet';
  loading = true;
  connected = false;

  // Yjs
  private ydoc!: Y.Doc;
  private ycells!: Y.Map<string>;

  // Local mirror + computed cache
  private raw: Record<string, string> = {};
  private computed: Record<string, string> = {};

  // Selection / editing
  selected: string | null = null;
  selRow = -1;
  selCol = -1;
  editing = false;
  editValue = '';

  // Presence
  activeUsers: UserPresence[] = [];
  private connectionUserMap = new Map<string, number>();
  private remoteSelections = new Map<string, RemoteSelection>(); // key: connectionId
  currentUserName = 'Unknown';
  currentUserColor = '#2563eb';
  private currentUserId = 0;

  private subs: Subscription[] = [];
  private autosaveTimer: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private docsService: CollaborativeDocsService,
    private authService: AuthService,
    private snackBar: MatSnackBar,
    private zone: NgZone
  ) {
    for (let r = 0; r < this.ROWS; r++) this.rows.push(r);
    for (let c = 0; c < this.COLS; c++) this.cols.push(c);
  }

  ngOnInit(): void {
    this.documentId = Number(this.route.snapshot.paramMap.get('id'));
    const user = this.authService.currentUserValue;
    this.currentUserName = user?.name || user?.email || 'Unknown';
    this.currentUserId = Number(user?.userId) || 0;
    this.currentUserColor = this.pickColor(this.currentUserId);

    this.docsService.getDocument(this.documentId).subscribe({
      next: (detail: DocumentDetail) => {
        this.title = detail.title || 'Spreadsheet';
        this.initYjs(detail.yjsState);
        this.loading = false;
        this.setupRealtime();
        this.startAutosave();
        this.applyImportSeedIfAny();
      },
      error: () => {
        this.snackBar.open('Could not open spreadsheet', 'Close', { duration: 3000 });
        this.router.navigate(['/docs']);
      }
    });
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    if (this.autosaveTimer) clearInterval(this.autosaveTimer);
    this.saveSnapshot();
    this.docsService.leaveDocument(this.documentId).catch(() => {});
  }

  // ---------------- Yjs ----------------
  private initYjs(initialState?: string): void {
    this.ydoc = new Y.Doc();
    this.ycells = this.ydoc.getMap<string>('cells');

    if (initialState) {
      try {
        Y.applyUpdate(this.ydoc, this.base64ToUint8(initialState), 'remote');
      } catch { /* ignore corrupt snapshot */ }
    }

    this.syncFromDoc();

    // Observe changes (local + remote) to refresh the view
    this.ycells.observe(() => {
      this.zone.run(() => this.syncFromDoc());
    });

    // Broadcast local changes to peers
    this.ydoc.on('update', (update: Uint8Array, origin: any) => {
      if (origin === 'remote') return;
      this.docsService.broadcastUpdate(this.documentId, this.uint8ToBase64(update)).catch(() => {});
    });
  }

  private syncFromDoc(): void {
    this.raw = {};
    this.ycells.forEach((v, k) => { this.raw[k] = v; });
    this.recompute();
  }

  private async setupRealtime(): Promise<void> {
    const token = this.authService.getToken();
    if (!token) return;
    try {
      await this.docsService.startConnection(token);
      await this.docsService.joinDocument(this.documentId);
      this.connected = true;

      this.subs.push(this.docsService.connectionState$.subscribe(s => {
        this.zone.run(() => this.connected = s === 'Connected');
      }));

      // Remote document updates
      this.subs.push(this.docsService.documentUpdate$.subscribe(update => {
        try {
          Y.applyUpdate(this.ydoc, this.base64ToUint8(update), 'remote');
        } catch { /* ignore */ }
      }));

      // Presence
      this.subs.push(this.docsService.presenceSync$.subscribe(users => {
        this.zone.run(() => this.activeUsers = users);
      }));
      this.subs.push(this.docsService.userJoined$.subscribe(({ connectionId, presence }) => {
        this.zone.run(() => {
          this.connectionUserMap.set(connectionId, presence.userId);
          if (!this.activeUsers.find(u => u.userId === presence.userId)) {
            this.activeUsers = [...this.activeUsers, presence];
          }
        });
      }));
      this.subs.push(this.docsService.userLeft$.subscribe(connectionId => {
        this.zone.run(() => {
          const uid = this.connectionUserMap.get(connectionId);
          this.connectionUserMap.delete(connectionId);
          this.remoteSelections.delete(connectionId);
          if (uid && !Array.from(this.connectionUserMap.values()).includes(uid)) {
            this.activeUsers = this.activeUsers.filter(u => u.userId !== uid);
          }
        });
      }));

      // Remote cell selection (encoded into cursor from/to as a cell index)
      this.subs.push(this.docsService.cursorUpdate$.subscribe(({ connectionId, presence }) => {
        this.zone.run(() => {
          const idx = presence.cursor?.from ?? -1;
          if (idx < 0) { this.remoteSelections.delete(connectionId); return; }
          this.remoteSelections.set(connectionId, {
            userId: presence.userId,
            userName: presence.userName,
            color: presence.color,
            cell: this.indexToCell(idx)
          });
        });
      }));

      // Late-joiner sync exchange
      this.subs.push(this.docsService.syncRequested$.subscribe(targetConnId => {
        const state = Y.encodeStateAsUpdate(this.ydoc);
        this.docsService.sendSyncData(targetConnId, this.uint8ToBase64(state)).catch(() => {});
      }));
      this.subs.push(this.docsService.syncData$.subscribe(state => {
        try { Y.applyUpdate(this.ydoc, this.base64ToUint8(state), 'remote'); } catch { /* ignore */ }
      }));

      await this.docsService.requestSync(this.documentId);
    } catch {
      this.connected = false;
    }
  }

  private startAutosave(): void {
    this.autosaveTimer = setInterval(() => this.saveSnapshot(), 30000);
  }

  private async saveSnapshot(): Promise<void> {
    if (!this.ydoc) return;
    try {
      const state = Y.encodeStateAsUpdate(this.ydoc);
      await this.docsService.saveSnapshot(this.documentId, {
        documentId: this.documentId,
        yjsState: this.uint8ToBase64(state)
      }).toPromise();
    } catch { /* non-fatal */ }
  }

  manualSave(): void {
    this.saveSnapshot().then(() => this.snackBar.open('Version saved', 'Close', { duration: 1500 }));
  }

  // ---------------- Selection & editing ----------------
  select(r: number, c: number): void {
    this.commit('none'); // commit any pending edit first
    this.selRow = r; this.selCol = c;
    this.selected = this.cellName(r, c);
    this.editing = false;
    this.editValue = this.raw[this.selected] ?? '';
    this.broadcastSelection();
  }

  startEdit(r: number, c: number): void {
    if (this.selRow !== r || this.selCol !== c) this.select(r, c);
    this.editValue = this.raw[this.selected!] ?? '';
    this.editing = true;
  }

  onCellKey(e: KeyboardEvent): void {
    if (e.key === 'Enter') { e.preventDefault(); this.commit('down'); }
    else if (e.key === 'Tab') { e.preventDefault(); this.commit(e.shiftKey ? 'left' : 'right'); }
    else if (e.key === 'Escape') { e.preventDefault(); this.editing = false; this.editValue = this.raw[this.selected!] ?? ''; }
  }

  @HostListener('document:keydown', ['$event'])
  onGlobalKey(e: KeyboardEvent): void {
    if (this.loading || !this.selected) return;
    const tag = (e.target as HTMLElement)?.tagName;
    if (this.editing || tag === 'INPUT' || tag === 'TEXTAREA') return;

    if (e.key === 'Enter') { e.preventDefault(); this.startEdit(this.selRow, this.selCol); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); this.setCell(this.selected, ''); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); this.move('up'); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); this.move('down'); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); this.move('left'); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); this.move('right'); return; }
    if (e.key === 'Tab') { e.preventDefault(); this.move(e.shiftKey ? 'left' : 'right'); return; }
    // Start typing to replace
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      this.editValue = e.key;
      this.editing = true;
    }
  }

  commit(move: 'none' | 'down' | 'right' | 'left' | 'up'): void {
    if (this.editing && this.selected) {
      const current = this.raw[this.selected] ?? '';
      if (this.editValue !== current) this.setCell(this.selected, this.editValue);
    }
    this.editing = false;
    if (move !== 'none') this.move(move);
  }

  private move(dir: 'up' | 'down' | 'left' | 'right'): void {
    let r = this.selRow, c = this.selCol;
    if (dir === 'up') r = Math.max(0, r - 1);
    if (dir === 'down') r = Math.min(this.ROWS - 1, r + 1);
    if (dir === 'left') c = Math.max(0, c - 1);
    if (dir === 'right') c = Math.min(this.COLS - 1, c + 1);
    this.select(r, c);
  }

  private setCell(cell: string, value: string): void {
    if (value === '') this.ycells.delete(cell);
    else this.ycells.set(cell, value);
    // observe() will refresh; keep formula bar in sync
    this.editValue = value;
  }

  private broadcastSelection(): void {
    if (this.selRow < 0) return;
    const idx = this.cellToIndex(this.selRow, this.selCol);
    this.docsService.updateCursor(this.documentId, idx, idx).catch(() => {});
  }

  // ---------------- Rendering helpers ----------------
  display(r: number, c: number): string {
    return this.computed[this.cellName(r, c)] ?? '';
  }

  isNumeric(cell: string): boolean {
    const v = this.computed[cell];
    return v !== undefined && v !== '' && !isNaN(Number(v));
  }

  remoteTag(cell: string): RemoteSelection | null {
    for (const sel of this.remoteSelections.values()) {
      if (sel.cell === cell && sel.userId !== this.currentUserId) return sel;
    }
    return null;
  }

  remoteBorder(cell: string): string | null {
    const tag = this.remoteTag(cell);
    return tag ? tag.color : null;
  }

  initials(name: string): string {
    return (name || '?').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  }

  goBack(): void { this.router.navigate(['/docs']); }

  // ---------------- CSV import / export ----------------

  /** Export the sheet's computed values to a CSV file and download it. */
  downloadCsv(): void {
    // Find the used range so we don't export a giant empty grid.
    let maxR = -1, maxC = -1;
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        const v = this.computed[this.cellName(r, c)];
        if (v !== undefined && v !== '') { if (r > maxR) maxR = r; if (c > maxC) maxC = c; }
      }
    }
    if (maxR < 0) { this.snackBar.open('Sheet is empty — nothing to download', 'Close', { duration: 2500 }); return; }

    const escape = (val: string): string => {
      const s = val ?? '';
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines: string[] = [];
    for (let r = 0; r <= maxR; r++) {
      const row: string[] = [];
      for (let c = 0; c <= maxC; c++) row.push(escape(this.computed[this.cellName(r, c)] ?? ''));
      lines.push(row.join(','));
    }
    const csv = '\uFEFF' + lines.join('\r\n'); // BOM for Excel
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(this.title || 'spreadsheet').replace(/[^\w.-]+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Trigger the hidden file picker for CSV import. */
  importCsv(): void {
    this.csvInput?.nativeElement?.click();
  }

  /** Seed a freshly-created sheet from a file imported on the list page. */
  private applyImportSeedIfAny(): void {
    try {
      const key = `collab-import-sheet-${this.documentId}`;
      const csv = sessionStorage.getItem(key);
      if (!csv) return;
      sessionStorage.removeItem(key);
      const rows = this.parseCsv(csv);
      if (rows.length === 0) return;
      this.ydoc.transact(() => {
        for (let r = 0; r < rows.length && r < this.ROWS; r++) {
          const cells = rows[r];
          for (let c = 0; c < cells.length && c < this.COLS; c++) {
            const name = this.cellName(r, c);
            const value = cells[c] ?? '';
            if (value === '') this.ycells.delete(name);
            else this.ycells.set(name, value);
          }
        }
      });
      this.snackBar.open(`Imported ${Math.min(rows.length, this.ROWS)} row(s)`, 'Close', { duration: 3000 });
    } catch { /* ignore malformed seed */ }
  }

  onCsvPicked(evt: Event): void {
    const input = evt.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const rows = this.parseCsv(text);
        if (rows.length === 0) { this.snackBar.open('No rows found in CSV', 'Close', { duration: 2500 }); return; }
        // Write into the shared doc in a single transaction starting at A1.
        this.ydoc.transact(() => {
          for (let r = 0; r < rows.length && r < this.ROWS; r++) {
            const cells = rows[r];
            for (let c = 0; c < cells.length && c < this.COLS; c++) {
              const name = this.cellName(r, c);
              const value = cells[c] ?? '';
              if (value === '') this.ycells.delete(name);
              else this.ycells.set(name, value);
            }
          }
        });
        this.snackBar.open(`Imported ${Math.min(rows.length, this.ROWS)} row(s) from ${file.name}`, 'Close', { duration: 3500 });
      } catch {
        this.snackBar.open('Could not read that CSV file', 'Close', { duration: 3000 });
      }
    };
    reader.readAsText(file);
  }

  /** Minimal RFC-4180 CSV parser supporting quoted fields and embedded newlines. */
  private parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ',') { row.push(field); field = ''; }
        else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else if (ch === '\r') { /* handled with \n */ }
        else field += ch;
      }
    }
    // Flush last field/row
    if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
    // Drop a trailing empty row
    if (rows.length && rows[rows.length - 1].every(f => f === '')) rows.pop();
    return rows;
  }

  // ---------------- Formula engine ----------------
  private recompute(): void {
    this.computed = {};
    const visiting = new Set<string>();
    for (const key of Object.keys(this.raw)) {
      this.computed[key] = this.evalCell(key, visiting);
    }
  }

  private evalCell(cell: string, visiting: Set<string>): string {
    if (this.computed[cell] !== undefined && !visiting.has(cell)) return this.computed[cell];
    const rawVal = this.raw[cell];
    if (rawVal === undefined || rawVal === '') return '';
    if (!rawVal.startsWith('=')) return rawVal;

    if (visiting.has(cell)) return '#CYCLE';
    visiting.add(cell);
    let result: string;
    try {
      result = this.formatNum(this.evalFormula(rawVal.slice(1), visiting));
    } catch {
      result = '#ERR';
    }
    visiting.delete(cell);
    this.computed[cell] = result;
    return result;
  }

  private cellNumber(cell: string, visiting: Set<string>): number {
    const v = this.evalCell(cell, visiting);
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  }

  private evalFormula(expr: string, visiting: Set<string>): number {
    // Resolve range functions first: SUM/AVERAGE/MIN/MAX/COUNT(A1:B2)
    expr = expr.replace(/(SUM|AVERAGE|AVG|MIN|MAX|COUNT)\s*\(([^)]*)\)/gi, (_m, fn, args) => {
      const nums = this.expandArgs(args, visiting);
      const f = (fn as string).toUpperCase();
      let val = 0;
      if (f === 'SUM') val = nums.reduce((a, b) => a + b, 0);
      else if (f === 'AVERAGE' || f === 'AVG') val = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
      else if (f === 'MIN') val = nums.length ? Math.min(...nums) : 0;
      else if (f === 'MAX') val = nums.length ? Math.max(...nums) : 0;
      else if (f === 'COUNT') val = nums.length;
      return '(' + val + ')';
    });

    // Replace remaining single cell refs (A1) with their numeric value
    expr = expr.replace(/\$?([A-Z]{1,2})\$?(\d{1,3})/gi, (m) => {
      const ref = m.replace(/\$/g, '').toUpperCase();
      return '(' + this.cellNumber(ref, visiting) + ')';
    });

    return this.evalArithmetic(expr);
  }

  private expandArgs(args: string, visiting: Set<string>): number[] {
    const out: number[] = [];
    for (const part of args.split(',')) {
      const token = part.trim();
      if (!token) continue;
      const range = token.match(/^\$?([A-Z]{1,2})\$?(\d{1,3})\s*:\s*\$?([A-Z]{1,2})\$?(\d{1,3})$/i);
      if (range) {
        const c1 = this.letterToCol(range[1].toUpperCase()); const r1 = Number(range[2]) - 1;
        const c2 = this.letterToCol(range[3].toUpperCase()); const r2 = Number(range[4]) - 1;
        for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
          for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
            out.push(this.cellNumber(this.cellName(r, c), visiting));
          }
        }
      } else if (/^\$?[A-Z]{1,2}\$?\d{1,3}$/i.test(token)) {
        out.push(this.cellNumber(token.replace(/\$/g, '').toUpperCase(), visiting));
      } else {
        const n = Number(token);
        if (!isNaN(n)) out.push(n);
      }
    }
    return out;
  }

  /** Safe arithmetic evaluator (shunting-yard, no eval). Supports + - * / ( ) */
  private evalArithmetic(expr: string): number {
    const tokens = expr.match(/\d+\.?\d*|[()+\-*/]/g);
    if (!tokens) return 0;
    const out: (number | string)[] = [];
    const ops: string[] = [];
    const prec: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };
    let prev: string | null = null;
    for (let t of tokens) {
      if (/^\d/.test(t)) { out.push(Number(t)); }
      else if (t === '(') { ops.push(t); }
      else if (t === ')') {
        while (ops.length && ops[ops.length - 1] !== '(') out.push(ops.pop()!);
        ops.pop();
      } else {
        // unary minus/plus
        if ((t === '-' || t === '+') && (prev === null || prev === '(' || '+-*/'.includes(prev))) {
          out.push(0);
        }
        while (ops.length && ops[ops.length - 1] !== '(' && prec[ops[ops.length - 1]] >= prec[t]) {
          out.push(ops.pop()!);
        }
        ops.push(t);
      }
      prev = t;
    }
    while (ops.length) out.push(ops.pop()!);

    const st: number[] = [];
    for (const tok of out) {
      if (typeof tok === 'number') st.push(tok);
      else {
        const b = st.pop() ?? 0; const a = st.pop() ?? 0;
        if (tok === '+') st.push(a + b);
        else if (tok === '-') st.push(a - b);
        else if (tok === '*') st.push(a * b);
        else if (tok === '/') st.push(b === 0 ? NaN : a / b);
      }
    }
    const res = st.pop();
    if (res === undefined || isNaN(res)) throw new Error('bad');
    return res;
  }

  private formatNum(n: number): string {
    if (!isFinite(n)) return '#ERR';
    return Number.isInteger(n) ? String(n) : String(Math.round(n * 1e6) / 1e6);
  }

  // ---------------- Coordinate helpers ----------------
  colLetter(c: number): string { return this.numToLetter(c); }
  cellName(r: number, c: number): string { return this.numToLetter(c) + (r + 1); }

  private numToLetter(c: number): string {
    let s = ''; c++;
    while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); }
    return s;
  }
  private letterToCol(letters: string): number {
    let c = 0;
    for (const ch of letters) c = c * 26 + (ch.charCodeAt(0) - 64);
    return c - 1;
  }
  private cellToIndex(r: number, c: number): number { return r * this.COLS + c; }
  private indexToCell(idx: number): string {
    const r = Math.floor(idx / this.COLS); const c = idx % this.COLS;
    return this.cellName(r, c);
  }

  private pickColor(id: number): string {
    const colors = ['#2563eb', '#059669', '#d97706', '#db2777', '#7c3aed', '#0891b2', '#dc2626', '#65a30d'];
    return colors[Math.abs(id) % colors.length];
  }

  // ---------------- base64 ----------------
  private uint8ToBase64(data: Uint8Array): string {
    let binary = ''; const chunk = 8192;
    for (let i = 0; i < data.length; i += chunk) {
      binary += String.fromCharCode(...data.subarray(i, Math.min(i + chunk, data.length)));
    }
    return btoa(binary);
  }
  private base64ToUint8(b64: string): Uint8Array {
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  }
}
