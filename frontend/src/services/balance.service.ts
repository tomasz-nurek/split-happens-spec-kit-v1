import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from './api.service';
import { ErrorService } from './error.service';

/**
 * Represents who owes/is owed within a group balance
 */
export interface DebtRelationship {
  userId: number;
  userName: string;
  amount: number;
}

/**
 * Represents a single user's balance within a specific group
 */
export interface GroupBalance {
  userId: number;
  userName: string;
  balance: number;
  owes: DebtRelationship[];
  owedBy: DebtRelationship[];
}

/**
 * Represents a summary of a user's balance in a specific group
 */
export interface GroupBalanceSummary {
  groupId: number;
  groupName: string;
  balance: number;
}

/**
 * Represents a user's overall balance across all groups
 */
export interface UserBalance {
  userId: number;
  userName: string;
  overallBalance: number;
  groupBalances: GroupBalanceSummary[];
}

type BalanceStatus = 'idle' | 'loading' | 'success' | 'error';

interface GroupBalanceState {
  balances: GroupBalance[];
  status: BalanceStatus;
  lastLoadedAt: string | null;
}

interface UserBalanceState {
  balance: UserBalance | null;
  status: BalanceStatus;
  lastLoadedAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class BalanceService {
  private readonly api = inject(ApiService);
  private readonly errorService = inject(ErrorService);

  // State management with LRU cache for group balances
  private readonly MAX_CACHED_GROUPS = 50;
  private readonly recentlyAccessedGroups: number[] = [];
  private readonly MAX_CACHED_USERS = 50;
  private readonly recentlyAccessedUsers: number[] = [];

  private readonly _groupBalanceState = signal<Record<number, GroupBalanceState>>({});
  private readonly _userBalanceState = signal<Record<number, UserBalanceState>>({});
  private readonly balanceError = signal<string | null>(null);

  // Request deduplication
  private readonly pendingGroupLoads = new Map<number, Promise<GroupBalance[]>>();
  private readonly pendingUserLoads = new Map<number, Promise<UserBalance | null>>();

  // Signal caches for group balances
  private readonly groupBalancesSignals = new Map<number, Signal<GroupBalance[]>>();
  private readonly groupStatusSignals = new Map<number, Signal<BalanceStatus>>();
  private readonly groupLoadingSignals = new Map<number, Signal<boolean>>();
  private readonly groupSuccessSignals = new Map<number, Signal<boolean>>();
  private readonly groupErrorSignals = new Map<number, Signal<boolean>>();
  private readonly groupLastLoadedSignals = new Map<number, Signal<string | null>>();

  // Signal caches for user balances
  private readonly userBalanceSignals = new Map<number, Signal<UserBalance | null>>();
  private readonly userStatusSignals = new Map<number, Signal<BalanceStatus>>();
  private readonly userLoadingSignals = new Map<number, Signal<boolean>>();
  private readonly userSuccessSignals = new Map<number, Signal<boolean>>();
  private readonly userErrorSignals = new Map<number, Signal<boolean>>();
  private readonly userLastLoadedSignals = new Map<number, Signal<string | null>>();

  // Public signals
  readonly errorSignal: Signal<string | null> = this.balanceError.asReadonly();
  readonly groupBalanceState: Signal<Record<number, GroupBalanceState>> =
    this._groupBalanceState.asReadonly();
  readonly userBalanceState: Signal<Record<number, UserBalanceState>> =
    this._userBalanceState.asReadonly();
  readonly cachedGroupIds: Signal<number[]> = computed(() =>
    Object.keys(this._groupBalanceState())
      .map((key) => Number(key))
      .sort((a, b) => a - b)
  );
  readonly cachedUserIds: Signal<number[]> = computed(() =>
    Object.keys(this._userBalanceState())
      .map((key) => Number(key))
      .sort((a, b) => a - b)
  );

  /**
   * Load group balances from the API
   * @param groupId Group ID to load balances for
   * @returns Promise resolving to array of group balances, or empty array on error
   */
  async loadGroupBalances(groupId: number): Promise<GroupBalance[]> {
    if (!this.isValidId(groupId)) {
      const message = 'Invalid group ID';
      this.setError(message);
      this.errorService.reportError({ message });
      return [];
    }

    // Request deduplication: reuse pending load if one is in progress
    if (this.pendingGroupLoads.has(groupId)) {
      return this.pendingGroupLoads.get(groupId)!;
    }

    this.setError(null);
    const previousState = this.getGroupBalanceState(groupId);
    this.setGroupBalanceState(groupId, { status: 'loading' });

    const request = (async () => {
      try {
        const response = await firstValueFrom(
          this.api.get<any[]>(`/groups/${groupId}/balances`)
        );

        // Transform snake_case API response to camelCase
        const balances: GroupBalance[] = response.map((item) => ({
          userId: item.user_id,
          userName: item.user_name,
          balance: Number(item.balance),
          owes: (item.owes || []).map((debt: any) => ({
            userId: debt.user_id,
            userName: debt.user_name,
            amount: Number(debt.amount)
          })),
          owedBy: (item.owed_by || []).map((debt: any) => ({
            userId: debt.user_id,
            userName: debt.user_name,
            amount: Number(debt.amount)
          }))
        }));

        this.setGroupBalanceState(groupId, {
          balances: [...balances],
          status: 'success',
          lastLoadedAt: new Date().toISOString()
        });

        this.errorService.clearError();
        return balances;
      } catch (error) {
        const message =
          this.extractErrorMessage(error) ?? 'Unable to load group balances. Please try again.';
        this.setError(message);
        this.errorService.reportError({ message, details: error });

        // Restore previous state to avoid clearing already-visible data on transient failures
        this.setGroupBalanceState(groupId, {
          balances: previousState.balances,
          status: previousState.status === 'success' ? 'success' : 'error',
          lastLoadedAt: previousState.lastLoadedAt
        });

        return previousState.balances;
      } finally {
        this.pendingGroupLoads.delete(groupId);
      }
    })();

    this.pendingGroupLoads.set(groupId, request);
    return request;
  }

  /**
   * Load user's overall balance from the API
   * @param userId User ID to load balance for
   * @returns Promise resolving to user balance, or null on error
   */
  async loadUserBalance(userId: number): Promise<UserBalance | null> {
    if (!this.isValidId(userId)) {
      const message = 'Invalid user ID';
      this.setError(message);
      this.errorService.reportError({ message });
      return null;
    }

    // Request deduplication: reuse pending load if one is in progress
    if (this.pendingUserLoads.has(userId)) {
      return this.pendingUserLoads.get(userId)!;
    }

    this.setError(null);
    const previousState = this.getUserBalanceState(userId);
    this.setUserBalanceState(userId, { status: 'loading' });

    const request = (async () => {
      try {
        const response = await firstValueFrom(
          this.api.get<any>(`/users/${userId}/balance`)
        );

        // Transform snake_case API response to camelCase
        const balance: UserBalance = {
          userId: response.user_id,
          userName: response.user_name,
          overallBalance: Number(response.overall_balance),
          groupBalances: (response.group_balances || []).map((gb: any) => ({
            groupId: gb.group_id,
            groupName: gb.group_name,
            balance: Number(gb.balance)
          }))
        };

        this.setUserBalanceState(userId, {
          balance,
          status: 'success',
          lastLoadedAt: new Date().toISOString()
        });

        this.errorService.clearError();
        return balance;
      } catch (error) {
        const message =
          this.extractErrorMessage(error) ?? 'Unable to load user balance. Please try again.';
        this.setError(message);
        this.errorService.reportError({ message, details: error });

        // Restore previous state to avoid clearing already-visible data on transient failures
        this.setUserBalanceState(userId, {
          balance: previousState.balance,
          status: previousState.status === 'success' ? 'success' : 'error',
          lastLoadedAt: previousState.lastLoadedAt
        });

        return previousState.balance;
      } finally {
        this.pendingUserLoads.delete(userId);
      }
    })();

    this.pendingUserLoads.set(userId, request);
    return request;
  }

  /**
   * Refresh group balances (alias for loadGroupBalances)
   */
  async refreshGroupBalances(groupId: number): Promise<GroupBalance[]> {
    return this.loadGroupBalances(groupId);
  }

  /**
   * Refresh user balance (alias for loadUserBalance)
   */
  async refreshUserBalance(userId: number): Promise<UserBalance | null> {
    return this.loadUserBalance(userId);
  }

  /**
   * Get group balances signal for a specific group
   */
  balancesForGroup(groupId: number): Signal<GroupBalance[]> {
    return this.getOrCreateGroupSignal(this.groupBalancesSignals, groupId, (id) =>
      computed(() => this._groupBalanceState()[id]?.balances ?? [])
    );
  }

  /**
   * Get status signal for a specific group
   */
  statusForGroup(groupId: number): Signal<BalanceStatus> {
    return this.getOrCreateGroupSignal(this.groupStatusSignals, groupId, (id) =>
      computed(() => this._groupBalanceState()[id]?.status ?? 'idle')
    );
  }

  /**
   * Get loading signal for a specific group
   */
  isLoadingForGroup(groupId: number): Signal<boolean> {
    return this.getOrCreateGroupSignal(this.groupLoadingSignals, groupId, (id) =>
      computed(() => this._groupBalanceState()[id]?.status === 'loading')
    );
  }

  /**
   * Get success signal for a specific group
   */
  isSuccessForGroup(groupId: number): Signal<boolean> {
    return this.getOrCreateGroupSignal(this.groupSuccessSignals, groupId, (id) =>
      computed(() => this._groupBalanceState()[id]?.status === 'success')
    );
  }

  /**
   * Get error signal for a specific group
   */
  isErrorForGroup(groupId: number): Signal<boolean> {
    return this.getOrCreateGroupSignal(this.groupErrorSignals, groupId, (id) =>
      computed(() => this._groupBalanceState()[id]?.status === 'error')
    );
  }

  /**
   * Get last loaded timestamp signal for a specific group
   */
  lastLoadedAtForGroup(groupId: number): Signal<string | null> {
    return this.getOrCreateGroupSignal(this.groupLastLoadedSignals, groupId, (id) =>
      computed(() => this._groupBalanceState()[id]?.lastLoadedAt ?? null)
    );
  }

  /**
   * Get user balance signal for a specific user
   */
  balanceForUser(userId: number): Signal<UserBalance | null> {
    return this.getOrCreateUserSignal(this.userBalanceSignals, userId, (id) =>
      computed(() => this._userBalanceState()[id]?.balance ?? null)
    );
  }

  /**
   * Get status signal for a specific user
   */
  statusForUser(userId: number): Signal<BalanceStatus> {
    return this.getOrCreateUserSignal(this.userStatusSignals, userId, (id) =>
      computed(() => this._userBalanceState()[id]?.status ?? 'idle')
    );
  }

  /**
   * Get loading signal for a specific user
   */
  isLoadingForUser(userId: number): Signal<boolean> {
    return this.getOrCreateUserSignal(this.userLoadingSignals, userId, (id) =>
      computed(() => this._userBalanceState()[id]?.status === 'loading')
    );
  }

  /**
   * Get success signal for a specific user
   */
  isSuccessForUser(userId: number): Signal<boolean> {
    return this.getOrCreateUserSignal(this.userSuccessSignals, userId, (id) =>
      computed(() => this._userBalanceState()[id]?.status === 'success')
    );
  }

  /**
   * Get error signal for a specific user
   */
  isErrorForUser(userId: number): Signal<boolean> {
    return this.getOrCreateUserSignal(this.userErrorSignals, userId, (id) =>
      computed(() => this._userBalanceState()[id]?.status === 'error')
    );
  }

  /**
   * Get last loaded timestamp signal for a specific user
   */
  lastLoadedAtForUser(userId: number): Signal<string | null> {
    return this.getOrCreateUserSignal(this.userLastLoadedSignals, userId, (id) =>
      computed(() => this._userBalanceState()[id]?.lastLoadedAt ?? null)
    );
  }

  /**
   * Find a specific user's balance within a group's balances
   */
  findUserBalanceInGroup(groupId: number, userId: number): GroupBalance | undefined {
    const state = this._groupBalanceState()[groupId];
    if (!state) {
      return undefined;
    }
    return state.balances.find((b) => b.userId === userId);
  }

  /**
   * Computed signal for total balance count across all cached groups
   */
  readonly totalCachedBalances: Signal<number> = computed(() => {
    const snapshot = this._groupBalanceState();
    return Object.values(snapshot).reduce((sum, state) => sum + state.balances.length, 0);
  });

  /**
   * Clear the error state
   */
  clearError(): void {
    this.setError(null);
  }

  private getGroupBalanceState(groupId: number): GroupBalanceState {
    const current = this._groupBalanceState()[groupId];
    if (!current) {
      return {
        balances: [],
        status: 'idle',
        lastLoadedAt: null
      };
    }

    return {
      balances: [...current.balances],
      status: current.status,
      lastLoadedAt: current.lastLoadedAt
    };
  }

  private setGroupBalanceState(groupId: number, patch: Partial<GroupBalanceState>): void {
    this._groupBalanceState.update((current) => {
      const existing = current[groupId] ?? {
        balances: [],
        status: 'idle' as BalanceStatus,
        lastLoadedAt: null
      };

      const next: GroupBalanceState = {
        balances: patch.balances !== undefined ? [...patch.balances] : [...existing.balances],
        status: patch.status ?? existing.status,
        lastLoadedAt: patch.lastLoadedAt !== undefined ? patch.lastLoadedAt : existing.lastLoadedAt
      };

      return { ...current, [groupId]: next };
    });

    // Mark group as recently accessed and cleanup old groups if needed
    this.markGroupAccessed(groupId);
    this.cleanupOldGroups();
  }

  private getUserBalanceState(userId: number): UserBalanceState {
    const current = this._userBalanceState()[userId];
    if (!current) {
      return {
        balance: null,
        status: 'idle',
        lastLoadedAt: null
      };
    }

    return {
      balance: current.balance
        ? { ...current.balance, groupBalances: [...current.balance.groupBalances] }
        : null,
      status: current.status,
      lastLoadedAt: current.lastLoadedAt
    };
  }

  private setUserBalanceState(userId: number, patch: Partial<UserBalanceState>): void {
    this._userBalanceState.update((current) => {
      const existing = current[userId] ?? {
        balance: null,
        status: 'idle' as BalanceStatus,
        lastLoadedAt: null
      };

      const next: UserBalanceState = {
        balance: patch.balance !== undefined
          ? patch.balance
            ? { ...patch.balance, groupBalances: [...patch.balance.groupBalances] }
            : null
          : existing.balance,
        status: patch.status ?? existing.status,
        lastLoadedAt: patch.lastLoadedAt !== undefined ? patch.lastLoadedAt : existing.lastLoadedAt
      };

      return { ...current, [userId]: next };
    });

    // Mark user as recently accessed and cleanup old users if needed
    this.markUserAccessed(userId);
    this.cleanupOldUsers();
  }

  private getOrCreateGroupSignal<T>(
    cache: Map<number, Signal<T>>,
    groupId: number,
    factory: (groupId: number) => Signal<T>
  ): Signal<T> {
    if (!cache.has(groupId)) {
      cache.set(groupId, factory(groupId));
    }
    return cache.get(groupId)!;
  }

  private getOrCreateUserSignal<T>(
    cache: Map<number, Signal<T>>,
    userId: number,
    factory: (userId: number) => Signal<T>
  ): Signal<T> {
    if (!cache.has(userId)) {
      cache.set(userId, factory(userId));
    }
    return cache.get(userId)!;
  }

  private setError(message: string | null): void {
    this.balanceError.set(message);
  }

  private isValidId(value: number): boolean {
    return Number.isInteger(value) && value > 0;
  }

  private extractErrorMessage(error: unknown): string | null {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return null;
      }

      // Don't expose 5xx server errors
      if (error.status >= 500) {
        return null;
      }

      if (typeof error.error === 'string') {
        const trimmed = error.error.trim();
        if (trimmed) {
          return trimmed;
        }
      }

      if (error.error && typeof error.error === 'object') {
        const payload = error.error as Record<string, unknown>;
        const errorField = payload['error'];
        if (typeof errorField === 'string') {
          const trimmed = errorField.trim();
          if (trimmed) {
            return trimmed;
          }
        }

        const messageField = payload['message'];
        if (typeof messageField === 'string') {
          const trimmed = messageField.trim();
          if (trimmed) {
            return trimmed;
          }
        }
      }

      if (error.statusText && error.statusText !== 'OK') {
        return error.statusText;
      }

      return null;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return null;
  }

