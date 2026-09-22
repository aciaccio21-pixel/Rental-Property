import { cleanerDashboardByToken } from '@/lib/cleaning-db';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    if (!/^[A-Za-z0-9_-]{24,80}$/.test(token)) return Response.json({ error: 'Schedule not found.' }, { status: 404 });
    const dashboard = await cleanerDashboardByToken(token);
    if (!dashboard) return Response.json({ error: 'Schedule not found.' }, { status: 404 });
    return Response.json(dashboard, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return Response.json({ error: 'Could not load the cleaning schedule.' }, { status: 503 });
  }
}
