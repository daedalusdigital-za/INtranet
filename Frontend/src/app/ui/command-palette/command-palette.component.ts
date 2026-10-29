import {
  Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild, computed, inject, signal
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Subject, Subscription, debounceTime, distinctUntilChanged, of, switchMap, catchError } from 'rxjs';
import { MessageService, User } from '../../services/message.service';

export interface PaletteCommand {
  group: 'Pages' | 'Tools' | 'Account';
  label: string;
  icon: string;
  /** Extra words that should match, e.g. "hr leave" for People. */
  keywords?: string;
  hint?: string;
  run: () => void;
}

interface PaletteRow {
  key: string;
  group: string;
  label: string;
  icon: string;
  hint?: string;
  run: () => void;
}

/**
 * One search for the whole intranet, opened with Ctrl K (design review D-06).
 * Finds pages and tools, people to message, and looks up invoices, items and
 * barcodes in Paperless. A barcode scanner types into the box and presses Enter.
 */
@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="cp-scrim" (click)="close.emit()"></div>
    <div class="cp" role="dialog" aria-modal="true" aria-label="Search the intranet" (keydown)="onKeydown($event)">
      <div class="cp-input">
        <mat-icon>search</mat-icon>
        <input #box type="text" [value]="query()" (input)="onInput(box.value)"
               placeholder="Search pages, tools and people, or scan a barcode"
               role="combobox" aria-expanded="true" aria-controls="cp-list" aria-autocomplete="list"
               [attr.aria-activedescendant]="rows()[active()] ? 'cp-' + active() : null"
               autocomplete="off" spellcheck="false" />
        <kbd>Esc</kbd>
      </div>
      <div class="cp-list" id="cp-list" role="listbox">
        @for (row of rows(); track row.key; let i = $index) {
          @if (i === 0 || rows()[i - 1].group !== row.group) {
            <div class="cp-group" role="presentation">{{ row.group }}</div>
          }
          <div class="cp-row" role="option" [id]="'cp-' + i" [class.on]="i === active()" [attr.aria-selected]="i === active()"
               (mouseenter)="active.set(i)" (click)="choose(row)">
            <mat-icon>{{ row.icon }}</mat-icon>
            <span class="cp-label">{{ row.label }}</span>
            @if (row.hint) { <span class="cp-hint">{{ row.hint }}</span> }
          </div>
        } @empty {
          <div class="cp-empty">Nothing matches "{{ query() }}". Try a page name, a person, or an invoice number.</div>
        }
      </div>
      <div class="cp-foot">
        <span><kbd>↑</kbd> <kbd>↓</kbd> move</span>
        <span><kbd>Enter</kbd> open</span>
        @if (peopleLoading()) { <span class="cp-busy">Searching people…</span> }
      </div>
    </div>
  `,
  styles: [`
    :host { position: fixed; inset: 0; z-index: 1200; }
    .cp-scrim { position: absolute; inset: 0; background: rgba(26, 25, 54, 0.42); }
    .cp {
      position: absolute; top: 12vh; left: 50%; transform: translateX(-50%);
      width: min(640px, calc(100vw - 24px)); max-height: 70vh;
      display: flex; flex-direction: column; overflow: hidden;
      background: var(--color-surface); color: var(--color-text);
      border: 1px solid var(--color-line); border-radius: 14px; box-shadow: var(--shadow-lg);
    }
    .cp-input { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--color-line); }
    .cp-input mat-icon { color: var(--color-text-3); }
    .cp-input input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: 500 16px var(--font-body); color: var(--color-text); }
    .cp-input input:focus { box-shadow: none; }
    kbd { font: 500 11px var(--font-mono); color: var(--color-text-3); border: 1px solid var(--color-line-strong); border-radius: 5px; padding: 1px 6px; background: var(--color-surface); }
    .cp-list { overflow-y: auto; padding: 6px; }
    .cp-group { font-size: 11px; font-weight: 750; color: var(--color-text-3); text-transform: uppercase; letter-spacing: 0.06em; padding: 10px 10px 6px; }
    .cp-row { display: flex; align-items: center; gap: 12px; padding: 8px 10px; border-radius: 8px; cursor: pointer; font-size: 14px; }
    .cp-row mat-icon { color: var(--color-text-3); font-size: 20px; width: 20px; height: 20px; }
    .cp-row.on { background: var(--color-primary-soft); }
    .cp-row.on mat-icon { color: var(--color-primary); }
    .cp-label { flex: 1; min-width: 0; font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .cp-hint { font-size: 12.5px; color: var(--color-text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 45%; }
    .cp-empty { padding: 20px 12px; color: var(--color-text-3); font-size: 13.5px; }
    .cp-foot { display: flex; gap: 16px; padding: 9px 16px; border-top: 1px solid var(--color-line); font-size: 12px; color: var(--color-text-3); }
    .cp-busy { margin-left: auto; }
  `]
})
export class CommandPaletteComponent implements OnInit, OnDestroy {
  @Input() commands: PaletteCommand[] = [];
  @Input() currentUserId = 0;
  @Output() close = new EventEmitter<void>();
  @Output() messagePerson = new EventEmitter<User>();
  @Output() lookup = new EventEmitter<string>();

  @ViewChild('box', { static: true }) box!: ElementRef<HTMLInputElement>;

  private readonly messages = inject(MessageService);
  readonly query = signal('');
  readonly active = signal(0);
  readonly people = signal<User[]>([]);
  readonly peopleLoading = signal(false);
  private readonly peopleQuery$ = new Subject<string>();
  private sub?: Subscription;

  readonly rows = computed<PaletteRow[]>(() => {
    const q = this.query().trim().toLowerCase();
    const rows: PaletteRow[] = [];
    const lookupRow: PaletteRow | null = q ? {
      key: 'lookup', group: 'Look up', icon: 'qr_code_scanner',
      label: `Look up "${this.query().trim()}" in Paperless`, hint: 'Invoice, item or barcode',
      run: () => this.lookup.emit(this.query().trim())
    } : null;
    // Something that looks like a reference (contains a digit) is most likely a scan or invoice number.
    const looksLikeReference = /\d/.test(q) && !q.includes(' ');
    if (lookupRow && looksLikeReference) rows.push(lookupRow);

    const matches = this.commands.filter(c => !q || `${c.label} ${c.keywords ?? ''} ${c.group}`.toLowerCase().includes(q));
    for (const c of matches.slice(0, q ? 12 : 30)) {
      rows.push({ key: `${c.group}:${c.label}`, group: c.group, label: c.label, icon: c.icon, hint: c.hint, run: c.run });
    }
    for (const u of this.people().slice(0, 6)) {
      rows.push({
        key: `person:${u.userId}`, group: 'People', icon: 'chat',
        label: `Message ${u.name} ${u.surname}`.trim(),
        hint: u.department || u.title || u.email,
        run: () => this.messagePerson.emit(u)
      });
    }
    if (lookupRow && !looksLikeReference) rows.push(lookupRow);
    return rows;
  });

  ngOnInit(): void {
    this.sub = this.peopleQuery$.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      switchMap(q => {
        if (q.length < 2 || /\d/.test(q)) { this.peopleLoading.set(false); return of([] as User[]); }
        this.peopleLoading.set(true);
        return this.messages.searchUsers(q, this.currentUserId).pipe(catchError(() => of([] as User[])));
      })
    ).subscribe(users => {
      this.peopleLoading.set(false);
      this.people.set(users ?? []);
    });
    queueMicrotask(() => this.box.nativeElement.focus());
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  onInput(value: string): void {
    this.query.set(value);
    this.active.set(0);
    this.peopleQuery$.next(value.trim());
  }

  onKeydown(event: KeyboardEvent): void {
    const count = this.rows().length;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (count) this.active.set((this.active() + 1) % count);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (count) this.active.set((this.active() - 1 + count) % count);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const row = this.rows()[this.active()];
      if (row) this.choose(row);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.close.emit();
    }
  }

  choose(row: PaletteRow): void {
    this.close.emit();
    row.run();
  }
}
