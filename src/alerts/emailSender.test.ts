import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { installMsw, server } from "@/test/msw";
import { createResendEmailSender } from "./emailSender";

installMsw();
const send = createResendEmailSender({ apiKey: "re_test", from: "Trust Circle <alerts@example.com>", timeoutMs: 500 });

describe("resend email sender", () => {
  it("posts the message to Resend", async () => {
    let auth: string | null = null;
    let body: unknown;
    server.use(
      http.post("https://api.resend.com/emails", async ({ request }) => {
        auth = request.headers.get("authorization");
        body = await request.json();
        return HttpResponse.json({ id: "email_1" });
      }),
    );
    await send({ to: "sarah@example.com", subject: "Hello", text: "Body" });
    expect(auth).toBe("Bearer re_test");
    expect(body).toEqual({ from: "Trust Circle <alerts@example.com>", to: ["sarah@example.com"], subject: "Hello", text: "Body" });
  });
  it("throws on a failed send", async () => {
    server.use(http.post("https://api.resend.com/emails", () => HttpResponse.json({}, { status: 422 })));
    await expect(send({ to: "x@example.com", subject: "s", text: "t" })).rejects.toThrow("resend http 422");
  });
});
