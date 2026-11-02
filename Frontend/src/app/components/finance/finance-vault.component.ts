import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { TenderService, ComplianceDocument, ComplianceSummary } from '../../services/tender.service';
import { ToastService } from '../../ui/toast.service';
import { ComplianceDialogComponent } from '../tenders/compliance-dialog.component';

interface VaultCompany { code: string; name: string; color: string; }
interface VaultDocType { value: string; label: string; icon: string; }

/** Same companies and document types as the Tenders module — one vault, two doors. */
export const VAULT_COMPANIES: VaultCompany[] = [
  { code: 'PMT', name: 'Promed Tech', color: '#1976D2' },
  { code: 'SBT', name: 'Sebenzani', color: '#4CAF50' },
  { code: 'ACM', name: 'Access Medical', color: '#9C27B0' },
  { code: 'PHT', name: 'Pharatech', color: '#FF5722' },
  { code: 'SEY', name: 'SharpEye', color: '#E91E63' },
  { code: 'SAW', name: 'SA Wellness', color: '#00BCD4' },
  { code: 'PHC', name: 'Pharmacare', color: '#FF9800' },
  { code: 'JVT', name: 'Joint Venture', color: '#607D8B' }
];
export const VAULT_DOC_TYPES: VaultDocType[] = [
  { value: 'CSD', label: 'CSD Registration', icon: 'verified' },
  { value: 'TaxClearance', label: 'Tax Clearance', icon: 'receipt' },
  { value: 'BBBEE', label: 'B-BBEE Certificate', icon: 'workspace_premium' },
  { value: 'CIDB', label: 'CIDB Grading', icon: 'construction' },
  { value: 'CompanyRegistration', label: 'Company Registration', icon: 'business' },
  { value: 'BankConfirmation', label: 'Bank Confirmation', icon: 'account_balance' },
  { value: 'COIDA', label: 'COIDA Letter', icon: 'security' },
  { value: 'ISO', label: 'ISO Certification', icon: 'stars' }
];

type VaultView = 'matrix' | 'list';
type VaultFilter = '' | 'Valid' | 'Expiring' | 'Warning' | 'Expired' | 'Missing';

/**
 * Finance → Vault. Statutory documents every company must keep current (tax clearance, B-BBEE,
 * CSD, bank confirmation…). Finance owns the renewals; Tenders reads the same records.
 */
