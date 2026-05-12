import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const script = resolve(__dirname, 'encrypt.mjs');
const template = resolve(__dirname, '..', 'templates', 'password-gate.html');

describe('encrypt.mjs', () => {
  let tmp;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'mirador-enc-'));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('produces an HTML file with the gate UI and no plaintext', () => {
    const input = join(tmp, 'in.html');
    const output = join(tmp, 'out.html');
    writeFileSync(input, '<html><body><h1>top secret</h1></body></html>');
    const r = spawnSync(
      'node',
      [script, '--in', input, '--out', output, '--password', 'pw', '--template', template],
      { encoding: 'utf8' },
    );
    expect(r.status).toBe(0);
    const out = readFileSync(output, 'utf8');
    expect(out).toContain('Password required');
    expect(out).not.toContain('top secret');
  });

  it('exits non-zero on missing args', () => {
    const r = spawnSync('node', [script, '--in', '/nope'], { encoding: 'utf8' });
    expect(r.status).not.toBe(0);
  });
});
