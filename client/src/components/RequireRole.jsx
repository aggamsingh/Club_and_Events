import { ShieldCheck } from 'lucide-react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { EmptyState, LinkButton, PageSpinner } from './ui';

/**
 * Client-side route guard. This is UX only — the API enforces every permission itself,
 * so bypassing this component in DevTools gets you an empty page and 401/403s.
 */
export function RequireRole({ roles, children }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <PageSpinner />;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return (
      <EmptyState icon={ShieldCheck} title="Not available for your account" action={<LinkButton to="/">Browse events</LinkButton>}>
        This page is only for {roles.join(' / ')} accounts.
      </EmptyState>
    );
  }
  return children;
}
