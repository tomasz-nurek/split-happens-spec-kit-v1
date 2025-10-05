import { getDb } from '../database';
import { User } from '../models/User';

export class UserService {
  private db = getDb();

  async create(user: Omit<User, 'id' | 'created_at'>): Promise<User> {
    const [id] = await this.db('users').insert(user);
    const createdUser = await this.db('users').where({ id }).first();
    return createdUser;
  }

  async findAll(): Promise<User[]> {
    return this.db('users').select('*');
  }

  async findById(id: number): Promise<User | undefined> {
    return this.db('users').where({ id }).first();
  }

  async delete(id: number): Promise<void> {
    await this.db('users').where({ id }).del();
  }

  async findByIds(ids: number[]): Promise<User[]> {
    if (ids.length === 0) return [];
    return this.db('users').whereIn('id', ids).select('*');
  }

  async validateUserIds(ids: number[]): Promise<{ valid: number[]; invalid: number[] }> {
    if (ids.length === 0) return { valid: [], invalid: [] };
    
    const existingUsers = await this.findByIds(ids);
    const existingIds = new Set(existingUsers.map(user => user.id));
    
    const valid: number[] = [];
    const invalid: number[] = [];
    
    for (const id of ids) {
      if (existingIds.has(id)) {
        valid.push(id);
      } else {
        invalid.push(id);
      }
    }
    
    return { valid, invalid };
  }
}
