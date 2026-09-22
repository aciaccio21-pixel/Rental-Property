import { getSql } from './postgres';

type Feed = { id: string; propertyId: string; provider: string; events: Array<{ uid: string; start: string; end: string; summary: string; kind: string }> };

export async function reconcileImportedBookings(ownerId: string, onlyFeedId?: string) {
  const sql = getSql();
  const feeds = onlyFeedId
    ? await sql`SELECT id, property_id AS "propertyId", provider, events FROM calendar_feeds WHERE owner_id = ${ownerId} AND id = ${onlyFeedId}`
    : await sql`SELECT id, property_id AS "propertyId", provider, events FROM calendar_feeds WHERE owner_id = ${ownerId}`;
  for (const raw of feeds) {
    const feed = raw as Feed;
    const activeKeys = new Set<string>();
    for (const event of Array.isArray(feed.events) ? feed.events : []) {
      if (event.kind !== 'reservation' || !event.uid) continue;
      const sourceKey = `${feed.id}:${event.uid}`;
      activeKeys.add(sourceKey);
      await sql`INSERT INTO calendar_bookings
        (id, owner_id, property_id, feed_id, source_key, provider, arrival_date, checkout_date, provider_title)
        VALUES (${crypto.randomUUID()}, ${ownerId}, ${feed.propertyId}, ${feed.id}, ${sourceKey}, ${feed.provider}, ${event.start}, ${event.end}, ${event.summary || ''})
        ON CONFLICT(owner_id, source_key) DO UPDATE SET property_id = EXCLUDED.property_id, feed_id = EXCLUDED.feed_id,
          provider = EXCLUDED.provider, arrival_date = EXCLUDED.arrival_date, checkout_date = EXCLUDED.checkout_date,
          provider_title = EXCLUDED.provider_title, active = true, updated_at = now()
        WHERE calendar_bookings.property_id IS DISTINCT FROM EXCLUDED.property_id
          OR calendar_bookings.feed_id IS DISTINCT FROM EXCLUDED.feed_id
          OR calendar_bookings.provider IS DISTINCT FROM EXCLUDED.provider
          OR calendar_bookings.arrival_date IS DISTINCT FROM EXCLUDED.arrival_date
          OR calendar_bookings.checkout_date IS DISTINCT FROM EXCLUDED.checkout_date
          OR calendar_bookings.provider_title IS DISTINCT FROM EXCLUDED.provider_title
          OR calendar_bookings.active = false`;
    }
    const rows = await sql`SELECT id, source_key AS "sourceKey" FROM calendar_bookings WHERE owner_id = ${ownerId} AND feed_id = ${feed.id} AND active = true`;
    for (const row of rows) {
      if (!activeKeys.has(row.sourceKey)) await sql`UPDATE calendar_bookings SET active = false, updated_at = now() WHERE id = ${row.id}`;
    }
  }
}

export async function listBookings(ownerId: string) {
  const sql = getSql();
  return sql`SELECT id, property_id AS "propertyId", provider, arrival_date::text AS "start", checkout_date::text AS "end",
      guest_name AS "guestName", payout, notes, provider_title AS "providerTitle", active
    FROM calendar_bookings WHERE owner_id = ${ownerId} AND active = true
    ORDER BY arrival_date, checkout_date, created_at`;
}
