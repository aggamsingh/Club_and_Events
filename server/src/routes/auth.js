import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { getConfig } from '../config.js';
import { clearSession, issueSession, optionalAuth, requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { User } from '../models/User.js';
import { badRequest, unauthorized } from '../utils/httpError.js';
import { email, password, personName } from '../utils/schemas.js';
import { serializeUser } from '../utils/serializers.js';

export const authRouter = Router();

// Brute-force protection: 10 attempts per IP per 15 minutes on credential endpoints.
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: () => getConfig().isTest,
  message: { error: { message: 'Too many attempts. Please wait 15 minutes and try again.' } },
});

// Public self-registration always creates a student. Clubs are created by an admin.
authRouter.post(
  '/register',
  credentialLimiter,
  validate({ body: z.object({ name: personName, email, password }) }),
  async (req, res) => {
    const { name, email: addr, password: pw } = req.valid.body;
    const user = new User({ name, email: addr, role: 'student' });
    await user.setPassword(pw);
    await user.save();
    issueSession(res, user);
    res.status(201).json({ user: serializeUser(user) });
  },
);

authRouter.post(
  '/login',
  credentialLimiter,
  validate({ body: z.object({ email, password: z.string().min(1, 'Password is required.').max(200) }) }),
  async (req, res) => {
    const user = await User.findByCredentials(req.valid.body.email, req.valid.body.password);
    if (!user) throw unauthorized('Incorrect email or password.');
    issueSession(res, user);
    res.json({ user: serializeUser(user) });
  },
);

authRouter.post('/logout', (req, res) => {
  clearSession(res);
  res.status(204).end();
});

// Returns { user: null } instead of 401 so the SPA can probe the session quietly.
authRouter.get('/me', optionalAuth, (req, res) => {
  res.json({ user: req.user ? serializeUser(req.user) : null });
});

authRouter.patch(
  '/password',
  requireAuth(),
  validate({ body: z.object({ currentPassword: z.string().min(1), newPassword: password }) }),
  async (req, res) => {
    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!(await user.checkPassword(req.valid.body.currentPassword))) {
      throw badRequest('Current password is incorrect.', { currentPassword: 'Incorrect password.' });
    }
    await user.setPassword(req.valid.body.newPassword);
    user.tokenVersion += 1; // log out every other device
    await user.save();
    issueSession(res, user); // …but keep this one logged in
    res.json({ user: serializeUser(user) });
  },
);
