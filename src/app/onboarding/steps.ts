export const STEPS = ["preset", "circle", "safe_word", "alerts"] as const;
export type Step = (typeof STEPS)[number];

export function isStep(x: unknown): x is Step {
  return typeof x === "string" && (STEPS as readonly string[]).includes(x);
}

/** Where onboarding opens: the first step the person has not finished, or the start if they are revisiting. */
export function firstUnfinished(me: { preset: string | null; onboarded: boolean; safeWordSet: boolean }, visited: Step[]): Step {
  if (me.onboarded) return "preset";
  const done = (s: Step) => visited.includes(s) || (s === "safe_word" && me.safeWordSet);
  return STEPS.find((s) => !done(s)) ?? "alerts";
}

export function stepNumber(s: Step): number {
  return STEPS.indexOf(s) + 1;
}
