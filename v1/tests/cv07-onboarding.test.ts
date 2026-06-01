import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderLanding } from '../src/services/landingPage.js';
import { composeSeed, parseSeed } from '../src/services/promptSeed.js';

const ROOT = process.cwd();
const SHIMS: Array<[string, string]> = [
  ['claude', 'SKILL.md'],
  ['codex', 'AGENTS.md'],
  ['gemini', 'GEMINI.md'],
];

describe('CV-07 — agent-mediated onboarding + tiered ladder', () => {
  it('the invitation seed onboards to refine (install → clone → open) and round-trips', () => {
    const seed = composeSeed({
      kind: 'invitation',
      from: 'daniel <d@x>',
      artifact: 'q3-strategy',
      repo: 'https://github.com/x/q3-strategy',
      roleExpected: 'reviewer',
      note: 'scope eye before Friday',
      sent: '2026-06-01T00:00:00Z',
      preview: 'https://x.vercel.app/d/q3-strategy/',
    });
    expect(seed).toContain('npm i -g mirador-cli');
    expect(seed).toContain('git clone https://github.com/x/q3-strategy');
    expect(seed).toContain('mirador open q3-strategy');
    expect(seed).toMatch(/T0 read/);
    expect(seed).toMatch(/T1 comment/);
    expect(seed).toMatch(/T2 refine/);

    const parsed = parseSeed(seed);
    expect(parsed.kind).toBe('invitation');
    if (parsed.kind === 'invitation') {
      expect(parsed.repo).toBe('https://github.com/x/q3-strategy');
      expect(parsed.preview).toBe('https://x.vercel.app/d/q3-strategy/'); // Read-only now round-trips
      expect(parsed.roleExpected).toBe('reviewer');
      expect(parsed.note).toBe('scope eye before Friday');
    }
  });

  it('a T1 comment is a paste-back @mirador-response that round-trips', () => {
    const seed = composeSeed({
      kind: 'response',
      from: 'maria <m@x>',
      to: '(owner)',
      reRequest: 'q3-strategy',
      status: 'commented',
      note: 'The NRR claim needs a source.',
      sent: '2026-06-01T00:00:00Z',
    });
    const parsed = parseSeed(seed);
    expect(parsed.kind).toBe('response');
    if (parsed.kind === 'response') {
      expect(parsed.status).toBe('commented');
      expect(parsed.note).toBe('The NRR claim needs a source.');
    }
  });

  it('the landing renders the T0 / T1 / T2 ladder (design §14)', () => {
    const html = renderLanding({
      kind: 'invitation',
      slug: 'q3-strategy',
      from: 'daniel',
      role: 'reviewer',
      seedText: '@mirador-invitation\nFrom: daniel\nArtifact: q3-strategy',
      previewUrl: 'https://x.vercel.app/d/q3-strategy/',
    });
    expect(html).toContain('T0 · Read');
    expect(html).toContain('T1 · Comment');
    expect(html).toContain('T2 · Refine');
    expect(html).toContain('@mirador-response');
    expect(html).toContain('read it ↗'); // T0 read link present
  });

  it('every shim instructs the onboarding flow + onward share (growth loop)', async () => {
    for (const [agent, file] of SHIMS) {
      const text = await readFile(join(ROOT, 'shims', agent, file), 'utf8');
      expect(text).toContain('npm i -g mirador-cli');
      expect(text).toContain('git clone');
      expect(text).toContain('mirador share'); // can share onward → convergence is distribution
    }
  });
});
