import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarDays,
  CalendarPlus,
  CircleCheck,
  Download,
  ExternalLink,
  MapPin,
  Pencil,
  Trash2,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Poster } from '../components/Poster';
import {
  Alert,
  AnchorButton,
  Button,
  CategoryBadge,
  EmptyState,
  ErrorState,
  LinkButton,
  PageSpinner,
  Spinner,
  StatusBadge,
} from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { api, apiUrl } from '../lib/api';
import { formatDateRange, formatDateTime } from '../lib/format';

function CapacityBar({ event }) {
  if (event.capacity == null) {
    return <p className="text-sm text-slate-400">{event.rsvpCount} going · unlimited seats</p>;
  }
  const pct = Math.min(100, Math.round((event.rsvpCount / event.capacity) * 100));
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-sm">
        <span className="text-slate-300">
          {event.rsvpCount} / {event.capacity} going
        </span>
        <span className="text-slate-500">{event.isFull ? 'Full' : `${event.capacity - event.rsvpCount} left`}</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuenow={event.rsvpCount}
        aria-valuemin={0}
        aria-valuemax={event.capacity}
        aria-label="Seats taken"
      >
        <div className={`h-full rounded-full ${event.isFull ? 'bg-amber-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RsvpPanel({ event, viewer }) {
  const { user } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const toast = useToast();

  const onDone = (message) => {
    queryClient.invalidateQueries({ queryKey: ['event', event.id] });
    queryClient.invalidateQueries({ queryKey: ['events'] });
    queryClient.invalidateQueries({ queryKey: ['my-rsvps'] });
    toast.success(message);
  };
  const rsvp = useMutation({
    mutationFn: () => api(`/api/events/${event.id}/rsvp`, { method: 'POST' }),
    onSuccess: () => onDone("You're in! See you there."),
    onError: () => queryClient.invalidateQueries({ queryKey: ['event', event.id] }),
  });
  const cancel = useMutation({
    mutationFn: () => api(`/api/events/${event.id}/rsvp`, { method: 'DELETE' }),
    onSuccess: () => onDone('RSVP cancelled.'),
  });

  let action;
  if (event.status === 'past') {
    action = <p className="text-sm text-slate-400">This event has ended.</p>;
  } else if (!user) {
    action = (
      <LinkButton to={`/login?next=${encodeURIComponent(location.pathname)}`} className="w-full">
        Log in to RSVP
      </LinkButton>
    );
  } else if (user.role !== 'student') {
    action = <p className="text-sm text-slate-400">RSVPs are for student accounts.</p>;
  } else if (viewer.hasRsvp) {
    action = (
      <div className="space-y-3">
        <p className="flex items-center gap-2 font-semibold text-emerald-300">
          <CircleCheck className="size-5" aria-hidden /> You're going
        </p>
        <Button variant="secondary" className="w-full" loading={cancel.isPending} onClick={() => cancel.mutate()}>
          Cancel RSVP
        </Button>
      </div>
    );
  } else {
    action = (
      <Button className="w-full" size="lg" disabled={event.isFull} loading={rsvp.isPending} onClick={() => rsvp.mutate()}>
        {event.isFull ? 'Event is full' : 'RSVP — reserve my seat'}
      </Button>
    );
  }

  return (
    <div className="card space-y-5 p-6">
      <CapacityBar event={event} />
      {action}
      <Alert>{rsvp.error?.message ?? cancel.error?.message}</Alert>
      <div className="flex flex-col gap-2 border-t border-line pt-5">
        <AnchorButton variant="secondary" href={apiUrl(`/api/events/${event.id}/calendar.ics`)} download>
          <CalendarPlus className="size-4" aria-hidden /> Add to calendar
        </AnchorButton>
        {event.registerLink && (
          <AnchorButton variant="ghost" href={event.registerLink} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" aria-hidden /> External registration
          </AnchorButton>
        )}
      </div>
    </div>
  );
}

function AttendeesPanel({ eventId }) {
  const { data, isPending, error } = useQuery({
    queryKey: ['attendees', eventId],
    queryFn: () => api(`/api/events/${eventId}/attendees`),
  });

  return (
    <section className="card p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-white">Attendees {data && <span className="text-slate-500">({data.total})</span>}</h2>
        {data?.total > 0 && (
          <AnchorButton variant="secondary" size="sm" href={apiUrl(`/api/events/${eventId}/attendees?format=csv`)} download>
            <Download className="size-4" aria-hidden /> CSV
          </AnchorButton>
        )}
      </div>
      {isPending ? (
        <Spinner />
      ) : error ? (
        <Alert>{error.message}</Alert>
      ) : data.total === 0 ? (
        <p className="text-sm text-slate-400">No RSVPs yet.</p>
      ) : (
        <div className="-mx-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="px-2 py-2 font-medium">Name</th>
                <th className="px-2 py-2 font-medium">Email</th>
                <th className="px-2 py-2 font-medium">RSVP’d</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.items.map((a) => (
                <tr key={a.email}>
                  <td className="px-2 py-2 text-slate-200">{a.name}</td>
                  <td className="px-2 py-2 text-slate-400">{a.email}</td>
                  <td className="px-2 py-2 whitespace-nowrap text-slate-500">{formatDateTime(a.rsvpAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['event', id, user?.id ?? 'anon'],
    queryFn: () => api(`/api/events/${id}`),
  });

  const remove = useMutation({
    mutationFn: () => api(`/api/events/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['my-events'] });
      toast.success('Event deleted.');
      navigate(user?.role === 'club' ? '/dashboard' : '/', { replace: true });
    },
  });

  if (isPending) return <PageSpinner />;
  if (error?.status === 404 || error?.status === 400) {
    return (
      <EmptyState title="Event not found" action={<LinkButton to="/">Browse events</LinkButton>}>
        It may have been removed by the organiser.
      </EmptyState>
    );
  }
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const { event, viewer } = data;

  return (
    <>
      <title>{`${event.title} · EventHub`}</title>
      <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="size-4" aria-hidden /> All events
      </Link>

      <div className="overflow-hidden rounded-2xl border border-line">
        <Poster event={event} eager className="aspect-21/9 max-h-[420px] w-full" />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              <CategoryBadge category={event.category} />
              <StatusBadge event={event} />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{event.title}</h1>
            <ul className="mt-5 space-y-2.5 text-slate-300">
              <li className="flex items-start gap-3">
                <CalendarDays className="mt-0.5 size-5 shrink-0 text-brand-400" aria-hidden />
                {formatDateRange(event.startDate, event.endDate)}
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-5 shrink-0 text-brand-400" aria-hidden />
                {event.venue}
              </li>
              <li className="flex items-start gap-3">
                <Users className="mt-0.5 size-5 shrink-0 text-brand-400" aria-hidden />
                <span>
                  Organised by{' '}
                  <Link to={`/clubs/${event.club.id}`} className="font-medium text-brand-300 hover:underline">
                    {event.club.name}
                  </Link>
                </span>
              </li>
            </ul>
          </div>

          {viewer.canManage && (
            <div className="flex flex-wrap gap-2">
              <LinkButton variant="secondary" to={`/dashboard/events/${event.id}/edit`}>
                <Pencil className="size-4" aria-hidden /> Edit event
              </LinkButton>
              <Button variant="danger-ghost" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-4" aria-hidden /> Delete
              </Button>
            </div>
          )}

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">About this event</h2>
            {event.description ? (
              // Rendered as text (React escapes it) — never as HTML. v1 used innerHTML here (XSS).
              <p className="leading-relaxed whitespace-pre-line text-slate-300">{event.description}</p>
            ) : (
              <p className="text-slate-500">No description provided.</p>
            )}
          </section>

          {event.clubDescription && (
            <section className="card p-5">
              <h2 className="text-sm font-semibold text-slate-400">About {event.club.name}</h2>
              <p className="mt-1 text-sm text-slate-300">{event.clubDescription}</p>
            </section>
          )}

          {viewer.canManage && <AttendeesPanel eventId={event.id} />}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <RsvpPanel event={event} viewer={viewer} />
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this event?"
        confirmLabel="Delete event"
        busy={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => remove.mutate()}
        onClose={() => {
          setConfirmDelete(false);
          remove.reset();
        }}
      >
        “{event.title}” and its {event.rsvpCount} RSVP{event.rsvpCount === 1 ? '' : 's'} will be permanently removed.
      </ConfirmDialog>
    </>
  );
}
