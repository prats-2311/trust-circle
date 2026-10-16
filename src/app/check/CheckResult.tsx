"use client";
import { useState } from "react";
import { Button, ButtonLink } from "@/ui/Button";
import { Chip } from "@/ui/Chip";
import { fetchJson } from "@/ui/fetchJson";
import { Notice } from "@/ui/Notice";
import { FinePrint, Lead, Screen, Title } from "@/ui/Screen";
import { useOnce } from "@/ui/useOnce";
import { resultCopy, type CheckView } from "./resultCopy";

export type CheckResponse = CheckView & {
  id: string;
  text: string;
  identifiers: { type: "email" | "phone" | "url"; value: string }[];
  createdAt: string;
};
type ReportResult = { mailtoUrl: string; alreadyReported: boolean };

const IDENTIFIER_LABEL = { phone: "Phone number", email: "Email address", url: "Link" } as const;

export function PreviewTile({ preview }: { preview: string | null }) {
  return preview ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={preview} alt="Your screenshot" className="h-[92px] w-[92px] flex-none rounded-[14px] border border-line bg-surface object-cover" />
  ) : (
    <div aria-hidden="true" className="relative h-[92px] w-[92px] flex-none overflow-hidden rounded-[14px] border border-line bg-surface">
      <div className="absolute left-3 right-3 top-[18px] h-2 rounded bg-line" />
      <div className="absolute left-3 right-[26px] top-[34px] h-2 rounded bg-line" />
      <div className="absolute left-3 right-[18px] top-[50px] h-2 rounded bg-line" />
    </div>
  );
}

const excerpt = (t: string) => (t.length > 90 ? `${t.slice(0, 90).trimEnd()}…` : t);

export function CheckResult({
  check, preview, justNow, canRetry, onRetry, onNewCheck,
}: {
  check: CheckResponse;
  preview: string | null;
  justNow: boolean;
  canRetry: boolean;
  onRetry: () => void;
  onNewCheck: () => void;
}) {
  const copy = resultCopy(check);
  const { busy, run } = useOnce();
  const [note, setNote] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const showDetails = copy.kind === "scam" || copy.kind === "warning";
  const when = justNow ? "Checked just now" : `Checked ${new Date(check.createdAt).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}`;

  const report = () =>
    run(async () => {
      const r = await fetchJson<ReportResult>(`/api/messages/${check.id}/report`, { method: "POST" });
      if (!r.ok) return setNote({ tone: "error", text: r.error });
      setNote({
        tone: "info",
        text: r.data.alreadyReported
          ? "You've already reported this message."
          : "Thanks. These contact details are now on the shared scam list. Your email app will open with a report for PayPal.",
      });
      window.location.href = r.data.mailtoUrl;
    });

  return (
    <Screen
      title="Check a message"
      backHref="/home"
      footer={
        <>
          {copy.canReport && (
            <>
              {note && <Notice tone={note.tone}>{note.text}</Notice>}
              <Button data-testid="report" disabled={busy} onClick={report}>
                Report this to PayPal
              </Button>
              <FinePrint>The report opens in your own email so you can read it before you send it.</FinePrint>
            </>
          )}
          {copy.kind === "not_checked" &&
            <Button onClick={canRetry ? onRetry : onNewCheck}>Try again</Button>}
          <ButtonLink href="/home" variant="secondary">
            Back to home
          </ButtonLink>
        </>
      }
    >
      <div data-testid={`check-result-${copy.kind}`} className="flex flex-1 flex-col">
        {copy.kind === "not_checked" ? (
          <div className="mt-5">
            <Chip tone={copy.chipTone}>{copy.chip}</Chip>
          </div>
        ) : (
          <div className="mt-3.5 flex items-center gap-4">
            {(preview || check.text) && <PreviewTile preview={preview} />}
            <div className="flex flex-col gap-2">
              <Chip tone={copy.chipTone}>{copy.chip}</Chip>
              <span className="text-[16px] text-ink-3">{when}</span>
            </div>
          </div>
        )}
        <Title>{copy.title}</Title>
        <Lead>{copy.lead}</Lead>

        {copy.kind === "not_checked" && check.text && (
          <div className="mt-6 flex flex-col gap-1.5 rounded-panel bg-surface px-5 py-4">
            <span className="text-[16px] text-ink-3">The message you pasted</span>
            <span className="text-[17px] leading-snug">&ldquo;{excerpt(check.text)}&rdquo;</span>
          </div>
        )}

        {showDetails && check.reasons.length > 0 && (
          <>
            <h2 className="mt-6 text-[19px] font-bold">What gave it away</h2>
            <ul className="mt-2.5 flex flex-col gap-3 text-[17px] leading-snug">
              {check.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </>
        )}
        {showDetails && check.identifiers.length > 0 && (
          <>
            <h2 className="mt-6 text-[19px] font-bold">Contact details in the message</h2>
            <ul className="mt-2.5 flex flex-col gap-3 text-[17px] leading-snug">
              {check.identifiers.map((i) => (
                <li key={`${i.type}:${i.value}`} className="flex flex-col">
                  <span className="text-[16px] text-ink-3">{IDENTIFIER_LABEL[i.type]}</span>
                  <span className="break-all font-bold">{i.value}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Screen>
  );
}
