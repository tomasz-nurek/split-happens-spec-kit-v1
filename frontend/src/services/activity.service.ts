import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from './api.service';
import { ErrorService } from './error.service';

/**
 * Represents a single activity log entry
 */
export interface ActivityEntry {
  id: number;
  type: string;
  description?: string;
  userId?: number;
  userName?: string;
  groupId?: number;
  groupName?: string;
  expenseId?: number;
  expenseDescription?: string;
  amount?: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/**
 * Options for loading activities with pagination
 */
export interface ActivityLoadOptions {
  limit?: number;
  offset?: number;
}

/**
 * Response wrapper for global activity feed
 */
interface GlobalActivityResponse {
  activities: ActivityEntry[];
}

/**
 * Response wrapper for scoped activity feeds
 */
interface ScopedActivityResponse {
  activities: ActivityEntry[];
  groupId?: number;
  groupName?: string;
  userId?: number;
  userName?: string;
  expenseId?: number;
}

type ActivityStatus = 'idle' | 'loading' | 'success' | 'error';

interface ActivityState {
  activities: ActivityEntry[];
  status: ActivityStatus;
  lastLoadedAt: string | null;
  hasMore: boolean;
}

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private readonly api = inject(ApiService);
  private readonly errorService = inject(ErrorService);

  // LRU cache limits to prevent unbounded memory growth
  private readonly MAX_CACHED_GROUPS = 50;
  private readonly MAX_CACHED_USERS = 50;
  private readonly MAX_CACHED_EXPENSES = 50;

  // Global activity state
  private readonly _globalState = signal<ActivityState>({
    activities: [],
    status: 'idle',
    lastLoadedAt: null,
    hasMore: true
  });

  // Scoped activity states (per group/user/expense)
  private readonly _groupActivityState = signal<Record<number, ActivityState>>({});
  private readonly _userActivityState = signal<Record<number, ActivityState>>({});
  private readonly _expenseActivityState = signal<Record<number, ActivityState>>({});

  private readonly activityError = signal<string | null>(null);

  // Request deduplication
  private pendingGlobalLoad: Promise<ActivityEntry[]> | null = null;
  private readonly pendingGroupLoads = new Map<number, Promise<ActivityEntry[]>>();
  private readonly pendingUserLoads = new Map<number, Promise<ActivityEntry[]>>();
  private readonly pendingExpenseLoads = new Map<number, Promise<ActivityEntry[]>>();

  // Public signals - Global
  readonly globalState: Signal<ActivityState> = this._globalState.asReadonly();
  readonly activities: Signal<ActivityEntry[]> = computed(() => this._globalState().activities);
  readonly isLoading: Signal<boolean> = computed(() => this._globalState().status === 'loading');
  readonly isIdle: Signal<boolean> = computed(() => this._globalState().status === 'idle');
  readonly isSuccess: Signal<boolean> = computed(() => this._globalState().status === 'success');
  readonly isError: Signal<boolean> = computed(() => this._globalState().status === 'error');
  readonly activityCount: Signal<number> = computed(() => this._globalState().activities.length);
  readonly hasActivities: Signal<boolean> = computed(() => this._globalState().activities.length > 0);
  readonly hasMore: Signal<boolean> = computed(() => this._globalState().hasMore);
  readonly errorSignal: Signal<string | null> = this.activityError.asReadonly();
  readonly lastLoadedAt: Signal<string | null> = computed(() => this._globalState().lastLoadedAt);

  // Public signals - Cached IDs
  readonly cachedGroupIds: Signal<number[]> = computed(() =>
    Object.keys(this._groupActivityState())
      .map((key) => Number(key))
      .sort((a, b) => a - b)
  );
  readonly cachedUserIds: Signal<number[]> = computed(() =>
    Object.keys(this._userActivityState())
      .map((key) => Number(key))
      .sort((a, b) => a - b)
  );
  readonly cachedExpenseIds: Signal<number[]> = computed(() =>
    Object.keys(this._expenseActivityState())
      .map((key) => Number(key))
      .sort((a, b) => a - b)
  );

