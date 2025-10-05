import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index';
import { getDb, closeDatabase } from '../../src/database';

describe('Activity API contract (per specs/001-expense-sharing-mvp/contracts/activity.yaml)', () => {
  let authToken: string;

  beforeAll(async () => {
    // Setup test database with migration lock handling

    // Handle migration locks that can occur in concurrent test runs
    let retries = 3;
    while (retries > 0) {
      const db = getDb();
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
  await closeDatabase();
  });

  describe('GET /api/activity', () => {
    it('returns 401 when unauthorized', async () => {
      const res = await request(app).get('/api/activity');
      expect(res.status).toBe(401);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 200 with activities wrapper when valid', async () => {
      const res = await request(app)
        .get('/api/activity')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.objectContaining({ activities: expect.any(Array) }));
      if (res.body.activities.length > 0) {
        expect(res.body.activities[0]).toEqual(expect.objectContaining({
          id: expect.any(Number),
          type: expect.any(String),
          timestamp: expect.any(String)
        }));
      }
    });

    it('returns 200 with activities wrapper when valid with limit parameter', async () => {
      const res = await request(app)
        .get('/api/activity?limit=10')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.objectContaining({ activities: expect.any(Array) }));
      if (res.body.activities.length > 0) {
        expect(res.body.activities[0]).toEqual(expect.objectContaining({ id: expect.any(Number) }));
      }
    });

    it('returns 200 with activities wrapper when valid with offset parameter', async () => {
      const res = await request(app)
        .get('/api/activity?offset=5')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.objectContaining({ activities: expect.any(Array) }));
      if (res.body.activities.length > 0) {
        expect(res.body.activities[0]).toEqual(expect.objectContaining({ id: expect.any(Number) }));
      }
    });

    it('returns 200 with activities wrapper when valid with both limit and offset parameters', async () => {
      const res = await request(app)
        .get('/api/activity?limit=20&offset=10')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(expect.objectContaining({ activities: expect.any(Array) }));
      if (res.body.activities.length > 0) {
        expect(res.body.activities[0]).toEqual(expect.objectContaining({ id: expect.any(Number) }));
      }
    });
  });
});
