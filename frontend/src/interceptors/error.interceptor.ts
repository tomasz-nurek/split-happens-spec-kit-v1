import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { ErrorService } from '../services/error.service';
import { AuthService } from '../services/auth.service';

/**
 * HTTP interceptor for global error handling.
 * 
 * Uses Angular v20 functional interceptor pattern with signal-based services.
 * Handles:
 * - 401 Unauthorized: Clears auth state and redirects to login
 * - 403 Forbidden: Reports access denied error
 * - 5xx Server errors: Reports generic server error (security: no details exposed)
 * - Network errors: Reports connectivity issues
 * - All errors: Logged to ErrorService for centralized error tracking
 * 
 * @example
 * ```typescript
 * // Configure in app.config.ts
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideHttpClient(
 *       withInterceptors([errorInterceptor])
 *     )
 *   ]
 * };
 * ```
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const errorService = inject(ErrorService);
  const authService = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        switch (error.status) {
          case 401:
            // Unauthorized - clear auth state and redirect to login
            handleUnauthorized(authService, router, req.url);
            break;

          case 403:
            // Forbidden - user doesn't have permission
            errorService.reportError({
              message: 'Access denied. You do not have permission to perform this action.',
              details: error
            });
            break;

          case 404:
            // Not Found - resource doesn't exist
            errorService.reportError({
              message: extractErrorMessage(error) || 'The requested resource was not found.',
              details: error
            });
            break;

          case 0:
            // Network error (no response from server)
            errorService.reportError({
              message: 'Unable to connect to the server. Please check your internet connection.',
              details: error
            });
            break;

          default:
            if (error.status >= 500) {
              // Server error - don't expose details for security
              errorService.reportError({
                message: 'A server error occurred. Please try again later.',
                details: error
              });
            } else if (error.status >= 400) {
              // Client error - use server message if available
              const message = extractErrorMessage(error) || 'An error occurred processing your request.';
              errorService.reportError({
                message,
                details: error
              });
            } else {
              // Other errors
              errorService.reportError({
                message: 'An unexpected error occurred.',
                details: error
              });
            }
        }
      } else {
        // Non-HTTP error
        errorService.reportError({
          message: 'An unexpected error occurred.',
          details: error
        });
      }

      return throwError(() => error);
    })
  );
};

/**
 * Handle 401 Unauthorized errors by clearing auth state and redirecting to login.
 * Special handling for auth endpoints to prevent redirect loops.
 */
function handleUnauthorized(authService: AuthService, router: Router, requestUrl: string): void {
  // Don't redirect if already on login page or trying to login
  const isAuthEndpoint = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/verify');
  
  if (isAuthEndpoint) {
    // Just clear the session without redirect for auth endpoints
    void authService.logout();
    return;
  }

  // Clear session and redirect to login for other 401s
  void authService.logout().then(() => {
    void router.navigate(['/login'], {
      queryParams: { message: 'Your session has expired. Please sign in again.' }
    });
  });
}

/**
 * Extract error message from HTTP error response.
 * Checks multiple possible locations for error messages.
 */
function extractErrorMessage(error: HttpErrorResponse): string | null {
  // Check for string error
  if (typeof error.error === 'string') {
    return error.error;
  }

  // Check for error object with error property
  if (error.error && typeof error.error === 'object' && 'error' in error.error) {
    const candidate = (error.error as Record<string, unknown>)['error'];
    if (typeof candidate === 'string') {
      return candidate;
    }
  }

  // Check for error object with message property
  if (error.error && typeof error.error === 'object' && 'message' in error.error) {
    const candidate = (error.error as Record<string, unknown>)['message'];
    if (typeof candidate === 'string') {
      return candidate;
    }
  }

  // Check HttpErrorResponse message
  if (error.message) {
    return error.message;
  }

  return null;
}
