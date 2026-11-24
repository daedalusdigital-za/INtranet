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
    Who approves, signs, pays and prepares a company's payment packs is worked out automatically from <a routerLink="/settings/users">Settings › Users</a>:
    the person's <b>job role</b> (Accountant / Finance Manager → approves · Director → signs · Treasurer → pays · Creditor Clerk → prepares) and the <b>companies</b> assigned to them.
    Nothing has to be set here — only use <i>Override</i> if a specific company must be approved by one particular person regardless of the Users setup.
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

          <!-- Resolved from Users (job role + companies) -->
          @if (c.id) {
            <div class="resolved">
              @for (r of resolvedRows(c); track r.key) {
                <div class="rr" [class.none]="!r.people.length">
                  <mat-icon [matTooltip]="r.title">{{ r.icon }}</mat-icon>
                  <b>{{ r.title }}</b>
                  <span class="rr-people">
                    @if (r.people.length) { @for (p of r.people; track p.userId) { <span class="chip" [class.pin]="p.pinned" [matTooltip]="p.role + (p.pinned ? ' · pinned here' : ' · from Users')">{{ p.name }}</span> } }
                    @else { <i>{{ r.empty }}</i> }
                  </span>
                </div>
              }
            </div>
          }

          <button type="button" class="ovr-toggle" (click)="toggleOverride(c)">
            <mat-icon>{{ showOverride(c) ? 'expand_less' : 'tune' }}</mat-icon>
            {{ showOverride(c) ? 'Hide override' : (hasPins(c) ? 'Override in use — edit' : 'Override (pin a specific person)') }}
          </button>

          @if (showOverride(c)) {
          <div class="pick">
            <label>Accountant <small>pin one person; blank = from Users</small></label>
            <select [(ngModel)]="c.accountantUserId">
              <option [ngValue]="null">— from Users (recommended) —</option>
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
            <label>Director <small>pin one person; blank = from Users</small></label>
            <select [(ngModel)]="c.directorUserId">
              <option [ngValue]="null">— from Users (recommended) —</option>
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
          }

          <div class="co-foot">
            @if (!c.approvers?.accountants?.length || !c.approvers?.directors?.length) { <span class="warn"><mat-icon>warning_amber</mat-icon> {{ !c.approvers?.accountants?.length && !c.approvers?.directors?.length ? 'No accountant or director assigned to this company' : !c.approvers?.accountants?.length ? 'No accountant assigned to this company' : 'No director assigned to this company' }}</span> }
            @else { <span class="ok"><mat-icon>check_circle</mat-icon> Ready</span> }
            <span class="grow"></span>
            @if (isDirty(c)) { <button mat-button (click)="revert(c)">Revert</button> }
            <button mat-flat-button color="primary" (click)="saveCompany(c)" [disabled]="busyId() === (c.id ?? -1) || !c.code || !c.name || !isDirty(c)">{{ busyId() === (c.id ?? -1) ? 'Saving…' : c.id ? 'Save' : 'Create' }}</button>
          </div>
        </div>
      }
    </div>
    <p class="hint"><mat-icon>info</mat-icon> <span>To change who approves a company, open the person under <b>Settings › Users</b> and set their job role and companies. If a company has no accountant assigned at all, <b>any</b> accountant may approve its packs (same for directors). The preparer can never approve their own pack. Directors work in <b>Executive › Directors</b>; the treasurer loads and pays from <b>Finance › Creditors › Schedule</b>.</span></p>
  </section>
}
  `,
  styles: [`
:host { display:block; }
.lead { color: var(--color-text-2); font-size: 14px; margin: 0 0 16px; line-height: 1.5; a { color: var(--color-primary); font-weight: 600; } }
.ca-state { display:flex; align-items:center; gap:12px; padding: 24px; color: var(--color-text-2); &.err { color: var(--color-danger); mat-icon { color: inherit; } } }
.ca-card { background: var(--color-surface); border:1px solid var(--color-line); border-radius: 14px; padding: 16px 18px; margin-bottom: 16px; }
.ca-card header { display:flex; align-items:center; gap:10px; margin-bottom:12px; flex-wrap:wrap; }
.ca-card h3 { margin:0; font-size:15px; display:flex; align-items:center; gap:6px; flex:1; } .ca-card h3 mat-icon { color: var(--color-primary); }
.muted { color: var(--color-text-3); }

