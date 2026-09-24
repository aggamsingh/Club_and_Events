import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import { getConfig } from './config.js';
import { isDbReady } from './db.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { adminRouter } from './routes/admin.js';
import { authRouter } from './routes/auth.js';
import { clubsRouter } from './routes/clubs.js';
import { eventsRouter } from './routes/events.js';
import { meRouter } from './routes/me.js';
import { postersRouter } from './routes/posters.js';

const CLIENT_DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');

/** Builds the Express app without starting it, so tests can drive it with supertest. */
export function createApp() {
  const config = getConfig();
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'img-src': ["'self'", 'data:', 'blob:'],
        },
      },
    }),
  );
  if (config.crossSite) {
    app.use(cors({ origin: config.clientOrigins, credentials: true }));
    // With SameSite=None cookies, a plain cross-site <form> POST would carry the session.
    // Requiring a custom header forces a CORS preflight, which only allowlisted origins pass.
    app.use('/api', (req, res, next) => {
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.get('X-Requested-With')) return next();
      res.status(403).json({ error: { message: 'Missing X-Requested-With header.' } });
    });
  }
  app.use(compression());
  if (!config.isTest) app.use(morgan(config.isProd ? 'combined' : 'dev'));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const api = express.Router();
  api.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 600,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      skip: () => config.isTest,
      message: { error: { message: 'Too many requests. Please slow down.' } },
    }),
  );
  api.get('/health', (req, res) => {
    const ok = isDbReady();
    res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'degraded', db: ok ? 'connected' : 'disconnected' });
  });
  api.use('/auth', authRouter);
  api.use('/events', eventsRouter);
  api.use('/clubs', clubsRouter);
  api.use('/me', meRouter);
  api.use('/admin', adminRouter);
  api.use('/posters', postersRouter);
  api.use(notFoundHandler);
  app.use('/api', api);

  // In production the API also serves the built React app from the same origin,
  // which keeps the session cookie first-party and removes the need for CORS.
  if (fs.existsSync(CLIENT_DIST)) {
    app.use(
      '/assets',
      express.static(path.join(CLIENT_DIST, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }),
    );
    app.use(express.static(CLIENT_DIST, { index: false, maxAge: '1h' }));
    // SPA fallback: any other GET renders index.html and React Router takes over.
    app.get('/{*splat}', (req, res) => {
      res.set('Cache-Control', 'no-cache').sendFile(path.join(CLIENT_DIST, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
