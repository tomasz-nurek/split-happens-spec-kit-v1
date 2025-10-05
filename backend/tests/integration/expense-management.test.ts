import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index';
import { getDb, closeDatabase } from '../../src/database';

describe('Expense Management Integration Test (per specs/001-expense-sharing-mvp/quickstart.md)', () => {

  beforeAll(async () => {
    // Setup test database with migration lock handling

    // Handle migration locks that can occur in concurrent test runs
    let retries = 3;
    while (retries > 0) {
      const db = getDb();
      try {
        await db.migrate.rollback(undefined, true); // Rollback all migrations first
        await db.migrate.latest();
        break; // Success, exit retry loop
      } catch (error: any) {
        if (error.message && error.message.includes('Migration table is already locked')) {
          retries--;
          if (retries > 0) {
            console.log(`Migration locked, retrying... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms before retry
          } else {
            throw error; // Re-throw if all retries exhausted
          }
        } else {
          throw error; // Re-throw non-lock errors immediately
        }
      }
    }
  });

  afterAll(async () => {
    // Clean up test database
  await closeDatabase();
  });

  describe('Complete Expense Creation and Splitting Flow', () => {
    it('should complete full expense creation, splitting, and management flow with admin authentication', async () => {
      // Step 1: Admin login to get token
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body).toEqual(
        expect.objectContaining({
          token: expect.any(String)
        })
      );

      const token = loginRes.body.token;

      // Step 2: Create users to be group members and expense participants
      const user1Res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Alice Johnson' });

      expect(user1Res.status).toBe(201);
      const user1Id = user1Res.body.id;

      const user2Res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Bob Smith' });

      expect(user2Res.status).toBe(201);
      const user2Id = user2Res.body.id;

      const user3Res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Charlie Brown' });

      expect(user3Res.status).toBe(201);
      const user3Id = user3Res.body.id;

      // Step 3: Create a group
      const createGroupRes = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Weekend Trip' });

      expect(createGroupRes.status).toBe(201);
      const groupId = createGroupRes.body.id;

      // Step 4: Add members to the group
      const addMembersRes = await request(app)
        .post(`/api/groups/${groupId}/members`)
        .set('Authorization', `Bearer ${token}`)
        .send({ userIds: [user1Id, user2Id, user3Id] });

      expect(addMembersRes.status).toBe(200);

      // Step 5: Create first expense (equal split among 3 people)
      const expense1Res = await request(app)
        .post(`/api/groups/${groupId}/expenses`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 90.00,
          description: 'Hotel booking',
          paidBy: user1Id,
          participantIds: [user1Id, user2Id, user3Id]
        });

      expect(expense1Res.status).toBe(201);
      expect(expense1Res.body).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          group_id: groupId,
          amount: 90.00,
          description: 'Hotel booking',
          paid_by: user1Id,
          splits: expect.arrayContaining([
            expect.objectContaining({
              expense_id: expect.any(Number),
              user_id: user1Id,
              amount: 30.00 // 90 / 3 = 30
            }),
            expect.objectContaining({
              expense_id: expect.any(Number),
              user_id: user2Id,
              amount: 30.00
            }),
            expect.objectContaining({
              expense_id: expect.any(Number),
              user_id: user3Id,
              amount: 30.00
            })
          ])
        })
      );

      const expense1Id = expense1Res.body.id;

      // Step 6: Create second expense (unequal split - only 2 participants)
      const expense2Res = await request(app)
        .post(`/api/groups/${groupId}/expenses`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 60.00,
          description: 'Dinner at restaurant',
          paidBy: user2Id,
          participantIds: [user2Id, user3Id] // Only Bob and Charlie
        });

      expect(expense2Res.status).toBe(201);
      expect(expense2Res.body).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          group_id: groupId,
          amount: 60.00,
          description: 'Dinner at restaurant',
          paid_by: user2Id,
          splits: expect.arrayContaining([
            expect.objectContaining({
              expense_id: expect.any(Number),
              user_id: user2Id,
              amount: 30.00 // 60 / 2 = 30
            }),
            expect.objectContaining({
              expense_id: expect.any(Number),
              user_id: user3Id,
              amount: 30.00
            })
          ])
        })
      );

      const expense2Id = expense2Res.body.id;

      // Step 7: List all expenses in the group
      const listExpensesRes = await request(app)
        .get(`/api/groups/${groupId}/expenses`)
        .set('Authorization', `Bearer ${token}`);

      expect(listExpensesRes.status).toBe(200);
      expect(Array.isArray(listExpensesRes.body)).toBe(true);
      expect(listExpensesRes.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expense1Id,
            group_id: groupId,
            amount: 90.00,
            description: 'Hotel booking',
            paid_by: user1Id
          }),
          expect.objectContaining({
            id: expense2Id,
            group_id: groupId,
            amount: 60.00,
            description: 'Dinner at restaurant',
            paid_by: user2Id
          })
        ])
      );

      // Step 8: Delete the first expense
      const deleteExpenseRes = await request(app)
        .delete(`/api/expenses/${expense1Id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(deleteExpenseRes.status).toBe(200);
      expect(deleteExpenseRes.body).toEqual(
        expect.objectContaining({
          message: expect.any(String)
        })
      );

      // Step 9: Verify expense was deleted (list should only contain the second expense)
      const listAfterDeleteRes = await request(app)
        .get(`/api/groups/${groupId}/expenses`)
        .set('Authorization', `Bearer ${token}`);

      expect(listAfterDeleteRes.status).toBe(200);
      expect(Array.isArray(listAfterDeleteRes.body)).toBe(true);
      expect(listAfterDeleteRes.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expense2Id,
            amount: 60.00,
            description: 'Dinner at restaurant'
          })
        ])
      );
      expect(listAfterDeleteRes.body).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expense1Id,
            description: 'Hotel booking'
          })
        ])
      );
    });

    it('should reject expense operations without authentication', async () => {
      const endpoints = [
        { method: 'get', path: '/api/groups/1/expenses' },
        { method: 'post', path: '/api/groups/1/expenses', data: { amount: 100, description: 'Test', paidBy: 1, participantIds: [1] } },
        { method: 'delete', path: '/api/expenses/1' }
      ];

      for (const endpoint of endpoints) {
        const req = request(app)[endpoint.method](endpoint.path);
        if (endpoint.data) {
          req.send(endpoint.data);
        }
        const res = await req;

        expect(res.status).toBe(401);
        expect(res.body).toEqual(
          expect.objectContaining({
            error: expect.any(String)
          })
        );
      }
    });

    it('should handle non-existent groups and expenses', async () => {
      // First login to get token
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });

      expect(loginRes.status).toBe(200);
      const token = loginRes.body.token;

      // Try to list expenses for non-existent group
      const listExpensesRes = await request(app)
        .get('/api/groups/99999/expenses')
        .set('Authorization', `Bearer ${token}`);

      expect(listExpensesRes.status).toBe(404);

      // Try to create expense in non-existent group
      const createExpenseRes = await request(app)
        .post('/api/groups/99999/expenses')
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 50.00,
          description: 'Test expense',
          paidBy: 1,
          participantIds: [1]
        });

      expect(createExpenseRes.status).toBe(404);

      // Try to delete non-existent expense
      const deleteExpenseRes = await request(app)
        .delete('/api/expenses/99999')
        .set('Authorization', `Bearer ${token}`);

      expect(deleteExpenseRes.status).toBe(404);
    });

    it('should validate expense creation input', async () => {
      // First login to get token
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });

      expect(loginRes.status).toBe(200);
      const token = loginRes.body.token;

      // Try to create expense without required fields
      const testCases = [
        { data: {}, description: 'empty object' },
        { data: { description: 'Test', paidBy: 1, participantIds: [1] }, description: 'missing amount' },
        { data: { amount: 50, paidBy: 1, participantIds: [1] }, description: 'missing description' },
        { data: { amount: 50, description: 'Test', participantIds: [1] }, description: 'missing paidBy' },
        { data: { amount: 50, description: 'Test', paidBy: 1 }, description: 'missing participantIds' }
      ];

      for (const testCase of testCases) {
        const res = await request(app)
          .post('/api/groups/1/expenses')
          .set('Authorization', `Bearer ${token}`)
          .send(testCase.data);

        expect(res.status).toBe(400);
        expect(res.body).toEqual(
          expect.objectContaining({
            error: expect.any(String)
          })
        );
      }
    });

    it('should handle edge cases in expense splitting', async () => {
      // First login to get token
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });

      expect(loginRes.status).toBe(200);
      const token = loginRes.body.token;

      // Create a user
      const userRes = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test User' });

      expect(userRes.status).toBe(201);
      const userId = userRes.body.id;

      // Create a group
      const groupRes = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test Group' });

      expect(groupRes.status).toBe(201);
      const groupId = groupRes.body.id;

      // Add user to group
      await request(app)
        .post(`/api/groups/${groupId}/members`)
        .set('Authorization', `Bearer ${token}`)
        .send({ userIds: [userId] });

      // Test expense with single participant (paid by themselves)
      const singleExpenseRes = await request(app)
        .post(`/api/groups/${groupId}/expenses`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          amount: 25.00,
          description: 'Solo expense',
          paidBy: userId,
          participantIds: [userId]
        });

      expect(singleExpenseRes.status).toBe(201);
      expect(singleExpenseRes.body.splits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            user_id: userId,
            amount: 25.00 // Full amount since only participant
          })
        ])
      );
    });
  });
});
