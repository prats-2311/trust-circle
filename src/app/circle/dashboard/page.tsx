"use client";
import { useEffect, useState } from "react";
import { formatUsd } from "@/alerts/alertCopy";
import type { CircleDashboard } from "@/dashboard/dashboardService";
import { SessionNotice } from "../../SessionNotice";
import { Skeleton } from "../../Skeleton";
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
    <main style={{ width: "100%", boxSizing: "border-box", maxWidth: 1200, margin: "0 auto", padding: "24px 16px", background: "#F4F6F4", color: "#14201B" }}>
      <h1 style={{ fontSize: 32, fontWeight: 800 }}>Your circle&apos;s payments</h1>
      {signedOut && <SessionNotice />}
      {failed && !signedOut && <p role="alert">We couldn&apos;t load the dashboard. Please refresh.</p>}
      {!data && !failed && !signedOut && (
        <>
          <p role="status">Loading your circle&apos;s payments…</p>
          <Skeleton blocks={[72, 48, 56, 56, 56, 56]} />
        </>
      )}
      {data && (
        <>
          <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, margin: "24px 0" }}>
            <div data-testid="money-protected">
              <dt>Money protected</dt>
              <dd style={{ fontSize: 32, fontWeight: 800, margin: 0 }}>{formatUsd(data.moneyProtectedCents)}</dd>
            </div>
            <div>
              <dt>Scams stopped</dt>
              <dd style={{ fontSize: 32, fontWeight: 800, margin: 0 }}>{data.scamsStopped}</dd>
            </div>
            <div>
              <dt>On hold now</dt>
              <dd style={{ fontSize: 32, fontWeight: 800, margin: 0 }}>{data.onHold}</dd>
            </div>
          </dl>
          {data.rows.length === 0 ? <p>No payments yet. When someone in your circle sends money, it shows here.</p> : <DashboardGrid rows={data.rows} />}
          {data.rows.length > 0 && <p style={{ fontSize: 16, color: "#4A5651" }}>Includes example payments created for this demo.</p>}
        </>
      )}
    </main>
  );
}
