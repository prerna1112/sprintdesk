import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Drawer } from '../components/ui/Drawer';
import { Icon, type IconName } from '../components/ui/Icon';
import { ThemeControl } from '../features/theme';
import { cn } from '../components/ui/cn';

const navigation: Array<{ to: string; label: string; icon: IconName }> = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/board', label: 'Board', icon: 'board' },
  { to: '/analytics', label: 'Analytics', icon: 'analytics' },
];

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Primary navigation" className="grid gap-1">
      {navigation.map((item) => (
        <NavLink
          className={({ isActive }) =>
            cn(
              'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )
          }
          key={item.to}
          onClick={onNavigate}
          to={item.to}
        >
          <Icon name={item.icon} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const desktopQuery = window.matchMedia('(min-width: 1024px)');
    const closeAtDesktop = (event: MediaQueryListEvent | MediaQueryList) => {
      if (event.matches) setMobileMenuOpen(false);
    };
    closeAtDesktop(desktopQuery);
    desktopQuery.addEventListener('change', closeAtDesktop);
    return () => desktopQuery.removeEventListener('change', closeAtDesktop);
  }, []);
  const pageTitle =
    navigation.find((item) => location.pathname.startsWith(item.to))?.label ??
    'SprintDesk';

  return (
    <div className="min-h-screen bg-background">
      <a
        className="fixed left-4 top-3 z-[70] -translate-y-20 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform focus:translate-y-0"
        href="#main-content"
      >
        Skip to main content
      </a>

      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-surface px-4 py-6 lg:flex lg:flex-col">
        <div className="mb-8 flex items-center gap-3 px-2">
          <span aria-hidden="true" className="grid size-9 place-items-center rounded-xl bg-primary font-black text-primary-foreground">S</span>
          <span className="text-lg font-black tracking-tight">SprintDesk</span>
        </div>
        <Navigation />
        <p className="mt-auto px-3 text-xs leading-relaxed text-muted-foreground">
          Focused planning for modern product teams.
        </p>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-surface/95 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              aria-label="Open navigation"
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(true)}
              size="icon"
              variant="ghost"
            >
              <Icon name="menu" />
            </Button>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-muted-foreground">Workspace</p>
              <p className="truncate text-sm font-bold">{pageTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button aria-label="Notifications" size="icon" variant="ghost">
              <Icon name="bell" />
            </Button>
            <ThemeControl />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8" id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <Drawer
        description="Navigate between SprintDesk areas."
        onClose={() => setMobileMenuOpen(false)}
        open={mobileMenuOpen}
        title="SprintDesk"
      >
        <Navigation onNavigate={() => setMobileMenuOpen(false)} />
      </Drawer>
    </div>
  );
}
