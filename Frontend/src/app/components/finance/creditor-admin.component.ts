import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ToastService } from '../../ui/toast.service';
import { CreditorPacksService, CreditorMeta, CreditorCompany } from '../../services/creditor-packs.service';

/**
 * Payment approvers — who may do what in the supplier-payment process, and which accountant / director
 * signs for each paying company. Lives in Settings (admin); payment packs only read it.
 */
@Component({
  selector: 'app-creditor-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatCheckboxModule, MatTooltipModule],
  template: `
@if (meta(); as m) {
  <p class="lead">First tick who may do what. Then, for each paying company, choose its accountant (must approve every pack), a back‑up, and the director(s) who sign. Treasury is the person who loads payments on the bank and attaches proofs of payment.</p>

  <section class="ca-card">
    <header><h3><mat-icon>badge</mat-icon> Step 1 · Who may do what</h3><input class="search" [(ngModel)]="userSearch" (ngModelChange)="loadUsers()" placeholder="Search people…"></header>
    <div class="roles-legend">
      @for (r of m.roles; track r.key) { <span class="role"><b>{{ r.title }}</b> — {{ r.description }}</span> }
    </div>
    <div class="tbl">
      <table>
        <thead><tr><th>Person</th>@for (r of m.roles; track r.key) { <th [matTooltip]="r.description">{{ r.title }}</th> }</tr></thead>
        <tbody>
          @for (u of users(); track u.id) {
            <tr><td><strong>{{ u.name }}</strong><br><small class="muted">{{ u.email }} · {{ u.role }}</small></td>
              @for (r of m.roles; track r.key) { <td class="ctr"><mat-checkbox [checked]="hasRole(u, r.key)" (change)="setRole(u, r.key, $event.checked)"></mat-checkbox></td> }
            </tr>
          }
          @if (!users().length) { <tr><td [attr.colspan]="m.roles.length + 1" class="muted">No people match.</td></tr> }
        </tbody>
      </table>
    </div>
  </section>

  <section class="ca-card">
    <header><h3><mat-icon>business</mat-icon> Step 2 · Approvers per paying company</h3><button mat-stroked-button (click)="addCompanyRow()"><mat-icon>add</mat-icon> Add company</button></header>
    <div class="tbl">
      <table>
        <thead><tr><th>Code</th><th>Company</th><th>Accountant (required step)</th><th>Back‑up approver</th><th>Director</th><th>Delegate director</th><th>Active</th><th></th></tr></thead>
        <tbody>
          @for (c of companies(); track c.id ?? $index) {
            <tr>
              <td><input class="code" [(ngModel)]="c.code" maxlength="10"></td>
              <td><input [(ngModel)]="c.name"><input class="act" [(ngModel)]="c.activity" placeholder="what the company does"></td>
              <td><select [(ngModel)]="c.accountantUserId"><option [ngValue]="null">— not set —</option>@for (u of usersWith('cred.accountant'); track u.id) { <option [ngValue]="u.id">{{ u.name }}</option> }</select></td>
              <td><select [(ngModel)]="c.backupApproverUserId"><option [ngValue]="null">—</option>@for (u of usersWith('cred.accountant'); track u.id) { <option [ngValue]="u.id">{{ u.name }}</option> }</select></td>
              <td><select [(ngModel)]="c.directorUserId"><option [ngValue]="null">— not set —</option>@for (u of usersWith('cred.director'); track u.id) { <option [ngValue]="u.id">{{ u.name }}</option> }</select></td>
              <td><select [(ngModel)]="c.delegateDirectorUserId"><option [ngValue]="null">—</option>@for (u of usersWith('cred.director'); track u.id) { <option [ngValue]="u.id">{{ u.name }}</option> }</select></td>
              <td class="ctr"><mat-checkbox [(ngModel)]="c.isActive"></mat-checkbox></td>
              <td><button mat-flat-button color="primary" (click)="saveCompany(c)" [disabled]="busy() || !c.code || !c.name">Save</button></td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    <p class="hint"><mat-icon>info</mat-icon> <span>Only people ticked as Accountant / Director in step 1 appear in these lists. Until a company has an accountant set, any accountant may approve its packs. Directors see their packs in <b>Executive › Directors</b>; Treasury works in <b>Executive › Treasury</b>.</span></p>
  </section>
} @else { <p class="muted">Loading…</p> }
  `,
  styles: [`
:host { display:block; }
.lead { color: var(--color-text-2, #475569); font-size: 14px; margin: 0 0 16px; }
.ca-card { background: var(--color-surface,#fff); border:1px solid var(--color-line,#e5e7eb); border-radius: 14px; padding: 16px 18px; margin-bottom: 16px; }
.ca-card header { display:flex; align-items:center; gap:10px; margin-bottom:12px; flex-wrap:wrap; }
.ca-card h3 { margin:0; font-size:15px; display:flex; align-items:center; gap:6px; flex:1; } .ca-card h3 mat-icon { color: var(--color-primary,#4f46e5); }
.search { height:36px; padding:0 10px; border:1px solid var(--color-line-strong,#cbd5e1); border-radius:8px; font: inherit; min-width: 220px; }
.roles-legend { display:flex; flex-wrap:wrap; gap:6px 16px; font-size:12px; color: var(--color-text-2,#475569); margin-bottom:10px; }
.tbl { overflow-x:auto; }
table { width:100%; border-collapse:collapse; font-size:13px; }
th, td { padding:8px 8px; border-bottom:1px solid var(--color-line,#e5e7eb); text-align:left; vertical-align:middle; }
th { font-size:11px; text-transform:uppercase; letter-spacing:.04em; color: var(--color-text-3,#64748b); white-space:nowrap; }
.ctr { text-align:center; }
.muted { color: var(--color-text-3,#64748b); }
input, select { height:36px; padding:0 8px; border:1px solid var(--color-line-strong,#cbd5e1); border-radius:8px; background: var(--color-surface,#fff); color: inherit; font: inherit; font-size:13px; width:100%; min-width: 120px; }
input.code { width: 80px; min-width: 80px; text-transform: uppercase; }
input.act { margin-top:4px; font-size:12px; }
.hint { display:flex; gap:8px; align-items:flex-start; font-size:12.5px; color: var(--color-text-2,#475569); margin:12px 0 0; } .hint mat-icon { font-size:18px; width:18px; height:18px; color: var(--color-primary,#4f46e5); }
  `]
})
export class CreditorAdminComponent implements OnInit {
  private api = inject(CreditorPacksService);
  private toast = inject(ToastService);