  /**
   * Load global activity log from the API
   * @param options Optional pagination parameters
   * @returns Promise resolving to array of activities, or empty array on error
   */
  async loadActivities(options: ActivityLoadOptions = {}): Promise<ActivityEntry[]> {
    // Request deduplication: reuse pending load if one is in progress
    if (this.pendingGlobalLoad) {
      return this.pendingGlobalLoad;
    }

    this.setError(null);
    this.setGlobalStatus('loading');

    this.pendingGlobalLoad = (async () => {
      try {
        const params = new URLSearchParams();
        if (options.limit !== undefined) {
          params.set('limit', options.limit.toString());
        }
        if (options.offset !== undefined) {
          params.set('offset', options.offset.toString());
        }

        const queryString = params.toString();
        const url = `/activity${queryString ? `?${queryString}` : ''}`;

        const response = await firstValueFrom(
          this.api.get<GlobalActivityResponse>(url)
        );

        const activities = response.activities || [];

        // If appending (offset > 0), merge with existing
        const isAppending = options.offset !== undefined && options.offset > 0;
        const finalActivities = isAppending
          ? [...this._globalState().activities, ...activities]
          : activities;

        this.setGlobalState({
          activities: finalActivities,
          status: 'success',
          lastLoadedAt: new Date().toISOString(),
          hasMore: options.limit !== undefined && activities.length >= options.limit
        });

        this.errorService.clearError();
        return finalActivities;
      } catch (error) {
        const message =
          this.extractErrorMessage(error) ?? 'Unable to load activities. Please try again.';
        this.setError(message);
        this.errorService.reportError({ message, details: error });
        this.setGlobalState({
          activities: [],
          status: 'error',
          lastLoadedAt: null,
          hasMore: false
        });
        return [];
      } finally {
        this.pendingGlobalLoad = null;
      }
    })();

    return this.pendingGlobalLoad;
  }

  /**
   * Load more activities (for pagination)
   * @param limit Number of activities to load
   * @returns Promise resolving to array of all activities including newly loaded ones
   */
  async loadMore(limit: number = 50): Promise<ActivityEntry[]> {
    const currentCount = this.activityCount();
    return this.loadActivities({ limit, offset: currentCount });
  }

  /**
   * Refresh activities (reload from beginning)
   * @param options Optional pagination parameters
   * @returns Promise resolving to array of activities
   */
  async refresh(options: ActivityLoadOptions = {}): Promise<ActivityEntry[]> {
    return this.loadActivities(options);
  }

  /**
   * Load activity log for a specific group
   * @param groupId Group ID to load activities for
   * @param options Optional pagination parameters
   * @returns Promise resolving to array of activities, or empty array on error
   */
  async loadGroupActivities(
    groupId: number,
    options: ActivityLoadOptions = {}
  ): Promise<ActivityEntry[]> {
    if (!this.isValidId(groupId)) {
      const message = 'Invalid group ID';
      this.setError(message);
      this.errorService.reportError({ message });
      return [];
    }

    // Request deduplication
    if (this.pendingGroupLoads.has(groupId)) {
      return this.pendingGroupLoads.get(groupId)!;
    }

    this.setError(null);
    const previousState = this.getGroupState(groupId);
    this.setGroupState(groupId, { status: 'loading' });

    const request = (async () => {
      try {
        const params = new URLSearchParams();
        if (options.limit !== undefined) {
          params.set('limit', options.limit.toString());
        }
        if (options.offset !== undefined) {
          params.set('offset', options.offset.toString());
        }

        const queryString = params.toString();
        const url = `/groups/${groupId}/activity${queryString ? `?${queryString}` : ''}`;

        const response = await firstValueFrom(
          this.api.get<ScopedActivityResponse>(url)
        );

        const activities = response.activities || [];

        // If appending, merge with existing
        const isAppending = options.offset !== undefined && options.offset > 0;
        const finalActivities = isAppending
          ? [...previousState.activities, ...activities]
          : activities;

        this.setGroupState(groupId, {
          activities: finalActivities,
          status: 'success',
          lastLoadedAt: new Date().toISOString(),
          hasMore: options.limit !== undefined && activities.length >= options.limit
        });

        this.errorService.clearError();
        return finalActivities;
      } catch (error) {
        const message =
          this.extractErrorMessage(error) ?? 'Unable to load group activities. Please try again.';
        this.setError(message);
        this.errorService.reportError({ message, details: error });

        // Restore previous state on error
        this.setGroupState(groupId, {
          activities: previousState.activities,
          status: previousState.status === 'success' ? 'success' : 'error',
          lastLoadedAt: previousState.lastLoadedAt,
          hasMore: previousState.hasMore
        });

        return previousState.activities;
      } finally {
        this.pendingGroupLoads.delete(groupId);
      }
    })();

    this.pendingGroupLoads.set(groupId, request);
    return request;
  }

