import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

/** Adds the bearer token to portal API calls and signs out on 401. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();
  const isApi = req.url.startsWith(environment.apiBase);
  const isLogin = req.url.endsWith('/auth/login');
  const authed = token && isApi && !isLogin ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(authed).pipe(catchError((e: HttpErrorResponse) => {
    if (e.status === 401 && isApi && !isLogin) auth.logout('expired');
    return throwError(() => e);
  }));
};
