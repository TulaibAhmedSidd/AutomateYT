import Link from 'next/link';
import { Home, Calendar, Settings, ListVideo, PlaySquare } from 'lucide-react';

export default function Sidebar() {
  return (
    <div className="w-64 bg-slate-900 border-r border-slate-800 text-white min-h-screen flex flex-col">
      <div className="p-6">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent flex items-center gap-2">
          <PlaySquare className="text-blue-400" />
          AutoVid AI
        </h1>
      </div>
      <nav className="flex-1 mt-6">
        <ul className="space-y-2 px-4">
          <li>
            <Link href="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition-colors text-slate-300 hover:text-white">
              <Home size={20} />
              <span>Dashboard</span>
            </Link>
          </li>
          <li>
            <Link href="/queue" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition-colors text-slate-300 hover:text-white">
              <ListVideo size={20} />
              <span>Queue Status</span>
            </Link>
          </li>
          <li>
            <Link href="/scheduler" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition-colors text-slate-300 hover:text-white">
              <Calendar size={20} />
              <span>Scheduler</span>
            </Link>
          </li>
          <li>
            <Link href="/settings" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 transition-colors text-slate-300 hover:text-white">
              <Settings size={20} />
              <span>Settings</span>
            </Link>
          </li>
        </ul>
      </nav>
      <div className="p-6 border-t border-slate-800 text-sm text-slate-500">
        System Status: <span className="text-emerald-400">Online</span>
      </div>
    </div>
  );
}
