import { describe, it, beforeAll, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

describe('Users API contract (per specs/001-expense-sharing-mvp/contracts/users.yaml)', () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    // No routes implemented yet — tests should fail until endpoints are added.
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
      const res = await request(app).post('/api/users').send({});
      expect(res.status).toBe(400);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 201 with user object when valid', async () => {
      const res = await request(app).post('/api/users').send({ name: 'Test User' });
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
      const res = await request(app).delete('/api/users/999');
      expect(res.status).toBe(404);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });
  });
});
