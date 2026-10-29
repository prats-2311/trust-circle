export const dynamic = "force-dynamic";

/** Keep-warm target: wakes the web service without touching the database, so the database can still sleep. */
export async function GET() {
  return Response.json({ ok: true });
}
