import { describe, expect, it } from "vitest";
import type { KnownContact } from "@/circle/circleRepo";
import type { Identifier } from "@/domain/types";
import { extractIdentifiers } from "./identifiers";
import { newNumberSignal } from "./newNumber";

const daniel: KnownContact = { contactId: "d", displayName: "Daniel", relationship: "grandson", phone: "+1 (415) 555-0131" };
const sarah: KnownContact = { contactId: "s", displayName: "Sarah", relationship: "daughter", phone: "+1 (415) 555-0135" };
const circle = [daniel, sarah];
const person = (name: string) => ({ kind: "person" as const, name });
const phones = (...values: string[]): Identifier[] => values.map((value) => ({ type: "phone", value }));

describe("newNumberSignal", () => {
  it("keeps the bracket in a bracketed number in the detail", () => {
    const text = "Text me at (415) 555-0199";
    expect(newNumberSignal(person("Daniel"), extractIdentifiers(text), circle, text)?.detail).toBe("It came from (415) 555-0199, not Daniel's number.");
  });
  it("fires for Daniel from a new number", () => {
    expect(newNumberSignal(person("Daniel"), phones("+1 (415) 555-0199"), circle, "new number +1 (415) 555-0199")).toEqual({
      code: "NEW_NUMBER_CLAIMS_CIRCLE",
      detail: "It came from +1 (415) 555-0199, not Daniel's number.",
    });
  });
  it("matches by relationship", () => {
    const s = newNumberSignal(person("your grandson"), phones("+1 (415) 555-0199"), circle, "");
    expect(s?.code).toBe("NEW_NUMBER_CLAIMS_CIRCLE");
    expect(s?.detail).toContain("Daniel");
  });
  it.each(["4155550131", "415-555-0131", "+1 (415) 555-0131"])("same number in another format (%s) does not fire", (n) => {
    expect(newNumberSignal(person("Daniel"), phones(n), circle, "")).toBeNull();
  });
  it("known number plus a new one does not fire", () => {
    expect(newNumberSignal(person("Daniel"), phones("+1 (415) 555-0199", "415-555-0131"), circle, "")).toBeNull();
  });
  it("is null with no phone identifiers", () => {
    expect(newNumberSignal(person("Daniel"), [{ type: "email", value: "a@b.example" }], circle, "")).toBeNull();
    expect(newNumberSignal(person("Daniel"), [], circle, "")).toBeNull();
  });
  it("is null with no requester or an organisation", () => {
    expect(newNumberSignal(null, phones("+1 (415) 555-0199"), circle, "")).toBeNull();
    expect(newNumberSignal({ kind: "organisation", name: "Daniel" } as never, phones("+1 (415) 555-0199"), circle, "")).toBeNull();
  });
  it("is null for an unknown name", () => {
    expect(newNumberSignal(person("Kevin"), phones("+1 (415) 555-0199"), circle, "")).toBeNull();
  });
  it("is null for an ambiguous name", () => {
    const twin: KnownContact = { contactId: "t", displayName: "Tom", relationship: "grandson", phone: "+1 (415) 555-0147" };
    expect(newNumberSignal(person("your grandson"), phones("+1 (415) 555-0199"), [daniel, twin], "")).toBeNull();
  });
  it("is null when the matched member has no phone", () => {
    expect(newNumberSignal(person("Daniel"), phones("+1 (415) 555-0199"), [{ ...daniel, phone: null }, sarah], "")).toBeNull();
  });
  it("names the first non-matching number as written", () => {
    expect(newNumberSignal(person("Daniel"), phones("+1 (415) 555-0131", "(415) 555 0186"), circle, "")).toBeNull();
    expect(newNumberSignal(person("Daniel"), phones("(415) 555 0186", "+44 7700 900123"), circle, "")?.detail).toBe(
      "It came from (415) 555 0186, not Daniel's number.",
    );
  });
  it("shows the number as written in the message text", () => {
    const text = "Gran it's Daniel, text me on +1 (415) 555-0199 now";
    expect(newNumberSignal(person("Daniel"), phones("+14155550199"), circle, text)?.detail).toBe(
      "It came from +1 (415) 555-0199, not Daniel's number.",
    );
  });
});
