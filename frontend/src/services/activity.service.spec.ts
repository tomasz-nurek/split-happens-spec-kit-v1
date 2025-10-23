import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { ActivityService, ActivityEntry } from './activity.service';
import { ApiService } from './api.service';
import { ErrorService } from './error.service';

describe('ActivityService', () => {
  let service: ActivityService;
  let httpMock: HttpTestingController;
  let errorService: jasmine.SpyObj<ErrorService>;

  const mockActivities: ActivityEntry[] = [
    {
      id: 1,
      type: 'expense_created',
      description: 'Created expense: Dinner',
      userId: 1,
      userName: 'Alice',
      groupId: 1,
      groupName: 'Trip',
      expenseId: 10,
      expenseDescription: 'Dinner',
      amount: 50.0,
      timestamp: '2023-01-01T10:00:00Z',
      metadata: {}
    },
    {
      id: 2,
      type: 'user_created',
      description: 'Created user: Bob',
      userId: 2,
      userName: 'Bob',
      timestamp: '2023-01-01T09:00:00Z',
      metadata: {}
    }
  ];

  beforeEach(async () => {
    const errorServiceSpy = jasmine.createSpyObj('ErrorService', ['reportError', 'clearError']);

    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        ActivityService,
        ApiService,
        { provide: ErrorService, useValue: errorServiceSpy }
      ]
    }).compileComponents();

    service = TestBed.inject(ActivityService);
    httpMock = TestBed.inject(HttpTestingController);
    errorService = TestBed.inject(ErrorService) as jasmine.SpyObj<ErrorService>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('Initial State', () => {
    it('should start with idle status', () => {
      expect(service.isIdle()).toBe(true);
      expect(service.isLoading()).toBe(false);
      expect(service.isSuccess()).toBe(false);
      expect(service.isError()).toBe(false);
    });

    it('should start with empty activities', () => {
      expect(service.activities()).toEqual([]);
      expect(service.activityCount()).toBe(0);
      expect(service.hasActivities()).toBe(false);
    });

    it('should have no error initially', () => {
      expect(service.errorSignal()).toBeNull();
    });

    it('should have hasMore set to true initially', () => {
      expect(service.hasMore()).toBe(true);
    });

    it('should have no cached groups/users/expenses initially', () => {
      expect(service.cachedGroupIds()).toEqual([]);
      expect(service.cachedUserIds()).toEqual([]);
      expect(service.cachedExpenseIds()).toEqual([]);
    });
  });

  describe('loadActivities()', () => {
    it('should load activities successfully', async () => {
      const loadPromise = service.loadActivities();

      const req = httpMock.expectOne('http://localhost:3000/api/activity');
      expect(req.request.method).toBe('GET');
      req.flush({ activities: mockActivities });

      const result = await loadPromise;

      expect(result).toHaveSize(2);
      expect(result[0].type).toBe('expense_created');
      expect(service.activityCount()).toBe(2);
      expect(service.hasActivities()).toBe(true);
      expect(service.isSuccess()).toBe(true);
      expect(errorService.clearError).toHaveBeenCalled();
    });

    it('should update status signals correctly', async () => {
      const loadPromise = service.loadActivities();

      // During load
      expect(service.isLoading()).toBe(true);

      const req = httpMock.expectOne('http://localhost:3000/api/activity');
      req.flush({ activities: mockActivities });

      await loadPromise;

      // After load
      expect(service.isLoading()).toBe(false);
      expect(service.isSuccess()).toBe(true);
    });

    it('should handle pagination parameters', async () => {
      const loadPromise = service.loadActivities({ limit: 10, offset: 5 });

      const req = httpMock.expectOne('http://localhost:3000/api/activity?limit=10&offset=5');
      expect(req.request.method).toBe('GET');
      req.flush({ activities: mockActivities });

      const result = await loadPromise;
      expect(result).toHaveSize(2);
    });

    it('should handle limit parameter only', async () => {
      const loadPromise = service.loadActivities({ limit: 20 });

      const req = httpMock.expectOne('http://localhost:3000/api/activity?limit=20');
      req.flush({ activities: mockActivities });

      const result = await loadPromise;
      expect(result).toHaveSize(2);
      expect(service.activityCount()).toBe(2);
    });

    it('should handle offset parameter only', async () => {
      const loadPromise = service.loadActivities({ offset: 10 });

      const req = httpMock.expectOne('http://localhost:3000/api/activity?offset=10');
      req.flush({ activities: mockActivities });

      const result = await loadPromise;
      expect(result).toHaveSize(2);
      expect(service.activityCount()).toBe(2);
    });

    it('should append activities when offset > 0', async () => {
      // First load
      let loadPromise = service.loadActivities();
      let req = httpMock.expectOne('http://localhost:3000/api/activity');
      req.flush({ activities: [mockActivities[0]] });
      await loadPromise;

      expect(service.activityCount()).toBe(1);

      // Second load with offset (appending)
      loadPromise = service.loadActivities({ offset: 1 });
      req = httpMock.expectOne('http://localhost:3000/api/activity?offset=1');
      req.flush({ activities: [mockActivities[1]] });
      await loadPromise;

      // Should have both activities
      expect(service.activityCount()).toBe(2);
      expect(service.activities()[0].id).toBe(1);
      expect(service.activities()[1].id).toBe(2);
    });

    it('should replace activities when offset is 0', async () => {
      // First load
      let loadPromise = service.loadActivities();
      let req = httpMock.expectOne('http://localhost:3000/api/activity');
      req.flush({ activities: mockActivities });
      await loadPromise;

      expect(service.activityCount()).toBe(2);

      // Second load without offset (replacing)
      loadPromise = service.loadActivities();
      req = httpMock.expectOne('http://localhost:3000/api/activity');
      req.flush({ activities: [mockActivities[0]] });
      await loadPromise;

      // Should only have one activity
      expect(service.activityCount()).toBe(1);
      expect(service.activities()[0].id).toBe(1);
    });

    it('should update hasMore based on limit', async () => {
      const loadPromise = service.loadActivities({ limit: 2 });
      const req = httpMock.expectOne('http://localhost:3000/api/activity?limit=2');
      req.flush({ activities: mockActivities }); // Exactly 2 activities
      await loadPromise;

      // If returned count >= limit, hasMore should be true
      expect(service.hasMore()).toBe(true);
    });

    it('should set hasMore to false when fewer activities than limit', async () => {
      const loadPromise = service.loadActivities({ limit: 10 });
      const req = httpMock.expectOne('http://localhost:3000/api/activity?limit=10');
      req.flush({ activities: mockActivities }); // Only 2 activities
      await loadPromise;

      // If returned count < limit, hasMore should be false
      expect(service.hasMore()).toBe(false);
    });

    it('should handle HTTP errors gracefully', async () => {
      const loadPromise = service.loadActivities();

      const req = httpMock.expectOne('http://localhost:3000/api/activity');
      req.flush({ error: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });

      const result = await loadPromise;

      expect(result).toEqual([]);
      expect(service.isError()).toBe(true);
      expect(service.errorSignal()).toBe('Unable to load activities. Please try again.');
      expect(errorService.reportError).toHaveBeenCalled();
    });

    it('should deduplicate concurrent loadActivities calls', async () => {
      const loadPromise1 = service.loadActivities();
      const loadPromise2 = service.loadActivities();

      // Should only make ONE HTTP request
      const requests = httpMock.match('http://localhost:3000/api/activity');
      expect(requests.length).toBe(1);

      requests[0].flush({ activities: mockActivities });

      // Both promises should resolve to the same data
      const [result1, result2] = await Promise.all([loadPromise1, loadPromise2]);
      expect(result1).toEqual(result2);
    });

    it('should allow new request after previous completes', async () => {
      // First load
      let loadPromise = service.loadActivities();
      let req = httpMock.expectOne('http://localhost:3000/api/activity');
      req.flush({ activities: mockActivities });
      await loadPromise;

      // Second load should create new request
      loadPromise = service.loadActivities();
      req = httpMock.expectOne('http://localhost:3000/api/activity');
      req.flush({ activities: mockActivities });
      await loadPromise;

      expect(service.activityCount()).toBe(2);
    });

    it('should update lastLoadedAt on successful load', async () => {
      const beforeLoad = new Date();

      const loadPromise = service.loadActivities();
      const req = httpMock.expectOne('http://localhost:3000/api/activity');
      req.flush({ activities: mockActivities });
      await loadPromise;

      const lastLoaded = service.lastLoadedAt();
      expect(lastLoaded).toBeTruthy();
      expect(new Date(lastLoaded!).getTime()).toBeGreaterThanOrEqual(beforeLoad.getTime());
    });
  });

  describe('loadMore()', () => {
    it('should load more activities with correct offset', async () => {
      // First load
      let loadPromise = service.loadActivities();
      let req = httpMock.expectOne('http://localhost:3000/api/activity');
      req.flush({ activities: [mockActivities[0]] });
      await loadPromise;

      expect(service.activityCount()).toBe(1);

      // Load more
      loadPromise = service.loadMore(50);
      req = httpMock.expectOne('http://localhost:3000/api/activity?limit=50&offset=1');
      req.flush({ activities: [mockActivities[1]] });
      await loadPromise;

      expect(service.activityCount()).toBe(2);
    });
  });

  describe('refresh()', () => {
    it('should reload activities from beginning', async () => {
      // First load
      let loadPromise = service.loadActivities();
      let req = httpMock.expectOne('http://localhost:3000/api/activity');
      req.flush({ activities: mockActivities });
      await loadPromise;

      expect(service.activityCount()).toBe(2);

      // Refresh
      loadPromise = service.refresh();
      req = httpMock.expectOne('http://localhost:3000/api/activity');
      req.flush({ activities: [mockActivities[0]] });
      await loadPromise;

      expect(service.activityCount()).toBe(1);
    });

    it('should support pagination in refresh', async () => {
      const refreshPromise = service.refresh({ limit: 10 });
      const req = httpMock.expectOne('http://localhost:3000/api/activity?limit=10');
      req.flush({ activities: mockActivities });
      await refreshPromise;

      expect(service.activityCount()).toBe(2);
    });
  });

  describe('loadGroupActivities()', () => {
    const groupId = 1;

    it('should load group activities successfully', async () => {
      const loadPromise = service.loadGroupActivities(groupId);

      const req = httpMock.expectOne(`http://localhost:3000/api/groups/${groupId}/activity`);
      expect(req.request.method).toBe('GET');
      req.flush({ groupId, groupName: 'Trip', activities: mockActivities });

      const result = await loadPromise;

      expect(result).toHaveSize(2);
      expect(service.cachedGroupIds()).toContain(groupId);
      expect(errorService.clearError).toHaveBeenCalled();
    });

    it('should support pagination parameters', async () => {
      const loadPromise = service.loadGroupActivities(groupId, { limit: 10, offset: 5 });

      const req = httpMock.expectOne(
        `http://localhost:3000/api/groups/${groupId}/activity?limit=10&offset=5`
      );
      req.flush({ groupId, groupName: 'Trip', activities: mockActivities });

      const result = await loadPromise;
      expect(result).toHaveSize(2);
      expect(service.activitiesForGroup(groupId)()).toHaveSize(2);
    });

    it('should reject invalid group ID', async () => {
      const result = await service.loadGroupActivities(0);

      expect(result).toEqual([]);
      expect(service.errorSignal()).toBe('Invalid group ID');
      expect(errorService.reportError).toHaveBeenCalled();

      httpMock.expectNone('http://localhost:3000/api/groups/0/activity');
    });

    it('should update status signals correctly', async () => {
      const loadPromise = service.loadGroupActivities(groupId);

      // During load
      expect(service.isLoadingForGroup(groupId)()).toBe(true);
      expect(service.statusForGroup(groupId)()).toBe('loading');

      const req = httpMock.expectOne(`http://localhost:3000/api/groups/${groupId}/activity`);
      req.flush({ groupId, groupName: 'Trip', activities: mockActivities });

      await loadPromise;

      // After load
      expect(service.isLoadingForGroup(groupId)()).toBe(false);
      expect(service.statusForGroup(groupId)()).toBe('success');
    });

    it('should handle HTTP errors gracefully', async () => {
      const loadPromise = service.loadGroupActivities(groupId);

      const req = httpMock.expectOne(`http://localhost:3000/api/groups/${groupId}/activity`);
      req.flush({ error: 'Group not found' }, { status: 404, statusText: 'Not Found' });

      const result = await loadPromise;

      expect(result).toEqual([]);
      expect(service.statusForGroup(groupId)()).toBe('error');
      expect(service.errorSignal()).toBe('Group not found');
      expect(errorService.reportError).toHaveBeenCalled();
    });

    it('should deduplicate concurrent loadGroupActivities calls', async () => {
      const loadPromise1 = service.loadGroupActivities(groupId);
      const loadPromise2 = service.loadGroupActivities(groupId);

      const requests = httpMock.match(`http://localhost:3000/api/groups/${groupId}/activity`);
      expect(requests.length).toBe(1);

      requests[0].flush({ groupId, groupName: 'Trip', activities: mockActivities });

      const [result1, result2] = await Promise.all([loadPromise1, loadPromise2]);
      expect(result1).toEqual(result2);
    });

    it('should preserve previous data on transient errors', async () => {
      // First load successfully
      let loadPromise = service.loadGroupActivities(groupId);
      let req = httpMock.expectOne(`http://localhost:3000/api/groups/${groupId}/activity`);
      req.flush({ groupId, groupName: 'Trip', activities: mockActivities });
      await loadPromise;

      const initialActivities = service.activitiesForGroup(groupId)();

      // Second load fails
      loadPromise = service.loadGroupActivities(groupId);
      req = httpMock.expectOne(`http://localhost:3000/api/groups/${groupId}/activity`);
      req.flush({ error: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });
      await loadPromise;

      // Should still have previous data
      expect(service.activitiesForGroup(groupId)()).toEqual(initialActivities);
      expect(service.statusForGroup(groupId)()).toBe('success');
    });

    it('should append activities when offset > 0', async () => {
      // First load
      let loadPromise = service.loadGroupActivities(groupId);
      let req = httpMock.expectOne(`http://localhost:3000/api/groups/${groupId}/activity`);
      req.flush({ groupId, groupName: 'Trip', activities: [mockActivities[0]] });
      await loadPromise;

      expect(service.activitiesForGroup(groupId)()).toHaveSize(1);

      // Second load with offset (appending)
      loadPromise = service.loadGroupActivities(groupId, { offset: 1 });
      req = httpMock.expectOne(`http://localhost:3000/api/groups/${groupId}/activity?offset=1`);
      req.flush({ groupId, groupName: 'Trip', activities: [mockActivities[1]] });
      await loadPromise;

      // Should have both activities
      expect(service.activitiesForGroup(groupId)()).toHaveSize(2);
    });
  });

  describe('loadUserActivities()', () => {
    const userId = 1;

    it('should load user activities successfully', async () => {
      const loadPromise = service.loadUserActivities(userId);

      const req = httpMock.expectOne(`http://localhost:3000/api/users/${userId}/activity`);
      expect(req.request.method).toBe('GET');
      req.flush({ userId, userName: 'Alice', activities: mockActivities });

      const result = await loadPromise;

      expect(result).toHaveSize(2);
      expect(service.cachedUserIds()).toContain(userId);
      expect(errorService.clearError).toHaveBeenCalled();
    });

    it('should support pagination parameters', async () => {
      const loadPromise = service.loadUserActivities(userId, { limit: 10, offset: 5 });

      const req = httpMock.expectOne(
        `http://localhost:3000/api/users/${userId}/activity?limit=10&offset=5`
      );
      req.flush({ userId, userName: 'Alice', activities: mockActivities });

      const result = await loadPromise;
      expect(result).toHaveSize(2);
      expect(service.activitiesForUser(userId)()).toHaveSize(2);
    });

    it('should reject invalid user ID', async () => {
      const result = await service.loadUserActivities(-1);

      expect(result).toEqual([]);
      expect(service.errorSignal()).toBe('Invalid user ID');
      expect(errorService.reportError).toHaveBeenCalled();

      httpMock.expectNone('http://localhost:3000/api/users/-1/activity');
    });

    it('should update status signals correctly', async () => {
      const loadPromise = service.loadUserActivities(userId);

      // During load
      expect(service.isLoadingForUser(userId)()).toBe(true);
      expect(service.statusForUser(userId)()).toBe('loading');

      const req = httpMock.expectOne(`http://localhost:3000/api/users/${userId}/activity`);
      req.flush({ userId, userName: 'Alice', activities: mockActivities });

      await loadPromise;

      // After load
      expect(service.isLoadingForUser(userId)()).toBe(false);
      expect(service.statusForUser(userId)()).toBe('success');
    });

    it('should handle HTTP errors gracefully', async () => {
      const loadPromise = service.loadUserActivities(userId);

      const req = httpMock.expectOne(`http://localhost:3000/api/users/${userId}/activity`);
      req.flush({ error: 'User not found' }, { status: 404, statusText: 'Not Found' });

      const result = await loadPromise;

      expect(result).toEqual([]);
      expect(service.statusForUser(userId)()).toBe('error');
      expect(service.errorSignal()).toBe('User not found');
      expect(errorService.reportError).toHaveBeenCalled();
    });

    it('should deduplicate concurrent loadUserActivities calls', async () => {
      const loadPromise1 = service.loadUserActivities(userId);
      const loadPromise2 = service.loadUserActivities(userId);

      const requests = httpMock.match(`http://localhost:3000/api/users/${userId}/activity`);
      expect(requests.length).toBe(1);

      requests[0].flush({ userId, userName: 'Alice', activities: mockActivities });

      const [result1, result2] = await Promise.all([loadPromise1, loadPromise2]);
      expect(result1).toEqual(result2);
    });

    it('should preserve previous data on transient errors', async () => {
      // First load successfully
      let loadPromise = service.loadUserActivities(userId);
      let req = httpMock.expectOne(`http://localhost:3000/api/users/${userId}/activity`);
      req.flush({ userId, userName: 'Alice', activities: mockActivities });
      await loadPromise;

      const initialActivities = service.activitiesForUser(userId)();

      // Second load fails
      loadPromise = service.loadUserActivities(userId);
      req = httpMock.expectOne(`http://localhost:3000/api/users/${userId}/activity`);
      req.flush({ error: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });
      await loadPromise;

      // Should still have previous data
      expect(service.activitiesForUser(userId)()).toEqual(initialActivities);
      expect(service.statusForUser(userId)()).toBe('success');
    });
  });

  describe('loadExpenseActivities()', () => {
    const expenseId = 10;

    it('should load expense activities successfully', async () => {
      const loadPromise = service.loadExpenseActivities(expenseId);

      const req = httpMock.expectOne(`http://localhost:3000/api/expenses/${expenseId}/activity`);
      expect(req.request.method).toBe('GET');
      req.flush({ expenseId, activities: mockActivities });

      const result = await loadPromise;

      expect(result).toHaveSize(2);
      expect(service.cachedExpenseIds()).toContain(expenseId);
      expect(errorService.clearError).toHaveBeenCalled();
    });

    it('should support pagination parameters', async () => {
      const loadPromise = service.loadExpenseActivities(expenseId, { limit: 10, offset: 5 });

      const req = httpMock.expectOne(
        `http://localhost:3000/api/expenses/${expenseId}/activity?limit=10&offset=5`
      );
      req.flush({ expenseId, activities: mockActivities });

      const result = await loadPromise;
      expect(result).toHaveSize(2);
      expect(service.activitiesForExpense(expenseId)()).toHaveSize(2);
    });

    it('should reject invalid expense ID', async () => {
      const result = await service.loadExpenseActivities(0);

      expect(result).toEqual([]);
      expect(service.errorSignal()).toBe('Invalid expense ID');
      expect(errorService.reportError).toHaveBeenCalled();

      httpMock.expectNone('http://localhost:3000/api/expenses/0/activity');
    });

    it('should update status signals correctly', async () => {
      const loadPromise = service.loadExpenseActivities(expenseId);

      // During load
      expect(service.isLoadingForExpense(expenseId)()).toBe(true);
      expect(service.statusForExpense(expenseId)()).toBe('loading');

      const req = httpMock.expectOne(`http://localhost:3000/api/expenses/${expenseId}/activity`);
      req.flush({ expenseId, activities: mockActivities });

      await loadPromise;

      // After load
      expect(service.isLoadingForExpense(expenseId)()).toBe(false);
      expect(service.statusForExpense(expenseId)()).toBe('success');
    });

    it('should handle HTTP errors gracefully', async () => {
      const loadPromise = service.loadExpenseActivities(expenseId);

      const req = httpMock.expectOne(`http://localhost:3000/api/expenses/${expenseId}/activity`);
      req.flush({ error: 'Expense not found' }, { status: 404, statusText: 'Not Found' });

      const result = await loadPromise;

      expect(result).toEqual([]);
      expect(service.statusForExpense(expenseId)()).toBe('error');
      expect(service.errorSignal()).toBe('Expense not found');
      expect(errorService.reportError).toHaveBeenCalled();
    });

    it('should deduplicate concurrent loadExpenseActivities calls', async () => {
      const loadPromise1 = service.loadExpenseActivities(expenseId);
      const loadPromise2 = service.loadExpenseActivities(expenseId);

      const requests = httpMock.match(`http://localhost:3000/api/expenses/${expenseId}/activity`);
      expect(requests.length).toBe(1);

      requests[0].flush({ expenseId, activities: mockActivities });

      const [result1, result2] = await Promise.all([loadPromise1, loadPromise2]);
      expect(result1).toEqual(result2);
    });

    it('should preserve previous data on transient errors', async () => {
      // First load successfully
      let loadPromise = service.loadExpenseActivities(expenseId);
      let req = httpMock.expectOne(`http://localhost:3000/api/expenses/${expenseId}/activity`);
      req.flush({ expenseId, activities: mockActivities });
      await loadPromise;

      const initialActivities = service.activitiesForExpense(expenseId)();

      // Second load fails
      loadPromise = service.loadExpenseActivities(expenseId);
      req = httpMock.expectOne(`http://localhost:3000/api/expenses/${expenseId}/activity`);
      req.flush({ error: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });
      await loadPromise;

      // Should still have previous data
      expect(service.activitiesForExpense(expenseId)()).toEqual(initialActivities);
      expect(service.statusForExpense(expenseId)()).toBe('success');
    });
  });

  describe('Computed Signals', () => {
    beforeEach(async () => {
      const loadPromise = service.loadActivities();
      const req = httpMock.expectOne('http://localhost:3000/api/activity');
      req.flush({ activities: mockActivities });
      await loadPromise;
    });

    it('should provide activitiesByType signal', () => {
      const expenseActivities = service.activitiesByType('expense_created')();
      expect(expenseActivities).toHaveSize(1);
      expect(expenseActivities[0].type).toBe('expense_created');
    });

    it('should provide activitiesSorted signal', () => {
      const sorted = service.activitiesSorted();
      // Should be sorted newest first
      expect(sorted[0].timestamp).toBe('2023-01-01T10:00:00Z');
      expect(sorted[1].timestamp).toBe('2023-01-01T09:00:00Z');
    });
  });

  describe('Scoped Signal Accessors', () => {
    it('should return empty array for non-existent group', () => {
      expect(service.activitiesForGroup(999)()).toEqual([]);
    });

    it('should return idle status for non-existent group', () => {
      expect(service.statusForGroup(999)()).toBe('idle');
    });

    it('should return false for isLoadingForGroup on non-existent group', () => {
      expect(service.isLoadingForGroup(999)()).toBe(false);
    });

    it('should return true for hasMoreForGroup on non-existent group', () => {
      expect(service.hasMoreForGroup(999)()).toBe(true);
    });

    it('should return empty array for non-existent user', () => {
      expect(service.activitiesForUser(999)()).toEqual([]);
    });

    it('should return idle status for non-existent user', () => {
      expect(service.statusForUser(999)()).toBe('idle');
    });

    it('should return false for isLoadingForUser on non-existent user', () => {
      expect(service.isLoadingForUser(999)()).toBe(false);
    });

    it('should return true for hasMoreForUser on non-existent user', () => {
      expect(service.hasMoreForUser(999)()).toBe(true);
    });

    it('should return empty array for non-existent expense', () => {
      expect(service.activitiesForExpense(999)()).toEqual([]);
    });

    it('should return idle status for non-existent expense', () => {
      expect(service.statusForExpense(999)()).toBe('idle');
    });

    it('should return false for isLoadingForExpense on non-existent expense', () => {
      expect(service.isLoadingForExpense(999)()).toBe(false);
    });

    it('should return true for hasMoreForExpense on non-existent expense', () => {
      expect(service.hasMoreForExpense(999)()).toBe(true);
    });
  });

  describe('clearError()', () => {
    it('should clear error state', async () => {
      // Trigger an error
      const loadPromise = service.loadActivities();
      const req = httpMock.expectOne('http://localhost:3000/api/activity');
      req.flush({ error: 'Error' }, { status: 500, statusText: 'Error' });
      await loadPromise;

      expect(service.errorSignal()).toBeTruthy();

      // Clear error
      service.clearError();

      expect(service.errorSignal()).toBeNull();
    });
  });

  describe('Error Message Extraction', () => {
    it('should extract error from string response', async () => {
      const loadPromise = service.loadActivities();
      const req = httpMock.expectOne('http://localhost:3000/api/activity');
      req.flush('Custom error message', { status: 400, statusText: 'Bad Request' });
      await loadPromise;

      expect(service.errorSignal()).toBe('Custom error message');
    });

    it('should extract error from error field in object', async () => {
      const loadPromise = service.loadActivities();
      const req = httpMock.expectOne('http://localhost:3000/api/activity');
      req.flush({ error: 'Validation failed' }, { status: 400, statusText: 'Bad Request' });
      await loadPromise;

      expect(service.errorSignal()).toBe('Validation failed');
    });

    it('should not expose 5xx errors', async () => {
      const loadPromise = service.loadActivities();
      const req = httpMock.expectOne('http://localhost:3000/api/activity');
      req.flush(
        { error: 'Internal details' },
        { status: 500, statusText: 'Internal Server Error' }
      );
      await loadPromise;

      // Should use default message, not expose internal error
      expect(service.errorSignal()).toBe('Unable to load activities. Please try again.');
    });

    it('should handle network errors', async () => {
      const loadPromise = service.loadActivities();
      const req = httpMock.expectOne('http://localhost:3000/api/activity');
      req.error(new ProgressEvent('Network error'));
      await loadPromise;

      expect(service.errorSignal()).toBeTruthy();
      expect(errorService.reportError).toHaveBeenCalled();
    });
  });

  describe('Multiple Scoped Caches', () => {
    it('should cache multiple groups independently', async () => {
      // Load activities for group 1
      let loadPromise = service.loadGroupActivities(1);
      let req = httpMock.expectOne('http://localhost:3000/api/groups/1/activity');
      req.flush({ groupId: 1, groupName: 'Trip', activities: [mockActivities[0]] });
      await loadPromise;

      // Load activities for group 2
      loadPromise = service.loadGroupActivities(2);
      req = httpMock.expectOne('http://localhost:3000/api/groups/2/activity');
      req.flush({ groupId: 2, groupName: 'Party', activities: [mockActivities[1]] });
      await loadPromise;

      expect(service.cachedGroupIds()).toEqual([1, 2]);
      expect(service.activitiesForGroup(1)()).toHaveSize(1);
      expect(service.activitiesForGroup(2)()).toHaveSize(1);
    });

    it('should cache multiple users independently', async () => {
      // Load activities for user 1
      let loadPromise = service.loadUserActivities(1);
      let req = httpMock.expectOne('http://localhost:3000/api/users/1/activity');
      req.flush({ userId: 1, userName: 'Alice', activities: [mockActivities[0]] });
      await loadPromise;

      // Load activities for user 2
      loadPromise = service.loadUserActivities(2);
      req = httpMock.expectOne('http://localhost:3000/api/users/2/activity');
      req.flush({ userId: 2, userName: 'Bob', activities: [mockActivities[1]] });
      await loadPromise;

      expect(service.cachedUserIds()).toEqual([1, 2]);
      expect(service.activitiesForUser(1)()).toHaveSize(1);
      expect(service.activitiesForUser(2)()).toHaveSize(1);
    });

    it('should cache multiple expenses independently', async () => {
      // Load activities for expense 10
      let loadPromise = service.loadExpenseActivities(10);
      let req = httpMock.expectOne('http://localhost:3000/api/expenses/10/activity');
      req.flush({ expenseId: 10, activities: [mockActivities[0]] });
      await loadPromise;

      // Load activities for expense 20
      loadPromise = service.loadExpenseActivities(20);
      req = httpMock.expectOne('http://localhost:3000/api/expenses/20/activity');
      req.flush({ expenseId: 20, activities: [mockActivities[1]] });
      await loadPromise;

      expect(service.cachedExpenseIds()).toEqual([10, 20]);
      expect(service.activitiesForExpense(10)()).toHaveSize(1);
      expect(service.activitiesForExpense(20)()).toHaveSize(1);
    });
  });
});
