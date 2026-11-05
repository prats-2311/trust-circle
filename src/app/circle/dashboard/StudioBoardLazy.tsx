"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { DashboardRow } from "@/dashboard/dashboardService";
import type { PayPalSays } from "@/dashboard/paypalSays";

const StudioBoard = dynamic(() => import("./StudioBoard"), {
  ssr: false,
  loading: () => <p role="status" className="text-[17px] text-ink-2">Loading the explore board…</p>,
});

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
      <StudioBoard rows={rows} says={says} />
    </section>
  );
}
