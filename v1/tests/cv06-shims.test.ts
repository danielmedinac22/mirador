import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd(); // vitest runs from v1/
const SHIMS: Array<[string, string]> = [
  ['claude', 'SKILL.md'],
  ['codex', 'AGENTS.md'],
  ['gemini', 'GEMINI.md'],
];

async function shimText(agent: string, file: string): Promise<string> {
  return readFile(join(ROOT, 'shims', agent, file), 'utf8');
}

async function tsFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await tsFiles(full)));
    else if (e.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

describe('CV-06 — agnostic shims + engine audit', () => {
  for (const [agent, file] of SHIMS) {
    it(`${agent} shim carries the same packet→brief / refine / invisible-move contract`, async () => {
      const text = (await shimText(agent, file)).toLowerCase();
      // refine + auto-intent on push
      expect(text).toContain('refine');
      expect(text).toContain('mirador push');
      expect(text).toMatch(/auto-?draft|auto-?intent/);
      // handoff framed through your own brain → tabular, next-refinements, no prose
      expect(text).toContain('handoff');
      expect(text).toContain('brain');
      expect(text).toMatch(/next.?refinement/);
      expect(text).toMatch(/no prose|no ai-prose/);
      // moves are invisible
      expect(text).toMatch(/never name it|invisible/);
      // guidance only — no business logic
      expect(text).toMatch(/no business logic|orchestrate/);
    });
  }

  it('the CLI engine makes no LLM API calls (SAD §10 / design §13)', async () => {
    const forbidden =
      /from ['"](@anthropic-ai\/sdk|anthropic|openai)['"]|api\.(anthropic|openai)\.com/;
    const offenders: string[] = [];
    for (const f of await tsFiles(join(ROOT, 'src'))) {
      if (f.endsWith('.test.ts')) continue;
      if (forbidden.test(await readFile(f, 'utf8'))) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });
});
