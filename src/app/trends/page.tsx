"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Trends } from "@/dashboard/dashboardService";
import { ArrowLeftIcon } from "@/ui/icons";
import { Notice } from "@/ui/Notice";
import { SignedOut } from "@/ui/SignedOut";
import { Skeleton } from "@/ui/Skeleton";
import { TrendsView } from "./TrendsView";

export default function TrendsPage() {
  const [trends, setTrends] = useState<Trends | null>(null);
  const [failed, setFailed] = useState(false);
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    fetch("/api/trends")
      .then((r) => {
        if (r.status === 401) {
          setSignedOut(true);
          return null;
        }
        if (!r.ok) throw new Error("load failed");
        return r.json() as Promise<Trends>;
      })
      .then((t) => t && setTrends(t))
      .catch(() => setFailed(true));
  }, []);

  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 pb-10 pt-4 md:px-6">
      <Link href="/circle" className="-ml-2.5 inline-flex min-h-11 items-center gap-2 rounded-xl px-2.5 text-[18px] font-bold text-ink no-underline">
        <ArrowLeftIcon aria-hidden="true" size={24} />
        Your circle
      </Link>
      <h1 className="mt-3 text-[32px] font-extrabold leading-[1.15] tracking-[-0.01em]">Scams people are reporting</h1>
      <p className="mt-2 text-[18px] text-ink-2">Reports to Trust Circle over the last 12 weeks, grouped by the kind of scam.</p>
      {signedOut && <SignedOut />}
      {failed && !signedOut && <div className="mt-6"><Notice tone="error">We couldn&apos;t load the trends. Please refresh.</Notice></div>}
      {!trends && !failed && !signedOut && (
        <>
          <p role="status" className="sr-only">Loading the latest reports…</p>
          <Skeleton blocks={[420, 56, 56, 56]} />
        </>
      )}
      {trends && (trends.total === 0 ? <p className="mt-4 text-[17px] text-ink-2">No reports yet.</p> : <TrendsView trends={trends} />)}
      {trends && trends.total > 0 && <p className="mt-4 text-[16px] text-ink-3">Includes example reports created for this demo.</p>}
    </main>
  );
}
