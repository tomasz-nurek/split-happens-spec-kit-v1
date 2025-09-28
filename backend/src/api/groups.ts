import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { GroupService } from '../services/GroupService';
import { UserService } from '../services/UserService';
import { validateGroupName, validateId, validateIdArray, formatValidationErrors, validateNoDuplicateIds, combineValidationResults } from '../utils/validation';
import { asyncHandler, ValidationError, NotFoundError } from '../middleware/error';

const router = Router();
const groupService = new GroupService();
const userService = new UserService();

/**
 * GET /api/groups
 * List all groups
 */
router.get('/', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const groups = await groupService.findAll();
    return res.status(200).json(groups);
}));

/**
 * POST /api/groups
 * Create a new group
 */
router.post('/', requireAuth, asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { name } = req.body || {};

    // Validate required fields using centralized validation utilities
    const nameValidation = validateGroupName(name);
    
    if (!nameValidation.isValid) {
      const errorResponse = formatValidationErrors(nameValidation);
      return next(new ValidationError(errorResponse?.error || 'Validation error'));
    }

    const group = await groupService.create({ name: name.trim() });
    return res.status(201).json(group);
}));

/**
 * GET /api/groups/:id
 * Get a single group with members
 */
router.get('/:id', requireAuth, asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const id = parseInt(req.params.id, 10);
    
    // Validate ID parameter using centralized validation utilities
    const idValidation = validateId(id, 'Group ID');
    
    if (!idValidation.isValid) {
      const errorResponse = formatValidationErrors(idValidation);
      return next(new ValidationError(errorResponse?.error || 'Validation error'));
    }

    const group = await groupService.findById(id);
    if (!group) {
      return next(new NotFoundError('Group not found'));
    }

    const members = await groupService.getMembers(id);
    return res.status(200).json({ ...group, members });
}));

/**
 * DELETE /api/groups/:id
 * Delete a group
 */
router.delete('/:id', requireAuth, asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const id = parseInt(req.params.id, 10);
    
    // Validate ID parameter using centralized validation utilities
    const idValidation = validateId(id, 'Group ID');
    
    if (!idValidation.isValid) {
      const errorResponse = formatValidationErrors(idValidation);
      return next(new ValidationError(errorResponse?.error || 'Validation error'));
    }

    const group = await groupService.findById(id);
    if (!group) {
      return next(new NotFoundError('Group not found'));
    }

    await groupService.delete(id);
    return res.status(200).json({ message: 'Group deleted successfully' });
}));

/**
 * POST /api/groups/:id/members
 * Add members to a group
 */
router.post('/:id/members', requireAuth, asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const id = parseInt(req.params.id, 10);
    
    // Validate group ID parameter using centralized validation utilities
    const groupIdValidation = validateId(id, 'Group ID');
    
    if (!groupIdValidation.isValid) {
      const errorResponse = formatValidationErrors(groupIdValidation);
      return next(new ValidationError(errorResponse?.error || 'Validation error'));
    }

    const group = await groupService.findById(id);
    if (!group) {
      return next(new NotFoundError('Group not found'));
    }

    const { userIds } = req.body || {};
    
    // Validate userIds array using centralized validation utilities
    const userIdsValidation = validateIdArray(userIds, 'User IDs');
    const noDuplicatesValidation = validateNoDuplicateIds(userIds || [], 'User IDs');
    
    const validationResult = combineValidationResults(userIdsValidation, noDuplicatesValidation);
    
    if (!validationResult.isValid) {
      const errorResponse = formatValidationErrors(validationResult);
      return next(new ValidationError(errorResponse?.error || 'Validation error'));
    }

    // Batch validate user existence
    const { valid: existingUserIds, invalid: invalidUserIds } = await userService.validateUserIds(userIds);
    
    if (invalidUserIds.length > 0) {
      return next(new ValidationError(`Invalid user IDs: ${invalidUserIds.join(', ')}`));
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
}));

/**
 * DELETE /api/groups/:id/members/:userId
 * Remove a member from a group
 */
router.delete('/:id/members/:userId', requireAuth, asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const groupId = parseInt(req.params.id, 10);
    const userId = parseInt(req.params.userId, 10);
    
    // Validate ID parameters using centralized validation utilities
    const groupIdValidation = validateId(groupId, 'Group ID');
    const userIdValidation = validateId(userId, 'User ID');
    
    const validationResult = combineValidationResults(groupIdValidation, userIdValidation);
    
    if (!validationResult.isValid) {
      const errorResponse = formatValidationErrors(validationResult);
      return next(new ValidationError(errorResponse?.error || 'Validation error'));
    }

    const group = await groupService.findById(groupId);
    if (!group) {
      return next(new NotFoundError('Group not found'));
    }

    // Optionally ensure user exists; if not, 404
    const user = await userService.findById(userId);
    if (!user) {
      return next(new NotFoundError('User not found'));
    }

    await groupService.removeMember(groupId, userId);
    return res.status(200).json({ message: 'Member removed successfully' });
}));

export { router as groupsRouter };
