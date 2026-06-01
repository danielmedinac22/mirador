import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type IntentNote,
  composeIntentNote,
  intentTrailer,
  listIntentNotes,
  parseIntentNote,
  readIntentNote,
  writeIntentNote,
} from './intentNote.js';
import { normalizeMove } from './moves.js';

describe('services/moves', () => {
  it('validates known moves and defaults unknown/absent to extend', () => {
    expect(normalizeMove('tighten')).toBe('tighten');
    expect(normalizeMove('endorse')).toBe('endorse');
    expect(normalizeMove('bogus')).toBe('extend');
    expect(normalizeMove(undefined)).toBe('extend');
  });
});

describe('services/intentNote', () => {
  const note: IntentNote = {
    move: 'critique',
    author: 'maria',
    summary: 'tighten the retention claim',
    body: 'Cut the hedge in §retention; the NRR figure needs a source.',
    sections: ['retention'],
  };

  it('compose ∘ parse round-trips', () => {
    const parsed = parseIntentNote(composeIntentNote(note));
    expect(parsed).toMatchObject({
      move: 'critique',
      author: 'maria',
      summary: 'tighten the retention claim',
      sections: ['retention'],
    });
    expect(parsed.body).toContain('Cut the hedge');
  });

  it('emits a one-line machine-readable move trailer', () => {
    expect(intentTrailer(note)).toBe('Mirador-Move: critique');
  });

  it('writes / reads / lists sidecars keyed by sha', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'mirador-intent-'));
    try {
      const p = await writeIntentNote(tmp, 'abc1234', note);
      expect(p).toContain(join('.mirador', 'intents', 'abc1234.md'));

      const back = await readIntentNote(tmp, 'abc1234');
      expect(back?.summary).toBe('tighten the retention claim');
      expect(back?.move).toBe('critique');
      expect(await readIntentNote(tmp, 'missing')).toBeNull();

      await writeIntentNote(tmp, 'def5678', { ...note, move: 'endorse', summary: 'lgtm' });
      const all = await listIntentNotes(tmp);
      expect(all.map((x) => x.sha)).toEqual(['abc1234', 'def5678']);
      expect(all[1]?.note.move).toBe('endorse');
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it('parse defaults a malformed/missing move to extend', () => {
    expect(parseIntentNote('no frontmatter here').move).toBe('extend');
  });
});
