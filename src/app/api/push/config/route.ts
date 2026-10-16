import { getContainer } from "@/server/container";

export async function GET() {
  const { env } = getContainer();
  // Push is on only when both keys are set.
  const on = Boolean(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
  return Response.json({ publicKey: on ? env.NEXT_PUBLIC_VAPID_PUBLIC_KEY! : null });
}
