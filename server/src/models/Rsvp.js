import mongoose from 'mongoose';

const rsvpSchema = new mongoose.Schema(
  {
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// A student can RSVP to an event at most once; this index is the source of truth.
rsvpSchema.index({ event: 1, user: 1 }, { unique: true });
rsvpSchema.index({ user: 1, createdAt: -1 });

export const Rsvp = mongoose.model('Rsvp', rsvpSchema);
