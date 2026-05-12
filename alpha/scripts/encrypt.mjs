#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    in: { type: 'string' },
    out: { type: 'string' },
    password: { type: 'string' },
    template: { type: 'string' },
  },
});

if (!values.in || !values.out || !values.password || !values.template) {
  console.error('usage: encrypt.mjs --in <file> --out <file> --password <pw> --template <gate.html>');
  process.exit(2);
}

const ITER = 200_000;

const html = readFileSync(values.in);
const template = readFileSync(values.template, 'utf8');

const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));

const base = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(values.password),
  'PBKDF2',
  false,
  ['deriveKey'],
);
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' },
  base,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt'],
);
const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, html));

const b64 = (u) => Buffer.from(u).toString('base64');
const out = template
  .replace('__SALT__', b64(salt))
  .replace('__IV__', b64(iv))
  .replace('__CT__', b64(ct))
  .replace('__ITER__', String(ITER));

writeFileSync(values.out, out);
