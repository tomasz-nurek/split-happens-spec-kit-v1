import { describe, it, beforeAll, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

describe('Activity API contract (per specs/001-expense-sharing-mvp/contracts/activity.yaml)', () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    // No routes implemented yet — tests should fail until endpoints are added.
  });

  describe('GET /api/activity', () => {
    it('returns 401 when unauthorized', async () => {
      const res = await request(app).get('/api/activity');
      expect(res.status).toBe(401);
      expect(res.body).toEqual(
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('returns 200 with activity log array when valid', async () => {
      const res = await request(app).get('/api/activity');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        expect(res.body[0]).toEqual(
          expect.objectContaining({
            id: expect.any(Number),
            action: expect.stringMatching(/^(CREATE|DELETE)$/),
            entity_type: expect.stringMatching(/^(expense|user|group)$/),
            entity_id: expect.any(Number),
            details: expect.any(String),
            created_at: expect.any(String)
          })
        );
      }
    });

    it('returns 200 with activity log array when valid with limit parameter', async () => {
      const res = await request(app).get('/api/activity?limit=10');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        expect(res.body[0]).toEqual(
          expect.objectContaining({
            id: expect.any(Number),
            action: expect.stringMatching(/^(CREATE|DELETE)$/),
            entity_type: expect.stringMatching(/^(expense|user|group)$/),
            entity_id: expect.any(Number),
            details: expect.any(String),
            created_at: expect.any(String)
          })
        );
      }
    });

    it('returns 200 with activity log array when valid with offset parameter', async () => {
      const res = await request(app).get('/api/activity?offset=5');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        expect(res.body[0]).toEqual(
          expect.objectContaining({
            id: expect.any(Number),
            action: expect.stringMatching(/^(CREATE|DELETE)$/),
            entity_type: expect.stringMatching(/^(expense|user|group)$/),
            entity_id: expect.any(Number),
            details: expect.any(String),
            created_at: expect.any(String)
          })
        );
      }
    });

    it('returns 200 with activity log array when valid with both limit and offset parameters', async () => {
      const res = await request(app).get('/api/activity?limit=20&offset=10');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        expect(res.body[0]).toEqual(
          expect.objectContaining({
            id: expect.any(Number),
            action: expect.stringMatching(/^(CREATE|DELETE)$/),
            entity_type: expect.stringMatching(/^(expense|user|group)$/),
            entity_id: expect.any(Number),
            details: expect.any(String),
            created_at: expect.any(String)
          })
        );
      }
    });
  });
});
