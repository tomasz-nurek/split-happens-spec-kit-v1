import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, Router, UrlTree, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('authGuard', () => {
  let authService: AuthService;
  let router: Router;
  let httpMock: HttpTestingController;

  const mockRoute = {} as ActivatedRouteSnapshot;
  const createMockState = (url: string): RouterStateSnapshot => ({
    url,
    root: {} as ActivatedRouteSnapshot
  } as RouterStateSnapshot);
  
  const mockState = createMockState('/dashboard');
  const mockToken = 'test-jwt-token';

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'login', component: class {} },
          { path: 'dashboard', component: class {} }
        ]),
        AuthService
      ]
    }).compileComponents();

    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    httpMock = TestBed.inject(HttpTestingController);

    // Wait for auth service initialization and reject any pending requests
    await new Promise(resolve => setTimeout(resolve, 100));
    httpMock.match(() => true).forEach(req => 
      req.flush({ valid: false }, { status: 401, statusText: 'Unauthorized' })
    );
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  describe('Authentication checks', () => {
    it('should allow access when user is authenticated', async () => {
      // Manually set authenticated state by calling login and fulfilling request
      const loginPromise = authService.login('admin', 'password123');
      
      // Fulfill the login request immediately (don't wait)
      const loginReq = httpMock.expectOne(req => req.url.includes('/auth/login'));
      loginReq.flush({ token: mockToken, user: { id: 1, name: 'Admin' } });
      
      // Wait for login to complete
      await loginPromise;

      const result = await TestBed.runInInjectionContext(
        () => authGuard(mockRoute, mockState)
      );

      expect(result).toBe(true);
    });

    it('should redirect to login when user is not authenticated', async () => {
      // Ensure not authenticated (no login)
      const result = await TestBed.runInInjectionContext(
        () => authGuard(mockRoute, mockState)
      );

      expect(result).toBeInstanceOf(UrlTree);
      const urlTree = result as UrlTree;
      expect(urlTree.toString()).toContain('/login');
      expect(urlTree.queryParams['returnUrl']).toBe('/dashboard');
    });

    it('should preserve the attempted URL in returnUrl query param', async () => {
      const attemptedState = createMockState('/expenses/create');

      const result = await TestBed.runInInjectionContext(
        () => authGuard(mockRoute, attemptedState)
      );

      const urlTree = result as UrlTree;
      expect(urlTree.queryParams['returnUrl']).toBe('/expenses/create');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty state URL', async () => {
      const emptyState = createMockState('');

      const result = await TestBed.runInInjectionContext(
        () => authGuard(mockRoute, emptyState)
      );

      const urlTree = result as UrlTree;
      expect(urlTree.queryParams['returnUrl']).toBe('');
    });

    it('should handle root path URL', async () => {
      const rootState = createMockState('/');

      const result = await TestBed.runInInjectionContext(
        () => authGuard(mockRoute, rootState)
      );

      const urlTree = result as UrlTree;
      expect(urlTree.queryParams['returnUrl']).toBe('/');
    });

    it('should handle URLs with query params', async () => {
      const queryState = createMockState('/groups?filter=active&sort=name');

      const result = await TestBed.runInInjectionContext(
        () => authGuard(mockRoute, queryState)
      );

      const urlTree = result as UrlTree;
      expect(urlTree.queryParams['returnUrl']).toBe('/groups?filter=active&sort=name');
    });

    it('should handle URLs with fragments', async () => {
      const fragmentState = createMockState('/expenses#recent');

      const result = await TestBed.runInInjectionContext(
        () => authGuard(mockRoute, fragmentState)
      );

      const urlTree = result as UrlTree;
      expect(urlTree.queryParams['returnUrl']).toBe('/expenses#recent');
    });
  });

  describe('Integration with AuthService', () => {
    it('should work correctly when auth state changes during check', async () => {
      // First check should fail (no auth)
      const result1 = await TestBed.runInInjectionContext(
        () => authGuard(mockRoute, mockState)
      );
      expect(result1).toBeInstanceOf(UrlTree);

      // Login (don't await to avoid hanging)
      const loginPromise = authService.login('admin', 'password123');
      
      // Fulfill the login request immediately
      const loginReq = httpMock.expectOne(req => req.url.includes('/auth/login'));
      loginReq.flush({ token: mockToken, user: { id: 1, name: 'Admin' } });
      
      // Now await the login
      await loginPromise;

      // Second check should succeed
      const result2 = await TestBed.runInInjectionContext(
        () => authGuard(mockRoute, mockState)
      );
      expect(result2).toBe(true);
    });

    it('should respect token in localStorage on page load', async () => {
      // Simulate a page reload scenario where token is already in localStorage
      // This tests that the guard waits for token verification to complete
      
      // Setup: Put a valid token in localStorage (simulating it being there from a previous session)
      const validToken = 'valid-stored-token-xyz';
      localStorage.setItem('split-happens.auth.token', validToken);
      
      // Manually trigger verification (this is what happens on AuthService init)
      const verifyPromise = authService.verifyCurrentSession();
      
      // Fulfill the verify request
      const verifyReq = httpMock.expectOne(req => req.url.includes('/auth/verify'));
      verifyReq.flush({ 
        valid: true, 
        user: { id: 1, name: 'Admin' } 
      });
      
      // Wait for verification to complete
      await verifyPromise;
      
      // Now run the guard - it should allow access because token was verified
      const result = await TestBed.runInInjectionContext(
        () => authGuard(mockRoute, mockState)
      );
      
      expect(result).toBe(true);
      expect(authService.isAuthenticated()).toBe(true);
    });

    it('should redirect when localStorage token is invalid on page load', async () => {
      // First, ensure we're logged out
      await authService.logout();
      
      // Simulate a page reload with an INVALID token in localStorage
      const invalidToken = 'invalid-expired-token-abc';
      localStorage.setItem('split-happens.auth.token', invalidToken);
      
      // Trigger token verification
      const verifyPromise = authService.verifyCurrentSession({ silent: true });
      
      // Fulfill the verify request with failure (invalid token)
      const verifyReq = httpMock.expectOne(req => req.url.includes('/auth/verify'));
      verifyReq.flush({ error: 'Invalid token' }, { status: 401, statusText: 'Unauthorized' });
      
      // Wait for verification to complete
      await verifyPromise;
      
      // Now run the guard - it should redirect because token was invalid
      const result = await TestBed.runInInjectionContext(
        () => authGuard(mockRoute, mockState)
      );
      
      expect(result).toBeInstanceOf(UrlTree);
      const urlTree = result as UrlTree;
      expect(urlTree.toString()).toContain('/login');
      expect(urlTree.queryParams['returnUrl']).toBe('/dashboard');
      expect(authService.isAuthenticated()).toBe(false);
    });
  });
});
