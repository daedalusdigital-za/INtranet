import { Component, EventEmitter, Output, computed, effect, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ChipTone, StatusChipComponent } from '../status-chip/status-chip.component';
import { SkeletonRowsComponent } from '../skeleton-rows/skeleton-rows.component';
import { AppearanceService } from '../appearance.service';

export type ColumnType = 'text' | 'ref' | 'money' | 'number' | 'date' | 'status';

export interface TableColumn<T> {
  key: string;
  label: string;
  /** How the value is shown. Money and numbers are right-aligned in tabular figures, refs in mono. */
  type?: ColumnType;
  /** The cell's value. Also used for sorting and search. */
  value: (row: T) => unknown;
  /** Optional second line under the value, e.g. a department or "3 items". */
  sub?: (row: T) => string | null | undefined;
  /** For money columns. Defaults to ZAR. */
  currency?: string;
  /** For status columns, when the word alone doesn't say the tone. */
  tone?: (row: T) => ChipTone | undefined;
  /** Hidden until switched on in Columns. */
  hidden?: boolean;
  sortable?: boolean;
}

/** A saved view: a named filter shown as a tab above the table, with its count. */
export interface TableView<T> {
  id: string;
  label: string;
  filter?: (row: T) => boolean;
}

export interface RowAction<T> {
  label: string;
  icon: string;
  run: (row: T) => void;
  show?: (row: T) => boolean;
  danger?: boolean;
}

export interface BulkAction<T> {
  label: string;
  icon?: string;
  run: (rows: T[]) => void;
  danger?: boolean;
}

interface TablePrefs { hidden?: string[]; rows?: 'compact' | 'comfortable'; dense?: boolean; view?: string }

const PAGE_SIZE = 50;

/**
 * The shared list (design review D-09): saved views with counts, search, sorting,
 * a column chooser, density, row selection with bulk actions, and row actions in one
 * menu at the end of the row. Column choice, density and the last view are remembered
 * per table on this browser.
 *
 *   <app-data-table tableId="finance-pos" [rows]="orders" [columns]="columns" [views]="views"
 *     [rowActions]="actions" [loading]="loading" itemName="purchase orders" />
 */
