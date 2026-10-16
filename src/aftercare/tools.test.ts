import { describe, expect, it, vi } from "vitest";
import { READ_ONLY_TOOLS, createReadOnlyToolRunner } from "./tools";

const names = [...READ_ONLY_TOOLS, "create_order", "create_refund", "pay_order", "send_invoice", "cancel_subscription", "accept_dispute_claim", "update_plan"];

function fakeToolkit(content: unknown = "{}") {
  const handleToolCall = vi.fn(async (c: unknown) => ({ role: "tool", tool_call_id: (c as { id: string }).id, content }));
  return { tk: { getTools: () => names.map((n) => ({ type: "function", function: { name: n } })), handleToolCall }, handleToolCall };
}

describe("read-only tool runner", () => {
  it("exposes exactly the allow-list and nothing that writes", () => {
    const { tk } = fakeToolkit();
    const defs = createReadOnlyToolRunner(tk).definitions as { function: { name: string } }[];
    expect(defs.map((d) => d.function.name).sort()).toEqual([...READ_ONLY_TOOLS].sort());
    for (const w of ["create", "update", "refund", "send", "cancel", "accept", "pay"]) {
      expect(defs.some((d) => d.function.name.includes(`${w}_`) && !READ_ONLY_TOOLS.includes(d.function.name as never))).toBe(false);
    }
  });

  it("refuses every tool outside the allow-list without calling the toolkit", async () => {
    const { tk, handleToolCall } = fakeToolkit();
    const runner = createReadOnlyToolRunner(tk);
    for (const n of names.filter((x) => !READ_ONLY_TOOLS.includes(x as never))) {
      expect(await runner.run(n, "{}")).toEqual({ ok: false, content: '{"error":"tool not allowed"}' });
    }
    expect(await runner.run("constructor", "{}")).toMatchObject({ ok: false });
    expect(handleToolCall).not.toHaveBeenCalled();
  });

  it("forwards an allowed tool to the toolkit", async () => {
    const { tk, handleToolCall } = fakeToolkit('{"transaction_details":[]}');
    const out = await createReadOnlyToolRunner(tk).run("list_transactions", '{"start_date":"a"}');
    expect(out).toEqual({ ok: true, content: '{"transaction_details":[]}' });
    expect(handleToolCall).toHaveBeenCalledWith(expect.objectContaining({ type: "function", function: { name: "list_transactions", arguments: '{"start_date":"a"}' } }));
  });

  it("reports a toolkit error as not ok", async () => {
    const { tk } = fakeToolkit('{"error":{"message":"NOT_AUTHORIZED","type":"paypal_error"}}');
    expect((await createReadOnlyToolRunner(tk).run("list_transactions", "{}")).ok).toBe(false);
  });

  it("reports the toolkit's HTTP failure shape as not ok", async () => {
    const { tk } = fakeToolkit('{"ok":false,"status":403,"code":"PAYPAL_API_HTTP_ERROR","message":"Authorization failed"}');
    expect((await createReadOnlyToolRunner(tk).run("list_transactions", "{}")).ok).toBe(false);
  });

  it("reports a thrown toolkit error or malformed arguments as not ok", async () => {
    const tk = { getTools: () => [], handleToolCall: vi.fn(async () => { throw new Error("boom"); }) };
    expect((await createReadOnlyToolRunner(tk).run("get_order", "{}")).ok).toBe(false);
  });

  it("caps very long results so the model prompt stays small", async () => {
    const { tk } = fakeToolkit(JSON.stringify({ x: "a".repeat(50_000) }));
    const out = await createReadOnlyToolRunner(tk).run("list_transactions", "{}");
    expect(out.content.length).toBeLessThanOrEqual(8_100);
  });
});