@Component({
  selector: 'app-finance-vault',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule, MatProgressSpinnerModule, MatDialogModule, MatMenuModule],
  template: `
    <!-- KPIs (click to filter) -->
    <div class="fv-kpis">
      <button class="fv-kpi" [class.active]="filter() === ''" (click)="setFilter('')">
        <mat-icon>shield</mat-icon><span class="v">{{ summary()?.total ?? docs().length }}</span><span class="l">Documents</span>
      </button>
      <button class="fv-kpi ok" [class.active]="filter() === 'Valid'" (click)="setFilter('Valid')">
        <mat-icon>check_circle</mat-icon><span class="v">{{ summary()?.valid ?? 0 }}</span><span class="l">Valid</span>
      </button>
      <button class="fv-kpi warn" [class.active]="filter() === 'Expiring'" (click)="setFilter('Expiring')">
        <mat-icon>schedule</mat-icon><span class="v">{{ summary()?.expiring ?? 0 }}</span><span class="l">Expiring (≤45 days)</span>
      </button>
      <button class="fv-kpi warn2" [class.active]="filter() === 'Warning'" (click)="setFilter('Warning')">
        <mat-icon>warning</mat-icon><span class="v">{{ summary()?.warning ?? 0 }}</span><span class="l">Urgent (≤7 days)</span>
      </button>
      <button class="fv-kpi bad" [class.active]="filter() === 'Expired'" (click)="setFilter('Expired')">
        <mat-icon>error</mat-icon><span class="v">{{ summary()?.expired ?? 0 }}</span><span class="l">Expired</span>
      </button>
      <button class="fv-kpi muted" [class.active]="filter() === 'Missing'" (click)="setFilter('Missing')">
        <mat-icon>help_outline</mat-icon><span class="v">{{ missingCount() }}</span><span class="l">Not uploaded</span>
      </button>
    </div>

    <!-- Toolbar -->
    <div class="fv-toolbar">
      <div class="fv-seg">
        <button [class.on]="view() === 'matrix'" (click)="view.set('matrix')"><mat-icon>grid_view</mat-icon> By company</button>
        <button [class.on]="view() === 'list'" (click)="view.set('list')"><mat-icon>view_list</mat-icon> Renewals list</button>
      </div>
      <select [ngModel]="company()" (ngModelChange)="company.set($event)" aria-label="Company">
        <option value="">All companies</option>
        @for (c of companies; track c.code) { <option [value]="c.code">{{ c.name }}</option> }
      </select>
      <span class="fv-spacer"></span>
      <button mat-stroked-button (click)="checkAlerts()" matTooltip="Generate and email expiry alerts now">
        <mat-icon>notification_important</mat-icon> Run expiry check
      </button>
      <button mat-flat-button color="primary" (click)="add()">
        <mat-icon>add</mat-icon> Add document
      </button>
    </div>

    @if (loading()) {
      <div class="fv-state"><mat-spinner diameter="36"></mat-spinner><p>Opening the vault…</p></div>
    } @else if (view() === 'matrix') {
      <!-- Company × document matrix -->
      <div class="fv-grid">
        @for (c of visibleCompanies(); track c.code) {
          <section class="fv-company">
            <header>
              <span class="dot" [style.background]="c.color"></span>
              <h3>{{ c.name }}</h3>
              <span class="code">{{ c.code }}</span>
              <span class="fv-health" [class]="companyHealth(c.code)">{{ companyHealthLabel(c.code) }}</span>
            </header>
            <ul>
              @for (t of docTypes; track t.value) {
                @if (docFor(c.code, t.value); as d) {
                  @if (matchesFilter(d)) {
                    <li [class]="'st-' + d.computedStatus.toLowerCase()" (click)="viewDoc(d)">
                      <mat-icon class="t">{{ t.icon }}</mat-icon>
                      <div class="info">
                        <span class="name">{{ t.label }}</span>
                        <small>{{ d.documentNumber || 'No number' }} · expires {{ d.expiryDate | date:'dd MMM yyyy' }}</small>
                      </div>
                      <span class="days">{{ d.daysLeft >= 0 ? d.daysLeft + 'd' : 'EXPIRED' }}</span>
                      <button aria-label="Actions" mat-icon-button [matMenuTriggerFor]="m" (click)="$event.stopPropagation()"><mat-icon>more_vert</mat-icon></button>
                      <mat-menu #m="matMenu">
                        <button mat-menu-item (click)="preview(d)" [disabled]="!d.fileName"><mat-icon>open_in_new</mat-icon> Open file</button>
                        <button mat-menu-item (click)="download(d)" [disabled]="!d.fileName"><mat-icon>download</mat-icon> Download</button>
                        <button mat-menu-item (click)="viewDoc(d)"><mat-icon>info</mat-icon> Details</button>
                        <button mat-menu-item (click)="edit(d)"><mat-icon>autorenew</mat-icon> Renew / update</button>
                      </mat-menu>
                    </li>
                  }
                } @else if (filter() === '' || filter() === 'Missing') {
                  <li class="st-missing" (click)="add(c.code, t.value)">
                    <mat-icon class="t">{{ t.icon }}</mat-icon>
                    <div class="info"><span class="name">{{ t.label }}</span><small>Not uploaded</small></div>
                    <mat-icon class="add">add_circle</mat-icon>
                  </li>
                }
              }
            </ul>
          </section>
        }
      </div>
    } @else {
      <!-- Renewals list: soonest expiry first -->
      <div class="fv-table-wrap">
        @if (listRows().length === 0) {
          <div class="fv-state"><mat-icon>inbox</mat-icon><h3>Nothing here</h3><p>No documents match the current filter.</p></div>
        } @else {
          <table class="app-table fv-table">
            <thead><tr><th>Document</th><th>Company</th><th>Number</th><th>Issued</th><th>Expires</th><th>Status</th><th class="actions"></th></tr></thead>
            <tbody>
              @for (d of listRows(); track d.id) {
                <tr [class]="'st-' + d.computedStatus.toLowerCase()">
                  <td><div class="fv-cell"><mat-icon>{{ typeIcon(d.documentType) }}</mat-icon><span>{{ typeLabel(d.documentType) }}</span></div></td>
                  <td><span class="fv-co"><span class="dot" [style.background]="companyColor(d.companyCode)"></span>{{ companyName(d.companyCode) }}</span></td>
                  <td class="ref">{{ d.documentNumber || '—' }}</td>
                  <td class="nowrap">{{ d.issueDate | date:'dd MMM yyyy' }}</td>
                  <td class="nowrap">{{ d.expiryDate | date:'dd MMM yyyy' }}</td>
                  <td><span class="badge" [class]="'badge ' + d.computedStatus.toLowerCase()">{{ d.daysLeft >= 0 ? d.computedStatus + ' · ' + d.daysLeft + 'd' : 'Expired ' + (-d.daysLeft) + 'd ago' }}</span></td>
                  <td class="actions">
                    <button aria-label="Open" mat-icon-button matTooltip="Open file" (click)="preview(d)" [disabled]="!d.fileName"><mat-icon>open_in_new</mat-icon></button>
                    <button aria-label="Download" mat-icon-button matTooltip="Download" (click)="download(d)" [disabled]="!d.fileName"><mat-icon>download</mat-icon></button>
                    <button aria-label="Renew" mat-icon-button matTooltip="Renew / update" (click)="edit(d)"><mat-icon>autorenew</mat-icon></button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .fv-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--space-3); margin-bottom: var(--space-4); }
    .fv-kpi { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: var(--space-3) var(--space-4); text-align: left; font: inherit; color: var(--color-text);
      background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-md); cursor: pointer; transition: border-color .15s, box-shadow .15s;
      mat-icon { color: var(--color-primary); margin-bottom: 4px; }
      .v { font-size: var(--text-3xl); font-weight: 700; line-height: 1.1; } .l { font-size: var(--text-xs); color: var(--color-text-3); }
      &:hover { border-color: var(--color-primary); box-shadow: var(--shadow-sm); }
      &.active { border-color: var(--color-primary); background: var(--color-primary-soft); }
      &.ok mat-icon { color: var(--color-ok); } &.ok.active { background: var(--color-ok-soft); border-color: var(--color-ok); }
      &.warn mat-icon, &.warn2 mat-icon { color: var(--color-warn); } &.warn.active, &.warn2.active { background: var(--color-warn-soft); border-color: var(--color-warn); }
      &.bad mat-icon { color: var(--color-danger); } &.bad.active { background: var(--color-danger-soft); border-color: var(--color-danger); }
      &.muted mat-icon { color: var(--color-text-3); }
    }
    .fv-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); margin-bottom: var(--space-3);
      select { height: 40px; padding: 0 var(--space-3); border: 1px solid var(--color-line-strong); border-radius: var(--radius-control); background: var(--color-surface); color: var(--color-text); font: inherit; } }
    .fv-seg { display: inline-flex; border: 1px solid var(--color-line-strong); border-radius: var(--radius-control); overflow: hidden;
      button { display: inline-flex; align-items: center; gap: 6px; height: 38px; padding: 0 var(--space-3); border: 0; background: var(--color-surface); color: var(--color-text-2); font: inherit; cursor: pointer;
        mat-icon { font-size: 18px; width: 18px; height: 18px; } &.on { background: var(--color-primary-soft); color: var(--color-primary); font-weight: 600; } } }
    .fv-spacer { flex: 1; }
    .fv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: var(--space-4); }
    .fv-company { background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-lg); overflow: hidden;
      header { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--color-line); background: var(--color-surface-2);
        h3 { margin: 0; font-size: var(--text-md); flex: 1; } .code { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--color-text-3); } }
      ul { list-style: none; margin: 0; padding: 0; }
      li { display: flex; align-items: center; gap: var(--space-2); padding: 8px var(--space-3) 8px var(--space-4); border-bottom: 1px solid var(--color-line); cursor: pointer; position: relative;
        &:last-child { border-bottom: 0; } &:hover { background: var(--color-surface-2); }
        &::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--color-line); }
        &.st-valid::before { background: var(--color-ok); } &.st-expiring::before { background: var(--color-warn); } &.st-warning::before { background: var(--color-warn); } &.st-expired::before { background: var(--color-danger); }
        &.st-missing { opacity: .7; .add { color: var(--color-primary); } }
        .t { color: var(--color-text-2); } .info { flex: 1; min-width: 0; .name { display: block; font-size: var(--text-sm); font-weight: 600; } small { display: block; color: var(--color-text-3); font-size: var(--text-xs); } }
        .days { font-family: var(--font-mono); font-size: var(--text-xs); font-weight: 700; padding: 2px 8px; border-radius: 999px; background: var(--color-surface-3); }
        &.st-valid .days { background: var(--color-ok-soft); color: var(--color-ok); } &.st-expiring .days, &.st-warning .days { background: var(--color-warn-soft); color: var(--color-warn); } &.st-expired .days { background: var(--color-danger-soft); color: var(--color-danger); } }
    }
    .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; flex: 0 0 auto; }
    .fv-health { font-size: var(--text-xs); font-weight: 600; padding: 2px 8px; border-radius: 999px;
      &.good { background: var(--color-ok-soft); color: var(--color-ok); } &.attention { background: var(--color-warn-soft); color: var(--color-warn); } &.critical { background: var(--color-danger-soft); color: var(--color-danger); } &.empty { background: var(--color-surface-3); color: var(--color-text-3); } }
    .fv-table-wrap { background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-lg); overflow: hidden; }
    .fv-table { width: 100%; border-collapse: collapse;
      th { text-align: left; font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .04em; color: var(--color-text-3); padding: 10px var(--space-3); background: var(--color-surface-2); border-bottom: 1px solid var(--color-line); }
      td { padding: var(--row-pad-y) var(--space-3); border-bottom: 1px solid var(--color-line); font-size: var(--text-sm); vertical-align: middle; }
      tr.st-expired td:first-child { box-shadow: inset 3px 0 0 var(--color-danger); } tr.st-expiring td:first-child, tr.st-warning td:first-child { box-shadow: inset 3px 0 0 var(--color-warn); }
      .actions { text-align: right; white-space: nowrap; } }
    .fv-cell { display: flex; align-items: center; gap: 8px; mat-icon { color: var(--color-text-2); } }
    .fv-co { display: inline-flex; align-items: center; gap: 6px; }
    .ref { font-family: var(--font-mono); } .nowrap { white-space: nowrap; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: var(--text-xs); font-weight: 600; background: var(--color-surface-3);
      &.valid { background: var(--color-ok-soft); color: var(--color-ok); } &.expiring, &.warning { background: var(--color-warn-soft); color: var(--color-warn); } &.expired { background: var(--color-danger-soft); color: var(--color-danger); } }
    .fv-state { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); padding: var(--space-8) var(--space-4); color: var(--color-text-3); text-align: center;
      mat-icon { font-size: 44px; width: 44px; height: 44px; } h3 { margin: 0; color: var(--color-text); } p { margin: 0; } }
  `]
})
export class FinanceVaultComponent implements OnInit {
  private tenders = inject(TenderService);
  private dialog = inject(MatDialog);
  private toast = inject(ToastService);

