/** Everything the aftercare agent may call. Reading only: this list is the whole of its authority. */
export const READ_ONLY_TOOLS = ["list_transactions", "get_order"] as const;
export type ReadOnlyTool = (typeof READ_ONLY_TOOLS)[number];

export interface ToolResult {
  ok: boolean;
  content: string;
  refused?: boolean;
}
export interface ToolRunner {
  definitions: unknown[];
  run(name: string, argsJson: string, opts?: { timeoutMs?: number }): Promise<ToolResult>;
}

interface Toolkit {
  getTools(): { function: { name: string } }[];
  handleToolCall(c: unknown): Promise<{ content: unknown }>;
}

/** What this one sender owns. The platform credentials see everyone's transactions, so every result is cut down to this. */
export interface ToolScope {
  paymentIds: ReadonlySet<string>;
  orderIds: ReadonlySet<string>;
}

const MAX_ROWS = 50;
const REFUSED = '{"error":"tool not allowed"}';
const FAILED = '{"error":"tool failed"}';

function isAllowed(name: string): name is ReadOnlyTool {
  return (READ_ONLY_TOOLS as readonly string[]).includes(name);
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (typeof v === "object" && v !== null ? (v as Json) : {});
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const amountOf = (v: unknown): string | null => {
  const a = obj(v);
  const value = str(a.value);
  return value === null ? null : `${value} ${str(a.currency_code) ?? str(a.currencyCode) ?? ""}`.trim();
};

/** Keeps only this sender's rows, and only date, amount and status of each. Names, emails and notes never leave. */
function scopeTransactions(parsed: unknown, scope: ToolScope): string {
  const details = obj(parsed).transaction_details;
  const rows = (Array.isArray(details) ? details : [])
    .map((d) => obj(obj(d).transaction_info))
    .filter((t) => typeof t.custom_id === "string" && scope.paymentIds.has(t.custom_id))
    .slice(0, MAX_ROWS)
    .map((t) => ({
      paymentId: t.custom_id,
      date: str(t.transaction_initiation_date),
      amount: amountOf(t.transaction_amount),
      status: str(t.transaction_status),
    }));
  return JSON.stringify({ transactions: rows });
}

function scopeOrder(parsed: unknown): string {
  const o = obj(parsed);
  const unit = obj(Array.isArray(o.purchase_units) ? o.purchase_units[0] : Array.isArray(o.purchaseUnits) ? o.purchaseUnits[0] : null);
  return JSON.stringify({ status: str(o.status), amount: amountOf(unit.amount), createTime: str(o.create_time) ?? str(o.createTime) });
}

function withTimeout<T>(p: Promise<T>, ms: number | undefined): Promise<T> {
  if (ms === undefined) return p;
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), Math.max(ms, 0));
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e: unknown) => { clearTimeout(t); reject(e instanceof Error ? e : new Error("failed")); },
    );
  });
}

/**
 * Wraps a toolkit so only the allow-list is offered and only the allow-list can run, and only on this sender's data.
 * Refused calls never reach `tk`.
 */
export function createReadOnlyToolRunner(tk: Toolkit, scope: ToolScope): ToolRunner {
  return {
    definitions: tk.getTools().filter((t) => isAllowed(t.function.name)),
    async run(name, argsJson, opts) {
      if (!isAllowed(name)) return { ok: false, content: REFUSED, refused: true };
      if (name === "get_order") {
        let id: unknown;
        try {
          id = obj(JSON.parse(argsJson)).id;
        } catch {
          return { ok: false, content: REFUSED, refused: true };
        }
        if (typeof id !== "string" || !scope.orderIds.has(id)) return { ok: false, content: REFUSED, refused: true };
      }
      try {
        const res = await withTimeout(
          tk.handleToolCall({ id: "aftercare", type: "function", function: { name, arguments: argsJson } }),
          opts?.timeoutMs,
        );
        const text = typeof res.content === "string" ? res.content : JSON.stringify(res.content);
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          return { ok: false, content: FAILED };
        }
        // The toolkit reports failures as {"error":…} or, for HTTP errors, {"ok":false,"status":…}.
        if (typeof parsed === "object" && parsed !== null && ("error" in parsed || (parsed as { ok?: unknown }).ok === false)) {
          return { ok: false, content: FAILED };
        }
        return { ok: true, content: name === "list_transactions" ? scopeTransactions(parsed, scope) : scopeOrder(parsed) };
      } catch {
        return { ok: false, content: FAILED };
      }
    },
  };
}

/** The real toolkit, narrowed to the read actions and pinned to the PayPal sandbox. Loaded on first use. */
let toolkit: Promise<Toolkit> | undefined;
export function createPayPalReadOnlyToolkit(creds: { clientId: string; clientSecret: string }): Promise<Toolkit> {
  toolkit ??= load(creds).catch((e: unknown) => {
    toolkit = undefined;
    throw e;
  });
  return toolkit;
}

async function load(creds: { clientId: string; clientSecret: string }): Promise<Toolkit> {
  const { PayPalAgentToolkit } = await import("@paypal/agent-toolkit/openai");
  return new PayPalAgentToolkit({
    clientId: creds.clientId,
    clientSecret: creds.clientSecret,
    configuration: {
      actions: { transactions: { list: true }, orders: { get: true } },
      context: { sandbox: true },
    },
  }) as unknown as Toolkit;
}
