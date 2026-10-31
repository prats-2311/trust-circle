// Speech-to-text writes an email address as words ("danny dot help at example dot com"), which the
// identifier extractor cannot see. Rewrite those into normal form so a payee named in a voice note
// can be remembered and matched. Anything that is not a plausible address is left alone.
const WORD = "[a-z0-9]+";
const JOIN = "(?:\\s+(?:dot|underscore|dash)\\s+|[._-])";
const DOT = "(?:\\s+dot\\s+|\\.)";
const SPOKEN_EMAIL = new RegExp(
  `(?<![a-z0-9._-])(${WORD}(?:${JOIN}${WORD})*)\\s+at\\s+((?:${WORD}${DOT})+[a-z]{2,24})(?![a-z0-9])`,
  "gi",
);

const SYMBOL: Record<string, string> = { dot: ".", underscore: "_", dash: "-" };

export function normaliseSpokenEmails(text: string): string {
  return text.replace(SPOKEN_EMAIL, (_all, local: string, domain: string) =>
    `${spell(local)}@${spell(domain)}`.toLowerCase(),
  );
}

function spell(part: string): string {
  return part.replace(/\s+(dot|underscore|dash)\s+/gi, (_m, word: string) => SYMBOL[word.toLowerCase()] ?? word);
}
