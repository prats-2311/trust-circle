/* eslint-disable @typescript-eslint/no-explicit-any -- ag-studio widget param types are loosely typed */
"use client";
import { use } from "react";
import { createWidgets } from "ag-studio-react";
import type { AgWidgetParams } from "ag-studio";
import { formatUsd } from "@/alerts/alertCopy";

const CAUTION = { background: "var(--color-caution-tint)", color: "var(--color-caution-ink)" };
const tile = "rounded-panel bg-surface p-5 h-full";

function MoneyProtected(params: AgWidgetParams<any>) {
  const { widgetApi, dataMapping } = params;
  const res = use(widgetApi.getData({ kind: "flat", fields: (dataMapping as any).value }));
  const rows = res.results.rows as Record<string, unknown>[];
  const total = rows[0] ? Number(Object.values(rows[0])[0]) || 0 : 0;
  return (
    <div data-testid="studio-money-protected" className={tile}>
      <div className="text-[17px] text-ink-2">Money protected</div>
      <div className="text-[32px] leading-[1.15] font-extrabold tabular-nums">{formatUsd(Math.round(total * 100))}</div>
      <div className="text-[15px] text-ink-2">In the current filter</div>
    </div>
  );
}

function PayPalCheck(params: AgWidgetParams<any>) {
  const { widgetApi, dataMapping } = params;
  const m = dataMapping as any;
  const res = use(widgetApi.getData({ kind: "flat", fields: [...m.value, ...m.count] }));
  const counts = { Matches: 0, "Doesn't match": 0, "Not checked": 0 } as Record<string, number>;
  for (const row of res.results.rows as Record<string, unknown>[]) {
    const [v, n] = Object.values(row);
    if (String(v) in counts) counts[String(v)] = Number(n) || 0;
  }
  const cells: [string, string][] = [
    ["Matches PayPal", "Matches"],
    ["Doesn't match", "Doesn't match"],
    ["Not checked", "Not checked"],
  ];
  if (cells.every(([, key]) => counts[key] === 0)) {
    return (
      <div data-testid="studio-paypal-check" className={`${tile} text-ink-2`}>
        No payments have reached PayPal yet.
      </div>
    );
  }
  return (
    <div data-testid="studio-paypal-check" className={`${tile} flex gap-4`}>
      {cells.map(([label, key]) => {
        const bad = key === "Doesn't match" && counts[key]! > 0;
        return (
          <div key={key} className="flex-1" style={bad ? { ...CAUTION, borderRadius: 12, padding: 8 } : { padding: 8 }}>
            <div className="text-[17px]">{label}</div>
            <div className="text-[32px] leading-[1.15] font-extrabold tabular-nums">{counts[key]}</div>
          </div>
        );
      })}
    </div>
  );
}

const field = (role: string, cardinality: "one" | "many") => ({ type: "field", supportedRoles: [role], requires: { cardinality }, required: true });

export const studioWidgets = createWidgets<any>({
  additionalTypes: [
    {
      id: "money-protected",
      label: "Money protected",
      dataMapping: { value: field("numeric", "one") },
      form: (p: any) => p.createDefaults({ dataMappingItems: [{ key: "value", label: "Value" }] }),
      comp: MoneyProtected,
      defaultSize: { width: 6, height: 6 },
      minSize: { width: 3, height: 3 },
    },
    {
      id: "paypal-check",
      label: "PayPal check",
      dataMapping: { value: field("category", "many"), count: field("numeric", "one") },
      form: (p: any) => p.createDefaults({ dataMappingItems: [{ key: "value", label: "Check" }, { key: "count", label: "Count" }] }),
      comp: PayPalCheck,
      defaultSize: { width: 8, height: 6 },
      minSize: { width: 4, height: 3 },
    },
  ],
  menu: [{ label: "Trust Circle", widgetIds: ["money-protected", "paypal-check"] }],
} as any);
