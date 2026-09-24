import { Inbox, LoaderCircle, TriangleAlert } from 'lucide-react';
import { useId } from 'react';
import { Link } from 'react-router';
import { categoryInfo } from '../lib/constants';
import { cx } from '../lib/cx';

const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-500 shadow-lg shadow-brand-600/20',
  secondary: 'border border-line bg-white/5 text-slate-100 hover:bg-white/10',
  ghost: 'text-slate-300 hover:bg-white/5 hover:text-white',
  danger: 'bg-rose-600 text-white hover:bg-rose-500',
  'danger-ghost': 'text-rose-300 hover:bg-rose-500/10',
};
const SIZES = { sm: 'h-8 px-3 text-xs gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-6 text-base gap-2' };

const buttonClass = (variant = 'primary', size = 'md', className) =>
  cx(
    'inline-flex items-center justify-center rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-60',
    VARIANTS[variant],
    SIZES[size],
    className,
  );

export function Button({ variant, size, loading, className, children, type = 'button', disabled, ...props }) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} {...props}>
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function LinkButton({ variant, size, className, ...props }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function AnchorButton({ variant, size, className, ...props }) {
  return <a className={buttonClass(variant, size, className)} {...props} />;
}

/** Label + control + hint/error, wired up with ids for accessibility. */
export function Field({ label, error, hint, children, className }) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-300">
        {label}
      </label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-rose-400">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Alert({ tone = 'error', children, className }) {
  if (!children) return null;
  const tones = {
    error: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    info: 'border-brand-500/30 bg-brand-500/10 text-brand-300',
  };
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('rounded-lg border px-4 py-3 text-sm', tones[tone], className)}>
      {children}
    </div>
  );
}

export function Spinner({ className }) {
  return <LoaderCircle className={cx('animate-spin text-brand-400', className ?? 'size-6')} aria-label="Loading" />;
}

export function PageSpinner() {
  return (
    <div className="flex justify-center py-24">
      <Spinner className="size-8" />
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, children, action }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <Icon className="mb-4 size-10 text-slate-500" aria-hidden />
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {children && <p className="mt-1 max-w-md text-sm text-slate-400">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <EmptyState
      icon={TriangleAlert}
      title="Something went wrong"
      action={onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>}
    >
      {error?.message ?? 'Please try again.'}
    </EmptyState>
  );
}

export function Badge({ className, children }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', className)}>
      {children}
    </span>
  );
}

export function CategoryBadge({ category }) {
  const info = categoryInfo(category);
  return <Badge className={info.badge}>{info.label}</Badge>;
}

export function StatusBadge({ event }) {
  if (event.status === 'live') {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-300 ring-emerald-400/30">
        <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" /> Live now
      </Badge>
    );
  }
  if (event.status === 'past') return <Badge className="bg-slate-500/15 text-slate-400 ring-slate-400/20">Ended</Badge>;
  if (event.isFull) return <Badge className="bg-amber-500/15 text-amber-300 ring-amber-400/30">Full</Badge>;
  return null;
}

export function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      {Icon && (
        <div className="rounded-xl bg-brand-500/15 p-3 text-brand-300">
          <Icon className="size-5" aria-hidden />
        </div>
      )}
      <div>
        <div className="text-2xl font-bold text-white tabular-nums">{value ?? '—'}</div>
        <div className="text-sm text-slate-400">{label}</div>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
