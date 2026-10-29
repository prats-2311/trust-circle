# 1. The hold is a PayPal authorisation

Status: accepted

## Context

A risky payment must wait for the circle without the money moving, and the sender must see that it hasn't left
their account. We could hold it in our own database and only start the PayPal payment after approval, or start it
in PayPal and stop it before the money is taken.

## Decision

Every payment is created as an Orders v2 order with `intent: AUTHORIZE` (`src/payments/paypalGateway.ts`). After
the sender approves in PayPal, the order is authorised. A low or medium risk payment is captured and paid out at
once. A high-risk payment stays authorised while the circle decides:

- "It wasn't me" or a block voids the authorisation (`POST /v2/payments/authorizations/{id}/void`);
- an approval captures it (`.../capture`) and pays out;
- nobody deciding within 72 hours voids it (`AUTO_VOID_MS` in `src/payments/paymentService.ts`).

Each decision is claimed in the database (a state-machine transition with a version check) before PayPal is
called, and every money call carries a deterministic `PayPal-Request-Id`, so retries and the sweep never move money
twice.

## Consequences

- The sender approves once, in PayPal's own window, before anyone else is asked. The circle never sees the
  sender's PayPal login.
- The stop is a real PayPal state. The void asks PayPal to return the authorisation
  (`Prefer: return=representation`), and the stopped screen shows "PayPal confirmed it" only when PayPal's reply
  says `VOIDED`.
- A hold can't outlive the 72-hour limit we set, so long holds need a new payment.
