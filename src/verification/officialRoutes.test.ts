import { describe, expect, it } from "vitest";
import { officialRouteFor } from "./officialRoutes";

describe("officialRouteFor", () => {
  it("sends PayPal impersonation to the real PayPal", () => {
    const r = officialRouteFor("PayPal support");
    expect(r.organisation).toBe("PayPal support");
    expect(r.steps.join(" ")).toContain("paypal.com");
  });
  it.each([
    ["Chase bank fraud team", "back of your bank card"],
    ["IRS", ".gov"],
    ["County Sheriff", ".gov"],
    ["Microsoft technician", "official website or app"],
    ["Acme Utilities", "official contact details yourself"],
  ])("gives %s an official route", (name, phrase) => {
    expect(officialRouteFor(name).steps.join(" ")).toContain(phrase);
  });
});
