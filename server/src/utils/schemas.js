import mongoose from 'mongoose';
import { z } from 'zod';
import { CATEGORIES } from '../models/Event.js';

export const objectId = z
  .string()
  .refine((v) => mongoose.isValidObjectId(v) && /^[a-f\d]{24}$/i.test(v), 'Invalid id.');

export const idParams = z.object({ id: objectId });

export const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.'));

export const password = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(72, 'Password must be at most 72 characters.'); // bcrypt only uses the first 72 bytes

export const personName = z.string().trim().min(2, 'Name is too short.').max(100);

// multipart/form-data sends everything as strings; treat empty strings as "not provided".
const emptyToNull = (v) => (v === '' || v === 'null' || v === undefined ? null : v);

export const eventBody = z
  .object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters.').max(120),
    description: z.string().trim().max(5000).default(''),
    category: z.enum(CATEGORIES).default('other'),
    venue: z.string().trim().min(2, 'Venue is required.').max(200),
    startDate: z.coerce.date({ error: 'Start time is required.' }),
    endDate: z.coerce.date({ error: 'End time is required.' }),
    registerLink: z.preprocess(
      emptyToNull,
      z.url({ protocol: /^https?$/, error: 'Must be a valid http(s) link.' }).max(500).nullable(),
    ),
    capacity: z.preprocess(emptyToNull, z.coerce.number().int().min(1).max(100_000).nullable()),
    removePoster: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => v === 'true'),
  })
  .refine((d) => d.endDate > d.startDate, {
    path: ['endDate'],
    message: 'End time must be after the start time.',
  });

export const eventListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.enum(CATEGORIES).optional(),
  club: objectId.optional(),
  when: z.enum(['upcoming', 'past', 'all']).default('upcoming'),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});
