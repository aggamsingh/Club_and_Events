import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, CalendarDays, Eye, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Poster } from '../components/Poster';
import {
  Alert,
  Button,
  EmptyState,
  ErrorState,
  Field,
  LinkButton,
  PageHeader,
  PageSpinner,
  StatCard,
  StatusBadge,
} from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { api } from '../lib/api';
import { formatDateTime } from '../lib/format';

function ProfileEditor() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [description, setDescription] = useState(user.description ?? '');

  const save = useMutation({
    mutationFn: () => api(`/api/clubs/${user.id}`, { method: 'PATCH', body: { description } }),
    onSuccess: ({ club }) => {
      setUser(club);
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      queryClient.invalidateQueries({ queryKey: ['club', user.id] });
      toast.success('Club profile updated.');
    },
  });

  return (
    <form
      className="card space-y-4 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <h2 className="text-lg font-semibold text-white">Club profile</h2>
      <Field label="Description" error={save.error?.fields?.description} hint="Shown on your club page and every event page.">
        {(p) => (
          <textarea {...p} rows={3} maxLength={1000} className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        )}
      </Field>
      <Alert>{save.error && !save.error.fields ? save.error.message : null}</Alert>
      <Button type="submit" variant="secondary" loading={save.isPending} disabled={description === (user.description ?? '')}>
        Save profile
      </Button>
    </form>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [toDelete, setToDelete] = useState(null);

  const { data, isPending, error, refetch } = useQuery({ queryKey: ['my-events'], queryFn: () => api('/api/me/events') });

  const remove = useMutation({
    mutationFn: (id) => api(`/api/events/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event deleted.');
      setToDelete(null);
    },
  });

  return (
    <>
      <title>Dashboard · EventHub</title>
      <PageHeader
        title={user.name}
        subtitle="Manage your club's events and see who's coming."
        actions={
          <LinkButton to="/dashboard/events/new">
            <Plus className="size-4" aria-hidden /> New event
          </LinkButton>
        }
      />

      {isPending ? (
        <PageSpinner />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <div className="space-y-10">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total events" value={data.stats.total} icon={CalendarDays} />
            <StatCard label="Upcoming" value={data.stats.upcoming} icon={CalendarCheck} />
            <StatCard label="Total RSVPs" value={data.stats.totalRsvps} icon={Users} />
          </div>

          <section>
            <h2 className="mb-4 text-xl font-semibold text-white">Your events</h2>
            {data.items.length === 0 ? (
              <EmptyState title="No events yet" action={<LinkButton to="/dashboard/events/new">Create your first event</LinkButton>}>
                Events you publish appear on the public feed immediately.
              </EmptyState>
            ) : (
              <ul className="card divide-y divide-line">
                {data.items.map((event) => (
                  <li key={event.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                    <Poster event={event} compact className="aspect-16/10 w-full shrink-0 rounded-lg sm:w-32" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/events/${event.id}`} className="truncate font-semibold text-white hover:text-brand-300">
                          {event.title}
                        </Link>
                        <StatusBadge event={event} />
                      </div>
                      <p className="mt-1 text-sm text-slate-400">
                        {formatDateTime(event.startDate)} · {event.venue}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {event.rsvpCount}
                        {event.capacity != null && ` / ${event.capacity}`} RSVPs
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <LinkButton variant="ghost" size="sm" to={`/events/${event.id}`} aria-label={`View ${event.title}`}>
                        <Eye className="size-4" aria-hidden /> View
                      </LinkButton>
                      <LinkButton variant="ghost" size="sm" to={`/dashboard/events/${event.id}/edit`} aria-label={`Edit ${event.title}`}>
                        <Pencil className="size-4" aria-hidden /> Edit
                      </LinkButton>
                      <Button variant="danger-ghost" size="sm" onClick={() => setToDelete(event)} aria-label={`Delete ${event.title}`}>
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <ProfileEditor />
        </div>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this event?"
        confirmLabel="Delete event"
        busy={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => remove.mutate(toDelete.id)}
        onClose={() => {
          setToDelete(null);
          remove.reset();
        }}
      >
        {toDelete && <>“{toDelete.title}” and all its RSVPs will be permanently removed.</>}
      </ConfirmDialog>
    </>
  );
}