  /**
   * Mark a group as recently accessed for LRU tracking
   */
  private markGroupAccessed(groupId: number): void {
    const index = this.recentlyAccessedGroups.indexOf(groupId);
    if (index > -1) {
      this.recentlyAccessedGroups.splice(index, 1);
    }
    this.recentlyAccessedGroups.push(groupId);
  }

  /**
   * Clean up least recently used groups when cache limit is exceeded
   */
  private cleanupOldGroups(): void {
    if (this.recentlyAccessedGroups.length <= this.MAX_CACHED_GROUPS) {
      return;
    }

    const groupsToRemove = this.recentlyAccessedGroups.length - this.MAX_CACHED_GROUPS;
    const groupIdsToRemove = this.recentlyAccessedGroups.splice(0, groupsToRemove);

    if (groupIdsToRemove.length === 0) {
      return;
    }

    // Remove from state
    this._groupBalanceState.update((current) => {
      const next = { ...current };
      for (const groupId of groupIdsToRemove) {
        delete next[groupId];
      }
      return next;
    });

    // Clean up signal caches
    for (const groupId of groupIdsToRemove) {
      this.groupBalancesSignals.delete(groupId);
      this.groupStatusSignals.delete(groupId);
      this.groupLoadingSignals.delete(groupId);
      this.groupSuccessSignals.delete(groupId);
      this.groupErrorSignals.delete(groupId);
      this.groupLastLoadedSignals.delete(groupId);
    }
  }

