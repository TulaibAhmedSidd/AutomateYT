'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Home, PenSquare, PlaySquare, Settings, Wand2 } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/dashboard?create=1', label: 'Create Video', icon: PenSquare },
  { href: '/studio', label: 'Studio', icon: Wand2 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function isActive(pathname: string, searchParams: { get: (key: string) => string | null }, href: string) {
  if (href.startsWith('/dashboard?')) {
    return pathname === '/dashboard' && searchParams.get('create') === '1';
  }
  if (href === '/dashboard') {
    return pathname === '/dashboard' && searchParams.get('create') !== '1';
  }
  return pathname === href;
}

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <>
      <aside className="hidden min-h-screen w-72 flex-col border-r border-slate-800 bg-slate-900 text-white md:flex">
        <div className="border-b border-slate-800 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-300">
              <PlaySquare size={24} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Hybrid Suite</p>
              <h1 className="mt-1 text-2xl font-black text-white">AutoVid Studio</h1>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6">
          <ul className="space-y-2">
            {NAV_ITEMS.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    isActive(pathname, searchParams, item.href)
                      ? 'bg-cyan-400 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <item.icon size={18} />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-slate-800 p-5 text-sm text-slate-500">
          Manual assets are prioritized before AI generation on every project.
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-950/95 px-3 py-2 backdrop-blur md:hidden">
        <div className="grid grid-cols-4 gap-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold transition ${
                isActive(pathname, searchParams, item.href)
                  ? 'bg-cyan-400 text-slate-950'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
            >
              <item.icon size={16} />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
