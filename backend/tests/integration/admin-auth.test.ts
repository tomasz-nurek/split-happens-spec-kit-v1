import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index';
import { AuthService } from '../../src/services/AuthService';
import knex from 'knex';

const knexConfig = require('../../knexfile.js');

describe('Admin Login Flow Integration Test (per specs/001-expense-sharing-mvp/quickstart.md)', () => {
  let authService: AuthService;
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
  });

  afterAll(async () => {
    // Clean up test database
    await db.destroy();
  });

  describe('Complete Admin Login Flow', () => {
    it('should complete full admin login, verify, and logout flow', async () => {
      // Step 1: Admin login
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'password123'
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body).toEqual(
        expect.objectContaining({
          token: expect.any(String)
        })
      );

      const token = loginRes.body.token;

      // Step 2: Verify token
      const verifyRes = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${token}`);

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body).toEqual(
        expect.objectContaining({
          user: expect.any(Object),
          valid: true
        })
      );

      // Step 3: Logout
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body).toEqual(
        expect.objectContaining({
          message: expect.any(String)
        })
      );

      // Step 4: Verify token is invalid after logout
      const verifyAfterLogoutRes = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', `Bearer ${token}`);

      expect(verifyAfterLogoutRes.status).toBe(401);
      expect(verifyAfterLogoutRes.body).toEqual(
        expect.objectContaining({
          error: expect.any(String)
        })
      );
    });

    it('should reject invalid admin credentials', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'wrongpassword'
        });

      expect(loginRes.status).toBe(401);
      expect(loginRes.body).toEqual(
        expect.objectContaining({
          error: expect.any(String)
        })
      );
    });

    it('should reject non-admin user login attempt', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'regularuser',
          password: 'password123'
        });

      expect(loginRes.status).toBe(401);
      expect(loginRes.body).toEqual(
        expect.objectContaining({
          error: expect.any(String)
        })
      );
    });

    it('should reject verify request without token', async () => {
      const verifyRes = await request(app)
        .get('/api/auth/verify');

      expect(verifyRes.status).toBe(401);
      expect(verifyRes.body).toEqual(
        expect.objectContaining({
          error: expect.any(String)
        })
      );
    });

    it('should reject verify request with invalid token', async () => {
      const verifyRes = await request(app)
        .get('/api/auth/verify')
        .set('Authorization', 'Bearer invalidtoken');

      expect(verifyRes.status).toBe(401);
      expect(verifyRes.body).toEqual(
        expect.objectContaining({
          error: expect.any(String)
        })
      );
    });

    it('should reject logout request without token', async () => {
      const logoutRes = await request(app)
        .post('/api/auth/logout');

      expect(logoutRes.status).toBe(401);
      expect(logoutRes.body).toEqual(
        expect.objectContaining({
          error: expect.any(String)
        })
      );
    });
  });
});
