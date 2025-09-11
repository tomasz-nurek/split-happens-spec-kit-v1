import { describe, it, beforeAll, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index';
import { AuthService } from '../../src/services/AuthService';

describe('Auth API contract (per specs/001-expense-sharing-mvp/contracts/auth.yaml)', () => {
  let authService: AuthService;

  beforeAll(() => {
    authService = new AuthService();
  });

  describe('POST /api/auth/login', () => {
    it('returns 400 with error when username or password missing', async () => {
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.status).toBe(400);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 401 with error on invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'wrong', password: 'nope' });
      expect(res.status).toBe(401);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 200 with { token: string } on valid credentials', async () => {
      const credentials = authService.getAdminCredentials();
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: credentials.username, password: credentials.password });
      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({ token: expect.any(String) })
      );
    });
  });

  describe('POST /api/auth/logout', () => {
    it('requires bearer token and returns 401 when missing/invalid', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(401);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });
  });

  describe('GET /api/auth/verify', () => {
    it('requires bearer token and returns 401 when invalid', async () => {
      const res = await request(app).get('/api/auth/verify');
      expect(res.status).toBe(401);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });
  });
});
