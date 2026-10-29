# 4. The aftercare agent is read-only

Status: accepted

## Context

After a scam, a circle member wants to know what else went out. The PayPal Agent Toolkit can answer from PayPal's
own records, but it also offers tools that create orders, invoices and refunds. An agent reading attacker-written
text must never be able to move money.

## Decision

`src/aftercare/tools.ts` narrows the toolkit three ways:

- it is built with only the `transactions.list` and `orders.get` actions, pinned to the sandbox;
- a runner offers and runs only `READ_ONLY_TOOLS` (`list_transactions`, `get_order`); any other tool name gets
  `{"error":"tool not allowed"}`;
- results are cut down to this sender's own payments (matched by `custom_id`) before the model sees them.

The toolkit keeps its access token forever, so it is rebuilt every hour and after any 401.

## Consequences

- The agent can explain and draft, but every action (a dispute, a report) is a draft the person sends themselves.
- PayPal's transaction search lags by up to a few hours, so the agent falls back to Trust Circle's own records
  and says so.
