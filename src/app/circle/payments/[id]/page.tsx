"use client";
import { use, useEffect, useState } from "react";
import { formatUsd } from "@/alerts/alertCopy";
import type { Stage } from "@/app/payments/[id]/screen";
import { Button, ButtonLink } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chip } from "@/ui/Chip";
import { fetchJson, jsonBody } from "@/ui/fetchJson";
import { holdProgress, timeLeftText } from "@/ui/holdProgress";
import { CheckCircleIcon, InfoIcon, PauseIcon } from "@/ui/icons";
import { Notice } from "@/ui/Notice";
import { Screen, Title } from "@/ui/Screen";
import { SignedOut } from "@/ui/SignedOut";
import { Skeleton } from "@/ui/Skeleton";
import { useOnce } from "@/ui/useOnce";
import { closedCopy, decisionResultCopy, verificationNotice, type DecisionTone } from "../../reviewCopy";

type Payment = {
  id: string;
  payee: string;
  amountCents: number;
  state: string;
  reasons: string[];
  senderAnswer: string | null;
  authorisedAt: string | null;
  coolingOffUntil: string | null;
};
type State =
  | { kind: "loading" }
  | { kind: "signedOut" }
  | { kind: "notFound" }
  | { kind: "error"; message: string }
  | { kind: "ready"; p: Payment; senderName: string; stage: Stage | null };
type Result = { decision: "approve" | "block"; status: number } | { failed: string };

const TILE: Record<DecisionTone, { cls: string; Icon: typeof InfoIcon }> = {
  safe: { cls: "bg-evergreen-tint text-evergreen", Icon: CheckCircleIcon },
  pending: { cls: "bg-held-tint text-held", Icon: PauseIcon },
  info: { cls: "bg-neutral-tint text-ink-2", Icon: InfoIcon },
};

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [result, setResult] = useState<Result | null>(null);
  const once = useOnce();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [pay, ver] = await Promise.all([
        fetchJson<{ payment: Payment; senderName: string }>(`/api/circle/payments/${id}`),
        fetchJson<Stage>(`/api/payments/${id}/verification`),
      ]);
      if (cancelled) return;
      if (!pay.ok && pay.signedOut) return setState({ kind: "signedOut" });
      if (!pay.ok) {
        return setState(pay.status === 403 || pay.status === 404 ? { kind: "notFound" } : { kind: "error", message: "We couldn't load this payment. Please refresh." });
      }
      setState({ kind: "ready", p: pay.data.payment, senderName: pay.data.senderName, stage: ver.ok ? ver.data : null });
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const decide = (decision: "approve" | "block") =>
    once.run(async () => {
      const r = await fetchJson<unknown>(`/api/payments/${id}/decision`, jsonBody({ decision }));
      if (!r.ok && r.signedOut) return setState({ kind: "signedOut" });
      if (r.ok || r.status === 202 || r.status === 409) return setResult({ decision, status: r.status });
      // For a network failure or a 5xx the decision may already have gone through, so server text ("nothing was sent") is never shown.
      setResult({
        failed:
          r.status === 0 || r.status >= 500
            ? "We couldn't confirm your decision just now. It may already have gone through. Please refresh this page before deciding again."
            : r.error,
      });
    });

  const back = <ButtonLink href="/circle" variant="secondary">Back to your circle</ButtonLink>;

  if (state.kind === "loading") {
    return (
      <Screen backHref="/circle">
        <p role="status" className="sr-only">Loading the payment…</p>
        <Skeleton blocks={[84, 160, 80, 60]} />
      </Screen>
    );
  }
  if (state.kind === "signedOut") return <Screen><SignedOut /></Screen>;
  if (state.kind === "notFound" || state.kind === "error") {
    return (
      <Screen backHref="/circle" footer={back}>
        {state.kind === "notFound" ? <Title>We couldn&apos;t find this payment</Title> : <div className="mt-6"><Notice tone="error">{state.message}</Notice></div>}
      </Screen>
    );
  }

  const { p, senderName, stage } = state;
  const held = p.state === "held";
  const left = timeLeftText(holdProgress({ authorisedAt: p.authorisedAt, coolingOffUntil: p.coolingOffUntil, now: new Date() }).msLeft);
  const done = result && "decision" in result ? decisionResultCopy(result.decision, result.status, senderName) : null;
  const closed = !held && !done ? { tone: "info" as const, ...closedCopy(p.state, stage, senderName) } : null;
  const shown = done ?? closed;
  const notice = held ? verificationNotice(stage, senderName) : null;

  return (
    <Screen
      backHref="/circle"
      chip={held && !done ? <Chip tone="held">On hold, {left}</Chip> : undefined}
      footer={
        shown ? (
          back
        ) : (
          <>
            {result && "failed" in result && <Notice tone="error">{result.failed}</Notice>}
            <Button variant="danger" data-testid="block" disabled={once.busy} onClick={() => decide("block")}>Stop this payment</Button>
            <Button variant="secondary" data-testid="approve" disabled={once.busy} onClick={() => decide("approve")}>Approve this payment</Button>
          </>
        )
      }
    >
      {shown ? (
        <div className="mt-8 flex flex-col items-center text-center" data-testid="decision-result">
          {(() => {
            const { cls, Icon } = TILE[shown.tone];
            return (
              <span aria-hidden="true" className={`flex h-[88px] w-[88px] items-center justify-center rounded-full ${cls}`}>
                <Icon size={44} weight="bold" />
              </span>
            );
          })()}
          <h1 className="mt-5 text-[30px] font-extrabold leading-[1.17] tracking-[-0.01em]">{shown.title}</h1>
          <p role="status" className="mt-2.5 text-[18px] leading-relaxed text-ink-2">{shown.lead}</p>
        </div>
      ) : (
        <>
          <Title>{senderName} wants to send {formatUsd(p.amountCents)} to someone new</Title>
          <Card className="mt-[18px] flex flex-col gap-3.5">
            <div className="flex justify-between gap-3">
              <span className="min-w-0 text-[17px] font-bold [overflow-wrap:anywhere]">{p.payee}</span>
              <span className="flex-none text-[26px] font-extrabold tabular-nums">{formatUsd(p.amountCents)}</span>
            </div>
            {p.senderAnswer && (
              <div className="flex flex-col gap-1.5 border-t border-line pt-3.5">
                <span className="text-[16px] text-ink-3">{senderName} told us</span>
                <span className="text-[17px] leading-snug [overflow-wrap:anywhere]">&ldquo;{p.senderAnswer}&rdquo;</span>
              </div>
            )}
          </Card>
          <h2 className="mt-6 text-[19px] font-bold">Why it was held</h2>
          <ul className="mt-2.5 flex flex-col gap-2.5 text-[17px] leading-snug">
            {p.reasons.map((r) => <li key={r}>{r}</li>)}
          </ul>
          {notice && <div className="mt-[18px]"><Notice tone="pending">{notice}</Notice></div>}
        </>
      )}
    </Screen>
  );
}
