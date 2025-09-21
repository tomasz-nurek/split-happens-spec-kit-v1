import { Router, Request, Response } from 'express';
import { ActivityService } from '../services/ActivityService';
import { requireAuth } from '../middleware/auth';

const router = Router();
const activityService = new ActivityService();

/**
 * GET /api/activity
 * Get activity log with optional pagination
 */
router.get('/activity', requireAuth, async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;

    // Validate query parameters
    if (limit !== undefined && (isNaN(limit) || limit < 0)) {
      return res.status(400).json({ 
        error: 'Invalid limit parameter' 
      });
    }

    if (offset !== undefined && (isNaN(offset) || offset < 0)) {
      return res.status(400).json({ 
        error: 'Invalid offset parameter' 
      });
    }

    const activities = await activityService.findAll(limit, offset);
    return res.status(200).json(activities);
  } catch (error) {
    console.error('Get activity log error:', error);
    return res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

export { router as activityRouter };
