import { cleanerDashboardByToken } from '@/lib/cleaning-db';
import { cleanerIcal } from '@/lib/cleanings.mjs';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    if (!/^[A-Za-z0-9_-]{24,80}$/.test(token)) return new Response('Schedule not found.', { status: 404 });
    const dashboard = await cleanerDashboardByToken(token);
    if (!dashboard) return new Response('Schedule not found.', { status: 404 });
    return new Response(cleanerIcal(dashboard.jobs.filter(job => job.status === 'scheduled'), 'Rental cleaning schedule'), {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="rental-cleanings.ics"',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    return new Response('Could not load the cleaning calendar.', { status: 503 });
  }
}
