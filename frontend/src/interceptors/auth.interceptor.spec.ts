import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';

describe('authInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let authService: jasmine.SpyObj<AuthService>;
  let tokenSignal: ReturnType<typeof signal<string | null>>;

  const mockToken = 'test-jwt-token-123';

  beforeEach(() => {
    tokenSignal = signal<string | null>(null);
    
    // Create mock AuthService with actual signal
    authService = jasmine.createSpyObj('AuthService', [], {
      token: tokenSignal
    });

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authService }
      ]
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('Token injection', () => {
    it('should add Authorization header when token exists', () => {
      tokenSignal.set(mockToken);

      httpClient.get('/api/users').subscribe();

      const req = httpMock.expectOne('/api/users');
      expect(req.request.headers.has('Authorization')).toBe(true);
      expect(req.request.headers.get('Authorization')).toBe(`Bearer ${mockToken}`);
      
      req.flush({});
    });

    it('should not add Authorization header when no token exists', () => {
      tokenSignal.set(null);

      httpClient.get('/api/users').subscribe();

      const req = httpMock.expectOne('/api/users');
      expect(req.request.headers.has('Authorization')).toBe(false);
      
      req.flush({});
    });

    it('should not override existing Authorization header', () => {
      tokenSignal.set(mockToken);

      const customToken = 'custom-token-456';
      httpClient.get('/api/users', {
        headers: { Authorization: `Bearer ${customToken}` }
      }).subscribe();

      const req = httpMock.expectOne('/api/users');
      expect(req.request.headers.get('Authorization')).toBe(`Bearer ${customToken}`);
      
      req.flush({});
    });
  });

  describe('Request types', () => {
    beforeEach(() => {
      tokenSignal.set(mockToken);
    });

    it('should add token to GET requests', () => {
      httpClient.get('/api/groups').subscribe();

      const req = httpMock.expectOne('/api/groups');
      expect(req.request.headers.get('Authorization')).toBe(`Bearer ${mockToken}`);
      
      req.flush({});
    });

    it('should add token to POST requests', () => {
      httpClient.post('/api/users', { name: 'Test User' }).subscribe();

      const req = httpMock.expectOne('/api/users');
      expect(req.request.headers.get('Authorization')).toBe(`Bearer ${mockToken}`);
      expect(req.request.method).toBe('POST');
      
      req.flush({});
    });

    it('should add token to DELETE requests', () => {
      httpClient.delete('/api/users/1').subscribe();

      const req = httpMock.expectOne('/api/users/1');
      expect(req.request.headers.get('Authorization')).toBe(`Bearer ${mockToken}`);
      expect(req.request.method).toBe('DELETE');
      
      req.flush({});
    });

    it('should add token to PATCH requests', () => {
      httpClient.patch('/api/expenses/1', { description: 'Updated' }).subscribe();

      const req = httpMock.expectOne('/api/expenses/1');
      expect(req.request.headers.get('Authorization')).toBe(`Bearer ${mockToken}`);
      expect(req.request.method).toBe('PATCH');
      
      req.flush({});
    });

    it('should add token to PUT requests', () => {
      httpClient.put('/api/groups/1', { name: 'Updated Group' }).subscribe();

      const req = httpMock.expectOne('/api/groups/1');
      expect(req.request.headers.get('Authorization')).toBe(`Bearer ${mockToken}`);
      expect(req.request.method).toBe('PUT');
      
      req.flush({});
    });
  });

  describe('Header preservation', () => {
    beforeEach(() => {
      tokenSignal.set(mockToken);
    });

    it('should preserve existing headers when adding Authorization', () => {
      httpClient.get('/api/users', {
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'custom-value'
        }
      }).subscribe();

      const req = httpMock.expectOne('/api/users');
      expect(req.request.headers.get('Authorization')).toBe(`Bearer ${mockToken}`);
      expect(req.request.headers.get('Content-Type')).toBe('application/json');
      expect(req.request.headers.get('X-Custom-Header')).toBe('custom-value');
      
      req.flush({});
    });

    it('should not affect request body', () => {
      const body = { name: 'Test', amount: 100.50 };
      httpClient.post('/api/expenses', body).subscribe();

      const req = httpMock.expectOne('/api/expenses');
      expect(req.request.body).toEqual(body);
      expect(req.request.headers.get('Authorization')).toBe(`Bearer ${mockToken}`);
      
      req.flush({});
    });

    it('should not affect query parameters', () => {
      httpClient.get('/api/groups', {
        params: { filter: 'active', sort: 'name' }
      }).subscribe();

      const req = httpMock.expectOne((r) => 
        r.url === '/api/groups' && 
        r.params.get('filter') === 'active' &&
        r.params.get('sort') === 'name'
      );
      expect(req.request.headers.get('Authorization')).toBe(`Bearer ${mockToken}`);
      
      req.flush({});
    });
  });

  describe('Token changes', () => {
    it('should use updated token on subsequent requests', () => {
      // First request with initial token
      tokenSignal.set('token-1');

      httpClient.get('/api/users').subscribe();
      const req1 = httpMock.expectOne('/api/users');
      expect(req1.request.headers.get('Authorization')).toBe('Bearer token-1');
      req1.flush({});

      // Second request with updated token
      tokenSignal.set('token-2');

      httpClient.get('/api/groups').subscribe();
      const req2 = httpMock.expectOne('/api/groups');
      expect(req2.request.headers.get('Authorization')).toBe('Bearer token-2');
      req2.flush({});
    });

    it('should stop adding header when token is cleared', () => {
      // First request with token
      tokenSignal.set(mockToken);

      httpClient.get('/api/users').subscribe();
      const req1 = httpMock.expectOne('/api/users');
      expect(req1.request.headers.has('Authorization')).toBe(true);
      req1.flush({});

      // Second request without token
      tokenSignal.set(null);

      httpClient.get('/api/groups').subscribe();
      const req2 = httpMock.expectOne('/api/groups');
      expect(req2.request.headers.has('Authorization')).toBe(false);
      req2.flush({});
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string token', () => {
      tokenSignal.set('');

      httpClient.get('/api/users').subscribe();

      const req = httpMock.expectOne('/api/users');
      expect(req.request.headers.has('Authorization')).toBe(false);
      
      req.flush({});
    });

    it('should handle undefined token', () => {
      tokenSignal.set(undefined as any);

      httpClient.get('/api/users').subscribe();

      const req = httpMock.expectOne('/api/users');
      expect(req.request.headers.has('Authorization')).toBe(false);
      
      req.flush({});
    });

    it('should work with multiple simultaneous requests', () => {
      tokenSignal.set(mockToken);

      httpClient.get('/api/users').subscribe();
      httpClient.get('/api/groups').subscribe();
      httpClient.get('/api/expenses').subscribe();

      const requests = httpMock.match(() => true);
      expect(requests.length).toBe(3);
      
      requests.forEach(req => {
        expect(req.request.headers.get('Authorization')).toBe(`Bearer ${mockToken}`);
        req.flush({});
      });
    });
  });
});
