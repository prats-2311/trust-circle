"use client";
import { useState, type ReactNode } from "react";
import { formatUsd } from "@/alerts/alertCopy";
import { approvalErrorCopy } from "@/app/send/riskScreen";
import { Button, ButtonLink } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chip } from "@/ui/Chip";
import { Field, INPUT } from "@/ui/Field";
import { fetchJson, jsonBody } from "@/ui/fetchJson";
import { HoldRing } from "@/ui/HoldRing";
import { holdProgress } from "@/ui/holdProgress";
import { ChatCircleTextIcon, CheckCircleIcon, CheckIcon, InfoIcon, LockSimpleIcon, ShieldCheckIcon, WarningIcon } from "@/ui/icons";
import { Notice } from "@/ui/Notice";
import { FinePrint, Lead, Screen, Title } from "@/ui/Screen";
import { useOnce } from "@/ui/useOnce";
import { screenCopy, type ScreenKind, type Stage } from "./screen";

export type PaymentView = {
  id: string;
  payee: string;
  amountCents: number;
  state: string;
  authorisedAt: string | null;
  coolingOffUntil: string | null;
};

type NoticeState = { tone: "info" | "pending" | "error"; text: string };

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const weekdayTime = (d: Date) => d.toLocaleString("en-US", { weekday: "long", hour: "numeric", minute: "2-digit" });
const timeOnly = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const HOUR = 3_600_000;
const ALREADY_DEALT_WITH = "This payment has already been dealt with.";
const CHALLENGE_FAILED_TO_SAVE = "We couldn't record that just now. Please try again.";

/** Runs one decisive POST at a time and turns every outcome into calm copy, then reloads the payment. */
function useAction(reload: () => Promise<void>) {
  const { busy, run } = useOnce();
  const [notice, setNotice] = useState<NoticeState | null>(null);

  function post(url: string, body: unknown | undefined, failureCopy: (status: number, error: string) => string) {
    return run(async () => {
      setNotice(null);
      const res = await fetchJson<{ error?: string }>(url, body === undefined ? { method: "POST" } : jsonBody(body));
      if (res.ok && res.status === 202) {
        // Accepted but still finishing: never claim it worked or that nothing moved.
        setNotice({ tone: "pending", text: res.data?.error ?? "We're finishing this. Please don't try again." });
      } else if (!res.ok && res.status === 409) {
        setNotice({ tone: "info", text: ALREADY_DEALT_WITH });
      } else if (!res.ok) {
        setNotice({ tone: "error", text: failureCopy(res.status, res.error) });
      }
      await reload();
    });
  }
  return { busy, notice, post };
}

const approval = (status: number, error: string) => approvalErrorCopy(status, error).message;
const challenge = (status: number, error: string) => (status === 0 || status >= 500 ? CHALLENGE_FAILED_TO_SAVE : error);

function NoticeLine({ notice }: { notice: NoticeState | null }) {
  return notice ? <div className="mt-5"><Notice tone={notice.tone}>{notice.text}</Notice></div> : null;
}

function CancelButton({ action }: { action: ReturnType<typeof useAction> & { id: string } }) {
  return (
    <Button variant="secondary" data-testid="cancel" disabled={action.busy} onClick={() => action.post(`/api/payments/${action.id}/cancel`, undefined, approval)}>
      Cancel this payment
    </Button>
  );
}

