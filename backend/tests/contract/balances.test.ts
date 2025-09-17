import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index';
import { AuthService } from '../../src/services/AuthService';
import knex from 'knex';

const knexConfig = require('../../knexfile.js');

describe('Balances API contract (per specs/001-expense-sharing-mvp/contracts/balances.yaml)', () => {
  let authService: AuthService;
  let authToken: string;
  let db: any;

  beforeAll(async () => {
    authService = new AuthService();
    
    // Setup test database with migration lock handling
    db = knex(knexConfig[process.env.NODE_ENV || 'test']);
    
    // Handle migration locks that can occur in concurrent test runs
    let retries = 3;
    while (retries > 0) {
      try {
        await db.migrate.rollback(undefined, true); // Rollback all migrations first
        await db.migrate.latest();
        break; // Success, exit retry loop
      } catch (error: any) {
        if (error.message && error.message.includes('Migration table is already locked')) {
          retries--;
          if (retries > 0) {
            console.log(`Migration locked, retrying... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms before retry
          } else {
            throw error; // Re-throw if all retries exhausted
          }
        } else {
          throw error; // Re-throw non-lock errors immediately
        }
      }
    }
    
    // Get a valid token for authenticated tests
    const credentials = authService.getAdminCredentials();
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: credentials.username, password: credentials.password });
    authToken = loginRes.body.token;
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('GET /api/groups/:id/balances', () => {
    it('returns 401 when unauthorized', async () => {
      const res = await request(app).get('/api/groups/1/balances');
      expect(res.status).toBe(401);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 404 for non-existent group', async () => {
      const res = await request(app)
        .get('/api/groups/999/balances')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(404);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 200 with group balances array when valid', async () => {
      const res = await request(app)
        .get('/api/groups/1/balances')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        expect(res.body[0]).toEqual(
          expect.objectContaining({
            user_id: expect.any(Number),
            user_name: expect.any(String),
            balance: expect.any(Number),
            owes: expect.any(Array),
            owed_by: expect.any(Array)
          })
        );
        // Check debt relationship structure if present
        if (res.body[0].owes.length > 0) {
          expect(res.body[0].owes[0]).toEqual(
            expect.objectContaining({
              user_id: expect.any(Number),
              user_name: expect.any(String),
              amount: expect.any(Number)
            })
          );
        }
        if (res.body[0].owed_by.length > 0) {
          expect(res.body[0].owed_by[0]).toEqual(
            expect.objectContaining({
              user_id: expect.any(Number),
              user_name: expect.any(String),
              amount: expect.any(Number)
            })
          );
        }
      }
    });
  });

  describe('GET /api/users/:id/balance', () => {
    it('returns 401 when unauthorized', async () => {
      const res = await request(app).get('/api/users/1/balance');
      expect(res.status).toBe(401);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 404 for non-existent user', async () => {
      const res = await request(app)
        .get('/api/users/999/balance')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(404);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 200 with user balance object when valid', async () => {
      const res = await request(app)
        .get('/api/users/1/balance')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          user_id: expect.any(Number),
          user_name: expect.any(String),
          overall_balance: expect.any(Number),
          group_balances: expect.any(Array)
        })
      );
      // Check group balance summary structure if present
      if (res.body.group_balances.length > 0) {
        expect(res.body.group_balances[0]).toEqual(
          expect.objectContaining({
            group_id: expect.any(Number),
            group_name: expect.any(String),
            balance: expect.any(Number)
          })
        );
      }
    });
  });
});
