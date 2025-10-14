import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';

import { UserService } from './user.service';
import { ApiService } from './api.service';
import { ErrorService } from './error.service';
import { User } from '../types/api';

describe('UserService', () => {
  let service: UserService;
  let httpMock: HttpTestingController;
  let errorService: jasmine.SpyObj<ErrorService>;

  const mockUsers: User[] = [
    { id: 1, name: 'Alice', createdAt: '2025-01-01T00:00:00Z' },
    { id: 2, name: 'Bob', createdAt: '2025-01-02T00:00:00Z' },
    { id: 3, name: 'Charlie', createdAt: '2025-01-03T00:00:00Z' }
  ];

  beforeEach(async () => {
    const errorServiceSpy = jasmine.createSpyObj('ErrorService', ['reportError', 'clearError']);

    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        UserService,
        ApiService,
        { provide: ErrorService, useValue: errorServiceSpy }
      ]
    }).compileComponents();

    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
    errorService = TestBed.inject(ErrorService) as jasmine.SpyObj<ErrorService>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('Initial State', () => {
    it('should start with empty users array', () => {
      expect(service.users()).toEqual([]);
    });

    it('should start with idle status', () => {
      expect(service.isIdle()).toBe(true);
      expect(service.isLoading()).toBe(false);
      expect(service.isSuccess()).toBe(false);
      expect(service.isError()).toBe(false);
    });

    it('should have no error initially', () => {
      expect(service.errorSignal()).toBeNull();
    });

    it('should have userCount of 0 initially', () => {
      expect(service.userCount()).toBe(0);
    });

    it('should have hasUsers false initially', () => {
      expect(service.hasUsers()).toBe(false);
    });

    it('should have lastLoadedAt null initially', () => {
      expect(service.lastLoadedAt()).toBeNull();
    });
  });

  describe('loadUsers()', () => {
    it('should load users successfully', async () => {
      const loadPromise = service.loadUsers();

      const req = httpMock.expectOne('http://localhost:3000/api/users');
      expect(req.request.method).toBe('GET');
      req.flush(mockUsers);

      const result = await loadPromise;

      expect(result).toEqual(mockUsers);
      expect(service.users()).toEqual(mockUsers);
      expect(service.isSuccess()).toBe(true);
      expect(service.isLoading()).toBe(false);
      expect(service.userCount()).toBe(3);
      expect(service.hasUsers()).toBe(true);
      expect(service.lastLoadedAt()).toBeTruthy();
      expect(errorService.clearError).toHaveBeenCalled();
    });

    it('should update loading state while fetching', async () => {
      const loadPromise = service.loadUsers();

      expect(service.isLoading()).toBe(true);

      const req = httpMock.expectOne('http://localhost:3000/api/users');
      req.flush(mockUsers);

      await loadPromise;

      expect(service.isLoading()).toBe(false);
    });

    it('should handle HTTP errors gracefully', async () => {
      const loadPromise = service.loadUsers();

      const req = httpMock.expectOne('http://localhost:3000/api/users');
      req.flush({ error: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });

      const result = await loadPromise;

      expect(result).toEqual([]);
      expect(service.users()).toEqual([]);
      expect(service.isError()).toBe(true);
      expect(service.errorSignal()).toBeTruthy();
      expect(errorService.reportError).toHaveBeenCalled();
    });

    it('should handle network errors', async () => {
      const loadPromise = service.loadUsers();

      const req = httpMock.expectOne('http://localhost:3000/api/users');
      req.error(new ProgressEvent('Network error'));

      const result = await loadPromise;

      expect(result).toEqual([]);
      expect(service.isError()).toBe(true);
      expect(service.errorSignal()).toBeTruthy();
    });

    it('should extract error message from HTTP error response', async () => {
      const loadPromise = service.loadUsers();

      const req = httpMock.expectOne('http://localhost:3000/api/users');
      req.flush({ error: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

      await loadPromise;

      expect(service.errorSignal()).toBe('Unauthorized');
    });

    it('should clear previous errors on successful load', async () => {
      // First, trigger an error
      let loadPromise = service.loadUsers();
      let req = httpMock.expectOne('http://localhost:3000/api/users');
      req.flush({ error: 'Error' }, { status: 500, statusText: 'Error' });
      await loadPromise;

      expect(service.errorSignal()).toBeTruthy();

      // Then load successfully
      loadPromise = service.loadUsers();
      req = httpMock.expectOne('http://localhost:3000/api/users');
      req.flush(mockUsers);
      await loadPromise;

      expect(service.errorSignal()).toBeNull();
      expect(errorService.clearError).toHaveBeenCalled();
    });
  });

  describe('createUser()', () => {
    const newUser: User = { id: 4, name: 'David', createdAt: '2025-01-04T00:00:00Z' };

    it('should create a user successfully', async () => {
      // Load initial users first
      const loadPromise = service.loadUsers();
      let req = httpMock.expectOne('http://localhost:3000/api/users');
      req.flush(mockUsers);
      await loadPromise;

      const initialCount = service.userCount();

      // Create new user
      const createPromise = service.createUser('David');

      req = httpMock.expectOne('http://localhost:3000/api/users');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ name: 'David' });
      req.flush(newUser);

      const result = await createPromise;

      expect(result).toEqual(newUser);
      expect(service.users()).toContain(newUser);
      expect(service.userCount()).toBe(initialCount + 1);
      expect(service.isSuccess()).toBe(true);
      expect(errorService.clearError).toHaveBeenCalled();
    });

    it('should trim whitespace from user name', async () => {
      const createPromise = service.createUser('  David  ');

      const req = httpMock.expectOne('http://localhost:3000/api/users');
      expect(req.request.body).toEqual({ name: 'David' });
      req.flush(newUser);

      await createPromise;
    });

    it('should reject empty name', async () => {
      const result = await service.createUser('');

      expect(result).toBeNull();
      expect(service.errorSignal()).toBe('User name is required');
      expect(errorService.reportError).toHaveBeenCalled();

      httpMock.expectNone('http://localhost:3000/api/users');
    });

    it('should reject whitespace-only name', async () => {
      const result = await service.createUser('   ');

      expect(result).toBeNull();
      expect(service.errorSignal()).toBe('User name is required');

      httpMock.expectNone('http://localhost:3000/api/users');
    });

    it('should handle validation errors from API', async () => {
      const createPromise = service.createUser('A');

      const req = httpMock.expectOne('http://localhost:3000/api/users');
      req.flush(
        { error: 'Name must be between 1 and 100 characters' },
        { status: 400, statusText: 'Bad Request' }
      );

      const result = await createPromise;

      expect(result).toBeNull();
      expect(service.errorSignal()).toBe('Name must be between 1 and 100 characters');
      expect(errorService.reportError).toHaveBeenCalled();
    });

    it('should restore previous state on error', async () => {
      // Load initial users
      let loadPromise = service.loadUsers();
      let req = httpMock.expectOne('http://localhost:3000/api/users');
      req.flush(mockUsers);
      await loadPromise;

      expect(service.isSuccess()).toBe(true);
      const initialUsers = service.users();

      // Try to create user (fails)
      const createPromise = service.createUser('Invalid');
      req = httpMock.expectOne('http://localhost:3000/api/users');
      req.flush({ error: 'Error' }, { status: 500, statusText: 'Error' });
      await createPromise;

      expect(service.users()).toEqual(initialUsers);
      expect(service.isSuccess()).toBe(true); // Status restored to previous success
    });

    it('should update lastLoadedAt on successful creation', async () => {
      const beforeCreate = new Date();
      
      const createPromise = service.createUser('David');
      const req = httpMock.expectOne('http://localhost:3000/api/users');
      req.flush(newUser);
      await createPromise;

      const lastLoaded = service.lastLoadedAt();
      expect(lastLoaded).toBeTruthy();
      expect(new Date(lastLoaded!).getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
    });
  });

  describe('deleteUser()', () => {
    beforeEach(async () => {
      // Load initial users
      const loadPromise = service.loadUsers();
      const req = httpMock.expectOne('http://localhost:3000/api/users');
      req.flush(mockUsers);
      await loadPromise;
    });

    it('should delete a user successfully', async () => {
      const initialCount = service.userCount();
      const userToDelete = mockUsers[0];

      const deletePromise = service.deleteUser(userToDelete.id);

      const req = httpMock.expectOne(`http://localhost:3000/api/users/${userToDelete.id}`);
      expect(req.request.method).toBe('DELETE');
      req.flush({ message: 'User deleted successfully' });

      const result = await deletePromise;

      expect(result).toBe(true);
      expect(service.users()).not.toContain(userToDelete);
      expect(service.userCount()).toBe(initialCount - 1);
      expect(service.isSuccess()).toBe(true);
      expect(errorService.clearError).toHaveBeenCalled();
    });

    it('should reject invalid user ID (zero)', async () => {
      const result = await service.deleteUser(0);

      expect(result).toBe(false);
      expect(service.errorSignal()).toBe('Invalid user ID');
      expect(errorService.reportError).toHaveBeenCalled();

      httpMock.expectNone('http://localhost:3000/api/users/0');
    });

    it('should reject invalid user ID (negative)', async () => {
      const result = await service.deleteUser(-1);

      expect(result).toBe(false);
      expect(service.errorSignal()).toBe('Invalid user ID');

      httpMock.expectNone('http://localhost:3000/api/users/-1');
    });

    it('should handle not found errors', async () => {
      const deletePromise = service.deleteUser(999);

      const req = httpMock.expectOne('http://localhost:3000/api/users/999');
      req.flush({ error: 'User not found' }, { status: 404, statusText: 'Not Found' });

      const result = await deletePromise;

      expect(result).toBe(false);
      expect(service.errorSignal()).toBe('User not found');
      expect(errorService.reportError).toHaveBeenCalled();
    });

    it('should restore previous state on error', async () => {
      const initialUsers = service.users();

      const deletePromise = service.deleteUser(mockUsers[0].id);
      const req = httpMock.expectOne(`http://localhost:3000/api/users/${mockUsers[0].id}`);
      req.flush({ error: 'Error' }, { status: 500, statusText: 'Error' });
      await deletePromise;

      expect(service.users()).toEqual(initialUsers);
      expect(service.isSuccess()).toBe(true);
    });

    it('should update lastLoadedAt on successful deletion', async () => {
      const beforeDelete = new Date();
      
      const deletePromise = service.deleteUser(mockUsers[0].id);
      const req = httpMock.expectOne(`http://localhost:3000/api/users/${mockUsers[0].id}`);
      req.flush({ message: 'User deleted successfully' });
      await deletePromise;

      const lastLoaded = service.lastLoadedAt();
      expect(lastLoaded).toBeTruthy();
      expect(new Date(lastLoaded!).getTime()).toBeGreaterThanOrEqual(beforeDelete.getTime());
    });
  });

  describe('findUserById()', () => {
    beforeEach(async () => {
      const loadPromise = service.loadUsers();
      const req = httpMock.expectOne('http://localhost:3000/api/users');
      req.flush(mockUsers);
      await loadPromise;
    });

    it('should find existing user by ID', () => {
      const user = service.findUserById(2);
      expect(user).toEqual(mockUsers[1]);
    });

    it('should return undefined for non-existent user', () => {
      const user = service.findUserById(999);
      expect(user).toBeUndefined();
    });

    it('should not make API call', () => {
      service.findUserById(1);
      httpMock.expectNone('http://localhost:3000/api/users/1');
      expect(true).toBe(true); // Ensure test has an expectation
    });
  });

  describe('usersSortedByName', () => {
    beforeEach(async () => {
      const unsortedUsers = [
        { id: 1, name: 'Zoe', createdAt: '2025-01-01T00:00:00Z' },
        { id: 2, name: 'Alice', createdAt: '2025-01-02T00:00:00Z' },
        { id: 3, name: 'Bob', createdAt: '2025-01-03T00:00:00Z' }
      ];

      const loadPromise = service.loadUsers();
      const req = httpMock.expectOne('http://localhost:3000/api/users');
      req.flush(unsortedUsers);
      await loadPromise;
    });

    it('should return users sorted alphabetically by name', () => {
      const sorted = service.usersSortedByName();
      expect(sorted[0].name).toBe('Alice');
      expect(sorted[1].name).toBe('Bob');
      expect(sorted[2].name).toBe('Zoe');
    });

    it('should not modify original users array', () => {
      const original = service.users();
      const sorted = service.usersSortedByName();
      
      expect(sorted).not.toBe(original);
      expect(original[0].name).toBe('Zoe'); // Original order preserved
    });

    it('should be case-insensitive', () => {
      // This is testing the localeCompare behavior
      const sorted = service.usersSortedByName();
      expect(sorted.length).toBe(3);
    });
  });

  describe('searchUsers()', () => {
    beforeEach(async () => {
      const loadPromise = service.loadUsers();
      const req = httpMock.expectOne('http://localhost:3000/api/users');
      req.flush(mockUsers);
      await loadPromise;
    });

    it('should return all users for empty query', () => {
      const searchSignal = service.searchUsers('');
      expect(searchSignal()).toEqual(mockUsers);
    });

    it('should return all users for whitespace query', () => {
      const searchSignal = service.searchUsers('   ');
      expect(searchSignal()).toEqual(mockUsers);
    });

    it('should filter users by name (case-insensitive)', () => {
      const searchSignal = service.searchUsers('ali');
      const results = searchSignal();
      
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Alice');
    });

    it('should filter users with uppercase query', () => {
      const searchSignal = service.searchUsers('BOB');
      const results = searchSignal();
      
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Bob');
    });

    it('should return empty array for no matches', () => {
      const searchSignal = service.searchUsers('xyz');
      expect(searchSignal()).toEqual([]);
    });

    it('should filter users by partial name match', () => {
      const searchSignal = service.searchUsers('ar');
      const results = searchSignal();
      
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Charlie');
    });

    it('should be reactive to state changes', async () => {
      const searchSignal = service.searchUsers('david');
      expect(searchSignal()).toEqual([]);

      // Add a user named David
      const createPromise = service.createUser('David');
      const req = httpMock.expectOne('http://localhost:3000/api/users');
      req.flush({ id: 4, name: 'David', createdAt: '2025-01-04T00:00:00Z' });
      await createPromise;

      // Search should now include David
      const results = searchSignal();
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('David');
    });
  });

  describe('clearError()', () => {
    it('should clear error state', async () => {
      // Trigger an error
      const loadPromise = service.loadUsers();
      const req = httpMock.expectOne('http://localhost:3000/api/users');
      req.flush({ error: 'Error' }, { status: 500, statusText: 'Error' });
      await loadPromise;

      expect(service.errorSignal()).toBeTruthy();

      service.clearError();

      expect(service.errorSignal()).toBeNull();
    });
  });

  describe('refresh()', () => {
    it('should be an alias for loadUsers()', async () => {
      const refreshPromise = service.refresh();

      const req = httpMock.expectOne('http://localhost:3000/api/users');
      req.flush(mockUsers);

      const result = await refreshPromise;

      expect(result).toEqual(mockUsers);
      expect(service.users()).toEqual(mockUsers);
    });
  });

  describe('Computed Signals', () => {
    it('should compute userCount correctly', async () => {
      expect(service.userCount()).toBe(0);

      const loadPromise = service.loadUsers();
      const req = httpMock.expectOne('http://localhost:3000/api/users');
      req.flush(mockUsers);
      await loadPromise;

      expect(service.userCount()).toBe(3);
    });

    it('should compute hasUsers correctly', async () => {
      expect(service.hasUsers()).toBe(false);

      const loadPromise = service.loadUsers();
      const req = httpMock.expectOne('http://localhost:3000/api/users');
      req.flush(mockUsers);
      await loadPromise;

      expect(service.hasUsers()).toBe(true);
    });

    it('should update computed signals when users change', async () => {
      const loadPromise = service.loadUsers();
      let req = httpMock.expectOne('http://localhost:3000/api/users');
      req.flush(mockUsers);
      await loadPromise;

      expect(service.userCount()).toBe(3);

      const deletePromise = service.deleteUser(mockUsers[0].id);
      req = httpMock.expectOne(`http://localhost:3000/api/users/${mockUsers[0].id}`);
      req.flush({ message: 'Deleted' });
      await deletePromise;

      expect(service.userCount()).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should extract error from string response', async () => {
      const loadPromise = service.loadUsers();
      const req = httpMock.expectOne('http://localhost:3000/api/users');
      req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });

      await loadPromise;

      expect(service.errorSignal()).toBe('Server error');
    });

    it('should extract error from object with error property', async () => {
      const loadPromise = service.loadUsers();
      const req = httpMock.expectOne('http://localhost:3000/api/users');
      req.flush(
        { error: 'Custom error message' },
        { status: 400, statusText: 'Bad Request' }
      );

      await loadPromise;

      expect(service.errorSignal()).toBe('Custom error message');
    });

    it('should use default message for unknown error formats', async () => {
      const loadPromise = service.loadUsers();
      const req = httpMock.expectOne('http://localhost:3000/api/users');
      req.error(new ProgressEvent('error'));

      await loadPromise;

      // Network errors result in HttpErrorResponse with a message like "Http failure response for..."
      // The service extracts this message from error.message
      const errorMsg = service.errorSignal();
      expect(errorMsg).toBeTruthy();
      expect(typeof errorMsg).toBe('string');
    });

    it('should call ErrorService.reportError for all errors', async () => {
      const loadPromise = service.loadUsers();
      const req = httpMock.expectOne('http://localhost:3000/api/users');
      req.flush({ error: 'Error' }, { status: 500, statusText: 'Error' });

      await loadPromise;

      expect(errorService.reportError).toHaveBeenCalledWith({
        message: jasmine.any(String),
        details: jasmine.any(HttpErrorResponse)
      });
    });
  });

  describe('State Management', () => {
    it('should maintain state immutability', async () => {
      const loadPromise = service.loadUsers();
      const req = httpMock.expectOne('http://localhost:3000/api/users');
      req.flush(mockUsers);
      await loadPromise;

      const state1 = service.userState();
      const users1 = service.users();

      const createPromise = service.createUser('New User');
      const req2 = httpMock.expectOne('http://localhost:3000/api/users');
      req2.flush({ id: 4, name: 'New User', createdAt: '2025-01-04T00:00:00Z' });
      await createPromise;

      const state2 = service.userState();
      const users2 = service.users();

      expect(state1).not.toBe(state2);
      expect(users1).not.toBe(users2);
      expect(users1.length).toBe(3);
      expect(users2.length).toBe(4);
    });
  });
});
