import mongoose from 'mongoose';

export const CATEGORIES = ['technical', 'cultural', 'sports', 'workshop', 'seminar', 'social', 'other'];

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 5000, default: '' },
    category: { type: String, enum: CATEGORIES, default: 'other' },
    venue: { type: String, required: true, trim: true, maxlength: 200 },
    startDate: { type: Date, required: true },
    endDate: {
      type: Date,
      required: true,
      validate: {
        validator(value) {
          return !this.startDate || value > this.startDate;
        },
        message: 'End time must be after the start time.',
      },
    },
    club: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // GridFS file id in the "posters" bucket; null means "use the generated placeholder".
    poster: { type: mongoose.Schema.Types.ObjectId, default: null },
    registerLink: { type: String, trim: true, default: null },
    // null = unlimited seats.
    capacity: { type: Number, min: 1, default: null },
    // Denormalised count of Rsvp documents, maintained atomically (see rsvp controller).
    rsvpCount: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true },
);

// Feed queries filter on endDate (upcoming/past) and sort on startDate.
eventSchema.index({ endDate: 1, startDate: 1 });
// Club pages and dashboards.
eventSchema.index({ club: 1, startDate: -1 });
eventSchema.index({ category: 1, endDate: 1 });

export const Event = mongoose.model('Event', eventSchema);
