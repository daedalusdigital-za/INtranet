import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../ui/toast.service';
import { SkeletonRowsComponent } from '../../../ui/skeleton-rows/skeleton-rows.component';
import { EmptyStateComponent } from '../../../ui/empty-state/empty-state.component';

interface CatalogueItem {
  companyCode: string;
  companyName: string;
  documentType: string;
  documentTypeName: string;
  hasRpt: boolean;
  hasSample: boolean;
  hasTemplate: boolean;
  rptFileName?: string;
  sampleFileName?: string;
  updatedAt?: string;
}

interface InvoiceRow {
  transactionNumber: string;
  customerNumber: string;
  customerName: string;
  date: string;
  lineCount: number;
  total: number;
}

@Component({
  selector: 'app-document-templates',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    SkeletonRowsComponent,
    EmptyStateComponent
  ],
  templateUrl: './document-templates.component.html',
  styleUrls: ['./document-templates.component.scss']
})
export class DocumentTemplatesComponent implements OnInit {
  private api = `${environment.apiUrl}/document-templates`;

  loading = false;
  catalogue: CatalogueItem[] = [];
  companies: { code: string; name: string }[] = [];
  docTypes = [
    { key: 'invoice', name: 'Tax Invoice', icon: 'receipt_long' },
    { key: 'delivery-note', name: 'Delivery Note', icon: 'local_shipping' },
    { key: 'quote', name: 'Quote', icon: 'request_quote' }
  ];

  selectedCompany = '';
  selectedType = '';

  // upload state
  rptFile: File | null = null;
  sampleFile: File | null = null;
  uploading = false;

  // template editing
  templateHtml = '';
  savingTemplate = false;

  // invoices + preview
  invoices: InvoiceRow[] = [];
  invoiceSearch = '';
  selectedInvoice: InvoiceRow | null = null;
  previewUrl: SafeResourceUrl | null = null;
  sampleUrl: SafeResourceUrl | null = null;
  loadingInvoices = false;

  // artwork (logo / banner)
  logoUrl: string | null = null;
  bannerUrl: string | null = null;
  hasLogo = false;
  hasBanner = false;
  uploadingArt: 'logo' | 'banner' | null = null;

  constructor(
    private http: HttpClient,
    private toast: ToastService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.loadCatalogue();
  }

  loadCatalogue(): void {
    this.loading = true;
    this.http.get<any>(this.api).subscribe({
      next: (res) => {
        this.catalogue = res.items || [];
        this.companies = Object.entries(res.companies || {}).map(([code, name]) => ({ code, name: name as string }));
        this.loading = false;
        // Auto-open the first company's Tax Invoice so the workspace — including
        // the logo/banner upload boxes and live preview — is visible immediately
        // instead of a blank grid the user has to click into.
        if (!this.selectedCompany && this.companies.length > 0) {
          this.select(this.companies[0].code, 'invoice');
        }
      },
      error: () => { this.loading = false; this.toast.error('Failed to load templates'); }
    });
  }

  cardFor(company: string, type: string): CatalogueItem | undefined {
    return this.catalogue.find(c => c.companyCode === company && c.documentType === type);
  }

  select(company: string, type: string): void {
    this.selectedCompany = company;
    this.selectedType = type;
    this.rptFile = null;
    this.sampleFile = null;
    this.selectedInvoice = null;
    this.previewUrl = null;
    this.invoices = [];
    this.invoiceSearch = '';
    this.loadTemplate();
    this.loadSample();
    this.loadInvoices();
    this.loadArtwork();
  }

  get selectedCard(): CatalogueItem | undefined {
    return this.cardFor(this.selectedCompany, this.selectedType);
  }

  get selectedTypeName(): string {
    return this.docTypes.find(d => d.key === this.selectedType)?.name || this.selectedType;
  }

  get selectedCompanyName(): string {
    return this.companies.find(c => c.code === this.selectedCompany)?.name || this.selectedCompany;
  }

