import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export interface ExecUser { userId: number; name: string; email: string; role: string; hasSignature: boolean; }
interface Session { token: string; expiresAt: string; user: ExecUser; }

const KEY = 'exec-session';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly session = signal<Session | null>(AuthStore.load());
  readonly user = computed(() => this.session()?.user ?? null);
  readonly token = computed(() => this.session()?.token ?? null);
  readonly signedIn = computed(() => {
    const s = this.session(); return !!s && new Date(s.expiresAt).getTime() > Date.now();
  });

  set(s: Session) { this.session.set(s); sessionStorage.setItem(KEY, JSON.stringify(s)); }
  clear() { this.session.set(null); sessionStorage.removeItem(KEY); }

  private static load(): Session | null {
    try { const raw = sessionStorage.getItem(KEY); if (!raw) return null; const s = JSON.parse(raw) as Session; return new Date(s.expiresAt).getTime() > Date.now() ? s : null; }
    catch { return null; }
  }
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(AuthStore); const router = inject(Router);
  const t = store.token();
  const r = t && !req.url.includes('/api/exec/auth/') ? req.clone({ setHeaders: { Authorization: `Bearer ${t}` } }) : req;
  return next(r).pipe(catchError((e: HttpErrorResponse) => {
    if (e.status === 401 && t) { store.clear(); router.navigate(['/login'], { queryParams: { next: router.url } }); }
    return throwError(() => e);
  }));
};

export const signedInGuard: CanActivateFn = (_r, state) => {
  const store = inject(AuthStore); const router = inject(Router);
  return store.signedIn() ? true : router.createUrlTree(['/login'], { queryParams: { next: state.url } });
};
