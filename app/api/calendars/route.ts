import { getSessionFromRequest } from '@/lib/auth';
import { getSql } from '@/lib/postgres';
import { calendarUrl, fetchCalendar } from '@/lib/calendar.mjs';

export const dynamic = 'force-dynamic';
async function list(owner: string) {
  return getSql()`SELECT id, property_id AS "propertyId", provider, events, synced_at AS "syncedAt", sync_error AS "syncError" FROM calendar_feeds WHERE owner_id = ${owner} ORDER BY provider`;
}
export async function GET(request: Request) {
  const owner = getSessionFromRequest(request)?.username;
  if (!owner) return Response.json({ error: 'Sign in required.' }, { status: 401 });
  try { return Response.json({ feeds: await list(owner) }); }
  catch { return Response.json({ error: 'Could not load calendars. Try again shortly.' }, { status: 503 }); }
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
      await sql`INSERT INTO calendar_feeds (id, owner_id, property_id, provider, url, events, synced_at, attempted_at)
        VALUES (${crypto.randomUUID()}, ${owner}, ${propertyId}, ${provider}, ${url}, ${sql.json(events)}, now(), now())
        ON CONFLICT(owner_id, property_id, provider) DO UPDATE SET url = EXCLUDED.url, events = EXCLUDED.events, synced_at = now(), attempted_at = now(), sync_error = NULL`;
    } else if (input.action === 'disconnect') {
      await sql`DELETE FROM calendar_feeds WHERE id = ${String(input.id || '')} AND owner_id = ${owner}`;
    } else if (input.action === 'sync') {
      // Claim one feed atomically: concurrent browser tabs cannot overwrite newer syncs.
      const claimed = await sql`UPDATE calendar_feeds SET attempted_at = now() WHERE id = ${String(input.id || '')} AND owner_id = ${owner}
        AND (attempted_at IS NULL OR attempted_at < now() - interval '1 minute') RETURNING id, url, provider`;
      for (const feed of claimed) {
        try {
          const events = await fetchCalendar(feed.url, feed.provider);
          await sql`UPDATE calendar_feeds SET events = ${sql.json(events)}, synced_at = now(), sync_error = NULL WHERE id = ${feed.id} AND owner_id = ${owner} AND url = ${feed.url}`;
        } catch {
          // Preserve the last good snapshot on provider failures; never reveal secret URLs.
          await sql`UPDATE calendar_feeds SET sync_error = 'Could not refresh. Showing the last successful sync; check your export link or try again.' WHERE id = ${feed.id} AND owner_id = ${owner} AND url = ${feed.url}`;
        }
      }
    } else return Response.json({ error: 'Unknown calendar action.' }, { status: 400 });
    return Response.json({ feeds: await list(owner) });
  } catch {
    return Response.json({ error: 'Could not connect. Use a valid HTTPS Airbnb or Vrbo iCal export link and try again. Existing calendar data has been kept.' }, { status: 400 });
  }
}
