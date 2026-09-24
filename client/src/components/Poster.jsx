import { CalendarDays } from 'lucide-react';
import { useState } from 'react';
import { apiUrl } from '../lib/api';
import { categoryInfo } from '../lib/constants';
import { cx } from '../lib/cx';

/** Event poster, or a category-coloured placeholder when there isn't one (or it fails to load). */
export function Poster({ event, className, eager = false, compact = false }) {
  const [failed, setFailed] = useState(false);
  const src = apiUrl(event.posterUrl);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={`Poster for ${event.title}`}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onError={() => setFailed(true)}
        className={cx('object-cover', className)}
      />
    );
  }

  const info = categoryInfo(event.category);
  if (compact) {
    // Thumbnails are too small for the title, so just show the coloured tile with an icon.
    return (
      <div
        role="img"
        aria-label={`${info.label} event: ${event.title}`}
        className={cx('flex items-center justify-center bg-linear-to-br', info.gradient, className)}
      >
        <CalendarDays className="size-8 text-white/70" aria-hidden />
      </div>
    );
  }
  return (
    <div
      role="img"
      aria-label={`${info.label} event: ${event.title}`}
      className={cx('relative flex items-end overflow-hidden bg-linear-to-br p-5', info.gradient, className)}
    >
      <CalendarDays className="absolute -top-4 -right-4 size-32 text-white/10" aria-hidden />
      <span className="line-clamp-2 text-xl font-bold text-white/90 drop-shadow">{event.title}</span>
    </div>
  );
}
