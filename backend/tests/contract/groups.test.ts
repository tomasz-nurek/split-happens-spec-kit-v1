import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index';
import { AuthService } from '../../src/services/AuthService';
import knex from 'knex';

const knexConfig = require('../../knexfile.js');

describe('Groups API contract (per specs/001-expense-sharing-mvp/contracts/groups.yaml)', () => {
  let authService: AuthService;
  let authToken: string;
  let db: any;

  beforeAll(async () => {
    authService = new AuthService();

    // Setup test DB and migrations (handle possible lock)
    db = knex(knexConfig[process.env.NODE_ENV || 'test']);
    let retries = 3;
    while (retries > 0) {
      try {
        await db.migrate.rollback(undefined, true);
        await db.migrate.latest();
        break;
      } catch (error: any) {
        if (error.message && error.message.includes('Migration table is already locked')) {
          retries--;
          if (retries > 0) {
            await new Promise(r => setTimeout(r, 100));
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

  describe('GET /api/groups', () => {
    it('returns 401 when unauthorized', async () => {
      const res = await request(app).get('/api/groups');
      expect(res.status).toBe(401);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });
  });

  describe('POST /api/groups', () => {
    it('returns 401 when unauthorized', async () => {
      const res = await request(app).post('/api/groups').send({ name: 'Test Group' });
      expect(res.status).toBe(401);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 400 when name is missing', async () => {
      const res = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 201 with group object when valid', async () => {
      const res = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test Group' });
      expect(res.status).toBe(201);
      expect(res.body).toEqual(
        expect.objectContaining({ id: expect.any(Number), name: 'Test Group' })
      );
    });
  });

  describe('GET /api/groups/:id', () => {
    it('returns 401 when unauthorized', async () => {
      const res = await request(app).get('/api/groups/1');
      expect(res.status).toBe(401);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 404 for non-existent group', async () => {
      const res = await request(app)
        .get('/api/groups/999')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(404);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });
  });

  describe('DELETE /api/groups/:id', () => {
    it('returns 401 when unauthorized', async () => {
      const res = await request(app).delete('/api/groups/1');
      expect(res.status).toBe(401);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 404 for non-existent group', async () => {
      const res = await request(app)
        .delete('/api/groups/999')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(404);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });
  });

  describe('POST /api/groups/:id/members', () => {
    it('returns 401 when unauthorized', async () => {
      const res = await request(app).post('/api/groups/1/members').send({ userIds: [1, 2] });
      expect(res.status).toBe(401);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 400 when userIds are missing', async () => {
      const res = await request(app)
        .post('/api/groups/1/members')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 404 for non-existent group', async () => {
      const res = await request(app)
        .post('/api/groups/999/members')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ userIds: [1, 2] });
      expect(res.status).toBe(404);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });
  });

  describe('DELETE /api/groups/:id/members/:userId', () => {
    it('returns 401 when unauthorized', async () => {
      const res = await request(app).delete('/api/groups/1/members/2');
      expect(res.status).toBe(401);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 404 for non-existent group or user', async () => {
      const res = await request(app)
        .delete('/api/groups/999/members/2')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(404);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });
  });
});
