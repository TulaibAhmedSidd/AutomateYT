'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  CalendarClock,
  Layers,
  LayoutDashboard,
  Library,
  ListVideo,
  Menu,
  PlaySquare,
  Settings,
  Sparkles,
  Telescope,
  Wand2,
  X,
} from 'lucide-react';

const NAV = [
  {
    group: 'Plan',
    items: [
      { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
      { href: '/formats', label: 'Video formats', icon: Layers },
      { href: '/research', label: 'Reel research', icon: Telescope },
    ],
  },
  {
    group: 'Produce',
    items: [
      { href: '/motion', label: 'Motion Studio', icon: Sparkles },
      { href: '/studio', label: 'Image Studio', icon: Wand2 },
      { href: '/studio?tab=library', label: 'Library', icon: Library },
      { href: '/queue', label: 'Queue', icon: ListVideo },
      { href: '/scheduler', label: 'Scheduler', icon: CalendarClock },
    ],
  },
  {
    group: 'System',
    items: [{ href: '/settings', label: 'Settings', icon: Settings }],
  },
];

type Health = { database: { ok: boolean } } | null;

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [health, setHealth] = useState<Health>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const id = window.setTimeout(() => {
      setOpen(false);
      setSearch(window.location.search);
    }, 0);
    return () => window.clearTimeout(id);
  }, [pathname]);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then(setHealth)
      .catch(() => setHealth({ database: { ok: false } }));
  }, []);

  const isActive = (href: string) => {
    const [path, query] = href.split('?');
    if (query) return pathname === path && search.includes(query);
    if (path === '/studio') return pathname === '/studio' && !search.includes('tab=library');
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const dbOk = health?.database.ok;

  const panel = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-6">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent)] text-slate-950">
          <PlaySquare size={18} />
        </span>
        <div>
          <p className="font-display text-base font-bold leading-none text-white">AutoVid Studio</p>
          <p className="mt-1 text-[11px] text-slate-500">Faceless Shorts engine</p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
        {NAV.map((section) => (
          <div key={section.group}>
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">{section.group}</p>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setSearch(item.href.includes('?') ? `?${item.href.split('?')[1]}` : '')}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                        active
                          ? 'bg-white/[0.07] font-semibold text-white'
                          : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
                      }`}
                    >
                      <item.icon size={17} className={active ? 'text-[var(--accent)]' : ''} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="m-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${dbOk === undefined ? 'bg-slate-600' : dbOk ? 'bg-emerald-400' : 'bg-rose-400'}`}
          />
          <span className="text-slate-300">
            {dbOk === undefined ? 'Checking database…' : dbOk ? 'Database connected' : 'Database offline'}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-white/[0.06] bg-[var(--bg)]/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2 font-display font-bold text-white">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent)] text-slate-950">
            <PlaySquare size={16} />
          </span>
          AutoVid Studio
        </Link>
        <button
          onClick={() => setOpen(true)}
          className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-slate-200"
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-black/60" aria-label="Close menu" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-white/[0.06] bg-[var(--panel)]">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-5 grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-white/[0.06]"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
            {panel}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-white/[0.06] bg-[var(--panel)]/80 backdrop-blur lg:block">
        {panel}
      </aside>
    </>
  );
}
