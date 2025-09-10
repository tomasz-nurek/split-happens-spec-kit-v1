import { describe, it, beforeAll, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

describe('Admin Login Flow Integration Test (per specs/001-expense-sharing-mvp/quickstart.md)', () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    // No routes implemented yet — tests should fail until endpoints are added.
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
