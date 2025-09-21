import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index';
import knex from 'knex';

const knexConfig = require('../../knexfile.js');

describe('Activity API contract (per specs/001-expense-sharing-mvp/contracts/activity.yaml)', () => {
  let authToken: string;
  let db: any;

  beforeAll(async () => {
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
            console.log('Migration locked, retrying...', `(${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
        }
        throw error;
      }
    }

    // Login via public API to get auth token (decouples from AuthService internals)
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        username: process.env.ADMIN_USERNAME || 'admin',
        password: process.env.ADMIN_PASSWORD || 'password123'
      });

    if (loginRes.status !== 200) {
      throw new Error(`Failed to login admin user: ${loginRes.status} ${loginRes.text}`);
    }

    authToken = loginRes.body.token;
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('GET /api/activity', () => {
    it('returns 401 when unauthorized', async () => {
      const res = await request(app).get('/api/activity');
      expect(res.status).toBe(401);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 200 with activity log array when valid', async () => {
      const res = await request(app)
        .get('/api/activity')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        expect(res.body[0]).toEqual(
          expect.objectContaining({
            id: expect.any(Number),
            action: expect.stringMatching(/^(CREATE|DELETE)$/),
            entity_type: expect.stringMatching(/^(expense|user|group)$/),
            entity_id: expect.any(Number),
            details: expect.any(String),
            created_at: expect.any(String)
          })
        );
      }
    });

    it('returns 200 with activity log array when valid with limit parameter', async () => {
      const res = await request(app)
        .get('/api/activity?limit=10')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        expect(res.body[0]).toEqual(
          expect.objectContaining({
            id: expect.any(Number),
            action: expect.stringMatching(/^(CREATE|DELETE)$/),
            entity_type: expect.stringMatching(/^(expense|user|group)$/),
            entity_id: expect.any(Number),
            details: expect.any(String),
            created_at: expect.any(String)
          })
        );
      }
    });

    it('returns 200 with activity log array when valid with offset parameter', async () => {
      const res = await request(app)
        .get('/api/activity?offset=5')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        expect(res.body[0]).toEqual(
          expect.objectContaining({
            id: expect.any(Number),
            action: expect.stringMatching(/^(CREATE|DELETE)$/),
            entity_type: expect.stringMatching(/^(expense|user|group)$/),
            entity_id: expect.any(Number),
            details: expect.any(String),
            created_at: expect.any(String)
          })
        );
      }
    });

    it('returns 200 with activity log array when valid with both limit and offset parameters', async () => {
      const res = await request(app)
        .get('/api/activity?limit=20&offset=10')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        expect(res.body[0]).toEqual(
          expect.objectContaining({
            id: expect.any(Number),
            action: expect.stringMatching(/^(CREATE|DELETE)$/),
            entity_type: expect.stringMatching(/^(expense|user|group)$/),
            entity_id: expect.any(Number),
            details: expect.any(String),
            created_at: expect.any(String)
          })
        );
      }
    });
  });
});
