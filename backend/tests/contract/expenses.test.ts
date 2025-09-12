import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index';
import { AuthService } from '../../src/services/AuthService';
import knex from 'knex';
import { setTimeout as sleep } from 'node:timers/promises';

const knexConfig = require('../../knexfile.js');

describe('Expenses API contract (per specs/001-expense-sharing-mvp/contracts/expenses.yaml)', () => {
  let authService: AuthService;
  let authToken: string;
  let db: any;

  beforeAll(async () => {
    authService = new AuthService();

    // Setup test DB and migrations (handle possible lock)
    db = knex(knexConfig[process.env.NODE_ENV || 'test']);
    let retries = 3;
    let delay = 50; // ms, exponential backoff
    while (retries > 0) {
      try {
        await db.migrate.rollback(undefined, true);
        await db.migrate.latest();
        break;
      } catch (error: any) {
        if (error.message && error.message.includes('Migration table is already locked')) {
          retries--;
          if (retries > 0) {
            await sleep(delay);
            delay = Math.min(delay * 2, 250);
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }
    }

    // Login to get token
    const credentials = authService.getAdminCredentials();
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: credentials.username, password: credentials.password });
    authToken = loginRes.body.token;
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('GET /api/groups/:id/expenses', () => {
    it('returns 401 when unauthorized', async () => {
      const res = await request(app).get('/api/groups/1/expenses');
      expect(res.status).toBe(401);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 404 for non-existent group', async () => {
      const res = await request(app)
        .get('/api/groups/999/expenses')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(404);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });
  });

  describe('POST /api/groups/:id/expenses', () => {
    it('returns 401 when unauthorized', async () => {
      const res = await request(app).post('/api/groups/1/expenses').send({
        amount: 100.50,
        description: 'Dinner',
        paidBy: 1,
        participantIds: [1, 2, 3]
      });
      expect(res.status).toBe(401);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/groups/1/expenses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 400 when amount is missing', async () => {
      const res = await request(app)
        .post('/api/groups/1/expenses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Dinner',
          paidBy: 1,
          participantIds: [1, 2, 3]
        });
      expect(res.status).toBe(400);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 400 when description is missing', async () => {
      const res = await request(app)
        .post('/api/groups/1/expenses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 100.50,
          paidBy: 1,
          participantIds: [1, 2, 3]
        });
      expect(res.status).toBe(400);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 400 when paidBy is missing', async () => {
      const res = await request(app)
        .post('/api/groups/1/expenses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 100.50,
          description: 'Dinner',
          participantIds: [1, 2, 3]
        });
      expect(res.status).toBe(400);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 400 when participantIds is missing', async () => {
      const res = await request(app)
        .post('/api/groups/1/expenses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 100.50,
          description: 'Dinner',
          paidBy: 1
        });
      expect(res.status).toBe(400);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 404 for non-existent group', async () => {
      const res = await request(app)
        .post('/api/groups/999/expenses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 100.50,
          description: 'Dinner',
          paidBy: 1,
          participantIds: [1, 2, 3]
        });
      expect(res.status).toBe(404);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 201 with expense object when valid', async () => {
      const res = await request(app)
        .post('/api/groups/1/expenses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 100.50,
          description: 'Dinner',
          paidBy: 1,
          participantIds: [1, 2, 3]
        });
      expect(res.status).toBe(201);
      expect(res.body).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          group_id: 1,
          amount: 100.50,
          description: 'Dinner',
          paid_by: 1,
          splits: expect.any(Array)
        })
      );
    });
  });

  describe('DELETE /api/expenses/:id', () => {
    it('returns 401 when unauthorized', async () => {
      const res = await request(app).delete('/api/expenses/1');
      expect(res.status).toBe(401);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 404 for non-existent expense', async () => {
      const res = await request(app)
        .delete('/api/expenses/999')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(404);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });
  });
});