  /**
   * Mark a user as recently accessed for LRU tracking
   */
  private markUserAccessed(userId: number): void {
    const index = this.recentlyAccessedUsers.indexOf(userId);
    if (index > -1) {
      this.recentlyAccessedUsers.splice(index, 1);
    }
    this.recentlyAccessedUsers.push(userId);
  }

  /**
   * Clean up least recently used users when cache limit is exceeded
   */
  private cleanupOldUsers(): void {
    if (this.recentlyAccessedUsers.length <= this.MAX_CACHED_USERS) {
      return;
    }

    const usersToRemove = this.recentlyAccessedUsers.length - this.MAX_CACHED_USERS;
    const userIdsToRemove = this.recentlyAccessedUsers.splice(0, usersToRemove);

    if (userIdsToRemove.length === 0) {
      return;
    }

    // Remove from state
    this._userBalanceState.update((current) => {
      const next = { ...current };
      for (const userId of userIdsToRemove) {
        delete next[userId];
      }
      return next;
    });

    // Clean up signal caches
    for (const userId of userIdsToRemove) {
      this.userBalanceSignals.delete(userId);
      this.userStatusSignals.delete(userId);
      this.userLoadingSignals.delete(userId);
      this.userSuccessSignals.delete(userId);
      this.userErrorSignals.delete(userId);
      this.userLastLoadedSignals.delete(userId);
    }
  }
}
