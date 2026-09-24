import { Router } from 'express';
import mongoose from 'mongoose';
import { validate } from '../middleware/validate.js';
import { findPoster, openPosterStream } from '../services/posterStorage.js';
import { notFound } from '../utils/httpError.js';
import { idParams } from '../utils/schemas.js';

export const postersRouter = Router();

// GET /api/posters/:id — streams an image out of GridFS
postersRouter.get('/:id', validate({ params: idParams }), async (req, res) => {
  const id = new mongoose.Types.ObjectId(req.valid.params.id);
  const file = await findPoster(id);
  if (!file) throw notFound('Poster not found.');

  // A replaced poster always gets a new id, so a given URL's bytes never change:
  // browsers and CDNs may cache it forever.
  res.set({
    'Content-Type': file.metadata?.contentType ?? 'application/octet-stream',
    'Content-Length': String(file.length),
    'Cache-Control': 'public, max-age=31536000, immutable',
    ETag: `"${file._id}"`,
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
  if (req.headers['if-none-match'] === `"${file._id}"`) return res.status(304).end();

  const stream = openPosterStream(id);
  stream.on('error', (err) => res.destroy(err));
  stream.pipe(res);
});
