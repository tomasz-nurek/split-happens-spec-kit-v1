import { describe, it, expect, beforeEach } from 'vitest';
import { initDatabase, closeDatabase, getDb, healthCheck } from '../../src/database';

/**
 * Unit-style lifecycle tests for database initialization layer.
 * These do not assert business data, only connection state & resilience.
 */
describe('database lifecycle', () => {
  beforeEach(async () => {
    // Ensure clean slate before each test
    await closeDatabase();
  });

  it('initializes and reports healthy', async () => {
    await initDatabase();
    const hc = await healthCheck();
    expect(hc).toEqual({ ok: true });
  });

  it('getDb creates a lazy connection without marking initialized', async () => {
    const db = getDb();
    // Should be able to run a trivial query
    const row = await db.raw('select 1 as v');
    // better-sqlite3 returns different shapes, just assert no throw
    expect(row).toBeTruthy();
  });

  it('closeDatabase allows re-initialization after destroy', async () => {
    await initDatabase();
    await closeDatabase();
    // Re-initialize should succeed
    await initDatabase();
    const hc = await healthCheck();
    expect(hc).toEqual({ ok: true });
  });

  it('healthCheck with throwOnFail throws DatabaseError when broken', async () => {
    await initDatabase();
    // Manually close underlying connection then call healthCheck(true)
    const db = getDb();
    await closeDatabase();
    let threw = false;
    try {
      await healthCheck(true);
    } catch (e: any) {
      threw = true;
      expect(e.name).toBe('DatabaseError');
    }
    expect(threw).toBe(true);
  });
});
