import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from './api.service';
import { ErrorService } from './error.service';
import { Expense } from '../types/api';

type ExpenseStatus = 'idle' | 'loading' | 'success' | 'error';

interface ExpenseGroupState {
  expenses: Expense[];
  status: ExpenseStatus;
  lastLoadedAt: string | null;
}

export interface CreateExpensePayload {
  amount: number;
  description: string;
  paidBy: number;
  participantIds: number[];
}

export interface UpdateExpensePayload {
  amount?: number;
  description?: string;
}

interface DeleteExpenseResponse {
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private readonly api = inject(ApiService);
  private readonly errorService = inject(ErrorService);

  // LRU cache configuration to prevent unbounded memory growth
  private readonly MAX_CACHED_GROUPS = 50;
  private readonly recentlyAccessedGroups: number[] = [];

  private readonly state = signal<Record<number, ExpenseGroupState>>({});
  private readonly expenseError = signal<string | null>(null);

  private readonly pendingLoads = new Map<number, Promise<Expense[]>>();
  private readonly expensesSignals = new Map<number, Signal<Expense[]>>();
  private readonly statusSignals = new Map<number, Signal<ExpenseStatus>>();
  private readonly loadingSignals = new Map<number, Signal<boolean>>();
  private readonly successSignals = new Map<number, Signal<boolean>>();
  private readonly errorSignals = new Map<number, Signal<boolean>>();
  private readonly hasExpensesSignals = new Map<number, Signal<boolean>>();
  private readonly totalAmountSignals = new Map<number, Signal<number>>();
  private readonly lastLoadedSignals = new Map<number, Signal<string | null>>();
  private readonly countSignals = new Map<number, Signal<number>>();

  readonly expenseState: Signal<Record<number, ExpenseGroupState>> = this.state.asReadonly();
  readonly errorSignal: Signal<string | null> = this.expenseError.asReadonly();
  readonly groupIds: Signal<number[]> = computed(() =>
    Object.keys(this.state())
      .map((key) => Number(key))
      .sort((a, b) => a - b)
  );
  readonly allExpenses: Signal<Expense[]> = computed(() => {
    const snapshot = this.state();
    return Object.values(snapshot).flatMap((entry) => entry.expenses);
  });

  /**
   * Load expenses for a given group. Subsequent concurrent calls reuse the same underlying request.
   */
  async loadExpenses(groupId: number): Promise<Expense[]> {
    if (!this.isValidId(groupId)) {
      const message = 'Invalid group ID';
      this.setError(message);
      this.errorService.reportError({ message });
      return [];
    }

    if (this.pendingLoads.has(groupId)) {
      return this.pendingLoads.get(groupId)!;
    }

    this.setError(null);
    const previousState = this.getGroupState(groupId);
    this.setGroupState(groupId, { status: 'loading' });

    const request = (async () => {
      try {
        const expenses = await firstValueFrom(
          this.api.get<Expense[]>(`/groups/${groupId}/expenses`)
        );

        this.setGroupState(groupId, {
          expenses: [...expenses],
          status: 'success',
          lastLoadedAt: new Date().toISOString()
        });

        this.errorService.clearError();
        return expenses;
      } catch (error) {
        const message =
          this.extractErrorMessage(error) ?? 'Unable to load expenses. Please try again.';
        this.setError(message);
        this.errorService.reportError({ message, details: error });

        // Restore previous state to avoid clearing already-visible data on transient failures
        this.setGroupState(groupId, {
          expenses: previousState.expenses,
          status: previousState.status === 'success' ? 'success' : 'error',
          lastLoadedAt: previousState.lastLoadedAt
        });

        return previousState.expenses;
      } finally {
        this.pendingLoads.delete(groupId);
      }
    })();

    this.pendingLoads.set(groupId, request);
    return request;
  }

