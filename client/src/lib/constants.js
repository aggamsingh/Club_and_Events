// Keep in sync with CATEGORIES in server/src/models/Event.js.
export const CATEGORIES = [
  { value: 'technical', label: 'Technical', badge: 'bg-sky-500/15 text-sky-300 ring-sky-400/30', gradient: 'from-sky-600 via-indigo-700 to-slate-900' },
  { value: 'cultural', label: 'Cultural', badge: 'bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-400/30', gradient: 'from-fuchsia-600 via-purple-700 to-slate-900' },
  { value: 'sports', label: 'Sports', badge: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30', gradient: 'from-emerald-600 via-teal-700 to-slate-900' },
  { value: 'workshop', label: 'Workshop', badge: 'bg-amber-500/15 text-amber-300 ring-amber-400/30', gradient: 'from-amber-500 via-orange-700 to-slate-900' },
  { value: 'seminar', label: 'Seminar', badge: 'bg-cyan-500/15 text-cyan-300 ring-cyan-400/30', gradient: 'from-cyan-600 via-blue-800 to-slate-900' },
  { value: 'social', label: 'Social', badge: 'bg-rose-500/15 text-rose-300 ring-rose-400/30', gradient: 'from-rose-500 via-pink-700 to-slate-900' },
  { value: 'other', label: 'Other', badge: 'bg-slate-500/15 text-slate-300 ring-slate-400/30', gradient: 'from-slate-600 via-slate-700 to-slate-900' },
];

export const categoryInfo = (value) => CATEGORIES.find((c) => c.value === value) ?? CATEGORIES.at(-1);

export const MAX_POSTER_BYTES = 5 * 1024 * 1024;
export const POSTER_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export const HOME_FOR_ROLE = { admin: '/admin', club: '/dashboard', student: '/' };
