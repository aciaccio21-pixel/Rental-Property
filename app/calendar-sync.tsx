'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { calendarNights } from '@/lib/calendar.mjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Booking = { uid: string; start: string; end: string; summary: string; kind: string };
type Feed = { id: string; propertyId: string; provider: string; events: Booking[]; syncedAt: string | null; syncError: string | null };
type Property = { id: string; name: string };

export function CalendarSync({ properties, month }: { properties: Property[]; month: string }) {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [propertyId, setPropertyId] = useState(properties[0]?.id || '');
  const [provider, setProvider] = useState('airbnb');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const busyRef = useRef(false);

  const request = useCallback(async (body?: Record<string, string>) => {
    const response = await fetch('/api/calendars', body ? {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(25000),
    } : { cache: 'no-store', signal: AbortSignal.timeout(25000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load calendars.');
    setFeeds(data.feeds);
    return data.feeds as Feed[];
  }, []);

  const refresh = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      const current = await request();
      for (const feed of current) {
        if (!feed.syncedAt || Date.now() - new Date(feed.syncedAt).getTime() > 15 * 60 * 1000) await request({ action: 'sync', id: feed.id });
      }
    } catch { setError('Calendar refresh failed. Your last synced dates are kept. Try again.'); }
    finally { busyRef.current = false; setBusy(false); }
  }, [request]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 15 * 60 * 1000);
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [refresh]);

  async function change(body: Record<string, string>) {
    if (busyRef.current) return false;
    busyRef.current = true; setBusy(true); setError(''); setNotice('');
    try { await request(body); return true; }
    catch (failure) { setError(failure instanceof Error && failure.name !== 'TimeoutError' ? failure.message : 'The calendar request timed out. Check the saved connections before retrying.'); return false; }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function connect(event: FormEvent) {
    event.preventDefault();
    if (await change({ action: 'connect', propertyId, provider, url })) { setUrl(''); setNotice('Calendar connected and dates imported.'); }
  }

  const selected = feeds.filter(feed => feed.propertyId === propertyId);
  const bookings = selected.flatMap(feed => feed.events.map(event => ({ ...event, provider: feed.provider })));
  const monthEnd = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)).toISOString().slice(0, 10);
  const visible = bookings.filter(event => event.start < monthEnd && event.end > `${month}-01`).sort((a,b) => a.start.localeCompare(b.start));
  const blockedNights = calendarNights(bookings, month);
  const days = new Date(Date.UTC(Number(month.slice(0,4)), Number(month.slice(5,7)), 0)).getUTCDate();

  return <section className="space-y-5 rounded-2xl border bg-white p-5 shadow-sm">
    <div><h3 className="text-xl font-bold">Booking calendars</h3><p className="mt-1 text-sm text-muted-foreground">Import Airbnb and Vrbo dates into each apartment. Dates refresh when this section opens and every 15 minutes while open. Provider updates can be delayed.</p></div>
    <div className="space-y-2"><Label htmlFor="calendar-property">Apartment</Label><select id="calendar-property" className="h-11 w-full rounded-md border bg-white px-3 font-semibold text-[#173f5f]" value={propertyId} onChange={event => setPropertyId(event.target.value)}><option value="" disabled>Choose an apartment</option>{properties.map(property => <option value={property.id} key={property.id}>{property.name}</option>)}</select></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-lg bg-green-50 p-3 text-green-800">{notice}</p>}
    <form onSubmit={connect} className="grid items-end gap-3 sm:grid-cols-[130px_1fr_auto]">
      <div className="space-y-2"><Label htmlFor="calendar-provider">Platform</Label><select id="calendar-provider" className="h-10 w-full rounded-md border bg-white px-3" value={provider} onChange={event => setProvider(event.target.value)}><option value="airbnb">Airbnb</option><option value="vrbo">Vrbo</option></select></div>
      <div className="space-y-2"><Label htmlFor="calendar-url">Calendar export link</Label><Input id="calendar-url" type="url" required value={url} onChange={event => setUrl(event.target.value)} placeholder="https://…" autoComplete="off" /></div>
      <Button disabled={busy || !propertyId} type="submit">{busy ? 'Please wait…' : selected.some(feed => feed.provider === provider) ? 'Replace connection' : 'Connect calendar'}</Button>
    </form>
    <p className="text-sm text-muted-foreground">Find your export link in <a className="underline" target="_blank" rel="noreferrer" href="https://www.airbnb.com/help/article/99">Airbnb calendar settings</a> or <a className="underline" target="_blank" rel="noreferrer" href="https://www.vrbo.com/en-gb/help/articles/Export-your-reservation-calendar">Vrbo calendar settings</a>. Links are private and are not shown again after saving.</p>
    {selected.map(feed => <div key={feed.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-bold capitalize">{feed.provider}</p><p className="text-sm">Last successful sync: {feed.syncedAt ? new Date(feed.syncedAt).toLocaleString() : 'Not yet synced'}</p>{feed.syncError && <p role="alert" className="text-sm text-red-800">{feed.syncError}</p>}</div><div className="flex gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => void change({ action:'sync', id:feed.id })}>Sync now</Button><Button type="button" variant="outline" disabled={busy} onClick={() => { if (window.confirm('Disconnect this feed and remove its imported dates? Your rental records will be kept.')) void change({ action:'disconnect', id:feed.id }); }}>Disconnect</Button></div></div>)}
    {!selected.length ? <p className="text-sm">No calendar connected for this apartment yet.</p> : <>
      <p className="font-bold">{blockedNights} unavailable nights in {month} <span className="text-sm font-normal">(overlapping dates counted once)</span></p>
      <div className="grid grid-cols-7 gap-2" aria-label={`Unavailable nights in ${month}`}>{Array.from({length:days},(_,index)=>{
        const day = `${month}-${String(index+1).padStart(2,'0')}`;
        const entries = bookings.filter(event=>event.start <= day && event.end > day);
        return <div key={day} title={entries.length ? entries.map(event=>`${event.provider}: ${event.summary}`).join('; ') : 'No imported block'} className={`rounded-md border p-2 text-center font-bold ${entries.length ? 'bg-[#173f5f] text-white' : 'bg-white text-[#173f5f]'}`}>{index+1}</div>;
      })}</div>
      <p className="text-sm text-muted-foreground">Blue dates are unavailable in the feed; these can include owner blocks. Checkout dates are excluded. Calendar dates do not change recorded income or your manual occupancy figures.</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Source</th><th className="p-2">Entry</th><th className="p-2">Arrival</th><th className="p-2">Checkout</th></tr></thead><tbody>{visible.map((event,index)=><tr key={`${event.provider}-${event.uid}-${index}`} className="border-t"><td className="p-2 capitalize">{event.provider}</td><td className="p-2">{event.summary}{event.kind === 'blocked' ? ' (blocked)' : ''}</td><td className="p-2 whitespace-nowrap">{event.start}</td><td className="p-2 whitespace-nowrap">{event.end}</td></tr>)}</tbody></table>{!visible.length && <p className="py-3">No imported dates for this month.</p>}</div>
    </>}
  </section>;
}
