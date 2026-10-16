"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatUsd } from "@/alerts/alertCopy";
import { ButtonLink } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chip } from "@/ui/Chip";
import { fetchJson } from "@/ui/fetchJson";
import { holdProgress, timeLeftText } from "@/ui/holdProgress";
import { Notice } from "@/ui/Notice";
import { SignedOut } from "@/ui/SignedOut";
import { Skeleton } from "@/ui/Skeleton";
import { SettingsLink } from "../SettingsLink";
import { SignOutButton } from "../SignOutButton";

type Held = { id: string; payee: string; amountCents: number; reasons: string[]; authorisedAt: string | null; coolingOffUntil: string | null };
type Alert = { id: string; kind: string; title: string; body: string; path: string; createdAt: string; readAt: string | null };
type Me = { lookingAfter: { displayName: string }[] };
type Item = { held: Held; senderName: string };
type State =
  | { kind: "loading" }
  | { kind: "signedOut" }
  | { kind: "error"; message: string }
  | { kind: "ready"; me: Me; items: Item[]; alerts: Alert[] };

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
const joinNames = (names: string[]) => names.join(" and ");

export default function CirclePage() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [me, held, alerts] = await Promise.all([
        fetchJson<Me>("/api/me"),
        fetchJson<Held[]>("/api/circle/held"),
        fetchJson<Alert[]>("/api/alerts"),
      ]);
      if (cancelled) return;
      if ([me, held, alerts].some((r) => !r.ok && r.signedOut)) return setState({ kind: "signedOut" });
      if (!me.ok || !held.ok || !alerts.ok) return setState({ kind: "error", message: "We couldn't load your circle. Please refresh." });
      // Each card names the person who sent it, taken from the payment itself.
      const items = await Promise.all(
        held.data.map(async (h): Promise<Item> => {
          const r = await fetchJson<{ senderName: string }>(`/api/circle/payments/${h.id}`);
          return { held: h, senderName: r.ok ? r.data.senderName : "Someone in your circle" };
        }),
      );
      if (cancelled) return;
      setState({ kind: "ready", me: me.data, items, alerts: alerts.data });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const markRead = (id: string) => {
    void fetch(`/api/alerts/${id}/read`, { method: "POST" }).catch(() => undefined);
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-6 pb-7 pt-6">
      <div className="flex items-center justify-between">
        <span className="text-[17px] font-bold text-evergreen">Trust Circle</span>
        <div className="flex items-center">
          <SettingsLink />
          <SignOutButton />
        </div>
      </div>
      {state.kind === "loading" && (
        <>
          <p role="status" className="sr-only">Loading your circle…</p>
          <Skeleton blocks={[40, 28, 200, 120]} />
        </>
      )}
      {state.kind === "signedOut" && <SignedOut />}
      {state.kind === "error" && (
        <div className="mt-6">
          <Notice tone="error">{state.message}</Notice>
        </div>
      )}
      {state.kind === "ready" && <Ready state={state} markRead={markRead} />}
    </main>
  );
}

function Ready({ state, markRead }: { state: Extract<State, { kind: "ready" }>; markRead: (id: string) => void }) {
  const names = state.me.lookingAfter.map((l) => l.displayName);
  const verifyRequests = state.alerts.filter((a) => a.kind === "verify_request" && !a.readAt);
  const earlier = state.alerts.filter((a) => !verifyRequests.includes(a)).slice(0, 10);
  const now = new Date();
  const nothing = state.items.length === 0 && verifyRequests.length === 0;
  return (
    <>
      <h1 className="mt-5 text-[32px] font-extrabold leading-[1.15] tracking-[-0.01em]">Your circle</h1>
      <p className="mt-2 text-[18px] text-ink-2">
        {names.length > 0 ? `You look out for ${joinNames(names)}.` : "Nobody has added you to their circle yet."}
      </p>

      <h2 className="mt-7 text-[19px] font-bold">Needs you</h2>
      <div className="mt-2.5 flex flex-col gap-3">
        {nothing && <Notice tone="info">Nothing needs you right now.</Notice>}
        {state.items.map(({ held, senderName }) => {
          const left = timeLeftText(holdProgress({ authorisedAt: held.authorisedAt, coolingOffUntil: held.coolingOffUntil, now }).msLeft);
          return (
            <Card key={held.id} className="flex flex-col gap-3.5">
              <Chip tone="held">On hold, {left}</Chip>
              <span className="text-[21px] font-extrabold leading-snug">
                {senderName}&apos;s payment of {formatUsd(held.amountCents)} is on hold
              </span>
              {held.reasons[0] && <span className="text-[17px] leading-snug text-ink-2">{held.reasons[0]}</span>}
              <ButtonLink href={`/circle/payments/${held.id}`} data-testid="review">
                Review the payment
              </ButtonLink>
            </Card>
          );
        })}
        {verifyRequests.map((a) => (
          <Card key={a.id} className="flex flex-col gap-3.5">
            <Chip tone="held">Waiting for you</Chip>
            <span className="text-[21px] font-extrabold leading-snug">{a.title}</span>
            <ButtonLink href={a.path} data-testid="answer-verification">
              Answer
            </ButtonLink>
          </Card>
        ))}
      </div>

      {earlier.length > 0 && (
        <>
          <h2 className="mt-7 text-[19px] font-bold">Earlier</h2>
          <ul className="mt-1.5 flex flex-col">
            {earlier.map((a) => (
              <li key={a.id} className="border-b border-line">
                <Link href={a.path} onClick={() => markRead(a.id)} className="flex min-h-[64px] flex-col justify-center gap-0.5 py-3 text-ink no-underline">
                  <span className="text-[17px] font-bold">{a.title}</span>
                  <span className="text-[16px] text-ink-3">{a.body}</span>
                  <span className="text-[16px] text-ink-3">{day(a.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-auto flex flex-col gap-2.5 pt-8">
        <ButtonLink href="/circle/dashboard" variant="secondary">
          See all payments
        </ButtonLink>
        <ButtonLink href="/trends" variant="quiet" className="w-auto! self-center">
          Scam trends
        </ButtonLink>
      </div>
    </>
  );
}