@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule, StatusChipComponent, SkeletonRowsComponent],
  template: `
    <div class="dt" [class.dense]="dense()">
      <div class="dt-bar">
        @if (views().length > 1) {
          <div class="dt-views" role="tablist" aria-label="Views">
            @for (v of views(); track v.id) {
              <button type="button" role="tab" class="dt-view" [class.on]="v.id === viewId()" [attr.aria-selected]="v.id === viewId()"
                      (click)="setView(v.id)">{{ v.label }}<span class="dt-n">{{ viewCounts()[v.id] }}</span></button>
            }
          </div>
        }
        <div class="dt-tools">
          <label class="dt-search">
            <mat-icon aria-hidden="true">search</mat-icon>
            <input type="search" [placeholder]="'Search ' + itemName()" [attr.aria-label]="'Search ' + itemName()"
                   [value]="query()" (input)="setQuery($any($event.target).value)">
          </label>
          <button mat-stroked-button class="dt-cols" [matMenuTriggerFor]="colMenu"><mat-icon>view_column</mat-icon>Columns</button>
          <mat-menu #colMenu="matMenu" class="shell-menu">
            @for (c of columns(); track c.key) {
              <button mat-menu-item (click)="toggleColumn(c.key); $event.stopPropagation()" role="menuitemcheckbox" [attr.aria-checked]="!hidden().has(c.key)">
                <mat-icon>{{ hidden().has(c.key) ? 'check_box_outline_blank' : 'check_box' }}</mat-icon><span>{{ c.label }}</span>
              </button>
            }
            <button mat-menu-item (click)="toggleDense(); $event.stopPropagation()" role="menuitemcheckbox" [attr.aria-checked]="dense()">
              <mat-icon>{{ dense() ? 'check_box' : 'check_box_outline_blank' }}</mat-icon><span>Compact rows</span>
            </button>
          </mat-menu>
        </div>
      </div>

      @if (selected().size && bulkActions().length) {
        <div class="dt-bulk" role="region" aria-label="Selected rows">
          <b>{{ selected().size }} selected</b>
          @for (b of bulkActions(); track b.label) {
            <button mat-stroked-button [class.danger]="b.danger" (click)="runBulk(b)">@if (b.icon) {<mat-icon>{{ b.icon }}</mat-icon>}{{ b.label }}</button>
          }
          <button mat-button (click)="clearSelection()">Clear</button>
        </div>
      }

      <div class="dt-scroll">
        @if (loading()) {
          <app-skeleton-rows [rows]="6" [avatar]="false"></app-skeleton-rows>
        } @else if (!filtered().length) {
          <div class="dt-empty">
            @if (!rows().length) {
              <mat-icon aria-hidden="true">{{ emptyIcon() }}</mat-icon>
              <b>{{ emptyTitle() || 'No ' + itemName() + ' yet' }}</b>
              @if (emptyMessage()) { <p>{{ emptyMessage() }}</p> }
            } @else {
              <mat-icon aria-hidden="true">filter_alt_off</mat-icon>
              <b>No {{ itemName() }} match {{ filterDescription() }}</b>
              <button mat-stroked-button (click)="clearFilters()">Clear the filter</button>
            }
          </div>
        } @else {
          <table>
            @if (caption()) { <caption class="sr-only">{{ caption() }}</caption> }
            <thead>
              <tr>
                @if (bulkActions().length) {
                  <th class="c-sel" scope="col">
                    <input type="checkbox" aria-label="Select all rows on this page" [checked]="allOnPageSelected()"
                           [indeterminate]="someOnPageSelected()" (change)="togglePage()">
                  </th>
                }
                @for (c of visibleColumns(); track c.key) {
                  <th scope="col" [class]="'t-' + (c.type || 'text')" [attr.aria-sort]="sortKey() === c.key ? (sortDir() === 1 ? 'ascending' : 'descending') : null">
                    @if (c.sortable !== false) {
                      <button type="button" class="sort" (click)="sortBy(c.key)">{{ c.label }}
                        <mat-icon aria-hidden="true">{{ sortKey() === c.key ? (sortDir() === 1 ? 'arrow_upward' : 'arrow_downward') : 'unfold_more' }}</mat-icon>
                      </button>
                    } @else { {{ c.label }} }
                  </th>
                }
                @if (rowActions().length) { <th class="c-act" scope="col"><span class="sr-only">Actions</span></th> }
              </tr>
            </thead>
            <tbody>
              @for (row of pageRows(); track trackKey(row, $index)) {
                <tr [class.sel]="selected().has(row)" [class.click]="rowClick.observed"
                    (click)="rowClick.observed && rowClick.emit(row)" (keydown.enter)="rowClick.observed && rowClick.emit(row)"
                    [attr.tabindex]="rowClick.observed ? 0 : null">
                  @if (bulkActions().length) {
                    <td class="c-sel" (click)="$event.stopPropagation()">
                      <input type="checkbox" [attr.aria-label]="'Select ' + rowLabel(row)" [checked]="selected().has(row)" (change)="toggleRow(row)">
                    </td>
                  }
                  @for (c of visibleColumns(); track c.key) {
                    <td [class]="'t-' + (c.type || 'text')">
                      @switch (c.type) {
                        @case ('status') { <app-status-chip [status]="text(c, row)" [tone]="c.tone?.(row)"></app-status-chip> }
                        @default { <span class="v">{{ text(c, row) }}</span> }
                      }
                      @if (c.sub?.(row); as s) { <small>{{ s }}</small> }
                    </td>
                  }
                  @if (rowActions().length) {
                    <td class="c-act" (click)="$event.stopPropagation()">
                      <button mat-icon-button [matMenuTriggerFor]="rowMenu" [matMenuTriggerData]="{ row: row }"
                              [attr.aria-label]="'Actions for ' + rowLabel(row)" matTooltip="Actions"><mat-icon>more_vert</mat-icon></button>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        }
      </div>

      <mat-menu #rowMenu="matMenu" class="shell-menu">
        <ng-template matMenuContent let-row="row">
          @for (a of rowActions(); track a.label) {
            @if (!a.show || a.show(row)) {
              <button mat-menu-item [class.danger]="a.danger" (click)="a.run(row)"><mat-icon>{{ a.icon }}</mat-icon><span>{{ a.label }}</span></button>
            }
          }
        </ng-template>
      </mat-menu>

      @if (!loading() && filtered().length > pageSize) {
        <div class="dt-foot">
          <span>{{ page() * pageSize + 1 }}–{{ min((page() + 1) * pageSize, filtered().length) }} of {{ filtered().length }}</span>
          <button mat-icon-button aria-label="Previous page" [disabled]="page() === 0" (click)="page.set(page() - 1)"><mat-icon>chevron_left</mat-icon></button>
          <button mat-icon-button aria-label="Next page" [disabled]="(page() + 1) * pageSize >= filtered().length" (click)="page.set(page() + 1)"><mat-icon>chevron_right</mat-icon></button>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .dt { background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-md); overflow: hidden; }

    .dt-bar { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; padding: 10px 12px; border-bottom: 1px solid var(--color-line); }
    .dt-views { display: flex; gap: 2px; flex-wrap: wrap; }
    .dt-view { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 10px; border: 0; border-radius: var(--radius-control); background: none; font: 650 var(--text-sm) var(--font-body); color: var(--color-text-2); cursor: pointer; }
    .dt-view:hover { background: var(--color-surface-2); }
    .dt-view.on { background: var(--color-primary-soft); color: var(--color-primary); }
    .dt-n { min-width: 18px; padding: 0 5px; border-radius: 999px; background: var(--color-surface-2); font-size: var(--text-xs); font-weight: 700; color: var(--color-text-3); font-variant-numeric: tabular-nums; }
    .dt-view.on .dt-n { background: var(--color-surface); color: var(--color-primary); }
    .dt-tools { display: flex; align-items: center; gap: var(--space-2); margin-left: auto; }
    .dt-search { display: flex; align-items: center; gap: 6px; height: 36px; padding: 0 10px; border: 1px solid var(--color-line-strong); border-radius: var(--radius-control); background: var(--color-surface); color: var(--color-text-3); }
    .dt-search:focus-within { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-soft); }
    .dt-search mat-icon { font-size: var(--text-xl); width: 18px; height: 18px; }
    .dt-search input { width: 200px; border: 0; outline: 0; background: transparent; font: 500 var(--text-sm) var(--font-body); color: var(--color-text); }
    .dt-cols { height: 36px; }

    .dt-bulk { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; padding: 8px 12px; background: var(--color-primary-soft); border-bottom: 1px solid var(--color-line); font-size: var(--text-sm); color: var(--color-primary); }
    .dt-bulk b { margin-right: var(--space-2); }
    .danger { color: var(--color-danger); --mat-menu-item-label-text-color: var(--color-danger); --mat-menu-item-icon-color: var(--color-danger); --mdc-outlined-button-label-text-color: var(--color-danger); }

    .dt-scroll { overflow: auto; max-height: calc(100vh - 260px); }
    table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: var(--text-sm); }
    thead th { position: sticky; top: 0; z-index: 1; background: var(--color-surface-2); border-bottom: 1px solid var(--color-line); padding: 0 12px; height: 38px; text-align: left; font-size: var(--text-xs); font-weight: 700; color: var(--color-text-2); white-space: nowrap; }
    .sort { display: inline-flex; align-items: center; gap: 2px; padding: 0; border: 0; background: none; font: inherit; color: inherit; cursor: pointer; }
    .sort mat-icon { font-size: var(--text-md); width: 14px; height: 14px; opacity: .55; }
    th[aria-sort] .sort mat-icon { opacity: 1; color: var(--color-primary); }
    tbody td { padding: 10px 12px; border-bottom: 1px solid var(--color-line); vertical-align: middle; color: var(--color-text); }
    .dense tbody td { padding-top: 6px; padding-bottom: 6px; }
    tbody tr:last-child td { border-bottom: 0; }
    tbody tr:hover td { background: var(--color-canvas); }
    tbody tr.sel td { background: var(--color-primary-soft); }
    tbody tr.click { cursor: pointer; }
    td small { display: block; margin-top: 2px; font-size: var(--text-xs); color: var(--color-text-3); }
    .t-money, .t-number { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    th.t-money, th.t-number { text-align: right; }
    .t-ref .v { font-family: var(--font-mono); font-size: var(--text-xs); font-weight: 500; }
    .t-date { white-space: nowrap; font-variant-numeric: tabular-nums; }
    thead th.c-sel, tbody td.c-sel { width: 40px; padding-right: 0; }
    .c-sel input { width: 16px; height: 16px; accent-color: var(--color-primary); cursor: pointer; }
    thead th.c-act, tbody td.c-act { width: 48px; padding: 0 4px; text-align: right; }

    .dt-empty { display: grid; justify-items: center; gap: 6px; padding: 40px 16px; text-align: center; color: var(--color-text-3); }
    .dt-empty mat-icon { font-size: var(--text-4xl); width: 32px; height: 32px; }
    .dt-empty b { font-size: var(--text-md); color: var(--color-text); }
    .dt-empty p { margin: 0; font-size: var(--text-sm); max-width: 420px; }
    .dt-empty button { margin-top: 6px; }

    .dt-foot { display: flex; align-items: center; justify-content: flex-end; gap: 4px; padding: 4px 8px 4px 12px; border-top: 1px solid var(--color-line); font-size: var(--text-xs); font-weight: 600; color: var(--color-text-3); font-variant-numeric: tabular-nums; }
    .dt-foot span { margin-right: var(--space-2); }

    @media (max-width: 700px) {
      .dt-tools { width: 100%; margin-left: 0; }
      .dt-search { flex: 1; }
      .dt-search input { width: 100%; }
    }
  `]
})
export class DataTableComponent<T> {
  private readonly appearance = inject(AppearanceService);
  /** Remembers column choice, density and the last view on this browser. */
  readonly tableId = input<string>('');
  readonly rows = input<T[]>([]);
  readonly columns = input<TableColumn<T>[]>([]);
  readonly views = input<TableView<T>[]>([]);
  readonly rowActions = input<RowAction<T>[]>([]);
  readonly bulkActions = input<BulkAction<T>[]>([]);
  readonly loading = input(false);
  /** Plural name used in search and empty states, e.g. "purchase orders". */
  readonly itemName = input('rows');
  readonly emptyTitle = input('');
  readonly emptyMessage = input('');
  readonly emptyIcon = input('inbox');
  readonly caption = input('');
  /** Stable id for each row, so selection and rendering survive a reload of the data. */
  readonly rowKey = input<((row: T) => unknown) | null>(null);
  /** Names a row for screen readers ("Select PO-0012"). Defaults to the first column. */
  readonly rowName = input<((row: T) => string) | null>(null);

