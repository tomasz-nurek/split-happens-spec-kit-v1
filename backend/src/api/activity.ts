import { Router, Request, Response, NextFunction } from 'express';
import { ActivityService } from '../services/ActivityService';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, ValidationError } from '../middleware/error';

const router = Router();
const activityService = new ActivityService();

/**
 * GET /api/activity
 * Get activity log with optional pagination
 */
router.get('/activity', requireAuth, asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;

    // Validate query parameters
    if (limit !== undefined && (isNaN(limit) || limit < 0)) {
      return next(new ValidationError('Invalid limit parameter'));
    }

    if (offset !== undefined && (isNaN(offset) || offset < 0)) {
      return next(new ValidationError('Invalid offset parameter'));
    }

    const activities = await activityService.findAll(limit, offset);
    return res.status(200).json(activities);
}));

export { router as activityRouter };
