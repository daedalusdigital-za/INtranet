import { Directive, ElementRef, Input, OnChanges, OnDestroy, Renderer2, SimpleChanges } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subscription } from 'rxjs';

/**
 * Loads a protected resource (image, PDF, …) with the user's JWT and renders
 * it through a blob: URL. Plain <img src> / <iframe src> requests never carry
 * the Authorization header, so they hit the API's [Authorize] wall and the
 * browser shows a broken image.
 *
 * Usage:
 *   <img [appSecureSrc]="url" alt="…">
 *   <iframe [appSecureSrc]="url"></iframe>
 */
@Directive({
  selector: 'img[appSecureSrc], iframe[appSecureSrc], video[appSecureSrc], audio[appSecureSrc]',
  standalone: true
})
export class SecureSrcDirective implements OnChanges, OnDestroy {
  @Input('appSecureSrc') url: string | null | undefined;

  private objectUrl: string | null = null;
  private sub?: Subscription;

  private static readonly cache = new Map<string, string>();

  constructor(private el: ElementRef<HTMLElement>, private renderer: Renderer2, private http: HttpClient) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['url']) {
      this.load();
    }
  }

  private load(): void {
    this.sub?.unsubscribe();

    const url = (this.url || '').trim();
    if (!url) {
      this.renderer.removeAttribute(this.el.nativeElement, 'src');
      return;
    }

    // Already a data:/blob: URL or a non-API asset — use directly.
    if (url.startsWith('data:') || url.startsWith('blob:')) {
      this.renderer.setAttribute(this.el.nativeElement, 'src', url);
      return;
    }

    const cached = SecureSrcDirective.cache.get(url);
    if (cached) {
      this.renderer.setAttribute(this.el.nativeElement, 'src', cached);
      return;
    }

    this.renderer.addClass(this.el.nativeElement, 'secure-src-loading');
    const token = localStorage.getItem('token') || '';
    const headers = new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});

    this.sub = this.http.get(url, { headers, responseType: 'blob' }).subscribe({
      next: blob => {
        const objectUrl = URL.createObjectURL(blob);
        SecureSrcDirective.cache.set(url, objectUrl);
        this.objectUrl = objectUrl;
        this.renderer.setAttribute(this.el.nativeElement, 'src', objectUrl);
        this.renderer.removeClass(this.el.nativeElement, 'secure-src-loading');
        this.renderer.removeClass(this.el.nativeElement, 'secure-src-error');
      },
      error: () => {
        this.renderer.removeClass(this.el.nativeElement, 'secure-src-loading');
        this.renderer.addClass(this.el.nativeElement, 'secure-src-error');
        this.renderer.removeAttribute(this.el.nativeElement, 'src');
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    // Object URLs are kept in the shared cache so re-rendered lists do not
    // re-download; they are released when the page unloads.
  }
}
