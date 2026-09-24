import { Router } from 'express';
import { z } from 'zod';
import { assertCanManageEvent, optionalAuth, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { Event } from '../models/Event.js';
import { Rsvp } from '../models/Rsvp.js';
import { deletePoster, posterUpload, savePoster } from '../services/posterStorage.js';
import { badRequest, conflict, notFound } from '../utils/httpError.js';
import { buildIcs } from '../utils/ics.js';
import { eventBody, eventListQuery, idParams } from '../utils/schemas.js';
import { serializeEvent } from '../utils/serializers.js';
import { escapeRegex, slugify, toCsv } from '../utils/text.js';

export const eventsRouter = Router();

async function loadEvent(id) {
  const event = await Event.findById(id).populate('club', 'name description');
  if (!event) throw notFound('Event not found.');
  return event;
}

/** Builds the Mongo filter + sort for the public feed. Shared with the club page. */
export function buildFeedQuery({ q, category, club, when }, now = new Date()) {
  const filter = {};
  if (when === 'upcoming') filter.endDate = { $gte: now }; // includes events happening right now
  if (when === 'past') filter.endDate = { $lt: now };
  if (category) filter.category = category;
  if (club) filter.club = club;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ title: rx }, { venue: rx }, { description: rx }];
  }
  const sort = when === 'upcoming' ? { startDate: 1, _id: 1 } : { startDate: -1, _id: -1 };
  return { filter, sort };
}

