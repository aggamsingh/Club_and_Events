import { CalendarDays, LayoutDashboard, LogOut, Menu, ShieldCheck, Ticket, UserRound, X } from 'lucide-react';
import { Suspense, useState } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration, useNavigate } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { cx } from '../lib/cx';
import { Button, LinkButton, PageSpinner } from './ui';

const navClass = ({ isActive }) =>
  cx(
    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
    isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white',
  );

function NavLinks({ user, onNavigate }) {
  return (
    <>
      <NavLink to="/" end className={navClass} onClick={onNavigate}>
        Events
      </NavLink>
      <NavLink to="/clubs" className={navClass} onClick={onNavigate}>
        Clubs
      </NavLink>
      {user?.role === 'student' && (
        <NavLink to="/my-events" className={navClass} onClick={onNavigate}>
          <Ticket className="size-4" aria-hidden /> My events
        </NavLink>
      )}
      {user?.role === 'club' && (
        <NavLink to="/dashboard" className={navClass} onClick={onNavigate}>
          <LayoutDashboard className="size-4" aria-hidden /> Dashboard
        </NavLink>
      )}
      {user?.role === 'admin' && (
        <NavLink to="/admin" className={navClass} onClick={onNavigate}>
          <ShieldCheck className="size-4" aria-hidden /> Admin
        </NavLink>
      )}
    </>
  );
}

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold text-white">
          <span className="rounded-lg bg-brand-600 p-1.5">
            <CalendarDays className="size-5" aria-hidden />
          </span>
          EventHub
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Main">
          <NavLinks user={user} />
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          {user ? (
            <>
              <NavLink to="/account" className={navClass} title="Account settings">
                <UserRound className="size-4" aria-hidden />
                <span className="max-w-40 truncate">{user.name}</span>
              </NavLink>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="size-4" aria-hidden /> Log out
              </Button>
            </>
          ) : (
            <>
              <LinkButton to="/login" variant="ghost" size="sm">
                Log in
              </LinkButton>
              <LinkButton to="/register" size="sm">
                Sign up
              </LinkButton>
            </>
          )}
        </div>

        <button
          className="ml-auto rounded-lg p-2 text-slate-300 hover:bg-white/5 md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <nav id="mobile-nav" className="flex flex-col gap-1 border-t border-line px-4 py-3 md:hidden" aria-label="Main">
          <NavLinks user={user} onNavigate={() => setOpen(false)} />
          <div className="my-2 border-t border-line" />
          {user ? (
            <>
              <NavLink to="/account" className={navClass} onClick={() => setOpen(false)}>
                <UserRound className="size-4" aria-hidden /> {user.name}
              </NavLink>
              <button className={navClass({ isActive: false })} onClick={handleLogout}>
                <LogOut className="size-4" aria-hidden /> Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={navClass} onClick={() => setOpen(false)}>
                Log in
              </NavLink>
              <NavLink to="/register" className={navClass} onClick={() => setOpen(false)}>
                Sign up
              </NavLink>
            </>
          )}
        </nav>
      )}
    </header>
  );
}

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-brand-600 focus:px-3 focus:py-2">
        Skip to content
      </a>
      <Navbar />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <Suspense fallback={<PageSpinner />}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="border-t border-line py-6 text-center text-xs text-slate-500">
        EventHub · Campus events, in one place
      </footer>
      <ScrollRestoration />
    </div>
  );
}
