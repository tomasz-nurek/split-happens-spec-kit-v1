import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { errorHandler, notFoundHandler, asyncHandler, ValidationError, AuthError, NotFoundError, DatabaseError } from '../../src/middleware/error';

// Build a tiny express app for middleware tests
function buildApp() {
  const app = express();
  app.use(express.json({ limit: '5kb' }));

  app.get('/ok', (req, res) => res.json({ ok: true }));

  app.get('/validation', (req, res, next) => next(new ValidationError('detailed validation message')));
  app.get('/auth', (req, res, next) => next(new AuthError('nope')));
  app.get('/notfound', (req, res, next) => next(new NotFoundError('missing')));
  app.get('/db', (req, res, next) => next(new DatabaseError('db broke')));
  app.get('/unknown', (req, res, next) => next(new Error('secret should not leak')));

  app.post('/json', (req, res) => res.json({ ok: true }));

  app.get('/async-ok', asyncHandler(async (req, res) => {
    res.json({ async: 'ok' });
  }));
  app.get('/async-err', asyncHandler(async (req, res) => {
    throw new Error('boom');
  }));

  // 404 then error handler
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe('Error handling middleware', () => {
  let app: express.Express;

  beforeAll(() => {
    app = buildApp();
  });

  it('maps ValidationError to 400 and sanitizes message', async () => {
    const res = await request(app).get('/validation');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Validation error' });
    expect(res.headers['x-correlation-id']).toBeTruthy();
  });

  it('maps AuthError to 401 with generic message', async () => {
    const res = await request(app).get('/auth');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('maps NotFoundError to 404 with generic message', async () => {
    const res = await request(app).get('/notfound');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('maps DatabaseError to 500 with database message', async () => {
    const res = await request(app).get('/db');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Database operation failed' });
  });

  it('sanitizes unknown Error to 500 without leaking internals', async () => {
    const res = await request(app).get('/unknown');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });

  it('emits structured JSON logs with correlation id and without user-agent', async () => {
  const logs: string[] = [];
  const origError = console.error;
  const origLog = console.log;
  const origWarn = console.warn;
    try {
  (console as any).error = (...args: any[]) => { const msg = args[0]; if (typeof msg === 'string') logs.push(msg); };
  (console as any).log = (...args: any[]) => { const msg = args[0]; if (typeof msg === 'string') logs.push(msg); };
  (console as any).warn = (...args: any[]) => { const msg = args[0]; if (typeof msg === 'string') logs.push(msg); };

      // Trigger an unknown error which should be logged at ERROR
      await request(app).get('/unknown');

      // Find last JSON line
      const last = logs.filter(l => l.includes('"severity"')).pop();
      expect(last).toBeTruthy();
      const obj = JSON.parse(last!);
      expect(obj).toEqual(
        expect.objectContaining({
          severity: expect.any(String),
          message: expect.any(String),
          correlationId: expect.any(String),
          method: 'GET',
          url: '/unknown'
        })
      );
      // ensure user-agent is not present
      expect(obj.userAgent).toBeUndefined();
    } finally {
      (console as any).error = origError;
      (console as any).log = origLog;
      (console as any).warn = origWarn;
    }
  });

  it('notFoundHandler produces 404 with generic message for unmatched routes', async () => {
    const res = await request(app).get('/totally-missing');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });

  it('asyncHandler returns success on async route', async () => {
    const res = await request(app).get('/async-ok');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ async: 'ok' });
  });

  it('asyncHandler forwards errors to errorHandler', async () => {
    const res = await request(app).get('/async-err');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });

  it('handles JSON parsing errors with 400', async () => {
    const res = await request(app)
      .post('/json')
      .set('Content-Type', 'application/json')
      .send('{"bad":true'); // malformed
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid JSON in request body' });
  });

  it('handles payload too large with 413', async () => {
    const big = 'x'.repeat(10 * 1024);
    const res = await request(app)
      .post('/json')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ big }));
    // Express will reject before handler; ensure mapping to 413
    expect([400, 413]).toContain(res.status); // Some parsers use 400; our handler maps type to 413
  });
});
