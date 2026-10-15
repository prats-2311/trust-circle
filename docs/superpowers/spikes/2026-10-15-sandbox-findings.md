# Sandbox findings (2026-10-15)

## PayPal items (Phase B complete except B and C)
| # | Item | Result | Evidence |
|---|------|--------|----------|
| 1 | AUTHORIZE order created and authorised | PASS | Order A `3RH40508YJ349844A`: create 201 CREATED; after v6 approval GET status APPROVED; authorize 201, status COMPLETED, authorization ID `7U6089188T211500U` (status CREATED, funds held). |
| 2 | Capture | PASS | POST /v2/payments/authorizations/7U6089188T211500U/capture -> 201, status COMPLETED, capture ID `3GC193730H6495825`. |
| 3 | Void | PENDING | Order B `7LU819614A957884M` still status CREATED (not approved) when checked; needs approval at https://www.sandbox.paypal.com/checkoutnow?token=7LU819614A957884M |
| 4 | Payout to grandson, 20.00 USD | PASS | 201, batch `5RADDASE4E8X2`; GET shows batch SUCCESS, item `7RB2E93KJVSEE` SUCCESS. |
| 5 | Refund | PARTIAL PASS | Order C `5KN79126GE1885146` still CREATED (not approved), needs approval at https://www.sandbox.paypal.com/checkoutnow?token=5KN79126GE1885146. Refund API itself verified on order A capture instead: POST .../captures/3GC193730H6495825/refund with amount 5.00 -> 201 COMPLETED, refund ID `6AR36609346986746`; capture became PARTIALLY_REFUNDED. Full refund (empty body) of C still PENDING. |
| 6 | JS SDK v6 approval | PASS | User approved order A via approve.html. Log: `APPROVED {"orderId":"3RH40508YJ349844A","payerId":"BBJXY7NXURQT8","fundingSource":"paypal"}`. onApprove data shape `{orderId, payerId, fundingSource}`. Approval page showed "Ship to Margaret Hill", merchant name "Test Store", button "Complete Purchase". Working snippet = spikes/approve.html verbatim (below). |
| 9 | Idempotency | PASS | Two refund calls with the SAME PayPal-Request-Id: first 201 refund `6AR36609346986746`, second 200 returning the same refund ID, no second refund created (capture refunded once). The script uses a fresh Request-Id per call by default; `REQ_ID` env var now overrides it. |

Working v6 snippet (verbatim):
```html
<paypal-button id="pp" type="pay" hidden></paypal-button>
<pre id="log"></pre>
<script src="https://www.sandbox.paypal.com/web-sdk/v6/core"></script>
<script>
  const qs = new URLSearchParams(location.search);
  const log = (m) => (document.getElementById("log").textContent += m + "\n");
  (async () => {
    const sdk = await window.paypal.createInstance({
      clientId: qs.get("clientId"),
      components: ["paypal-payments"],
      pageType: "checkout",
    });
    const methods = await sdk.findEligibleMethods({ currencyCode: "USD" });
    if (!methods.isEligible("paypal")) return log("paypal not eligible");
    const session = sdk.createPayPalOneTimePaymentSession({
      onApprove: (data) => log("APPROVED " + JSON.stringify(data)),
      onCancel: () => log("CANCELLED"),
      onError: (e) => log("ERROR " + e),
    });
    const btn = document.getElementById("pp");
    btn.hidden = false;
    btn.addEventListener("click", () =>
      session.start({ presentationMode: "auto" }, Promise.resolve({ orderId: qs.get("orderId") })),
    );
  })();
</script>
```

Serving: `npx serve -l 5175 spikes`. Default clean-URL redirect (301 /approve.html -> /approve) DROPS the query string; fixed with `spikes/serve.json` = `{"cleanUrls": false}`, after which approve.html loads with 200.

## 7. Agent Toolkit (@paypal/agent-toolkit 1.11.0)
Package exports are ./ai-sdk, ./mcp, ./langchain, ./openai, ./bedrock (no ./shared; used npm pack). Tool method names (from dist):
accept_dispute_claim, activate_recurring_series, cancel_invoice_auto_reminder, cancel_recurring_series, cancel_sent_invoice, cancel_subscription, create_conditional_rules_for_invoice, create_invoice, create_order, create_product, create_recurring_series, create_refund, create_shipment_tracking, create_subscription, create_subscription_plan, delete_invoice, delete_recurring_series, generate_invoice_number, generate_invoice_qr_code, get_dispute, get_invoice, get_merchant_insights, get_order, get_recurring_series, get_refund, get_shipment_tracking, list_disputes, list_invoices, list_products, list_subscription_plans, list_transactions, pay_order, record_payment_for_invoice, record_refund_for_invoice, search_invoicing, send_invoice, send_invoice_reminder, setup_invoice_auto_reminders, show_product_details, show_subscription_details, show_subscription_plan_details, update_invoice_auto_reminder, update_invoicing, update_plan, update_product, update_subscription.
Key point: NO tool for authorize, capture, void or payouts. create_order / pay_order / create_refund exist. Authorize/capture/void/payout must go through direct REST calls.

## 8. Groq
Test image: spikes/scam-sms.png (legible, rendered via qlmanage; has white strip below the bubble, harmless).
Rate limits (headers): text/vision models 500000 req, 250000 tokens limit; prompt-guard 50000 req, 30000 tokens.

| Model | Status | Latency | Result |
|---|---|---|---|
| openai/gpt-oss-120b (text, JSON mode) | 400 json_validate_failed, 4/4 attempts | 0.5-1.0s | Model refuses ("I can't help with that") so JSON mode fails. NOT usable with this prompt as-is. |
| openai/gpt-oss-20b | 200 | 394ms | Valid JSON, level high; reason is odd ("facilitate illegal activity"), i.e. it misreads the task. |
| qwen/qwen3.8-27b (text) | 200 | 275ms | Valid JSON, level high, three accurate reasons. |
| qwen/qwen3.8-27b (vision) | 200 | 578ms | Read image text exactly, level high, good reasons. |
| qwen/qwen3.6-27b (vision) | 200 | 821ms | Read image text exactly (omitted phone number), level high. |
| meta-llama/llama-prompt-guard-2-86m | 200 | ~144ms | Returns a bare float string as content. Injection text 0.9995; plain scam text 0.0004. Clear separation. |

Choice: text model `qwen/qwen3.8-27b`; vision model `qwen/qwen3.8-27b`. gpt-oss-120b rejected (refuses and fails JSON mode); gpt-oss-20b works but gives weak reasoning. Prompt guard: `meta-llama/llama-prompt-guard-2-86m`, threshold on float. Speech `whisper-large-v3-turbo` untested (Plan 2).
