import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const snackBar = inject(MatSnackBar);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let errorMessage = 'An unexpected error occurred';

      // Requests to the School Delivery integration authenticate against an
      // EXTERNAL system. Their 401/403 responses must NOT sign the user out of
      // the intranet — let the calling component handle those itself.
      const isExternalIntegration = req.url.includes('/schooldelivery');

      if (error.status === 0) {
        // Network error - server unreachable
        errorMessage = 'Unable to connect to server. Please check your connection and try again.';
        snackBar.open(errorMessage, 'Dismiss', {
          duration: 10000,
          panelClass: ['error-snackbar'],
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
      } else if (error.status === 401) {
        if (isExternalIntegration) {
          // Don't log the user out — surface the error to the component only.
          return throwError(() => error);
        }
        // Unauthorized - token expired or invalid
        errorMessage = 'Session expired. Please login again.';
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
        router.navigate(['/login']);
        snackBar.open(errorMessage, 'Dismiss', {
          duration: 5000,
          panelClass: ['warning-snackbar']
        });
      } else if (error.status === 403) {
        if (isExternalIntegration) {
          return throwError(() => error);
        }
        // Forbidden
        errorMessage = 'You do not have permission to perform this action.';
        snackBar.open(errorMessage, 'Dismiss', {
          duration: 5000,
          panelClass: ['warning-snackbar']
        });
      } else if (error.status === 404) {
        // Not found
        errorMessage = error.error?.message || 'The requested resource was not found.';
      } else if (error.status === 500) {
        // Server error
        errorMessage = 'Server error. Please try again later.';
        snackBar.open(errorMessage, 'Dismiss', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      } else if (error.status === 502 || error.status === 503 || error.status === 504) {
        // Gateway/Service errors
        errorMessage = 'Service temporarily unavailable. Please try again later.';
        snackBar.open(errorMessage, 'Dismiss', {
          duration: 10000,
          panelClass: ['error-snackbar'],
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
      } else if (error.error?.message) {
        errorMessage = error.error.message;
      }

      console.error('HTTP Error:', error.status, errorMessage);
      return throwError(() => ({ status: error.status, message: errorMessage, originalError: error }));
    })
  );
};
