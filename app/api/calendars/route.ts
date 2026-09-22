import { getSessionFromRequest } from '@/lib/auth';
import { listBookings, reconcileImportedBookings } from '@/lib/booking-db';
import { getSql } from '@/lib/postgres';
import { calendarUrl, fetchCalendar } from '@/lib/calendar.mjs';

export const dynamic = 'force-dynamic';
const shortText = (value: unknown, max = 160) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const isoDate = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : '';
const amount = (value: unknown) => {
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 && result <= 1_000_000 ? Math.round(result * 100) / 100 : null;
};

async function dashboard(owner: string, reconcile = true) {
  const sql = getSql();
  if (reconcile) await reconcileImportedBookings(owner);
  const feeds = await sql`SELECT id, property_id AS "propertyId", provider, events, synced_at AS "syncedAt", sync_error AS "syncError" FROM calendar_feeds WHERE owner_id = ${owner} ORDER BY provider`;
  return { feeds, bookings: await listBookings(owner) };
}

export async function GET(request: Request) {
  const owner = getSessionFromRequest(request)?.username;
  if (!owner) return Response.json({ error: 'Sign in required.' }, { status: 401 });
  try { return Response.json(await dashboard(owner)); }
  catch { return Response.json({ error: 'Could not load bookings. Try again shortly.' }, { status: 503 }); }
}

export async function POST(request: Request) {
  const owner = getSessionFromRequest(request)?.username;
  if (!owner) return Response.json({ error: 'Sign in required.' }, { status: 401 });
  const sql = getSql();
  try {
    const input = await request.json();
    if (input.action === 'connect') {
      const propertyId = String(input.propertyId || '');
      const provider = String(input.provider || '');
      const [property] = await sql`SELECT id FROM properties WHERE id = ${propertyId} AND owner_id = ${owner}`;
      if (!property) return Response.json({ error: 'Choose one of your properties.' }, { status: 400 });
      const url = calendarUrl(String(input.url || ''), provider);
      const events = await fetchCalendar(url, provider);
      const [feed] = await sql`INSERT INTO calendar_feeds (id, owner_id, property_id, provider, url, events, synced_at, attempted_at)
        VALUES (${crypto.randomUUID()}, ${owner}, ${propertyId}, ${provider}, ${url}, ${sql.json(events)}, now(), now())
        ON CONFLICT(owner_id, property_id, provider) DO UPDATE SET url = EXCLUDED.url, events = EXCLUDED.events, synced_at = now(), attempted_at = now(), sync_error = NULL
        RETURNING id`;
      await reconcileImportedBookings(owner, feed.id);
    } else if (input.action === 'disconnect') {
      await sql`DELETE FROM calendar_feeds WHERE id = ${String(input.id || '')} AND owner_id = ${owner}`;
    } else if (input.action === 'sync') {
      const claimed = await sql`UPDATE calendar_feeds SET attempted_at = now() WHERE id = ${String(input.id || '')} AND owner_id = ${owner}
        AND (attempted_at IS NULL OR attempted_at < now() - interval '1 minute') RETURNING id, url, provider`;
      for (const feed of claimed) {
        try {
          const events = await fetchCalendar(feed.url, feed.provider);
          await sql`UPDATE calendar_feeds SET events = ${sql.json(events)}, synced_at = now(), sync_error = NULL WHERE id = ${feed.id} AND owner_id = ${owner} AND url = ${feed.url}`;
          await reconcileImportedBookings(owner, feed.id);
        } catch {
          await sql`UPDATE calendar_feeds SET sync_error = 'Could not refresh. Showing the last successful sync; check your export link or try again.' WHERE id = ${feed.id} AND owner_id = ${owner} AND url = ${feed.url}`;
        }
      }
    } else if (input.action === 'create_private') {
      const propertyId = String(input.propertyId || '');
      const start = isoDate(input.start), end = isoDate(input.end), payout = amount(input.payout);
      const [property] = await sql`SELECT id FROM properties WHERE id = ${propertyId} AND owner_id = ${owner}`;
      if (!property) return Response.json({ error: 'Choose one of your properties.' }, { status: 400 });
      if (!start || !end || end <= start) return Response.json({ error: 'Checkout must be after arrival.' }, { status: 400 });
      if (payout === null) return Response.json({ error: 'Enter a valid payout amount.' }, { status: 400 });
      const [conflict] = await sql`SELECT id FROM calendar_bookings WHERE owner_id = ${owner} AND property_id = ${propertyId} AND active = true
        AND arrival_date < ${end} AND checkout_date > ${start} LIMIT 1`;
      if (conflict) return Response.json({ error: 'Those dates overlap another booking for this property.' }, { status: 400 });
      const id = crypto.randomUUID();
      await sql`INSERT INTO calendar_bookings
        (id, owner_id, property_id, source_key, provider, arrival_date, checkout_date, guest_name, payout, notes)
        VALUES (${id}, ${owner}, ${propertyId}, ${`private:${id}`}, 'private', ${start}, ${end}, ${shortText(input.guestName)}, ${payout}, ${shortText(input.notes, 500)})`;
    } else if (input.action === 'update_booking') {
      const id = String(input.id || '');
      const payout = amount(input.payout);
      if (payout === null) return Response.json({ error: 'Enter a valid payout amount.' }, { status: 400 });
      const [booking] = await sql`SELECT id, provider FROM calendar_bookings WHERE id = ${id} AND owner_id = ${owner}`;
      if (!booking) return Response.json({ error: 'Booking not found.' }, { status: 404 });
      if (booking.provider === 'private') {
        const start = isoDate(input.start), end = isoDate(input.end);
        if (!start || !end || end <= start) return Response.json({ error: 'Checkout must be after arrival.' }, { status: 400 });
        const [conflict] = await sql`SELECT id FROM calendar_bookings WHERE owner_id = ${owner} AND id != ${id} AND property_id = (SELECT property_id FROM calendar_bookings WHERE id = ${id})
          AND active = true AND arrival_date < ${end} AND checkout_date > ${start} LIMIT 1`;
        if (conflict) return Response.json({ error: 'Those dates overlap another booking for this property.' }, { status: 400 });
        await sql`UPDATE calendar_bookings SET arrival_date = ${start}, checkout_date = ${end}, guest_name = ${shortText(input.guestName)}, payout = ${payout}, notes = ${shortText(input.notes, 500)}, updated_at = now()
          WHERE id = ${id} AND owner_id = ${owner}`;
      } else {
        await sql`UPDATE calendar_bookings SET guest_name = ${shortText(input.guestName)}, payout = ${payout}, notes = ${shortText(input.notes, 500)}, updated_at = now()
          WHERE id = ${id} AND owner_id = ${owner}`;
      }
    } else if (input.action === 'delete_private') {
      await sql`DELETE FROM calendar_bookings WHERE id = ${String(input.id || '')} AND owner_id = ${owner} AND provider = 'private'`;
    } else return Response.json({ error: 'Unknown calendar action.' }, { status: 400 });
    return Response.json(await dashboard(owner, false));
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : 'Could not save the booking change.';
    return Response.json({ error: message.includes('calendar export') || message.includes('HTTPS') ? message : 'Could not save the booking change. Existing calendar data has been kept.' }, { status: 400 });
  }
}
