import { InvalidTransitionError } from "@/domain/paymentStateMachine";
import { ConcurrentUpdateError } from "@/payments/paymentRepo";
import { NotAllowedError, PaymentInputError, PaymentPendingError } from "@/payments/paymentService";
import { MessageInputError } from "@/messages/messageService";
import { ReportError } from "@/reports/reportService";
import { PayPalError } from "@/payments/paypalGateway";
import { SettingsInputError } from "@/settings/settingsService";
import { VerificationClosedError, VerificationInputError } from "@/verification/verificationService";
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
  return verifySession(decoded, getContainer().env.SESSION_SECRET, new Date());
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
  if (e instanceof ReportError) return Response.json({ error: e.message }, { status: 400 });
  if (e instanceof MessageInputError) return Response.json({ error: e.message, field: e.field }, { status: 400 });
  if (e instanceof SettingsInputError) return Response.json({ error: e.message }, { status: 400 });
  if (e instanceof VerificationInputError) return Response.json({ error: e.message }, { status: 400 });
  if (e instanceof VerificationClosedError) return Response.json({ error: e.message }, { status: 409 });
  if (e instanceof PaymentInputError) return Response.json({ error: e.message, field: e.field }, { status: 400 });
  if (e instanceof NotAllowedError) return Response.json({ error: e.message }, { status: 403 });
  if (e instanceof ConcurrentUpdateError || e instanceof InvalidTransitionError) {
    return Response.json({ error: "This payment has already been dealt with." }, { status: 409 });
  }
  if (e instanceof PaymentPendingError) {
    const c = e.cause;
    console.error("payment pending", {
      paymentId: e.paymentId,
      cause: c instanceof Error ? c.name : "unknown",
      ...(c instanceof PayPalError ? { status: c.status, debugId: c.debugId } : {}),
    });
    return Response.json(
      {
        error: "We're finishing this payment for you. You can check its status on your payments page. Please don't send it again.",
        paymentId: e.paymentId,
      },
      { status: 202 },
    );
  }
  if (e instanceof PayPalError) {
    console.error("paypal error", { issue: e.issue, debugId: e.debugId, status: e.status, uncertain: e.uncertain });
    if (e.uncertain) {
      return Response.json(
        { error: "PayPal didn't answer in time. Nothing has been sent. Please try again in a moment." },
        { status: 503 },
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
