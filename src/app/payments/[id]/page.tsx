"use client";
import { use, useCallback, useEffect, useRef, useState } from "react";
import type { Outcome } from "@/server/paymentOutcome";
import { ButtonLink } from "@/ui/Button";
import { fetchJson } from "@/ui/fetchJson";
import { Notice } from "@/ui/Notice";
import { Screen, Title } from "@/ui/Screen";
import { SignedOut } from "@/ui/SignedOut";
import { Skeleton } from "@/ui/Skeleton";
import { PaymentScreens, type PaymentView } from "./PaymentScreens";
import { screenFor, type ScreenKind, type Stage } from "./screen";

type Loaded = PaymentView & { outcome: Outcome };
type State =
  | { kind: "loading" }
  | { kind: "signedOut" }
  | { kind: "notFound" }
  | { kind: "error"; message: string }
  | { kind: "ready"; p: Loaded; stage: Stage | null; circleFirst: string | null };

const POLL_MS = 5000;
const POLLED: ScreenKind[] = ["pending", "waiting", "held", "challenge_memory", "challenge_safe_word", "official_routes"];

export default function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [state, setState] = useState<State>({ kind: "loading" });
  const meRef = useRef<string | null | undefined>(undefined);
  const alive = useRef(true);

  const load = useCallback(
    async (silent: boolean) => {
      const [pay, ver, me] = await Promise.all([
        fetchJson<Loaded>(`/api/payments/${id}`),
        fetchJson<Stage>(`/api/payments/${id}/verification`),
        meRef.current === undefined ? fetchJson<{ circle: { displayName: string }[] }>("/api/me") : Promise.resolve(null),
      ]);
      if (!alive.current) return;
      if (!pay.ok && pay.signedOut) return setState({ kind: "signedOut" });
      if (!pay.ok) {
        // A failed background refresh keeps the last good screen rather than replacing it with an error.
        if (silent) return;
        return setState(pay.status === 403 || pay.status === 404 ? { kind: "notFound" } : { kind: "error", message: "We couldn't load this payment. Please refresh." });
      }
      if (me?.ok) meRef.current = me.data.circle[0]?.displayName ?? null;
      setState({ kind: "ready", p: pay.data, stage: ver.ok ? ver.data : null, circleFirst: meRef.current ?? null });
    },
    [id],
  );

  useEffect(() => {
    alive.current = true;
    void load(false);
    return () => {
      alive.current = false;
    };
  }, [load]);

  const kind = state.kind === "ready" ? screenFor(state.p, state.stage) : null;
  const polling = kind !== null && POLLED.includes(kind);
  useEffect(() => {
    if (!polling) return;
    const tick = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [polling, load]);

  if (state.kind === "ready" && kind) {
    const contactName = state.stage?.stage === "waiting_for_person" ? state.stage.contactName : state.circleFirst;
    return <PaymentScreens kind={kind} p={state.p} stage={state.stage} contactName={contactName} reload={() => load(true)} />;
  }
  if (state.kind === "loading") {
    return (
      <Screen backHref="/home">
        <p role="status" className="sr-only">Loading your payment…</p>
        <Skeleton blocks={[228, 40, 80, 120]} />
      </Screen>
    );
  }
  if (state.kind === "signedOut") return <Screen><SignedOut /></Screen>;
  return (
    <Screen backHref="/home" footer={<ButtonLink href="/home" variant="secondary">Back to home</ButtonLink>}>
      {state.kind === "notFound" ? (
        <Title>We couldn&apos;t find this payment</Title>
      ) : (
        <div className="mt-6"><Notice tone="error">{state.kind === "error" ? state.message : ""}</Notice></div>
      )}
    </Screen>
  );
}
