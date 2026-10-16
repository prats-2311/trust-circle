"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Preset } from "@/domain/types";
import { homeFor, type Persona } from "@/server/demo";
import { PRESETS } from "@/settings/presets";
import { Button } from "@/ui/Button";
import { EnableNotifications } from "@/ui/EnableNotifications";
import { describedBy, Field, INPUT } from "@/ui/Field";
import { fetchJson } from "@/ui/fetchJson";
import { LockSimpleIcon } from "@/ui/icons";
import { Notice } from "@/ui/Notice";
import { PresetRadios } from "@/ui/PresetRadios";
import { FinePrint, Lead, Title } from "@/ui/Screen";
import { SignedOut } from "@/ui/SignedOut";
import { Skeleton } from "@/ui/Skeleton";
import { useOnce } from "@/ui/useOnce";
import { firstUnfinished, isStep, STEPS, stepNumber, type Step } from "./steps";

type Me = {
  displayName: string;
  persona: Persona | null;
  preset: Preset | null;
  coolingOffHours: number;
  onboarded: boolean;
  safeWordSet: boolean;
  circle: { displayName: string; relationship: string }[];
};
type Load = { kind: "loading" } | { kind: "signedOut" } | { kind: "error" } | { kind: "ready"; me: Me };

const VISITED_KEY = "tc_onboarding_visited";
const SAVE_FAILED = "We couldn't save that just now. Please try again.";

function readVisited(): Step[] {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(VISITED_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter(isStep) : [];
  } catch {
    return [];
  }
}
function markVisited(s: Step) {
  try {
    const next = Array.from(new Set([...readVisited(), s]));
    sessionStorage.setItem(VISITED_KEY, JSON.stringify(next));
  } catch {
    // Private windows can refuse storage; onboarding then simply restarts at step one.
  }
}

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

