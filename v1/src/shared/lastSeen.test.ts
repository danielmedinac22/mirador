import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readLastSeen, updateLastSeen, writeLastSeen } from './lastSeen.js';

describe('lastSeen', () => {
  let tmp: string;
  const original = process.env.MIRADOR_HOME_OVERRIDE;

  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'mirador-lastseen-'));
    process.env.MIRADOR_HOME_OVERRIDE = tmp;
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
    process.env.MIRADOR_HOME_OVERRIDE = original;
  });

  it('readLastSeen returns empty when file is missing', async () => {
    expect(await readLastSeen()).toEqual({});
  });

  it('round-trips a store', async () => {
    const store = {
      foo: { last_open_at: '2026-05-21T10:00:00Z' },
      bar: { last_open_at: '2026-05-21T11:00:00Z', last_open_commit: 'abc123' },
    };
    await writeLastSeen(store);
    expect(await readLastSeen()).toEqual(store);
  });

  it('updateLastSeen adds without clobbering other entries', async () => {
    await writeLastSeen({ existing: { last_open_at: '2026-05-20T00:00:00Z' } });
    await updateLastSeen('new', { last_open_at: '2026-05-21T00:00:00Z' });
    const store = await readLastSeen();
    expect(store).toHaveProperty('existing');
    expect(store).toHaveProperty('new');
    expect(store.new?.last_open_at).toBe('2026-05-21T00:00:00Z');
  });

  it('writes JSON with trailing newline', async () => {
    await writeLastSeen({ foo: { last_open_at: '2026-05-21T10:00:00Z' } });
    const raw = await readFile(join(tmp, 'last-seen.json'), 'utf8');
    expect(raw.endsWith('\n')).toBe(true);
  });
});
