import knex from 'knex';
const knexConfig = require('../../knexfile.js');
import { Group } from '../models/Group';

export class GroupService {
  private db = knex(knexConfig[process.env.NODE_ENV || 'test']);

  async create(group: Omit<Group, 'id' | 'created_at'>): Promise<Group> {
    const [id] = await this.db('groups').insert(group);
    const createdGroup = await this.db('groups').where({ id }).first();
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
  }

  async addMember(groupId: number, userId: number): Promise<void> {
    await this.db('group_members').insert({ group_id: groupId, user_id: userId });
  }

  async removeMember(groupId: number, userId: number): Promise<void> {
    await this.db('group_members').where({ group_id: groupId, user_id: userId }).del();
  }

  async getMembers(groupId: number): Promise<any[]> {
    return this.db('group_members')
      .join('users', 'group_members.user_id', 'users.id')
      .where('group_members.group_id', groupId)
      .select('users.id', 'users.name');
  }
}