  meta = signal<CreditorMeta | null>(null);
  users = signal<{ id: number; name: string; email: string; role: string; permissions?: string }[]>([]);
  companies = signal<Partial<CreditorCompany>[]>([]);
  busy = signal(false);
  userSearch = '';

  ngOnInit(): void {
    this.api.meta().subscribe({ next: m => { this.meta.set(m); this.companies.set(m.companies.map(c => ({ ...c }))); }, error: () => this.toast.error("Couldn't load payment approvers.") });
    this.loadUsers();
  }
  loadUsers(): void { this.api.users(this.userSearch || undefined).subscribe({ next: u => this.users.set(u), error: () => {} }); }
  hasRole(u: { permissions?: string }, role: string): boolean { return (u.permissions ?? '').split(/[,\[\]" ]+/).includes(role); }
  usersWith(role: string) { return this.users().filter(u => this.hasRole(u, role) || u.role === 'Admin' || u.role === 'Super Admin'); }
  setRole(u: { id: number; permissions?: string }, role: string, grant: boolean): void {
    this.api.toggleRole(u.id, role, grant).subscribe({ next: r => { u.permissions = r.permissions; this.users.set([...this.users()]); }, error: e => this.toast.error(e?.error?.message || "Couldn't change the role.") });
  }
  addCompanyRow(): void { this.companies.set([...this.companies(), { code: '', name: '', isActive: true, sortOrder: this.companies().length + 1, accountantUserId: null, backupApproverUserId: null, directorUserId: null, delegateDirectorUserId: null }]); }
  saveCompany(c: Partial<CreditorCompany>): void {
    this.busy.set(true);
    const req = c.id ? this.api.updateCompany(c.id, c) : this.api.addCompany(c);
    req.subscribe({
      next: () => { this.busy.set(false); this.toast.done(`${c.code} saved`); this.api.meta().subscribe(m => { this.meta.set(m); this.companies.set(m.companies.map(x => ({ ...x }))); }); },
      error: e => { this.busy.set(false); this.toast.error(e?.error?.message || "Couldn't save the company."); }
    });
  }
}
