import multer from 'multer';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { HttpError } from '../utils/httpError.js';

/** Every error response has the same shape: { error: { message, fields? } } */
function send(res, status, message, fields) {
  res.status(status).json({ error: fields ? { message, fields } : { message } });
}

export function zodFields(error) {
  const fields = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  return fields;
}

export function notFoundHandler(req, res) {
  send(res, 404, `Route ${req.method} ${req.originalUrl} not found.`);
}

// Express recognises error handlers by their 4-argument signature.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) return send(res, err.status, err.message, err.fields);

  if (err instanceof ZodError) return send(res, 400, 'Please fix the highlighted fields.', zodFields(err));

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return send(res, 413, 'Poster must be 5 MB or smaller.');
    return send(res, 400, `Upload error: ${err.message}`);
  }

  if (err instanceof mongoose.Error.CastError) return send(res, 400, `Invalid value for "${err.path}".`);

  if (err instanceof mongoose.Error.ValidationError) {
    const fields = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
    return send(res, 400, 'Please fix the highlighted fields.', fields);
  }

  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue ?? err.keyPattern ?? {})[0] ?? 'value';
    return send(res, 409, `That ${field} is already taken.`, { [field]: `This ${field} is already in use.` });
  }

  // body-parser errors (malformed JSON, payload too large) carry their own 4xx status.
  if (err?.status >= 400 && err.status < 500) {
    const message = err.type === 'entity.parse.failed' ? 'Malformed JSON body.' : err.message;
    return send(res, err.status, message);
  }

  console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  send(res, 500, 'Something went wrong on our side. Please try again.');
}