// GET /api/events — public feed with search, filters and pagination
eventsRouter.get('/', validate({ query: eventListQuery }), async (req, res) => {
  const { page, limit } = req.valid.query;
  const { filter, sort } = buildFeedQuery(req.valid.query);
  const [items, total] = await Promise.all([
    Event.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('club', 'name')
      .lean(),
    Event.countDocuments(filter),
  ]);
  res.json({
    items: items.map((e) => serializeEvent(e)),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});

// GET /api/events/:id — details, plus what the current viewer is allowed to do
eventsRouter.get('/:id', optionalAuth, validate({ params: idParams }), async (req, res) => {
  const event = await loadEvent(req.valid.params.id);
  const viewer = { hasRsvp: false, canManage: false };
  if (req.user?.role === 'student') {
    viewer.hasRsvp = Boolean(await Rsvp.exists({ event: event._id, user: req.user._id }));
  }
  if (req.user) {
    try {
      assertCanManageEvent(req.user, event);
      viewer.canManage = true;
    } catch {
      /* not an owner */
    }
  }
  res.json({
    event: serializeEvent(event, { clubDescription: event.club?.description ?? '' }),
    viewer,
  });
});

// POST /api/events — clubs create events (multipart, optional poster)
eventsRouter.post('/', requireAuth('club'), posterUpload, validate({ body: eventBody }), async (req, res) => {
  const { removePoster: _ignored, ...fields } = req.valid.body;
  const poster = req.file ? await savePoster(req.file) : null;
  try {
    const event = await Event.create({ ...fields, poster, club: req.user._id });
    await event.populate('club', 'name');
    res.status(201).json({ event: serializeEvent(event) });
  } catch (err) {
    await deletePoster(poster); // don't leave an orphaned file behind
    throw err;
  }
});

// PUT /api/events/:id — owner club or admin replaces the editable fields
eventsRouter.put(
  '/:id',
  requireAuth('club', 'admin'),
  posterUpload,
  validate({ params: idParams, body: eventBody }),
  async (req, res) => {
    const event = await loadEvent(req.valid.params.id);
    assertCanManageEvent(req.user, event);

    const { removePoster, ...fields } = req.valid.body;
    if (fields.capacity != null && fields.capacity < event.rsvpCount) {
      throw badRequest(`Capacity can't be lower than the ${event.rsvpCount} RSVPs already received.`, {
        capacity: `At least ${event.rsvpCount}.`,
      });
    }

    const oldPoster = event.poster;
    const newPoster = req.file ? await savePoster(req.file) : null;
    event.set(fields);
    if (newPoster) event.poster = newPoster;
    else if (removePoster) event.poster = null;

    try {
      await event.save();
    } catch (err) {
      await deletePoster(newPoster);
      throw err;
    }
    // Only delete the previous file once the new state is safely persisted.
    if (oldPoster && !oldPoster.equals(event.poster)) await deletePoster(oldPoster);

    res.json({ event: serializeEvent(event) });
  },
);

// DELETE /api/events/:id
eventsRouter.delete('/:id', requireAuth('club', 'admin'), validate({ params: idParams }), async (req, res) => {
  const event = await loadEvent(req.valid.params.id);
  assertCanManageEvent(req.user, event);
  await event.deleteOne();
  await Promise.all([Rsvp.deleteMany({ event: event._id }), deletePoster(event.poster)]);
  res.status(204).end();
});

// POST /api/events/:id/rsvp — students reserve a seat
eventsRouter.post('/:id/rsvp', requireAuth('student'), validate({ params: idParams }), async (req, res) => {
  const { id } = req.valid.params;
  const event = await Event.findById(id).lean();
  if (!event) throw notFound('Event not found.');
  if (event.endDate < new Date()) throw conflict('This event has already ended.');

  // 1) The unique (event, user) index rejects duplicates, even under concurrent requests.
  try {
    await Rsvp.create({ event: id, user: req.user._id });
  } catch (err) {
    if (err.code === 11000) throw conflict("You've already RSVPed to this event.");
    throw err;
  }

  // 2) Claim a seat with a single conditional update: it only matches while seats remain,
  //    so two students can never both take the last seat (no read-then-write race).
  const updated = await Event.findOneAndUpdate(
    { _id: id, $or: [{ capacity: null }, { $expr: { $lt: ['$rsvpCount', '$capacity'] } }] },
    { $inc: { rsvpCount: 1 } },
    { returnDocument: 'after' },
  ).populate('club', 'name');

  if (!updated) {
    await Rsvp.deleteOne({ event: id, user: req.user._id }); // compensate step 1
    throw conflict('Sorry, this event is full.');
  }
  res.status(201).json({ event: serializeEvent(updated), viewer: { hasRsvp: true, canManage: false } });
});

// DELETE /api/events/:id/rsvp — students cancel
eventsRouter.delete('/:id/rsvp', requireAuth('student'), validate({ params: idParams }), async (req, res) => {
  const { id } = req.valid.params;
  const { deletedCount } = await Rsvp.deleteOne({ event: id, user: req.user._id });
  if (!deletedCount) throw notFound("You haven't RSVPed to this event.");
  await Event.updateOne({ _id: id, rsvpCount: { $gt: 0 } }, { $inc: { rsvpCount: -1 } });
  res.status(204).end();
});

// GET /api/events/:id/attendees[?format=csv] — owner club or admin
eventsRouter.get(
  '/:id/attendees',
  requireAuth('club', 'admin'),
  validate({ params: idParams, query: z.object({ format: z.enum(['json', 'csv']).default('json') }) }),
  async (req, res) => {
    const event = await loadEvent(req.valid.params.id);
    assertCanManageEvent(req.user, event);

    const rsvps = await Rsvp.find({ event: event._id }).sort({ createdAt: 1 }).populate('user', 'name email').lean();
    const items = rsvps
      .filter((r) => r.user)
      .map((r) => ({ name: r.user.name, email: r.user.email, rsvpAt: r.createdAt }));

    if (req.valid.query.format === 'csv') {
      const csv = toCsv([['Name', 'Email', 'RSVP time (UTC)'], ...items.map((a) => [a.name, a.email, a.rsvpAt.toISOString()])]);
      res.attachment(`${slugify(event.title)}-attendees.csv`).type('text/csv').send(csv);
      return;
    }
    res.json({ items, total: items.length });
  },
);

// GET /api/events/:id/calendar.ics — "Add to calendar"
eventsRouter.get('/:id/calendar.ics', validate({ params: idParams }), async (req, res) => {
  const event = await loadEvent(req.valid.params.id);
  const ics = buildIcs({
    id: String(event._id),
    title: event.title,
    description: event.description,
    venue: event.venue,
    startDate: event.startDate,
    endDate: event.endDate,
    url: event.registerLink,
    organizer: event.club?.name,
    updatedAt: event.updatedAt,
  });
  res.attachment(`${slugify(event.title)}.ics`).type('text/calendar; charset=utf-8').send(ics);
});
