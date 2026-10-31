import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test("a grandson text is flagged, explained and can be reported", async ({ page }) => {
  await signInAs(page, "margaret");
  await page.goto("/check");
  await page.getByLabel("The message").fill(
    "Hi Grandma it's me, I lost my phone so this is my new number. I need $800 in gift cards today. Please don't tell mom. Text me at +1 (415) 555-0199",
  );
  await page.getByTestId("check-submit").click();
  await expect(page.getByTestId("check-result-scam")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "What gave it away" })).toBeVisible();
  await page.route("mailto:*", (route) => route.abort());
  await page.getByTestId("report").click();
  await expect(page.getByText(/shared scam list/)).toBeVisible();
});

test("an unchecked result is never shown as safe", async ({ page }) => {
  await signInAs(page, "margaret");
  await page.route("**/api/messages/check", (route) =>
    route.fulfill({
      json: { id: "x", source: "text", text: "hi", checked: false, level: null, scamType: "unknown", reasons: [], identifiers: [], impersonatedRequester: null, createdAt: new Date().toISOString() },
    }),
  );
  await page.goto("/check");
  await page.getByLabel("The message").fill("hi");
  await page.getByTestId("check-submit").click();
  await expect(page.getByTestId("check-result-not_checked")).toBeVisible();
  await expect(page.getByText("That isn't the same as safe.", { exact: false })).toBeVisible();
});

test("a voice note shows its transcript and the voice line", async ({ page }) => {
  await signInAs(page, "margaret");
  let body = "";
  await page.route("**/api/messages/check", (route) => {
    body = route.request().postDataBuffer()?.toString("latin1") ?? "";
    return route.fulfill({
      json: {
        id: "v", source: "voice", text: "Gran, it's Daniel. I lost my phone, please buy gift cards.", checked: true, level: "high", scamType: "impersonation_family",
        reasons: ["Asks for gift cards."], identifiers: [], impersonatedRequester: { kind: "person", name: "Daniel" }, createdAt: new Date().toISOString(),
      },
    });
  });
  await page.goto("/check");
  await page.getByTestId("check-file").setInputFiles({ name: "note.opus", mimeType: "", buffer: Buffer.from("OggS\0\0\0\0voice") });
  await expect(page.getByText("Remove voice note")).toBeVisible();
  await page.getByTestId("check-submit").click();
  await expect(page.getByText("What the voice note says")).toBeVisible();
  await expect(page.getByText("I lost my phone, please buy gift cards.", { exact: false })).toBeVisible();
  await expect(page.getByText("A voice that sounds like Daniel isn't proof.", { exact: false })).toBeVisible();
  expect(body).toContain('name="audio"');
});
