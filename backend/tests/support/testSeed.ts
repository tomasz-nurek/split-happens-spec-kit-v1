import { getDb } from '../../src/database';

/**
 * Ensure admin user representation if stored in DB (currently admin is virtual via env, but placeholder for future).
 */
export async function ensureAdminUser(): Promise<void> {
  // For current implementation admin user not persisted; placeholder no-op.
}

/**
 * Seed a basic group with users for integration tests if needed.
 * Returns { userIds, groupId }
 */
export async function seedBasicGroup(userNames: string[] = ['Alice','Bob']): Promise<{ userIds: number[]; groupId: number; }> {
  const db = getDb();
  const userIds: number[] = [];
  for (const name of userNames) {
    const [id] = await db('users').insert({ name });
    userIds.push(id);
  }
  const [groupId] = await db('groups').insert({ name: 'Test Group' });
  for (const uid of userIds) {
    await db('group_members').insert({ group_id: groupId, user_id: uid });
  }
  return { userIds, groupId };
}