  // ── uploads ──
  onRptPicked(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.rptFile = input.files?.[0] || null;
  }
  onSamplePicked(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.sampleFile = input.files?.[0] || null;
  }

  upload(): void {
    if (!this.selectedCompany || !this.selectedType) return;
    if (!this.rptFile && !this.sampleFile) {
      this.toast.warn('Pick a .rpt and/or a sample PDF first');
      return;
    }
    const fd = new FormData();
    fd.append('companyCode', this.selectedCompany);
    fd.append('documentType', this.selectedType);
    if (this.rptFile) fd.append('rptFile', this.rptFile);
    if (this.sampleFile) fd.append('sampleFile', this.sampleFile);

    this.uploading = true;
    this.http.post<any>(`${this.api}/upload`, fd).subscribe({
      next: (res) => {
        this.uploading = false;
        this.rptFile = null;
        this.sampleFile = null;
        const bits: string[] = [];
        if (res?.rptFileName) bits.push('RPT');
        if (res?.sampleFileName) bits.push('PDF sample');
        this.toast.done(`Uploaded ${bits.join(' + ') || 'file'} successfully`);
        // Reload catalogue first, THEN refresh the sample/template so the
        // freshly-saved sample actually renders (avoids stale hasSample).
        this.http.get<any>(this.api).subscribe({
          next: (cat) => {
            this.catalogue = cat.items || [];
            this.loadTemplate();
            this.loadSample();
          }
        });
      },
      error: (err) => {
        this.uploading = false;
        this.toast.error(err?.error?.error || 'Upload failed');
      }
    });
  }

  // ── template ──
  loadTemplate(): void {
    this.http.get<any>(`${this.api}/${this.selectedCompany}/${this.selectedType}/html`).subscribe({
      next: (res) => this.templateHtml = res.html || '',
      error: () => this.templateHtml = ''
    });
  }

  saveTemplate(): void {
    this.savingTemplate = true;
    this.http.put(`${this.api}/${this.selectedCompany}/${this.selectedType}/html`, { html: this.templateHtml }).subscribe({
      next: () => {
        this.savingTemplate = false;
        this.toast.done('Template saved');
        this.refreshPreview();
      },
      error: () => { this.savingTemplate = false; this.toast.error('Failed to save template'); }
    });
  }

  loadSample(): void {
    const card = this.selectedCard;
    if (card?.hasSample) {
      const url = `${this.api}/${this.selectedCompany}/${this.selectedType}/file/sample`;
      this.http.get(url, { responseType: 'blob' }).subscribe({
        next: (blob) => {
          const obj = URL.createObjectURL(blob);
          this.sampleUrl = this.sanitizer.bypassSecurityTrustResourceUrl(obj);
        },
        error: () => this.sampleUrl = null
      });
    } else {
      this.sampleUrl = null;
    }
  }

  // ── invoices + preview ──
  loadInvoices(): void {
    if (!this.selectedCompany) return;
    this.loadingInvoices = true;
    const q = this.invoiceSearch ? `?search=${encodeURIComponent(this.invoiceSearch)}` : '';
    this.http.get<InvoiceRow[]>(`${this.api}/${this.selectedCompany}/invoices${q}`).subscribe({
      next: (rows) => { this.invoices = rows || []; this.loadingInvoices = false; },
      error: () => { this.loadingInvoices = false; }
    });
  }

  pickInvoice(inv: InvoiceRow): void {
    this.selectedInvoice = inv;
    this.refreshPreview();
  }

  refreshPreview(): void {
    if (!this.selectedCompany || !this.selectedType) return;
    const txn = this.selectedInvoice?.transactionNumber || 'preview';
    const url = `${this.api}/${this.selectedCompany}/${this.selectedType}/preview/${encodeURIComponent(txn)}?t=${Date.now()}`;
    this.http.get(url, { responseType: 'text' }).subscribe({
      next: (html) => {
        const blob = new Blob([html], { type: 'text/html' });
        const obj = URL.createObjectURL(blob);
        this.previewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(obj);
      },
      error: () => this.toast.error('Failed to load preview')
    });
  }

