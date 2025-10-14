import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from './api.service';
import { ErrorService } from './error.service';
import { Group, GroupMember } from '../types/api';

interface GroupState {
  groups: Group[];
  status: 'idle' | 'loading' | 'success' | 'error';
  lastLoadedAt: string | null;
}

interface CreateGroupRequest {
  name: string;
}

interface AddMembersRequest {
  userIds: number[];
}

interface GroupOperationResponse {
  message: string;
}

@Injectable({ providedIn: 'root' })
export class GroupService {
  private readonly api = inject(ApiService);
  private readonly errorService = inject(ErrorService);

  private readonly state = signal<GroupState>({
    groups: [],
    status: 'idle',
    lastLoadedAt: null
  });

  private readonly groupError = signal<string | null>(null);
  private readonly searchQuery = signal<string>('');

  // Public signals
  readonly groupState: Signal<GroupState> = this.state.asReadonly();
  readonly groups: Signal<Group[]> = computed(() => [...this.state().groups]);
  readonly isLoading: Signal<boolean> = computed(() => this.state().status === 'loading');
  readonly isIdle: Signal<boolean> = computed(() => this.state().status === 'idle');
  readonly isSuccess: Signal<boolean> = computed(() => this.state().status === 'success');
  readonly isError: Signal<boolean> = computed(() => this.state().status === 'error');
  readonly groupCount: Signal<number> = computed(() => this.state().groups.length);
  readonly hasGroups: Signal<boolean> = computed(() => this.state().groups.length > 0);
  readonly errorSignal: Signal<string | null> = this.groupError.asReadonly();
  readonly lastLoadedAt: Signal<string | null> = computed(() => this.state().lastLoadedAt);

  private pendingLoad: Promise<Group[]> | null = null;

  /**
   * Load all groups from the API
   * @returns Promise resolving to array of groups, or empty array on error
   */
  async loadGroups(): Promise<Group[]> {
    // Request deduplication: reuse pending load if one is in progress
    if (this.pendingLoad) {
      return this.pendingLoad;
    }
    this.setError(null);
    this.setStatus('loading');

    this.pendingLoad = (async () => {
      try {
        const groups = await firstValueFrom(
          this.api.get<Group[]>('/groups')
        );

        this.setState({
          groups,
          status: 'success',
          lastLoadedAt: new Date().toISOString()
        });

        this.errorService.clearError();
        return groups;
      } catch (error) {
        const message = this.extractErrorMessage(error) ?? 'Unable to load groups. Please try again.';
        this.setError(message);
        this.errorService.reportError({ message, details: error });
        this.setState({
          groups: [],
          status: 'error',
          lastLoadedAt: null
        });
        return [];
      } finally {
        this.pendingLoad = null;
      }
    })();

    return this.pendingLoad;
  }

  /**
   * Create a new group
   * @param name Group's name
   * @returns Promise resolving to created group, or null on error
   */
  async createGroup(name: string): Promise<Group | null> {
    if (!name || !name.trim()) {
      const message = 'Group name is required';
      this.setError(message);
      this.errorService.reportError({ message });
      return null;
    }

    this.setError(null);
    const previousStatus = this.state().status;
    this.setStatus('loading');

    try {
      const body: CreateGroupRequest = { name: name.trim() };
      const group = await firstValueFrom(
        this.api.post<Group>('/groups', body)
      );

      // Add the new group to the existing list
      this.setState({
        groups: [...this.state().groups, group],
        status: 'success',
        lastLoadedAt: new Date().toISOString()
      });

      this.errorService.clearError();
      return group;
    } catch (error) {
      const message = this.extractErrorMessage(error) ?? 'Unable to create group. Please try again.';
      this.setError(message);
      this.errorService.reportError({ message, details: error });
      
      // Restore previous status on error
      this.setStatus(previousStatus === 'success' ? 'success' : 'error');
      return null;
    }
  }

  /**
   * Delete a group by ID
   * @param id Group ID to delete
   * @returns Promise resolving to true on success, false on error
   */
  async deleteGroup(id: number): Promise<boolean> {
    if (!id || id <= 0) {
      const message = 'Invalid group ID';
      this.setError(message);
      this.errorService.reportError({ message });
      return false;
    }

    this.setError(null);
    const previousStatus = this.state().status;
    this.setStatus('loading');

    try {
      await firstValueFrom(
        this.api.delete<GroupOperationResponse>(`/groups/${id}`)
      );

      // Remove the deleted group from the list
      const updatedGroups = this.state().groups.filter(g => g.id !== id);
      this.setState({
        groups: updatedGroups,
        status: 'success',
        lastLoadedAt: new Date().toISOString()
      });

      this.errorService.clearError();
      return true;
    } catch (error) {
      const message = this.extractErrorMessage(error) ?? 'Unable to delete group. Please try again.';
      this.setError(message);
      this.errorService.reportError({ message, details: error });
      
      // Restore previous status on error
      this.setStatus(previousStatus === 'success' ? 'success' : 'error');
      return false;
    }
  }

