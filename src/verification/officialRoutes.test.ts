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
  it.each(["PayPal support", "Chase bank fraud team", "IRS", "Microsoft technician", "Acme Utilities"])(
    "for %s, puts ending the connection first, keeps the caution last and never repeats 'hang up'",
    (name) => {
      const plain = officialRouteFor(name).steps;
      const remote = officialRouteFor(name, { remoteAccess: true }).steps;
      expect(remote[0]).toContain("close the remote app");
      expect(remote.at(-1)).toBe(plain.at(-1));
      expect(remote.join(" ").match(/hang up/gi)).toHaveLength(1);
      // The sender is often reading this on their phone: never tell them to switch the phone off.
      expect(remote.join(" ")).not.toMatch(/switch off the (computer or )?phone/i);
    },
  );
  it("turns the bank's 'hang up and call' into 'call', since the first step already hangs up", () => {
    expect(officialRouteFor("Chase bank", { remoteAccess: true }).steps).toContain("Call the number on the back of your bank card.");
  });
  it("leaves the steps unchanged without remote access", () => {
    expect(officialRouteFor("Chase bank").steps).toEqual(officialRouteFor("Chase bank", { remoteAccess: false }).steps);
    expect(officialRouteFor("Chase bank").steps.join(" ")).not.toContain("remote app");
  });
});
