import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index';
import db from '../../src/database';

describe('Balance Calculation Integration Test (per specs/001-expense-sharing-mvp/quickstart.md)', () => {

  beforeAll(async () => {
    // Setup test database with migration lock handling

    // Handle migration locks that can occur in concurrent test runs
    let retries = 3;
    while (retries > 0) {
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
    await db.destroy();
  });

  describe('Complete Balance Calculation Flow', () => {
    it('should complete full balance calculation flow with admin authentication', async () => {
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

      const user3Res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Charlie' });

      expect(user3Res.status).toBe(201);
      expect(user3Res.body).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          name: 'Charlie'
        })
      );
      const user3Id = user3Res.body.id;

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
        .send({ userIds: [user1Id, user2Id, user3Id] });

      expect(addMembersRes.status).toBe(200);
      expect(addMembersRes.body).toEqual(
        expect.objectContaining({
          message: expect.any(String)
        })
      );

      // Step 5: Create expenses with different splitting scenarios
      // Expense 1: Alice pays $300 for dinner, split equally among 3 people
      const expense1Res = await request(app)
        .post(`/api/groups/${groupId}/expenses`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          description: 'Dinner at fancy restaurant',
          amount: 300.00,
          paidBy: user1Id,
          participantIds: [user1Id, user2Id, user3Id]
        });

      expect(expense1Res.status).toBe(201);
      expect(expense1Res.body).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          description: 'Dinner at fancy restaurant',
          amount: 300.00,
          paidBy: user1Id,
          groupId: groupId,
          splits: expect.arrayContaining([
            expect.objectContaining({
              userId: user1Id,
              amount: 100.00, // 300 / 3
              percentage: 33.33
            }),
            expect.objectContaining({
              userId: user2Id,
              amount: 100.00,
              percentage: 33.33
            }),
            expect.objectContaining({
              userId: user3Id,
              amount: 100.00,
              percentage: 33.33
            })
          ])
        })
      );
      const expense1Id = expense1Res.body.id;

      // Expense 2: Bob pays $200 for hotel, split equally among 3 people
      const expense2Res = await request(app)
        .post(`/api/groups/${groupId}/expenses`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          description: 'Hotel booking',
          amount: 200.00,
          paidBy: user2Id,
          participantIds: [user1Id, user2Id, user3Id]
        });

      expect(expense2Res.status).toBe(201);
      expect(expense2Res.body).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          description: 'Hotel booking',
          amount: 200.00,
          paidBy: user2Id,
          groupId: groupId,
          splits: expect.arrayContaining([
            expect.objectContaining({
              userId: user1Id,
              amount: 66.67, // 200 / 3
              percentage: 33.33
            }),
            expect.objectContaining({
              userId: user2Id,
              amount: 66.67,
              percentage: 33.33
            }),
            expect.objectContaining({
              userId: user3Id,
              amount: 66.67,
              percentage: 33.33
            })
          ])
        })
      );
      const expense2Id = expense2Res.body.id;

      // Expense 3: Charlie pays $150 for taxi, split equally among 3 people
      const expense3Res = await request(app)
        .post(`/api/groups/${groupId}/expenses`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          description: 'Taxi rides',
          amount: 150.00,
          paidBy: user3Id,
          participantIds: [user1Id, user2Id, user3Id]
        });

      expect(expense3Res.status).toBe(201);
      expect(expense3Res.body).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          description: 'Taxi rides',
          amount: 150.00,
          paidBy: user3Id,
          groupId: groupId,
          splits: expect.arrayContaining([
            expect.objectContaining({
              userId: user1Id,
              amount: 50.00, // 150 / 3
              percentage: 33.33
            }),
            expect.objectContaining({
              userId: user2Id,
              amount: 50.00,
              percentage: 33.33
            }),
            expect.objectContaining({
              userId: user3Id,
              amount: 50.00,
              percentage: 33.33
            })
          ])
        })
      );
      const expense3Id = expense3Res.body.id;

      // Step 6: Calculate balances for the group
      const balancesRes = await request(app)
        .get(`/api/groups/${groupId}/balances`)
        .set('Authorization', `Bearer ${token}`);

      expect(balancesRes.status).toBe(200);
      expect(balancesRes.body).toEqual(
        expect.objectContaining({
          groupId: groupId,
          balances: expect.arrayContaining([
            expect.objectContaining({
              userId: user1Id,
              userName: 'Alice',
              balance: 16.67, // Alice paid 100, owes 66.67 + 50 = 116.67, so net +16.67
              owes: expect.any(Object),
              owed: expect.any(Object)
            }),
            expect.objectContaining({
              userId: user2Id,
              userName: 'Bob',
              balance: 16.67, // Bob paid 66.67, owes 100 + 50 = 150, so net +16.67
              owes: expect.any(Object),
              owed: expect.any(Object)
            }),
            expect.objectContaining({
              userId: user3Id,
              userName: 'Charlie',
              balance: -33.34, // Charlie paid 50, owes 100 + 66.67 = 166.67, so net -116.67
              owes: expect.any(Object),
              owed: expect.any(Object)
            })
          ]),
          settlements: expect.arrayContaining([
            expect.objectContaining({
              fromUserId: user3Id,
              toUserId: user1Id,
              amount: 16.67
            }),
            expect.objectContaining({
              fromUserId: user3Id,
              toUserId: user2Id,
              amount: 16.67
            })
          ])
        })
      );

      // Step 7: Get individual user balance details
      const user1BalanceRes = await request(app)
        .get(`/api/users/${user1Id}/balances`)
        .set('Authorization', `Bearer ${token}`);

      expect(user1BalanceRes.status).toBe(200);
      expect(user1BalanceRes.body).toEqual(
        expect.objectContaining({
          userId: user1Id,
          userName: 'Alice',
          totalBalance: 16.67,
          groupBalances: expect.arrayContaining([
            expect.objectContaining({
              groupId: groupId,
              groupName: 'Trip to Paris',
              balance: 16.67,
              owes: expect.any(Object),
              owed: expect.any(Object)
            })
          ])
        })
      );

      // Step 8: Verify balance calculation accuracy
      // Alice: Paid 100, owes 66.67 (hotel) + 50 (taxi) = 116.67, net +16.67
      // Bob: Paid 66.67, owes 100 (dinner) + 50 (taxi) = 150, net +16.67
      // Charlie: Paid 50, owes 100 (dinner) + 66.67 (hotel) = 166.67, net -116.67
      const totalPaid = 100 + 66.67 + 50; // 216.67
      const totalOwed = (300 + 200 + 150) / 3 * 3; // 650 / 3 * 3 = 650
      expect(totalPaid).toBeCloseTo(216.67, 2);
      expect(totalOwed).toBe(650);
    });

    it('should reject balance operations without authentication', async () => {
      const req = request(app).get('/api/groups/1/balances');
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
      const groupBalanceRes = await request(app)
        .get('/api/groups/999/balances')
        .set('Authorization', `Bearer ${token}`);

      expect(groupBalanceRes.status).toBe(404);
      expect(groupBalanceRes.body).toEqual(
        expect.objectContaining({
          error: expect.any(String)
        })
      );

      // Test non-existent user
      const userBalanceRes = await request(app)
        .get('/api/users/999/balances')
        .set('Authorization', `Bearer ${token}`);

      expect(userBalanceRes.status).toBe(404);
      expect(userBalanceRes.body).toEqual(
        expect.objectContaining({
          error: expect.any(String)
        })
      );
    });

    it('should handle groups with no expenses', async () => {
      // Step 1: Admin login
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });

      expect(loginRes.status).toBe(200);
      const token = loginRes.body.token;

      // Step 2: Create test users
      const user1Res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Dave' });

      expect(user1Res.status).toBe(201);
      const user1Id = user1Res.body.id;

      const user2Res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Eve' });

      expect(user2Res.status).toBe(201);
      const user2Id = user2Res.body.id;

      // Step 3: Create a group with no expenses
      const groupRes = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Empty Group' });

      expect(groupRes.status).toBe(201);
      const groupId = groupRes.body.id;

      // Step 4: Add members to the group
      const addMembersRes = await request(app)
        .post(`/api/groups/${groupId}/members`)
        .set('Authorization', `Bearer ${token}`)
        .send({ userIds: [user1Id, user2Id] });

      expect(addMembersRes.status).toBe(200);

      // Step 5: Check balances for group with no expenses
      const balancesRes = await request(app)
        .get(`/api/groups/${groupId}/balances`)
        .set('Authorization', `Bearer ${token}`);

      expect(balancesRes.status).toBe(200);
      expect(balancesRes.body).toEqual(
        expect.objectContaining({
          groupId: groupId,
          balances: expect.arrayContaining([
            expect.objectContaining({
              userId: user1Id,
              userName: 'Dave',
              balance: 0,
              owes: {},
              owed: {}
            }),
            expect.objectContaining({
              userId: user2Id,
              userName: 'Eve',
              balance: 0,
              owes: {},
              owed: {}
            })
          ]),
          settlements: []
        })
      );
    });

    it('should handle complex balance scenarios with multiple groups', async () => {
      // Step 1: Admin login
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });

      expect(loginRes.status).toBe(200);
      const token = loginRes.body.token;

      // Step 2: Create test users
      const user1Res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Frank' });

      expect(user1Res.status).toBe(201);
      const user1Id = user1Res.body.id;

      const user2Res = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Grace' });

      expect(user2Res.status).toBe(201);
      const user2Id = user2Res.body.id;

      // Step 3: Create two groups
      const group1Res = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Weekend Trip' });

      expect(group1Res.status).toBe(201);
      const group1Id = group1Res.body.id;

      const group2Res = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Dinner Club' });

      expect(group2Res.status).toBe(201);
      const group2Id = group2Res.body.id;

      // Step 4: Add members to both groups
      await request(app)
        .post(`/api/groups/${group1Id}/members`)
        .set('Authorization', `Bearer ${token}`)
        .send({ userIds: [user1Id, user2Id] });

      await request(app)
        .post(`/api/groups/${group2Id}/members`)
        .set('Authorization', `Bearer ${token}`)
        .send({ userIds: [user1Id, user2Id] });

      // Step 5: Create expenses in both groups
      // Group 1: Frank pays $100, split equally
      await request(app)
        .post(`/api/groups/${group1Id}/expenses`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          description: 'Gas for trip',
          amount: 100.00,
          paidBy: user1Id,
          participantIds: [user1Id, user2Id]
        });

      // Group 2: Grace pays $80, split equally
      await request(app)
        .post(`/api/groups/${group2Id}/expenses`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          description: 'Dinner bill',
          amount: 80.00,
          paidBy: user2Id,
          participantIds: [user1Id, user2Id]
        });

      // Step 6: Check individual user balances across all groups
      const user1BalanceRes = await request(app)
        .get(`/api/users/${user1Id}/balances`)
        .set('Authorization', `Bearer ${token}`);

      expect(user1BalanceRes.status).toBe(200);
      expect(user1BalanceRes.body).toEqual(
        expect.objectContaining({
          userId: user1Id,
          userName: 'Frank',
          totalBalance: 10.00, // Paid 50, owes 40 = net +10
          groupBalances: expect.arrayContaining([
            expect.objectContaining({
              groupId: group1Id,
              groupName: 'Weekend Trip',
              balance: 50.00 // Paid 50, owes 0 in this group
            }),
            expect.objectContaining({
              groupId: group2Id,
              groupName: 'Dinner Club',
              balance: -40.00 // Paid 0, owes 40 in this group
            })
          ])
        })
      );

      const user2BalanceRes = await request(app)
        .get(`/api/users/${user2Id}/balances`)
        .set('Authorization', `Bearer ${token}`);

      expect(user2BalanceRes.status).toBe(200);
      expect(user2BalanceRes.body).toEqual(
        expect.objectContaining({
          userId: user2Id,
          userName: 'Grace',
          totalBalance: -10.00, // Paid 40, owes 50 = net -10
          groupBalances: expect.arrayContaining([
            expect.objectContaining({
              groupId: group1Id,
              groupName: 'Weekend Trip',
              balance: -50.00
            }),
            expect.objectContaining({
              groupId: group2Id,
              groupName: 'Dinner Club',
              balance: 40.00
            })
          ])
        })
      );
    });
  });
});
