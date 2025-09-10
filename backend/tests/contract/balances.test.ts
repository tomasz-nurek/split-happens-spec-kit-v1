import { describe, it, beforeAll, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

describe('Balances API contract (per specs/001-expense-sharing-mvp/contracts/balances.yaml)', () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    // No routes implemented yet — tests should fail until endpoints are added.
  });

  describe('GET /api/groups/:id/balances', () => {
    it('returns 401 when unauthorized', async () => {
      const res = await request(app).get('/api/groups/1/balances');
      expect(res.status).toBe(401);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 404 for non-existent group', async () => {
      const res = await request(app).get('/api/groups/999/balances');
      expect(res.status).toBe(404);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 200 with group balances array when valid', async () => {
      const res = await request(app).get('/api/groups/1/balances');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        expect(res.body[0]).toEqual(
          expect.objectContaining({
            user_id: expect.any(Number),
            user_name: expect.any(String),
            balance: expect.any(Number),
            owes: expect.any(Array),
            owed_by: expect.any(Array)
          })
        );
        // Check debt relationship structure if present
        if (res.body[0].owes.length > 0) {
          expect(res.body[0].owes[0]).toEqual(
            expect.objectContaining({
              user_id: expect.any(Number),
              user_name: expect.any(String),
              amount: expect.any(Number)
            })
          );
        }
        if (res.body[0].owed_by.length > 0) {
          expect(res.body[0].owed_by[0]).toEqual(
            expect.objectContaining({
              user_id: expect.any(Number),
              user_name: expect.any(String),
              amount: expect.any(Number)
            })
          );
        }
      }
    });
  });

  describe('GET /api/users/:id/balance', () => {
    it('returns 401 when unauthorized', async () => {
      const res = await request(app).get('/api/users/1/balance');
      expect(res.status).toBe(401);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 404 for non-existent user', async () => {
      const res = await request(app).get('/api/users/999/balance');
      expect(res.status).toBe(404);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 200 with user balance object when valid', async () => {
      const res = await request(app).get('/api/users/1/balance');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(
        expect.objectContaining({
          user_id: expect.any(Number),
          user_name: expect.any(String),
          overall_balance: expect.any(Number),
          group_balances: expect.any(Array)
        })
      );
      // Check group balance summary structure if present
      if (res.body.group_balances.length > 0) {
        expect(res.body.group_balances[0]).toEqual(
          expect.objectContaining({
            group_id: expect.any(Number),
            group_name: expect.any(String),
            balance: expect.any(Number)
          })
        );
      }
    });
  });
});
