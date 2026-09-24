import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Event } from '../models/Event.js';
import { Rsvp } from '../models/Rsvp.js';
import { User } from '../models/User.js';

export const adminRouter = Router();

// GET /api/admin/stats — platform-wide numbers for the admin dashboard
adminRouter.get('/stats', requireAuth('admin'), async (req, res) => {
  const now = new Date();
  const [clubs, students, events, upcomingEvents, rsvps] = await Promise.all([
    User.countDocuments({ role: 'club' }),
    User.countDocuments({ role: 'student' }),
    Event.countDocuments(),
    Event.countDocuments({ endDate: { $gte: now } }),
    Rsvp.countDocuments(),
  ]);
  res.json({ stats: { clubs, students, events, upcomingEvents, rsvps } });
});
