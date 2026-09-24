/**
 * Explicit API shapes. Controllers never return raw Mongoose documents, so internal
 * fields (passwordHash, tokenVersion, __v) can't leak and the contract is documented here.
 */

export function serializeUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    description: user.description ?? '',
    createdAt: user.createdAt,
  };
}

export function serializeClub(club, extra = {}) {
  return {
    id: String(club._id),
    name: club.name,
    description: club.description ?? '',
    ...extra,
  };
}

export function serializeEvent(event, extra = {}) {
  const club = event.club && typeof event.club === 'object' && 'name' in event.club
    ? { id: String(event.club._id), name: event.club.name }
    : { id: String(event.club), name: null };
  const now = Date.now();

  return {
    id: String(event._id),
    title: event.title,
    description: event.description ?? '',
    category: event.category,
    venue: event.venue,
    startDate: event.startDate,
    endDate: event.endDate,
    club,
    posterUrl: event.poster ? `/api/posters/${event.poster}` : null,
    registerLink: event.registerLink ?? null,
    capacity: event.capacity ?? null,
    rsvpCount: event.rsvpCount ?? 0,
    isFull: event.capacity != null && event.rsvpCount >= event.capacity,
    status: event.endDate < now ? 'past' : event.startDate <= now ? 'live' : 'upcoming',
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    ...extra,
  };
}
