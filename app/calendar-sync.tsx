'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { CalendarPlus, DollarSign, PencilLine, Trash2, UserRound } from 'lucide-react';
import { bookingPayoutForMonth, calendarNights } from '@/lib/calendar.mjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type FeedEvent = { uid: string; start: string; end: string; summary: string; kind: string };
type Feed = { id: string; propertyId: string; provider: string; events: FeedEvent[]; syncedAt: string | null; syncError: string | null };
type Booking = { id: string; propertyId: string; provider: 'airbnb' | 'vrbo' | 'private'; start: string; end: string; guestName: string; payout: number; notes: string; providerTitle: string };
type Property = { id: string; name: string };
type CalendarData = { feeds: Feed[]; bookings: Booking[] };
type CalendarEntry = { id: string; start: string; end: string; provider: string; guestName?: string; blocked?: boolean };

function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function nights(start: string, end: string) {
  return Math.max(0, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000));
}

function addDays(value: string, count: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

function monthWeeks(month: string) {
  const first = `${month}-01`;
  const firstDay = new Date(`${first}T00:00:00Z`).getUTCDay();
  const gridStart = addDays(first, -firstDay);
  const daysInMonth = new Date(Date.UTC(Number(month.slice(0,4)), Number(month.slice(5,7)), 0)).getUTCDate();
  const weekCount = Math.ceil((firstDay + daysInMonth) / 7);
  return Array.from({ length: weekCount }, (_, week) => Array.from({ length: 7 }, (_, day) => addDays(gridStart, week * 7 + day)));
}

function barColors(entry: CalendarEntry) {
  if (entry.blocked) return 'bg-[#7b8794] text-white';
  if (entry.provider === 'vrbo') return 'bg-[#2874a6] text-white';
  if (entry.provider === 'private') return 'bg-[#2f7d69] text-white';
  return 'bg-[#173f5f] text-white';
}

function BookingMonth({ month, entries }: { month: string; entries: CalendarEntry[] }) {
  const weeks = monthWeeks(month);
  return <div className="overflow-x-auto rounded-xl border bg-white">
    <div className="min-w-[760px]">
      <div className="grid grid-cols-7 border-b bg-[#f3f6f8] text-center text-xs font-bold uppercase tracking-wide text-[#536170]">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => <div key={day} className="py-2">{day}</div>)}
      </div>
      {weeks.map((week, weekIndex) => {
        const weekStart = week[0], weekEnd = addDays(week[6], 1);
        const segments = entries
          .filter(entry => entry.start < weekEnd && entry.end > weekStart)
          .sort((a,b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
        return <div key={weekStart} className="relative grid min-h-[126px] grid-cols-7 border-b last:border-b-0">
          {week.map(day => <div key={day} className={`border-r p-2 last:border-r-0 ${day.startsWith(month) ? 'bg-white' : 'bg-[#f7f8f9] text-[#a1a9b2]'}`}><span className={`grid size-7 place-items-center rounded-full text-sm font-bold ${day === new Date().toISOString().slice(0,10) ? 'bg-[#f4c15d] text-[#173f5f]' : ''}`}>{Number(day.slice(-2))}</span></div>)}
          <div className="pointer-events-none absolute inset-x-0 top-10 grid grid-cols-7">
            {segments.slice(0, 3).map((entry, lane) => {
              const segmentStart = entry.start > weekStart ? entry.start : weekStart;
              const segmentEnd = entry.end < weekEnd ? entry.end : weekEnd;
              const startColumn = Math.round((Date.parse(`${segmentStart}T00:00:00Z`) - Date.parse(`${weekStart}T00:00:00Z`)) / 86400000) + 1;
              const span = Math.max(1, Math.round((Date.parse(`${segmentEnd}T00:00:00Z`) - Date.parse(`${segmentStart}T00:00:00Z`)) / 86400000));
              const beginsHere = entry.start >= weekStart;
              const endsHere = entry.end <= weekEnd;
              return <div key={`${entry.id}-${weekIndex}`} style={{ gridColumn: `${startColumn} / span ${span}`, gridRow: '1', marginTop: `${lane * 26}px` }} className={`mx-0.5 flex h-6 min-w-0 items-center gap-1 overflow-hidden px-2 text-xs font-bold shadow-sm ${barColors(entry)} ${beginsHere ? 'rounded-l-full' : ''} ${endsHere ? 'rounded-r-full' : ''}`} title={`${entry.blocked ? 'Owner block' : entry.guestName || 'Guest details needed'} · ${entry.provider} · ${entry.start} to ${entry.end}`}>
                <span className="shrink-0 uppercase opacity-80">{entry.blocked ? 'Block' : entry.provider}</span>
                <span className="truncate">{entry.blocked ? 'Unavailable' : entry.guestName || 'Guest details needed'}</span>
              </div>;
            })}
          </div>
        </div>;
      })}
    </div>
  </div>;
}

export function CalendarSync({ properties, month }: { properties: Property[]; month: string }) {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [propertyId, setPropertyId] = useState(properties[0]?.id || '');
  const [provider, setProvider] = useState('airbnb');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const busyRef = useRef(false);

  const request = useCallback(async (body?: Record<string, unknown>) => {
    const response = await fetch('/api/calendars', body ? {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(25000),
    } : { cache: 'no-store', signal: AbortSignal.timeout(25000) });
    const data = await response.json() as CalendarData & { error?: string };
    if (!response.ok) throw new Error(data.error || 'Could not load bookings.');
    setFeeds(data.feeds); setBookings(data.bookings);
    return data;
  }, []);

  const refresh = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      const current = await request();
      for (const feed of current.feeds) {
        if (!feed.syncedAt || Date.now() - new Date(feed.syncedAt).getTime() > 15 * 60 * 1000) await request({ action: 'sync', id: feed.id });
      }
      window.dispatchEvent(new Event('rental-bookings-changed'));
    } catch { setError('Calendar refresh failed. Your last synced bookings are kept. Try again.'); }
    finally { busyRef.current = false; setBusy(false); }
  }, [request]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 15 * 60 * 1000);
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearTimeout(initial); window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [refresh]);

  async function change(body: Record<string, unknown>, success?: string) {
    if (busyRef.current) return false;
    busyRef.current = true; setBusy(true); setError(''); setNotice('');
    try {
      await request(body);
      if (success) setNotice(success);
      window.dispatchEvent(new Event('rental-bookings-changed'));
      return true;
    } catch (failure) {
      setError(failure instanceof Error && failure.name !== 'TimeoutError' ? failure.message : 'The calendar request timed out. Check saved bookings before retrying.');
      return false;
    } finally { busyRef.current = false; setBusy(false); }
  }

  async function connect(event: FormEvent) {
    event.preventDefault();
    if (await change({ action: 'connect', propertyId, provider, url }, 'Calendar connected and reservations imported.')) setUrl('');
  }

  async function createPrivate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (await change({ action: 'create_private', propertyId, guestName: form.get('guestName'), start: form.get('start'), end: form.get('end'), payout: form.get('payout'), notes: form.get('notes') }, 'Private booking added.')) event.currentTarget.reset();
  }

  async function updateBooking(event: FormEvent<HTMLFormElement>, booking: Booking) {
    event.preventDefault();
    const editor = event.currentTarget.closest('details');
    const form = new FormData(event.currentTarget);
    if (await change({ action: 'update_booking', id: booking.id, guestName: form.get('guestName'), payout: form.get('payout'), notes: form.get('notes'), start: form.get('start') || booking.start, end: form.get('end') || booking.end }, 'Booking details saved.')) editor?.removeAttribute('open');
  }

  const selectedFeeds = feeds.filter(feed => feed.propertyId === propertyId);
  const selectedBookings = bookings.filter(booking => booking.propertyId === propertyId);
  const monthStart = `${month}-01`;
  const monthEnd = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1)).toISOString().slice(0, 10);
  const visibleBookings = selectedBookings.filter(booking => booking.start < monthEnd && booking.end > monthStart).sort((a,b) => a.start.localeCompare(b.start));
  const blocked = selectedFeeds.flatMap(feed => feed.events.filter(event => event.kind === 'blocked').map(event => ({ ...event, provider: feed.provider })));
  const calendarEntries = [...selectedBookings, ...blocked];
  const blockedNights = calendarNights(calendarEntries, month);
  const bookedNights = calendarNights(visibleBookings, month);
  const expectedPayout = bookingPayoutForMonth(selectedBookings, month);
  const detailsNeeded = visibleBookings.filter(booking => !booking.guestName || Number(booking.payout) === 0).length;
  const selectedProperty = properties.find(property => property.id === propertyId)?.name || 'property';
  const visualEntries: CalendarEntry[] = [
    ...selectedBookings.map(booking => ({ id: booking.id, start: booking.start, end: booking.end, provider: booking.provider, guestName: booking.guestName })),
    ...blocked.map(event => ({ id: `${event.provider}:${event.uid}`, start: event.start, end: event.end, provider: event.provider, blocked: true })),
  ];

  return <section className="space-y-6 rounded-2xl border bg-white p-5 shadow-sm">
    <div><h3 className="text-xl font-bold">Booking calendars</h3><p className="mt-1 text-sm text-muted-foreground">See guest names, dates, and expected payouts for each property. Airbnb and Vrbo dates refresh automatically; add guest and payout details when the provider feed leaves them out.</p></div>
    <div className="space-y-2"><Label htmlFor="calendar-property">Property</Label><select id="calendar-property" className="h-11 w-full rounded-md border bg-white px-3 font-semibold text-[#173f5f]" value={propertyId} onChange={event => setPropertyId(event.target.value)}><option value="" disabled>Choose a property</option>{properties.map(property => <option value={property.id} key={property.id}>{property.name}</option>)}</select></div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-lg bg-green-50 p-3 text-green-800">{notice}</p>}

    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl bg-[#e9f0f5] p-4"><p className="text-sm font-medium text-[#536170]">Booked nights</p><p className="mt-1 text-2xl font-bold">{bookedNights}</p><p className="text-xs text-[#536170]">{month}</p></div>
      <div className="rounded-xl bg-[#e6f2ee] p-4"><p className="text-sm font-medium text-[#536170]">Expected payout</p><p className="mt-1 text-2xl font-bold text-[#2f7d69]">{money(expectedPayout)}</p><p className="text-xs text-[#536170]">{selectedProperty} · checkout month</p></div>
      <div className="rounded-xl bg-[#fff3d6] p-4"><p className="text-sm font-medium text-[#536170]">Details needed</p><p className="mt-1 text-2xl font-bold text-[#8a6112]">{detailsNeeded}</p><p className="text-xs text-[#536170]">Missing guest or payout</p></div>
    </div>

    <details className="rounded-xl border p-4">
      <summary className="cursor-pointer font-bold">Connect or manage Airbnb and Vrbo feeds</summary>
      <form onSubmit={connect} className="mt-4 grid items-end gap-3 sm:grid-cols-[130px_1fr_auto]">
        <div className="space-y-2"><Label htmlFor="calendar-provider">Platform</Label><select id="calendar-provider" className="h-10 w-full rounded-md border bg-white px-3" value={provider} onChange={event => setProvider(event.target.value)}><option value="airbnb">Airbnb</option><option value="vrbo">Vrbo</option></select></div>
        <div className="space-y-2"><Label htmlFor="calendar-url">Calendar export link</Label><Input id="calendar-url" type="url" required value={url} onChange={event => setUrl(event.target.value)} placeholder="https://…" autoComplete="off" /></div>
        <Button disabled={busy || !propertyId} type="submit">{busy ? 'Please wait…' : selectedFeeds.some(feed => feed.provider === provider) ? 'Replace connection' : 'Connect calendar'}</Button>
      </form>
      <p className="mt-3 text-sm text-muted-foreground">Calendar feeds normally contain dates only. Guest names and payouts stay editable here and are preserved during refreshes.</p>
      {selectedFeeds.map(feed => <div key={feed.id} className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-bold capitalize">{feed.provider}</p><p className="text-sm">Last sync: {feed.syncedAt ? new Date(feed.syncedAt).toLocaleString() : 'Not yet synced'}</p>{feed.syncError && <p role="alert" className="text-sm text-red-800">{feed.syncError}</p>}</div><div className="flex gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => void change({ action:'sync', id:feed.id }, 'Calendar refreshed.')}>Sync now</Button><Button type="button" variant="outline" disabled={busy} onClick={() => { if (window.confirm('Disconnect this feed and remove its imported reservations? Private bookings and financial records will be kept.')) void change({ action:'disconnect', id:feed.id }, 'Calendar disconnected.'); }}>Disconnect</Button></div></div>)}
    </details>

    <details className="rounded-xl border border-[#d8c18c] bg-[#fffdf7] p-4">
      <summary className="cursor-pointer font-bold"><span className="inline-flex items-center gap-2"><CalendarPlus className="size-4" /> Add a private booking</span></summary>
      <form onSubmit={createPrivate} className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="private-guest">Guest name</Label><Input id="private-guest" name="guestName" required placeholder="Guest name" /></div>
        <div className="space-y-2"><Label htmlFor="private-payout">Expected payout</Label><Input id="private-payout" name="payout" type="number" min="0" max="1000000" step="0.01" required placeholder="0.00" /></div>
        <div className="space-y-2"><Label htmlFor="private-start">Arrival</Label><Input id="private-start" name="start" type="date" required /></div>
        <div className="space-y-2"><Label htmlFor="private-end">Checkout</Label><Input id="private-end" name="end" type="date" required /></div>
        <div className="space-y-2 md:col-span-2"><Label htmlFor="private-notes">Notes</Label><Textarea id="private-notes" name="notes" placeholder="Phone number, payment notes, or special requests" /></div>
        <Button className="md:col-span-2" disabled={busy || !propertyId} type="submit">Add private booking to {selectedProperty}</Button>
      </form>
    </details>

    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><h4 className="font-bold">{selectedProperty} · {month}</h4><p className="text-sm text-muted-foreground">Bars begin on arrival and end at checkout.</p></div><p className="text-sm font-bold">{blockedNights} unavailable nights · {bookedNights} booked</p></div>
      <div className="mb-3 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-[#173f5f] px-3 py-1 text-white">Airbnb</span><span className="rounded-full bg-[#2874a6] px-3 py-1 text-white">VRBO</span><span className="rounded-full bg-[#2f7d69] px-3 py-1 text-white">Private</span><span className="rounded-full bg-[#7b8794] px-3 py-1 text-white">Owner block</span></div>
      <BookingMonth month={month} entries={visualEntries} />
    </div>

    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3"><div><h4 className="font-bold">Reservations for {month}</h4><p className="text-sm text-muted-foreground">Payouts below automatically total in the property summary above.</p></div><span className="text-sm font-bold">{visibleBookings.length} bookings</span></div>
      {visibleBookings.map(booking => <details key={booking.id} className="rounded-xl border p-4">
        <summary className="cursor-pointer list-none">
          <div className="grid items-center gap-3 sm:grid-cols-[110px_1fr_120px_auto]">
            <span className="rounded-full bg-[#e9f0f5] px-3 py-1 text-center text-xs font-bold capitalize">{booking.provider}</span>
            <span><strong className="flex items-center gap-1"><UserRound className="size-4" />{booking.guestName || 'Guest details needed'}</strong><span className="text-sm text-muted-foreground">{booking.start} to {booking.end} · {nights(booking.start, booking.end)} nights</span></span>
            <strong className="flex items-center gap-1 text-[#2f7d69]"><DollarSign className="size-4" />{money(Number(booking.payout) || 0)}</strong>
            <span className="flex items-center gap-1 text-sm font-bold"><PencilLine className="size-4" /> Edit</span>
          </div>
        </summary>
        <form onSubmit={event => void updateBooking(event, booking)} className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-2">
          <div className="space-y-2"><Label>Guest name</Label><Input name="guestName" defaultValue={booking.guestName} required /></div>
          <div className="space-y-2"><Label>Expected payout</Label><Input name="payout" type="number" min="0" max="1000000" step="0.01" defaultValue={Number(booking.payout) || 0} required /></div>
          {booking.provider === 'private' && <><div className="space-y-2"><Label>Arrival</Label><Input name="start" type="date" defaultValue={booking.start} required /></div><div className="space-y-2"><Label>Checkout</Label><Input name="end" type="date" defaultValue={booking.end} required /></div></>}
          <div className="space-y-2 md:col-span-2"><Label>Notes</Label><Textarea name="notes" defaultValue={booking.notes} placeholder="Payment notes or special requests" /></div>
          <div className="flex flex-wrap gap-2 md:col-span-2"><Button disabled={busy} type="submit">Save booking details</Button>{booking.provider === 'private' && <Button disabled={busy} type="button" variant="outline" onClick={() => { if (window.confirm('Delete this private booking?')) void change({ action:'delete_private', id:booking.id }, 'Private booking deleted.'); }}><Trash2 className="size-4" /> Delete private booking</Button>}</div>
        </form>
      </details>)}
      {!visibleBookings.length && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No reservations for this property in {month}. Add a private booking or connect a calendar feed.</p>}
    </div>
  </section>;
}