export function PaymentScreens({ kind, p, stage, contactName, reload }: { kind: ScreenKind; p: PaymentView; stage: Stage | null; contactName: string | null; reload: () => Promise<void> }) {
  const action = { ...useAction(reload), id: p.id };
  const copy = screenCopy(kind, { amount: formatUsd(p.amountCents), payee: p.payee, contactName });
  const chip = <Chip tone={copy.chipTone}>{copy.chip}</Chip>;
  const screenProps = { backHref: "/home" };
  const holdChip = <Chip tone="held">{formatUsd(p.amountCents)} on hold</Chip>;
  const root = (children: ReactNode) => (
    <div data-testid={`payment-screen-${kind}`} className="flex flex-1 flex-col">
      {children}
    </div>
  );

  switch (kind) {
    case "held": {
      const prog = holdProgress({ authorisedAt: p.authorisedAt, coolingOffUntil: p.coolingOffUntil, now: new Date() });
      const authorised = p.authorisedAt ? new Date(p.authorisedAt) : null;
      const spanHours = p.authorisedAt && p.coolingOffUntil ? Math.round((new Date(p.coolingOffUntil).getTime() - new Date(p.authorisedAt).getTime()) / HOUR) : 24;
      const usedHours = Math.min(spanHours, Math.floor(prog.fractionUsed * spanHours));
      const who = contactName ?? "Your circle";
      return (
        <Screen {...screenProps} title={`Payment to ${p.payee}`} footer={
          <>
            {prog.msLeft === 0 && p.coolingOffUntil && (
              <Button data-testid="release" disabled={action.busy} onClick={() => action.post(`/api/payments/${p.id}/release`, undefined, approval)}>
                Release the payment
              </Button>
            )}
            <CancelButton action={action} />
            <FinePrint>
              {prog.msLeft > 0 && prog.releaseAt
                ? `You can cancel any time. Releasing it yourself opens ${weekdayTime(prog.releaseAt)}.`
                : "You can cancel any time."}
            </FinePrint>
          </>
        }>
          {root(
            <>
              <div className="mt-4"><HoldRing fractionUsed={prog.fractionUsed} amountCents={p.amountCents} label={`Hold time used: ${usedHours} of ${spanHours} hours`} /></div>
              <h1 className="mt-5 text-center text-[28px] font-extrabold leading-tight tracking-[-0.01em]">{copy.title}</h1>
              <p className="mx-auto mt-2.5 max-w-[320px] text-center text-[18px] leading-relaxed text-ink-2">{copy.lead}</p>
              <ol className="mt-7 flex list-none flex-col p-0">
                <TimelineItem filled title="Held in PayPal" sub={authorised ? weekdayTime(authorised) : undefined} />
                <TimelineItem filled title={`${who} has been asked`} sub="They can approve or stop it" />
                <TimelineItem
                  title={authorised ? `If no one decides by ${weekdayTime(new Date(authorised.getTime() + 72 * HOUR))}` : "If no one decides in time"}
                  sub="The hold ends and the money stays yours"
                  last
                />
              </ol>
              <NoticeLine notice={action.notice} />
            </>,
          )}
        </Screen>
      );
    }

    case "waiting": {
      const name = stage?.stage === "waiting_for_person" ? stage.contactName : (contactName ?? "the real person");
      return (
        <Screen {...screenProps} chip={chip} footer={<CancelButton action={action} />}>
          {root(
            <>
              <Title>{copy.title}</Title>
              <Lead>{copy.lead}</Lead>
              <Card className="mt-6 flex flex-col items-center gap-4">
                <div className="flex w-full items-center gap-3" aria-hidden="true">
                  <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-evergreen-tint text-[16px] font-extrabold text-evergreen">You</span>
                  <span className="relative h-0 flex-1 border-t-2 border-dashed border-line-strong">
                    <span className="tc-travel absolute -top-[13px] left-0 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-surface text-held">
                      <ChatCircleTextIcon size={22} weight="fill" />
                    </span>
                  </span>
                  <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-held-tint text-[16px] font-extrabold text-held-ink">{initials(name)}</span>
                </div>
                <span className="text-[20px] font-bold">{name}</span>
                {stage?.stage === "waiting_for_person" && (
                  <div role="status" className="rounded-control bg-held-tint px-4 py-3 text-center text-[17px] text-held-ink">
                    Asked at {timeOnly(stage.askedAt)}. Waiting for {name} to reply.
                  </div>
                )}
              </Card>
              <h2 className="mt-7 text-[19px] font-bold">While you wait</h2>
              {stage?.stage === "waiting_for_person" && (
                <p className="mt-2 text-[18px] leading-relaxed text-ink-2">If they don&apos;t answer by {timeOnly(stage.challengeOpensAt)}, we&apos;ll help you check another way.</p>
              )}
              <NoticeLine notice={action.notice} />
            </>,
          )}
        </Screen>
      );
    }

    case "challenge_memory": {
      const guidance = stage?.stage === "challenge" ? stage.guidance : [];
      const send = (outcome: "excuse" | "answered") => action.post(`/api/payments/${p.id}/challenge`, { method: "memory_question", outcome }, challenge);
      return (
        <Screen {...screenProps} chip={holdChip} footer={
          <>
            <Button variant="danger" data-testid="excuse" disabled={action.busy} onClick={() => send("excuse")}>They made an excuse</Button>
            <Button variant="secondary" data-testid="answered" disabled={action.busy} onClick={() => send("answered")}>They answered straight away</Button>
            <FinePrint>An excuse stops the payment. A good answer doesn&apos;t send it: {contactName ?? "your circle"} still decides.</FinePrint>
          </>
        }>
          {root(
            <>
              <Title>{copy.title}</Title>
              <Lead>{copy.lead}</Lead>
              <NumberedSteps steps={guidance} />
              <h2 className="mt-7 text-[19px] font-bold">What happened?</h2>
              <NoticeLine notice={action.notice} />
            </>,
          )}
        </Screen>
      );
    }

    case "challenge_safe_word":
      return <SafeWordScreen p={p} copy={copy} action={action} root={root} screenProps={screenProps} />;

    case "official_routes": {
      const org = stage?.stage === "official_routes" ? stage.organisation : "them";
      const steps = stage?.stage === "official_routes" ? stage.steps : [];
      const caution = steps.length > 1 ? steps[steps.length - 1] : null;
      return (
        <Screen {...screenProps} chip={holdChip} footer={
          <>
            <CancelButton action={action} />
            <FinePrint>Until then, the payment stays on hold. Nothing is sent.</FinePrint>
          </>
        }>
          {root(
            <>
              <Title>{org === "them" ? copy.title : `Check with ${org} yourself`}</Title>
              <Lead>{copy.lead}</Lead>
              <NumberedSteps steps={caution ? steps.slice(0, -1) : steps} />
              {caution && (
                <div className="mt-5 flex items-start gap-3 rounded-control bg-caution-tint px-4 py-3.5 text-[17px] leading-snug text-caution-ink">
                  <WarningIcon aria-hidden="true" size={22} weight="bold" className="mt-0.5 flex-none" />
                  <span>{caution}</span>
                </div>
              )}
              <NoticeLine notice={action.notice} />
            </>,
          )}
        </Screen>
      );
    }

    case "pending":
      return (
        <Screen {...screenProps} title="Payment" chip={chip} footer={<ButtonLink href="/home" variant="secondary">Back to home</ButtonLink>}>
          {root(
            <>
              <Title>{copy.title}</Title>
              <div className="mt-5"><Notice tone="pending">{copy.lead}</Notice></div>
            </>,
          )}
        </Screen>
      );

    case "not_approved":
      return (
        <Screen {...screenProps} title="Payment" chip={chip} footer={
          <>
            <ButtonLink href="/home" variant="secondary">Back to home</ButtonLink>
            <ButtonLink href="/send" variant="quiet" className="w-auto! self-center">Start again</ButtonLink>
          </>
        }>
          {root(
            <>
              <Title>{copy.title}</Title>
              <Lead>{copy.lead}</Lead>
            </>,
          )}
        </Screen>
      );

    default: {
      // sent, refunded, stopped_*, cancelled, hold_ended
      const safe = kind.startsWith("stopped_");
      const person = kind === "stopped_by_person";
      const next = [
        ...(person ? [`${contactName ?? "Your circle"} has been told.`, "This account is on the shared scam list now, so other families are warned."] : []),
        ...(kind === "stopped_by_check" ? ["The payment won't be sent."] : []),
      ];
      const Icon = safe ? ShieldCheckIcon : kind === "sent" ? CheckCircleIcon : InfoIcon;
      const tone = safe || kind === "sent" ? "bg-evergreen-tint text-evergreen" : "bg-neutral-tint text-ink-2";
      return (
        <Screen {...screenProps} chip={chip} footer={
          <>
            <ButtonLink href="/home" variant="secondary">Back to home</ButtonLink>
            {safe && <FinePrint>Checking first was the right thing to do.</FinePrint>}
          </>
        }>
          {root(
            <>
              <div aria-hidden="true" className={`tc-settle mx-auto mt-6 flex h-[88px] w-[88px] items-center justify-center rounded-full ${tone}`}>
                <Icon size={44} weight="bold" />
              </div>
              <h1 className="mt-6 text-center text-[30px] font-extrabold leading-[1.17] tracking-[-0.01em]">{copy.title}</h1>
              <p className="mt-2.5 text-center text-[18px] leading-relaxed text-ink-2">{copy.lead}</p>
              {next.length > 0 && (
                <Card className="mt-7">
                  <h2 className="text-[19px] font-bold">What happens next</h2>
                  <ul className="mt-3 flex list-none flex-col gap-3 p-0">
                    {next.map((t) => (
                      <li key={t} className="flex items-start gap-3 text-[17px] leading-snug">
                        <CheckIcon aria-hidden="true" size={20} weight="bold" className="mt-0.5 flex-none text-evergreen" />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </>,
          )}
        </Screen>
      );
    }
  }
}

function SafeWordScreen({ p, copy, action, root, screenProps }: {
  p: PaymentView;
  copy: ReturnType<typeof screenCopy>;
  action: ReturnType<typeof useAction> & { id: string };
  root: (c: ReactNode) => ReactNode;
  screenProps: { backHref: string };
}) {
  const [said, setSaid] = useState("");
  const send = (value: string) => action.post(`/api/payments/${p.id}/challenge`, { method: "safe_word", said: value }, challenge);
  return (
    <Screen {...screenProps} chip={<Chip tone="held">{formatUsd(p.amountCents)} on hold</Chip>} footer={
      <>
        <Button data-testid="check-safe-word" disabled={action.busy || said.trim() === ""} onClick={() => send(said)}>Check the safe word</Button>
        {/* "(no answer)" never matches a stored safe word, so this records a failed check and stops the payment. */}
        <Button variant="quiet" data-testid="no-answer" disabled={action.busy} onClick={() => send("(no answer)")} className="text-blocked-ink">They couldn&apos;t tell me</Button>
        <FinePrint>If it doesn&apos;t match, we stop the payment. The money stays in your account.</FinePrint>
      </>
    }>
      {root(
        <>
          <div aria-hidden="true" className="mt-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-held-tint text-held">
            <LockSimpleIcon size={32} />
          </div>
          <Title>{copy.title}</Title>
          <Lead>{copy.lead}</Lead>
          <div className="mt-6">
            <Field id="said" label="What the caller said">
              <input id="said" className={INPUT} autoComplete="off" value={said} onChange={(e) => setSaid(e.target.value)} />
            </Field>
          </div>
          <NoticeLine notice={action.notice} />
        </>,
      )}
    </Screen>
  );
}

function NumberedSteps({ steps }: { steps: string[] }) {
  return (
    <ol className="mt-6 flex list-none flex-col gap-4 p-0">
      {steps.map((s, i) => (
        <li key={s} className="flex items-start gap-3.5">
          <span aria-hidden="true" className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-held-tint text-[16px] font-extrabold text-held-ink">{i + 1}</span>
          <span className="pt-0.5 text-[18px] leading-snug">{s}</span>
        </li>
      ))}
    </ol>
  );
}

function TimelineItem({ title, sub, filled, last }: { title: string; sub?: string; filled?: boolean; last?: boolean }) {
  return (
    <li className={`grid grid-cols-[28px_minmax(0,1fr)] gap-x-3 ${last ? "" : "pb-4"}`}>
      <span aria-hidden="true" className={`ml-[7px] mt-[5px] h-[14px] w-[14px] rounded-full ${filled ? "bg-held" : "box-border border-2 border-[#9aa6a0]"}`} />
      <div>
        <div className="text-[17px] font-bold">{title}</div>
        {sub && <div className="text-[16px] text-ink-3">{sub}</div>}
      </div>
    </li>
  );
}
