"use client";
import { useState } from "react";
import { formatUsd } from "@/alerts/alertCopy";
import { SCAM_PAYEE_TITLE, draftDispute } from "@/aftercare/disputeDraft";
import type { AftercareFinding, AftercareReport } from "@/aftercare/aftercareAgent";
import type { DashboardRow } from "@/dashboard/dashboardService";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chip, type ChipTone } from "@/ui/Chip";
import { Notice } from "@/ui/Notice";
import { useOnce } from "@/ui/useOnce";

const SEVERITY: Record<AftercareFinding["severity"], { tone: ChipTone; label: string }> = {
  act: { tone: "blocked", label: "Needs action" },
  check: { tone: "caution", label: "Worth a check" },
  info: { tone: "neutral", label: "For information" },
};

function toolLine(t: AftercareReport["toolCalls"][number]): string {
  return `${t.name}: ${t.refused ? "refused" : t.ok ? "done" : "not available"}`;
}

function Finding({ f, row, senderName }: { f: AftercareFinding; row: DashboardRow | undefined; senderName: string }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const canDraft = f.severity === "act" && f.title === SCAM_PAYEE_TITLE && row !== undefined;
  const draft = row ? draftDispute({ senderName, payee: row.payee, amountCents: row.amountCents, date: new Date(row.createdAt) }) : "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setCopyFailed(false);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  };
  const { tone, label } = SEVERITY[f.severity];
  return (
    <li data-testid="aftercare-finding" className="flex flex-col gap-2 rounded-control bg-ground p-4">
      <Chip tone={tone}>{label}</Chip>
      <p className="m-0 text-[19px] font-bold">{f.title}</p>
      <p className="m-0 text-[17px] text-ink-2">{f.detail}</p>
      {row && <p className="m-0 text-[16px] text-ink-3">{formatUsd(row.amountCents)} to {row.payee}</p>}
      {canDraft && (
        <Button variant="secondary" onClick={copy}>
          {copied ? "Copied" : "Copy dispute draft"}
        </Button>
      )}
      {copyFailed && (
        <>
          <Notice tone="error">We couldn&apos;t copy it. Select the text below instead.</Notice>
          <textarea readOnly rows={9} value={draft} aria-label="Dispute draft" className="w-full rounded-control border-2 border-line-strong bg-surface p-3 text-[17px]" />
        </>
      )}
    </li>
  );
}

export function AftercareCard({ senderId, senderName, rows }: { senderId: string; senderName: string; rows: DashboardRow[] }) {
  const { busy, run } = useOnce();
  const [report, setReport] = useState<AftercareReport | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);

  const start = () =>
    run(async () => {
      setMessage(null);
      try {
        const res = await fetch("/api/circle/aftercare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ senderId }),
        });
        if (res.status === 429) {
          setMessage({ tone: "info", text: "Please wait a minute before running another review." });
          return;
        }
        if (!res.ok) throw new Error("review failed");
        setReport((await res.json()) as AftercareReport);
      } catch {
        setMessage({ tone: "error", text: "The review couldn't run just now. Please try again." });
      }
    });

  return (
    <Card className="mb-6 flex flex-col gap-4">
      <h2 className="m-0 text-[24px] font-extrabold">Aftercare</h2>
      <p className="m-0 text-[17px] text-ink-2">
        Ask the agent to look over {senderName}&apos;s recent payments for anything the earlier checks missed. It can only read; it never moves money.
      </p>
      <Button data-testid="aftercare-run" onClick={start} disabled={busy}>
        Review recent payments
      </Button>
      {busy && <p role="status" className="m-0 text-[17px] text-ink-2">Reviewing… this can take up to 20 seconds.</p>}
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {report && (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-[17px]">{report.summary}</p>
          {report.findings.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {report.findings.map((f, i) => (
                <Finding key={i} f={f} row={rows.find((r) => r.id === f.paymentId)} senderName={senderName} />
              ))}
            </ul>
          )}
          <details data-testid="aftercare-tools" className="text-[17px]">
            <summary className="min-h-11 cursor-pointer py-2 font-bold">What the agent checked</summary>
            <ul className="m-0 list-disc pl-6 text-ink-2">
              {report.toolCalls.map((t, i) => (
                <li key={i}>{toolLine(t)}</li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </Card>
  );
}
