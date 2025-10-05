import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index';
import { AuthService } from '../../src/services/AuthService';
import { getDb, closeDatabase } from '../../src/database';

describe('User Management Integration Test (per specs/001-expense-sharing-mvp/quickstart.md)', () => {
  let authService: AuthService;

  beforeAll(async () => {
    authService = new AuthService();

    // Setup test database with migration lock handling

    // Handle migration locks that can occur in concurrent test runs
  const db = getDb();
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
  });

  afterAll(async () => {
    // Clean up test database
  await closeDatabase();
  });

  describe('Complete User Management Flow', () => {
    it('should complete full user CRUD flow with admin authentication', async () => {
      // Step 1: Admin login to get token
      const credentials = authService.getAdminCredentials();
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: credentials.username,
          password: credentials.password
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body).toEqual(
        expect.objectContaining({
          token: expect.any(String)
        })
      );

      const token = loginRes.body.token;

      // Step 2: Create a new user
      const createUserRes = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test User' });

      expect(createUserRes.status).toBe(201);
      expect(createUserRes.body).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          name: 'Test User',
          created_at: expect.any(String)
        })
      );

      const userId = createUserRes.body.id;

      // Step 3: List all users (should include the created user)
      const listUsersRes = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`);

      expect(listUsersRes.status).toBe(200);
      expect(Array.isArray(listUsersRes.body)).toBe(true);
      expect(listUsersRes.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: userId,
            name: 'Test User',
            created_at: expect.any(String)
          })
        ])
      );

      // Step 4: Delete the user
      const deleteUserRes = await request(app)
        .delete(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(deleteUserRes.status).toBe(200);
      expect(deleteUserRes.body).toEqual(
        expect.objectContaining({
          message: expect.any(String)
        })
      );

      // Step 5: Verify user is deleted (list should not include the user)
      const listAfterDeleteRes = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`);

      expect(listAfterDeleteRes.status).toBe(200);
      expect(Array.isArray(listAfterDeleteRes.body)).toBe(true);
      expect(listAfterDeleteRes.body).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: userId,
            name: 'Test User'
          })
        ])
      );
    });

    it('should reject user creation without authentication', async () => {
      const res = await request(app)
        .post('/api/users')
        .send({ name: 'Unauthorized User' });

      expect(res.status).toBe(401);
      expect(res.body).toEqual(
        expect.objectContaining({
          error: expect.any(String)
        })
      );
    });

    it('should reject user listing without authentication', async () => {
      const res = await request(app).get('/api/users');

      expect(res.status).toBe(401);
      expect(res.body).toEqual(
        expect.objectContaining({
          error: expect.any(String)
        })
      );
    });

    it('should reject user deletion without authentication', async () => {
      const res = await request(app).delete('/api/users/1');

      expect(res.status).toBe(401);
      expect(res.body).toEqual(
        expect.objectContaining({
          error: expect.any(String)
        })
      );
    });

    it('should handle deletion of non-existent user', async () => {
      // First login to get token
      const credentials = authService.getAdminCredentials();
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: credentials.username,
          password: credentials.password
        });

      expect(loginRes.status).toBe(200);
      const token = loginRes.body.token;

      // Try to delete non-existent user
      const res = await request(app)
        .delete('/api/users/99999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual(
        expect.objectContaining({
          error: expect.any(String)
        })
      );
    });

    it('should validate user creation input', async () => {
      // First login to get token
      const credentials = authService.getAdminCredentials();
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: credentials.username,
          password: credentials.password
        });

      expect(loginRes.status).toBe(200);
      const token = loginRes.body.token;

      // Try to create user without name
      const res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toEqual(
        expect.objectContaining({
          error: expect.any(String)
        })
      );
    });
  });
});