  readonly companies = VAULT_COMPANIES;
  readonly docTypes = VAULT_DOC_TYPES;

  docs = signal<ComplianceDocument[]>([]);
  summary = signal<ComplianceSummary | null>(null);
  loading = signal(false);
  view = signal<VaultView>('matrix');
  filter = signal<VaultFilter>('');
  company = signal('');

  visibleCompanies = computed(() => this.company() ? this.companies.filter(c => c.code === this.company()) : this.companies);
  missingCount = computed(() => {
    let n = 0;
    for (const c of this.companies) for (const t of this.docTypes) if (!this.docFor(c.code, t.value)) n++;
    return n;
  });
  listRows = computed(() => {
    const f = this.filter(); const co = this.company();
    return this.docs()
      .filter(d => (!co || d.companyCode === co) && (f === '' || f === 'Missing' ? true : d.computedStatus === f))
      .sort((a, b) => a.daysLeft - b.daysLeft);
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.tenders.getComplianceDocuments().subscribe({
      next: d => { this.docs.set(d ?? []); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.error("Couldn't open the vault. Try again."); }
    });
    this.tenders.getComplianceSummary().subscribe({ next: s => this.summary.set(s), error: () => {} });
  }

  setFilter(f: VaultFilter): void {
    this.filter.set(f);
    if (f === 'Missing') this.view.set('matrix');
  }

  docFor(code: string, type: string): ComplianceDocument | undefined { return this.docs().find(d => d.companyCode === code && d.documentType === type); }
  matchesFilter(d: ComplianceDocument): boolean { const f = this.filter(); return f === '' || f === 'Missing' ? f === '' : d.computedStatus === f; }
  typeLabel(v: string): string { return this.docTypes.find(t => t.value === v)?.label ?? v; }
  typeIcon(v: string): string { return this.docTypes.find(t => t.value === v)?.icon ?? 'description'; }
  companyName(c: string): string { return this.companies.find(x => x.code === c)?.name ?? c; }
  companyColor(c: string): string { return this.companies.find(x => x.code === c)?.color ?? 'var(--color-text-3)'; }

  companyHealth(code: string): 'good' | 'attention' | 'critical' | 'empty' {
    const ds = this.docs().filter(d => d.companyCode === code);
    if (!ds.length) return 'empty';
    if (ds.some(d => d.computedStatus === 'Expired')) return 'critical';
    if (ds.some(d => d.computedStatus === 'Expiring' || d.computedStatus === 'Warning')) return 'attention';
    return 'good';
  }
  companyHealthLabel(code: string): string {
    const h = this.companyHealth(code);
    const n = this.docs().filter(d => d.companyCode === code).length;
    return h === 'empty' ? 'No documents' : h === 'critical' ? 'Expired docs' : h === 'attention' ? 'Renewals due' : `${n}/${this.docTypes.length} in order`;
  }

  add(companyCode?: string, docType?: string): void {
    this.dialog.open(ComplianceDialogComponent, { width: '600px', data: { mode: 'create', companies: this.companies, documentTypes: this.docTypes, companyCode, docType } })
      .afterClosed().subscribe(r => { if (r) this.load(); });
  }
  viewDoc(d: ComplianceDocument): void {
    this.dialog.open(ComplianceDialogComponent, { width: '600px', data: { mode: 'view', document: d, companies: this.companies, documentTypes: this.docTypes } })
      .afterClosed().subscribe(r => { if (r) this.load(); });
  }
  edit(d: ComplianceDocument): void {
    this.dialog.open(ComplianceDialogComponent, { width: '600px', data: { mode: 'edit', document: d, companies: this.companies, documentTypes: this.docTypes } })
      .afterClosed().subscribe(r => { if (r) this.load(); });
  }
  preview(d: ComplianceDocument): void {
    if (!d.fileName) { this.toast.warn('No file uploaded for this document'); return; }
    this.tenders.downloadComplianceDocument(d.id).subscribe({ next: b => window.open(URL.createObjectURL(b), '_blank'), error: () => this.toast.error("Couldn't open the file.") });
  }
  download(d: ComplianceDocument): void {
    this.tenders.downloadComplianceDocument(d.id).subscribe({
      next: b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = d.fileName || 'document'; a.click(); URL.revokeObjectURL(a.href); },
      error: () => this.toast.error("Couldn't download the file.")
    });
  }
  checkAlerts(): void {
    this.tenders.checkAndSendAlerts().subscribe({
      next: r => { this.toast.done(`${r?.alertsCreated ?? 0} alert(s) generated`); this.load(); },
      error: () => this.toast.error("Couldn't run the expiry check.")
    });
  }
}
