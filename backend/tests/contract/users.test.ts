import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index';
import { AuthService } from '../../src/services/AuthService';
import { getDb, closeDatabase } from '../../src/database';

describe('Users API contract (per specs/001-expense-sharing-mvp/contracts/users.yaml)', () => {
  let authService: AuthService;
  let authToken: string;

  beforeAll(async () => {
    authService = new AuthService();

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
    // Clean up test database
  await closeDatabase();
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