  @Output() rowClick = new EventEmitter<T>();

  readonly pageSize = PAGE_SIZE;
  readonly viewId = signal('');
  readonly query = signal('');
  readonly sortKey = signal<string | null>(null);
  readonly sortDir = signal<1 | -1>(1);
  readonly hidden = signal<Set<string>>(new Set());
  /** This table's own row choice; null follows the person's Appearance setting. */
  private readonly ownRows = signal<'compact' | 'comfortable' | null>(null);
  readonly dense = computed(() => (this.ownRows() ?? this.appearance.density()) === 'compact');
  readonly selected = signal<Set<T>>(new Set());
  readonly page = signal(0);
  private prefsLoaded = false;

  constructor() {
    // Load saved preferences once the table id and columns are known.
    effect(() => {
      const cols = this.columns();
      const id = this.tableId();
      if (this.prefsLoaded || !cols.length) return;
      this.prefsLoaded = true;
      const prefs = this.readPrefs(id);
      this.hidden.set(new Set(prefs.hidden ?? cols.filter(c => c.hidden).map(c => c.key)));
      // `dense: true` was saved before rows followed Appearance; `dense: false` was only a default.
      this.ownRows.set(prefs.rows ?? (prefs.dense ? 'compact' : null));
      const views = this.views();
      this.viewId.set(prefs.view && views.some(v => v.id === prefs.view) ? prefs.view : (views[0]?.id ?? ''));
    }, { allowSignalWrites: true });

    // New data clears a selection that may point at rows that no longer exist.
    effect(() => { this.rows(); this.selected.set(new Set()); }, { allowSignalWrites: true });
  }

