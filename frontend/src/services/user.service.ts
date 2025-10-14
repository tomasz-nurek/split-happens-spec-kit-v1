import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from './api.service';
import { ErrorService } from './error.service';
import { User } from '../types/api';

interface UserState {
  users: User[];
  status: 'idle' | 'loading' | 'success' | 'error';
  lastLoadedAt: string | null;
}

interface CreateUserRequest {
  name: string;
}

interface DeleteUserResponse {
  message: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly api = inject(ApiService);
  private readonly errorService = inject(ErrorService);

  private readonly state = signal<UserState>({
    users: [],
    status: 'idle',
    lastLoadedAt: null
  });

  private readonly userError = signal<string | null>(null);

  // Public signals
  readonly userState: Signal<UserState> = this.state.asReadonly();
  readonly users: Signal<User[]> = computed(() => this.state().users);
  readonly isLoading: Signal<boolean> = computed(() => this.state().status === 'loading');
  readonly isIdle: Signal<boolean> = computed(() => this.state().status === 'idle');
  readonly isSuccess: Signal<boolean> = computed(() => this.state().status === 'success');
  readonly isError: Signal<boolean> = computed(() => this.state().status === 'error');
  readonly userCount: Signal<number> = computed(() => this.state().users.length);
  readonly hasUsers: Signal<boolean> = computed(() => this.state().users.length > 0);
  readonly errorSignal: Signal<string | null> = this.userError.asReadonly();
  readonly lastLoadedAt: Signal<string | null> = computed(() => this.state().lastLoadedAt);

  /**
   * Load all users from the API
   * @returns Promise resolving to array of users, or empty array on error
   */
  async loadUsers(): Promise<User[]> {
    this.setError(null);
    this.setStatus('loading');

    try {
      const users = await firstValueFrom(
        this.api.get<User[]>('/users')
      );

      this.setState({
        users,
        status: 'success',
        lastLoadedAt: new Date().toISOString()
      });

      this.errorService.clearError();
      return users;
    } catch (error) {
      const message = this.extractErrorMessage(error) ?? 'Unable to load users. Please try again.';
      this.setError(message);
      this.errorService.reportError({ message, details: error });
      this.setState({
        users: [],
        status: 'error',
        lastLoadedAt: null
      });
      return [];
    }
  }

  /**
   * Create a new user
   * @param name User's name
   * @returns Promise resolving to created user, or null on error
   */
  async createUser(name: string): Promise<User | null> {
    if (!name || !name.trim()) {
      const message = 'User name is required';
      this.setError(message);
      this.errorService.reportError({ message });
      return null;
    }

    this.setError(null);
    const previousStatus = this.state().status;
    this.setStatus('loading');

    try {
      const body: CreateUserRequest = { name: name.trim() };
      const user = await firstValueFrom(
        this.api.post<User>('/users', body)
      );

      // Add the new user to the existing list
      this.setState({
        users: [...this.state().users, user],
        status: 'success',
        lastLoadedAt: new Date().toISOString()
      });

      this.errorService.clearError();
      return user;
    } catch (error) {
      const message = this.extractErrorMessage(error) ?? 'Unable to create user. Please try again.';
      this.setError(message);
      this.errorService.reportError({ message, details: error });
      
      // Restore previous status on error
      this.setStatus(previousStatus === 'success' ? 'success' : 'error');
      return null;
    }
  }

  /**
   * Delete a user by ID
   * @param id User ID to delete
   * @returns Promise resolving to true on success, false on error
   */
  async deleteUser(id: number): Promise<boolean> {
    if (!id || id <= 0) {
      const message = 'Invalid user ID';
      this.setError(message);
      this.errorService.reportError({ message });
      return false;
    }

    this.setError(null);
    const previousStatus = this.state().status;
    this.setStatus('loading');

    try {
      await firstValueFrom(
        this.api.delete<DeleteUserResponse>(`/users/${id}`)
      );

      // Remove the deleted user from the list
      const updatedUsers = this.state().users.filter(u => u.id !== id);
      this.setState({
        users: updatedUsers,
        status: 'success',
        lastLoadedAt: new Date().toISOString()
      });

      this.errorService.clearError();
      return true;
    } catch (error) {
      const message = this.extractErrorMessage(error) ?? 'Unable to delete user. Please try again.';
      this.setError(message);
      this.errorService.reportError({ message, details: error });
      
      // Restore previous status on error
      this.setStatus(previousStatus === 'success' ? 'success' : 'error');
      return false;
    }
  }

  /**
   * Find a user by ID in the current state
   * Note: Does not make an API call, only searches local state
   * @param id User ID to find
   * @returns User if found, undefined otherwise
   */
  findUserById(id: number): User | undefined {
    return this.state().users.find(u => u.id === id);
  }

  /**
   * Get users sorted by name
   * @returns Computed signal of users sorted alphabetically by name
   */
  readonly usersSortedByName: Signal<User[]> = computed(() => {
    return [...this.state().users].sort((a, b) => 
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
  });

  /**
   * Search users by name (case-insensitive)
   * @param query Search query
   * @returns Computed signal that filters users based on the query
   */
  searchUsers(query: string): Signal<User[]> {
    const normalizedQuery = query.toLowerCase().trim();
    return computed(() => {
      if (!normalizedQuery) {
        return this.state().users;
      }
      return this.state().users.filter(u => 
        u.name.toLowerCase().includes(normalizedQuery)
      );
    });
  }

  /**
   * Clear the error state
   */
  clearError(): void {
    this.setError(null);
  }

  /**
   * Refresh users data (alias for loadUsers)
   */
  async refresh(): Promise<User[]> {
    return this.loadUsers();
  }

  private setState(patch: Partial<UserState>): void {
    this.state.update((current) => ({ ...current, ...patch }));
  }

  private setStatus(status: UserState['status']): void {
    this.setState({ status });
  }

  private setError(message: string | null): void {
    this.userError.set(message);
  }

  private extractErrorMessage(error: unknown): string | null {
    if (error instanceof HttpErrorResponse) {
      if (typeof error.error === 'string') {
        return error.error;
      }

      if (error.error && typeof error.error === 'object' && 'error' in error.error) {
        const candidate = (error.error as Record<string, unknown>)['error'];
        return typeof candidate === 'string' ? candidate : null;
      }

      if (error.message) {
        return error.message;
      }

      return null;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return null;
  }
}
