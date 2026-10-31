import { describe, expect, it } from "vitest";
import { normaliseSpokenEmails } from "./spokenEmails";

describe("normaliseSpokenEmails", () => {
  it.each([
    ["send it to danny dot help at example dot com today", "send it to danny.help@example.com today"],
    ["danny.help at example.com", "danny.help@example.com"],
    ["Danny Dot Help At Example Dot Com.", "danny.help@example.com."],
    ["danny underscore help at gmail dot com", "danny_help@gmail.com"],
    ["danny dash help at example dot co dot uk", "danny-help@example.co.uk"],
  ])("rewrites %j", (input, expected) => {
    expect(normaliseSpokenEmails(input)).toBe(expected);
  });

  it.each([
    "I'll be at home by six",
    "meet me at the station",
    "look at this dot",
    "it's at 5 p.m.",
    "call me at nine dot thirty",
    "email me at gmail dot com",
    "my name at example dot com",
    "write to danny.help@example.com today",
  ])("leaves %j unchanged", (input) => {
    expect(normaliseSpokenEmails(input)).toBe(input);
  });

  it("still rewrites a plain first name as the local part", () => {
    expect(normaliseSpokenEmails("tell Bob at work dot com")).toBe("tell bob@work.com");
  });
});
