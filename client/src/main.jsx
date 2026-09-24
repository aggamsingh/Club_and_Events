import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';
import { RequireRole } from './components/RequireRole';
import { AuthProvider, ME_KEY } from './hooks/useAuth';
import { ToastProvider } from './hooks/useToast';
import './index.css';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import ClubPage from './pages/ClubPage';
import ClubsPage from './pages/ClubsPage';
import EventDetailPage from './pages/EventDetailPage';
import EventsPage from './pages/EventsPage';
import { NotFoundPage, RouteErrorPage } from './pages/NotFoundPage';

// Pages only some roles ever see are code-split so students don't download them.
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const EventFormPage = lazy(() => import('./pages/EventFormPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const MyEventsPage = lazy(() => import('./pages/MyEventsPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));

// A 401 from any request means the session expired or was revoked: forget the user.
const onError = (error) => {
  if (error?.status === 401) queryClient.setQueryData(ME_KEY, null);
};
const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Retrying 4xx responses is pointless; retry network/5xx once.
      retry: (count, error) => count < 1 && !(error?.status >= 400 && error?.status < 500),
    },
  },
});

const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <EventsPage /> },
      { path: 'events/:id', element: <EventDetailPage /> },
      { path: 'clubs', element: <ClubsPage /> },
      { path: 'clubs/:id', element: <ClubPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'my-events', element: <RequireRole roles={['student']}><MyEventsPage /></RequireRole> },
      { path: 'account', element: <RequireRole><AccountPage /></RequireRole> },
      { path: 'dashboard', element: <RequireRole roles={['club']}><DashboardPage /></RequireRole> },
      { path: 'dashboard/events/new', element: <RequireRole roles={['club']}><EventFormPage /></RequireRole> },
      { path: 'dashboard/events/:id/edit', element: <RequireRole roles={['club', 'admin']}><EventFormPage /></RequireRole> },
      { path: 'admin', element: <RequireRole roles={['admin']}><AdminPage /></RequireRole> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
