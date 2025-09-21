import knex from 'knex';
const knexConfig = require('../../knexfile.js');
import { ActivityLog, ActivityAction, ActivityEntityType } from '../models/ActivityLog';

export class ActivityService {
  private db = knex(knexConfig[process.env.NODE_ENV || 'development']);

  async create(activity: Omit<ActivityLog, 'id' | 'created_at'>): Promise<ActivityLog> {
    const [id] = await this.db('activity_log').insert(activity);
    const createdActivity = await this.db('activity_log').where({ id }).first();
    return createdActivity;
  }

  async findAll(limit?: number, offset?: number): Promise<ActivityLog[]> {
    let query = this.db('activity_log')
      .select('*')
      .orderBy('created_at', 'desc');

    if (offset !== undefined) {
      query = query.offset(offset);
    }

    if (limit !== undefined) {
      query = query.limit(limit);
    }

    return query;
  }

  async logActivity(
    action: ActivityAction,
    entityType: ActivityEntityType,
    entityId?: number,
    details?: string
  ): Promise<ActivityLog> {
    return this.create({
      action,
      entity_type: entityType,
      entity_id: entityId,
      details
    });
  }
}
