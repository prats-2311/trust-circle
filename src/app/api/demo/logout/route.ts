export async function POST() {
  return new Response(null, { status: 204, headers: { "Set-Cookie": "tc_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" } });
}
