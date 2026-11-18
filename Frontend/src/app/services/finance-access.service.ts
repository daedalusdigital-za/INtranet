import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface FinanceCompanyAccess {
  code: string;
  name: string;
  operatingCompanyId: number | null;
  allowed: boolean;
}

export interface FinanceAccess {
  allowed: boolean;
  all: boolean;
  companies: FinanceCompanyAccess[];
  operatingCompanies: { operatingCompanyId: number; code: string; name: string; allowed: boolean }[];
  tokens: string[];
}

/**
 * Which companies the signed-in person may work with in Finance.
 * Mirrors the server-side CompanyScope: admins see everything, everyone else only the
 * operating companies they are assigned to under Admin › Users › Companies.
 * Finance screens use `canSee(company)` to grey out / lock chips and tiles so the server
 * never has to refuse a click the UI should not have offered.
 */
@Injectable({ providedIn: 'root' })
export class FinanceAccessService {
  private http = inject(HttpClient);

  readonly access = signal<FinanceAccess | null>(null);
  readonly loaded = computed(() => this.access() !== null);
  readonly all = computed(() => this.access()?.all ?? false);
  private tokens = computed(() => new Set((this.access()?.tokens ?? []).map(t => this.normalize(t))));
  private pending = false;

  /** Alias groups so any spelling of a company (PMT / Promed / Promed Technologies) resolves the same way. */
  private static readonly ALIASES: string[][] = [
    ['PMT', 'PROMED', 'PROMEDTECHNOLOGIES', 'PROMEDTECH'],
    ['ACM', 'ACCESS', 'ACCMED', 'ACCESSMEDICAL'],
    ['PHC', 'PHT', 'PHARMA', 'PHARMACARE', 'PHARMATECH', 'PROMEDPHARMACARE', 'PROMEDPHARMATECH'],
    ['SBT', 'SEBENZ', 'SEBENZANI', 'SEBENZANITRADING'],
    ['KOG', 'KOGTRADING', 'KOGTRADINGENTERPRISE'],
    ['SAW', 'SAWELLNESS'],
    ['RFT', 'ROCKETFREIGHT', 'ROCKET'],
    ['SEY', 'SHARPEYE', 'SHARPEYESECURITY'],
    ['SHK', 'SHAKAHOLDINGS', 'SHAKA'],
    ['NAT', 'NEWAGETECHNOLOGIES', 'NEWAGE'],
  ];

  /** Load (once) from the API. Safe to call from every finance screen. */
  load(force = false): void {
    if ((this.access() && !force) || this.pending) return;
    this.pending = true;
    this.http.get<FinanceAccess>(`${environment.apiUrl}/finance/company-access`).subscribe({
      next: a => { this.access.set(a); this.pending = false; },
      // 403 = no finance module at all; treat as "nothing allowed" rather than "everything"
      error: () => { this.access.set({ allowed: false, all: false, companies: [], operatingCompanies: [], tokens: [] }); this.pending = false; }
    });
  }

  /**
   * True when the company (code, name or any alias) is in scope. Blank / "All companies" is
   * always allowed (the server filters the result). Before the access list has loaded we
   * return true so screens don't flash as locked for admins.
   */
  canSee(company: string | null | undefined): boolean {
    const a = this.access();
    if (!a) return true;
    if (a.all) return true;
    if (!company || /^all( companies)?$/i.test(company.trim())) return true;
    const n = this.normalize(company);
    const tokens = this.tokens();
    if (tokens.has(n)) return true;
    for (const t of tokens) if (t.length >= 3 && n.includes(t)) return true;
    for (const group of FinanceAccessService.ALIASES) {
      if (group.includes(n) || group.some(g => n.includes(g) && g.length >= 3)) {
        if (group.some(g => tokens.has(g))) return true;
      }
    }
    return false;
  }

  /** Tooltip text for a locked company. */
  lockReason(company: string): string {
    return `You are not assigned to ${company}. Ask an administrator to add it under Users › Companies.`;
  }

  private normalize(s: string): string {
    return (s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  }
}
