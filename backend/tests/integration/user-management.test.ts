import { describe, it, beforeAll, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

describe('User Management Integration Test (per specs/001-expense-sharing-mvp/quickstart.md)', () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    // No routes implemented yet — tests should fail until endpoints are added.
  });

  describe('Complete User Management Flow', () => {
    it('should complete full user CRUD flow with admin authentication', async () => {
      // Step 1: Admin login to get token
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
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'password123'
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
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'password123'
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