  generatePdf(): void {
    if (!this.selectedInvoice) {
      this.toast.warn('Pick an invoice to generate');
      return;
    }
    const url = `${this.api}/${this.selectedCompany}/${this.selectedType}/generate/${encodeURIComponent(this.selectedInvoice.transactionNumber)}`;
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const obj = URL.createObjectURL(blob);
        window.open(obj, '_blank');
      },
      error: () => this.toast.error('Failed to generate PDF')
    });
  }

  openSample(): void {
    const url = `${this.api}/${this.selectedCompany}/${this.selectedType}/file/sample`;
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const obj = URL.createObjectURL(blob);
        window.open(obj, '_blank');
      },
      error: () => this.toast.error('Failed to open sample')
    });
  }

  // ── artwork (logo / banner) ──
  loadArtwork(): void {
    this.logoUrl = null;
    this.bannerUrl = null;
    this.hasLogo = false;
    this.hasBanner = false;
    if (!this.selectedCompany || !this.selectedType) return;
    const base = `${this.api}/${this.selectedCompany}/${this.selectedType}`;
    this.http.get<any>(`${base}/artwork`).subscribe({
      next: (s) => {
        this.hasLogo = !!s?.hasLogo;
        this.hasBanner = !!s?.hasBanner;
        if (this.hasLogo || s?.hasExtracted) this.fetchArt('logo');
        if (this.hasBanner || s?.hasExtracted) this.fetchArt('banner');
      },
      error: () => {}
    });
  }

  private fetchArt(role: 'logo' | 'banner'): void {
    const url = `${this.api}/${this.selectedCompany}/${this.selectedType}/artwork/${role}?t=${Date.now()}`;
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const obj = URL.createObjectURL(blob);
        if (role === 'logo') this.logoUrl = obj; else this.bannerUrl = obj;
      },
      error: () => { if (role === 'logo') this.logoUrl = null; else this.bannerUrl = null; }
    });
  }

  onArtPicked(e: Event, role: 'logo' | 'banner'): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('role', role);
    fd.append('file', file);
    this.uploadingArt = role;
    this.http.post<any>(`${this.api}/${this.selectedCompany}/${this.selectedType}/artwork`, fd).subscribe({
      next: () => {
        this.uploadingArt = null;
        input.value = '';
        this.toast.done(`${role === 'logo' ? 'Logo' : 'Artwork'} uploaded`);
        this.loadArtwork();
        this.refreshPreview();
      },
      error: (err) => {
        this.uploadingArt = null;
        this.toast.error(err?.error?.error || 'Artwork upload failed');
      }
    });
  }

  downloadArt(role: 'logo' | 'banner'): void {
    const url = `${this.api}/${this.selectedCompany}/${this.selectedType}/artwork/${role}?t=${Date.now()}`;
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        // Derive a sensible file extension from the blob's mime type
        const ext = blob.type.includes('png') ? 'png'
          : blob.type.includes('svg') ? 'svg'
          : blob.type.includes('gif') ? 'gif'
          : blob.type.includes('webp') ? 'webp'
          : 'jpg';
        const obj = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = obj;
        a.download = `${this.selectedCompany}_${this.selectedType}_${role}.${ext}`;
        a.click();
        URL.revokeObjectURL(obj);
      },
      error: () => this.toast.error(`Failed to download ${role}`)
    });
  }

  removeArt(role: 'logo' | 'banner'): void {
    this.http.delete(`${this.api}/${this.selectedCompany}/${this.selectedType}/artwork/${role}`).subscribe({
      next: () => {
        this.toast.done(`${role === 'logo' ? 'Logo' : 'Artwork'} removed`);
        this.loadArtwork();
        this.refreshPreview();
      },
      error: () => this.toast.error('Failed to remove artwork')
    });
  }
}