export default function OnboardingPage() {
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [step, setStep] = useState<Step>("preset");
  const [preset, setPreset] = useState<Preset>("family");
  const [safeWord, setSafeWord] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { busy, run } = useOnce();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetchJson<Me>("/api/me");
      if (cancelled) return;
      if (!r.ok) return setLoad(r.signedOut ? { kind: "signedOut" } : { kind: "error" });
      const asked = new URLSearchParams(window.location.search).get("step");
      setStep(isStep(asked) ? asked : firstUnfinished(r.data, readVisited()));
      if (r.data.preset) setPreset(r.data.preset);
      setLoad({ kind: "ready", me: r.data });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const goTo = (s: Step) => {
    setSaveError(null);
    setFieldError(null);
    setStep(s);
  };
  const advance = () => {
    markVisited(step);
    const next = STEPS[STEPS.indexOf(step) + 1];
    if (next) goTo(next);
  };

  /** Returns true when the save worked; otherwise has shown the right message. */
  const save = async (url: string, body: unknown, onBadInput?: (msg: string) => void): Promise<boolean> => {
    const r = await fetchJson(url, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) return true;
    if (r.signedOut) setLoad({ kind: "signedOut" });
    else if (r.status === 400 && onBadInput) onBadInput(r.error);
    else setSaveError(SAVE_FAILED);
    return false;
  };

  if (load.kind !== "ready") {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-6 pb-7 pt-6">
        {load.kind === "loading" && (
          <>
            <p role="status" className="sr-only">Loading…</p>
            <Skeleton blocks={[24, 40, 96, 96, 96]} />
          </>
        )}
        {load.kind === "signedOut" && <SignedOut />}
        {load.kind === "error" && (
          <div className="mt-6">
            <Notice tone="error">We couldn&apos;t load setup. Please refresh.</Notice>
          </div>
        )}
      </main>
    );
  }
  const me = load.me;
  const chosen = PRESETS[preset];
  const n = stepNumber(step);

  const continuePreset = () =>
    run(async () => {
      if (await save("/api/me/settings", { preset })) {
        // The circle step reads cooling-off and the list below, so keep them current.
        const fresh = await fetchJson<Me>("/api/me");
        if (fresh.ok) setLoad({ kind: "ready", me: fresh.data });
        advance();
      }
    });
  const saveSafeWord = () =>
    run(async () => {
      setFieldError(null);
      if (await save("/api/me/safe-word", { safeWord }, setFieldError)) {
        setLoad({ kind: "ready", me: { ...me, safeWordSet: true } });
        advance();
      }
    });
  const finish = () =>
    run(async () => {
      if (await save("/api/me/settings", { onboarded: true })) {
        try {
          sessionStorage.removeItem(VISITED_KEY);
        } catch {
          // Nothing to clear.
        }
        router.push(me.persona ? homeFor(me.persona) : "/home");
      }
    });

  // "you" would read as "you's circle", and demo personas who pick Just me still have a seeded circle.
  const circleWord = me.persona ? (preset === "solo" ? "your" : `${chosen.circleWord}'s`) : null;
  const soloNoCircle = me.circle.length === 0;
  const mailto = `mailto:?subject=${encodeURIComponent("Join my Trust Circle")}&body=${encodeURIComponent(
    `I'm using Trust Circle to check risky payments before they go. Would you be part of my circle? ${window.location.origin}/`,
  )}`;

  const primary = (label: string, onClick: () => void) => (
    <Button data-testid="onboarding-next" disabled={busy} onClick={onClick}>
      {label}
    </Button>
  );
  const skip = (
    <Button variant="quiet" data-testid="onboarding-skip" disabled={busy} onClick={advance}>
      Skip for now
    </Button>
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-6 pb-7 pt-6">
      <div className="flex flex-col gap-2.5">
        <span className="text-[16px] font-bold text-ink-2">Step {n} of 4</span>
        <div
          role="progressbar"
          aria-label="Setup progress"
          aria-valuemin={1}
          aria-valuemax={4}
          aria-valuenow={n}
          className="grid grid-cols-4 gap-1.5"
        >
          {STEPS.map((s, i) => (
            <span key={s} className={`h-1.5 rounded-full ${i < n ? "bg-evergreen" : "bg-line"}`} />
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        {step === "preset" && (
          <>
            <Title>Who are you protecting?</Title>
            <Lead>Pick the closest fit. You can change it later in Settings.</Lead>
            <div className="mt-6">
              <PresetRadios value={preset} onChange={setPreset} disabled={busy} />
            </div>
            <div className="mt-5">
              <FinePrint>You approve every payment in PayPal&apos;s own window. We never see your PayPal password.</FinePrint>
            </div>
          </>
        )}

        {step === "circle" && (
          <>
            <Title>Who checks risky payments</Title>
            <Lead>
              {soloNoCircle
                ? `You haven't added anyone. Risky payments wait ${me.coolingOffHours} hours so you have time to check.`
                : circleWord
                  ? `In this demo, ${circleWord} circle is already set up.`
                  : "These people check risky payments for you."}
            </Lead>
            {!soloNoCircle && (
              <ul className="mt-6 flex flex-col gap-3">
                {me.circle.map((c) => (
                  <li key={c.displayName} className="flex items-center gap-4 rounded-panel bg-surface p-4">
                    <span aria-hidden="true" className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-evergreen-tint text-[17px] font-extrabold text-evergreen">
                      {initials(c.displayName)}
                    </span>
                    <span className="flex flex-col">
                      <span className="text-[18px] font-bold">{c.displayName}</span>
                      <span className="text-[16px] text-ink-3">{c.relationship}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <a
              href={mailto}
              className="mt-5 inline-flex min-h-[58px] w-full items-center justify-center rounded-control border-2 border-ink px-5 text-[19px] font-bold text-ink no-underline hover:bg-surface"
            >
              Invite someone
            </a>
          </>
        )}

        {step === "safe_word" && (
          <>
            <Title>Choose a family safe word</Title>
            <Lead>If someone calls asking for money, ask them for it. Only your family will know it.</Lead>
            {me.safeWordSet && (
              <div className="mt-4">
                <Notice tone="info">You&apos;ve already set a safe word. You can change it here.</Notice>
              </div>
            )}
            <div className="mt-6">
              <Field
                id="word"
                label="Safe word"
                hint="Pick something easy to say and hard to guess, like a pet's name from years ago. Tell your family in person, not by text or email."
                error={fieldError}
              >
                <input
                  id="word"
                  data-testid="safe-word-input"
                  autoComplete="off"
                  value={safeWord}
                  onChange={(e) => setSafeWord(e.target.value)}
                  aria-invalid={fieldError ? true : undefined}
                  aria-describedby={describedBy("word", "hint", fieldError)}
                  className={`${INPUT} text-[20px]`}
                />
              </Field>
            </div>
            <div className="mt-5 flex items-start gap-3 rounded-control bg-surface px-4 py-3.5 text-[16px] leading-snug text-ink-2">
              <LockSimpleIcon aria-hidden="true" size={20} className="mt-0.5 flex-none text-evergreen" />
              <span>We only keep a scrambled copy. Nobody at Trust Circle can read your safe word.</span>
            </div>
          </>
        )}

        {step === "alerts" && (
          <>
            <Title>Turn on alerts</Title>
            <Lead>So you hear straight away when a payment needs a look. You&apos;ll always see them in the app and by email too.</Lead>
            <div className="mt-6">
              <EnableNotifications />
            </div>
          </>
        )}
      </div>

      {saveError && (
        <div className="mt-5">
          <Notice tone="error">{saveError}</Notice>
        </div>
      )}
      <div className="mt-8 flex flex-col gap-2.5">
        {step === "preset" && (
          <>
            {primary("Continue", continuePreset)}
            {skip}
          </>
        )}
        {step === "circle" && (
          <>
            {primary("Continue", advance)}
            {skip}
          </>
        )}
        {step === "safe_word" && (
          <>
            {primary("Save safe word", saveSafeWord)}
            {skip}
          </>
        )}
        {step === "alerts" && primary("Finish", finish)}
      </div>
    </main>
  );
}
