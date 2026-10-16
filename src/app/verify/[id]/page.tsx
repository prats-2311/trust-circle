"use client";
import { formatWhen } from "@/ui/format";
import { use, useEffect, useState } from "react";
import { formatUsd } from "@/alerts/alertCopy";
import { Button, ButtonLink } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chip } from "@/ui/Chip";
import { fetchJson, jsonBody } from "@/ui/fetchJson";
import { CheckCircleIcon, InfoIcon } from "@/ui/icons";
import { Notice } from "@/ui/Notice";
import { FinePrint, Lead, Screen } from "@/ui/Screen";
import { SignedOut } from "@/ui/SignedOut";
import { Skeleton } from "@/ui/Skeleton";
import { useOnce } from "@/ui/useOnce";
import { answerCopy } from "../answerCopy";

type Verification = {
  id: string;
  status: string;
  senderName: string;
  amountCents: number;
  payee: string;
  askedAt: string;
  paymentOnHold: boolean;
};
type State =
  | { kind: "loading" }
  | { kind: "signedOut" }
  | { kind: "notForYou" }
  | { kind: "error"; message: string }
  | { kind: "ready"; v: Verification; viewerName: string };
type Done = { answer: "me" | "not_me"; status: number };

const SAVE_UNSURE = "We couldn't confirm your answer just now. It may not have been saved. Please try again.";

function askedText(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const when = formatWhen(d);
  return `Asked ${/^(Today|Yesterday)/.test(when) ? when.charAt(0).toLowerCase() + when.slice(1) : when}`;
}

function Outcome({ title, lead, tone }: { title: string; lead: string; tone: "safe" | "info" }) {
  const Icon = tone === "safe" ? CheckCircleIcon : InfoIcon;
  const cls = tone === "safe" ? "bg-evergreen-tint text-evergreen" : "bg-neutral-tint text-ink-2";
  return (
    <div className="mt-8 flex flex-col items-center text-center" data-testid="answer-result">
      <span aria-hidden="true" className={`flex h-[88px] w-[88px] items-center justify-center rounded-full ${cls}`}>
        <Icon size={44} weight="bold" />
      </span>
      <h1 className="mt-5 text-[30px] font-extrabold leading-[1.17] tracking-[-0.01em]">{title}</h1>
      <p role="status" className="mt-2.5 text-[18px] leading-relaxed text-ink-2">{lead}</p>
    </div>
  );
}

export default function AnswerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [state, setState] = useState<State>({ kind: "loading" });
  const [done, setDone] = useState<Done | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const once = useOnce();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [ver, me] = await Promise.all([
        fetchJson<Verification>(`/api/verifications/${id}`),
        fetchJson<{ displayName: string }>("/api/me"),
      ]);
      if (cancelled) return;
      if (!ver.ok && ver.signedOut) return setState({ kind: "signedOut" });
      if (!me.ok && me.signedOut) return setState({ kind: "signedOut" });
      if (!ver.ok) {
        return setState(ver.status === 403 || ver.status === 404 ? { kind: "notForYou" } : { kind: "error", message: "We couldn't load this request. Please refresh." });
      }
      if (!me.ok) return setState({ kind: "error", message: "We couldn't load this request. Please refresh." });
      setState({ kind: "ready", v: ver.data, viewerName: me.data.displayName });
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const respond = (answer: "me" | "not_me") =>
    once.run(async () => {
      setFailed(null);
      const r = await fetchJson<unknown>(`/api/verifications/${id}/respond`, jsonBody({ answer }));
      if (!r.ok && r.signedOut) return setState({ kind: "signedOut" });
      if (r.ok || r.status === 409) return setDone({ answer, status: r.status });
      // A network failure or 5xx may have saved the answer, so server text is never shown.
      setFailed(r.status === 0 || r.status >= 500 ? SAVE_UNSURE : r.error);
    });

  const circle = <ButtonLink href="/circle" variant="secondary">Go to your circle</ButtonLink>;

  if (state.kind === "loading") {
    return (
      <Screen>
        <p role="status" className="sr-only">Loading the request…</p>
        <Skeleton blocks={[84, 120, 160, 60]} />
      </Screen>
    );
  }
  if (state.kind === "signedOut") return <Screen><SignedOut /></Screen>;
  if (state.kind === "notForYou") {
    return (
      <Screen footer={circle}>
        <h1 className="mt-8 text-[30px] font-extrabold leading-[1.17] tracking-[-0.01em]" data-testid="not-for-you">This request isn&apos;t for you</h1>
      </Screen>
    );
  }
  if (state.kind === "error") {
    return (
      <Screen footer={circle}>
        <div className="mt-6"><Notice tone="error">{state.message}</Notice></div>
      </Screen>
    );
  }

  const { v, viewerName } = state;
  const amount = formatUsd(v.amountCents);
  const answered = done ? answerCopy({ ...done, viewerName, senderName: v.senderName, payee: v.payee, amount }) : null;
  const pending = v.status === "pending";
  const handled = pending && !v.paymentOnHold;
  const closed = !pending
    ? { title: "This has already been answered", lead: "Nothing more is needed from you." }
    : handled
      ? { title: "This payment has already been dealt with", lead: "Nothing more is needed from you." }
      : null;

  if (answered || closed) {
    const shown = answered ?? closed!;
    return (
      <Screen footer={circle}>
        <Outcome title={shown.title} lead={shown.lead} tone={answered && done?.status !== 409 ? "safe" : "info"} />
      </Screen>
    );
  }

  return (
    <Screen
      title="Trust Circle"
      chip={<Chip tone="held">Waiting for you</Chip>}
      footer={
        <>
          {failed && <Notice tone="error">{failed}</Notice>}
          <Button variant="danger" data-testid="not-me" className="min-h-[64px] text-[21px] font-extrabold" disabled={once.busy} onClick={() => respond("not_me")}>It wasn&apos;t me</Button>
          <Button variant="secondary" data-testid="it-was-me" disabled={once.busy} onClick={() => respond("me")}>Yes, it was me</Button>
          <FinePrint>If it wasn&apos;t you, we stop the payment and warn other families about this account.</FinePrint>
        </>
      }
    >
      <h1 className="mt-[30px] text-[34px] font-extrabold leading-[1.12] tracking-[-0.015em]">Did you just ask {v.senderName} for {amount}?</h1>
      <Lead>Someone asked them to send it and said they were you. The money is on hold until you answer.</Lead>
      <Card className="mt-6 flex flex-col gap-3.5">
        <div className="flex justify-between gap-3">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[16px] text-ink-3">Would go to</span>
            <span className="text-[17px] font-bold [overflow-wrap:anywhere]">{v.payee}</span>
          </span>
          <span className="flex-none text-[26px] font-extrabold tabular-nums">{amount}</span>
        </div>
        <div className="border-t border-line pt-3 text-[16px] text-ink-3">{askedText(v.askedAt)}</div>
      </Card>
    </Screen>
  );
}
