import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastService } from '../../ui/toast.service';
import { CreditorPacksService, CreditorMeta, CreditorCompany } from '../../services/creditor-packs.service';

interface Person { id: number; name: string; email: string; role: string; title?: string | null; department?: string | null; permissions?: string; effective?: string[]; }

/**
 * Settings › Payment approvers.
 *
 * Who may do what in the supplier-payment process comes from the person's job role (Settings › Users):
 *   Creditor Clerk → prepares packs · Accountant / Finance Manager → approves · Director → signs · Treasurer → pays.
 * This screen only sets, per paying company, WHICH accountant must approve its packs and WHICH director signs them.
 */
@Component({
  selector: 'app-creditor-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatButtonModule, MatIconModule, MatTooltipModule, MatProgressSpinnerModule],
  template: `
@if (error()) {
  <div class="ca-state err"><mat-icon>error_outline</mat-icon><div><b>Couldn't load the payment approvers.</b><br><small>{{ error() }}</small></div><button mat-stroked-button (click)="load()">Retry</button></div>
} @else if (!meta()) {
  <div class="ca-state"><mat-spinner diameter="28"></mat-spinner> Loading paying companies…</div>
} @else {
  <p class="lead">
    Each paying company needs an <b>accountant</b> who must approve every payment pack after the clerks have prepared and checked it, and a <b>director</b> who signs it off.
    A back-up / delegate can step in when they're away. Who <i>can</i> be an accountant, director, clerk or treasurer comes from the person's job role under
    <a routerLink="/settings/users">Settings › Users</a> — nothing to tick here.
  </p>

  <!-- Who can do what, from job roles -->
  <section class="ca-card">
    <header><h3><mat-icon>badge</mat-icon> Who can do what</h3><small class="muted">From job roles · {{ people().length }} active people</small></header>
    <div class="who">
      @for (g of whoGroups(); track g.key) {
        <div class="who-col">
          <div class="who-head"><mat-icon>{{ g.icon }}</mat-icon><b>{{ g.title }}</b><span class="n">{{ g.people.length }}</span></div>
          <div class="who-sub">{{ g.hint }}</div>
          @if (g.people.length) {
            <ul>@for (p of g.people; track p.id) { <li [matTooltip]="p.email + ' · ' + p.role + (p.department ? ' · ' + p.department : '')">{{ p.name }}<small>{{ p.role }}</small></li> }</ul>
          } @else { <div class="who-none">Nobody yet — give someone the <b>{{ g.roleName }}</b> role under Users.</div> }
        </div>
      }
    </div>
  </section>

  <!-- Per-company approvers -->
  <section class="ca-card">
    <header>
      <h3><mat-icon>business</mat-icon> Approvers per paying company</h3>
      <button mat-stroked-button (click)="addCompanyRow()"><mat-icon>add</mat-icon> Add company</button>
    </header>
    <div class="co-grid">
      @for (c of companies(); track c.id ?? ('new' + $index)) {
        <div class="co" [class.inactive]="!c.isActive" [class.dirty]="isDirty(c)">
          <div class="co-head">
            <input class="code" [(ngModel)]="c.code" maxlength="10" placeholder="CODE" [disabled]="!!c.id">
            <input class="name" [(ngModel)]="c.name" placeholder="Company name">
            <label class="active"><input type="checkbox" [(ngModel)]="c.isActive"> Active</label>
          </div>
          <input class="act" [(ngModel)]="c.activity" placeholder="What the company does (shown on packs)">

          <div class="pick">
            <label>Accountant <small>must approve every pack</small></label>
            <select [(ngModel)]="c.accountantUserId">
              <option [ngValue]="null">— not set (any accountant may approve) —</option>
              @for (p of accountants(); track p.id) { <option [ngValue]="p.id">{{ p.name }} · {{ p.role }}</option> }
            </select>
          </div>
          <div class="pick">
            <label>Back-up approver <small>when the accountant is away</small></label>
            <select [(ngModel)]="c.backupApproverUserId">
              <option [ngValue]="null">—</option>
              @for (p of accountants(); track p.id) { @if (p.id !== c.accountantUserId) { <option [ngValue]="p.id">{{ p.name }} · {{ p.role }}</option> } }
            </select>
          </div>
          <div class="pick">
            <label>Director <small>signs and releases the pack</small></label>
            <select [(ngModel)]="c.directorUserId">
              <option [ngValue]="null">— not set (any director may sign) —</option>
              @for (p of directors(); track p.id) { <option [ngValue]="p.id">{{ p.name }} · {{ p.role }}</option> }
            </select>
          </div>
          <div class="pick">
            <label>Delegate director <small>optional</small></label>
            <select [(ngModel)]="c.delegateDirectorUserId">
              <option [ngValue]="null">—</option>
              @for (p of directors(); track p.id) { @if (p.id !== c.directorUserId) { <option [ngValue]="p.id">{{ p.name }} · {{ p.role }}</option> } }
            </select>
          </div>

          <div class="co-foot">
            @if (!c.accountantUserId || !c.directorUserId) { <span class="warn"><mat-icon>warning_amber</mat-icon> {{ !c.accountantUserId && !c.directorUserId ? 'No accountant or director set' : !c.accountantUserId ? 'No accountant set' : 'No director set' }}</span> }
            @else { <span class="ok"><mat-icon>check_circle</mat-icon> Ready</span> }
            <span class="grow"></span>
            @if (isDirty(c)) { <button mat-button (click)="revert(c)">Revert</button> }
            <button mat-flat-button color="primary" (click)="saveCompany(c)" [disabled]="busyId() === (c.id ?? -1) || !c.code || !c.name || !isDirty(c)">{{ busyId() === (c.id ?? -1) ? 'Saving…' : c.id ? 'Save' : 'Create' }}</button>
          </div>
        </div>
      }
    </div>
    <p class="hint"><mat-icon>info</mat-icon> <span>Until a company has an accountant set, <b>any</b> accountant may approve its packs (same for directors). The preparer can never approve their own pack. Directors work in <b>Executive › Directors</b>; the treasurer loads and pays from <b>Finance › Creditors › Schedule</b>.</span></p>
  </section>
}
  `,
  styles: [`
:host { display:block; }
.lead { color: var(--color-text-2, #475569); font-size: 14px; margin: 0 0 16px; line-height: 1.5; a { color: var(--color-primary,#4f46e5); font-weight: 600; } }
.ca-state { display:flex; align-items:center; gap:12px; padding: 24px; color: var(--color-text-2,#475569); &.err { color: var(--color-danger,#b91c1c); mat-icon { color: inherit; } } }
.ca-card { background: var(--color-surface,#fff); border:1px solid var(--color-line,#e5e7eb); border-radius: 14px; padding: 16px 18px; margin-bottom: 16px; }
.ca-card header { display:flex; align-items:center; gap:10px; margin-bottom:12px; flex-wrap:wrap; }
.ca-card h3 { margin:0; font-size:15px; display:flex; align-items:center; gap:6px; flex:1; } .ca-card h3 mat-icon { color: var(--color-primary,#4f46e5); }
.muted { color: var(--color-text-3,#64748b); }

.who { display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
.who-col { border:1px solid var(--color-line,#e5e7eb); border-radius: 10px; padding: 10px 12px; background: var(--color-canvas,#f8fafc); }
.who-head { display:flex; align-items:center; gap:6px; font-size: 13px; mat-icon { font-size:18px; width:18px; height:18px; color: var(--color-primary,#4f46e5); } .n { margin-left:auto; font-size: 11px; font-weight:700; background: var(--color-primary-soft,#eef2ff); color: var(--color-primary,#4f46e5); border-radius: 999px; padding: 1px 8px; } }
.who-sub { font-size: 11.5px; color: var(--color-text-3,#64748b); margin: 2px 0 8px; }
.who ul { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:3px; max-height: 180px; overflow:auto; }
.who li { font-size: 12.5px; display:flex; justify-content:space-between; gap:8px; small { color: var(--color-text-3,#64748b); white-space:nowrap; } }
.who-none { font-size: 12px; color: var(--color-warn,#b45309); }

.co-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 12px; }
.co { border:1px solid var(--color-line,#e5e7eb); border-radius: 12px; padding: 12px; display:flex; flex-direction:column; gap: 8px; background: var(--color-surface,#fff); transition: box-shadow .15s; }
.co.dirty { box-shadow: 0 0 0 2px var(--color-primary-soft,#eef2ff); border-color: var(--color-primary,#4f46e5); }
.co.inactive { opacity: .6; }
.co-head { display:flex; gap:8px; align-items:center; }
.co-head .code { width: 72px; min-width: 72px; text-transform: uppercase; font-weight: 700; letter-spacing: .04em; text-align:center; }
.co-head .name { flex: 1; font-weight: 600; }
.co-head .active { display:flex; align-items:center; gap:4px; font-size: 12px; white-space:nowrap; color: var(--color-text-2,#475569); input { width:auto; min-width:0; height:auto; } }
.act { font-size: 12px; }
.pick { display:flex; flex-direction:column; gap: 3px; label { font-size: 12px; font-weight: 600; color: var(--color-text-2,#475569); small { font-weight: 400; color: var(--color-text-3,#64748b); margin-left: 4px; } } }
input, select { height:36px; padding:0 8px; border:1px solid var(--color-line-strong,#cbd5e1); border-radius:8px; background: var(--color-surface,#fff); color: inherit; font: inherit; font-size:13px; width:100%; min-width: 0; }
input:disabled { background: var(--color-canvas,#f8fafc); color: var(--color-text-3,#64748b); }
.co-foot { display:flex; align-items:center; gap: 8px; margin-top: 4px; font-size: 12px; .grow { flex:1; } mat-icon { font-size:16px; width:16px; height:16px; vertical-align: -3px; } .warn { color: var(--color-warn,#b45309); } .ok { color: var(--color-ok,#15803d); } }
.hint { display:flex; gap:8px; align-items:flex-start; font-size:12.5px; color: var(--color-text-2,#475569); margin:12px 0 0; } .hint mat-icon { font-size:18px; width:18px; height:18px; color: var(--color-primary,#4f46e5); }
  `]
})
export class CreditorAdminComponent implements OnInit {
  private api = inject(CreditorPacksService);
  private toast = inject(ToastService);

