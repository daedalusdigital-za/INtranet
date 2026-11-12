import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../ui/toast.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';

interface Row { id: number; name: string; group?: string; type?: string; province?: string; aliases: { company: string; customerCode: string; customerName?: string; source: string }[]; }

/** Customer master list — search any Sage code or name, open the 360. */
@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatIconModule, MatButtonModule, MatTooltipModule, MatProgressSpinnerModule, NavbarComponent, PageHeaderComponent],
  template: `
    <app-navbar></app-navbar>
    <div class="cust">
      <app-page-header [crumbs]="['People and money', 'Customers']" title="Customers" [subtitle]="total() + ' customers · one record per real customer across Promed Technologies, Access Medical, Pharmatech and Sebenzani'">
        <button mat-stroked-button (click)="autoMap()" [disabled]="mapping()" matTooltip="Create / refresh the mapping from every Sage account seen in sales, aging and backorders"><mat-icon>{{ mapping() ? 'hourglass_top' : 'auto_fix_high' }}</mat-icon> {{ mapping() ? 'Mapping…' : 'Auto-map accounts' }}</button>
      </app-page-header>

      <div class="bar">
        <div class="search"><mat-icon>search</mat-icon><input type="search" placeholder="Customer name, Sage code, group…" [ngModel]="q()" (ngModelChange)="q.set($event); page.set(1); load()" /></div>
        <span class="muted">Click a customer for the 360 view — sales, open invoices, credits, remittances, PODs, backorders and loads.</span>
      </div>

      @if (loading()) { <div class="center"><mat-spinner diameter="36"></mat-spinner></div> }
      @else if (!rows().length) {
        <div class="center"><mat-icon>hub</mat-icon><p>{{ q() ? 'No customers match.' : 'No customer master yet. Click "Auto-map accounts" to build it from the Sage data already imported.' }}</p></div>
      } @else {
        <div class="grid">
          @for (r of rows(); track r.id) {
            <a class="card" [routerLink]="['/customers', r.id]">
              <div class="top"><b>{{ r.name }}</b>@if (r.type) { <span class="type">{{ r.type }}</span> }</div>
              @if (r.group || r.province) { <small>{{ r.group }}{{ r.group && r.province ? ' · ' : '' }}{{ r.province }}</small> }
              <div class="aliases">@for (a of r.aliases; track a.company + a.customerCode) { <span class="alias" [matTooltip]="a.customerName || ''"><b>{{ a.company }}</b> {{ a.customerCode }}</span> }</div>
            </a>
          }
        </div>
        <div class="pager">
          <button mat-stroked-button [disabled]="page() <= 1" (click)="page.set(page() - 1); load()">Previous</button>
          <span>Page {{ page() }} of {{ pages() }}</span>
          <button mat-stroked-button [disabled]="page() >= pages()" (click)="page.set(page() + 1); load()">Next</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .cust { padding: 0 var(--space-5, 24px) var(--space-6, 32px); max-width: 1500px; margin: 0 auto; }
    .bar { display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin: 8px 0 14px; }
    .search { display:flex; align-items:center; gap:6px; flex:1; min-width:280px; max-width:520px; background: var(--color-surface, #fff); border:1px solid var(--color-line, #e5e7eb); border-radius:10px; padding:6px 10px; input { border:0; outline:0; flex:1; font: inherit; background:none; } }
    .muted { color: var(--color-text-3); font-size:12px; }
    .center { display:flex; flex-direction:column; align-items:center; gap:10px; padding:60px; color: var(--color-text-3); text-align:center; mat-icon { font-size:40px; width:40px; height:40px; opacity:.5; } }
    .grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap:10px; }
    .card { display:block; text-decoration:none; color:inherit; background: var(--color-surface, #fff); border:1px solid var(--color-line, #e5e7eb); border-radius:12px; padding:12px 14px; transition: box-shadow .15s, transform .15s;
      &:hover { box-shadow: 0 4px 14px rgba(0,0,0,.08); transform: translateY(-1px); }
      .top { display:flex; justify-content:space-between; gap:8px; align-items:flex-start; b { font-size:14px; } }
      .type { font-size:10px; text-transform:uppercase; letter-spacing:.04em; background: var(--color-primary-soft, #dbeafe); color: var(--color-primary, #1e40af); border-radius:6px; padding:2px 6px; white-space:nowrap; }
      small { display:block; color: var(--color-text-3); font-size:12px; margin-top:2px; } }
    .aliases { display:flex; flex-wrap:wrap; gap:4px; margin-top:8px; }
    .alias { background: var(--color-surface-2, #f1f5f9); border-radius:999px; padding:2px 8px; font-size:11px; b { margin-right:3px; } }
    .pager { display:flex; justify-content:center; align-items:center; gap:14px; margin-top:16px; color: var(--color-text-3); font-size:13px; }
  `]
})
export class CustomersComponent implements OnInit {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private api = `${environment.apiUrl}/customers/master`;
  rows = signal<Row[]>([]); total = signal(0); page = signal(1); pageSize = 60; loading = signal(false); mapping = signal(false); q = signal('');
  pages = () => Math.max(1, Math.ceil(this.total() / this.pageSize));
  private t: any;

  ngOnInit(): void { this.load(); }
  load(): void {
    clearTimeout(this.t);
    this.t = setTimeout(() => {
      this.loading.set(true);
      this.http.get<{ total: number; items: Row[] }>(this.api, { params: { search: this.q(), page: this.page(), pageSize: this.pageSize } }).subscribe({
        next: r => { this.rows.set(r.items); this.total.set(r.total); this.loading.set(false); },
        error: () => { this.loading.set(false); this.toast.error('Could not load customers'); }
      });
    }, 250);
  }
  autoMap(): void {
    this.mapping.set(true);
    this.http.post<{ created: number; aliases: number; message?: string }>(`${this.api}/auto-map`, {}).subscribe({
      next: r => { this.mapping.set(false); this.toast.done(r.message || `${r.created} customers created, ${r.aliases} accounts mapped`); this.load(); },
      error: () => { this.mapping.set(false); this.toast.error('Auto-map failed'); }
    });
  }
}
