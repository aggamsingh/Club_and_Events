import { useQuery } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState, ErrorState, PageHeader, PageSpinner } from '../components/ui';
import { api } from '../lib/api';

export default function ClubsPage() {
  const { data, isPending, error, refetch } = useQuery({ queryKey: ['clubs'], queryFn: () => api('/api/clubs') });

  return (
    <>
      <title>Clubs · EventHub</title>
      <PageHeader title="Clubs" subtitle="Student clubs and societies organising events on campus." />
      {isPending ? (
        <PageSpinner />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : data.items.length === 0 ? (
        <EmptyState icon={Building2} title="No clubs yet">
          An admin needs to create club accounts first.
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((club) => (
            <Link
              key={club.id}
              to={`/clubs/${club.id}`}
              className="card group flex flex-col gap-3 p-6 transition hover:-translate-y-0.5 hover:border-brand-500/40"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-xl bg-brand-500/15 text-lg font-bold text-brand-300">
                  {club.name.charAt(0).toUpperCase()}
                </div>
                <h2 className="font-semibold text-white group-hover:text-brand-300">{club.name}</h2>
              </div>
              <p className="line-clamp-2 flex-1 text-sm text-slate-400">{club.description || 'No description yet.'}</p>
              <p className="text-xs font-medium text-slate-500">
                {club.upcomingCount} upcoming {club.upcomingCount === 1 ? 'event' : 'events'}
              </p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
