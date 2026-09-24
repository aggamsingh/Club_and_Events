import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CalendarCheck, CalendarDays, KeyRound, Ticket, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Alert, Button, EmptyState, ErrorState, Field, PageHeader, PageSpinner, StatCard } from '../components/ui';
import { useToast } from '../hooks/useToast';
import { api } from '../lib/api';

const EMPTY_CLUB = { name: '', email: '', password: '', description: '' };

/** Suggests a readable random password the admin can hand to the club. */
function generatePassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

function CreateClubForm() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_CLUB);

  const create = useMutation({
    mutationFn: () => api('/api/clubs', { method: 'POST', body: form }),
    onSuccess: ({ club }) => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      toast.success(`Club "${club.name}" created. Share the login email and password with them.`);
      setForm(EMPTY_CLUB);
    },
  });
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const fields = create.error?.fields ?? {};

  return (
    <form
      className="card space-y-4 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
      noValidate
    >
      <h2 className="text-lg font-semibold text-white">Create a club account</h2>
      <Field label="Club name" error={fields.name}>
        {(p) => <input {...p} className="input" value={form.name} onChange={set('name')} />}
      </Field>
      <Field label="Login email" error={fields.email}>
        {(p) => <input {...p} type="email" autoComplete="off" className="input" value={form.email} onChange={set('email')} />}
      </Field>
      <Field label="Initial password" error={fields.password} hint="The club can change it from their account page.">
        {(p) => (
          <div className="flex gap-2">
            <input {...p} type="text" autoComplete="off" className="input font-mono" value={form.password} onChange={set('password')} />
            <Button variant="secondary" onClick={() => setForm({ ...form, password: generatePassword() })}>
              Generate
            </Button>
          </div>
        )}
      </Field>
      <Field label="Description" error={fields.description}>
        {(p) => <textarea {...p} rows={2} className="input" value={form.description} onChange={set('description')} />}
      </Field>
      <Alert>{create.error && !create.error.fields ? create.error.message : null}</Alert>
      <Button type="submit" className="w-full" loading={create.isPending}>
        Create club
      </Button>
    </form>
  );
}

export default function AdminPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [dialog, setDialog] = useState(null); // { type: 'delete' | 'reset', club }
  const [newPassword, setNewPassword] = useState('');

  const stats = useQuery({ queryKey: ['admin-stats'], queryFn: () => api('/api/admin/stats') });
  const clubs = useQuery({ queryKey: ['clubs', 'admin'], queryFn: () => api('/api/clubs') });

  const closeDialog = () => {
    setDialog(null);
    setNewPassword('');
    action.reset();
  };

  const action = useMutation({
    mutationFn: ({ type, club }) =>
      type === 'delete'
        ? api(`/api/clubs/${club.id}`, { method: 'DELETE' })
        : api(`/api/clubs/${club.id}/reset-password`, { method: 'POST', body: { password: newPassword } }),
    onSuccess: (_, { type, club }) => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success(type === 'delete' ? `Deleted "${club.name}".` : `Password reset for "${club.name}". Their other sessions were logged out.`);
      closeDialog();
    },
  });

  const s = stats.data?.stats;

  return (
    <>
      <title>Admin · EventHub</title>
      <PageHeader title="Admin" subtitle="Manage club accounts and keep an eye on the platform." />

      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Clubs" value={s?.clubs} icon={Building2} />
        <StatCard label="Students" value={s?.students} icon={Users} />
        <StatCard label="Events" value={s?.events} icon={CalendarDays} />
        <StatCard label="Upcoming" value={s?.upcomingEvents} icon={CalendarCheck} />
        <StatCard label="RSVPs" value={s?.rsvps} icon={Ticket} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <section>
          <h2 className="mb-4 text-xl font-semibold text-white">Clubs</h2>
          {clubs.isPending ? (
            <PageSpinner />
          ) : clubs.error ? (
            <ErrorState error={clubs.error} onRetry={clubs.refetch} />
          ) : clubs.data.items.length === 0 ? (
            <EmptyState icon={Building2} title="No clubs yet">
              Create the first club account with the form.
            </EmptyState>
          ) : (
            <ul className="card divide-y divide-line">
              {clubs.data.items.map((club) => (
                <li key={club.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <Link to={`/clubs/${club.id}`} className="font-semibold text-white hover:text-brand-300">
                      {club.name}
                    </Link>
                    <p className="truncate text-sm text-slate-400">{club.email}</p>
                    <p className="text-xs text-slate-500">{club.upcomingCount} upcoming</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setDialog({ type: 'reset', club })}>
                      <KeyRound className="size-4" aria-hidden /> Reset password
                    </Button>
                    <Button variant="danger-ghost" size="sm" onClick={() => setDialog({ type: 'delete', club })} aria-label={`Delete ${club.name}`}>
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside>
          <CreateClubForm />
        </aside>
      </div>

      <ConfirmDialog
        open={dialog?.type === 'delete'}
        title={`Delete ${dialog?.club.name}?`}
        confirmLabel="Delete club"
        busy={action.isPending}
        error={action.error?.message}
        onConfirm={() => action.mutate(dialog)}
        onClose={closeDialog}
      >
        This permanently deletes the club account, all of its events, their posters and every RSVP. This can’t be undone.
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog?.type === 'reset'}
        title={`Reset password for ${dialog?.club.name}`}
        confirmLabel="Set password"
        tone="primary"
        busy={action.isPending}
        error={action.error?.fields?.password ?? action.error?.message}
        onConfirm={() => action.mutate(dialog)}
        onClose={closeDialog}
      >
        <div className="mt-2 flex gap-2">
          <input
            aria-label="New password"
            className="input font-mono"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
          <Button variant="secondary" onClick={() => setNewPassword(generatePassword())}>
            Generate
          </Button>
        </div>
      </ConfirmDialog>
    </>
  );
}
