import { CalendarDays, CheckCircle2, MapPin } from 'lucide-react';
import { notFound } from 'next/navigation';
import { cleanerDashboardByToken } from '@/lib/cleaning-db';

export const dynamic = 'force-dynamic';

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${value}T00:00:00Z`));
}

export default async function CleanerSchedulePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{24,80}$/.test(token)) notFound();
  const dashboard = await cleanerDashboardByToken(token);
  if (!dashboard) notFound();
  const upcoming = dashboard.jobs.filter(job => job.status === 'scheduled');
  const recent = dashboard.jobs.filter(job => job.status !== 'scheduled');

  return <main className="min-h-screen bg-[#f4f7f9] px-4 py-8 text-[#173f5f] sm:py-12">
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="rounded-3xl bg-[#173f5f] p-6 text-white shadow-xl sm:p-8">
        <p className="text-sm font-bold uppercase tracking-[.16em] text-[#f4c15d]">Rental Steward</p>
        <h1 className="mt-2 text-3xl font-bold">{dashboard.cleanerName ? `${dashboard.cleanerName}'s cleaning schedule` : 'Cleaning schedule'}</h1>
        <p className="mt-2 text-white/80">Upcoming turnover cleanings from the connected booking calendars.</p>
        <a href={`/api/cleaner/${token}/calendar`} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 font-bold text-[#173f5f]">
          <CalendarDays className="size-4" /> Add to my calendar
        </a>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Upcoming cleanings</h2>
        {upcoming.map(job => <article key={job.id} className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-wide text-[#8a6112]">{dateLabel(job.checkoutDate)}</p>
          <h3 className="mt-1 text-xl font-bold">{job.propertyName}</h3>
          {job.address && <p className="mt-2 flex items-start gap-2 text-sm text-[#536170]"><MapPin className="mt-0.5 size-4 shrink-0" />{job.address}</p>}
        </article>)}
        {!upcoming.length && <div className="rounded-2xl border bg-white p-8 text-center"><CheckCircle2 className="mx-auto size-9 text-[#2f7d69]" /><p className="mt-3 font-bold">No upcoming cleanings</p><p className="mt-1 text-sm text-[#536170]">New dates will appear when bookings are added.</p></div>}
      </section>

      {recent.length > 0 && <section className="space-y-3">
        <h2 className="text-lg font-bold">Recently completed</h2>
        {recent.slice(-6).reverse().map(job => <div key={job.id} className="flex items-center justify-between gap-3 rounded-xl border bg-white p-4 text-sm"><span><strong>{job.propertyName}</strong><br />{dateLabel(job.checkoutDate)}</span><span className="rounded-full bg-[#e6f2ee] px-3 py-1 font-bold capitalize text-[#2f7d69]">{job.status}</span></div>)}
      </section>}
      <p className="text-center text-xs text-[#6b7785]">This private link shows property names, addresses, and cleaning dates. Keep it between the owner and cleaner.</p>
    </div>
  </main>;
}