  /**
   * Load activity log for a specific user
   * @param userId User ID to load activities for
   * @param options Optional pagination parameters
   * @returns Promise resolving to array of activities, or empty array on error
   */
  async loadUserActivities(
    userId: number,
    options: ActivityLoadOptions = {}
  ): Promise<ActivityEntry[]> {
    if (!this.isValidId(userId)) {
      const message = 'Invalid user ID';
      this.setError(message);
      this.errorService.reportError({ message });
      return [];
    }

    // Request deduplication
    if (this.pendingUserLoads.has(userId)) {
      return this.pendingUserLoads.get(userId)!;
    }

    this.setError(null);
    const previousState = this.getUserState(userId);
    this.setUserState(userId, { status: 'loading' });

    const request = (async () => {
      try {
        const params = new URLSearchParams();
        if (options.limit !== undefined) {
          params.set('limit', options.limit.toString());
        }
        if (options.offset !== undefined) {
          params.set('offset', options.offset.toString());
        }

        const queryString = params.toString();
        const url = `/users/${userId}/activity${queryString ? `?${queryString}` : ''}`;

        const response = await firstValueFrom(
          this.api.get<ScopedActivityResponse>(url)
        );

        const activities = response.activities || [];

        // If appending, merge with existing
        const isAppending = options.offset !== undefined && options.offset > 0;
        const finalActivities = isAppending
          ? [...previousState.activities, ...activities]
          : activities;

        this.setUserState(userId, {
          activities: finalActivities,
          status: 'success',
          lastLoadedAt: new Date().toISOString(),
          hasMore: options.limit !== undefined && activities.length >= options.limit
        });

        this.errorService.clearError();
        return finalActivities;
      } catch (error) {
        const message =
          this.extractErrorMessage(error) ?? 'Unable to load user activities. Please try again.';
        this.setError(message);
        this.errorService.reportError({ message, details: error });

        // Restore previous state on error
        this.setUserState(userId, {
          activities: previousState.activities,
          status: previousState.status === 'success' ? 'success' : 'error',
          lastLoadedAt: previousState.lastLoadedAt,
          hasMore: previousState.hasMore
        });

        return previousState.activities;
      } finally {
        this.pendingUserLoads.delete(userId);
      }
    })();

    this.pendingUserLoads.set(userId, request);
    return request;
  }

  /**
   * Load activity log for a specific expense
   * @param expenseId Expense ID to load activities for
   * @param options Optional pagination parameters
   * @returns Promise resolving to array of activities, or empty array on error
   */
  async loadExpenseActivities(
    expenseId: number,
    options: ActivityLoadOptions = {}
  ): Promise<ActivityEntry[]> {
    if (!this.isValidId(expenseId)) {
      const message = 'Invalid expense ID';
      this.setError(message);
      this.errorService.reportError({ message });
      return [];
    }

    // Request deduplication
    if (this.pendingExpenseLoads.has(expenseId)) {
      return this.pendingExpenseLoads.get(expenseId)!;
    }

    this.setError(null);
    const previousState = this.getExpenseState(expenseId);
    this.setExpenseState(expenseId, { status: 'loading' });

    const request = (async () => {
      try {
        const params = new URLSearchParams();
        if (options.limit !== undefined) {
          params.set('limit', options.limit.toString());
        }
        if (options.offset !== undefined) {
          params.set('offset', options.offset.toString());
        }

        const queryString = params.toString();
        const url = `/expenses/${expenseId}/activity${queryString ? `?${queryString}` : ''}`;

        const response = await firstValueFrom(
          this.api.get<ScopedActivityResponse>(url)
        );

        const activities = response.activities || [];

        // If appending, merge with existing
        const isAppending = options.offset !== undefined && options.offset > 0;
        const finalActivities = isAppending
          ? [...previousState.activities, ...activities]
          : activities;

        this.setExpenseState(expenseId, {
          activities: finalActivities,
          status: 'success',
          lastLoadedAt: new Date().toISOString(),
          hasMore: options.limit !== undefined && activities.length >= options.limit
        });

        this.errorService.clearError();
        return finalActivities;
      } catch (error) {
        const message =
          this.extractErrorMessage(error) ??
          'Unable to load expense activities. Please try again.';
        this.setError(message);
        this.errorService.reportError({ message, details: error });

        // Restore previous state on error
        this.setExpenseState(expenseId, {
          activities: previousState.activities,
          status: previousState.status === 'success' ? 'success' : 'error',
          lastLoadedAt: previousState.lastLoadedAt,
          hasMore: previousState.hasMore
        });

        return previousState.activities;
      } finally {
        this.pendingExpenseLoads.delete(expenseId);
      }
    })();

    this.pendingExpenseLoads.set(expenseId, request);
    return request;
  }

  /**
   * Get activities signal for a specific group
   */
  activitiesForGroup(groupId: number): Signal<ActivityEntry[]> {
    return computed(() => this._groupActivityState()[groupId]?.activities ?? []);
  }

