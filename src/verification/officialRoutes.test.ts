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
  it("puts disconnecting first when someone was connected to the sender's device", () => {
    const r = officialRouteFor("Chase bank fraud team", { remoteAccess: true });
    expect(r.steps[0]).toContain("switch off");
    expect(r.steps.join(" ")).toContain("back of your bank card");
    // The route's own caution stays last, where the screen shows it as the warning.
    expect(r.steps.at(-1)).toContain("safe account");
  });
  it("leaves the steps unchanged without remote access", () => {
    expect(officialRouteFor("Chase bank").steps).toEqual(officialRouteFor("Chase bank", { remoteAccess: false }).steps);
    expect(officialRouteFor("Chase bank").steps.join(" ")).not.toContain("switch off");
  });
});
