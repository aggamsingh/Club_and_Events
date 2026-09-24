import { TriangleAlert } from 'lucide-react';
import { useRouteError } from 'react-router';
import { EmptyState, LinkButton } from '../components/ui';

export function NotFoundPage() {
  return (
    <EmptyState title="Page not found" action={<LinkButton to="/">Back to events</LinkButton>}>
      The page you're looking for doesn't exist or has moved.
    </EmptyState>
  );
}

/** Last-resort boundary for render errors, so a bug shows a message instead of a blank screen. */
export function RouteErrorPage() {
  const error = useRouteError();
  console.error(error);
  return (
    <div className="mx-auto max-w-xl px-4 py-24">
      <EmptyState
        icon={TriangleAlert}
        title="Something broke"
        action={
          <a href="/" className="font-semibold text-brand-300 hover:underline">
            Reload EventHub
          </a>
        }
      >
        An unexpected error occurred. Please reload the page.
      </EmptyState>
    </div>
  );
}
