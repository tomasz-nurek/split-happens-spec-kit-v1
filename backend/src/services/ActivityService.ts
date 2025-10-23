import { getDb } from '../database';
import { ActivityLog, ActivityAction, ActivityEntityType } from '../models/ActivityLog';

interface ActivityFilters {
  entityType?: ActivityEntityType;
  entityId?: number;
  limit?: number;
  offset?: number;
  // Domain-scoped convenience filters (expanded into entityType/entityId by callers):
  userId?: number; // user CRUD events
  groupId?: number; // group CRUD / membership events / expenses parent
  expenseId?: number; // expense events only
}

export class ActivityService {
  private db = getDb();

  async create(activity: Omit<ActivityLog, 'id' | 'created_at'>): Promise<ActivityLog> {
    const [id] = await this.db('activity_log').insert(activity);
    const createdActivity = await this.db('activity_log').where({ id }).first();
    return createdActivity;
  }

  async findAll(limit?: number, offset?: number): Promise<ActivityLog[]> {
    return this.findBy({ limit, offset });
  }

  /**
   * Generic filtered activity lookup supporting pagination and domain convenience filters.
   * - If userId provided: filters entity_type='user' and entity_id=userId.
   * - If groupId provided: uses denormalized group_id column for efficient lookup (includes both group events and expense events).
   * - If expenseId provided: filters entity_type='expense' and entity_id=expenseId.
   */
  async findBy(filters: ActivityFilters): Promise<ActivityLog[]> {
    let query = this.db('activity_log')
      .select('*')
      .orderBy('created_at', 'desc');

    if (filters.entityType) {
      query = query.where('entity_type', filters.entityType);
    }
    if (filters.entityId !== undefined) {
      query = query.where('entity_id', filters.entityId);
    }

    // Convenience domain filters (exclusive precedence if specified)
    if (filters.userId !== undefined) {
      query = query.where({ entity_type: 'user', entity_id: filters.userId });
    } else if (filters.expenseId !== undefined) {
      query = query.where({ entity_type: 'expense', entity_id: filters.expenseId });
    } else if (filters.groupId !== undefined) {
      // Use denormalized group_id column for efficient O(log n) lookup with index
      // This includes both group entity events AND expense events for that group
      query = query.where('group_id', filters.groupId);
    }

    if (filters.offset !== undefined) {
      query = query.offset(filters.offset);
    }
    if (filters.limit !== undefined) {
      query = query.limit(filters.limit);
    }
    return query;
  }

  async logActivity(
    action: ActivityAction,
    entityType: ActivityEntityType,
    entityId?: number,
    details?: Record<string, any>,
    groupId?: number
  ): Promise<ActivityLog> {
    return this.create({
      action,
      entity_type: entityType,
      entity_id: entityId,
      group_id: groupId,
      details: details ? JSON.stringify(details) : undefined
    });
  }
}
