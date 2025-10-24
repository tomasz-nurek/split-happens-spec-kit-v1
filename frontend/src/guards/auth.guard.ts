import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';

/**
 * Auth guard for protecting routes that require authentication.
 * 
 * Uses Angular v20 functional guard pattern with signal-based auth state.
 * Redirects unauthenticated users to the login page.
 * 
 * @example
 * ```typescript
 * const routes: Routes = [
 *   {
 *     path: 'dashboard',
 *     component: DashboardComponent,
 *     canActivate: [authGuard]
 *   }
 * ];
 * ```
 */
export const authGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wait for initialization to complete if needed
  if (authService.isInitializing()) {
    // Give a reasonable timeout for initialization
    const maxWaitMs = 3000;
    const startTime = Date.now();
    
    while (authService.isInitializing() && Date.now() - startTime < maxWaitMs) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  // Ensure user is authenticated
  const isAuthenticated = await authService.ensureAuthenticated();

  if (!isAuthenticated) {
    // Store the attempted URL for redirecting after login
    const returnUrl = state.url;
    return router.createUrlTree(['/login'], {
      queryParams: { returnUrl }
    });
  }

  return true;
};
