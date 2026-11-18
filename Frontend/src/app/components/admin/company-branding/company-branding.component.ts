import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../ui/toast.service';

type Kind = 'logo' | 'logo-round' | 'letterhead';
interface BrandFile { fileName: string; extension: string; size: number; updatedAt: string; isImage: boolean; }
interface BrandCompany { code: string; name: string; logo: BrandFile | null; logoRound: BrandFile | null; letterhead: BrandFile | null; }

/**
 * Admin settings › Company branding. One logo and one letterhead per paying company,
 * uploaded and kept on the server (uploads/branding). Admin only.
 */
@Component({
  selector: 'app-company-branding',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule, MatProgressSpinnerModule],
  template: `
  <p class="lead">Upload each company's <b>logo</b> (PNG, JPG or WebP), a <b>round logo</b> (square PNG/WebP with a transparent background — used for avatars and small marks) and a <b>letterhead</b> (image, PDF or Word). Uploading again replaces the current file. Up to 15 MB each.</p>
  @if (loading()) { <div class="state"><mat-spinner diameter="28"></mat-spinner> Loading companies…</div> }
  @else if (!companies().length) { <div class="state">No paying companies yet — add them under Payment approvers.</div> }
  @else {
    <div class="grid">
      @for (c of companies(); track c.code) {
        <article class="card">
          <header><b>{{ c.name }}</b><small>{{ c.code }}</small></header>
          @for (k of kinds; track k.key) {
            <section>
              <h4><mat-icon>{{ k.icon }}</mat-icon>{{ k.title }}</h4>
              <div class="slot" [class.empty]="!file(c, k.key)" [class.round]="k.key === 'logo-round'">
                @if (file(c, k.key); as f) {
                  @if (preview(c.code, k.key); as src) { <img [src]="src" [alt]="c.name + ' ' + k.title"> }
                  @else { <span class="doc"><mat-icon>{{ f.isImage ? 'image' : 'description' }}</mat-icon>{{ f.extension.slice(1).toUpperCase() }}</span> }
                } @else { <span class="none">Not uploaded</span> }
              </div>
              @if (file(c, k.key); as f) { <p class="meta">{{ f.size / 1024 | number:'1.0-0' }} KB · {{ f.updatedAt | date:'d MMM yyyy HH:mm' }}</p> }
              <div class="acts">
                <label class="up" [class.busy]="busy() === c.code + k.key">
                  <mat-icon>{{ busy() === c.code + k.key ? 'hourglass_top' : 'upload' }}</mat-icon>{{ file(c, k.key) ? 'Replace' : 'Upload' }}
                  <input type="file" hidden [accept]="k.accept" [disabled]="!!busy()" (change)="upload(c, k.key, $event)">
                </label>
                @if (file(c, k.key)) {
                  <button mat-icon-button matTooltip="Download" (click)="download(c, k.key)"><mat-icon>download</mat-icon></button>
                  <button mat-icon-button matTooltip="Remove" [disabled]="!!busy()" (click)="remove(c, k.key)"><mat-icon>delete_outline</mat-icon></button>
                }
              </div>
            </section>
          }
        </article>
      }
    </div>
  }
  `,
  styles: [`
    :host { display: block; }
    .lead { color: var(--color-text-2); font-size: var(--text-sm); margin: 0 0 var(--space-3); }
    .state { display: flex; align-items: center; gap: 10px; padding: var(--space-6); color: var(--color-text-3); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(460px, 1fr)); gap: var(--space-3); }
    .card { background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-lg); padding: var(--space-3); display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-3); }
    .card header { grid-column: 1 / -1; display: flex; align-items: baseline; gap: 8px; }
    .card header small { color: var(--color-text-3); font-family: var(--font-mono); font-size: var(--text-xs); }
    h4 { display: flex; align-items: center; gap: 6px; margin: 0 0 6px; font-size: var(--text-sm); }
    h4 mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--color-primary); }
    .slot { height: 120px; display: grid; place-items: center; background: #fff; border: 1px solid var(--color-line); border-radius: var(--radius-md); overflow: hidden; }
    .slot.empty { background: var(--color-surface-2); border-style: dashed; }
    .slot img { max-width: 92%; max-height: 92%; object-fit: contain; }
    .slot.round { background: repeating-conic-gradient(#eef2f7 0% 25%, #fff 0% 50%) 0 0 / 16px 16px; }
    .slot.round img { width: 96px; height: 96px; border-radius: 50%; object-fit: cover; box-shadow: 0 0 0 1px var(--color-line); }
    .none { color: var(--color-text-3); font-size: var(--text-xs); }
    .doc { display: flex; flex-direction: column; align-items: center; gap: 4px; color: #475569; font-weight: 700; font-size: var(--text-xs); }
    .doc mat-icon { font-size: 36px; width: 36px; height: 36px; }
    .meta { margin: 4px 0 0; font-size: var(--text-xs); color: var(--color-text-3); }
    .acts { display: flex; align-items: center; gap: 2px; margin-top: 6px; }
    .up { display: inline-flex; align-items: center; gap: 4px; padding: 5px 12px; border-radius: var(--radius-control); border: 1px solid var(--color-primary); color: var(--color-primary); font-size: var(--text-xs); font-weight: 600; cursor: pointer; }
    .up.busy { opacity: .6; cursor: progress; }
    .up mat-icon { font-size: 16px; width: 16px; height: 16px; }
  `]
})
export class CompanyBrandingComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private base = `${environment.apiUrl}/company-branding`;

  readonly kinds: { key: Kind; title: string; icon: string; accept: string }[] = [
    { key: 'logo', title: 'Logo', icon: 'image', accept: '.png,.jpg,.jpeg,.webp' },
    { key: 'logo-round', title: 'Round logo', icon: 'account_circle', accept: '.png,.webp' },
    { key: 'letterhead', title: 'Letterhead', icon: 'article', accept: '.png,.jpg,.jpeg,.webp,.pdf,.docx' },
  ];
  companies = signal<BrandCompany[]>([]);
  loading = signal(true);
  busy = signal<string | null>(null);
  /** Object URLs for image previews, keyed code+kind (files need the auth header, so they're fetched as blobs). */
  private previews = signal<Record<string, string>>({});

  ngOnInit(): void { this.load(); }
  ngOnDestroy(): void { Object.values(this.previews()).forEach(u => URL.revokeObjectURL(u)); }

  private prop(k: Kind): 'logo' | 'logoRound' | 'letterhead' { return k === 'logo-round' ? 'logoRound' : k; }
  file(c: BrandCompany, k: Kind): BrandFile | null { return c[this.prop(k)]; }
  preview(code: string, k: Kind): string | undefined { return this.previews()[code + k]; }

  private load(): void {
    this.http.get<BrandCompany[]>(this.base).subscribe({
      next: list => { this.companies.set(list); this.loading.set(false); for (const c of list) for (const k of this.kinds) if (c[this.prop(k.key)]?.isImage) this.loadPreview(c.code, k.key); },
      error: () => { this.loading.set(false); this.toast.error("Couldn't load company branding."); }
    });
  }
  private loadPreview(code: string, k: Kind): void {
    this.http.get(`${this.base}/${code}/${k}`, { responseType: 'blob' }).subscribe({
      next: b => { const old = this.previews()[code + k]; if (old) URL.revokeObjectURL(old); this.previews.update(p => ({ ...p, [code + k]: URL.createObjectURL(b) })); },
      error: () => {}
    });
  }
  private dropPreview(code: string, k: Kind): void {
    const old = this.previews()[code + k]; if (!old) return;
    URL.revokeObjectURL(old); this.previews.update(p => { const n = { ...p }; delete n[code + k]; return n; });
  }
  private setFile(code: string, k: Kind, f: BrandFile | null): void {
    this.companies.update(list => list.map(c => c.code === code ? { ...c, [this.prop(k)]: f } : c));
  }

  private label(k: Kind): string { return this.kinds.find(x => x.key === k)?.title.toLowerCase() ?? k; }

  upload(c: BrandCompany, k: Kind, ev: Event): void {
    const input = ev.target as HTMLInputElement; const file = input.files?.[0]; input.value = '';
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { this.toast.error('That file is larger than 15 MB.'); return; }
    const fd = new FormData(); fd.append('file', file);
    this.busy.set(c.code + k);
    this.http.post<BrandFile>(`${this.base}/${c.code}/${k}`, fd).subscribe({
      next: f => { this.busy.set(null); this.setFile(c.code, k, f); this.dropPreview(c.code, k); if (f.isImage) this.loadPreview(c.code, k); this.toast.done(`${c.name} ${this.label(k)} saved`); },
      error: e => { this.busy.set(null); this.toast.error(e?.error?.message || 'Upload failed.'); }
    });
  }
  download(c: BrandCompany, k: Kind): void {
    this.http.get(`${this.base}/${c.code}/${k}`, { responseType: 'blob' }).subscribe({
      next: b => { const url = URL.createObjectURL(b); const a = document.createElement('a'); a.href = url; a.download = this.file(c, k)?.fileName || `${c.code}-${k}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); },
      error: () => this.toast.error("Couldn't download the file.")
    });
  }
  remove(c: BrandCompany, k: Kind): void {
    if (!confirm(`Remove the ${this.label(k)} for ${c.name}?`)) return;
    this.busy.set(c.code + k);
    this.http.delete(`${this.base}/${c.code}/${k}`).subscribe({
      next: () => { this.busy.set(null); this.setFile(c.code, k, null); this.dropPreview(c.code, k); this.toast.done(`${c.name} ${this.label(k)} removed`); },
      error: e => { this.busy.set(null); this.toast.error(e?.error?.message || "Couldn't remove the file."); }
    });
  }
}
