import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index';
import { AuthService } from '../../src/services/AuthService';
import knex from 'knex';

const knexConfig = require('../../knexfile.js');

describe('Users API contract (per specs/001-expense-sharing-mvp/contracts/users.yaml)', () => {
  let authService: AuthService;
  let authToken: string;
  let db: any;

  beforeAll(async () => {
    authService = new AuthService();
    
    // Setup test database
    db = knex(knexConfig[process.env.NODE_ENV || 'test']);
    await db.migrate.latest();
    
    // Get a valid token for authenticated tests
    const credentials = authService.getAdminCredentials();
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: credentials.username, password: credentials.password });
    authToken = loginRes.body.token;
  });

  afterAll(async () => {
    // Clean up test database
    await db.destroy();
  });

  describe('GET /api/users', () => {
    it('returns 401 when unauthorized', async () => {
      const res = await request(app).get('/api/users');
      expect(res.status).toBe(401);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });
  });

  describe('POST /api/users', () => {
    it('returns 401 when unauthorized', async () => {
      const res = await request(app).post('/api/users').send({ name: 'Test User' });
      expect(res.status).toBe(401);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 400 when name is missing', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 201 with user object when valid', async () => {
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test User' });
      expect(res.status).toBe(201);
      expect(res.body).toEqual(
        expect.objectContaining({ id: expect.any(Number), name: 'Test User' })
      );
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('returns 401 when unauthorized', async () => {
      const res = await request(app).delete('/api/users/1');
      expect(res.status).toBe(401);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 404 for non-existent user', async () => {
      const res = await request(app)
        .delete('/api/users/999')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.status).toBe(404);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });
  });
});
