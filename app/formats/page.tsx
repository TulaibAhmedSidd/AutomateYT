import Link from 'next/link';
import { FormatCard, FORMAT_ICONS, PageHeader, StatusPill, ACCENT } from '@/components/format-ui';
import { RECOMMENDED_ORDER, VIDEO_FORMATS } from '@/lib/video-formats';

export const metadata = { title: 'Video formats · AutoVid Studio' };

const dots = (n: number) => '●'.repeat(n) + '○'.repeat(5 - n);

export default function FormatsPage() {
  const formats = RECOMMENDED_ORDER.map((id) => VIDEO_FORMATS.find((f) => f.id === id)!).filter(Boolean);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Strategy"
        title="Video formats"
        description="Every Short the channel makes belongs to one of these formats. Each card links to a full playbook: pipeline, tools, costs, risks and the setup checklist."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {formats.map((format, i) => (
          <FormatCard key={format.id} format={format} recommended={i === 0} />
        ))}
      </section>

      <section className="overflow-hidden rounded-3xl border border-white/[0.07] bg-[var(--panel)]">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <h2 className="font-display text-lg font-bold text-white">Side by side</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.15em] text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Format</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Retention</th>
                <th className="px-5 py-3 font-semibold">Automation</th>
                <th className="px-5 py-3 font-semibold">Cost per video</th>
                <th className="px-5 py-3 font-semibold">Render time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {formats.map((format) => {
                const Icon = FORMAT_ICONS[format.id];
                const accent = ACCENT[format.accent];
                return (
                  <tr key={format.id} className="text-slate-300">
                    <td className="px-5 py-4">
                      <Link href={`/formats/${format.id}`} className="flex items-center gap-3 font-semibold text-white hover:underline">
                        <Icon size={16} className={accent.text} />
                        {format.name}
                      </Link>
                    </td>
                    <td className="px-5 py-4"><StatusPill status={format.status} /></td>
                    <td className={`px-5 py-4 tracking-widest ${accent.text}`}>{dots(format.retention)}</td>
                    <td className={`px-5 py-4 tracking-widest ${accent.text}`}>{dots(format.automation)}</td>
                    <td className="px-5 py-4 text-slate-400">{format.costPerVideo}</td>
                    <td className="px-5 py-4 text-slate-400">{format.timePerVideo}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
