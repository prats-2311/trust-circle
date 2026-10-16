export type EmailSender = (m: { to: string; subject: string; text: string }) => Promise<void>;

export function createResendEmailSender(opts: { apiKey: string; from: string; fetchImpl?: typeof fetch; timeoutMs?: number }): EmailSender {
  return async (m) => {
    const res = await (opts.fetchImpl ?? fetch)("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
      headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: opts.from, to: [m.to], subject: m.subject, text: m.text }),
    });
    if (!res.ok) throw new Error(`resend http ${res.status}`);
  };
}
