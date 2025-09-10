import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Create a basic Express app for testing (endpoints not implemented yet)
const app = express();
app.use(express.json());

// Mock routes that will return 404 until implemented
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not implemented yet' });
});

describe('Activity Logging Integration Test (per specs/001-expense-sharing-mvp/quickstart.md)', () => {
  describe('Complete Activity Logging Flow', () => {
    it('should complete full activity logging flow with admin authentication', async () => {
      // Step 1: Admin login
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body).toEqual(
        expect.objectContaining({
          token: expect.any(String),
          user: expect.objectContaining({
            id: expect.any(Number),
            name: 'Admin User',
            role: 'admin'
          })
        })
      );
      const token = loginRes.body.token;

      // Step 2: Create test users
      const user1Res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Alice' });

      expect(user1Res.status).toBe(201);
      expect(user1Res.body).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          name: 'Alice'
        })
      );
      const user1Id = user1Res.body.id;

      const user2Res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Bob' });

      expect(user2Res.status).toBe(201);
      expect(user2Res.body).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          name: 'Bob'
        })
      );
      const user2Id = user2Res.body.id;

      // Step 3: Create a group
      const groupRes = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Trip to Paris' });

      expect(groupRes.status).toBe(201);
      expect(groupRes.body).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          name: 'Trip to Paris'
        })
      );
      const groupId = groupRes.body.id;

      // Step 4: Add members to the group
      const addMembersRes = await request(app)
        .post(`/api/groups/${groupId}/members`)
        .set('Authorization', `Bearer ${token}`)
        .send({ userIds: [user1Id, user2Id] });

      expect(addMembersRes.status).toBe(200);
      expect(addMembersRes.body).toEqual(
        expect.objectContaining({
          message: expect.any(String)
        })
      );

      // Step 5: Create an expense (this should generate activity logs)
      const expenseRes = await request(app)
        .post(`/api/groups/${groupId}/expenses`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          description: 'Dinner at fancy restaurant',
          amount: 100.00,
          paidBy: user1Id,
          participantIds: [user1Id, user2Id]
        });

      expect(expenseRes.status).toBe(201);
      expect(expenseRes.body).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          description: 'Dinner at fancy restaurant',
          amount: 100.00,
          paidBy: user1Id,
          groupId: groupId
        })
      );
      const expenseId = expenseRes.body.id;

      // Step 6: Get activity logs for the group
      const groupActivityRes = await request(app)
        .get(`/api/groups/${groupId}/activity`)
        .set('Authorization', `Bearer ${token}`);

      expect(groupActivityRes.status).toBe(200);
      expect(groupActivityRes.body).toEqual(
        expect.objectContaining({
          groupId: groupId,
          activities: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(Number),
              type: 'expense_created',
              description: expect.any(String),
              userId: user1Id,
              userName: 'Alice',
              groupId: groupId,
              groupName: 'Trip to Paris',
              expenseId: expenseId,
              expenseDescription: 'Dinner at fancy restaurant',
              amount: 100.00,
              timestamp: expect.any(String),
              metadata: expect.objectContaining({
                participantIds: [user1Id, user2Id],
                splits: expect.any(Array)
              })
            }),
            expect.objectContaining({
              id: expect.any(Number),
              type: 'group_member_added',
              description: expect.any(String),
              userId: user1Id,
              userName: 'Alice',
              groupId: groupId,
              groupName: 'Trip to Paris',
              timestamp: expect.any(String),
              metadata: expect.objectContaining({
                addedUserId: user1Id,
                addedUserName: 'Alice'
              })
            }),
            expect.objectContaining({
              id: expect.any(Number),
              type: 'group_member_added',
              description: expect.any(String),
              userId: user1Id,
              userName: 'Alice',
              groupId: groupId,
              groupName: 'Trip to Paris',
              timestamp: expect.any(String),
              metadata: expect.objectContaining({
                addedUserId: user2Id,
                addedUserName: 'Bob'
              })
            })
          ])
        })
      );

      // Step 7: Get activity logs for a specific user
      const userActivityRes = await request(app)
        .get(`/api/users/${user1Id}/activity`)
        .set('Authorization', `Bearer ${token}`);

      expect(userActivityRes.status).toBe(200);
      expect(userActivityRes.body).toEqual(
        expect.objectContaining({
          userId: user1Id,
          userName: 'Alice',
          activities: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(Number),
              type: 'expense_created',
              description: expect.any(String),
              userId: user1Id,
              userName: 'Alice',
              groupId: groupId,
              groupName: 'Trip to Paris',
              expenseId: expenseId,
              expenseDescription: 'Dinner at fancy restaurant',
              amount: 100.00,
              timestamp: expect.any(String)
            }),
            expect.objectContaining({
              id: expect.any(Number),
              type: 'group_created',
              description: expect.any(String),
              userId: user1Id,
              userName: 'Alice',
              groupId: groupId,
              groupName: 'Trip to Paris',
              timestamp: expect.any(String)
            })
          ])
        })
      );

      // Step 8: Get global activity feed
      const globalActivityRes = await request(app)
        .get('/api/activity')
        .set('Authorization', `Bearer ${token}`);

      expect(globalActivityRes.status).toBe(200);
      expect(globalActivityRes.body).toEqual(
        expect.objectContaining({
          activities: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(Number),
              type: 'expense_created',
              description: expect.any(String),
              userId: user1Id,
              userName: 'Alice',
              groupId: groupId,
              groupName: 'Trip to Paris',
              expenseId: expenseId,
              amount: 100.00,
              timestamp: expect.any(String)
            }),
            expect.objectContaining({
              id: expect.any(Number),
              type: 'group_created',
              description: expect.any(String),
              userId: user1Id,
              userName: 'Alice',
              groupId: groupId,
              groupName: 'Trip to Paris',
              timestamp: expect.any(String)
            }),
            expect.objectContaining({
              id: expect.any(Number),
              type: 'user_created',
              description: expect.any(String),
              userId: user1Id,
              userName: 'Alice',
              timestamp: expect.any(String)
            }),
            expect.objectContaining({
              id: expect.any(Number),
              type: 'user_created',
              description: expect.any(String),
              userId: user2Id,
              userName: 'Bob',
              timestamp: expect.any(String)
            })
          ])
        })
      );

      // Step 9: Update the expense (should create update activity)
      const updateExpenseRes = await request(app)
        .patch(`/api/expenses/${expenseId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          description: 'Dinner at fancy restaurant - Updated',
          amount: 120.00
        });

      expect(updateExpenseRes.status).toBe(200);

      // Step 10: Delete the expense (should create delete activity)
      const deleteExpenseRes = await request(app)
        .delete(`/api/expenses/${expenseId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(deleteExpenseRes.status).toBe(200);

      // Step 11: Check that delete activity was logged
      const updatedGroupActivityRes = await request(app)
        .get(`/api/groups/${groupId}/activity`)
        .set('Authorization', `Bearer ${token}`);

      expect(updatedGroupActivityRes.status).toBe(200);
      expect(updatedGroupActivityRes.body.activities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'expense_deleted',
            description: expect.any(String),
            userId: user1Id,
            userName: 'Alice',
            groupId: groupId,
            expenseId: expenseId,
            expenseDescription: 'Dinner at fancy restaurant - Updated',
            amount: 120.00,
            timestamp: expect.any(String)
          })
        ])
      );
    });

    it('should reject activity operations without authentication', async () => {
      const req = request(app).get('/api/groups/1/activity');
      const res = await req;

      expect(res.status).toBe(401);
      expect(res.body).toEqual(
        expect.objectContaining({
          error: expect.any(String)
        })
      );
    });

    it('should handle non-existent groups and users', async () => {
      // Step 1: Admin login
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });

      expect(loginRes.status).toBe(200);
      const token = loginRes.body.token;

      // Test non-existent group
      const groupActivityRes = await request(app)
        .get('/api/groups/999/activity')
        .set('Authorization', `Bearer ${token}`);

      expect(groupActivityRes.status).toBe(404);
      expect(groupActivityRes.body).toEqual(
        expect.objectContaining({
          error: expect.any(String)
        })
      );

      // Test non-existent user
      const userActivityRes = await request(app)
        .get('/api/users/999/activity')
        .set('Authorization', `Bearer ${token}`);

      expect(userActivityRes.status).toBe(404);
      expect(userActivityRes.body).toEqual(
        expect.objectContaining({
          error: expect.any(String)
        })
      );
    });

    it('should support activity filtering and pagination', async () => {
      // Step 1: Admin login
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });

      expect(loginRes.status).toBe(200);
      const token = loginRes.body.token;

      // Step 2: Create test users and groups
      const user1Res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Charlie' });

      expect(user1Res.status).toBe(201);
      const user1Id = user1Res.body.id;

      const group1Res = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Group 1' });

      expect(group1Res.status).toBe(201);
      const group1Id = group1Res.body.id;

      const group2Res = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Group 2' });

      expect(group2Res.status).toBe(201);
      const group2Id = group2Res.body.id;

      // Step 3: Create multiple expenses to generate activities
      await request(app)
        .post(`/api/groups/${group1Id}/expenses`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          description: 'Expense 1',
          amount: 50.00,
          paidBy: user1Id,
          participantIds: [user1Id]
        });

      await request(app)
        .post(`/api/groups/${group2Id}/expenses`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          description: 'Expense 2',
          amount: 75.00,
          paidBy: user1Id,
          participantIds: [user1Id]
        });

      // Step 4: Test filtering by activity type
      const expenseActivitiesRes = await request(app)
        .get('/api/activity?type=expense_created')
        .set('Authorization', `Bearer ${token}`);

      expect(expenseActivitiesRes.status).toBe(200);
      expect(expenseActivitiesRes.body.activities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'expense_created',
            description: expect.any(String)
          })
        ])
      );
      // Should not contain group_created activities
      expect(expenseActivitiesRes.body.activities).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'group_created'
          })
        ])
      );

      // Step 5: Test filtering by group
      const group1ActivitiesRes = await request(app)
        .get(`/api/groups/${group1Id}/activity`)
        .set('Authorization', `Bearer ${token}`);

      expect(group1ActivitiesRes.status).toBe(200);
      expect(group1ActivitiesRes.body.activities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            groupId: group1Id,
            type: 'expense_created',
            expenseDescription: 'Expense 1'
          })
        ])
      );

      // Step 6: Test pagination
      const paginatedRes = await request(app)
        .get('/api/activity?limit=2&offset=0')
        .set('Authorization', `Bearer ${token}`);

      expect(paginatedRes.status).toBe(200);
      expect(paginatedRes.body.activities).toHaveLength(2);
      expect(paginatedRes.body).toEqual(
        expect.objectContaining({
          total: expect.any(Number),
          limit: 2,
          offset: 0
        })
      );
    });

    it('should handle empty activity feeds', async () => {
      // Step 1: Admin login
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });

      expect(loginRes.status).toBe(200);
      const token = loginRes.body.token;

      // Step 2: Create a user but no activities
      const userRes = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Inactive User' });

      expect(userRes.status).toBe(201);
      const userId = userRes.body.id;

      // Step 3: Check activity feed for new user
      const userActivityRes = await request(app)
        .get(`/api/users/${userId}/activity`)
        .set('Authorization', `Bearer ${token}`);

      expect(userActivityRes.status).toBe(200);
      expect(userActivityRes.body).toEqual(
        expect.objectContaining({
          userId: userId,
          userName: 'Inactive User',
          activities: []
        })
      );

      // Step 4: Create a group but no activities
      const groupRes = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Empty Group' });

      expect(groupRes.status).toBe(201);
      const groupId = groupRes.body.id;

      // Step 5: Check activity feed for empty group
      const groupActivityRes = await request(app)
        .get(`/api/groups/${groupId}/activity`)
        .set('Authorization', `Bearer ${token}`);

      expect(groupActivityRes.status).toBe(200);
      expect(groupActivityRes.body).toEqual(
        expect.objectContaining({
          groupId: groupId,
          groupName: 'Empty Group',
          activities: []
        })
      );
    });

    it('should log all CRUD operations with proper metadata', async () => {
      // Step 1: Admin login
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });

      expect(loginRes.status).toBe(200);
      const token = loginRes.body.token;

      // Step 2: Create user (should log user_created)
      const userRes = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test User' });

      expect(userRes.status).toBe(201);
      const userId = userRes.body.id;

      // Step 3: Create group (should log group_created)
      const groupRes = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test Group' });

      expect(groupRes.status).toBe(201);
      const groupId = groupRes.body.id;

      // Step 4: Add member (should log group_member_added)
      await request(app)
        .post(`/api/groups/${groupId}/members`)
        .set('Authorization', `Bearer ${token}`)
        .send({ userIds: [userId] });

      // Step 5: Create expense (should log expense_created)
      const expenseRes = await request(app)
        .post(`/api/groups/${groupId}/expenses`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          description: 'Test Expense',
          amount: 100.00,
          paidBy: userId,
          participantIds: [userId]
        });

      expect(expenseRes.status).toBe(201);
      const expenseId = expenseRes.body.id;

      // Step 6: Update expense (should log expense_updated)
      await request(app)
        .patch(`/api/expenses/${expenseId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'Updated Test Expense' });

      // Step 7: Delete expense (should log expense_deleted)
      await request(app)
        .delete(`/api/expenses/${expenseId}`)
        .set('Authorization', `Bearer ${token}`);

      // Step 8: Remove member (should log group_member_removed)
      await request(app)
        .delete(`/api/groups/${groupId}/members/${userId}`)
        .set('Authorization', `Bearer ${token}`);

      // Step 9: Delete group (should log group_deleted)
      await request(app)
        .delete(`/api/groups/${groupId}`)
        .set('Authorization', `Bearer ${token}`);

      // Step 10: Delete user (should log user_deleted)
      await request(app)
        .delete(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${token}`);

      // Step 11: Verify all activities were logged
      const allActivitiesRes = await request(app)
        .get('/api/activity')
        .set('Authorization', `Bearer ${token}`);

      expect(allActivitiesRes.status).toBe(200);
      expect(allActivitiesRes.body.activities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'user_created',
            userId: userId,
            userName: 'Test User'
          }),
          expect.objectContaining({
            type: 'group_created',
            groupId: groupId,
            groupName: 'Test Group'
          }),
          expect.objectContaining({
            type: 'group_member_added',
            groupId: groupId,
            metadata: expect.objectContaining({
              addedUserId: userId,
              addedUserName: 'Test User'
            })
          }),
          expect.objectContaining({
            type: 'expense_created',
            expenseId: expenseId,
            expenseDescription: 'Test Expense',
            amount: 100.00
          }),
          expect.objectContaining({
            type: 'expense_updated',
            expenseId: expenseId,
            expenseDescription: 'Updated Test Expense'
          }),
          expect.objectContaining({
            type: 'expense_deleted',
            expenseId: expenseId,
            expenseDescription: 'Updated Test Expense'
          }),
          expect.objectContaining({
            type: 'group_member_removed',
            groupId: groupId,
            metadata: expect.objectContaining({
              removedUserId: userId,
              removedUserName: 'Test User'
            })
          }),
          expect.objectContaining({
            type: 'group_deleted',
            groupId: groupId,
            groupName: 'Test Group'
          }),
          expect.objectContaining({
            type: 'user_deleted',
            userId: userId,
            userName: 'Test User'
          })
        ])
      );
    });
  });
});
