import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ImagePlus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Poster } from '../components/Poster';
import { Alert, Button, EmptyState, ErrorState, Field, LinkButton, PageHeader, PageSpinner } from '../components/ui';
import { useToast } from '../hooks/useToast';
import { api, apiUrl } from '../lib/api';
import { CATEGORIES } from '../lib/constants';
import { formatBytes, fromDateTimeLocal, toDateTimeLocal } from '../lib/format';
import { validateEvent } from '../lib/validation';

const EMPTY = {
  title: '',
  category: 'technical',
  startDate: '',
  endDate: '',
  venue: '',
  capacity: '',
  registerLink: '',
  description: '',
};

function toFormValues(event) {
  return {
    title: event.title,
    category: event.category,
    startDate: toDateTimeLocal(event.startDate),
    endDate: toDateTimeLocal(event.endDate),
    venue: event.venue,
    capacity: event.capacity == null ? '' : String(event.capacity),
    registerLink: event.registerLink ?? '',
    description: event.description ?? '',
  };
}

/** Preview URL for a freshly picked file; revoked when it changes to avoid leaking memory. */
function useObjectUrl(file) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => url && URL.revokeObjectURL(url), [url]);
  return url;
}

function EventForm({ event }) {
  const isEdit = Boolean(event);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [values, setValues] = useState(isEdit ? toFormValues(event) : EMPTY);
  const [posterFile, setPosterFile] = useState(null);
  const [removePoster, setRemovePoster] = useState(false);
  const [clientErrors, setClientErrors] = useState({});
  const previewUrl = useObjectUrl(posterFile);

  const save = useMutation({
    mutationFn: () => {
      const form = new FormData();
      for (const [key, value] of Object.entries(values)) form.append(key, value);
      form.set('startDate', fromDateTimeLocal(values.startDate));
      form.set('endDate', fromDateTimeLocal(values.endDate));
      if (posterFile) form.append('poster', posterFile);
      if (removePoster) form.append('removePoster', 'true');
      return api(isEdit ? `/api/events/${event.id}` : '/api/events', { method: isEdit ? 'PUT' : 'POST', form });
    },
    onSuccess: ({ event: saved }) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['my-events'] });
      queryClient.invalidateQueries({ queryKey: ['event', saved.id] });
      toast.success(isEdit ? 'Event updated.' : 'Event published!');
      navigate(`/events/${saved.id}`);
    },
  });

  const errors = { ...save.error?.fields, ...clientErrors };
  const set = (key) => (e) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setClientErrors(({ [key]: _removed, ...rest }) => rest);
  };

  const submit = (e) => {
    e.preventDefault();
    const found = validateEvent(values, posterFile);
    setClientErrors(found);
    if (Object.keys(found).length === 0) save.mutate();
  };

  const pickPoster = (e) => {
    const file = e.target.files?.[0] ?? null;
    setPosterFile(file);
    if (file) setRemovePoster(false);
    setClientErrors(({ poster: _removed, ...rest }) => rest);
  };

  const currentPoster = previewUrl
    ? { src: previewUrl }
    : isEdit && event.posterUrl && !removePoster
      ? { src: apiUrl(event.posterUrl) }
      : null;

  return (
    <form onSubmit={submit} noValidate className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="card space-y-5 p-6">
        <Field label="Event title" error={errors.title}>
          {(p) => <input {...p} className="input" value={values.title} onChange={set('title')} maxLength={120} required />}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Category" error={errors.category}>
            {(p) => (
              <select {...p} className="input" value={values.category} onChange={set('category')}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Venue" error={errors.venue}>
            {(p) => <input {...p} className="input" value={values.venue} onChange={set('venue')} maxLength={200} required />}
          </Field>
          <Field label="Starts" error={errors.startDate}>
            {(p) => <input {...p} type="datetime-local" className="input" value={values.startDate} onChange={set('startDate')} required />}
          </Field>
          <Field label="Ends" error={errors.endDate}>
            {(p) => (
              <input
                {...p}
                type="datetime-local"
                className="input"
                value={values.endDate}
                min={values.startDate || undefined}
                onChange={set('endDate')}
                required
              />
            )}
          </Field>
          <Field label="Capacity" error={errors.capacity} hint="Leave empty for unlimited seats.">
            {(p) => (
              <input {...p} type="number" min={1} step={1} inputMode="numeric" className="input" value={values.capacity} onChange={set('capacity')} />
            )}
          </Field>
          <Field label="External registration link" error={errors.registerLink} hint="Optional, e.g. a Google Form.">
            {(p) => <input {...p} type="url" placeholder="https://" className="input" value={values.registerLink} onChange={set('registerLink')} />}
          </Field>
        </div>

        <Field label="Description" error={errors.description} hint={`${values.description.length} / 5000`}>
          {(p) => <textarea {...p} rows={7} className="input resize-y" value={values.description} onChange={set('description')} maxLength={5000} />}
        </Field>
      </div>

      <div className="space-y-5">
        <div className="card p-6">
          <h2 className="mb-3 text-sm font-medium text-slate-300">Poster</h2>
          <div className="overflow-hidden rounded-xl border border-line">
            {currentPoster ? (
              <img src={currentPoster.src} alt="Poster preview" className="aspect-16/10 w-full object-cover" />
            ) : (
              <Poster event={{ title: values.title || 'Your event', category: values.category }} className="aspect-16/10 w-full" />
            )}
          </div>
          <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-line px-4 py-3 text-sm text-slate-300 hover:border-brand-500/60 hover:text-white">
            <ImagePlus className="size-4" aria-hidden />
            {posterFile ? 'Choose a different image' : 'Upload image'}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={pickPoster} />
          </label>
          {posterFile && (
            <p className="mt-2 truncate text-xs text-slate-500">
              {posterFile.name} · {formatBytes(posterFile.size)}
            </p>
          )}
          {isEdit && event.posterUrl && !posterFile && !removePoster && (
            <Button variant="danger-ghost" size="sm" className="mt-2 w-full" onClick={() => setRemovePoster(true)}>
              <Trash2 className="size-4" aria-hidden /> Remove poster
            </Button>
          )}
          <p className="mt-2 text-xs text-slate-500">JPEG, PNG, WebP or GIF · max 5 MB. Without one we show a coloured cover.</p>
          {errors.poster && <p className="mt-2 text-xs text-rose-400">{errors.poster}</p>}
        </div>

        <Alert>{save.error && !save.error.fields ? save.error.message : null}</Alert>
        {Object.keys(errors).length > 0 && !save.isPending && (
          <Alert>Please fix the highlighted fields.</Alert>
        )}
        <Button type="submit" size="lg" className="w-full" loading={save.isPending}>
          {isEdit ? 'Save changes' : 'Publish event'}
        </Button>
      </div>
    </form>
  );
}

export default function EventFormPage() {
  const { id } = useParams();
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['event', id, 'edit'],
    queryFn: () => api(`/api/events/${id}`),
    enabled: Boolean(id),
  });

  const back = (
    <Link to={id ? `/events/${id}` : '/dashboard'} className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
      <ArrowLeft className="size-4" aria-hidden /> Back
    </Link>
  );

  if (!id) {
    return (
      <>
        <title>New event · EventHub</title>
        {back}
        <PageHeader title="Create an event" subtitle="It goes live on the public feed as soon as you publish." />
        <EventForm />
      </>
    );
  }

  if (isPending) return <PageSpinner />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (!data.viewer.canManage) {
    return (
      <EmptyState title="You can't edit this event" action={<LinkButton to={`/events/${id}`}>View event</LinkButton>}>
        Only the club that created it (or an admin) can make changes.
      </EmptyState>
    );
  }

  return (
    <>
      <title>{`Edit ${data.event.title} · EventHub`}</title>
      {back}
      <PageHeader title="Edit event" subtitle={data.event.title} />
      {/* key: remount with fresh initial state if a different event is loaded */}
      <EventForm key={data.event.id} event={data.event} />
    </>
  );
}
