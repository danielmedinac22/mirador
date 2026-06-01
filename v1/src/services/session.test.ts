import { mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createArtifact } from './artifact.js';
import { openSession } from './session.js';

describe('services/session', () => {
  let tmp: string;
  const original = process.env.MIRADOR_HOME_OVERRIDE;
  const originalAgent = process.env.MIRADOR_AGENT;
  const originalProject = process.env.MIRADOR_PROJECT_OVERRIDE;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'mirador-session-'));
    process.env.MIRADOR_HOME_OVERRIDE = tmp;
    // Pin brain resolution to an empty generic source so the brief is
    // deterministic regardless of the machine's real agent memory.
    process.env.MIRADOR_AGENT = 'generic';
    process.env.MIRADOR_PROJECT_OVERRIDE = tmp;
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
    process.env.MIRADOR_HOME_OVERRIDE = original;
    process.env.MIRADOR_AGENT = originalAgent;
    process.env.MIRADOR_PROJECT_OVERRIDE = originalProject;
  });

  it('fresh artifact brief reads "newly created"', async () => {
    await createArtifact({ slug: 'fresh' });
    const { brief } = await openSession('fresh');
    expect(brief).toContain('newly created');
    expect(brief).toContain('starting point');
    expect(brief).toContain('Next:');
  });

  it('subsequent open with no further changes says "no changes"', async () => {
    await createArtifact({ slug: 'q' });
    await openSession('q'); // first open sets last-seen
    // Make sure the source.md mtime is older than the just-written last-seen
    const ctxFile = join(tmp, 'workspace', 'artifacts', 'q', 'source.md');
    const old = new Date(Date.now() - 60_000);
    await utimes(ctxFile, old, old);
    const { brief } = await openSession('q');
    expect(brief).toContain('last opened by you');
    expect(brief).toContain('no changes');
  });

  it('shows changes table when files were modified after last open', async () => {
    await createArtifact({ slug: 'q2' });
    await openSession('q2'); // first open sets last-seen now
    // Write a new file with current mtime (after last-seen)
    const newFile = join(tmp, 'workspace', 'artifacts', 'q2', 'notes.md');
    await writeFile(newFile, 'hello');
    const { brief } = await openSession('q2');
    expect(brief).toContain('CHANGES SINCE YOU');
    expect(brief).toContain('notes.md');
  });

  it('writes a session skill to disk and returns its path', async () => {
    await createArtifact({ slug: 'skilled' });
    const { sessionSkillPath } = await openSession('skilled');
    expect(sessionSkillPath).toContain('session-skills');
    const { readFile } = await import('node:fs/promises');
    const content = await readFile(join(sessionSkillPath, 'SKILL.md'), 'utf8');
    expect(content).toContain('mirador-session-skilled');
    // The session skill now instructs brain-framing of the handoff, not verbatim.
    expect(content).toMatch(/one-screen brief|frame the handoff/i);
  });

  it('updates last-seen after open', async () => {
    await createArtifact({ slug: 'tracked' });
    await openSession('tracked');
    const { readFile } = await import('node:fs/promises');
    const ls = JSON.parse(await readFile(join(tmp, 'last-seen.json'), 'utf8'));
    expect(ls.tracked).toBeDefined();
    expect(ls.tracked.last_open_at).toBeTypeOf('string');
  });
});
