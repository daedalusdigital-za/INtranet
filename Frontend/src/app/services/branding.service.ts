import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { registerUploadedBranding } from '../core/company-logos';

export interface BrandingFile { fileName: string; extension: string; size: number; updatedAt: string; isImage: boolean; url: string; }
export interface BrandingCompany { code: string; name: string; logo: BrandingFile | null; logoRound: BrandingFile | null; letterhead: BrandingFile | null; }

/**
 * Loads the logos uploaded in Admin settings › Company branding and registers them with the
 * company-logos helpers, so companyLogo()/companyWideLogo() prefer them over the built-in files.
 * Runs at app start (app.config) and again after an admin uploads or removes a file.
 */
@Injectable({ providedIn: 'root' })
export class BrandingService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/company-branding`;
  /** Origin the API lives on, so the relative urls the server returns resolve against it rather than the SPA. */
  private origin = environment.apiUrl.replace(/\/api\/?$/, '');

  companies: BrandingCompany[] = [];

  async load(): Promise<void> {
    if (!localStorage.getItem('token')) return; // not signed in yet; the list needs auth (the logo files themselves don't)
    try {
      const list = await firstValueFrom(this.http.get<BrandingCompany[]>(this.api));
      for (const c of list) for (const k of ['logo', 'logoRound', 'letterhead'] as const) if (c[k]?.url?.startsWith('/')) c[k]!.url = this.origin + c[k]!.url;
      this.companies = list;
      registerUploadedBranding(list);
    } catch { /* branding is cosmetic — never block start-up */ }
  }
}
