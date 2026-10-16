"use client";
import { formatDay } from "@/ui/format";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ButtonLink } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Chip } from "@/ui/Chip";
import { fetchJson } from "@/ui/fetchJson";
import { ArrowRightIcon, ChatCircleTextIcon, LockSimpleIcon } from "@/ui/icons";
import { Notice } from "@/ui/Notice";
import { SignedOut } from "@/ui/SignedOut";
import { Skeleton } from "@/ui/Skeleton";
import { SettingsLink } from "../SettingsLink";
import { SignOutButton } from "../SignOutButton";
import { recentActivity, type ActivityItem, type CheckLike, type PaymentLike } from "./activity";

type Me = { displayName: string; circle: { displayName: string; relationship: string }[]; safeWordSet: boolean; onboarded: boolean };
type State = { kind: "loading" } | { kind: "signedOut" } | { kind: "error"; message: string } | { kind: "ready"; me: Me; items: ActivityItem[] };

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const day = formatDay;

export default function HomePage() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [me, payments, checks] = await Promise.all([
        fetchJson<Me>("/api/me"),
        fetchJson<PaymentLike[]>("/api/payments"),
        fetchJson<CheckLike[]>("/api/messages"),
      ]);
      if (cancelled) return;
      if ([me, payments, checks].some((r) => !r.ok && r.signedOut)) return setState({ kind: "signedOut" });
      if (!me.ok || !payments.ok || !checks.ok) {
        return setState({ kind: "error", message: "We couldn't load your home screen. Please refresh." });
      }
      setState({ kind: "ready", me: me.data, items: recentActivity(payments.data, checks.data, 5) });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main id="main" tabIndex={-1} className="focus:outline-none mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-6 pb-7 pt-6">
      <div className="flex items-center justify-between">
        <span className="text-[17px] font-bold text-evergreen">Trust Circle</span>
        <div className="flex items-center">
          <SettingsLink />
          <SignOutButton />
        </div>
      </div>
      {(state.kind === "loading" || state.kind === "error") && <h1 className="sr-only">Home</h1>}
      {state.kind === "loading" && (
        <>
          <p role="status" className="sr-only">
            Loading your home screen…
          </p>
          <Skeleton blocks={[40, 96, 96, 140]} />
        </>
      )}
      {state.kind === "signedOut" && <SignedOut />}
      {state.kind === "error" && (
        <div className="mt-6">
          <Notice tone="error">{state.message}</Notice>
        </div>
      )}
      {state.kind === "ready" && (
        <>
          {!state.me.onboarded && (
            <Card className="mt-5">
              <div data-testid="setup-card" className="flex flex-col gap-3">
                <h2 className="text-[22px] font-extrabold leading-snug">Finish setting up Trust Circle</h2>
                <p className="text-[17px] text-ink-2">Takes about a minute.</p>
                <ButtonLink href="/onboarding" data-testid="setup-start">Set up</ButtonLink>
              </div>
            </Card>
          )}
          <h1 className="mt-5 text-[32px] font-extrabold leading-tight tracking-[-0.01em]">Hello, {state.me.displayName}</h1>
          <div className="mt-3 flex items-center gap-2.5">
            {state.me.circle.length > 0 ? (
              <>
                <div className="flex" aria-hidden="true">
                  {state.me.circle.slice(0, 3).map((c, i) => (
                    <span
                      key={c.displayName}
                      className={`flex h-[34px] w-[34px] items-center justify-center rounded-full border-2 border-ground text-[14px] font-extrabold ${i === 0 ? "bg-evergreen-tint text-evergreen" : "-ml-2 bg-held-tint text-held"}`}
                    >
                      {initials(c.displayName)}
                    </span>
                  ))}
                </div>
                <span className="text-[17px] text-ink-2">
                  {state.me.circle.map((c) => c.displayName).join(" and ")} {state.me.circle.length === 1 ? "is" : "are"} in your circle
                </span>
              </>
            ) : (
              <span className="text-[17px] text-ink-2">No one is in your circle yet.</span>
            )}
          </div>

          <div className="mt-7 flex flex-col gap-3">
            <Link href="/check" className="flex items-start gap-4 rounded-panel bg-evergreen p-5 text-white no-underline" data-testid="home-check">
              <ChatCircleTextIcon aria-hidden="true" size={28} className="mt-0.5 flex-none" />
              <span className="flex flex-col gap-1">
                <span className="text-[22px] font-extrabold">Check a message</span>
                <span className="text-[17px] leading-snug opacity-95">Paste a text or add a screenshot. We&apos;ll tell you if it looks like a scam.</span>
              </span>
            </Link>
            <Link href="/send" className="flex items-start gap-4 rounded-panel border-2 border-ink bg-surface p-5 text-ink no-underline" data-testid="home-send">
              <ArrowRightIcon aria-hidden="true" size={28} className="mt-0.5 flex-none" />
              <span className="flex flex-col gap-1">
                <span className="text-[22px] font-extrabold">Send money</span>
                <span className="text-[17px] leading-snug text-ink-2">We look at every payment before it goes.</span>
              </span>
            </Link>
          </div>

          <h2 className="mt-8 text-[19px] font-bold" id="recent">
            Recent
          </h2>
          {state.items.length === 0 ? (
            <p className="mt-2 text-[17px] text-ink-2">Nothing yet. When you check a message or send money, it shows here.</p>
          ) : (
            <ul className="mt-2 flex flex-col">
              {state.items.map((item) => (
                <li key={item.key} className="border-b border-line">
                  <Link href={item.href} className="flex min-h-[64px] items-center justify-between gap-3 py-3 text-ink no-underline">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate text-[17px] font-bold">{item.title}</span>
                      <span className="text-[16px] text-ink-3">{day(item.when)}</span>
                    </span>
                    <span className="flex-none"><Chip tone={item.chip.tone}>{item.chip.label}</Chip></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-auto pt-8">
            <Link href="/onboarding?step=safe_word" data-testid="safe-word-row" className="flex min-h-[56px] items-center gap-3 rounded-control bg-surface px-4 py-3.5 text-[16px] text-ink-2 no-underline">
              <LockSimpleIcon aria-hidden="true" size={22} className="flex-none text-evergreen" />
              <span>{state.me.safeWordSet ? "Your family safe word is set." : "You haven't set a family safe word yet."}</span>
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
