export interface ResultsFacts {
  total: number;
  scams: number;
  genuine: number;
  scamsHeld: number;
  genuineHeld: number;
  scamsFlagged: number;
  genuineFlagged: number;
}

const need = (md: string, re: RegExp, what: string): RegExpMatchArray => {
  const m = md.match(re);
  if (!m) throw new Error(`results: could not find ${what}`);
  return m;
};

/** Reads the headline numbers from docs/eval/results.md. */
export function parseResults(md: string): ResultsFacts {
  const line = need(md, /on (\d+) invented cases \((\d+) scams, (\d+) genuine\)/, "the 'on N invented cases (S scams, G genuine)' line");
  const scams = need(md, /\|\s*Scams held\s*\|\s*(\d+) of (\d+)/, "the 'Scams held' row");
  const genuine = need(md, /\|\s*Genuine cases held\s*\|\s*(\d+) of (\d+)/, "the 'Genuine cases held' row");
  const sf = need(md, /\|\s*Scams flagged \(warning or hold\)\s*\|\s*(\d+) of (\d+)/, "the 'Scams flagged' row");
  const gf = need(md, /\|\s*Genuine cases given a warning or hold\s*\|\s*(\d+) of (\d+)/, "the 'Genuine cases given a warning or hold' row");
  return { scamsFlagged: Number(sf[1]), genuineFlagged: Number(gf[1]), total: Number(line[1]), scams: Number(line[2]), genuine: Number(line[3]), scamsHeld: Number(scams[1]), genuineHeld: Number(genuine[1]) };
}

/** Compares the numbers published in the docs with the results file. One problem per mismatch. */
export function checkFacts(results: string, docs: Record<string, string>): string[] {
  const f = parseResults(results);
  const problems: string[] = [];
  for (const [file, text] of Object.entries(docs)) {
    for (const m of text.matchAll(/(\d+) (invented|labelled|hand-written) cases/g)) {
      if (Number(m[1]) !== f.total) problems.push(`${file}: says "${m[0]}" but the results have ${f.total} cases`);
    }
    for (const m of text.matchAll(/(\d+) invented cases \((\d+) scams, (\d+) genuine\)/g)) {
      if (Number(m[2]) !== f.scams || Number(m[3]) !== f.genuine) problems.push(`${file}: says "${m[0]}" but the results have ${f.scams} scams and ${f.genuine} genuine`);
    }
    for (const m of text.matchAll(/\|\s*Scams held\s*\|\s*(\d+) of (\d+)/g)) {
      if (Number(m[1]) !== f.scamsHeld || Number(m[2]) !== f.scams) problems.push(`${file}: says scams held ${m[1]} of ${m[2]} but the results have ${f.scamsHeld} of ${f.scams}`);
    }
    for (const m of text.matchAll(/\|\s*Genuine cases held\s*\|\s*(\d+) of (\d+)/g)) {
      if (Number(m[1]) !== f.genuineHeld || Number(m[2]) !== f.genuine) problems.push(`${file}: says genuine held ${m[1]} of ${m[2]} but the results have ${f.genuineHeld} of ${f.genuine}`);
    }
    for (const m of text.matchAll(/\|\s*Scams flagged \(warning or hold\)\s*\|\s*(\d+) of (\d+)/g)) {
      if (Number(m[1]) !== f.scamsFlagged || Number(m[2]) !== f.scams) problems.push(`${file}: says scams flagged ${m[1]} of ${m[2]} but the results have ${f.scamsFlagged} of ${f.scams}`);
    }
    for (const m of text.matchAll(/\|\s*Genuine cases given a warning or hold\s*\|\s*(\d+) of (\d+)/g)) {
      if (Number(m[1]) !== f.genuineFlagged || Number(m[2]) !== f.genuine) problems.push(`${file}: says genuine flagged ${m[1]} of ${m[2]} but the results have ${f.genuineFlagged} of ${f.genuine}`);
    }
    // Prose form: "1 of 35 genuine" (but not warning counts or the rules-only payment comparison).
    for (const m of text.matchAll(/(\d+) of (\d+) genuine(?! payments| ones| cases got a warning)/g)) {
      if (Number(m[1]) !== f.genuineHeld || Number(m[2]) !== f.genuine) problems.push(`${file}: says "${m[0]}" but the results have ${f.genuineHeld} of ${f.genuine} genuine held`);
    }
  }
  return problems;
}
