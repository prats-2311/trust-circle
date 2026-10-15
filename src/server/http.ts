import { InvalidTransitionError } from "@/domain/paymentStateMachine";
import { ConcurrentUpdateError } from "@/payments/paymentRepo";
import { NotAllowedError, PaymentInputError } from "@/payments/paymentService";
import { PayPalError } from "@/payments/paypalGateway";
import { getContainer } from "./container";
import { verifySession } from "./session";

export function currentUserId(req: Request): string | null {
  const cookie = req.headers.get("cookie") ?? "";
  const token = cookie.split(/;\s*/).find((c) => c.startsWith("tc_session="))?.slice("tc_session=".length);
  if (!token) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(token);
  } catch {
    return null;
  }
  return verifySession(decoded, getContainer().env.SESSION_SECRET);
}

export const BAD_BODY = "Please check the details and try again.";

/** Parses a JSON object body; returns null for malformed JSON or a non-object (array, null, scalar). */
export async function readJsonObject(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await req.json();
    return typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function badBody(): Response {
  return Response.json({ error: BAD_BODY }, { status: 400 });
}

export function errorResponse(e: unknown): Response {
  if (e instanceof PaymentInputError) return Response.json({ error: e.message, field: e.field }, { status: 400 });
  if (e instanceof NotAllowedError) return Response.json({ error: e.message }, { status: 403 });
  if (e instanceof ConcurrentUpdateError || e instanceof InvalidTransitionError) {
    return Response.json({ error: "This payment has already been dealt with." }, { status: 409 });
  }
  if (e instanceof PayPalError) {
    console.error("paypal error", { issue: e.issue, debugId: e.debugId, status: e.status, uncertain: e.uncertain });
    if (e.uncertain) {
      return Response.json(
        { error: "PayPal is still confirming this step. We will finish it automatically. Nothing more is needed from you." },
        { status: 202 },
      );
    }
    return Response.json(
      { error: "PayPal couldn't complete this step. Nothing has been sent. Please try again." },
      { status: 502 },
    );
  }
  console.error("unexpected error", e instanceof Error ? e.name : "unknown");
  return Response.json({ error: "Something went wrong. Nothing has been sent." }, { status: 500 });
}
