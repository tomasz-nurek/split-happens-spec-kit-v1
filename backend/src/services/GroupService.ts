import { getDb } from '../database';
import { Group } from '../models/Group';
import { ActivityService } from './ActivityService';
import { ActivityAction, ActivityEntityType } from '../models/ActivityLog';

export class GroupService {
  private db = getDb();
  private activity = new ActivityService();

  async create(group: Omit<Group, 'id' | 'created_at'>): Promise<Group> {
    const [id] = await this.db('groups').insert(group);
    const createdGroup = await this.db('groups').where({ id }).first();
    await this.activity.logActivity(ActivityAction.CREATE, ActivityEntityType.group, createdGroup.id, { groupId: createdGroup.id, groupName: createdGroup.name });
    return createdGroup;
  }

  async findAll(): Promise<Group[]> {
    return this.db('groups').select('*');
  }

  async findById(id: number): Promise<Group | undefined> {
    return this.db('groups').where({ id }).first();
  }

  async delete(id: number): Promise<void> {
    await this.db('groups').where({ id }).del();
    await this.activity.logActivity(ActivityAction.DELETE, ActivityEntityType.group, id, { groupId: id });
  }

  async addMember(groupId: number, userId: number): Promise<void> {
    await this.db('group_members').insert({ group_id: groupId, user_id: userId });
    const user = await this.db('users').where({ id: userId }).first();
    await this.activity.logActivity(ActivityAction.UPDATE, ActivityEntityType.group, groupId, { addedUserId: userId, addedUserName: user?.name, groupId });
  }

  async removeMember(groupId: number, userId: number): Promise<void> {
    const user = await this.db('users').where({ id: userId }).first();
    await this.db('group_members').where({ group_id: groupId, user_id: userId }).del();
    await this.activity.logActivity(ActivityAction.UPDATE, ActivityEntityType.group, groupId, { removedUserId: userId, removedUserName: user?.name, groupId });
  }

  async getMembers(groupId: number): Promise<any[]> {
    return this.db('group_members')
      .join('users', 'group_members.user_id', 'users.id')
      .where('group_members.group_id', groupId)
      .select('users.id', 'users.name');
  }
}
