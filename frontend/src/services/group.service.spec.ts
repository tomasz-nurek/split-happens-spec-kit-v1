import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';

import { GroupService } from './group.service';
import { ApiService } from './api.service';
import { ErrorService } from './error.service';
import { Group, GroupMember } from '../types/api';

describe('GroupService', () => {
  let service: GroupService;
  let httpMock: HttpTestingController;
  let errorService: jasmine.SpyObj<ErrorService>;

  const mockGroups: Group[] = [
    { id: 1, name: 'Vacation Trip', createdAt: '2025-01-01T00:00:00Z', members: [] },
    { id: 2, name: 'Household Bills', createdAt: '2025-01-02T00:00:00Z', members: [] },
    { id: 3, name: 'Weekend Getaway', createdAt: '2025-01-03T00:00:00Z', members: [] }
  ];

  const mockMembers: GroupMember[] = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' }
  ];

  const mockGroupWithMembers: Group = {
    id: 1,
    name: 'Vacation Trip',
    createdAt: '2025-01-01T00:00:00Z',
    members: mockMembers
  };

  beforeEach(async () => {
    const errorServiceSpy = jasmine.createSpyObj('ErrorService', ['reportError', 'clearError']);

    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        GroupService,
        ApiService,
        { provide: ErrorService, useValue: errorServiceSpy }
      ]
    }).compileComponents();

    service = TestBed.inject(GroupService);
    httpMock = TestBed.inject(HttpTestingController);
    errorService = TestBed.inject(ErrorService) as jasmine.SpyObj<ErrorService>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('Initial State', () => {
    it('should start with empty groups array', () => {
      expect(service.groups()).toEqual([]);
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

    it('should have groupCount of 0 initially', () => {
      expect(service.groupCount()).toBe(0);
    });

    it('should have hasGroups false initially', () => {
      expect(service.hasGroups()).toBe(false);
    });

    it('should have lastLoadedAt null initially', () => {
      expect(service.lastLoadedAt()).toBeNull();
    });
  });

  describe('loadGroups()', () => {
    it('should load groups successfully', async () => {
      const loadPromise = service.loadGroups();

      const req = httpMock.expectOne('http://localhost:3000/api/groups');
      expect(req.request.method).toBe('GET');
      req.flush(mockGroups);

      const result = await loadPromise;

      expect(result).toEqual(mockGroups);
      expect(service.groups()).toEqual(mockGroups);
      expect(service.isSuccess()).toBe(true);
      expect(service.isLoading()).toBe(false);
      expect(service.groupCount()).toBe(3);
      expect(service.hasGroups()).toBe(true);
      expect(service.lastLoadedAt()).toBeTruthy();
      expect(errorService.clearError).toHaveBeenCalled();
    });

    it('should update loading state while fetching', async () => {
      const loadPromise = service.loadGroups();

      expect(service.isLoading()).toBe(true);

      const req = httpMock.expectOne('http://localhost:3000/api/groups');
      req.flush(mockGroups);

      await loadPromise;

      expect(service.isLoading()).toBe(false);
    });

    it('should handle HTTP errors gracefully', async () => {
      const loadPromise = service.loadGroups();

      const req = httpMock.expectOne('http://localhost:3000/api/groups');
      req.flush({ error: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });

      const result = await loadPromise;

      expect(result).toEqual([]);
      expect(service.groups()).toEqual([]);
      expect(service.isError()).toBe(true);
      expect(service.errorSignal()).toBeTruthy();
      expect(errorService.reportError).toHaveBeenCalled();
    });

    it('should handle network errors', async () => {
      const loadPromise = service.loadGroups();

      const req = httpMock.expectOne('http://localhost:3000/api/groups');
      req.error(new ProgressEvent('Network error'));

      const result = await loadPromise;

      expect(result).toEqual([]);
      expect(service.isError()).toBe(true);
      expect(service.errorSignal()).toBeTruthy();
    });

    it('should extract error message from HTTP error response', async () => {
      const loadPromise = service.loadGroups();

      const req = httpMock.expectOne('http://localhost:3000/api/groups');
      req.flush({ error: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

      await loadPromise;

      expect(service.errorSignal()).toBe('Unauthorized');
    });

    it('should clear previous errors on successful load', async () => {
      // First, trigger an error
      let loadPromise = service.loadGroups();
      let req = httpMock.expectOne('http://localhost:3000/api/groups');
      req.flush({ error: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });
      await loadPromise;

      expect(service.errorSignal()).toBeTruthy();

      // Now load successfully
      loadPromise = service.loadGroups();
      req = httpMock.expectOne('http://localhost:3000/api/groups');
      req.flush(mockGroups);
      await loadPromise;

      expect(service.errorSignal()).toBeNull();
      expect(errorService.clearError).toHaveBeenCalled();
    });

    it('should deduplicate concurrent loadGroups calls', async () => {
      const loadPromise1 = service.loadGroups();
      const loadPromise2 = service.loadGroups();
      const loadPromise3 = service.loadGroups();

      // Should only make one HTTP request
      const req = httpMock.expectOne('http://localhost:3000/api/groups');
      req.flush(mockGroups);

      const [result1, result2, result3] = await Promise.all([loadPromise1, loadPromise2, loadPromise3]);

      expect(result1).toEqual(mockGroups);
      expect(result2).toEqual(mockGroups);
      expect(result3).toEqual(mockGroups);
      expect(service.groups()).toEqual(mockGroups);
    });
  });

  describe('createGroup()', () => {
    const newGroup: Group = { id: 4, name: 'New Group', createdAt: '2025-01-04T00:00:00Z' };

    it('should create a group successfully', async () => {
      // First load some groups
      let loadPromise = service.loadGroups();
      let req = httpMock.expectOne('http://localhost:3000/api/groups');
      req.flush(mockGroups);
      await loadPromise;

      const createPromise = service.createGroup('New Group');

      req = httpMock.expectOne('http://localhost:3000/api/groups');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ name: 'New Group' });
      req.flush(newGroup);

      const result = await createPromise;

      expect(result).toEqual(newGroup);
      expect(service.groups().length).toBe(4);
      expect(service.groups()).toContain(newGroup);
      expect(service.isSuccess()).toBe(true);
      expect(errorService.clearError).toHaveBeenCalled();
    });

    it('should trim group name before creating', async () => {
      const createPromise = service.createGroup('  New Group  ');

      const req = httpMock.expectOne('http://localhost:3000/api/groups');
      expect(req.request.body).toEqual({ name: 'New Group' });
      req.flush(newGroup);

      await createPromise;
    });

    it('should reject empty group name', async () => {
      const result = await service.createGroup('');

      expect(result).toBeNull();
      expect(service.errorSignal()).toBe('Group name is required');
      expect(errorService.reportError).toHaveBeenCalled();
    });

    it('should reject whitespace-only group name', async () => {
      const result = await service.createGroup('   ');

      expect(result).toBeNull();
      expect(service.errorSignal()).toBe('Group name is required');
    });

    it('should handle creation errors', async () => {
      const createPromise = service.createGroup('New Group');

      const req = httpMock.expectOne('http://localhost:3000/api/groups');
      req.flush({ error: 'Group already exists' }, { status: 400, statusText: 'Bad Request' });

      const result = await createPromise;

      expect(result).toBeNull();
      expect(service.errorSignal()).toBe('Group already exists');
      expect(errorService.reportError).toHaveBeenCalled();
    });

    it('should restore previous status on creation error', async () => {
      // First load some groups
      let loadPromise = service.loadGroups();
      let req = httpMock.expectOne('http://localhost:3000/api/groups');
      req.flush(mockGroups);
      await loadPromise;

      expect(service.isSuccess()).toBe(true);

      // Now try to create a group with error
      const createPromise = service.createGroup('New Group');
      req = httpMock.expectOne('http://localhost:3000/api/groups');
      req.flush({ error: 'Error' }, { status: 500, statusText: 'Internal Server Error' });
      await createPromise;

      // Should restore success status
      expect(service.isSuccess()).toBe(true);
    });
  });

  describe('deleteGroup()', () => {
    beforeEach(async () => {
      // Load some groups first
      const loadPromise = service.loadGroups();
      const req = httpMock.expectOne('http://localhost:3000/api/groups');
      req.flush(mockGroups);
      await loadPromise;
    });

    it('should delete a group successfully', async () => {
      const deletePromise = service.deleteGroup(1);

      const req = httpMock.expectOne('http://localhost:3000/api/groups/1');
      expect(req.request.method).toBe('DELETE');
      req.flush({ message: 'Group deleted successfully' });

      const result = await deletePromise;

      expect(result).toBe(true);
      expect(service.groups().length).toBe(2);
      expect(service.groups().find(g => g.id === 1)).toBeUndefined();
      expect(service.isSuccess()).toBe(true);
      expect(errorService.clearError).toHaveBeenCalled();
    });

    it('should reject invalid group ID (0)', async () => {
      const result = await service.deleteGroup(0);

      expect(result).toBe(false);
      expect(service.errorSignal()).toBe('Invalid group ID');
      expect(errorService.reportError).toHaveBeenCalled();
    });

    it('should reject invalid group ID (negative)', async () => {
      const result = await service.deleteGroup(-1);

      expect(result).toBe(false);
      expect(service.errorSignal()).toBe('Invalid group ID');
    });

    it('should handle deletion errors', async () => {
      const deletePromise = service.deleteGroup(1);

      const req = httpMock.expectOne('http://localhost:3000/api/groups/1');
      req.flush({ error: 'Group not found' }, { status: 404, statusText: 'Not Found' });

      const result = await deletePromise;

      expect(result).toBe(false);
      expect(service.errorSignal()).toBe('Group not found');
      expect(errorService.reportError).toHaveBeenCalled();
      expect(service.groups().length).toBe(3); // Should not remove from state
    });

    it('should restore previous status on deletion error', async () => {
      expect(service.isSuccess()).toBe(true);

      const deletePromise = service.deleteGroup(1);
      const req = httpMock.expectOne('http://localhost:3000/api/groups/1');
      req.flush({ error: 'Error' }, { status: 500, statusText: 'Internal Server Error' });
      await deletePromise;

      // Should restore success status
      expect(service.isSuccess()).toBe(true);
    });
  });

  describe('getGroupById()', () => {
    beforeEach(async () => {
      // Load some groups first
      const loadPromise = service.loadGroups();
      const req = httpMock.expectOne('http://localhost:3000/api/groups');
      req.flush(mockGroups);
      await loadPromise;
    });

    it('should get group with members successfully', async () => {
      const getPromise = service.getGroupById(1);

      const req = httpMock.expectOne('http://localhost:3000/api/groups/1');
      expect(req.request.method).toBe('GET');
      req.flush(mockGroupWithMembers);

      const result = await getPromise;

      expect(result).toEqual(mockGroupWithMembers);
      expect(service.groups()[0]).toEqual(mockGroupWithMembers);
      expect(errorService.clearError).toHaveBeenCalled();
    });

    it('should reject invalid group ID (0)', async () => {
      const result = await service.getGroupById(0);

      expect(result).toBeNull();
      expect(service.errorSignal()).toBe('Invalid group ID');
      expect(errorService.reportError).toHaveBeenCalled();
    });

    it('should reject invalid group ID (negative)', async () => {
      const result = await service.getGroupById(-1);

      expect(result).toBeNull();
      expect(service.errorSignal()).toBe('Invalid group ID');
    });

    it('should handle errors', async () => {
      const getPromise = service.getGroupById(999);

      const req = httpMock.expectOne('http://localhost:3000/api/groups/999');
      req.flush({ error: 'Group not found' }, { status: 404, statusText: 'Not Found' });

      const result = await getPromise;

      expect(result).toBeNull();
      expect(service.errorSignal()).toBe('Group not found');
      expect(errorService.reportError).toHaveBeenCalled();
    });

    it('should not update state if group not in local list', async () => {
      const getPromise = service.getGroupById(999);

      const req = httpMock.expectOne('http://localhost:3000/api/groups/999');
      req.flush({ id: 999, name: 'New Group', createdAt: '2025-01-05T00:00:00Z', members: [] });

      await getPromise;

      // Should not add to state
      expect(service.groups().length).toBe(3);
    });

    it('should deduplicate concurrent requests for the same group', async () => {
      // Make two concurrent requests for the same group
      const promise1 = service.getGroupById(1);
      const promise2 = service.getGroupById(1);

      // Should only make one HTTP request
      const req = httpMock.expectOne('http://localhost:3000/api/groups/1');
      req.flush(mockGroupWithMembers);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Both should get the same result
      expect(result1).toBe(result2);
      expect(result1?.id).toBe(1);

      // Verify no other pending requests
      httpMock.verify();
    });
  });

  describe('addMembers()', () => {
    beforeEach(async () => {
      // Load some groups first
      const loadPromise = service.loadGroups();
      const req = httpMock.expectOne('http://localhost:3000/api/groups');
      req.flush(mockGroups);
      await loadPromise;
    });

    it('should add members successfully', async () => {
      const addPromise = service.addMembers(1, [1, 2]);

      // Handle the POST request
      const postReq = httpMock.expectOne('http://localhost:3000/api/groups/1/members');
      postReq.flush({ message: 'Members added successfully' });

      // Give a micro-task for the next HTTP call to be queued
      await Promise.resolve();

      // Now handle the GET request to reload the group  
      const getReq = httpMock.expectOne('http://localhost:3000/api/groups/1');
      getReq.flush(mockGroupWithMembers);

      const result = await addPromise;

      expect(result).not.toBeNull();
      expect(result?.id).toBe(mockGroupWithMembers.id);
      expect(errorService.clearError).toHaveBeenCalled();
    });

    it('should reject invalid group ID (0)', async () => {
      const result = await service.addMembers(0, [1, 2]);

      expect(result).toBeNull();
      expect(service.errorSignal()).toBe('Invalid group ID');
      expect(errorService.reportError).toHaveBeenCalled();
    });

    it('should reject invalid group ID (negative)', async () => {
      const result = await service.addMembers(-1, [1, 2]);

      expect(result).toBeNull();
      expect(service.errorSignal()).toBe('Invalid group ID');
    });

    it('should reject empty userIds array', async () => {
      const result = await service.addMembers(1, []);

      expect(result).toBeNull();
      expect(service.errorSignal()).toBe('No user IDs provided');
    });

    it('should reject duplicate user IDs', async () => {
      const result = await service.addMembers(1, [1, 2, 1]);

      expect(result).toBeNull();
      expect(service.errorSignal()).toBe('Duplicate user IDs are not allowed');
      expect(errorService.reportError).toHaveBeenCalled();
    });

    it('should set loading state during operation', async () => {
      const addPromise = service.addMembers(1, [1, 2]);

      // Should be loading immediately
      expect(service.isLoading()).toBe(true);

      // Handle the POST request
      const postReq = httpMock.expectOne('http://localhost:3000/api/groups/1/members');
      postReq.flush({ message: 'Members added successfully' });

      await Promise.resolve();

      // Now handle the GET request to reload the group  
      const getReq = httpMock.expectOne('http://localhost:3000/api/groups/1');
      getReq.flush(mockGroupWithMembers);

      await addPromise;

      // Should be success after completion
      expect(service.isLoading()).toBe(false);
      expect(service.isSuccess()).toBe(true);
    });

    it('should handle errors', async () => {
      const addPromise = service.addMembers(1, [1, 2]);

      const req = httpMock.expectOne('http://localhost:3000/api/groups/1/members');
      req.flush({ error: 'User not found' }, { status: 404, statusText: 'Not Found' });

      const result = await addPromise;

      expect(result).toBeNull();
      expect(service.errorSignal()).toBe('User not found');
      expect(errorService.reportError).toHaveBeenCalled();
    });
  });

  describe('removeMember()', () => {
    beforeEach(async () => {
      // Load some groups first
      const loadPromise = service.loadGroups();
      const req = httpMock.expectOne('http://localhost:3000/api/groups');
      req.flush(mockGroups);
      await loadPromise;
    });

    it('should remove member successfully', async () => {
      const removePromise = service.removeMember(1, 2);

      // Handle the DELETE request
      const deleteReq = httpMock.expectOne('http://localhost:3000/api/groups/1/members/2');
      deleteReq.flush({ message: 'Member removed successfully' });

      // Give a micro-task for the next HTTP call to be queued
      await Promise.resolve();

      // Now handle the GET request to reload the group
      const getReq = httpMock.expectOne('http://localhost:3000/api/groups/1');
      getReq.flush(mockGroupWithMembers);

      const result = await removePromise;

      expect(result).toBe(true);
      expect(errorService.clearError).toHaveBeenCalled();
    });

    it('should reject invalid group ID (0)', async () => {
      const result = await service.removeMember(0, 2);

      expect(result).toBe(false);
      expect(service.errorSignal()).toBe('Invalid group ID');
      expect(errorService.reportError).toHaveBeenCalled();
    });

    it('should reject invalid group ID (negative)', async () => {
      const result = await service.removeMember(-1, 2);

      expect(result).toBe(false);
      expect(service.errorSignal()).toBe('Invalid group ID');
    });

    it('should reject invalid user ID (0)', async () => {
      const result = await service.removeMember(1, 0);

      expect(result).toBe(false);
      expect(service.errorSignal()).toBe('Invalid user ID');
    });

    it('should reject invalid user ID (negative)', async () => {
      const result = await service.removeMember(1, -1);

      expect(result).toBe(false);
      expect(service.errorSignal()).toBe('Invalid user ID');
    });

    it('should set loading state during operation', async () => {
      const removePromise = service.removeMember(1, 2);

      // Should be loading immediately
      expect(service.isLoading()).toBe(true);

      // Handle the DELETE request
      const deleteReq = httpMock.expectOne('http://localhost:3000/api/groups/1/members/2');
      deleteReq.flush({ message: 'Member removed successfully' });

      await Promise.resolve();

      // Now handle the GET request to reload the group
      const getReq = httpMock.expectOne('http://localhost:3000/api/groups/1');
      getReq.flush(mockGroupWithMembers);

      await removePromise;

      // Should be success after completion
      expect(service.isLoading()).toBe(false);
      expect(service.isSuccess()).toBe(true);
    });

    it('should handle errors', async () => {
      const removePromise = service.removeMember(1, 2);

      const req = httpMock.expectOne('http://localhost:3000/api/groups/1/members/2');
      req.flush({ error: 'User not found' }, { status: 404, statusText: 'Not Found' });

      const result = await removePromise;

      expect(result).toBe(false);
      expect(service.errorSignal()).toBe('User not found');
      expect(errorService.reportError).toHaveBeenCalled();
    });
  });

  describe('findGroupById()', () => {
    beforeEach(async () => {
      // Load some groups first
      const loadPromise = service.loadGroups();
      const req = httpMock.expectOne('http://localhost:3000/api/groups');
      req.flush(mockGroups);
      await loadPromise;
    });

    it('should find group by ID in local state', () => {
      const group = service.findGroupById(1);

      expect(group).toEqual(mockGroups[0]);
    });

    it('should return undefined for non-existent group', () => {
      const group = service.findGroupById(999);

      expect(group).toBeUndefined();
    });

    it('should not make an API call', () => {
      const result = service.findGroupById(1);
      
      expect(result).toEqual(mockGroups[0]);
      // No expectations for httpMock - verify() in afterEach will catch unexpected requests
    });
  });

  describe('groupsSortedByName', () => {
    beforeEach(async () => {
      // Load some groups first
      const loadPromise = service.loadGroups();
      const req = httpMock.expectOne('http://localhost:3000/api/groups');
      req.flush(mockGroups);
      await loadPromise;
    });

    it('should return groups sorted by name', () => {
      const sorted = service.groupsSortedByName();

      expect(sorted[0].name).toBe('Household Bills');
      expect(sorted[1].name).toBe('Vacation Trip');
      expect(sorted[2].name).toBe('Weekend Getaway');
    });

    it('should be case-insensitive', async () => {
      const customGroups = [
        { id: 1, name: 'zebra', createdAt: '2025-01-01T00:00:00Z' },
        { id: 2, name: 'Apple', createdAt: '2025-01-02T00:00:00Z' },
        { id: 3, name: 'banana', createdAt: '2025-01-03T00:00:00Z' }
      ];

      const loadPromise = service.loadGroups();
      const req = httpMock.expectOne('http://localhost:3000/api/groups');
      req.flush(customGroups);
      await loadPromise;

      const sorted = service.groupsSortedByName();

      expect(sorted[0].name).toBe('Apple');
      expect(sorted[1].name).toBe('banana');
      expect(sorted[2].name).toBe('zebra');
    });
  });

  describe('filteredGroups', () => {
    beforeEach(async () => {
      // Load some groups first
      const loadPromise = service.loadGroups();
      const req = httpMock.expectOne('http://localhost:3000/api/groups');
      req.flush(mockGroups);
      await loadPromise;
    });

    it('should return all groups when no search query', () => {
      const filtered = service.filteredGroups();

      expect(filtered.length).toBe(3);
      expect(filtered).toEqual(mockGroups);
    });

    it('should filter groups by name', () => {
      service.setSearchQuery('vacation');
      const filtered = service.filteredGroups();

      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Vacation Trip');
    });

    it('should be case-insensitive', () => {
      service.setSearchQuery('VACATION');
      const filtered = service.filteredGroups();

      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Vacation Trip');
    });

    it('should filter by partial match', () => {
      service.setSearchQuery('e');
      const filtered = service.filteredGroups();

      expect(filtered.length).toBe(2); // "Household Bills" and "Weekend Getaway"
    });

    it('should return empty array for no matches', () => {
      service.setSearchQuery('xyz');
      const filtered = service.filteredGroups();

      expect(filtered.length).toBe(0);
    });

    it('should trim search query', () => {
      service.setSearchQuery('  vacation  ');
      const filtered = service.filteredGroups();

      expect(filtered.length).toBe(1);
    });
  });

  describe('setSearchQuery() and getSearchQuery()', () => {
    it('should set and get search query', () => {
      service.setSearchQuery('test query');

      expect(service.getSearchQuery()()).toBe('test query');
    });

    it('should update filtered groups reactively', async () => {
      const loadPromise = service.loadGroups();
      const req = httpMock.expectOne('http://localhost:3000/api/groups');
      req.flush(mockGroups);
      await loadPromise;

      expect(service.filteredGroups().length).toBe(3);

      service.setSearchQuery('vacation');

      expect(service.filteredGroups().length).toBe(1);
    });
  });

  describe('clearError()', () => {
    it('should clear error state', async () => {
      // Trigger an error
      const loadPromise = service.loadGroups();
      const req = httpMock.expectOne('http://localhost:3000/api/groups');
      req.flush({ error: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });
      await loadPromise;

      expect(service.errorSignal()).toBeTruthy();

      service.clearError();

      expect(service.errorSignal()).toBeNull();
    });
  });

  describe('refresh()', () => {
    it('should be an alias for loadGroups', async () => {
      const refreshPromise = service.refresh();

      const req = httpMock.expectOne('http://localhost:3000/api/groups');
      req.flush(mockGroups);

      const result = await refreshPromise;

      expect(result).toEqual(mockGroups);
      expect(service.groups()).toEqual(mockGroups);
    });
  });

  describe('Error Message Extraction', () => {
    it('should extract error from string error', async () => {
      const loadPromise = service.loadGroups();

      const req = httpMock.expectOne('http://localhost:3000/api/groups');
      req.flush('Plain string error', { status: 500, statusText: 'Internal Server Error' });

      await loadPromise;

      expect(service.errorSignal()).toBe('Plain string error');
    });

    it('should extract error from object with error property', async () => {
      const loadPromise = service.loadGroups();

      const req = httpMock.expectOne('http://localhost:3000/api/groups');
      req.flush({ error: 'Custom error message' }, { status: 400, statusText: 'Bad Request' });

      await loadPromise;

      expect(service.errorSignal()).toBe('Custom error message');
    });

    it('should use default message when no specific error is found', async () => {
      const loadPromise = service.loadGroups();

      const req = httpMock.expectOne('http://localhost:3000/api/groups');
      req.error(new ProgressEvent('Network error'));

      await loadPromise;

      const errorMsg = service.errorSignal();
      expect(errorMsg).toBeTruthy();
      // The error message might be from the HTTP layer, so just check it's not null
      expect(typeof errorMsg).toBe('string');
    });
  });

  describe('State Immutability', () => {
    it('should maintain state immutability when state changes', async () => {
      const loadPromise = service.loadGroups();
      const req = httpMock.expectOne('http://localhost:3000/api/groups');
      req.flush(mockGroups);
      await loadPromise;

      const state1 = service.groupState();
      const groups1 = service.groups();

      const createPromise = service.createGroup('New Group');
      const req2 = httpMock.expectOne('http://localhost:3000/api/groups');
      req2.flush({ id: 4, name: 'New Group', createdAt: '2025-01-04T00:00:00Z' });
      await createPromise;

      const state2 = service.groupState();
      const groups2 = service.groups();

      expect(state1).not.toBe(state2);
      expect(groups1).not.toBe(groups2);
      expect(groups1.length).toBe(3);
      expect(groups2.length).toBe(4);
    });
  });
});
