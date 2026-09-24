import { useEffect, useRef } from 'react';
import { Alert, Button } from './ui';

/**
 * Modal built on the native <dialog> element, which gives focus trapping, Esc-to-close
 * and an inert background for free — no focus-trap library needed.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Confirm',
  tone = 'danger',
  busy = false,
  error,
  onConfirm,
  onClose,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal?.();
    if (!open && dialog.open) dialog.close?.();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        if (busy) e.preventDefault();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-panel p-0 text-slate-200 shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      {open && (
        <form
          method="dialog"
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm();
          }}
          className="p-6"
        >
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <div className="mt-2 text-sm text-slate-400">{children}</div>
          <Alert className="mt-4">{error}</Alert>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" variant={tone === 'danger' ? 'danger' : 'primary'} loading={busy}>
              {confirmLabel}
            </Button>
          </div>
        </form>
      )}
    </dialog>
  );
}
