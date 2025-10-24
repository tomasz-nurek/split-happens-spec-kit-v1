import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { AuthService } from '../services/auth.service';

/**
 * HTTP interceptor that automatically injects JWT tokens into outgoing requests.
 * 
 * Uses Angular v20 functional interceptor pattern with signal-based auth state.
 * Only adds Authorization header if:
 * - A valid token exists in auth state
 * - The request doesn't already have an Authorization header
 * 
 * @example
 * ```typescript
 * // Configure in app.config.ts
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideHttpClient(
 *       withInterceptors([authInterceptor])
 *     )
 *   ]
 * };
 * ```
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  // Skip if request already has Authorization header
  if (req.headers.has('Authorization')) {
    return next(req);
  }

  // Get current token from auth state
  const token = authService.token();

  // If no token, pass request through unchanged
  if (!token) {
    return next(req);
  }

  // Clone request and add Authorization header
  const authReq = req.clone({
    headers: req.headers.set('Authorization', `Bearer ${token}`)
  });

  return next(authReq);
};
