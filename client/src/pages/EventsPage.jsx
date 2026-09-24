import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CalendarX, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { EventGrid } from '../components/EventCard';
import { Pagination } from '../components/Pagination';
import { Button, EmptyState, ErrorState } from '../components/ui';
import { api, toQueryString } from '../lib/api';
import { CATEGORIES } from '../lib/constants';
import { cx } from '../lib/cx';

const PAGE_SIZE = 12;

/**
 * Filters live in the URL (?q=&category=&club=&when=&page=) so results are shareable,
 * bookmarkable and survive refresh/back navigation.
 */
export default function EventsPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const club = params.get('club') ?? '';
  const when = params.get('when') === 'past' ? 'past' : 'upcoming';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [search, setSearch] = useState(q);

  const update = (changes) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        if (!('page' in changes)) next.delete('page'); // any filter change → back to page 1
        return next;
      },
      { replace: !('page' in changes) },
    );
  };

  // Debounce typing into the URL so we don't fire a request per keystroke.
  useEffect(() => {
    if (search.trim() === q) return;
    const t = setTimeout(() => update({ q: search.trim() }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const clubs = useQuery({ queryKey: ['clubs'], queryFn: () => api('/api/clubs'), staleTime: 5 * 60 * 1000 });
  const events = useQuery({
    queryKey: ['events', { q, category, club, when, page }],
    queryFn: ({ signal }) =>
      api(`/api/events${toQueryString({ q, category, club, when, page, limit: PAGE_SIZE })}`, { signal }),
    placeholderData: keepPreviousData, // keep old results on screen while the next page loads
  });

  const hasFilters = Boolean(q || category || club);
  const clearFilters = () => {
    setSearch('');
    update({ q: '', category: '', club: '' });
  };

  return (
    <>
      <title>EventHub · Campus events</title>
      <section className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
          What’s happening on <span className="text-brand-400">campus</span>
        </h1>
        <p className="mt-3 text-lg text-slate-400">Every club event in one place — find one, RSVP, add it to your calendar.</p>

        <div className="relative mx-auto mt-8 max-w-xl">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-slate-500" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events, venues, topics…"
            aria-label="Search events"
            className="input h-12 rounded-xl pl-12 text-base"
          />
        </div>
      </section>

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label="Time range" className="inline-flex self-start rounded-xl border border-line bg-panel p-1">
          {['upcoming', 'past'].map((w) => (
            <button
              key={w}
              role="tab"
              aria-selected={when === w}
              onClick={() => update({ when: w === 'upcoming' ? '' : w })}
              className={cx(
                'rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition',
                when === w ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white',
              )}
            >
              {w}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => update({ category: category === c.value ? '' : c.value })}
              aria-pressed={category === c.value}
              className={cx(
                'rounded-full px-3 py-1 text-xs font-medium ring-1 transition ring-inset',
                category === c.value ? c.badge : 'text-slate-400 ring-line hover:text-white',
              )}
            >
              {c.label}
            </button>
          ))}
          <select
            value={club}
            onChange={(e) => update({ club: e.target.value })}
            aria-label="Filter by club"
            className="input h-8 w-auto py-0 text-xs"
          >
            <option value="">All clubs</option>
            {clubs.data?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="size-3.5" aria-hidden /> Clear
            </Button>
          )}
        </div>
      </div>

      {events.isError ? (
        <ErrorState error={events.error} onRetry={events.refetch} />
      ) : events.data?.items.length === 0 ? (
        <EmptyState
          icon={CalendarX}
          title={hasFilters ? 'No events match your filters' : when === 'past' ? 'No past events yet' : 'No upcoming events yet'}
          action={hasFilters && <Button variant="secondary" onClick={clearFilters}>Clear filters</Button>}
        >
          {hasFilters ? 'Try a different search or category.' : 'Check back soon — clubs add new events all the time.'}
        </EmptyState>
      ) : (
        <>
          {events.data && (
            <p className="mb-4 text-sm text-slate-500" aria-live="polite">
              {events.data.total} {events.data.total === 1 ? 'event' : 'events'}
            </p>
          )}
          <div className={cx('transition-opacity', events.isPlaceholderData && 'opacity-60')}>
            <EventGrid events={events.data?.items ?? []} loading={events.isPending} />
          </div>
          <Pagination
            page={page}
            totalPages={events.data?.totalPages ?? 1}
            onChange={(p) => {
              update({ page: p > 1 ? String(p) : '' });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </>
      )}
    </>
  );
}
