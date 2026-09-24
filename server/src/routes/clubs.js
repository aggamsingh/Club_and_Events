import { Router } from 'express';
import { z } from 'zod';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { Event } from '../models/Event.js';
import { Rsvp } from '../models/Rsvp.js';
import { User } from '../models/User.js';
import { deletePoster } from '../services/posterStorage.js';
import { forbidden, notFound } from '../utils/httpError.js';
import { email, idParams, password } from '../utils/schemas.js';
import { serializeClub, serializeUser } from '../utils/serializers.js';

export const clubsRouter = Router();

const clubName = z.string().trim().min(2, 'Club name is too short.').max(100);
const clubDescription = z.string().trim().max(1000);

async function loadClub(id) {
  const club = await User.findOne({ _id: id, role: 'club' });
  if (!club) throw notFound('Club not found.');
  return club;
}

// GET /api/clubs — public directory with upcoming-event counts (admins also see login emails)
clubsRouter.get('/', optionalAuth, async (req, res) => {
  const [clubs, counts] = await Promise.all([
    User.find({ role: 'club' }).collation({ locale: 'en' }).sort({ name: 1 }).lean(),
    Event.aggregate([{ $match: { endDate: { $gte: new Date() } } }, { $group: { _id: '$club', n: { $sum: 1 } } }]),
  ]);
  const upcoming = new Map(counts.map((c) => [String(c._id), c.n]));
  const isAdmin = req.user?.role === 'admin';
  res.json({
    items: clubs.map((c) =>
      serializeClub(c, { upcomingCount: upcoming.get(String(c._id)) ?? 0, ...(isAdmin && { email: c.email }) }),
    ),
  });
});

// GET /api/clubs/:id — public profile
clubsRouter.get('/:id', validate({ params: idParams }), async (req, res) => {
  const club = await loadClub(req.valid.params.id);
  res.json({ club: serializeClub(club) });
});

// POST /api/clubs — admin creates a club account
clubsRouter.post(
  '/',
  requireAuth('admin'),
  validate({ body: z.object({ name: clubName, email, password, description: clubDescription.default('') }) }),
  async (req, res) => {
    const { password: pw, ...fields } = req.valid.body;
    const club = new User({ ...fields, role: 'club' });
    await club.setPassword(pw);
    await club.save();
    res.status(201).json({ club: serializeUser(club) });
  },
);

// PATCH /api/clubs/:id — admin edits anything; a club may edit its own description
clubsRouter.patch(
  '/:id',
  requireAuth('admin', 'club'),
  validate({ params: idParams, body: z.object({ name: clubName.optional(), description: clubDescription.optional() }) }),
  async (req, res) => {
    const club = await loadClub(req.valid.params.id);
    const isSelf = club._id.equals(req.user._id);
    if (req.user.role !== 'admin' && !isSelf) throw forbidden();
    if (req.user.role !== 'admin' && req.valid.body.name !== undefined) {
      throw forbidden('Only an admin can rename a club.');
    }
    club.set(req.valid.body);
    await club.save();
    res.json({ club: serializeUser(club) });
  },
);

// POST /api/clubs/:id/reset-password — admin sets a new password and revokes sessions
clubsRouter.post(
  '/:id/reset-password',
  requireAuth('admin'),
  validate({ params: idParams, body: z.object({ password }) }),
  async (req, res) => {
    const club = await loadClub(req.valid.params.id);
    await club.setPassword(req.valid.body.password);
    club.tokenVersion += 1;
    await club.save();
    res.status(204).end();
  },
);

// DELETE /api/clubs/:id — admin removes a club and everything it owns
clubsRouter.delete('/:id', requireAuth('admin'), validate({ params: idParams }), async (req, res) => {
  const club = await loadClub(req.valid.params.id);
  const events = await Event.find({ club: club._id }, { _id: 1, poster: 1 }).lean();
  const eventIds = events.map((e) => e._id);
  await club.deleteOne();
  await Promise.all([
    Event.deleteMany({ _id: { $in: eventIds } }),
    Rsvp.deleteMany({ event: { $in: eventIds } }),
    ...events.map((e) => deletePoster(e.poster)),
  ]);
  res.status(204).end();
});
