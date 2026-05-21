import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureDir, writeFileAtomic } from '../src/adapters/fs.js';
import { createArtifact } from '../src/services/artifact.js';
import { scaffoldBrain } from '../src/services/brain.js';
import { computeInbox, renderInbox } from '../src/services/inbox.js';
import { parseSeed } from '../src/services/promptSeed.js';
import { acceptRequest, createRequest } from '../src/services/request.js';
import { openSession } from '../src/services/session.js';
import { shareArtifact, unshareArtifact } from '../src/services/share.js';
import { writeConfig } from '../src/shared/config.js';

/**
 * End-to-end Mirador v1 smoke.
 *
 * Walks the canonical demo:
 *   1. Initialise a workspace (programmatic, not via `mirador init`).
 *   2. Seed a brain.
 *   3. `new` an artifact, open it, modify it, open again.
 *   4. `share` it (offline mode — no GitHub or Vercel calls).
 *   5. Parse the produced @mirador-invitation and confirm round-trip.
 *   6. `request` an artifact, parse the seed, accept it, accept produces a new
 *      artifact + a @mirador-response seed.
 *   7. `inbox` aggregates pending requests + workspace artifacts and ranks them.
 *   8. Privacy assertion: no brain file path appears in any share / landing /
 *      preview artefact.
 */