  meta = signal<CreditorMeta | null>(null);
  error = signal<string | null>(null);
  people = signal<Person[]>([]);
  companies = signal<Partial<CreditorCompany>[]>([]);
  private original = new Map<number, string>();
  busyId = signal<number | null>(null);

  private has(p: Person, perm: string): boolean { return (p.effective ?? []).includes(perm) || (p.effective ?? []).includes('*'); }
  private isSysAdmin(p: Person): boolean { return p.role === 'Admin' || p.role === 'Super Admin'; }
  /** People who may approve packs: Accountant / Finance Manager by job role, or explicitly granted. Admins listed last as a fallback. */
  accountants = computed(() => this.rank(this.people().filter(p => this.has(p, 'cred.accountant'))));
  directors = computed(() => this.rank(this.people().filter(p => this.has(p, 'cred.director'))));
  private rank(list: Person[]): Person[] { return [...list].sort((a, b) => (this.isSysAdmin(a) ? 1 : 0) - (this.isSysAdmin(b) ? 1 : 0) || a.name.localeCompare(b.name)); }

  whoGroups = computed(() => {
    const ppl = this.people().filter(p => !this.isSysAdmin(p));
    const g = (key: string, title: string, icon: string, perm: string, roleName: string, hint: string) => ({ key, title, icon, roleName, hint, people: ppl.filter(p => this.has(p, perm)).sort((a, b) => a.name.localeCompare(b.name)) });
    return [
      g('clerk', 'Prepare packs', 'edit_document', 'cred.clerk', 'Creditor Clerk', 'Capture payments, attach invoices & recons, run the checks, submit'),
      g('acc', 'Approve packs', 'fact_check', 'cred.accountant', 'Accountant', 'Company accountant — mandatory approval before the director'),
      g('dir', 'Sign packs', 'draw', 'cred.director', 'Director', 'Final sign-off; releases the pack to the pay-run'),
      g('bank', 'Pay', 'account_balance', 'cred.bank', 'Treasurer', 'Loads on the bank, uploads proof of payment, keeps the cashflow'),
    ];
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.error.set(null);
    this.api.meta().subscribe({
      next: m => { this.meta.set(m); this.setCompanies(m.companies); },
      error: e => this.error.set(e?.status === 403 ? 'Only administrators may manage payment approvers.' : (e?.error?.message || `HTTP ${e?.status || '?'}`))
    });
    this.api.users().subscribe({ next: u => this.people.set(u as Person[]), error: () => {} });
  }
  private setCompanies(cs: CreditorCompany[]): void {
    this.original.clear();
    for (const c of cs) this.original.set(c.id, this.fingerprint(c));
    this.companies.set(cs.map(c => ({ ...c })));
  }
  private fingerprint(c: Partial<CreditorCompany>): string { return JSON.stringify([c.code, c.name, c.activity ?? '', c.isActive, c.accountantUserId ?? null, c.backupApproverUserId ?? null, c.directorUserId ?? null, c.delegateDirectorUserId ?? null]); }
  isDirty(c: Partial<CreditorCompany>): boolean { return !c.id || this.original.get(c.id) !== this.fingerprint(c); }
  revert(c: Partial<CreditorCompany>): void {
    if (!c.id) { this.companies.set(this.companies().filter(x => x !== c)); return; }
    const src = this.meta()?.companies.find(x => x.id === c.id); if (src) Object.assign(c, src);
  }

  addCompanyRow(): void { this.companies.set([...this.companies(), { code: '', name: '', isActive: true, sortOrder: this.companies().length + 1, accountantUserId: null, backupApproverUserId: null, directorUserId: null, delegateDirectorUserId: null }]); }

  saveCompany(c: Partial<CreditorCompany>): void {
    if (c.backupApproverUserId && c.backupApproverUserId === c.accountantUserId) c.backupApproverUserId = null;
    if (c.delegateDirectorUserId && c.delegateDirectorUserId === c.directorUserId) c.delegateDirectorUserId = null;
    const id = c.id ?? -1;
    this.busyId.set(id);
    const req = c.id ? this.api.updateCompany(c.id, c) : this.api.addCompany(c);
    req.subscribe({
      next: () => {
        this.busyId.set(null); this.toast.done(`${(c.code || '').toUpperCase()} saved`);
        this.api.meta().subscribe(m => { this.meta.set(m); this.setCompanies(m.companies); });
      },
      error: e => { this.busyId.set(null); this.toast.error(e?.error?.message || "Couldn't save the company."); }
    });
  }
}
