import { useQuery } from '@tanstack/react-query';
import { Ticket } from 'lucide-react';
import { EventGrid } from '../components/EventCard';
import { EmptyState, ErrorState, LinkButton, PageHeader } from '../components/ui';
import { api } from '../lib/api';

export default function MyEventsPage() {
  const { data, isPending, error, refetch } = useQuery({ queryKey: ['my-rsvps'], queryFn: () => api('/api/me/rsvps') });

  return (
    <>
      <title>My events · EventHub</title>
      <PageHeader title="My events" subtitle="Events you've RSVPed to." />
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : !isPending && data.upcoming.length === 0 && data.past.length === 0 ? (
        <EmptyState icon={Ticket} title="No RSVPs yet" action={<LinkButton to="/">Find an event</LinkButton>}>
          When you RSVP to an event it shows up here.
        </EmptyState>
      ) : (
        <div className="space-y-12">
          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">Upcoming</h2>
            {!isPending && data.upcoming.length === 0 ? (
              <p className="text-slate-400">Nothing coming up.</p>
            ) : (
              <EventGrid events={data?.upcoming ?? []} loading={isPending} skeletons={3} />
            )}
          </section>
          {data?.past.length > 0 && (
            <section>
              <h2 className="mb-4 text-xl font-semibold text-white">Past</h2>
              <EventGrid events={data.past} />
            </section>
          )}
        </div>
      )}
    </>
  );
}