describe('Mirador v1 — end-to-end', () => {
  let tmp: string;

  beforeAll(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'mirador-e2e-'));
    process.env.MIRADOR_HOME_OVERRIDE = tmp;
    process.env.CLAUDE_HOME_OVERRIDE = join(tmp, 'claude');
    process.env.CODEX_HOME_OVERRIDE = join(tmp, 'codex');

    // 1. Stand up a workspace as if `init` had run.
    const workspace = join(tmp, 'workspace');
    await ensureDir(join(workspace, 'artifacts'));
    await ensureDir(join(workspace, 'brain'));
    await ensureDir(join(workspace, 'incoming-requests'));
    await ensureDir(join(workspace, 'outgoing-requests'));
    await ensureDir(join(workspace, 'logs'));

    await writeConfig({
      version: 1,
      github: {
        handle: 'danielm',
        workspaceRepo: 'danielm/danielm-mirador',
        sharedReposNamespace: 'personal',
      },
      vercel: { project: 'mirador-danielm', domain: 'mirador-danielm.vercel.app' },
      brain: { location: 'workspace' },
      defaults: { theme: 'default', passwordPolicy: 'always-ask', visibility: 'unlisted' },
      docs: [],
    });

    // 2. Seed a brain (the role-reviewer section is what drives the brain flag later).
    await scaffoldBrain({
      role: 'Product Engineering Manager',
      reviewFocus: 'scope and timelines first',
      authorAudience: 'the board',
      domain: 'fintech LatAm',
      preferences: 'tables not prose',
    });
  });

  afterAll(async () => {
    await rm(tmp, { recursive: true, force: true });
    delete process.env.MIRADOR_HOME_OVERRIDE;
    delete process.env.CLAUDE_HOME_OVERRIDE;
    delete process.env.CODEX_HOME_OVERRIDE;
  });

  it('runs the full demo flow', async () => {
    // 3. new + open + edit + open
    await createArtifact({ slug: 'q2-draft', purpose: 'Q2 forecast', audience: 'board' });
    const firstOpen = await openSession('q2-draft');
    expect(firstOpen.brief).toContain('newly created');

    // Modify a file and re-open
    await writeFile(
      join(tmp, 'workspace', 'artifacts', 'q2-draft', 'notes.md'),
      'risk: BBVA migration',
    );
    const secondOpen = await openSession('q2-draft');
    expect(secondOpen.brief).toContain('CHANGES SINCE YOU');
    expect(secondOpen.brief).toContain('notes.md');

    // 4. Share (offline)
    const shareResult = await shareArtifact({
      slug: 'q2-draft',
      withEmails: ['alice@simetrik.com'],
      role: 'reviewer',
      note: 'Need your scope eye before Friday.',
      offline: true,
    });
    expect(shareResult.invitationSeed).toContain('@mirador-invitation');
    expect(shareResult.invitationSeed).toContain('Role expected: reviewer');
    expect(shareResult.invitationSeed).toContain('Need your scope eye');

    // 5. Parse → round-trip
    const seed = parseSeed(shareResult.invitationSeed);
    expect(seed.kind).toBe('invitation');
    if (seed.kind === 'invitation') {
      expect(seed.artifact).toBe('q2-draft');
      expect(seed.roleExpected).toBe('reviewer');
      expect(seed.note).toBe('Need your scope eye before Friday.');
    }

    // 6. Open the shared artifact — for the owner this resolves to role=author
    //    and pulls the author brain flag. (Multi-user role flip happens when a
    //    collaborator on a different machine opens it; covered by manual smoke.)
    const sharedOpen = await openSession('q2-draft');
    expect(sharedOpen.role).toBe('author');
    expect(sharedOpen.brief).toContain('role: author');
    expect(sharedOpen.brief).toMatch(/Brain flag/i);

    // 6b. Now simulate a collaborator perspective by rewriting the manifest's
    //     owner to a different handle, so our config.handle === 'danielm' is
    //     no longer the owner and the role flips to reviewer.
    const manifestPath = join(
      tmp,
      'workspace',
      'artifacts',
      'q2-draft',
      '.mirador',
      'manifest.json',
    );
    const m = JSON.parse(await readFile(manifestPath, 'utf8'));
    m.owner = 'alice';
    await writeFile(manifestPath, JSON.stringify(m, null, 2));
    const collabOpen = await openSession('q2-draft');
    expect(collabOpen.role).toBe('reviewer');
    expect(collabOpen.brief).toContain('role: reviewer');
    expect(collabOpen.brief).toMatch(/Brain flag.*scope/i);

    // 7. Request flow
    const req = await createRequest({
      title: 'Q3 forecast',
      toEmail: 'maria@simetrik.com',
      by: '2026-05-29',
      context: 'Board presentation, 1 page, with chart.',
    });
    expect(req.seedText).toContain('@mirador-request');
    expect(req.slug).toBe('q3-forecast');

    // 8. Accept the request → creates a new artifact + a response seed
    const reqSeed = parseSeed(req.seedText);
    expect(reqSeed.kind).toBe('request');
    if (reqSeed.kind === 'request') {
      const accept = await acceptRequest(reqSeed);
      expect(accept.responseSeed).toContain('@mirador-response');
      expect(accept.responseSeed).toContain('Status: accepted');
      // Artifact created
      const ctx = await readFile(join(accept.artifactPath, 'CONTEXT.md'), 'utf8');
      expect(ctx).toContain('Requested by');
    }

    // 9. Inbox sees pending items
    const items = await computeInbox();
    const rendered = renderInbox(items);
    expect(items.length).toBeGreaterThan(0);
    expect(rendered).toMatch(/Open|Waiting|inbox/);

    // 10. Privacy assertion — no brain path appears anywhere in the
    //     materialised share artefacts.
    const sitePreview = await readFile(
      join(tmp, 'workspace', 'site', 'd', 'q2-draft', 'index.html'),
      'utf8',
    );
    const siteLanding = await readFile(
      join(tmp, 'workspace', 'site', 'i', 'q2-draft', 'index.html'),
      'utf8',
    );
    expect(sitePreview).not.toContain('/brain/');
    expect(sitePreview).not.toContain('preferences.md');
    expect(sitePreview).not.toContain('role-reviewer');
    expect(siteLanding).not.toContain('/brain/');
    expect(siteLanding).not.toContain('preferences.md');
    expect(siteLanding).not.toContain('role-reviewer');

    // 11. Unshare cleanly (offline)
    await unshareArtifact('q2-draft', { offline: true });
    const remaining = await readdir(join(tmp, 'workspace', 'artifacts', 'q2-draft'));
    expect(remaining).not.toContain('.mirador-link');
  });
});
