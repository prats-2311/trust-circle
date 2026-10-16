import { describe, expect, it } from "vitest";
import { MESSAGE_SYSTEM_PROMPT } from "./messagePrompts";
import { PAYMENT_SYSTEM_PROMPT } from "./prompts";

describe("remote-access scams in the prompts", () => {
  it("teaches the payment judge the pattern and the flag", () => {
    expect(PAYMENT_SYSTEM_PROMPT).toContain('"remoteAccess"');
    expect(PAYMENT_SYSTEM_PROMPT).toMatch(/remote|AnyDesk|TeamViewer/);
    expect(PAYMENT_SYSTEM_PROMPT).toMatch(/refund/i);
  });
  it("teaches the message judge the pattern", () => {
    expect(MESSAGE_SYSTEM_PROMPT).toMatch(/AnyDesk|TeamViewer/);
  });
});
