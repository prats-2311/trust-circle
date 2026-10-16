"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatUsd } from "@/alerts/alertCopy";
import type { CircleDashboard } from "@/dashboard/dashboardService";
import { ArrowLeftIcon } from "@/ui/icons";
import { Notice } from "@/ui/Notice";
import { SignedOut } from "@/ui/SignedOut";
import { Skeleton } from "@/ui/Skeleton";
import { DashboardGrid } from "./DashboardGrid";

export default function CircleDashboardPage() {
  const [data, setData] = useState<CircleDashboard | null>(null);
  const [failed, setFailed] = useState(false);
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    fetch("/api/circle/dashboard")
      .then((r) => {
        if (r.status === 401) {
          setSignedOut(true);
          return null;
        }
        if (!r.ok) throw new Error("load failed");
        return r.json() as Promise<CircleDashboard>;
      })
      .then((d) => d && setData(d))
      .catch(() => setFailed(true));
  }, []);

  return (
    <main className="mx-auto w-full max-w-[1200px] px-4 pb-10 pt-4 md:px-6">
      <Link href="/circle" className="-ml-2.5 inline-flex min-h-11 items-center gap-2 rounded-xl px-2.5 text-[18px] font-bold text-ink no-underline">
        <ArrowLeftIcon aria-hidden="true" size={24} />
        Your circle
      </Link>
      <h1 className="mt-3 text-[32px] font-extrabold leading-[1.15] tracking-[-0.01em]">Your circle&apos;s payments</h1>
      {signedOut && <SignedOut />}
      {failed && !signedOut && <div className="mt-6"><Notice tone="error">We couldn&apos;t load the dashboard. Please refresh.</Notice></div>}
      {!data && !failed && !signedOut && (
        <>
          <p role="status" className="sr-only">Loading your circle&apos;s payments…</p>
          <Skeleton blocks={[72, 48, 56, 56, 56, 56]} />
        </>
      )}
      {data && (
        <>
          <dl className="my-6 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
            <div data-testid="money-protected" className="rounded-panel bg-surface p-5">
              <dt className="text-[17px] text-ink-2">Money protected</dt>
              <dd className="m-0 text-[32px] font-extrabold tabular-nums">{formatUsd(data.moneyProtectedCents)}</dd>
            </div>
            <div className="rounded-panel bg-surface p-5">
              <dt className="text-[17px] text-ink-2">Scams stopped</dt>
              <dd className="m-0 text-[32px] font-extrabold tabular-nums">{data.scamsStopped}</dd>
            </div>
            <div className="rounded-panel bg-surface p-5">
              <dt className="text-[17px] text-ink-2">On hold now</dt>
              <dd className="m-0 text-[32px] font-extrabold tabular-nums">{data.onHold}</dd>
            </div>
          </dl>
          {data.rows.length === 0 ? <p className="text-[17px] text-ink-2">No payments yet. When someone in your circle sends money, it shows here.</p> : <DashboardGrid rows={data.rows} />}
          {data.rows.length > 0 && <p className="mt-4 text-[16px] text-ink-3">Includes example payments created for this demo.</p>}
        </>
      )}
    </main>
  );
}
