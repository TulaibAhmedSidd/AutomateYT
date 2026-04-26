import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Automated AI Video System',
  description: 'Production-ready automated AI video generation system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} flex min-h-screen bg-slate-950 text-slate-100`}>
        <Sidebar />
        <main className="flex-1 overflow-y-auto px-4 pb-24 pt-5 md:px-8 md:pb-8 md:pt-8">
          <div className="mx-auto max-w-7xl space-y-8">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
