# 3. The AI can raise the risk, never lower it

Status: accepted

## Context

The AI reads what the sender wrote ("my grandson needs bail") and is what catches scams the rules can't see. But
a model can be wrong, can be talked round by text inside a scam message, and can be unavailable.

## Decision

`decide()` in `src/risk/decide.ts` combines the two:

- Code rules (`src/risk/signals.ts`) set a floor: a confirmed scam payee, a linked scam message or hidden
  instructions are high; several contributing signals are medium or high.
- The final level is the higher of the rule level and the AI's level. The AI can only raise it.
- When the AI fails or times out, any rule signal at all holds the payment ("fail closed"), and a message is shown
  as unchecked, never as safe.
- A claimed company connected to the sender's device (the remote-access scam) always holds.

## Consequences

- A prompt injection can't talk a payment below the rules' floor.
- The AI can't reduce false alarms from the rules, only add catches. The README's accuracy section reports this
  honestly, with a rules-only comparison (`src/eval/rulesOnly.ts`).
- With the AI down, a scam to a payee already paid, for an everyday amount, has no rule signal and goes through.
  This is documented and tested (`src/eval/eval.test.ts`, case h02).