  /**
   * Get status signal for a specific group
   */
  statusForGroup(groupId: number): Signal<ActivityStatus> {
    return computed(() => this._groupActivityState()[groupId]?.status ?? 'idle');
  }

  /**
   * Get loading signal for a specific group
   */
  isLoadingForGroup(groupId: number): Signal<boolean> {
    return computed(() => this._groupActivityState()[groupId]?.status === 'loading');
  }

  /**
   * Get hasMore signal for a specific group
   */
  hasMoreForGroup(groupId: number): Signal<boolean> {
    return computed(() => this._groupActivityState()[groupId]?.hasMore ?? true);
  }

  /**
   * Get activities signal for a specific user
   */
  activitiesForUser(userId: number): Signal<ActivityEntry[]> {
    return computed(() => this._userActivityState()[userId]?.activities ?? []);
  }

  /**
   * Get status signal for a specific user
   */
  statusForUser(userId: number): Signal<ActivityStatus> {
    return computed(() => this._userActivityState()[userId]?.status ?? 'idle');
  }

  /**
   * Get loading signal for a specific user
   */
  isLoadingForUser(userId: number): Signal<boolean> {
    return computed(() => this._userActivityState()[userId]?.status === 'loading');
  }

  /**
   * Get hasMore signal for a specific user
   */
  hasMoreForUser(userId: number): Signal<boolean> {
    return computed(() => this._userActivityState()[userId]?.hasMore ?? true);
  }

  /**
   * Get activities signal for a specific expense
   */
  activitiesForExpense(expenseId: number): Signal<ActivityEntry[]> {
    return computed(() => this._expenseActivityState()[expenseId]?.activities ?? []);
  }

  /**
   * Get status signal for a specific expense
   */
  statusForExpense(expenseId: number): Signal<ActivityStatus> {
    return computed(() => this._expenseActivityState()[expenseId]?.status ?? 'idle');
  }

  /**
   * Get loading signal for a specific expense
   */
  isLoadingForExpense(expenseId: number): Signal<boolean> {
    return computed(() => this._expenseActivityState()[expenseId]?.status === 'loading');
  }

  /**
   * Get hasMore signal for a specific expense
   */
  hasMoreForExpense(expenseId: number): Signal<boolean> {
    return computed(() => this._expenseActivityState()[expenseId]?.hasMore ?? true);
  }

  /**
   * Filter activities by type
   */
  activitiesByType(type: string): Signal<ActivityEntry[]> {
    return computed(() => this.activities().filter((a) => a.type === type));
  }

  /**
   * Get activities sorted by timestamp (newest first)
   */
  readonly activitiesSorted: Signal<ActivityEntry[]> = computed(() => {
    return [...this.activities()].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  });

  /**
   * Clear the error state
   */
  clearError(): void {
    this.setError(null);
  }

  private getGroupState(groupId: number): ActivityState {
    const current = this._groupActivityState()[groupId];
    if (!current) {
      return {
        activities: [],
        status: 'idle',
        lastLoadedAt: null,
        hasMore: true
      };
    }
    return { ...current, activities: [...current.activities] };
  }

  private setGroupState(groupId: number, patch: Partial<ActivityState>): void {
    this._groupActivityState.update((current) => {
      const existing = current[groupId] ?? {
        activities: [],
        status: 'idle' as ActivityStatus,
        lastLoadedAt: null,
        hasMore: true
      };

      const next: ActivityState = {
        activities:
          patch.activities !== undefined ? [...patch.activities] : [...existing.activities],
        status: patch.status ?? existing.status,
        lastLoadedAt:
          patch.lastLoadedAt !== undefined ? patch.lastLoadedAt : existing.lastLoadedAt,
        hasMore: patch.hasMore !== undefined ? patch.hasMore : existing.hasMore
      };

      return { ...current, [groupId]: next };
    });

    // Clean up old entries if cache is too large
    this.cleanupOldestGroupCache();
  }

  private getUserState(userId: number): ActivityState {
    const current = this._userActivityState()[userId];
    if (!current) {
      return {
        activities: [],
        status: 'idle',
        lastLoadedAt: null,
        hasMore: true
      };
    }
    return { ...current, activities: [...current.activities] };
  }

