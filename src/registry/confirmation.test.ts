import { describe, expect, it } from "vitest";
import { statusFor } from "./confirmation";

describe("statusFor", () => {
  it("stays unconfirmed on one report, or one person reporting twice", () => {
    expect(statusFor([{ reporterId: "a", source: "message_report" }])).toBe("unconfirmed");
    expect(statusFor([{ reporterId: "a", source: "message_report" }, { reporterId: "a", source: "message_report" }])).toBe("unconfirmed");
  });
  it("confirms on reports from two different people", () => {
    expect(statusFor([{ reporterId: "a", source: "message_report" }, { reporterId: "b", source: "message_report" }])).toBe("confirmed");
  });
  it("confirms on a contact's block or the real person saying it wasn't them", () => {
    expect(statusFor([{ reporterId: "a", source: "contact_block" }])).toBe("confirmed");
    expect(statusFor([{ reporterId: "a", source: "real_person_denied" }])).toBe("confirmed");
  });
});
