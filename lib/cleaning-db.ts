import { randomBytes } from 'node:crypto';
import { cleaningCandidates } from './cleanings.mjs';
import { getSql } from './postgres';

export async function ensureCleanerSettings(ownerId: string) {
  const sql = getSql();
  await sql`INSERT INTO cleaner_settings (owner_id, share_token) VALUES (${ownerId}, ${randomBytes(24).toString('base64url')}) ON CONFLICT(owner_id) DO NOTHING`;
}

export async function reconcileCleaningJobs(ownerId: string) {
  const sql = getSql();
  await ensureCleanerSettings(ownerId);
  const [settings] = await sql`SELECT default_fee AS "defaultFee" FROM cleaner_settings WHERE owner_id = ${ownerId}`;
  const feeds = await sql`SELECT id, property_id AS "propertyId", events FROM calendar_feeds WHERE owner_id = ${ownerId}`;
  const candidates = cleaningCandidates(feeds);
  for (const item of candidates) {
    await sql`INSERT INTO cleaning_jobs (id, owner_id, property_id, source_key, checkout_date, fee)
      VALUES (${crypto.randomUUID()}, ${ownerId}, ${item.propertyId}, ${item.sourceKey}, ${item.checkoutDate}, ${Number(settings?.defaultFee) || 0})
      ON CONFLICT(owner_id, source_key) DO UPDATE SET property_id = EXCLUDED.property_id, checkout_date = EXCLUDED.checkout_date,
        status = CASE WHEN cleaning_jobs.status = 'cancelled' THEN 'scheduled' ELSE cleaning_jobs.status END, updated_at = now()`;
  }
  const active = candidates.map(item => item.sourceKey);
  if (active.length) {
    const scheduled = await sql`SELECT id, source_key AS "sourceKey" FROM cleaning_jobs
      WHERE owner_id = ${ownerId} AND status = 'scheduled' AND checkout_date >= current_date`;
    const activeKeys = new Set(active);
    for (const job of scheduled) {
      if (!activeKeys.has(job.sourceKey)) await sql`UPDATE cleaning_jobs SET status = 'cancelled', updated_at = now() WHERE id = ${job.id}`;
    }
  } else {
    await sql`UPDATE cleaning_jobs SET status = 'cancelled', updated_at = now()
      WHERE owner_id = ${ownerId} AND status = 'scheduled' AND checkout_date >= current_date`;
  }
}

export async function cleanerDashboard(ownerId: string) {
  const sql = getSql();
  await ensureCleanerSettings(ownerId);
  const [settings] = await sql`SELECT cleaner_name AS "cleanerName", default_fee AS "defaultFee", share_token AS "shareToken" FROM cleaner_settings WHERE owner_id = ${ownerId}`;
  const jobs = await sql`SELECT j.id, j.checkout_date::text AS "checkoutDate", j.fee, j.status, j.completed_at AS "completedAt", j.paid_at AS "paidAt",
      p.id AS "propertyId", p.name AS "propertyName", p.address
    FROM cleaning_jobs j JOIN properties p ON p.id = j.property_id
    WHERE j.owner_id = ${ownerId} AND j.checkout_date >= current_date - interval '60 days'
    ORDER BY j.checkout_date, p.name`;
  return { settings, jobs };
}

export async function cleanerDashboardByToken(token: string) {
  const sql = getSql();
  const [settings] = await sql`SELECT owner_id AS "ownerId", cleaner_name AS "cleanerName"
    FROM cleaner_settings WHERE share_token = ${token}`;
  if (!settings) return null;
  await reconcileCleaningJobs(settings.ownerId);
  const jobs = await sql`SELECT j.id, j.checkout_date::text AS "checkoutDate", j.status,
      p.name AS "propertyName", p.address
    FROM cleaning_jobs j JOIN properties p ON p.id = j.property_id
    WHERE j.owner_id = ${settings.ownerId} AND j.status != 'cancelled' AND j.checkout_date >= current_date - interval '14 days'
    ORDER BY j.checkout_date, p.name`;
  return { cleanerName: settings.cleanerName, jobs };
}
