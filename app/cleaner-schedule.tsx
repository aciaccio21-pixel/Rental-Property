'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { CalendarDays, Check, Copy, DollarSign, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type CleaningJob = {
  id: string;
  checkoutDate: string;
  fee: number;
  status: 'scheduled' | 'completed' | 'paid' | 'cancelled';
  propertyName: string;
  address: string;
};
type CleaningData = {
  settings: { cleanerName: string; defaultFee: number; shareToken: string };
  jobs: CleaningJob[];
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${value}T00:00:00Z`));
}

export function CleanerSchedule({ onLedgerChange }: { onLedgerChange: () => Promise<void> }) {
  const [data, setData] = useState<CleaningData | null>(null);
  const [cleanerName, setCleanerName] = useState('');
  const [defaultFee, setDefaultFee] = useState('0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const request = useCallback(async (body?: Record<string, unknown>) => {
    const response = await fetch('/api/cleanings', body ? {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
    } : { cache: 'no-store', signal: AbortSignal.timeout(30000) });
    const result = await response.json() as CleaningData & { error?: string };
    if (!response.ok) throw new Error(result.error || 'Could not load the cleaner schedule.');
    setData(result);
    setCleanerName(result.settings.cleanerName || '');
    setDefaultFee(String(Number(result.settings.defaultFee) || 0));
    return result;
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void request().catch(failure => setError(failure instanceof Error ? failure.message : 'Could not load the cleaner schedule.')), 0);
    return () => window.clearTimeout(initial);
  }, [request]);

  async function change(body: Record<string, unknown>, success: string) {
    if (busy) return;
    setBusy(true); setError('');
    try { await request(body); toast.success(success); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not save the change.'); }
    finally { setBusy(false); }
  }

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    await change({ action: 'save_settings', cleanerName, defaultFee }, 'Cleaner settings saved');
  }

  async function recordPaid(id: string) {
    await change({ action: 'record_paid', id }, 'Cleaning payment recorded as an expense');
    await onLedgerChange();
  }

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  }

  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const shareUrl = data ? `${origin}/cleaner/${data.settings.shareToken}` : '';
  const calendarUrl = data ? `${origin}/api/cleaner/${data.settings.shareToken}/calendar` : '';
  const upcoming = data?.jobs.filter(job => job.status !== 'cancelled' && job.checkoutDate >= new Date().toISOString().slice(0, 10)) || [];

  return <section className="space-y-5 rounded-2xl border bg-white p-5 shadow-sm">
    <div>
      <p className="text-sm font-semibold uppercase tracking-[.12em] text-[#8a6112]">Turnovers</p>
      <h3 className="mt-1 text-xl font-bold">Cleaner calendar & payments</h3>
      <p className="mt-1 text-sm text-muted-foreground">Each imported reservation creates a cleaning on its checkout date. Share the private schedule with your cleaner and keep cleaning expenses in your ledger.</p>
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {!data ? <div className="flex items-center gap-2 py-5 text-sm"><Loader2 className="size-4 animate-spin" /> Loading cleaner schedule…</div> : <>
      <form onSubmit={saveSettings} className="grid items-end gap-3 sm:grid-cols-[1fr_170px_auto]">
        <div className="space-y-2"><Label htmlFor="cleaner-name">Cleaner name</Label><Input id="cleaner-name" value={cleanerName} onChange={event => setCleanerName(event.target.value)} placeholder="Cleaner or company" /></div>
        <div className="space-y-2"><Label htmlFor="cleaner-fee">Default fee</Label><Input id="cleaner-fee" type="number" min="0" max="10000" step="0.01" value={defaultFee} onChange={event => setDefaultFee(event.target.value)} /></div>
        <Button disabled={busy} type="submit">Save</Button>
      </form>

      <div className="rounded-xl border bg-[#f9fbfc] p-4">
        <p className="font-bold">Private cleaner access</p>
        <p className="mt-1 text-sm text-muted-foreground">The link shows cleaning dates, property names, and addresses. It does not show guests, booking income, or cleaning fees.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void copy(shareUrl, 'Cleaner link')}><Copy className="size-4" /> Copy cleaner link</Button>
          <Button type="button" variant="outline" onClick={() => void copy(calendarUrl, 'Calendar link')}><CalendarDays className="size-4" /> Copy calendar link</Button>
          <Button asChild variant="outline"><a href={shareUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /> Preview</a></Button>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-3"><h4 className="font-bold">Upcoming cleanings</h4><span className="text-sm text-muted-foreground">{upcoming.length} scheduled</span></div>
        <div className="space-y-3">
          {upcoming.map(job => <article key={job.id} className="grid items-center gap-3 rounded-xl border p-4 md:grid-cols-[1fr_130px_auto]">
            <div><p className="font-bold">{job.propertyName}</p><p className="text-sm text-muted-foreground">{dateLabel(job.checkoutDate)}{job.address ? ` · ${job.address}` : ''}</p></div>
            <div className="flex items-center rounded-md border bg-white px-2"><DollarSign className="size-4 text-muted-foreground" /><Input aria-label={`Fee for ${job.propertyName}`} className="border-0 px-1 shadow-none" type="number" min="0" max="10000" step="0.01" defaultValue={Number(job.fee) || 0} disabled={job.status === 'paid' || busy} onBlur={event => { const fee = Number(event.target.value); if (fee !== Number(job.fee)) void change({ action: 'set_fee', id: job.id, fee }, 'Cleaning fee updated'); }} /></div>
            <div className="flex gap-2 md:justify-end">
              {job.status === 'scheduled' && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void change({ action: 'complete', id: job.id }, 'Cleaning marked complete')}><Check className="size-4" /> Complete</Button>}
              {job.status !== 'paid' && <Button type="button" size="sm" disabled={busy || Number(job.fee) <= 0} onClick={() => void recordPaid(job.id)}>Record paid</Button>}
              {job.status === 'paid' && <span className="rounded-full bg-[#e6f2ee] px-3 py-1.5 text-sm font-bold text-[#2f7d69]">Paid</span>}
            </div>
          </article>)}
          {!upcoming.length && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No upcoming cleanings yet. Connect and sync an Airbnb or Vrbo calendar above.</p>}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">“Record paid” adds a Cleaning expense to your ledger. It tracks the payment but does not transfer money to the cleaner.</p>
    </>}
  </section>;
}