  private setUserState(userId: number, patch: Partial<ActivityState>): void {
    this._userActivityState.update((current) => {
      const existing = current[userId] ?? {
        activities: [],
        status: 'idle' as ActivityStatus,
        lastLoadedAt: null,
        hasMore: true
      };

      const next: ActivityState = {
        activities:
          patch.activities !== undefined ? [...patch.activities] : [...existing.activities],
        status: patch.status ?? existing.status,
        lastLoadedAt:
          patch.lastLoadedAt !== undefined ? patch.lastLoadedAt : existing.lastLoadedAt,
        hasMore: patch.hasMore !== undefined ? patch.hasMore : existing.hasMore
      };

      return { ...current, [userId]: next };
    });

    // Clean up old entries if cache is too large
    this.cleanupOldestUserCache();
  }

  private getExpenseState(expenseId: number): ActivityState {
    const current = this._expenseActivityState()[expenseId];
    if (!current) {
      return {
        activities: [],
        status: 'idle',
        lastLoadedAt: null,
        hasMore: true
      };
    }
    return { ...current, activities: [...current.activities] };
  }

  private setExpenseState(expenseId: number, patch: Partial<ActivityState>): void {
    this._expenseActivityState.update((current) => {
      const existing = current[expenseId] ?? {
        activities: [],
        status: 'idle' as ActivityStatus,
        lastLoadedAt: null,
        hasMore: true
      };

      const next: ActivityState = {
        activities:
          patch.activities !== undefined ? [...patch.activities] : [...existing.activities],
        status: patch.status ?? existing.status,
        lastLoadedAt:
          patch.lastLoadedAt !== undefined ? patch.lastLoadedAt : existing.lastLoadedAt,
        hasMore: patch.hasMore !== undefined ? patch.hasMore : existing.hasMore
      };

      return { ...current, [expenseId]: next };
    });

    // Clean up old entries if cache is too large
    this.cleanupOldestExpenseCache();
  }

  private setGlobalState(patch: Partial<ActivityState>): void {
    this._globalState.update((current) => ({ ...current, ...patch }));
  }

  private setGlobalStatus(status: ActivityState['status']): void {
    this.setGlobalState({ status });
  }

  /**
   * Clean up oldest cached group activities when cache exceeds MAX_CACHED_GROUPS
   */
  private cleanupOldestGroupCache(): void {
    const currentState = this._groupActivityState();
    const groupIds = Object.keys(currentState).map(Number);

    if (groupIds.length > this.MAX_CACHED_GROUPS) {
      // Sort by lastLoadedAt (oldest first)
      const sorted = groupIds.sort((a, b) => {
        const aTime = currentState[a]?.lastLoadedAt || '';
        const bTime = currentState[b]?.lastLoadedAt || '';
        return aTime.localeCompare(bTime);
      });

      // Remove oldest entries until we're at the limit
      const toRemove = sorted.slice(0, groupIds.length - this.MAX_CACHED_GROUPS);

      this._groupActivityState.update((current) => {
        const next = { ...current };
        toRemove.forEach((id) => delete next[id]);
        return next;
      });
    }
  }

  /**
   * Clean up oldest cached user activities when cache exceeds MAX_CACHED_USERS
   */
  private cleanupOldestUserCache(): void {
    const currentState = this._userActivityState();
    const userIds = Object.keys(currentState).map(Number);

    if (userIds.length > this.MAX_CACHED_USERS) {
      // Sort by lastLoadedAt (oldest first)
      const sorted = userIds.sort((a, b) => {
        const aTime = currentState[a]?.lastLoadedAt || '';
        const bTime = currentState[b]?.lastLoadedAt || '';
        return aTime.localeCompare(bTime);
      });

      // Remove oldest entries until we're at the limit
      const toRemove = sorted.slice(0, userIds.length - this.MAX_CACHED_USERS);

      this._userActivityState.update((current) => {
        const next = { ...current };
        toRemove.forEach((id) => delete next[id]);
        return next;
      });
    }
  }

  /**
   * Clean up oldest cached expense activities when cache exceeds MAX_CACHED_EXPENSES
   */
  private cleanupOldestExpenseCache(): void {
    const currentState = this._expenseActivityState();
    const expenseIds = Object.keys(currentState).map(Number);

    if (expenseIds.length > this.MAX_CACHED_EXPENSES) {
      // Sort by lastLoadedAt (oldest first)
      const sorted = expenseIds.sort((a, b) => {
        const aTime = currentState[a]?.lastLoadedAt || '';
        const bTime = currentState[b]?.lastLoadedAt || '';
        return aTime.localeCompare(bTime);
      });

      // Remove oldest entries until we're at the limit
      const toRemove = sorted.slice(0, expenseIds.length - this.MAX_CACHED_EXPENSES);

      this._expenseActivityState.update((current) => {
        const next = { ...current };
        toRemove.forEach((id) => delete next[id]);
        return next;
      });
    }
  }

  private setError(message: string | null): void {
    this.activityError.set(message);
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
}
