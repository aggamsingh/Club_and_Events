import { once } from 'node:events';
import mongoose from 'mongoose';
import multer from 'multer';
import { badRequest } from '../utils/httpError.js';

export const MAX_POSTER_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/**
 * Multer keeps the upload in memory (bounded by MAX_POSTER_BYTES) so we can inspect
 * the bytes before anything is persisted. There is no temp file to clean up on failure.
 */
export const posterUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_POSTER_BYTES, files: 1, fields: 20 },
  fileFilter(req, file, cb) {
    if (ALLOWED_TYPES.has(file.mimetype)) return cb(null, true);
    cb(badRequest('Poster must be a JPEG, PNG, WebP or GIF image.', { poster: 'Unsupported file type.' }));
  },
}).single('poster');

/**
 * The client-supplied mimetype is just a header, so identify the real format from the
 * file's magic bytes. This stops e.g. an HTML file renamed to .png from being stored.
 */
export function sniffImageType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.toString('ascii', 0, 4) === 'GIF8') return 'image/gif';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

function bucket() {
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'posters' });
}

/** Stores an uploaded poster in GridFS and returns its ObjectId. */
export async function savePoster(file) {
  const contentType = sniffImageType(file.buffer);
  if (!contentType) {
    throw badRequest('That file is not a valid image.', { poster: 'File content is not a supported image.' });
  }
  const upload = bucket().openUploadStream(file.originalname.slice(0, 200), {
    metadata: { contentType },
  });
  upload.end(file.buffer);
  await once(upload, 'finish');
  return upload.id;
}

export async function deletePoster(id) {
  if (!id) return;
  try {
    await bucket().delete(id);
  } catch (err) {
    // Already gone — deleting is idempotent from the caller's point of view.
    if (!/FileNotFound|File not found/i.test(err.message)) throw err;
  }
}

export async function findPoster(id) {
  return bucket().find({ _id: id }).next();
}

export function openPosterStream(id) {
  return bucket().openDownloadStream(id);
}
