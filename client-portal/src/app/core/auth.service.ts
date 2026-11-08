import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { ClientUser, LoginResponse } from './models';
import { PortalApi } from './portal-api';

const KEY = 'portal.session';

interface Session { token: string; expiresAt: string; user: ClientUser; }

/**
 * Keeps the session token in sessionStorage so it ends when the tab closes.
 * If the backend issues an httpOnly cookie instead, drop the token handling here
 * and in the interceptor; the rest of the app only reads `user()`.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(PortalApi);
  private router = inject(Router);
  private session = signal<Session | null>(read());

  readonly user = computed(() => this.session()?.user ?? null);
  readonly token = computed(() => this.session()?.token ?? null);

  isLoggedIn(): boolean {
    const s = this.session();
    return !!s && new Date(s.expiresAt).getTime() > Date.now();
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.api.login(email, password).pipe(tap(r => {
      const s = { token: r.token, expiresAt: r.expiresAt, user: r.user };
      this.session.set(s);
      write(s);
    }));
  }

  logout(reason?: 'expired'): void {
    this.session.set(null);
    write(null);
    this.router.navigate(['/login'], reason ? { queryParams: { reason } } : {});
  }
}

function read(): Session | null {
  try { const raw = sessionStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function write(s: Session | null): void {
  try { s ? sessionStorage.setItem(KEY, JSON.stringify(s)) : sessionStorage.removeItem(KEY); } catch { /* storage blocked: session lives in memory */ }
}
