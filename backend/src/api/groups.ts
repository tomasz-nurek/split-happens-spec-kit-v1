import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { GroupService } from '../services/GroupService';
import { UserService } from '../services/UserService';

const router = Router();
const groupService = new GroupService();
const userService = new UserService();

/**
 * GET /api/groups
 * List all groups
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const groups = await groupService.findAll();
    return res.status(200).json(groups);
  } catch (error) {
    console.error('Get groups error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/groups
 * Create a new group
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name } = req.body || {};

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Name is required' });
    }

    const group = await groupService.create({ name: name.trim() });
    return res.status(201).json(group);
  } catch (error) {
    console.error('Create group error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/groups/:id
 * Get a single group with members
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid group ID' });
    }

    const group = await groupService.findById(id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const members = await groupService.getMembers(id);
    return res.status(200).json({ ...group, members });
  } catch (error) {
    console.error('Get group error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/groups/:id
 * Delete a group
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid group ID' });
    }

    const group = await groupService.findById(id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    await groupService.delete(id);
    return res.status(200).json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Delete group error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/groups/:id/members
 * Add members to a group
 */
router.post('/:id/members', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid group ID' });
    }

    const group = await groupService.findById(id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const { userIds } = req.body || {};
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'userIds (non-empty array) is required' });
    }

    // Parse and validate user IDs
    const validUserIds: number[] = [];
    for (const rawUserId of userIds) {
      const userId = parseInt(rawUserId, 10);
      if (!isNaN(userId) && userId > 0) {
        validUserIds.push(userId);
      }
    }

    if (validUserIds.length === 0) {
      return res.status(400).json({ error: 'No valid user IDs provided' });
    }

    // Batch validate user existence
    const { valid: existingUserIds, invalid: invalidUserIds } = await userService.validateUserIds(validUserIds);
    
    if (invalidUserIds.length > 0) {
      return res.status(400).json({ 
        error: `Invalid user IDs: ${invalidUserIds.join(', ')}` 
      });
    }

    // Add members (all users are validated to exist)
    for (const userId of existingUserIds) {
      try {
        await groupService.addMember(id, userId);
      } catch (e) {
        // Ignore duplicate insert errors
        // console.warn('Add member skipped/failed:', e);
      }
    }

    return res.status(200).json({ message: 'Members added successfully' });
  } catch (error) {
    console.error('Add members error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/groups/:id/members/:userId
 * Remove a member from a group
 */
router.delete('/:id/members/:userId', requireAuth, async (req: Request, res: Response) => {
  try {
    const groupId = parseInt(req.params.id, 10);
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(groupId) || groupId <= 0 || isNaN(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid group or user ID' });
    }

    const group = await groupService.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Optionally ensure user exists; if not, 404
    const user = await userService.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await groupService.removeMember(groupId, userId);
    return res.status(200).json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Remove member error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as groupsRouter };
