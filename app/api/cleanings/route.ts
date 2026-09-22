import { getSessionFromRequest } from '@/lib/auth';
import { cleanerDashboard, reconcileCleaningJobs } from '@/lib/cleaning-db';
import { getSql } from '@/lib/postgres';

export const dynamic = 'force-dynamic';
const text = (value: unknown, max = 120) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export async function GET(request: Request) {
  const owner = getSessionFromRequest(request)?.username;
  if (!owner) return Response.json({ error:'Sign in required.' }, { status:401 });
  try { await reconcileCleaningJobs(owner); return Response.json(await cleanerDashboard(owner)); }
  catch { return Response.json({ error:'Could not load the cleaner schedule.' }, { status:503 }); }
}

export async function POST(request: Request) {
  const owner = getSessionFromRequest(request)?.username;
  if (!owner) return Response.json({ error:'Sign in required.' }, { status:401 });
  const sql = getSql();
  try {
    const input = await request.json();
    const action = text(input.action, 30);
    if (action === 'save_settings') {
      const fee = Number(input.defaultFee);
      if (!Number.isFinite(fee) || fee < 0 || fee > 10000) return Response.json({ error:'Enter a valid cleaning fee.' }, { status:400 });
      await reconcileCleaningJobs(owner);
      await sql`UPDATE cleaner_settings SET cleaner_name = ${text(input.cleanerName)}, default_fee = ${Math.round(fee * 100) / 100}, updated_at = now() WHERE owner_id = ${owner}`;
      await sql`UPDATE cleaning_jobs SET fee = ${Math.round(fee * 100) / 100}, updated_at = now()
        WHERE owner_id = ${owner} AND status = 'scheduled' AND fee = 0`;
    } else if (action === 'complete') {
      await sql`UPDATE cleaning_jobs SET status = 'completed', completed_at = COALESCE(completed_at, now()), updated_at = now() WHERE id = ${text(input.id, 80)} AND owner_id = ${owner} AND status = 'scheduled'`;
    } else if (action === 'record_paid') {
      await sql.begin(async tx => {
        const [job] = await tx`SELECT j.id, j.fee, j.checkout_date::text AS date, j.status, j.transaction_id, p.name AS property_name, s.cleaner_name
          FROM cleaning_jobs j JOIN properties p ON p.id = j.property_id JOIN cleaner_settings s ON s.owner_id = j.owner_id
          WHERE j.id = ${text(input.id, 80)} AND j.owner_id = ${owner} FOR UPDATE`;
        if (!job) throw new Error('Cleaning not found.');
        if (job.status === 'paid') return;
        if (Number(job.fee) <= 0) throw new Error('Set a cleaning fee before recording payment.');
        const transactionId = job.transaction_id || crypto.randomUUID();
        if (!job.transaction_id) await tx`INSERT INTO transactions
          (id, owner_id, property_id, kind, amount, date, category, counterparty, payment_method, notes, tax_treatment, receipt_on_file, is_demo, created_at)
          SELECT ${transactionId}, ${owner}, property_id, 'expense', ${Number(job.fee)}, ${job.date}, 'Cleaning', ${job.cleaner_name || 'Cleaner'}, 'Recorded payment', ${`Turnover cleaning for ${job.property_name}`}, 'deductible', false, false, now()
          FROM cleaning_jobs WHERE id = ${job.id}`;
        await tx`UPDATE cleaning_jobs SET status = 'paid', completed_at = COALESCE(completed_at, now()), paid_at = now(), transaction_id = ${transactionId}, updated_at = now() WHERE id = ${job.id}`;
      });
    } else if (action === 'set_fee') {
      const fee = Number(input.fee);
      if (!Number.isFinite(fee) || fee < 0 || fee > 10000) return Response.json({ error:'Enter a valid cleaning fee.' }, { status:400 });
      await sql`UPDATE cleaning_jobs SET fee = ${Math.round(fee * 100) / 100}, updated_at = now() WHERE id = ${text(input.id, 80)} AND owner_id = ${owner} AND status != 'paid'`;
    } else return Response.json({ error:'Unknown cleaning action.' }, { status:400 });
    return Response.json(await cleanerDashboard(owner));
  } catch (error) {
    return Response.json({ error:error instanceof Error ? error.message : 'Could not save the cleaning change.' }, { status:400 });
  }
}