.who { display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
.who-col { border:1px solid var(--color-line); border-radius: 10px; padding: 10px 12px; background: var(--color-canvas); }
.who-head { display:flex; align-items:center; gap:6px; font-size: 13px; mat-icon { font-size:18px; width:18px; height:18px; color: var(--color-primary); } .n { margin-left:auto; font-size: 11px; font-weight:700; background: var(--color-primary-soft); color: var(--color-primary); border-radius: 999px; padding: 1px 8px; } }
.who-sub { font-size: 11.5px; color: var(--color-text-3); margin: 2px 0 8px; }
.who ul { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:3px; max-height: 180px; overflow:auto; }
.who li { font-size: 12.5px; display:flex; justify-content:space-between; gap:8px; small { color: var(--color-text-3); white-space:nowrap; } }
.who-none { font-size: 12px; color: var(--color-warn); }

.co-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 12px; }
.co { border:1px solid var(--color-line); border-radius: 12px; padding: 12px; display:flex; flex-direction:column; gap: 8px; background: var(--color-surface); transition: box-shadow .15s; }
.co.dirty { box-shadow: 0 0 0 2px var(--color-primary-soft); border-color: var(--color-primary); }
.co.inactive { opacity: .6; }
.co-head { display:flex; gap:8px; align-items:center; }
.co-head .code { width: 72px; min-width: 72px; text-transform: uppercase; font-weight: 700; letter-spacing: .04em; text-align:center; }
.co-head .name { flex: 1; font-weight: 600; }
.co-head .active { display:flex; align-items:center; gap:4px; font-size: 12px; white-space:nowrap; color: var(--color-text-2); input { width:auto; min-width:0; height:auto; } }
.act { font-size: 12px; }
.resolved { display:flex; flex-direction:column; gap:6px; padding: 8px 10px; border-radius: 10px; background: var(--color-canvas); border: 1px solid var(--color-line); }
.rr { display:flex; align-items:flex-start; gap:6px; font-size: 12.5px; mat-icon { font-size:16px; width:16px; height:16px; color: var(--color-primary); margin-top:1px; } b { min-width: 72px; color: var(--color-text-2); font-weight:600; } }
.rr.none i { color: var(--color-warn); font-style: normal; }
.rr-people { display:flex; flex-wrap:wrap; gap:4px; flex:1; }
.chip { background: var(--color-surface); border:1px solid var(--color-line-strong); border-radius: 999px; padding: 1px 8px; font-size: 12px; white-space:nowrap; }
.chip.pin { border-color: var(--color-primary); color: var(--color-primary); font-weight:600; }
.ovr-toggle { align-self:flex-start; display:inline-flex; align-items:center; gap:4px; background:none; border:none; padding:2px 0; font: inherit; font-size: 12px; color: var(--color-text-3); cursor:pointer; mat-icon { font-size:16px; width:16px; height:16px; } &:hover { color: var(--color-primary); } }
.pick { display:flex; flex-direction:column; gap: 3px; label { font-size: 12px; font-weight: 600; color: var(--color-text-2); small { font-weight: 400; color: var(--color-text-3); margin-left: 4px; } } }
input, select { height:36px; padding:0 8px; border:1px solid var(--color-line-strong); border-radius:8px; background: var(--color-surface); color: inherit; font: inherit; font-size:13px; width:100%; min-width: 0; }
input:disabled { background: var(--color-canvas); color: var(--color-text-3); }
.co-foot { display:flex; align-items:center; gap: 8px; margin-top: 4px; font-size: 12px; .grow { flex:1; } mat-icon { font-size:16px; width:16px; height:16px; vertical-align: -3px; } .warn { color: var(--color-warn); } .ok { color: var(--color-ok); } }
.hint { display:flex; gap:8px; align-items:flex-start; font-size:12.5px; color: var(--color-text-2); margin:12px 0 0; } .hint mat-icon { font-size:18px; width:18px; height:18px; color: var(--color-primary); }
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

  /** Who the workflow will actually use for this company (from Users, or the pinned override). */
  resolvedRows(c: Partial<CreditorCompany>) {
    const a = c.approvers;
    return [
      { key: 'clerk', title: 'Prepares', icon: 'edit_document', people: a?.clerks ?? [], empty: 'No creditor clerk assigned to this company' },
      { key: 'acc', title: 'Approves', icon: 'fact_check', people: a?.accountants ?? [], empty: 'No accountant assigned — any accountant may approve' },
      { key: 'dir', title: 'Signs', icon: 'draw', people: a?.directors ?? [], empty: 'No director assigned — any director may sign' },
      { key: 'bank', title: 'Pays', icon: 'account_balance', people: a?.treasurers ?? [], empty: 'No treasurer assigned to this company' },
    ];
  }
  private overrideOpen = new Set<number>();
  hasPins(c: Partial<CreditorCompany>): boolean { return !!(c.accountantUserId || c.backupApproverUserId || c.directorUserId || c.delegateDirectorUserId); }
  showOverride(c: Partial<CreditorCompany>): boolean { return !c.id || this.overrideOpen.has(c.id) || this.hasPins(c); }
  toggleOverride(c: Partial<CreditorCompany>): void { if (!c.id) return; if (this.overrideOpen.has(c.id)) this.overrideOpen.delete(c.id); else this.overrideOpen.add(c.id); }

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