  readonly visibleColumns = computed(() => this.columns().filter(c => !this.hidden().has(c.key)));

  readonly viewCounts = computed(() => {
    const counts: Record<string, number> = {};
    for (const v of this.views()) counts[v.id] = v.filter ? this.rows().filter(v.filter).length : this.rows().length;
    return counts;
  });

  readonly filtered = computed(() => {
    const view = this.views().find(v => v.id === this.viewId());
    let list = view?.filter ? this.rows().filter(view.filter) : this.rows().slice();
    const q = this.query().trim().toLowerCase();
    if (q) {
      const cols = this.columns();
      list = list.filter(r => cols.some(c => this.text(c, r).toLowerCase().includes(q) || (c.sub?.(r) ?? '').toLowerCase().includes(q)));
    }
    const key = this.sortKey();
    const col = key ? this.columns().find(c => c.key === key) : null;
    if (col) {
      const dir = this.sortDir();
      list.sort((a, b) => {
        const x = sortable(col, col.value(a)), y = sortable(col, col.value(b));
        // Blanks go last whichever way the column is sorted.
        if (x === '' || y === '') return x === y ? 0 : x === '' ? 1 : -1;
        return dir * compare(x, y);
      });
    }
    return list;
  });

  readonly pageRows = computed(() => {
    const start = this.page() * PAGE_SIZE;
    return this.filtered().slice(start, start + PAGE_SIZE);
  });

