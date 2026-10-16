/** Everything the aftercare agent may call. Reading only: this list is the whole of its authority. */
export const READ_ONLY_TOOLS = ["list_transactions", "get_order", "list_disputes", "get_dispute", "get_refund"] as const;
export type ReadOnlyTool = (typeof READ_ONLY_TOOLS)[number];

export interface ToolRunner {
  definitions: unknown[];
  run(name: string, argsJson: string): Promise<{ ok: boolean; content: string }>;
}

interface Toolkit {
  getTools(): { function: { name: string } }[];
  handleToolCall(c: unknown): Promise<{ content: unknown }>;
}

const MAX_RESULT_CHARS = 8_000;
const REFUSED = '{"error":"tool not allowed"}';

function isAllowed(name: string): name is ReadOnlyTool {
  return (READ_ONLY_TOOLS as readonly string[]).includes(name);
}

/** Wraps a toolkit so only the allow-list is offered and only the allow-list can run. Refused names never reach `tk`. */
export function createReadOnlyToolRunner(tk: Toolkit): ToolRunner {
  return {
    definitions: tk.getTools().filter((t) => isAllowed(t.function.name)),
    async run(name, argsJson) {
      if (!isAllowed(name)) return { ok: false, content: REFUSED };
      try {
        const res = await tk.handleToolCall({ id: "aftercare", type: "function", function: { name, arguments: argsJson } });
        const text = typeof res.content === "string" ? res.content : JSON.stringify(res.content);
        let failed = false;
        try {
          const parsed: unknown = JSON.parse(text);
          // The toolkit reports failures as {"error":…} or, for HTTP errors, {"ok":false,"status":…}.
          failed = typeof parsed === "object" && parsed !== null && ("error" in parsed || (parsed as { ok?: unknown }).ok === false);
        } catch {
          failed = false;
        }
        return { ok: !failed, content: text.slice(0, MAX_RESULT_CHARS) };
      } catch {
        return { ok: false, content: '{"error":"tool failed"}' };
      }
    },
  };
}

/** The real toolkit, narrowed to the read actions and pinned to the PayPal sandbox. Loaded on first use. */
export async function createPayPalReadOnlyToolkit(creds: { clientId: string; clientSecret: string }): Promise<Toolkit> {
  const { PayPalAgentToolkit } = await import("@paypal/agent-toolkit/openai");
  return new PayPalAgentToolkit({
    clientId: creds.clientId,
    clientSecret: creds.clientSecret,
    configuration: {
      actions: { transactions: { list: true }, orders: { get: true }, disputes: { list: true, get: true }, payments: { getRefunds: true } },
      context: { sandbox: true },
    },
  }) as unknown as Toolkit;
}
