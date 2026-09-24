import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { Alert, Button, Field } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { HOME_FOR_ROLE } from '../lib/constants';
import { safeNext } from '../lib/redirect';

function AuthCard({ title, subtitle, children, footer }) {
  return (
    <div className="mx-auto max-w-md">
      <div className="card p-8">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <p className="mt-1 mb-6 text-sm text-slate-400">{subtitle}</p>
        {children}
      </div>
      <p className="mt-6 text-center text-sm text-slate-400">{footer}</p>
    </div>
  );
}

function useAfterAuth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return (user) => navigate(safeNext(params.get('next')) ?? HOME_FOR_ROLE[user.role] ?? '/', { replace: true });
}

export function LoginPage() {
  const { user, login } = useAuth();
  const afterAuth = useAfterAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (user && !busy) return <Navigate to={HOME_FOR_ROLE[user.role]} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      afterAuth(await login(form.email, form.password));
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Log in as a student, club or admin."
      footer={
        <>
          New here?{' '}
          <Link to="/register" className="font-medium text-brand-300 hover:underline">
            Create a student account
          </Link>
        </>
      }
    >
      <title>Log in · EventHub</title>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email" error={error?.fields?.email}>
          {(p) => (
            <input
              {...p}
              type="email"
              autoComplete="email"
              required
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          )}
        </Field>
        <Field label="Password" error={error?.fields?.password}>
          {(p) => (
            <input
              {...p}
              type="password"
              autoComplete="current-password"
              required
              className="input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          )}
        </Field>
        <Alert>{error && !error.fields?.email && !error.fields?.password ? error.message : null}</Alert>
        <Button type="submit" className="w-full" loading={busy}>
          Log in
        </Button>
      </form>
    </AuthCard>
  );
}

export function RegisterPage() {
  const { user, register } = useAuth();
  const afterAuth = useAfterAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (user && !busy) return <Navigate to={HOME_FOR_ROLE[user.role]} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      afterAuth(await register(form));
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <AuthCard
      title="Create your account"
      subtitle="Students can RSVP to events and keep track of them in one place."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-300 hover:underline">
            Log in
          </Link>
          <span className="mt-2 block text-xs text-slate-500">Running a club? Ask a campus admin for a club account.</span>
        </>
      }
    >
      <title>Sign up · EventHub</title>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Full name" error={error?.fields?.name}>
          {(p) => <input {...p} autoComplete="name" required className="input" value={form.name} onChange={set('name')} />}
        </Field>
        <Field label="Email" error={error?.fields?.email}>
          {(p) => (
            <input {...p} type="email" autoComplete="email" required className="input" value={form.email} onChange={set('email')} />
          )}
        </Field>
        <Field label="Password" error={error?.fields?.password} hint="At least 8 characters.">
          {(p) => (
            <input
              {...p}
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              className="input"
              value={form.password}
              onChange={set('password')}
            />
          )}
        </Field>
        <Alert>{error && !error.fields ? error.message : null}</Alert>
        <Button type="submit" className="w-full" loading={busy}>
          Create account
        </Button>
      </form>
    </AuthCard>
  );
}
