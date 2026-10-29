# 2. Payouts and webhook verification use REST

Status: accepted

## Context

We use `@paypal/paypal-server-sdk` 2.5.0 for orders, authorisations, captures, voids and refunds. Its controllers
are OAuth, Orders, Payments, Subscriptions, Transaction Search and Vault (see
`node_modules/@paypal/paypal-server-sdk/dist/esm/types/controllers/`). There is no Payouts controller and no
webhook-verification call.

## Decision

`sendPayout` (`POST /v1/payments/payouts`) and `verifyWebhookSignature`
(`POST /v1/notifications/verify-webhook-signature`) are plain `fetch` calls in the same gateway,
`src/payments/paypalGateway.ts`. They share one cached OAuth token that retries once on a 401, and the same error
type as the SDK calls. The payout's `sender_batch_id` is its deterministic request id, so a retried payout is
recognised as the same batch.

## Consequences

- Everything that talks to PayPal is in one file, whichever transport it uses.
- When the Server SDK gains Payouts or webhook verification, these two methods can move to it without changing
  their callers.
