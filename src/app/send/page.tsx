"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chip } from "@/ui/Chip";
import { describedBy, Field, INPUT } from "@/ui/Field";
import { fetchJson, jsonBody } from "@/ui/fetchJson";
import { WarningIcon } from "@/ui/icons";
import { Notice } from "@/ui/Notice";
import { FinePrint, Lead, Screen, Title } from "@/ui/Screen";
import { SignedOut } from "@/ui/SignedOut";
import { Skeleton } from "@/ui/Skeleton";
import { useOnce } from "@/ui/useOnce";
import { parseAmountCents } from "./amount";
import { PayPalApprove } from "./PayPalApprove";
import { approvalErrorCopy, riskScreen } from "./riskScreen";

type Level = "low" | "medium" | "high";
type Result = { paymentId: string; orderId: string; risk: { level: Level; reasons: string[] } };
type Me = { circle: { displayName: string }[] };
type Errors = Partial<Record<"payee" | "amount" | "answer" | "note", string>>;
type Phase =
  | { kind: "form" }
  | { kind: "checking" }
  | { kind: "risk"; result: Result; cents: number }
  | { kind: "approving" }
  | { kind: "approvalError"; message: string; canRetry: boolean }
  | { kind: "signedOut" };

const FIELD_FOR: Record<string, keyof Errors> = { payee: "payee", amount: "amount", amountCents: "amount", note: "note", senderAnswer: "answer", answer: "answer" };
const SAFE_FALLBACK = "We couldn't finish that just now. Please try again, or check your payments for the latest status.";
const money = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

