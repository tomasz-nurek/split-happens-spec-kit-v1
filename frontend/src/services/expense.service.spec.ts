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
});