  async createExpense(groupId: number, payload: CreateExpensePayload): Promise<Expense | null> {
    if (!this.isValidId(groupId)) {
      const message = 'Invalid group ID';
      this.setError(message);
      this.errorService.reportError({ message });
      return null;
    }

    const validationError = this.validateCreatePayload(payload);
    if (validationError) {
      this.setError(validationError);
      this.errorService.reportError({ message: validationError });
      return null;
    }

    const trimmedDescription = payload.description.trim();
    const requestBody: CreateExpensePayload = {
      amount: Number(payload.amount),
      description: trimmedDescription,
      paidBy: payload.paidBy,
      participantIds: [...payload.participantIds]
    };

    this.setError(null);
    const previousState = this.getGroupState(groupId);
    this.setGroupState(groupId, { status: 'loading' });

    try {
      const expense = await firstValueFrom(
        this.api.post<Expense>(`/groups/${groupId}/expenses`, requestBody)
      );

      const nextExpenses = [expense, ...previousState.expenses.filter((e) => e.id !== expense.id)];
      this.setGroupState(groupId, {
        expenses: nextExpenses,
        status: 'success',
        lastLoadedAt: new Date().toISOString()
      });

      this.errorService.clearError();
      return expense;
    } catch (error) {
      const message =
        this.extractErrorMessage(error) ?? 'Unable to create expense. Please try again.';
      this.setError(message);
      this.errorService.reportError({ message, details: error });
      this.setGroupState(groupId, {
        expenses: previousState.expenses,
        status: previousState.status,
        lastLoadedAt: previousState.lastLoadedAt
      });
      return null;
    }
  }

  async updateExpense(
    expenseId: number,
    groupId: number,
    payload: UpdateExpensePayload
  ): Promise<Expense | null> {
    if (!this.isValidId(expenseId)) {
      const message = 'Invalid expense ID';
      this.setError(message);
      this.errorService.reportError({ message });
      return null;
    }

    if (!this.isValidId(groupId)) {
      const message = 'Invalid group ID';
      this.setError(message);
      this.errorService.reportError({ message });
      return null;
    }

    if (!payload || (payload.amount === undefined && payload.description === undefined)) {
      const message = 'No updates provided';
      this.setError(message);
      this.errorService.reportError({ message });
      return null;
    }

    const body: UpdateExpensePayload = {};
    if (payload.amount !== undefined) {
      body.amount = Number(payload.amount);
      if (Number.isNaN(body.amount) || body.amount <= 0) {
        const message = 'Amount must be greater than zero';
        this.setError(message);
        this.errorService.reportError({ message });
        return null;
      }
    }

    if (payload.description !== undefined) {
      const trimmed = payload.description.trim();
      if (!trimmed) {
        const message = 'Description is required';
        this.setError(message);
        this.errorService.reportError({ message });
        return null;
      }
      body.description = trimmed;
    }

    this.setError(null);
    const previousState = this.getGroupState(groupId);
    this.setGroupState(groupId, { status: 'loading' });

    try {
      const updatedExpense = await firstValueFrom(
        this.api.patch<Expense>(`/expenses/${expenseId}`, body)
      );

      const nextExpenses = previousState.expenses.map((expense) =>
        expense.id === updatedExpense.id ? updatedExpense : expense
      );

      this.setGroupState(groupId, {
        expenses: nextExpenses,
        status: 'success',
        lastLoadedAt: new Date().toISOString()
      });

      this.errorService.clearError();
      return updatedExpense;
    } catch (error) {
      const message =
        this.extractErrorMessage(error) ?? 'Unable to update expense. Please try again.';
      this.setError(message);
      this.errorService.reportError({ message, details: error });
      this.setGroupState(groupId, {
        expenses: previousState.expenses,
        status: previousState.status,
        lastLoadedAt: previousState.lastLoadedAt
      });
      return null;
    }
  }

