import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { Event } from '../models/Event.js';
import { Rsvp } from '../models/Rsvp.js';
import { serializeEvent } from '../utils/serializers.js';

export const meRouter = Router();

// GET /api/me/rsvps — a student's RSVPs, upcoming first (soonest), then past (most recent)
meRouter.get('/rsvps', requireAuth('student'), async (req, res) => {
  const rsvps = await Rsvp.find({ user: req.user._id })
    .populate({ path: 'event', populate: { path: 'club', select: 'name' } })
    .lean();
  const now = Date.now();
  const events = rsvps.filter((r) => r.event).map((r) => r.event);
  const upcoming = events.filter((e) => e.endDate >= now).sort((a, b) => a.startDate - b.startDate);
  const past = events.filter((e) => e.endDate < now).sort((a, b) => b.startDate - a.startDate);
  res.json({
    upcoming: upcoming.map((e) => serializeEvent(e)),
    past: past.map((e) => serializeEvent(e)),
  });
});

// GET /api/me/events — a club's own events plus dashboard stats
meRouter.get('/events', requireAuth('club'), async (req, res) => {
  const events = await Event.find({ club: req.user._id }).sort({ startDate: -1 }).populate('club', 'name').lean();
  const now = Date.now();
  const items = events.map((e) => serializeEvent(e));
  res.json({
    items,
    stats: {
      total: items.length,
      upcoming: events.filter((e) => e.endDate >= now).length,
      totalRsvps: events.reduce((sum, e) => sum + (e.rsvpCount ?? 0), 0),
    },
  });
});
