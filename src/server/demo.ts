// The seeded demo accounts. Logging in picks one by name; ids never reach the browser.
export const DEMO_PERSONAS = {
  margaret: "margaret.demo@trustcircle.example",
  sarah: "sarah.demo@trustcircle.example",
  daniel: "daniel.demo@trustcircle.example",
  robert: "robert.demo@trustcircle.example",
  priya: "priya.demo@trustcircle.example",
  tom: "tom.demo@trustcircle.example",
} as const;

export type Persona = keyof typeof DEMO_PERSONAS;

// Invented 555 numbers. Daniel's is the one the new-number check compares against.
export const DEMO_PHONES: Partial<Record<Persona, string>> = {
  daniel: "+1 (415) 555-0131",
  sarah: "+1 (415) 555-0135",
  tom: "+1 (415) 555-0147",
};

export function isPersona(x: unknown): x is Persona {
  return typeof x === "string" && Object.hasOwn(DEMO_PERSONAS, x);
}

export function homeFor(p: Persona): string {
  return p === "margaret" || p === "robert" || p === "priya" ? "/home" : "/circle";
}

export function personaForEmail(email: string): Persona | null {
  const hit = (Object.entries(DEMO_PERSONAS) as [Persona, string][]).find(([, e]) => e === email.toLowerCase());
  return hit ? hit[0] : null;
}