  /**
   * Get a group with its members by ID
   * @param id Group ID to fetch
   * @returns Promise resolving to group with members, or null on error
   */
  async getGroupById(id: number): Promise<Group | null> {
    if (!id || id <= 0) {
      const message = 'Invalid group ID';
      this.setError(message);
      this.errorService.reportError({ message });
      return null;
    }

    this.setError(null);

    try {
      const group = await firstValueFrom(
        this.api.get<Group>(`/groups/${id}`)
      );

      // Update the group in the local state if it exists
      const existingIndex = this.state().groups.findIndex(g => g.id === id);
      if (existingIndex !== -1) {
        const updatedGroups = [...this.state().groups];
        updatedGroups[existingIndex] = group;
        this.setState({
          groups: updatedGroups,
          status: 'success',
          lastLoadedAt: new Date().toISOString()
        });
      }

      this.errorService.clearError();
      return group;
    } catch (error) {
      const message = this.extractErrorMessage(error) ?? 'Unable to load group details. Please try again.';
      this.setError(message);
      this.errorService.reportError({ message, details: error });
      return null;
    }
  }

  /**
   * Add members to a group
   * @param groupId Group ID
   * @param userIds Array of user IDs to add
   * @returns Promise resolving to true on success, false on error
   */
  async addMembers(groupId: number, userIds: number[]): Promise<boolean> {
    if (!groupId || groupId <= 0) {
      const message = 'Invalid group ID';
      this.setError(message);
      this.errorService.reportError({ message });
      return false;
    }

    if (!userIds || userIds.length === 0) {
      const message = 'At least one user ID is required';
      this.setError(message);
      this.errorService.reportError({ message });
      return false;
    }

    this.setError(null);

    try {
      const body: AddMembersRequest = { userIds };
      await firstValueFrom(
        this.api.post<GroupOperationResponse>(`/groups/${groupId}/members`, body)
      );

      // Reload the group to get updated members
      await this.getGroupById(groupId);

      this.errorService.clearError();
      return true;
    } catch (error) {
      const message = this.extractErrorMessage(error) ?? 'Unable to add members to group. Please try again.';
      this.setError(message);
      this.errorService.reportError({ message, details: error });
      return false;
    }
  }

  /**
   * Remove a member from a group
   * @param groupId Group ID
   * @param userId User ID to remove
   * @returns Promise resolving to true on success, false on error
   */
  async removeMember(groupId: number, userId: number): Promise<boolean> {
    if (!groupId || groupId <= 0) {
      const message = 'Invalid group ID';
      this.setError(message);
      this.errorService.reportError({ message });
      return false;
    }

    if (!userId || userId <= 0) {
      const message = 'Invalid user ID';
      this.setError(message);
      this.errorService.reportError({ message });
      return false;
    }

    this.setError(null);

    try {
      await firstValueFrom(
        this.api.delete<GroupOperationResponse>(`/groups/${groupId}/members/${userId}`)
      );

      // Reload the group to get updated members
      await this.getGroupById(groupId);

      this.errorService.clearError();
      return true;
    } catch (error) {
      const message = this.extractErrorMessage(error) ?? 'Unable to remove member from group. Please try again.';
      this.setError(message);
      this.errorService.reportError({ message, details: error });
      return false;
    }
  }

  /**
   * Find a group by ID in the current state
   * Note: Does not make an API call, only searches local state
   * @param id Group ID to find
   * @returns Group if found, undefined otherwise
   */
  findGroupById(id: number): Group | undefined {
    return this.state().groups.find(g => g.id === id);
  }

  /**
   * Get groups sorted by name
   * @returns Computed signal of groups sorted alphabetically by name
   */
  readonly groupsSortedByName: Signal<Group[]> = computed(() => {
    const groups = this.state().groups;
    return [...groups].sort((a, b) => 
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
  });

  /**
   * Filtered groups based on search query
   * @returns Computed signal that filters groups based on the current search query
   */
  readonly filteredGroups: Signal<Group[]> = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const groups = this.state().groups;
    if (!query) {
      return [...groups];
    }
    return groups.filter(g => 
      g.name.toLowerCase().includes(query)
    );
  });

  /**
   * Set search query for filtering groups
   * @param query Search query string
   */
  setSearchQuery(query: string): void {
    this.searchQuery.set(query);
  }

  /**
   * Get current search query
   * @returns Current search query as a signal
   */
  getSearchQuery(): Signal<string> {
    return this.searchQuery.asReadonly();
  }

  /**
   * Clear the error state
   */
  clearError(): void {
    this.setError(null);
  }

  /**
   * Refresh groups data (alias for loadGroups)
   */
  async refresh(): Promise<Group[]> {
    return this.loadGroups();
  }

  private setState(patch: Partial<GroupState>): void {
    this.state.update((current) => ({ ...current, ...patch }));
  }

  private setStatus(status: GroupState['status']): void {
    this.setState({ status });
  }

  private setError(message: string | null): void {
    this.groupError.set(message);
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
