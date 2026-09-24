import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui';

export function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-3">
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft className="size-4" aria-hidden /> Previous
      </Button>
      <span className="text-sm text-slate-400 tabular-nums">
        Page {page} of {totalPages}
      </span>
      <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Next <ChevronRight className="size-4" aria-hidden />
      </Button>
    </nav>
  );
}
