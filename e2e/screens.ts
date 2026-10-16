import type { Page } from "@playwright/test";
import type { Persona } from "../src/server/demo";
import {
  PAYMENT_ID, PAYMENT_KINDS, VERIFY_ID, stubCircleAlerts, stubCircleReview, stubHighRiskPayment, stubNotChecked, stubPayment, stubScamCheck, stubVerify,
} from "./stubs";

export type Screen = { name: string; as: Persona | null; prepare: (page: Page) => Promise<void> };

const settle = (page: Page) => page.waitForLoadState("networkidle");

/** Every screen of the app, in the state a person can reach. The a11y spec and the final screenshot set share this list. */
export const SCREENS: Screen[] = [
  { name: "landing", as: null, prepare: async (p) => { await p.goto("/"); await settle(p); } },
  {
    name: "landing-other-accounts", as: null,
    prepare: async (p) => { await p.goto("/"); await p.getByText("Other demo accounts").click(); await settle(p); },
  },
  { name: "home", as: "margaret", prepare: async (p) => { await p.goto("/home"); await p.getByTestId("setup-card").waitFor(); } },
  { name: "check-input", as: "margaret", prepare: async (p) => { await p.goto("/check"); await settle(p); } },
  {
    name: "check-scam", as: "margaret",
    prepare: async (p) => {
      await stubScamCheck(p);
      await p.goto("/check");
      await p.getByLabel("The message").fill("Hi Grandma it's me, new number. I need $800 in gift cards today.");
      await p.getByTestId("check-submit").click();
      await p.getByTestId("check-result-scam").waitFor();
    },
  },
  {
    name: "check-not-checked", as: "margaret",
    prepare: async (p) => {
      await stubNotChecked(p);
      await p.goto("/check");
      await p.getByLabel("The message").fill("hi");
      await p.getByTestId("check-submit").click();
      await p.getByTestId("check-result-not_checked").waitFor();
    },
  },
  { name: "send-form", as: "margaret", prepare: async (p) => { await p.goto("/send"); await settle(p); } },
  {
    name: "send-risk-high", as: "margaret",
    prepare: async (p) => {
      await stubHighRiskPayment(p);
      await p.goto("/send");
      await p.getByLabel("Who are you paying?").fill("tc-daniel-2311@personal.example.com");
      await p.getByLabel("How much?").fill("800");
      await p.getByTestId("check").click();
      await p.getByTestId("risk-high").waitFor();
    },
  },
  ...PAYMENT_KINDS.map<Screen>((kind) => ({
    name: `payment-${kind}`, as: "margaret",
    prepare: async (p) => { await stubPayment(p, kind); await p.goto(`/payments/${PAYMENT_ID}`); await p.getByTestId(`payment-screen-${kind}`).waitFor(); },
  })),
  {
    name: "circle", as: "sarah",
    prepare: async (p) => { await stubCircleReview(p); await stubCircleAlerts(p); await p.goto("/circle"); await p.getByText("Margaret").first().waitFor(); await settle(p); },
  },
  {
    name: "circle-review", as: "sarah",
    prepare: async (p) => { await stubCircleReview(p); await p.goto(`/circle/payments/${PAYMENT_ID}`); await settle(p); await p.getByRole("heading").first().waitFor(); },
  },
  {
    name: "circle-closed", as: "sarah",
    prepare: async (p) => { await stubCircleReview(p, { closed: true }); await p.goto(`/circle/payments/${PAYMENT_ID}`); await settle(p); await p.getByRole("heading").first().waitFor(); },
  },
  { name: "circle-dashboard", as: "sarah", prepare: async (p) => { await p.goto("/circle/dashboard"); await p.locator(".ag-root").first().waitFor(); } },
  { name: "trends", as: "sarah", prepare: async (p) => { await p.goto("/trends"); await settle(p); } },
  { name: "verify-ask", as: "daniel", prepare: async (p) => { await stubVerify(p, "ask"); await p.goto(`/verify/${VERIFY_ID}`); await p.getByTestId("not-me").waitFor(); } },
  { name: "verify-not-for-you", as: "daniel", prepare: async (p) => { await stubVerify(p, "not_for_you"); await p.goto(`/verify/${VERIFY_ID}`); await p.getByTestId("not-for-you").waitFor(); } },
  ...(["preset", "circle", "safe_word", "alerts"] as const).map<Screen>((step) => ({
    name: `onboarding-${step}`, as: "margaret",
    prepare: async (p) => { await p.goto(`/onboarding?step=${step}`); await p.getByTestId("onboarding-next").or(p.getByRole("button", { name: "Finish" })).first().waitFor(); await settle(p); },
  })),
  { name: "settings", as: "margaret", prepare: async (p) => { await p.goto("/settings"); await p.getByTestId("cooling-24").waitFor(); } },
];
