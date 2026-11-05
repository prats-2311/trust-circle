"use client";
import dynamic from "next/dynamic";
import { Component, Fragment, useEffect, useState, type ReactNode } from "react";
import type { DashboardRow } from "@/dashboard/dashboardService";
import type { PayPalSays } from "@/dashboard/paypalSays";
import { LAYOUT_KEY } from "./studioLayout";

const StudioBoard = dynamic(() => import("./StudioBoard"), {
  ssr: false,
  loading: () => <p role="status" className="text-[17px] text-ink-2">Loading the explore board…</p>,
});

/** A board that throws while rendering must not take the payments table down with it. */
export class StudioBoundary extends Component<{ children: (forcePreset: boolean) => ReactNode }, { failures: number; broken: boolean }> {
  state = { failures: 0, broken: false };
  static getDerivedStateFromError() {
    return { broken: true };
  }
  componentDidCatch() {
    if (this.state.failures === 0) {
      try {
        window.localStorage.removeItem(LAYOUT_KEY);
      } catch {
        // no storage: nothing to clear
      }
    }
    this.setState((s) => ({ failures: s.failures + 1, broken: false }));
  }
  render() {
    // First failure: remount once on the preset. Second: render nothing.
    if (this.state.broken || this.state.failures >= 2) return null;
    return <Fragment key={this.state.failures}>{this.props.children(this.state.failures > 0)}</Fragment>;
  }
}

const QUERY = "(min-width: 640px)";

export function StudioBoardLazy({ rows, says }: { rows: DashboardRow[]; says?: Record<string, PayPalSays> }) {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  if (!wide || rows.length === 0) return null;
  return (
    <section aria-labelledby="explore-heading" className="mb-6">
      <h2 id="explore-heading" className="mb-3 text-[24px] font-extrabold leading-[1.2]">Explore your circle&apos;s payments</h2>
      <StudioBoundary>{(forcePreset) => <StudioBoard rows={rows} says={says} forcePreset={forcePreset} />}</StudioBoundary>
    </section>
  );
}
