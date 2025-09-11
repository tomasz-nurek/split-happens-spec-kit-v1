import knex from 'knex';
const knexConfig = require('../../knexfile.js');
import { User } from '../models/User';

export class UserService {
  private db = knex(knexConfig[process.env.NODE_ENV || 'development']);

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
}
