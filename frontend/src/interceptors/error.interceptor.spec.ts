import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';

import { errorInterceptor } from './error.interceptor';
import { AuthService } from '../services/auth.service';
import { ErrorService } from '../services/error.service';

describe('errorInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let authService: jasmine.SpyObj<AuthService>;
  let errorService: jasmine.SpyObj<ErrorService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    const authServiceSpy = jasmine.createSpyObj('AuthService', ['logout']);
    const errorServiceSpy = jasmine.createSpyObj('ErrorService', ['reportError']);
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: authServiceSpy },
        { provide: ErrorService, useValue: errorServiceSpy },
        { provide: Router, useValue: routerSpy }
      ]
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    errorService = TestBed.inject(ErrorService) as jasmine.SpyObj<ErrorService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;

    authService.logout.and.returnValue(Promise.resolve());
    router.navigate.and.returnValue(Promise.resolve(true));
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('401 Unauthorized handling', () => {
    it('should logout and redirect on 401 for non-auth endpoints', async () => {
      httpClient.get('/api/users').subscribe({
        error: () => { }
      });

      const req = httpMock.expectOne('/api/users');
      req.flush({ error: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(authService.logout).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/login'], {
        queryParams: { message: 'Your session has expired. Please sign in again.' }
      });
    });

    it('should only logout without redirect for auth/login endpoint', async () => {
      httpClient.post('/api/auth/login', { username: 'admin', password: 'wrong' }).subscribe({
        error: () => { }
      });

      const req = httpMock.expectOne('/api/auth/login');
      req.flush({ error: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(authService.logout).toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('should only logout without redirect for auth/verify endpoint', async () => {
      httpClient.get('/api/auth/verify').subscribe({
        error: () => { }
      });

      const req = httpMock.expectOne('/api/auth/verify');
      req.flush({ error: 'Invalid token' }, { status: 401, statusText: 'Unauthorized' });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(authService.logout).toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('should only logout without redirect for auth/login with query params', async () => {
      httpClient.post('/api/auth/login?returnUrl=/dashboard', { username: 'admin', password: 'wrong' }).subscribe({
        error: () => { }
      });

      const req = httpMock.expectOne(r => r.url.includes('/api/auth/login'));
      req.flush({ error: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(authService.logout).toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('should redirect for non-auth endpoints that contain auth in path', async () => {
      httpClient.get('/api/myauth/login').subscribe({
        error: () => { }
      });

      const req = httpMock.expectOne('/api/myauth/login');
      req.flush({ error: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(authService.logout).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/login'], {
        queryParams: { message: 'Your session has expired. Please sign in again.' }
      });
    });

    it('should redirect for non-auth endpoints that contain verify in path', async () => {
      httpClient.get('/api/verify_auth/login').subscribe({
        error: () => { }
      });

      const req = httpMock.expectOne('/api/verify_auth/login');
      req.flush({ error: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(authService.logout).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/login'], {
        queryParams: { message: 'Your session has expired. Please sign in again.' }
      });
    });
  });

  describe('403 Forbidden handling', () => {
    it('should report access denied error', () => {
      httpClient.get('/api/admin/settings').subscribe({
        error: () => { }
      });

      const req = httpMock.expectOne('/api/admin/settings');
      req.flush({ error: 'Forbidden' }, { status: 403, statusText: 'Forbidden' });

      expect(errorService.reportError).toHaveBeenCalledWith(
        jasmine.objectContaining({
          message: 'Access denied. You do not have permission to perform this action.'
        })
      );
    });
  });

  describe('404 Not Found handling', () => {
    it('should report not found error with server message', () => {
      httpClient.get('/api/users/999').subscribe({
        error: () => { }
      });

      const req = httpMock.expectOne('/api/users/999');
      req.flush({ error: 'User not found' }, { status: 404, statusText: 'Not Found' });

      expect(errorService.reportError).toHaveBeenCalledWith(
        jasmine.objectContaining({
          message: 'User not found'
        })
      );
    });

    it('should use HttpErrorResponse message when no server message', () => {
      httpClient.get('/api/users/999').subscribe({
        error: () => { }
      });

      const req = httpMock.expectOne('/api/users/999');
      req.flush(null, { status: 404, statusText: 'Not Found' });

      expect(errorService.reportError).toHaveBeenCalled();
      // HttpErrorResponse will generate its own message
      const call = errorService.reportError.calls.mostRecent();
      const arg = call.args[0];
      if (typeof arg === 'object' && arg !== null && 'message' in arg) {
        expect(arg.message).toContain('404');
      }
    });
  });

  describe('5xx Server error handling', () => {
    it('should report generic server error for 500', () => {
      httpClient.get('/api/users').subscribe({
        error: () => { }
      });

      const req = httpMock.expectOne('/api/users');
      req.flush({ error: 'Internal server error with sensitive details' }, { status: 500, statusText: 'Internal Server Error' });

      expect(errorService.reportError).toHaveBeenCalledWith(
        jasmine.objectContaining({
          message: 'A server error occurred. Please try again later.'
        })
      );
    });

    it('should not expose server details for 503', () => {
      httpClient.get('/api/users').subscribe({
        error: () => { }
      });

      const req = httpMock.expectOne('/api/users');
      req.flush({ error: 'Database connection failed at 192.168.1.100' }, { status: 503, statusText: 'Service Unavailable' });

      expect(errorService.reportError).toHaveBeenCalledWith(
        jasmine.objectContaining({
          message: 'A server error occurred. Please try again later.'
        })
      );
    });
  });

  describe('4xx Client error handling', () => {
    it('should report validation error with server message', () => {
      httpClient.post('/api/users', { name: '' }).subscribe({
        error: () => { }
      });

      const req = httpMock.expectOne('/api/users');
      req.flush({ error: 'Name is required' }, { status: 400, statusText: 'Bad Request' });

      expect(errorService.reportError).toHaveBeenCalledWith(
        jasmine.objectContaining({
          message: 'Name is required'
        })
      );
    });

    it('should use HttpErrorResponse message for 400 when no server message', () => {
      httpClient.post('/api/users', { invalid: 'data' }).subscribe({
        error: () => { }
      });

      const req = httpMock.expectOne('/api/users');
      req.flush(null, { status: 400, statusText: 'Bad Request' });

      expect(errorService.reportError).toHaveBeenCalled();
      // HttpErrorResponse will generate its own message
      const call = errorService.reportError.calls.mostRecent();
      const arg = call.args[0];
      if (typeof arg === 'object' && arg !== null && 'message' in arg) {
        expect(arg.message).toContain('400');
      }
    });
  });

  describe('Network error handling', () => {
    it('should report connectivity error for status 0', () => {
      httpClient.get('/api/users').subscribe({
        error: () => { }
      });

      const req = httpMock.expectOne('/api/users');
      req.error(new ProgressEvent('error'), { status: 0 });

      expect(errorService.reportError).toHaveBeenCalledWith(
        jasmine.objectContaining({
          message: 'Unable to connect to the server. Please check your internet connection.'
        })
      );
    });
  });

  describe('Error message extraction', () => {
    it('should extract message from error.error string', () => {
      httpClient.get('/api/users').subscribe({
        error: () => { }
      });

      const req = httpMock.expectOne('/api/users');
      req.flush('Simple error string', { status: 400, statusText: 'Bad Request' });

      expect(errorService.reportError).toHaveBeenCalledWith(
        jasmine.objectContaining({
          message: 'Simple error string'
        })
      );
    });

    it('should extract message from error.error.error property', () => {
      httpClient.get('/api/users').subscribe({
        error: () => { }
      });

      const req = httpMock.expectOne('/api/users');
      req.flush({ error: 'Error message here' }, { status: 400, statusText: 'Bad Request' });

      expect(errorService.reportError).toHaveBeenCalledWith(
        jasmine.objectContaining({
          message: 'Error message here'
        })
      );
    });

    it('should extract message from error.error.message property', () => {
      httpClient.get('/api/users').subscribe({
        error: () => { }
      });

      const req = httpMock.expectOne('/api/users');
      req.flush({ message: 'Message property here' }, { status: 400, statusText: 'Bad Request' });

      expect(errorService.reportError).toHaveBeenCalledWith(
        jasmine.objectContaining({
          message: 'Message property here'
        })
      );
    });

    it('should use HttpErrorResponse message as fallback', () => {
      httpClient.get('/api/users').subscribe({
        error: () => { }
      });

      const req = httpMock.expectOne('/api/users');
      // Flush with null body, HttpErrorResponse will have a default message
      req.flush(null, { status: 400, statusText: 'Bad Request' });

      expect(errorService.reportError).toHaveBeenCalled();
      const call = errorService.reportError.calls.mostRecent();
      const arg = call.args[0];
      if (typeof arg === 'object' && arg !== null && 'message' in arg) {
        expect(arg.message).toBeTruthy();
      } else {
        expect(arg).toBeTruthy();
      }
    });
  });

  describe('Non-HTTP errors', () => {
    it('should handle generic errors gracefully', () => {
      httpClient.get('/api/users').subscribe({
        error: () => { }
      });

      const req = httpMock.expectOne('/api/users');
      // Just fail with an error, don't worry about invalid JSON
      req.error(new ProgressEvent('error'), { status: 0 });

      // Should have reported the network error
      expect(errorService.reportError).toHaveBeenCalled();
    });
  });

  describe('Error propagation', () => {
    it('should still throw the error after handling', (done) => {
      httpClient.get('/api/users').subscribe({
        error: (error) => {
          expect(error).toBeInstanceOf(HttpErrorResponse);
          expect(error.status).toBe(500);
          done();
        }
      });

      const req = httpMock.expectOne('/api/users');
      req.flush({ error: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });
    });

    it('should allow error subscribers to handle errors', () => {
      const errorHandler = jasmine.createSpy('errorHandler');
      
      httpClient.get('/api/users').subscribe({
        error: errorHandler
      });

      const req = httpMock.expectOne('/api/users');
      req.flush({ error: 'Test error' }, { status: 400, statusText: 'Bad Request' });

      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('Multiple requests', () => {
    it('should handle errors for each request independently', () => {
      httpClient.get('/api/users').subscribe({ error: () => { } });
      httpClient.get('/api/groups').subscribe({ error: () => { } });
      httpClient.get('/api/expenses').subscribe({ error: () => { } });

      const userReq = httpMock.expectOne('/api/users');
      const groupReq = httpMock.expectOne('/api/groups');
      const expenseReq = httpMock.expectOne('/api/expenses');

      userReq.flush({ error: 'User error' }, { status: 400, statusText: 'Bad Request' });
      groupReq.flush({ error: 'Group error' }, { status: 404, statusText: 'Not Found' });
      expenseReq.flush({ error: 'Expense error' }, { status: 500, statusText: 'Internal Server Error' });

      expect(errorService.reportError).toHaveBeenCalledTimes(3);
    });
  });
});
