import { describe, it, beforeAll, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

describe('Expenses API contract (per specs/001-expense-sharing-mvp/contracts/expenses.yaml)', () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    // No routes implemented yet — tests should fail until endpoints are added.
  });

  describe('GET /api/groups/:id/expenses', () => {
    it('returns 401 when unauthorized', async () => {
      const res = await request(app).get('/api/groups/1/expenses');
      expect(res.status).toBe(401);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 404 for non-existent group', async () => {
      const res = await request(app).get('/api/groups/999/expenses');
      expect(res.status).toBe(404);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });
  });

  describe('POST /api/groups/:id/expenses', () => {
    it('returns 401 when unauthorized', async () => {
      const res = await request(app).post('/api/groups/1/expenses').send({
        amount: 100.50,
        description: 'Dinner',
        paidBy: 1,
        participantIds: [1, 2, 3]
      });
      expect(res.status).toBe(401);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await request(app).post('/api/groups/1/expenses').send({});
      expect(res.status).toBe(400);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 400 when amount is missing', async () => {
      const res = await request(app).post('/api/groups/1/expenses').send({
        description: 'Dinner',
        paidBy: 1,
        participantIds: [1, 2, 3]
      });
      expect(res.status).toBe(400);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 400 when description is missing', async () => {
      const res = await request(app).post('/api/groups/1/expenses').send({
        amount: 100.50,
        paidBy: 1,
        participantIds: [1, 2, 3]
      });
      expect(res.status).toBe(400);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 400 when paidBy is missing', async () => {
      const res = await request(app).post('/api/groups/1/expenses').send({
        amount: 100.50,
        description: 'Dinner',
        participantIds: [1, 2, 3]
      });
      expect(res.status).toBe(400);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 400 when participantIds is missing', async () => {
      const res = await request(app).post('/api/groups/1/expenses').send({
        amount: 100.50,
        description: 'Dinner',
        paidBy: 1
      });
      expect(res.status).toBe(400);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 404 for non-existent group', async () => {
      const res = await request(app).post('/api/groups/999/expenses').send({
        amount: 100.50,
        description: 'Dinner',
        paidBy: 1,
        participantIds: [1, 2, 3]
      });
      expect(res.status).toBe(404);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 201 with expense object when valid', async () => {
      const res = await request(app).post('/api/groups/1/expenses').send({
        amount: 100.50,
        description: 'Dinner',
        paidBy: 1,
        participantIds: [1, 2, 3]
      });
      expect(res.status).toBe(201);
      expect(res.body).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          group_id: 1,
          amount: 100.50,
          description: 'Dinner',
          paid_by: 1,
          splits: expect.any(Array)
        })
      );
    });
  });

  describe('DELETE /api/expenses/:id', () => {
    it('returns 401 when unauthorized', async () => {
      const res = await request(app).delete('/api/expenses/1');
      expect(res.status).toBe(401);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 404 for non-existent expense', async () => {
      const res = await request(app).delete('/api/expenses/999');
      expect(res.status).toBe(404);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });
  });
});
