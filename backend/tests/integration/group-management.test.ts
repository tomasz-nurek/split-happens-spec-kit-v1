import { describe, it, beforeAll, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index';

describe('Group Management Integration Test (per specs/001-expense-sharing-mvp/quickstart.md)', () => {
  beforeAll(() => {
    // Real app imported; migrations handled in other tests.
  });

  describe('Complete Group Management Flow', () => {
    it('should complete full group CRUD and membership management flow with admin authentication', async () => {
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

      // Step 2: Create users to be group members
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

      // Step 3: Create a new group
      const createGroupRes = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Weekend Trip' });

      expect(createGroupRes.status).toBe(201);
      expect(createGroupRes.body).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          name: 'Weekend Trip',
          created_at: expect.any(String)
        })
      );

      const groupId = createGroupRes.body.id;

      // Step 4: List all groups (should include the created group)
      const listGroupsRes = await request(app)
        .get('/api/groups')
        .set('Authorization', `Bearer ${token}`);

      expect(listGroupsRes.status).toBe(200);
      expect(Array.isArray(listGroupsRes.body)).toBe(true);
      expect(listGroupsRes.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: groupId,
            name: 'Weekend Trip',
            created_at: expect.any(String)
          })
        ])
      );

      // Step 5: Get group details (should have no members initially)
      const getGroupRes = await request(app)
        .get(`/api/groups/${groupId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(getGroupRes.status).toBe(200);
      expect(getGroupRes.body).toEqual(
        expect.objectContaining({
          id: groupId,
          name: 'Weekend Trip',
          created_at: expect.any(String),
          members: []
        })
      );

      // Step 6: Add members to the group
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

      // Step 7: Get group details again (should now include members)
      const getGroupWithMembersRes = await request(app)
        .get(`/api/groups/${groupId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(getGroupWithMembersRes.status).toBe(200);
      expect(getGroupWithMembersRes.body).toEqual(
        expect.objectContaining({
          id: groupId,
          name: 'Weekend Trip',
          created_at: expect.any(String),
          members: expect.arrayContaining([
            expect.objectContaining({
              id: user1Id,
              name: 'Alice Johnson'
            }),
            expect.objectContaining({
              id: user2Id,
              name: 'Bob Smith'
            })
          ])
        })
      );

      // Step 8: Remove one member from the group
      const removeMemberRes = await request(app)
        .delete(`/api/groups/${groupId}/members/${user2Id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(removeMemberRes.status).toBe(200);
      expect(removeMemberRes.body).toEqual(
        expect.objectContaining({
          message: expect.any(String)
        })
      );

      // Step 9: Verify member was removed
      const getGroupAfterRemovalRes = await request(app)
        .get(`/api/groups/${groupId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(getGroupAfterRemovalRes.status).toBe(200);
      expect(getGroupAfterRemovalRes.body.members).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: user1Id,
            name: 'Alice Johnson'
          })
        ])
      );
      expect(getGroupAfterRemovalRes.body.members).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: user2Id,
            name: 'Bob Smith'
          })
        ])
      );

      // Step 10: Delete the group
      const deleteGroupRes = await request(app)
        .delete(`/api/groups/${groupId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(deleteGroupRes.status).toBe(200);
      expect(deleteGroupRes.body).toEqual(
        expect.objectContaining({
          message: expect.any(String)
        })
      );

      // Step 11: Verify group is deleted
      const getDeletedGroupRes = await request(app)
        .get(`/api/groups/${groupId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(getDeletedGroupRes.status).toBe(404);
      expect(getDeletedGroupRes.body).toEqual(
        expect.objectContaining({
          error: expect.any(String)
        })
      );
    });

    it('should reject group operations without authentication', async () => {
      const endpoints = [
        { method: 'get', path: '/api/groups' },
        { method: 'post', path: '/api/groups', data: { name: 'Test Group' } },
        { method: 'get', path: '/api/groups/1' },
        { method: 'delete', path: '/api/groups/1' },
        { method: 'post', path: '/api/groups/1/members', data: { userIds: [1] } },
        { method: 'delete', path: '/api/groups/1/members/2' }
      ];

      for (const endpoint of endpoints) {
  const agent: any = request(app);
  const req = agent[endpoint.method](endpoint.path);
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

    it('should handle non-existent groups and users', async () => {
      // First login to get token
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });

      expect(loginRes.status).toBe(200);
      const token = loginRes.body.token;

      // Try to get non-existent group
      const getGroupRes = await request(app)
        .get('/api/groups/99999')
        .set('Authorization', `Bearer ${token}`);

      expect(getGroupRes.status).toBe(404);

      // Try to delete non-existent group
      const deleteGroupRes = await request(app)
        .delete('/api/groups/99999')
        .set('Authorization', `Bearer ${token}`);

      expect(deleteGroupRes.status).toBe(404);

      // Try to add members to non-existent group
      const addMembersRes = await request(app)
        .post('/api/groups/99999/members')
        .set('Authorization', `Bearer ${token}`)
        .send({ userIds: [1] });

      expect(addMembersRes.status).toBe(404);

      // Try to remove member from non-existent group
      const removeMemberRes = await request(app)
        .delete('/api/groups/99999/members/1')
        .set('Authorization', `Bearer ${token}`);

      expect(removeMemberRes.status).toBe(404);
    });

    it('should validate group creation input', async () => {
      // First login to get token
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });

      expect(loginRes.status).toBe(200);
      const token = loginRes.body.token;

      // Try to create group without name
      const res = await request(app)
        .post('/api/groups')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toEqual(
        expect.objectContaining({
          error: expect.any(String)
        })
      );
    });

    it('should validate member addition input', async () => {
      // First login to get token
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });

      expect(loginRes.status).toBe(200);
      const token = loginRes.body.token;

      // Try to add members without userIds
      const res = await request(app)
        .post('/api/groups/1/members')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toEqual(
        expect.objectContaining({
          error: expect.any(String)
        })
      );
    });
  });
});
