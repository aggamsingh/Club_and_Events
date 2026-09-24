import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { EventGrid } from '../components/EventCard';
import { EmptyState, ErrorState, LinkButton, PageSpinner } from '../components/ui';
import { api, toQueryString } from '../lib/api';
import { cx } from '../lib/cx';

export default function ClubPage() {
  const { id } = useParams();
  const [when, setWhen] = useState('upcoming');

  const club = useQuery({ queryKey: ['club', id], queryFn: () => api(`/api/clubs/${id}`) });
  const events = useQuery({
    queryKey: ['events', { club: id, when, limit: 50 }],
    queryFn: () => api(`/api/events${toQueryString({ club: id, when, limit: 50 })}`),
    enabled: club.isSuccess,
  });

  if (club.isPending) return <PageSpinner />;
  if (club.error?.status === 404 || club.error?.status === 400) {
    return <EmptyState title="Club not found" action={<LinkButton to="/clubs">All clubs</LinkButton>} />;
  }
  if (club.error) return <ErrorState error={club.error} onRetry={club.refetch} />;

  const { name, description } = club.data.club;
  return (
    <>
      <title>{`${name} · EventHub`}</title>
      <Link to="/clubs" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="size-4" aria-hidden /> All clubs
      </Link>
      <div className="card mb-10 flex flex-col gap-5 p-8 sm:flex-row sm:items-center">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-brand-500/15 text-2xl font-bold text-brand-300">
          {name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">{name}</h1>
          <p className="mt-1 text-slate-400">{description || 'No description yet.'}</p>
        </div>
      </div>

      <div className="mb-6 flex gap-2">
        {['upcoming', 'past'].map((w) => (
          <button
            key={w}
            onClick={() => setWhen(w)}
            aria-pressed={when === w}
            className={cx(
              'rounded-lg px-4 py-1.5 text-sm font-medium capitalize',
              when === w ? 'bg-brand-600 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white',
            )}
          >
            {w}
          </button>
        ))}
      </div>

      {events.isError ? (
        <ErrorState error={events.error} onRetry={events.refetch} />
      ) : events.data?.items.length === 0 ? (
        <EmptyState title={`No ${when} events`} />
      ) : (
        <EventGrid events={events.data?.items ?? []} loading={events.isPending} skeletons={3} />
      )}
    </>
  );
}