export default function SendPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "form" });
  const [payee, setPayee] = useState("");
  const [amount, setAmount] = useState("");
  const [answer, setAnswer] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [circleName, setCircleName] = useState<string | null>(null);
  const [confirmedMedium, setConfirmedMedium] = useState(false);
  const [signedOutNotice, setSignedOutNotice] = useState(false);
  const approvedFor = useRef<string | null>(null);
  const paymentRef = useRef<string | null>(null);
  const { busy, run } = useOnce();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetchJson<Me>("/api/me");
      if (!cancelled && r.ok) setCircleName(r.data.circle[0]?.displayName ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const check = () =>
    run(async () => {
      const next: Errors = {};
      if (!payee.trim()) next.payee = "Please enter their email address or mobile number.";
      const cents = parseAmountCents(amount);
      if (cents === null) next.amount = "Please enter an amount between $0.01 and $10,000.";
      setFormNotice(null);
      setSignedOutNotice(false);
      setErrors(next);
      if (cents === null || next.payee) return;
      setPhase({ kind: "checking" });
      const r = await fetchJson<Result>(
        "/api/payments",
        jsonBody({ payee: payee.trim(), amountCents: cents, note: note.trim() || undefined, senderAnswer: answer.trim() || undefined }),
      );
      if (r.ok) {
        paymentRef.current = r.data.paymentId;
        setConfirmedMedium(false);
        return setPhase({ kind: "risk", result: r.data, cents });
      }
      setPhase({ kind: "form" });
      if (r.signedOut) return setSignedOutNotice(true);
      const field = r.field ? FIELD_FOR[r.field] : undefined;
      if (field) return setErrors({ [field]: r.error });
      setFormNotice(r.error);
    });

  const finish = useCallback(async () => {
    const id = paymentRef.current;
    if (!id || approvedFor.current === id) return;
    approvedFor.current = id;
    setPhase({ kind: "approving" });
    const r = await fetchJson<unknown>(`/api/payments/${id}/approved`, { method: "POST" });
    // A 200 or a 202 both mean PayPal approved it: the payment page shows where it stands.
    if (r.ok) return router.push(`/payments/${id}`);
    if (r.signedOut) return setPhase({ kind: "signedOut" });
    const copy = approvalErrorCopy(r.status, r.error);
    // After approval the money may have moved, so never carry a "nothing was sent" message onto this screen.
    const message = /nothing (has been|was) sent/i.test(copy.message) ? SAFE_FALLBACK : copy.message;
    setPhase({ kind: "approvalError", message, canRetry: copy.canRetry });
  }, [router]);

  // Retrying asks the server again about the order PayPal already approved. It never reopens PayPal.
  const retry = () => {
    approvedFor.current = null;
    void finish();
  };

  if (phase.kind === "signedOut") {
    return (
      <Screen title="Send money">
        <SignedOut />
      </Screen>
    );
  }

  if (phase.kind === "checking") {
    return (
      <Screen title="Send money" backHref="/home">
        <p role="status" className="mt-[22px] text-[20px] font-bold leading-snug">
          Checking this payment…
        </p>
        <Lead>We look at who you are paying and what you told us. Nothing is sent yet.</Lead>
        <Skeleton blocks={[30, 90, 18, 18, 18]} />
      </Screen>
    );
  }

  if (phase.kind === "approving") {
    return (
      <Screen title="Send money">
        <p role="status" className="mt-[22px] text-[20px] font-bold leading-snug">
          Finishing your payment…
        </p>
        <Lead>PayPal approved it. This takes a few seconds. Please stay on this page.</Lead>
        <Skeleton blocks={[30, 90, 18, 18]} />
      </Screen>
    );
  }

  if (phase.kind === "approvalError") {
    return (
      <Screen
        title="Send money"
        footer={
          <>
            {phase.canRetry && <Button data-testid="retry-approval" onClick={retry}>Try again</Button>}
            <ButtonLink href="/home#recent" variant={phase.canRetry ? "quiet" : "primary"}>
              Go to my payments
            </ButtonLink>
          </>
        }
      >
        <Title>We couldn&apos;t finish that just now</Title>
        <div className="mt-5">
          <Notice tone="error">{phase.message}</Notice>
        </div>
        <Lead>You approved this in PayPal, so it may already be on its way. Check your payments for the latest status before you try anything else.</Lead>
      </Screen>
    );
  }

  if (phase.kind === "risk") {
    const { result, cents } = phase;
    const level = result.risk.level;
    const copy = riskScreen(level, { circleName });
    const showPayPal = level !== "medium" || confirmedMedium;
    return (
      <Screen
        title="Send money"
        footer={
          <>
            {showPayPal ? (
              <PayPalApprove orderId={result.orderId} onApproved={finish} label={copy.continueLabel} />
            ) : (
              <Button data-testid="confirm-medium" onClick={() => setConfirmedMedium(true)}>
                I understand, continue
              </Button>
            )}
            <ButtonLink href="/home" variant="quiet">
              Cancel this payment
            </ButtonLink>
          </>
        }
      >
        <div data-testid={`risk-${level}`} className="flex flex-1 flex-col">
          <div className="mt-5">
            <Chip tone={copy.chipTone}>{copy.chip}</Chip>
          </div>
          <Title>{copy.title}</Title>
          <Lead>{copy.lead}</Lead>
          <Card className="mt-[22px] flex flex-wrap items-end justify-between gap-x-3 gap-y-2 bg-white">
            <div className="flex min-w-0 max-w-full flex-col gap-1">
              <span className="text-[16px] text-ink-3">To</span>
              <span className="break-words text-[21px] font-bold">{payee.trim()}</span>
            </div>
            <span className="text-[34px] font-extrabold tabular-nums tracking-[-0.02em]">{money(cents)}</span>
          </Card>
          {result.risk.reasons.length > 0 && (
            <ul className="mt-6 flex flex-col gap-4">
              {result.risk.reasons.map((r) => (
                <li key={r} className="flex items-start gap-3.5 text-[18px] leading-snug">
                  <WarningIcon aria-hidden="true" size={22} weight="bold" className="mt-0.5 flex-none text-caution-ink" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
          {copy.holdNote && (
            <div className="mt-6">
              <Notice tone="pending">{copy.holdNote}</Notice>
            </div>
          )}
        </div>
      </Screen>
    );
  }

  return (
    <Screen
      title="Send money"
      backHref="/home"
      footer={
        <>
          {signedOutNotice && <SignedOut />}
          {formNotice && <Notice tone="error">{formNotice}</Notice>}
          <Button data-testid="check" disabled={busy} onClick={check}>
            Check this payment
          </Button>
          <FinePrint>Nothing is sent until you approve it in PayPal.</FinePrint>
        </>
      }
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void check();
        }}
        className="mt-4 flex flex-col gap-5"
      >
        <Field id="payee" label="Who are you paying?" hint="Their email address or mobile number" error={errors.payee}>
          <input
            id="payee"
            data-testid="payee"
            autoComplete="off"
            value={payee}
            onChange={(e) => setPayee(e.target.value)}
            aria-describedby={describedBy("payee", "Their email address or mobile number", errors.payee)}
            aria-invalid={errors.payee ? true : undefined}
            className={INPUT}
          />
        </Field>
        <Field id="amount" label="How much?" error={errors.amount}>
          <div className="flex h-16 items-center rounded-control border-2 border-line-strong bg-surface px-4 focus-within:outline-3 focus-within:outline-offset-3 focus-within:outline-held">
            <span aria-hidden="true" className="text-[30px] font-extrabold text-ink-3">$</span>
            <input
              id="amount"
              data-testid="amount"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-describedby={describedBy("amount", undefined, errors.amount)}
              aria-invalid={errors.amount ? true : undefined}
              className="min-w-0 flex-1 border-0 bg-transparent pl-1.5 text-[30px] font-extrabold tabular-nums text-ink outline-none"
            />
          </div>
        </Field>
        <Field id="answer" label="Who asked you to make this payment, and why?" hint="Your answer helps us spot scams. Only you and your circle can see it." error={errors.answer}>
          <textarea
            id="answer"
            data-testid="answer"
            rows={3}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            aria-describedby={describedBy("answer", "Your answer helps us spot scams. Only you and your circle can see it.", errors.answer)}
            aria-invalid={errors.answer ? true : undefined}
            className={`${INPUT} py-3.5`}
          />
        </Field>
        <Field id="note" label="Note (optional)" error={errors.note}>
          <input
            id="note"
            data-testid="note"
            autoComplete="off"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-describedby={describedBy("note", undefined, errors.note)}
            aria-invalid={errors.note ? true : undefined}
            className={INPUT}
          />
        </Field>
      </form>
    </Screen>
  );
}