  readonly allOnPageSelected = computed(() => this.pageRows().length > 0 && this.pageRows().every(r => this.selected().has(r)));
  readonly someOnPageSelected = computed(() => !this.allOnPageSelected() && this.pageRows().some(r => this.selected().has(r)));

  filterDescription(): string {
    const view = this.views().find(v => v.id === this.viewId());
    const parts: string[] = [];
    if (view?.filter) parts.push(`"${view.label}"`);
    if (this.query().trim()) parts.push(`"${this.query().trim()}"`);
    return parts.join(' and ') || 'the filter';
  }

  setView(id: string): void { this.viewId.set(id); this.page.set(0); this.savePrefs(); }
  setQuery(q: string): void { this.query.set(q); this.page.set(0); }
  clearFilters(): void { this.query.set(''); this.setView(this.views()[0]?.id ?? ''); }

  sortBy(key: string): void {
    if (this.sortKey() === key) {
      if (this.sortDir() === 1) this.sortDir.set(-1);
      else { this.sortKey.set(null); this.sortDir.set(1); }
    } else { this.sortKey.set(key); this.sortDir.set(1); }
  }

  toggleColumn(key: string): void {
    const next = new Set(this.hidden());
    if (next.has(key)) next.delete(key);
    else if (this.visibleColumns().length > 1) next.add(key);
    this.hidden.set(next);
    this.savePrefs();
  }

  toggleDense(): void { this.ownRows.set(this.dense() ? 'comfortable' : 'compact'); this.savePrefs(); }

  toggleRow(row: T): void {
    const next = new Set(this.selected());
    if (next.has(row)) next.delete(row); else next.add(row);
    this.selected.set(next);
  }

  togglePage(): void {
    const next = new Set(this.selected());
    const all = this.allOnPageSelected();
    for (const r of this.pageRows()) { if (all) next.delete(r); else next.add(r); }
    this.selected.set(next);
  }

  clearSelection(): void { this.selected.set(new Set()); }

  runBulk(b: BulkAction<T>): void { b.run([...this.selected()]); }

  trackKey(row: T, index: number): unknown {
    const fn = this.rowKey();
    return fn ? fn(row) : index;
  }

  rowLabel(row: T): string {
    const fn = this.rowName();
    if (fn) return fn(row);
    const first = this.columns()[0];
    return first ? this.text(first, row) : 'row';
  }

  /** Display text for a cell. */
  text(c: TableColumn<T>, row: T): string {
    const v = c.value(row);
    if (v === null || v === undefined || v === '') return c.type === 'money' || c.type === 'number' ? '–' : '';
    switch (c.type) {
      case 'money': return formatMoney(Number(v), c.currency || 'ZAR');
      case 'number': return Number(v).toLocaleString('en-ZA');
      case 'date': {
        const d = v instanceof Date ? v : new Date(String(v));
        return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
      }
      default: return String(v);
    }
  }

  min(a: number, b: number): number { return Math.min(a, b); }

  private readPrefs(id: string): TablePrefs {
    if (!id) return {};
    try { return JSON.parse(localStorage.getItem('table:' + id) || '{}') as TablePrefs; } catch { return {}; }
  }

  private savePrefs(): void {
    const id = this.tableId();
    if (!id) return;
    const prefs: TablePrefs = { hidden: [...this.hidden()], rows: this.ownRows() ?? undefined, view: this.viewId() };
    try { localStorage.setItem('table:' + id, JSON.stringify(prefs)); } catch { /* storage unavailable: preferences last for this visit */ }
  }
}

function sortable<T>(col: TableColumn<T>, v: unknown): number | string {
  if (v === null || v === undefined || v === '') return '';
  if (col.type === 'money' || col.type === 'number') return Number(v);
  if (col.type === 'date') { const t = new Date(v as string).getTime(); return isNaN(t) ? '' : t; }
  return String(v).toLowerCase();
}

function compare(a: number | string, b: number | string): number {
  if (a === b) return 0;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'en-ZA', { numeric: true });
}

const moneyFormats = new Map<string, Intl.NumberFormat>();
/** "R 14 352,00": South African grouping and decimal comma. */
export function formatMoney(value: number, currency = 'ZAR'): string {
  if (!isFinite(value)) return '–';
  let f = moneyFormats.get(currency);
  if (!f) {
    f = new Intl.NumberFormat('en-ZA', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    moneyFormats.set(currency, f);
  }
  return f.format(value);
}