  async deleteExpense(expenseId: number, groupId: number): Promise<boolean> {
    if (!this.isValidId(expenseId)) {
      const message = 'Invalid expense ID';
      this.setError(message);
      this.errorService.reportError({ message });
      return false;
    }

    if (!this.isValidId(groupId)) {
      const message = 'Invalid group ID';
      this.setError(message);
      this.errorService.reportError({ message });
      return false;
    }

    this.setError(null);
    const previousState = this.getGroupState(groupId);
    this.setGroupState(groupId, { status: 'loading' });

    try {
      await firstValueFrom(this.api.delete<DeleteExpenseResponse>(`/expenses/${expenseId}`));

      const nextExpenses = previousState.expenses.filter((expense) => expense.id !== expenseId);
      this.setGroupState(groupId, {
        expenses: nextExpenses,
        status: 'success',
        lastLoadedAt: new Date().toISOString()
      });

      this.errorService.clearError();
      return true;
    } catch (error) {
      const message =
        this.extractErrorMessage(error) ?? 'Unable to delete expense. Please try again.';
      this.setError(message);
      this.errorService.reportError({ message, details: error });
      this.setGroupState(groupId, {
        expenses: previousState.expenses,
        status: previousState.status,
        lastLoadedAt: previousState.lastLoadedAt
      });
      return false;
    }
  }

  async refresh(groupId: number): Promise<Expense[]> {
    return this.loadExpenses(groupId);
  }

  expensesForGroup(groupId: number): Signal<Expense[]> {
    return this.getOrCreateGroupSignal(this.expensesSignals, groupId, (id) =>
      computed(() => this.state()[id]?.expenses ?? [])
    );
  }

  statusForGroup(groupId: number): Signal<ExpenseStatus> {
    return this.getOrCreateGroupSignal(this.statusSignals, groupId, (id) =>
      computed(() => this.state()[id]?.status ?? 'idle')
    );
  }

  isLoadingForGroup(groupId: number): Signal<boolean> {
    return this.getOrCreateGroupSignal(this.loadingSignals, groupId, (id) =>
      computed(() => this.state()[id]?.status === 'loading')
    );
  }

  isSuccessForGroup(groupId: number): Signal<boolean> {
    return this.getOrCreateGroupSignal(this.successSignals, groupId, (id) =>
      computed(() => this.state()[id]?.status === 'success')
    );
  }

  isErrorForGroup(groupId: number): Signal<boolean> {
    return this.getOrCreateGroupSignal(this.errorSignals, groupId, (id) =>
      computed(() => this.state()[id]?.status === 'error')
    );
  }

  hasExpensesForGroup(groupId: number): Signal<boolean> {
    return this.getOrCreateGroupSignal(this.hasExpensesSignals, groupId, (id) =>
      computed(() => (this.state()[id]?.expenses.length ?? 0) > 0)
    );
  }

