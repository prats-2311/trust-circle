import { describe, expect, it, vi } from "vitest";
import { READ_ONLY_TOOLS, createReadOnlyToolRunner } from "./tools";

const names = [...READ_ONLY_TOOLS, "list_disputes", "get_dispute", "get_refund", "create_order", "create_refund", "pay_order", "send_invoice", "cancel_subscription", "accept_dispute_claim", "update_plan"];

const SCOPE = { paymentIds: new Set(["p-mine"]), orderIds: new Set(["ORDER-MINE"]) };
const tx = (customId: string, extra = {}) => ({ transaction_info: { custom_id: customId, transaction_initiation_date: "2026-10-10T00:00:00Z", transaction_amount: { value: "10.00", currency_code: "USD" }, transaction_status: "S", ...extra }, payer_info: { email_address: "other@secret.test", payer_name: { given_name: "Other" } } });

function fakeToolkit(content: unknown = "{}") {
  const handleToolCall = vi.fn(async (c: unknown) => ({ role: "tool", tool_call_id: (c as { id: string }).id, content }));
  return { tk: { getTools: () => names.map((n) => ({ type: "function", function: { name: n } })), handleToolCall }, handleToolCall };
}

describe("read-only tool runner", () => {
  it("exposes exactly the allow-list and nothing that writes", () => {
    const { tk } = fakeToolkit();
    const defs = createReadOnlyToolRunner(tk, SCOPE).definitions as { function: { name: string } }[];
    expect(defs.map((d) => d.function.name).sort()).toEqual([...READ_ONLY_TOOLS].sort());
    for (const w of ["create", "update", "refund", "send", "cancel", "accept", "pay"]) {
      expect(defs.some((d) => d.function.name.includes(`${w}_`) && !READ_ONLY_TOOLS.includes(d.function.name as never))).toBe(false);
    }
  });

  it("refuses every tool outside the allow-list without calling the toolkit", async () => {
    const { tk, handleToolCall } = fakeToolkit();
    const runner = createReadOnlyToolRunner(tk, SCOPE);
    for (const n of names.filter((x) => !READ_ONLY_TOOLS.includes(x as never))) {
      expect(await runner.run(n, "{}")).toEqual({ ok: false, content: '{"error":"tool not allowed"}', refused: true });
    }
    expect(await runner.run("constructor", "{}")).toMatchObject({ ok: false });
    expect(handleToolCall).not.toHaveBeenCalled();
  });

  it("forwards list_transactions but keeps only this sender's rows, reduced to date, amount and status", async () => {
    const { tk, handleToolCall } = fakeToolkit(JSON.stringify({ transaction_details: [tx("p-mine", { transaction_note: "private note" }), tx("p-other")] }));
    const out = await createReadOnlyToolRunner(tk, SCOPE).run("list_transactions", '{"start_date":"a"}');
    expect(handleToolCall).toHaveBeenCalledWith(expect.objectContaining({ function: { name: "list_transactions", arguments: '{"start_date":"a"}' } }));
    expect(out.ok).toBe(true);
    expect(JSON.parse(out.content)).toEqual({ transactions: [{ paymentId: "p-mine", date: "2026-10-10T00:00:00Z", amount: "10.00 USD", status: "S" }] });
    for (const leak of ["other@secret.test", "Other", "private note", "p-other"]) expect(out.content).not.toContain(leak);
  });

  it("truncates the filtered rows, not the string", async () => {
    const scope = { paymentIds: new Set(Array.from({ length: 80 }, (_, i) => `p${i}`)), orderIds: new Set<string>() };
    const { tk } = fakeToolkit(JSON.stringify({ transaction_details: Array.from({ length: 80 }, (_, i) => tx(`p${i}`)) }));
    const out = await createReadOnlyToolRunner(tk, scope).run("list_transactions", "{}");
    expect(JSON.parse(out.content).transactions).toHaveLength(50);
  });

  it("lets get_order run only for this sender's own order and reduces it", async () => {
    const { tk, handleToolCall } = fakeToolkit(JSON.stringify({ id: "ORDER-MINE", status: "COMPLETED", create_time: "t", payer: { email_address: "x@y.z" }, purchase_units: [{ amount: { value: "5.00", currency_code: "USD" } }] }));
    const out = await createReadOnlyToolRunner(tk, SCOPE).run("get_order", '{"id":"ORDER-MINE"}');
    expect(JSON.parse(out.content)).toEqual({ status: "COMPLETED", amount: "5.00 USD", createTime: "t" });
    expect(handleToolCall).toHaveBeenCalledTimes(1);
  });

  it("refuses get_order for a foreign or missing order id without calling the toolkit", async () => {
    const { tk, handleToolCall } = fakeToolkit();
    const runner = createReadOnlyToolRunner(tk, SCOPE);
    for (const args of ['{"id":"ORDER-OTHER"}', "{}", "not json"]) {
      expect(await runner.run("get_order", args)).toEqual({ ok: false, content: '{"error":"tool not allowed"}', refused: true });
    }
    expect(handleToolCall).not.toHaveBeenCalled();
  });

  it("no longer offers disputes or refunds", () => {
    expect([...READ_ONLY_TOOLS]).toEqual(["list_transactions", "get_order"]);
  });

  it("reports a toolkit error as not ok", async () => {
    const { tk } = fakeToolkit('{"error":{"message":"NOT_AUTHORIZED","type":"paypal_error"}}');
    expect((await createReadOnlyToolRunner(tk, SCOPE).run("list_transactions", "{}")).ok).toBe(false);
  });

  it("reports the toolkit's HTTP failure shape as not ok", async () => {
    const { tk } = fakeToolkit('{"ok":false,"status":403,"code":"PAYPAL_API_HTTP_ERROR","message":"Authorization failed"}');
    expect((await createReadOnlyToolRunner(tk, SCOPE).run("list_transactions", "{}")).ok).toBe(false);
  });

  it("reports a thrown toolkit error or malformed arguments as not ok", async () => {
    const tk = { getTools: () => [], handleToolCall: vi.fn(async () => { throw new Error("boom"); }) };
    expect((await createReadOnlyToolRunner(tk, SCOPE).run("get_order", "{}")).ok).toBe(false);
  });
});
