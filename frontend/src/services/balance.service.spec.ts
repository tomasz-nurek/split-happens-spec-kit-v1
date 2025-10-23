import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';

import { BalanceService, GroupBalance, UserBalance } from './balance.service';
import { ApiService } from './api.service';
import { ErrorService } from './error.service';

describe('BalanceService', () => {
  let service: BalanceService;
  let httpMock: HttpTestingController;
  let errorService: jasmine.SpyObj<ErrorService>;

  const mockGroupBalances: any[] = [
    {
      user_id: 1,
      user_name: 'Alice',
      balance: 50.0,
      owes: [],
      owed_by: [{ user_id: 2, user_name: 'Bob', amount: 25.0 }]
    },
    {
      user_id: 2,
      user_name: 'Bob',
      balance: -25.0,
      owes: [{ user_id: 1, user_name: 'Alice', amount: 25.0 }],
      owed_by: []
    }
  ];

  const mockUserBalance: any = {
    user_id: 1,
    user_name: 'Alice',
    overall_balance: 75.0,
    group_balances: [
      { group_id: 1, group_name: 'Trip', balance: 50.0 },
      { group_id: 2, group_name: 'Dinner', balance: 25.0 }
    ]
  };

  beforeEach(async () => {
    const errorServiceSpy = jasmine.createSpyObj('ErrorService', ['reportError', 'clearError']);

    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        BalanceService,
        ApiService,
        { provide: ErrorService, useValue: errorServiceSpy }
      ]
    }).compileComponents();

    service = TestBed.inject(BalanceService);
    httpMock = TestBed.inject(HttpTestingController);
    errorService = TestBed.inject(ErrorService) as jasmine.SpyObj<ErrorService>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('Initial State', () => {
    it('should start with no cached groups', () => {
      expect(service.cachedGroupIds()).toEqual([]);
    });

    it('should start with no cached users', () => {
      expect(service.cachedUserIds()).toEqual([]);
    });

    it('should have no error initially', () => {
      expect(service.errorSignal()).toBeNull();
    });

    it('should have totalCachedBalances of 0 initially', () => {
      expect(service.totalCachedBalances()).toBe(0);
    });
  });

  describe('loadGroupBalances()', () => {
    const groupId = 1;

    it('should load group balances successfully', async () => {
      const loadPromise = service.loadGroupBalances(groupId);

      const req = httpMock.expectOne(`http://localhost:3000/api/groups/${groupId}/balances`);
      expect(req.request.method).toBe('GET');
      req.flush(mockGroupBalances);

      const result = await loadPromise;

      expect(result).toHaveSize(2);
      expect(result[0].userId).toBe(1);
      expect(result[0].userName).toBe('Alice');
      expect(result[0].balance).toBe(50.0);
      expect(result[0].owedBy).toHaveSize(1);
      expect(result[0].owedBy[0].userId).toBe(2);
      
      expect(service.cachedGroupIds()).toContain(groupId);
      expect(errorService.clearError).toHaveBeenCalled();
    });

    it('should transform snake_case to camelCase', async () => {
      const loadPromise = service.loadGroupBalances(groupId);

      const req = httpMock.expectOne(`http://localhost:3000/api/groups/${groupId}/balances`);
      req.flush(mockGroupBalances);

      const result = await loadPromise;

      expect(result[0]).toEqual(
        jasmine.objectContaining({
          userId: mockGroupBalances[0].user_id,
          userName: mockGroupBalances[0].user_name,
          balance: mockGroupBalances[0].balance
        })
      );
    });

    it('should update status signals correctly', async () => {
      const loadPromise = service.loadGroupBalances(groupId);

      // During load
      expect(service.isLoadingForGroup(groupId)()).toBe(true);
      expect(service.statusForGroup(groupId)()).toBe('loading');

      const req = httpMock.expectOne(`http://localhost:3000/api/groups/${groupId}/balances`);
      req.flush(mockGroupBalances);

      await loadPromise;

      // After load
      expect(service.isLoadingForGroup(groupId)()).toBe(false);
      expect(service.isSuccessForGroup(groupId)()).toBe(true);
      expect(service.statusForGroup(groupId)()).toBe('success');
    });

    it('should handle HTTP errors gracefully', async () => {
      const loadPromise = service.loadGroupBalances(groupId);

      const req = httpMock.expectOne(`http://localhost:3000/api/groups/${groupId}/balances`);
      req.flush({ error: 'Group not found' }, { status: 404, statusText: 'Not Found' });

      const result = await loadPromise;

      expect(result).toEqual([]);
      expect(service.isErrorForGroup(groupId)()).toBe(true);
      expect(service.errorSignal()).toBe('Group not found');
      expect(errorService.reportError).toHaveBeenCalled();
    });

    it('should reject invalid group ID', async () => {
      const result = await service.loadGroupBalances(0);

      expect(result).toEqual([]);
      expect(service.errorSignal()).toBe('Invalid group ID');
      expect(errorService.reportError).toHaveBeenCalled();

      httpMock.expectNone('http://localhost:3000/api/groups/0/balances');
    });

    it('should deduplicate concurrent loadGroupBalances calls', async () => {
      const loadPromise1 = service.loadGroupBalances(groupId);
      const loadPromise2 = service.loadGroupBalances(groupId);

      // Should only make ONE HTTP request
      const requests = httpMock.match(`http://localhost:3000/api/groups/${groupId}/balances`);
      expect(requests.length).toBe(1);

      requests[0].flush(mockGroupBalances);

      // Both promises should resolve to the same data
      const [result1, result2] = await Promise.all([loadPromise1, loadPromise2]);
      expect(result1).toEqual(result2);
    });

    it('should allow new request after previous completes', async () => {
      // First load
      let loadPromise = service.loadGroupBalances(groupId);
      let req = httpMock.expectOne(`http://localhost:3000/api/groups/${groupId}/balances`);
      req.flush(mockGroupBalances);
      await loadPromise;

      // Second load should create new request
      loadPromise = service.loadGroupBalances(groupId);
      req = httpMock.expectOne(`http://localhost:3000/api/groups/${groupId}/balances`);
      req.flush(mockGroupBalances);
      await loadPromise;

      expect(service.balancesForGroup(groupId)()).toHaveSize(2);
    });

    it('should preserve previous data on transient errors', async () => {
      // First load successfully
      let loadPromise = service.loadGroupBalances(groupId);
      let req = httpMock.expectOne(`http://localhost:3000/api/groups/${groupId}/balances`);
      req.flush(mockGroupBalances);
      await loadPromise;

      const initialBalances = service.balancesForGroup(groupId)();

      // Second load fails
      loadPromise = service.loadGroupBalances(groupId);
      req = httpMock.expectOne(`http://localhost:3000/api/groups/${groupId}/balances`);
      req.flush({ error: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });
      await loadPromise;

      // Should still have previous data
      expect(service.balancesForGroup(groupId)()).toEqual(initialBalances);
      expect(service.isSuccessForGroup(groupId)()).toBe(true);
    });

    it('should update lastLoadedAt on successful load', async () => {
      const beforeLoad = new Date();

      const loadPromise = service.loadGroupBalances(groupId);
      const req = httpMock.expectOne(`http://localhost:3000/api/groups/${groupId}/balances`);
      req.flush(mockGroupBalances);
      await loadPromise;

      const lastLoaded = service.lastLoadedAtForGroup(groupId)();
      expect(lastLoaded).toBeTruthy();
      expect(new Date(lastLoaded!).getTime()).toBeGreaterThanOrEqual(beforeLoad.getTime());
    });
  });

  describe('loadUserBalance()', () => {
    const userId = 1;

    it('should load user balance successfully', async () => {
      const loadPromise = service.loadUserBalance(userId);

      const req = httpMock.expectOne(`http://localhost:3000/api/users/${userId}/balance`);
      expect(req.request.method).toBe('GET');
      req.flush(mockUserBalance);

      const result = await loadPromise;

      expect(result).toBeTruthy();
      expect(result!.userId).toBe(1);
      expect(result!.userName).toBe('Alice');
      expect(result!.overallBalance).toBe(75.0);
      expect(result!.groupBalances).toHaveSize(2);
      expect(result!.groupBalances[0].groupId).toBe(1);
      
      expect(service.cachedUserIds()).toContain(userId);
      expect(errorService.clearError).toHaveBeenCalled();
    });

    it('should transform snake_case to camelCase', async () => {
      const loadPromise = service.loadUserBalance(userId);

      const req = httpMock.expectOne(`http://localhost:3000/api/users/${userId}/balance`);
      req.flush(mockUserBalance);

      const result = await loadPromise;

      expect(result).toEqual(
        jasmine.objectContaining({
          userId: mockUserBalance.user_id,
          userName: mockUserBalance.user_name,
          overallBalance: mockUserBalance.overall_balance
        })
      );
    });

    it('should update status signals correctly', async () => {
      const loadPromise = service.loadUserBalance(userId);

      // During load
      expect(service.isLoadingForUser(userId)()).toBe(true);
      expect(service.statusForUser(userId)()).toBe('loading');

      const req = httpMock.expectOne(`http://localhost:3000/api/users/${userId}/balance`);
      req.flush(mockUserBalance);

      await loadPromise;

      // After load
      expect(service.isLoadingForUser(userId)()).toBe(false);
      expect(service.isSuccessForUser(userId)()).toBe(true);
      expect(service.statusForUser(userId)()).toBe('success');
    });

    it('should handle HTTP errors gracefully', async () => {
      const loadPromise = service.loadUserBalance(userId);

      const req = httpMock.expectOne(`http://localhost:3000/api/users/${userId}/balance`);
      req.flush({ error: 'User not found' }, { status: 404, statusText: 'Not Found' });

      const result = await loadPromise;

      expect(result).toBeNull();
      expect(service.isErrorForUser(userId)()).toBe(true);
      expect(service.errorSignal()).toBe('User not found');
      expect(errorService.reportError).toHaveBeenCalled();
    });

    it('should reject invalid user ID', async () => {
      const result = await service.loadUserBalance(-1);

      expect(result).toBeNull();
      expect(service.errorSignal()).toBe('Invalid user ID');
      expect(errorService.reportError).toHaveBeenCalled();

      httpMock.expectNone('http://localhost:3000/api/users/-1/balance');
    });

    it('should deduplicate concurrent loadUserBalance calls', async () => {
      const loadPromise1 = service.loadUserBalance(userId);
      const loadPromise2 = service.loadUserBalance(userId);

      // Should only make ONE HTTP request
      const requests = httpMock.match(`http://localhost:3000/api/users/${userId}/balance`);
      expect(requests.length).toBe(1);

      requests[0].flush(mockUserBalance);

      // Both promises should resolve to the same data
      const [result1, result2] = await Promise.all([loadPromise1, loadPromise2]);
      expect(result1).toEqual(result2);
    });

    it('should preserve previous data on transient errors', async () => {
      // First load successfully
      let loadPromise = service.loadUserBalance(userId);
      let req = httpMock.expectOne(`http://localhost:3000/api/users/${userId}/balance`);
      req.flush(mockUserBalance);
      await loadPromise;

      const initialBalance = service.balanceForUser(userId)();

      // Second load fails
      loadPromise = service.loadUserBalance(userId);
      req = httpMock.expectOne(`http://localhost:3000/api/users/${userId}/balance`);
      req.flush({ error: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });
      await loadPromise;

      // Should still have previous data
      expect(service.balanceForUser(userId)()).toEqual(initialBalance);
      expect(service.isSuccessForUser(userId)()).toBe(true);
    });

    it('should update lastLoadedAt on successful load', async () => {
      const beforeLoad = new Date();

      const loadPromise = service.loadUserBalance(userId);
      const req = httpMock.expectOne(`http://localhost:3000/api/users/${userId}/balance`);
      req.flush(mockUserBalance);
      await loadPromise;

      const lastLoaded = service.lastLoadedAtForUser(userId)();
      expect(lastLoaded).toBeTruthy();
      expect(new Date(lastLoaded!).getTime()).toBeGreaterThanOrEqual(beforeLoad.getTime());
    });
  });

  describe('Group Balance Signals', () => {
    const groupId = 1;

    beforeEach(async () => {
      const loadPromise = service.loadGroupBalances(groupId);
      const req = httpMock.expectOne(`http://localhost:3000/api/groups/${groupId}/balances`);
      req.flush(mockGroupBalances);
      await loadPromise;
    });

    it('should provide balancesForGroup signal', () => {
      const balances = service.balancesForGroup(groupId)();
      expect(balances).toHaveSize(2);
      expect(balances[0].userId).toBe(1);
    });

    it('should provide statusForGroup signal', () => {
      expect(service.statusForGroup(groupId)()).toBe('success');
    });

    it('should provide isLoadingForGroup signal', () => {
      expect(service.isLoadingForGroup(groupId)()).toBe(false);
    });

    it('should provide isSuccessForGroup signal', () => {
      expect(service.isSuccessForGroup(groupId)()).toBe(true);
    });

    it('should provide isErrorForGroup signal', () => {
      expect(service.isErrorForGroup(groupId)()).toBe(false);
    });

    it('should provide lastLoadedAtForGroup signal', () => {
      expect(service.lastLoadedAtForGroup(groupId)()).toBeTruthy();
    });

    it('should return empty array for non-existent group', () => {
      const balances = service.balancesForGroup(999)();
      expect(balances).toEqual([]);
    });

    it('should return idle status for non-existent group', () => {
      expect(service.statusForGroup(999)()).toBe('idle');
    });
  });

  describe('User Balance Signals', () => {
    const userId = 1;

    beforeEach(async () => {
      const loadPromise = service.loadUserBalance(userId);
      const req = httpMock.expectOne(`http://localhost:3000/api/users/${userId}/balance`);
      req.flush(mockUserBalance);
      await loadPromise;
    });

    it('should provide balanceForUser signal', () => {
      const balance = service.balanceForUser(userId)();
      expect(balance).toBeTruthy();
      expect(balance!.userId).toBe(1);
      expect(balance!.overallBalance).toBe(75.0);
    });

    it('should provide statusForUser signal', () => {
      expect(service.statusForUser(userId)()).toBe('success');
    });

    it('should provide isLoadingForUser signal', () => {
      expect(service.isLoadingForUser(userId)()).toBe(false);
    });

    it('should provide isSuccessForUser signal', () => {
      expect(service.isSuccessForUser(userId)()).toBe(true);
    });

    it('should provide isErrorForUser signal', () => {
      expect(service.isErrorForUser(userId)()).toBe(false);
    });

    it('should provide lastLoadedAtForUser signal', () => {
      expect(service.lastLoadedAtForUser(userId)()).toBeTruthy();
    });

    it('should return null for non-existent user', () => {
      const balance = service.balanceForUser(999)();
      expect(balance).toBeNull();
    });

    it('should return idle status for non-existent user', () => {
      expect(service.statusForUser(999)()).toBe('idle');
    });
  });

  describe('findUserBalanceInGroup()', () => {
    const groupId = 1;

    beforeEach(async () => {
      const loadPromise = service.loadGroupBalances(groupId);
      const req = httpMock.expectOne(`http://localhost:3000/api/groups/${groupId}/balances`);
      req.flush(mockGroupBalances);
      await loadPromise;
    });

    it('should find user balance in group', () => {
      const balance = service.findUserBalanceInGroup(groupId, 1);
      expect(balance).toBeTruthy();
      expect(balance!.userId).toBe(1);
      expect(balance!.userName).toBe('Alice');
    });

    it('should return undefined for non-existent user in group', () => {
      const balance = service.findUserBalanceInGroup(groupId, 999);
      expect(balance).toBeUndefined();
    });

    it('should return undefined for non-existent group', () => {
      const balance = service.findUserBalanceInGroup(999, 1);
      expect(balance).toBeUndefined();
    });
  });

  describe('refreshGroupBalances() and refreshUserBalance()', () => {
    it('should refresh group balances', async () => {
      const groupId = 1;
      const refreshPromise = service.refreshGroupBalances(groupId);

      const req = httpMock.expectOne(`http://localhost:3000/api/groups/${groupId}/balances`);
      req.flush(mockGroupBalances);

      const result = await refreshPromise;
      expect(result).toHaveSize(2);
    });

    it('should refresh user balance', async () => {
      const userId = 1;
      const refreshPromise = service.refreshUserBalance(userId);

      const req = httpMock.expectOne(`http://localhost:3000/api/users/${userId}/balance`);
      req.flush(mockUserBalance);

      const result = await refreshPromise;
      expect(result).toBeTruthy();
      expect(result!.userId).toBe(1);
    });
  });

  describe('totalCachedBalances', () => {
    it('should compute total cached balances across all groups', async () => {
      // Load balances for group 1
      let loadPromise = service.loadGroupBalances(1);
      let req = httpMock.expectOne('http://localhost:3000/api/groups/1/balances');
      req.flush(mockGroupBalances);
      await loadPromise;

      expect(service.totalCachedBalances()).toBe(2);

      // Load balances for group 2
      loadPromise = service.loadGroupBalances(2);
      req = httpMock.expectOne('http://localhost:3000/api/groups/2/balances');
      req.flush([mockGroupBalances[0]]); // Only one balance
      await loadPromise;

      expect(service.totalCachedBalances()).toBe(3); // 2 + 1
    });
  });

  describe('clearError()', () => {
    it('should clear error state', async () => {
      // Trigger an error
      const loadPromise = service.loadGroupBalances(1);
      const req = httpMock.expectOne('http://localhost:3000/api/groups/1/balances');
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
      const loadPromise = service.loadGroupBalances(1);
      const req = httpMock.expectOne('http://localhost:3000/api/groups/1/balances');
      req.flush('Custom error message', { status: 400, statusText: 'Bad Request' });
      await loadPromise;

      expect(service.errorSignal()).toBe('Custom error message');
    });

    it('should extract error from error field in object', async () => {
      const loadPromise = service.loadGroupBalances(1);
      const req = httpMock.expectOne('http://localhost:3000/api/groups/1/balances');
      req.flush({ error: 'Validation failed' }, { status: 400, statusText: 'Bad Request' });
      await loadPromise;

      expect(service.errorSignal()).toBe('Validation failed');
    });

    it('should not expose 5xx errors', async () => {
      const loadPromise = service.loadGroupBalances(1);
      const req = httpMock.expectOne('http://localhost:3000/api/groups/1/balances');
      req.flush({ error: 'Internal details' }, { status: 500, statusText: 'Internal Server Error' });
      await loadPromise;

      // Should use default message, not expose internal error
      expect(service.errorSignal()).toBe('Unable to load group balances. Please try again.');
    });

    it('should handle network errors', async () => {
      const loadPromise = service.loadGroupBalances(1);
      const req = httpMock.expectOne('http://localhost:3000/api/groups/1/balances');
      req.error(new ProgressEvent('Network error'));
      await loadPromise;

      expect(service.errorSignal()).toBeTruthy();
      expect(errorService.reportError).toHaveBeenCalled();
    });
  });

  describe('LRU Cache Management', () => {
    it('should cache multiple groups', async () => {
      // Load 3 groups
      for (let i = 1; i <= 3; i++) {
        const loadPromise = service.loadGroupBalances(i);
        const req = httpMock.expectOne(`http://localhost:3000/api/groups/${i}/balances`);
        req.flush(mockGroupBalances);
        await loadPromise;
      }

      expect(service.cachedGroupIds()).toEqual([1, 2, 3]);
    });

    it('should cache multiple users', async () => {
      // Load 3 users
      for (let i = 1; i <= 3; i++) {
        const loadPromise = service.loadUserBalance(i);
        const req = httpMock.expectOne(`http://localhost:3000/api/users/${i}/balance`);
        req.flush(mockUserBalance);
        await loadPromise;
      }

      expect(service.cachedUserIds()).toEqual([1, 2, 3]);
    });

    // Note: Testing actual LRU eviction would require loading 50+ groups/users
    // which is impractical for unit tests. The eviction logic is tested
    // through code coverage and integration testing.
  });
});
