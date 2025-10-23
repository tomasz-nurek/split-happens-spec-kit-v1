import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';

import {
  ExpenseService,
  CreateExpensePayload,
  UpdateExpensePayload
} from './expense.service';
import { ApiService } from './api.service';
import { ErrorService } from './error.service';
import { Expense } from '../types/api';

describe('ExpenseService', () => {
  let service: ExpenseService;
  let httpMock: HttpTestingController;
  let errorService: jasmine.SpyObj<ErrorService>;

  const baseUrl = 'http://localhost:3000/api';
  const groupId = 1;

  const mockExpenses: Expense[] = [
    {
      id: 101,
      groupId,
      description: 'Dinner',
      amount: 45,
      paidBy: 1,
      paidByName: 'Alice',
      createdAt: '2025-01-01T12:00:00Z',
      splits: [
        { userId: 1, amount: 22.5, percentage: 50 },
        { userId: 2, amount: 22.5, percentage: 50 }
      ],
      participantIds: [1, 2]
    },
    {
      id: 102,
      groupId,
      description: 'Groceries',
      amount: 30,
      paidBy: 2,
      paidByName: 'Bob',
      createdAt: '2025-01-02T12:00:00Z',
      splits: [
        { userId: 1, amount: 15, percentage: 50 },
        { userId: 2, amount: 15, percentage: 50 }
      ],
      participantIds: [1, 2]
    }
  ];

  const mockExpensesGroupTwo: Expense[] = [
    {
      id: 201,
      groupId: 2,
      description: 'Museum Tickets',
      amount: 60,
      paidBy: 3,
      paidByName: 'Charlie',
      createdAt: '2025-01-03T12:00:00Z',
      splits: [
        { userId: 3, amount: 30, percentage: 50 },
        { userId: 4, amount: 30, percentage: 50 }
      ],
      participantIds: [3, 4]
    }
  ];

  beforeEach(async () => {
    const errorSpy = jasmine.createSpyObj('ErrorService', ['reportError', 'clearError']);

    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        ExpenseService,
        ApiService,
        { provide: ErrorService, useValue: errorSpy }
      ]
    }).compileComponents();

    service = TestBed.inject(ExpenseService);
    httpMock = TestBed.inject(HttpTestingController);
    errorService = TestBed.inject(ErrorService) as jasmine.SpyObj<ErrorService>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('Initial State', () => {
    it('should start with empty group collections and default signals', () => {
      const expensesSignal = service.expensesForGroup(groupId);
      const statusSignal = service.statusForGroup(groupId);
      const hasExpensesSignal = service.hasExpensesForGroup(groupId);
      const totalAmountSignal = service.totalAmountForGroup(groupId);
      const lastLoadedSignal = service.lastLoadedAtForGroup(groupId);
      const countSignal = service.expenseCountForGroup(groupId);

      expect(expensesSignal()).toEqual([]);
      expect(statusSignal()).toBe('idle');
      expect(hasExpensesSignal()).toBe(false);
      expect(totalAmountSignal()).toBe(0);
      expect(lastLoadedSignal()).toBeNull();
      expect(countSignal()).toBe(0);
      expect(service.errorSignal()).toBeNull();
      expect(service.groupIds()).toEqual([]);
      expect(service.allExpenses()).toEqual([]);
    });
  });

  describe('loadExpenses()', () => {
    it('should load expenses successfully and update state', async () => {
      const expensesSignal = service.expensesForGroup(groupId);
      const statusSignal = service.statusForGroup(groupId);
      const loadingSignal = service.isLoadingForGroup(groupId);
      const successSignal = service.isSuccessForGroup(groupId);

      const loadPromise = service.loadExpenses(groupId);

      expect(loadingSignal()).toBeTrue();
      expect(statusSignal()).toBe('loading');

      const req = httpMock.expectOne(`${baseUrl}/groups/${groupId}/expenses`);
      expect(req.request.method).toBe('GET');
      req.flush(mockExpenses);

      const result = await loadPromise;

      expect(result).toEqual(mockExpenses);
      expect(expensesSignal()).toEqual(mockExpenses);
      expect(successSignal()).toBeTrue();
      expect(service.hasExpensesForGroup(groupId)()).toBeTrue();
      expect(service.totalAmountForGroup(groupId)()).toBe(75);
      expect(service.expenseCountForGroup(groupId)()).toBe(2);
      expect(service.lastLoadedAtForGroup(groupId)()).toBeTruthy();
      expect(service.groupIds()).toEqual([groupId]);
      expect(service.allExpenses()).toEqual(mockExpenses);
      expect(errorService.clearError).toHaveBeenCalled();
    });

    it('should deduplicate concurrent load requests', async () => {
      const promise1 = service.loadExpenses(groupId);
      const promise2 = service.loadExpenses(groupId);
      const promise3 = service.loadExpenses(groupId);

      const requests = httpMock.match(`${baseUrl}/groups/${groupId}/expenses`);
      expect(requests.length).toBe(1);

      requests[0].flush(mockExpenses);

      const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);

      expect(result1).toEqual(mockExpenses);
      expect(result2).toEqual(mockExpenses);
      expect(result3).toEqual(mockExpenses);
      expect(result1).toBe(result2);
    });

    it('should handle HTTP errors gracefully and preserve previous data', async () => {
      const loadPromise = service.loadExpenses(groupId);

      const req = httpMock.expectOne(`${baseUrl}/groups/${groupId}/expenses`);
      req.flush({ error: 'Group not found' }, { status: 404, statusText: 'Not Found' });

      const result = await loadPromise;

      expect(result).toEqual([]);
      expect(service.expensesForGroup(groupId)()).toEqual([]);
      expect(service.isErrorForGroup(groupId)()).toBeTrue();
      expect(service.errorSignal()).toBe('Group not found');
      expect(errorService.reportError).toHaveBeenCalled();
    });

    it('should surface generic message on network error', async () => {
      const loadPromise = service.loadExpenses(groupId);

      const req = httpMock.expectOne(`${baseUrl}/groups/${groupId}/expenses`);
      req.error(new ProgressEvent('Network error'));

      const result = await loadPromise;

      expect(result).toEqual([]);
      expect(service.errorSignal()).toBe('Unable to load expenses. Please try again.');
      expect(service.isErrorForGroup(groupId)()).toBeTrue();
    });

    it('should retain successful data when a subsequent refresh fails', async () => {
      const initialLoad = service.loadExpenses(groupId);
      let req = httpMock.expectOne(`${baseUrl}/groups/${groupId}/expenses`);
      req.flush(mockExpenses);
      await initialLoad;

      errorService.clearError.calls.reset();

      const loadPromise = service.loadExpenses(groupId);
      req = httpMock.expectOne(`${baseUrl}/groups/${groupId}/expenses`);
      req.flush({ error: 'Timeout' }, { status: 503, statusText: 'Service Unavailable' });
      await loadPromise;

      expect(service.expensesForGroup(groupId)()).toEqual(mockExpenses);
      expect(service.isSuccessForGroup(groupId)()).toBeTrue();
      expect(service.errorSignal()).toBe('Timeout');
      expect(errorService.reportError).toHaveBeenCalled();
    });

    it('should reject invalid group IDs', async () => {
      const result = await service.loadExpenses(0);

      expect(result).toEqual([]);
      expect(service.errorSignal()).toBe('Invalid group ID');
      expect(errorService.reportError).toHaveBeenCalled();

      httpMock.expectNone(`${baseUrl}/groups/0/expenses`);
    });

    it('should aggregate group IDs and all expenses across groups', async () => {
      let load = service.loadExpenses(groupId);
      let req = httpMock.expectOne(`${baseUrl}/groups/${groupId}/expenses`);
      req.flush(mockExpenses);
      await load;

      load = service.loadExpenses(2);
      req = httpMock.expectOne(`${baseUrl}/groups/2/expenses`);
      req.flush(mockExpensesGroupTwo);
      await load;

      expect(service.groupIds()).toEqual([1, 2]);
      expect(service.allExpenses()).toEqual([...mockExpenses, ...mockExpensesGroupTwo]);
    });
  });

  describe('createExpense()', () => {
    beforeEach(async () => {
      const loadPromise = service.loadExpenses(groupId);
      const req = httpMock.expectOne(`${baseUrl}/groups/${groupId}/expenses`);
      req.flush(mockExpenses);
      await loadPromise;
      errorService.clearError.calls.reset();
    });

    it('should create a new expense and prepend it to the list', async () => {
      const payload: CreateExpensePayload = {
        amount: 55.5,
        description: '  Airport Transfer ',
        paidBy: 1,
        participantIds: [1, 2]
      };

      const promise = service.createExpense(groupId, payload);

      const req = httpMock.expectOne(`${baseUrl}/groups/${groupId}/expenses`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        amount: 55.5,
        description: 'Airport Transfer',
        paidBy: 1,
        participantIds: [1, 2]
      });

      const newExpense: Expense = {
        id: 103,
        groupId,
        description: 'Airport Transfer',
        amount: 55.5,
        paidBy: 1,
        paidByName: 'Alice',
        createdAt: '2025-01-04T12:00:00Z'
      };
      req.flush(newExpense);

      const result = await promise;

      expect(result).toEqual(newExpense);
      expect(service.expensesForGroup(groupId)()[0]).toEqual(newExpense);
      expect(service.expenseCountForGroup(groupId)()).toBe(3);
      expect(service.totalAmountForGroup(groupId)()).toBeCloseTo(130.5, 5);
      expect(service.isSuccessForGroup(groupId)()).toBeTrue();
      expect(service.lastLoadedAtForGroup(groupId)()).toBeTruthy();
      expect(errorService.clearError).toHaveBeenCalled();
    });

    it('should reject create requests with invalid payload', async () => {
      const payload: CreateExpensePayload = {
        amount: 10,
        description: 'Snacks',
        paidBy: 1,
        participantIds: []
      };

      const result = await service.createExpense(groupId, payload);

      expect(result).toBeNull();
      expect(service.errorSignal()).toBe('At least one participant is required');
      expect(errorService.reportError).toHaveBeenCalled();
      httpMock.expectNone(`${baseUrl}/groups/${groupId}/expenses`);
    });

    it('should handle API errors during creation', async () => {
      const payload: CreateExpensePayload = {
        amount: 15,
        description: 'Coffee',
        paidBy: 1,
        participantIds: [1, 2]
      };

      const promise = service.createExpense(groupId, payload);

      const req = httpMock.expectOne(`${baseUrl}/groups/${groupId}/expenses`);
      req.flush({ error: 'Validation failed' }, { status: 400, statusText: 'Bad Request' });

      const result = await promise;

      expect(result).toBeNull();
      expect(service.expenseCountForGroup(groupId)()).toBe(2);
      expect(service.totalAmountForGroup(groupId)()).toBe(75);
      expect(service.isSuccessForGroup(groupId)()).toBeTrue();
      expect(service.errorSignal()).toBe('Validation failed');
      expect(errorService.reportError).toHaveBeenCalled();
    });

    it('should reject invalid group ID without making a request', async () => {
      const payload: CreateExpensePayload = {
        amount: 20,
        description: 'Snacks',
        paidBy: 1,
        participantIds: [1]
      };

      const result = await service.createExpense(0, payload);

      expect(result).toBeNull();
      expect(service.errorSignal()).toBe('Invalid group ID');
      expect(errorService.reportError).toHaveBeenCalled();
      httpMock.expectNone(`${baseUrl}/groups/0/expenses`);
    });
  });

  describe('updateExpense()', () => {
    beforeEach(async () => {
      const loadPromise = service.loadExpenses(groupId);
      const req = httpMock.expectOne(`${baseUrl}/groups/${groupId}/expenses`);
      req.flush(mockExpenses);
      await loadPromise;
      errorService.clearError.calls.reset();
    });

    it('should update an expense and sync state', async () => {
      const payload: UpdateExpensePayload = {
        amount: 50,
        description: 'Updated Dinner'
      };

      const promise = service.updateExpense(101, groupId, payload);

      const req = httpMock.expectOne(`${baseUrl}/expenses/101`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ amount: 50, description: 'Updated Dinner' });

      const updatedExpense: Expense = {
        ...mockExpenses[0],
        amount: 50,
        description: 'Updated Dinner'
      };
      req.flush(updatedExpense);

      const result = await promise;

      expect(result).toEqual(updatedExpense);
      expect(service.findExpenseById(101, groupId)).toEqual(updatedExpense);
      expect(service.totalAmountForGroup(groupId)()).toBe(80);
      expect(service.isSuccessForGroup(groupId)()).toBeTrue();
      expect(errorService.clearError).toHaveBeenCalled();
    });

    it('should reject updates with no changes provided', async () => {
      const result = await service.updateExpense(101, groupId, {});

      expect(result).toBeNull();
      expect(service.errorSignal()).toBe('No updates provided');
      expect(errorService.reportError).toHaveBeenCalled();
      httpMock.expectNone(`${baseUrl}/expenses/101`);
    });

    it('should reject updates with invalid amount', async () => {
      const result = await service.updateExpense(101, groupId, { amount: 0 });

      expect(result).toBeNull();
      expect(service.errorSignal()).toBe('Amount must be greater than zero');
      expect(errorService.reportError).toHaveBeenCalled();
      httpMock.expectNone(`${baseUrl}/expenses/101`);
    });

    it('should reject updates with empty description', async () => {
      const result = await service.updateExpense(101, groupId, { description: '   ' });

      expect(result).toBeNull();
      expect(service.errorSignal()).toBe('Description is required');
      expect(errorService.reportError).toHaveBeenCalled();
      httpMock.expectNone(`${baseUrl}/expenses/101`);
    });

    it('should handle update API errors and restore previous state', async () => {
      const payload: UpdateExpensePayload = { description: 'Updated Dinner' };

      const promise = service.updateExpense(101, groupId, payload);

      const req = httpMock.expectOne(`${baseUrl}/expenses/101`);
      req.flush({ error: 'Not allowed' }, { status: 403, statusText: 'Forbidden' });

      const result = await promise;

      expect(result).toBeNull();
      expect(service.findExpenseById(101, groupId)).toEqual(mockExpenses[0]);
      expect(service.errorSignal()).toBe('Not allowed');
      expect(service.isSuccessForGroup(groupId)()).toBeTrue();
      expect(errorService.reportError).toHaveBeenCalled();
    });

    it('should reject invalid identifiers', async () => {
      const byExpense = await service.updateExpense(0, groupId, { description: 'Test' });
      expect(byExpense).toBeNull();
      expect(service.errorSignal()).toBe('Invalid expense ID');

      service.clearError();

      const byGroup = await service.updateExpense(101, -1, { description: 'Test' });
      expect(byGroup).toBeNull();
      expect(service.errorSignal()).toBe('Invalid group ID');

      httpMock.expectNone(`${baseUrl}/expenses/0`);
      httpMock.expectNone(`${baseUrl}/expenses/101`);
    });
  });

  describe('deleteExpense()', () => {
    beforeEach(async () => {
      const loadPromise = service.loadExpenses(groupId);
      const req = httpMock.expectOne(`${baseUrl}/groups/${groupId}/expenses`);
      req.flush(mockExpenses);
      await loadPromise;
      errorService.clearError.calls.reset();
    });

    it('should delete an expense and update local state', async () => {
      const promise = service.deleteExpense(102, groupId);

      const req = httpMock.expectOne(`${baseUrl}/expenses/102`);
      expect(req.request.method).toBe('DELETE');
      req.flush({ message: 'Expense deleted successfully' });

      const result = await promise;

      expect(result).toBeTrue();
      expect(service.expenseCountForGroup(groupId)()).toBe(1);
      expect(service.findExpenseById(102, groupId)).toBeUndefined();
      expect(service.isSuccessForGroup(groupId)()).toBeTrue();
      expect(errorService.clearError).toHaveBeenCalled();
    });

    it('should handle deletion errors and retain existing state', async () => {
      const promise = service.deleteExpense(102, groupId);

      const req = httpMock.expectOne(`${baseUrl}/expenses/102`);
      req.flush({ error: 'In use' }, { status: 409, statusText: 'Conflict' });

      const result = await promise;

      expect(result).toBeFalse();
      expect(service.expenseCountForGroup(groupId)()).toBe(2);
      expect(service.errorSignal()).toBe('In use');
      expect(service.isSuccessForGroup(groupId)()).toBeTrue();
      expect(errorService.reportError).toHaveBeenCalled();
    });

    it('should reject invalid identifiers without making requests', async () => {
      const invalidExpense = await service.deleteExpense(0, groupId);
      expect(invalidExpense).toBeFalse();
      expect(service.errorSignal()).toBe('Invalid expense ID');

      service.clearError();

      const invalidGroup = await service.deleteExpense(101, 0);
      expect(invalidGroup).toBeFalse();
      expect(service.errorSignal()).toBe('Invalid group ID');

      httpMock.expectNone(`${baseUrl}/expenses/0`);
    });
  });

  describe('utility helpers', () => {
    beforeEach(async () => {
      const loadPromise = service.loadExpenses(groupId);
      const req = httpMock.expectOne(`${baseUrl}/groups/${groupId}/expenses`);
      req.flush(mockExpenses);
      await loadPromise;
    });

    it('refresh() should proxy to loadExpenses()', async () => {
      const promise = service.refresh(groupId);
      const req = httpMock.expectOne(`${baseUrl}/groups/${groupId}/expenses`);
      req.flush(mockExpenses);
      const result = await promise;
      expect(result).toEqual(mockExpenses);
    });

    it('findExpenseById() should search by group or across groups', async () => {
      const expense = service.findExpenseById(101, groupId);
      expect(expense).toEqual(mockExpenses[0]);

      const notFound = service.findExpenseById(999, groupId);
      expect(notFound).toBeUndefined();

    // Load second group to verify cross-group lookup
    const loadSecond = service.loadExpenses(2);
    const req = httpMock.expectOne(`${baseUrl}/groups/2/expenses`);
    req.flush(mockExpensesGroupTwo);
    await loadSecond;

      const globalMatch = service.findExpenseById(201);
      expect(globalMatch).toEqual(mockExpensesGroupTwo[0]);
    });

    it('totalAmountForGroup() should recompute when expenses change', async () => {
      const totalSignal = service.totalAmountForGroup(groupId);
      expect(totalSignal()).toBe(75);

      const payload: UpdateExpensePayload = { amount: 80 };
      const promise = service.updateExpense(102, groupId, payload);
      const req = httpMock.expectOne(`${baseUrl}/expenses/102`);
      req.flush({ ...mockExpenses[1], amount: 80 });
      await promise;

      expect(totalSignal()).toBe(125);
    });

    it('clearError() should reset error signal', () => {
      service.clearError();
      expect(service.errorSignal()).toBeNull();
    });

    it('should return undefined for invalid expense lookup requests', () => {
      expect(service.findExpenseById(-1)).toBeUndefined();
    });
  });

  describe('error extraction', () => {
    it('should prefer server provided message for HttpErrorResponse', () => {
      const error = new HttpErrorResponse({
        status: 400,
        statusText: 'Bad Request',
        url: `${baseUrl}/groups/${groupId}/expenses`,
        error: { error: 'Custom message' }
      });

      const result = (service as any).extractErrorMessage(error);
      expect(result).toBe('Custom message');
    });

    it('should fallback to generic string when error shape is unknown', () => {
      const error = new HttpErrorResponse({
        status: 500,
        statusText: 'Internal Error',
        url: `${baseUrl}/groups/${groupId}/expenses`,
        error: { message: 'Oops' }
      });

      const result = (service as any).extractErrorMessage(error);
      expect(result).toBeNull();
    });
  });

  describe('LRU cache and memory management', () => {
    it('should track recently accessed groups', async () => {
      const load1 = service.loadExpenses(1);
      const req1 = httpMock.expectOne(`${baseUrl}/groups/1/expenses`);
      req1.flush(mockExpenses);
      await load1;

      const load2 = service.loadExpenses(2);
      const req2 = httpMock.expectOne(`${baseUrl}/groups/2/expenses`);
      req2.flush(mockExpensesGroupTwo);
      await load2;

      expect(service.groupIds()).toEqual([1, 2]);
    });

    it('should cleanup old groups when MAX_CACHED_GROUPS exceeded', async () => {
      const MAX_CACHED_GROUPS = (service as any).MAX_CACHED_GROUPS;
      
      // Load MAX_CACHED_GROUPS + 5 groups
      for (let i = 1; i <= MAX_CACHED_GROUPS + 5; i++) {
        const mockData: Expense[] = [{
          id: i * 100,
          groupId: i,
          description: `Expense ${i}`,
          amount: 10,
          paidBy: 1,
          paidByName: 'User',
          createdAt: new Date().toISOString()
        }];

        const load = service.loadExpenses(i);
        const req = httpMock.expectOne(`${baseUrl}/groups/${i}/expenses`);
        req.flush(mockData);
        await load;
      }

      // Should only keep MAX_CACHED_GROUPS most recent groups
      const currentGroupIds = service.groupIds();
      expect(currentGroupIds.length).toBe(MAX_CACHED_GROUPS);
      
      // First 5 groups should be evicted
      expect(currentGroupIds.includes(1)).toBeFalse();
      expect(currentGroupIds.includes(2)).toBeFalse();
      expect(currentGroupIds.includes(3)).toBeFalse();
      expect(currentGroupIds.includes(4)).toBeFalse();
      expect(currentGroupIds.includes(5)).toBeFalse();
      
      // Recent groups should still be present
      expect(currentGroupIds.includes(MAX_CACHED_GROUPS + 5)).toBeTrue();
      expect(currentGroupIds.includes(MAX_CACHED_GROUPS + 4)).toBeTrue();
    });

    it('should update LRU order when accessing existing groups', async () => {
      const MAX_CACHED_GROUPS = (service as any).MAX_CACHED_GROUPS;

      // Load MAX_CACHED_GROUPS groups
      for (let i = 1; i <= MAX_CACHED_GROUPS; i++) {
        const load = service.loadExpenses(i);
        const req = httpMock.expectOne(`${baseUrl}/groups/${i}/expenses`);
        req.flush([]);
        await load;
      }

      // Re-access group 1 (oldest)
      const reaccess = service.loadExpenses(1);
      const req1 = httpMock.expectOne(`${baseUrl}/groups/1/expenses`);
      req1.flush([]);
      await reaccess;

      // Load one more group (should evict group 2, not group 1)
      const loadNew = service.loadExpenses(MAX_CACHED_GROUPS + 1);
      const reqNew = httpMock.expectOne(`${baseUrl}/groups/${MAX_CACHED_GROUPS + 1}/expenses`);
      reqNew.flush([]);
      await loadNew;

      const currentGroupIds = service.groupIds();
      expect(currentGroupIds.includes(1)).toBeTrue(); // Still present (recently accessed)
      expect(currentGroupIds.includes(2)).toBeFalse(); // Evicted (oldest)
    });

    it('should clean up signal caches when groups are evicted', async () => {
      const MAX_CACHED_GROUPS = (service as any).MAX_CACHED_GROUPS;

      // Load group 1
      const load = service.loadExpenses(1);
      const req = httpMock.expectOne(`${baseUrl}/groups/1/expenses`);
      req.flush(mockExpenses);
      await load;

      // Create signals for group 1
      const expensesSignal = service.expensesForGroup(1);
      const statusSignal = service.statusForGroup(1);
      expect(expensesSignal()).toEqual(mockExpenses);
      expect(statusSignal()).toBe('success');

      // Load enough groups to evict group 1
      for (let i = 2; i <= MAX_CACHED_GROUPS + 1; i++) {
        const loadGroup = service.loadExpenses(i);
        const reqGroup = httpMock.expectOne(`${baseUrl}/groups/${i}/expenses`);
        reqGroup.flush([]);
        await loadGroup;
      }

      // Group 1 should be evicted - signals should return empty/idle state
      expect(service.expensesForGroup(1)()).toEqual([]);
      expect(service.statusForGroup(1)()).toBe('idle');
      expect(service.hasExpensesForGroup(1)()).toBeFalse();
      expect(service.totalAmountForGroup(1)()).toBe(0);
    });

    it('should maintain functionality with fewer groups than cache limit', async () => {
      // Load only 5 groups (well under limit)
      for (let i = 1; i <= 5; i++) {
        const load = service.loadExpenses(i);
        const req = httpMock.expectOne(`${baseUrl}/groups/${i}/expenses`);
        req.flush([]);
        await load;
      }

      // All groups should be present
      expect(service.groupIds()).toEqual([1, 2, 3, 4, 5]);

      // No cleanup should have occurred
      const recentlyAccessed = (service as any).recentlyAccessedGroups;
      expect(recentlyAccessed.length).toBe(5);
    });

    it('should update access order on create, update, and delete operations', async () => {
      // Load initial data
      let load = service.loadExpenses(groupId);
      let req = httpMock.expectOne(`${baseUrl}/groups/${groupId}/expenses`);
      req.flush(mockExpenses);
      await load;

      // Load second group
      load = service.loadExpenses(2);
      req = httpMock.expectOne(`${baseUrl}/groups/2/expenses`);
      req.flush([]);
      await load;

      // Create expense in group 1 (should update access order)
      const payload: CreateExpensePayload = {
        amount: 50,
        description: 'Test',
        paidBy: 1,
        participantIds: [1]
      };
      const create = service.createExpense(groupId, payload);
      req = httpMock.expectOne(`${baseUrl}/groups/${groupId}/expenses`);
      req.flush({ ...mockExpenses[0], id: 999 });
      await create;

      const recentlyAccessed = (service as any).recentlyAccessedGroups;
      // Group 1 should be most recent (at end of array)
      expect(recentlyAccessed[recentlyAccessed.length - 1]).toBe(groupId);
    });

    it('should not interfere with data integrity when cleaning up cache', async () => {
      const MAX_CACHED_GROUPS = (service as any).MAX_CACHED_GROUPS;
      
      // Load group 1 with specific expenses
      let load = service.loadExpenses(1);
      let req = httpMock.expectOne(`${baseUrl}/groups/1/expenses`);
      req.flush(mockExpenses);
      await load;

      // Verify initial data
      expect(service.expensesForGroup(1)()).toEqual(mockExpenses);
      expect(service.totalAmountForGroup(1)()).toBe(75);

      // Load group 2 with different expenses
      load = service.loadExpenses(2);
      req = httpMock.expectOne(`${baseUrl}/groups/2/expenses`);
      req.flush(mockExpensesGroupTwo);
      await load;

      expect(service.expensesForGroup(2)()).toEqual(mockExpensesGroupTwo);
      expect(service.totalAmountForGroup(2)()).toBe(60);

      // Load enough groups to trigger cleanup (should evict group 1)
      for (let i = 3; i <= MAX_CACHED_GROUPS + 1; i++) {
        const mockData: Expense[] = [{
          id: i * 100,
          groupId: i,
          description: `Expense ${i}`,
          amount: 10,
          paidBy: 1,
          paidByName: 'User',
          createdAt: new Date().toISOString()
        }];

        const loadGroup = service.loadExpenses(i);
        const reqGroup = httpMock.expectOne(`${baseUrl}/groups/${i}/expenses`);
        reqGroup.flush(mockData);
        await loadGroup;
      }

      // Group 1 should be evicted
      expect(service.groupIds().includes(1)).toBeFalse();
      expect(service.expensesForGroup(1)()).toEqual([]); // Returns empty, not stale data

      // Group 2 should still be present (more recent)
      expect(service.groupIds().includes(2)).toBeTrue();
      expect(service.expensesForGroup(2)()).toEqual(mockExpensesGroupTwo);
      expect(service.totalAmountForGroup(2)()).toBe(60);

      // Most recent groups should be intact
      const lastGroupId = MAX_CACHED_GROUPS + 1;
      expect(service.groupIds().includes(lastGroupId)).toBeTrue();
      expect(service.expensesForGroup(lastGroupId)().length).toBe(1);
      expect(service.totalAmountForGroup(lastGroupId)()).toBe(10);
    });

    it('should re-load evicted group data when accessed again', async () => {
      const MAX_CACHED_GROUPS = (service as any).MAX_CACHED_GROUPS;

      // Load group 1
      let load = service.loadExpenses(1);
      let req = httpMock.expectOne(`${baseUrl}/groups/1/expenses`);
      req.flush(mockExpenses);
      await load;

      const originalExpenses = service.expensesForGroup(1)();
      expect(originalExpenses).toEqual(mockExpenses);

      // Load enough groups to evict group 1
      for (let i = 2; i <= MAX_CACHED_GROUPS + 1; i++) {
        const loadGroup = service.loadExpenses(i);
        const reqGroup = httpMock.expectOne(`${baseUrl}/groups/${i}/expenses`);
        reqGroup.flush([]);
        await loadGroup;
      }

      // Group 1 should be evicted
      expect(service.groupIds().includes(1)).toBeFalse();

      // Re-access group 1 - should trigger new load
      const reloadPromise = service.loadExpenses(1);
      const reloadReq = httpMock.expectOne(`${baseUrl}/groups/1/expenses`);
      
      // Return updated data
      const updatedExpenses: Expense[] = [
        { ...mockExpenses[0], amount: 100 }
      ];
      reloadReq.flush(updatedExpenses);
      
      const result = await reloadPromise;

      // Should have fresh data, not cached data
      expect(result).toEqual(updatedExpenses);
      expect(service.expensesForGroup(1)()).toEqual(updatedExpenses);
      expect(service.totalAmountForGroup(1)()).toBe(100);
    });

    it('should not lose data during concurrent operations with cache cleanup', async () => {
      const MAX_CACHED_GROUPS = (service as any).MAX_CACHED_GROUPS;

      // Load MAX_CACHED_GROUPS - 1 groups
      for (let i = 1; i < MAX_CACHED_GROUPS; i++) {
        const load = service.loadExpenses(i);
        const req = httpMock.expectOne(`${baseUrl}/groups/${i}/expenses`);
        req.flush([{
          id: i * 100,
          groupId: i,
          description: `Expense ${i}`,
          amount: i * 10,
          paidBy: 1,
          paidByName: 'User',
          createdAt: new Date().toISOString()
        }]);
        await load;
      }

      // Load one more group to be at limit
      const load = service.loadExpenses(MAX_CACHED_GROUPS);
      const req = httpMock.expectOne(`${baseUrl}/groups/${MAX_CACHED_GROUPS}/expenses`);
      req.flush([{
        id: 999,
        groupId: MAX_CACHED_GROUPS,
        description: 'At Limit',
        amount: 50,
        paidBy: 1,
        paidByName: 'User',
        createdAt: new Date().toISOString()
      }]);
      await load;

      // All groups should be present
      expect(service.groupIds().length).toBe(MAX_CACHED_GROUPS);

      // Perform operation on most recent group (should not trigger cleanup)
      const createPayload: CreateExpensePayload = {
        amount: 25,
        description: 'New Expense',
        paidBy: 1,
        participantIds: [1]
      };
      const createPromise = service.createExpense(MAX_CACHED_GROUPS, createPayload);
      const createReq = httpMock.expectOne(`${baseUrl}/groups/${MAX_CACHED_GROUPS}/expenses`);
      createReq.flush({
        id: 1000,
        groupId: MAX_CACHED_GROUPS,
        description: 'New Expense',
        amount: 25,
        paidBy: 1,
        paidByName: 'User',
        createdAt: new Date().toISOString()
      });
      await createPromise;

      // Should still have all groups (no new group added, just operation on existing)
      expect(service.groupIds().length).toBe(MAX_CACHED_GROUPS);
      
      // Data should be updated
      expect(service.expenseCountForGroup(MAX_CACHED_GROUPS)()).toBe(2);
      expect(service.totalAmountForGroup(MAX_CACHED_GROUPS)()).toBe(75); // 50 + 25
    });
  });
});
