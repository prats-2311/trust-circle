"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatUsd } from "@/alerts/alertCopy";
import type { Preset } from "@/domain/types";
import { COOLING_OFF_CHOICES, PRESETS } from "@/settings/presets";
import { EnableNotifications } from "@/ui/EnableNotifications";
import { fetchJson } from "@/ui/fetchJson";
import { LockSimpleIcon } from "@/ui/icons";
import { Notice } from "@/ui/Notice";
import { PresetRadios } from "@/ui/PresetRadios";
import { Screen } from "@/ui/Screen";
import { SignedOut } from "@/ui/SignedOut";
import { Skeleton } from "@/ui/Skeleton";

type Prefs = { preset: Preset; coolingOffHours: number; circleLimitCents: number | null };
type Load = { kind: "loading" } | { kind: "signedOut" } | { kind: "error" } | { kind: "ready"; prefs: Prefs; safeWordSet: boolean };

const SAVE_FAILED = "We couldn't save that just now. Please try again.";

function limitLine(p: Prefs): string {
  const name = PRESETS[p.preset].label;
  return p.circleLimitCents === null ? `No limit (${name})` : `${formatUsd(p.circleLimitCents)} or more (set by the ${name} preset).`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 flex flex-col gap-3">
      <h2 className="text-[20px] font-bold">{title}</h2>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetchJson<Prefs & { safeWordSet: boolean }>("/api/me");
      if (cancelled) return;
      if (!r.ok) return setLoad(r.signedOut ? { kind: "signedOut" } : { kind: "error" });
      const { preset, coolingOffHours, circleLimitCents, safeWordSet } = r.data;
      setLoad({ kind: "ready", prefs: { preset, coolingOffHours, circleLimitCents }, safeWordSet });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async (body: { preset: Preset } | { coolingOffHours: number }) => {
    setSaved(false);
    setSaveError(null);
    const before = load.kind === "ready" ? load.prefs : null;
    // Show the choice straight away; it is put back below if the save fails.
    setLoad((l) => (l.kind === "ready" ? { ...l, prefs: { ...l.prefs, ...body } } : l));
    const r = await fetchJson<Prefs>("/api/me/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) {
      const { preset, coolingOffHours, circleLimitCents } = r.data;
      setLoad((l) => (l.kind === "ready" ? { ...l, prefs: { preset, coolingOffHours, circleLimitCents } } : l));
      setSaved(true);
    } else if (r.signedOut) setLoad({ kind: "signedOut" });
    else {
      if (before) setLoad((l) => (l.kind === "ready" ? { ...l, prefs: before } : l));
      setSaveError(r.status === 400 ? r.error : SAVE_FAILED);
    }
  };

  return (
    <Screen title="Settings" backHref="/home">
      {load.kind === "loading" && (
        <>
          <p role="status" className="sr-only">Loading your settings…</p>
          <Skeleton blocks={[28, 220, 120, 80]} />
        </>
      )}
      {load.kind === "signedOut" && <SignedOut />}
      {load.kind === "error" && (
        <div className="mt-6">
          <Notice tone="error">We couldn&apos;t load your settings. Please refresh.</Notice>
        </div>
      )}
      {load.kind === "ready" && (
        <>
          <div role="status" className="min-h-[24px] pt-3 text-[17px] font-bold text-evergreen">
            {saved ? "Saved." : ""}
          </div>
          {saveError && <Notice tone="error">{saveError}</Notice>}

          <Section title="Who you're protecting">
            <PresetRadios value={load.prefs.preset} onChange={(p) => void save({ preset: p })} />
          </Section>

          <Section title="How long a held payment waits">
            <div role="radiogroup" aria-label="How long a held payment waits" className="grid grid-cols-3 gap-3">
              {COOLING_OFF_CHOICES.map((h) => (
                <label
                  key={h}
                  className="flex min-h-[72px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-control border-2 border-line-strong bg-surface px-2 text-[18px] font-bold has-[:checked]:border-evergreen has-[:checked]:bg-evergreen-tint has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-held"
                >
                  <input
                    type="radio"
                    name="cooling"
                    data-testid={`cooling-${h}`}
                    checked={load.prefs.coolingOffHours === h}
                    onChange={() => void save({ coolingOffHours: h })}
                    className="h-5 w-5 accent-evergreen"
                  />
                  {h} hours
                </label>
              ))}
            </div>
            <p className="text-[16px] leading-snug text-ink-3">
              You can release a held payment yourself after this. It never changes a payment that&apos;s already on hold.
            </p>
          </Section>

          <Section title="Amount that always gets a second look">
            <p className="text-[18px]" data-testid="circle-limit">{limitLine(load.prefs)}</p>
          </Section>

          <Section title="Family safe word">
            <Link
              href="/onboarding?step=safe_word"
              className="flex min-h-[56px] items-center gap-3 rounded-control bg-surface px-4 text-[18px] font-bold text-ink no-underline"
            >
              <LockSimpleIcon aria-hidden="true" size={22} className="flex-none text-evergreen" />
              {load.safeWordSet ? "Change your safe word" : "Set a safe word"}
            </Link>
          </Section>

          <Section title="Alerts">
            <EnableNotifications />
          </Section>
          <div className="pb-4" />
        </>
      )}
    </Screen>
  );
}
