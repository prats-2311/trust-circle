"use client";
import { useEffect, useState } from "react";
import type { Trends } from "@/dashboard/dashboardService";
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
    <main style={{ width: "100%", boxSizing: "border-box", maxWidth: 1200, margin: "0 auto", padding: "24px 16px", background: "#F4F6F4", color: "#14201B" }}>
      <h1 style={{ fontSize: 32, fontWeight: 800 }}>Scams people are reporting</h1>
      <p style={{ fontSize: 18 }}>Reports to Trust Circle over the last 12 weeks, grouped by the kind of scam.</p>
      {signedOut && <SignedOut />}
      {failed && !signedOut && <p role="alert">We couldn&apos;t load the trends. Please refresh.</p>}
      {!trends && !failed && !signedOut && (
        <>
          <p role="status">Loading the latest reports…</p>
          <Skeleton blocks={[420, 56, 56, 56]} />
        </>
      )}
      {trends && (trends.total === 0 ? <p>No reports yet.</p> : <TrendsView trends={trends} />)}
      {trends && trends.total > 0 && <p style={{ fontSize: 16, color: "#4A5651" }}>Includes example reports created for this demo.</p>}
    </main>
  );
}
