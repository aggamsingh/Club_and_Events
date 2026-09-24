import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Button, Field, PageHeader } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { api } from '../lib/api';

export default function AccountPage() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [mismatch, setMismatch] = useState(false);

  const change = useMutation({
    mutationFn: () =>
      api('/api/auth/password', {
        method: 'PATCH',
        body: { currentPassword: form.currentPassword, newPassword: form.newPassword },
      }),
    onSuccess: (data) => {
      setUser(data.user);
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      toast.success('Password changed. Other devices have been logged out.');
    },
  });

  const submit = (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) return setMismatch(true);
    setMismatch(false);
    change.mutate();
  };
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const fields = change.error?.fields ?? {};

  return (
    <div className="mx-auto max-w-xl">
      <title>Account · EventHub</title>
      <PageHeader title="Account" />
      <section className="card mb-8 p-6">
        <dl className="grid grid-cols-[120px_1fr] gap-y-3 text-sm">
          <dt className="text-slate-500">Name</dt>
          <dd className="text-slate-200">{user.name}</dd>
          <dt className="text-slate-500">Email</dt>
          <dd className="text-slate-200">{user.email}</dd>
          <dt className="text-slate-500">Account type</dt>
          <dd className="text-slate-200 capitalize">{user.role}</dd>
        </dl>
      </section>

      <section className="card p-6">
        <h2 className="mb-1 text-lg font-semibold text-white">Change password</h2>
        <p className="mb-5 text-sm text-slate-400">This logs you out everywhere else.</p>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Current password" error={fields.currentPassword}>
            {(p) => (
              <input {...p} type="password" autoComplete="current-password" className="input" value={form.currentPassword} onChange={set('currentPassword')} />
            )}
          </Field>
          <Field label="New password" error={fields.newPassword} hint="At least 8 characters.">
            {(p) => <input {...p} type="password" autoComplete="new-password" className="input" value={form.newPassword} onChange={set('newPassword')} />}
          </Field>
          <Field label="Confirm new password" error={mismatch ? "Passwords don't match." : null}>
            {(p) => <input {...p} type="password" autoComplete="new-password" className="input" value={form.confirm} onChange={set('confirm')} />}
          </Field>
          <Alert>{change.error && !change.error.fields ? change.error.message : null}</Alert>
          <Button type="submit" loading={change.isPending}>
            Update password
          </Button>
        </form>
      </section>
    </div>
  );
}
