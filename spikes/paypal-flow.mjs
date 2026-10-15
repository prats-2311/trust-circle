// Throwaway spike. Usage:
//   node --env-file=.env.local spikes/paypal-flow.mjs create            -> prints orderId + approve link
//   node --env-file=.env.local spikes/paypal-flow.mjs authorize <orderId>
//   node --env-file=.env.local spikes/paypal-flow.mjs capture <authorizationId>
//   node --env-file=.env.local spikes/paypal-flow.mjs void <authorizationId>
//   node --env-file=.env.local spikes/paypal-flow.mjs payout <email> <value>
//   node --env-file=.env.local spikes/paypal-flow.mjs refund <captureId>
const BASE = "https://api-m.sandbox.paypal.com";

async function token() {
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`token ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

async function call(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await token()}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": process.env.REQ_ID || `spike-${Date.now()}`,
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  console.log(res.status, text ? JSON.stringify(JSON.parse(text), null, 2) : "(empty)");
  return text ? JSON.parse(text) : null;
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === "create") {
  const o = await call("POST", "/v2/checkout/orders", {
    intent: "AUTHORIZE",
    purchase_units: [{ reference_id: "spike", amount: { currency_code: "USD", value: "25.00" } }],
  });
  console.log("APPROVE AT:", o.links.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href);
} else if (cmd === "authorize") {
  const o = await call("POST", `/v2/checkout/orders/${a}/authorize`, {});
  console.log("AUTHORIZATION ID:", o.purchase_units[0].payments.authorizations[0].id);
} else if (cmd === "capture") {
  const c = await call("POST", `/v2/payments/authorizations/${a}/capture`, { final_capture: true });
  console.log("CAPTURE ID:", c.id);
} else if (cmd === "void") {
  await call("POST", `/v2/payments/authorizations/${a}/void`);
} else if (cmd === "payout") {
  const p = await call("POST", "/v1/payments/payouts", {
    sender_batch_header: { sender_batch_id: `spike-${Date.now()}`, email_subject: "Trust Circle test payout" },
    items: [{ recipient_type: "EMAIL", receiver: a, amount: { value: b, currency: "USD" }, sender_item_id: "spike-item" }],
  });
  console.log("PAYOUT BATCH:", p.batch_header.payout_batch_id);
} else if (cmd === "refund") {
  await call("POST", `/v2/payments/captures/${a}/refund`, {});
} else {
  console.log("unknown command");
}
