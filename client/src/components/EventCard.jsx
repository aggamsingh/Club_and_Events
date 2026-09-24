import { CalendarDays, MapPin, Users } from 'lucide-react';
import { Link } from 'react-router';
import { formatDateTime, relativeDay, seatsLabel } from '../lib/format';
import { Poster } from './Poster';
import { CategoryBadge, StatusBadge } from './ui';

export function EventCard({ event }) {
  return (
    <article className="group card relative flex flex-col overflow-hidden transition duration-300 hover:-translate-y-1 hover:border-brand-500/40 hover:shadow-2xl hover:shadow-brand-600/10">
      <div className="relative aspect-16/10 overflow-hidden">
        <Poster event={event} className="size-full transition duration-500 group-hover:scale-105" />
        {/* Dark pill behind each badge keeps it legible on light poster photos. */}
        <div className="absolute top-3 left-3 flex gap-2 *:rounded-full *:bg-black/60 *:backdrop-blur-sm">
          <span>
            <CategoryBadge category={event.category} />
          </span>
          {(event.status !== 'upcoming' || event.isFull) && (
            <span>
              <StatusBadge event={event} />
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        {event.status === 'upcoming' && (
          <p className="text-xs font-semibold tracking-wide text-brand-300 uppercase">{relativeDay(event.startDate)}</p>
        )}
        <h3 className="text-lg leading-snug font-semibold text-white">
          {/* The stretched link makes the whole card clickable while keeping one link per card. */}
          <Link to={`/events/${event.id}`} className="after:absolute after:inset-0 focus:outline-none">
            {event.title}
          </Link>
        </h3>
        <ul className="space-y-1.5 text-sm text-slate-400">
          <li className="flex items-center gap-2">
            <CalendarDays className="size-4 shrink-0 text-brand-400" aria-hidden />
            <time dateTime={event.startDate}>{formatDateTime(event.startDate)}</time>
          </li>
          <li className="flex items-center gap-2">
            <MapPin className="size-4 shrink-0 text-brand-400" aria-hidden />
            <span className="truncate">{event.venue}</span>
          </li>
          <li className="flex items-center gap-2">
            <Users className="size-4 shrink-0 text-brand-400" aria-hidden />
            <span className="truncate">
              {event.club.name} · {seatsLabel(event)}
            </span>
          </li>
        </ul>
      </div>
    </article>
  );
}

export function EventCardSkeleton() {
  return (
    <div className="card overflow-hidden" aria-hidden>
      <div className="aspect-16/10 animate-pulse bg-white/5" />
      <div className="space-y-3 p-5">
        <div className="h-3 w-20 animate-pulse rounded bg-white/5" />
        <div className="h-5 w-3/4 animate-pulse rounded bg-white/10" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-white/5" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-white/5" />
      </div>
    </div>
  );
}

export function EventGrid({ events, loading, skeletons = 6 }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {loading
        ? Array.from({ length: skeletons }, (_, i) => <EventCardSkeleton key={i} />)
        : events.map((event) => <EventCard key={event.id} event={event} />)}
    </div>
  );
}