  totalAmountForGroup(groupId: number): Signal<number> {
    return this.getOrCreateGroupSignal(this.totalAmountSignals, groupId, (id) =>
      computed(() => {
        const entry = this.state()[id];
        if (!entry) {
          return 0;
        }
        return entry.expenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);
      })
    );
  }

  lastLoadedAtForGroup(groupId: number): Signal<string | null> {
    return this.getOrCreateGroupSignal(this.lastLoadedSignals, groupId, (id) =>
      computed(() => this.state()[id]?.lastLoadedAt ?? null)
    );
  }

  expenseCountForGroup(groupId: number): Signal<number> {
    return this.getOrCreateGroupSignal(this.countSignals, groupId, (id) =>
      computed(() => this.state()[id]?.expenses.length ?? 0)
    );
  }

  findExpenseById(expenseId: number, groupId?: number): Expense | undefined {
    if (!this.isValidId(expenseId)) {
      return undefined;
    }

    const snapshot = this.state();

    if (groupId !== undefined) {
      const entry = snapshot[groupId];
      return entry?.expenses.find((expense) => expense.id === expenseId);
    }

    for (const entry of Object.values(snapshot)) {
      const match = entry.expenses.find((expense) => expense.id === expenseId);
      if (match) {
        return match;
      }
    }

    return undefined;
  }

  clearError(): void {
    this.setError(null);
  }

  private getGroupState(groupId: number): ExpenseGroupState {
    const current = this.state()[groupId];
    if (!current) {
      return {
        expenses: [],
        status: 'idle',
        lastLoadedAt: null
      };
    }

    return {
      expenses: [...current.expenses],
      status: current.status,
      lastLoadedAt: current.lastLoadedAt
    };
  }

  private setGroupState(groupId: number, patch: Partial<ExpenseGroupState>): void {
    this.state.update((current) => {
      const existing = current[groupId] ?? {
        expenses: [],
        status: 'idle' as ExpenseStatus,
        lastLoadedAt: null
      };

      const next: ExpenseGroupState = {
        expenses: patch.expenses !== undefined ? [...patch.expenses] : [...existing.expenses],
        status: patch.status ?? existing.status,
        lastLoadedAt: patch.lastLoadedAt !== undefined ? patch.lastLoadedAt : existing.lastLoadedAt
      };

      return { ...current, [groupId]: next };
    });

    // Mark group as recently accessed and cleanup old groups if needed
    this.markGroupAccessed(groupId);
    this.cleanupOldGroups();
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

  private setError(message: string | null): void {
    this.expenseError.set(message);
  }

  private isValidId(value: number): boolean {
    return Number.isInteger(value) && value > 0;
  }

  private validateCreatePayload(payload: CreateExpensePayload): string | null {
    if (!payload) {
      return 'Expense details are required';
    }

    const amount = Number(payload.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      return 'Amount must be greater than zero';
    }

    const description = payload.description?.trim();
    if (!description) {
      return 'Description is required';
    }

    if (!this.isValidId(payload.paidBy)) {
      return 'Valid payer is required';
    }

    if (!Array.isArray(payload.participantIds) || payload.participantIds.length === 0) {
      return 'At least one participant is required';
    }

    const invalidParticipant = payload.participantIds.some((id) => !this.isValidId(id));
    if (invalidParticipant) {
      return 'Participants must have valid IDs';
    }

    return null;
  }

  private extractErrorMessage(error: unknown): string | null {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
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
        if (typeof messageField === 'string' && error.status < 500) {
          const trimmed = messageField.trim();
          if (trimmed) {
            return trimmed;
          }
        }
      }

      if (error.status >= 500) {
        return null;
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
    // Remove if already exists
    const index = this.recentlyAccessedGroups.indexOf(groupId);
    if (index > -1) {
      this.recentlyAccessedGroups.splice(index, 1);
    }
    // Add to end (most recently accessed)
    this.recentlyAccessedGroups.push(groupId);
  }

  /**
   * Clean up least recently used groups when cache limit is exceeded
   */
  private cleanupOldGroups(): void {
    if (this.recentlyAccessedGroups.length <= this.MAX_CACHED_GROUPS) {
      return;
    }

    // Calculate how many groups to remove
    const groupsToRemove = this.recentlyAccessedGroups.length - this.MAX_CACHED_GROUPS;
    const groupIdsToRemove = this.recentlyAccessedGroups.splice(0, groupsToRemove);

    if (groupIdsToRemove.length === 0) {
      return;
    }

    // Remove from state
    this.state.update((current) => {
      const next = { ...current };
      for (const groupId of groupIdsToRemove) {
        delete next[groupId];
      }
      return next;
    });

    // Clean up signal caches
    for (const groupId of groupIdsToRemove) {
      this.expensesSignals.delete(groupId);
      this.statusSignals.delete(groupId);
      this.loadingSignals.delete(groupId);
      this.successSignals.delete(groupId);
      this.errorSignals.delete(groupId);
      this.hasExpensesSignals.delete(groupId);
      this.totalAmountSignals.delete(groupId);
      this.lastLoadedSignals.delete(groupId);
      this.countSignals.delete(groupId);
    }
  }
}
