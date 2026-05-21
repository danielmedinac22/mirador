import { MiradorError } from '../shared/errors.js';

export interface InvitationSeed {
  kind: 'invitation';
  from: string;
  artifact: string;
  repo: string;
  roleExpected?: string;
  note?: string;
  sent: string;
  landing?: string;
  preview?: string;
}

export interface RequestSeed {
  kind: 'request';
  from: string;
  to: string;
  askingFor: string;
  by?: string;
  roleExpected?: string;
  context?: string;
  sent: string;
  expires?: string;
  landing?: string;
}

export interface ResponseSeed {
  kind: 'response';
  from: string;
  to: string;
  reRequest: string;
  status: 'accepted' | 'declined' | 'completed' | 'reassigned';
  note?: string;
  sent: string;
}

export type Seed = InvitationSeed | RequestSeed | ResponseSeed;

const INVITATION_HEADER = '@mirador-invitation';
const REQUEST_HEADER = '@mirador-request';
const RESPONSE_HEADER = '@mirador-response';

export function composeSeed(seed: Seed): string {
  if (seed.kind === 'invitation') return composeInvitation(seed);
  if (seed.kind === 'request') return composeRequest(seed);
  return composeResponse(seed);
}

function composeInvitation(s: InvitationSeed): string {
  const lines = [
    INVITATION_HEADER,
    '',
    `From: ${s.from}`,
    `Artifact: ${s.artifact}`,
    `Repo: ${s.repo}`,
    s.roleExpected ? `Role expected: ${s.roleExpected}` : undefined,
    s.note ? `Note: ${s.note}` : undefined,
    `Sent: ${s.sent}`,
    '',
    'To open: paste this entire block into Claude Code with the Mirador skill installed.',
    s.preview ? `Read-only preview: ${s.preview}` : undefined,
    s.landing ? `Landing: ${s.landing}` : undefined,
    '',
    '— Sent via Mirador',
  ].filter((l): l is string => l !== undefined);
  return lines.join('\n');
}

function composeRequest(s: RequestSeed): string {
  const lines = [
    REQUEST_HEADER,
    '',
    `From: ${s.from}`,
    `To: ${s.to}`,
    `Asking for: ${s.askingFor}`,
    s.by ? `By: ${s.by}` : undefined,
    s.roleExpected ? `Role expected: ${s.roleExpected}` : undefined,
    s.context ? `Context: ${s.context}` : undefined,
    `Sent: ${s.sent}`,
    s.expires ? `Expires: ${s.expires}` : undefined,
    '',
    'To accept or decline: paste this entire block into Claude Code.',
    s.landing ? `Landing: ${s.landing}` : undefined,
    '',
    '— Sent via Mirador',
  ].filter((l): l is string => l !== undefined);
  return lines.join('\n');
}

function composeResponse(s: ResponseSeed): string {
  const lines = [
    RESPONSE_HEADER,
    '',
    `From: ${s.from}`,
    `To: ${s.to}`,
    `Re-request: ${s.reRequest}`,
    `Status: ${s.status}`,
    s.note ? `Note: ${s.note}` : undefined,
    `Sent: ${s.sent}`,
    '',
    '— Sent via Mirador',
  ].filter((l): l is string => l !== undefined);
  return lines.join('\n');
}

export function parseSeed(text: string): Seed {
  const trimmed = text.trim();
  if (trimmed.startsWith(INVITATION_HEADER)) return parseInvitation(trimmed);
  if (trimmed.startsWith(REQUEST_HEADER)) return parseRequest(trimmed);
  if (trimmed.startsWith(RESPONSE_HEADER)) return parseResponse(trimmed);
  throw new MiradorError(
    'SEED_INVALID',
    'Block does not start with @mirador-invitation / @mirador-request / @mirador-response.',
  );
}

function fieldOf(raw: string, key: string): string | undefined {
  return raw.match(new RegExp(`^${escapeRegex(key)}:\\s*(.+)$`, 'm'))?.[1]?.trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function require(raw: string, key: string): string {
  const v = fieldOf(raw, key);
  if (!v) {
    throw new MiradorError('SEED_INVALID', `Seed is missing required field "${key}".`);
  }
  return v;
}

function parseInvitation(raw: string): InvitationSeed {
  return {
    kind: 'invitation',
    from: require(raw, 'From'),
    artifact: require(raw, 'Artifact'),
    repo: require(raw, 'Repo'),
    roleExpected: fieldOf(raw, 'Role expected'),
    note: fieldOf(raw, 'Note'),
    sent: require(raw, 'Sent'),
    preview: fieldOf(raw, 'Read-only preview'),
    landing: fieldOf(raw, 'Landing'),
  };
}

function parseRequest(raw: string): RequestSeed {
  return {
    kind: 'request',
    from: require(raw, 'From'),
    to: require(raw, 'To'),
    askingFor: require(raw, 'Asking for'),
    by: fieldOf(raw, 'By'),
    roleExpected: fieldOf(raw, 'Role expected'),
    context: fieldOf(raw, 'Context'),
    sent: require(raw, 'Sent'),
    expires: fieldOf(raw, 'Expires'),
    landing: fieldOf(raw, 'Landing'),
  };
}

function parseResponse(raw: string): ResponseSeed {
  const status = require(raw, 'Status');
  if (!['accepted', 'declined', 'completed', 'reassigned'].includes(status)) {
    throw new MiradorError('SEED_INVALID', `Invalid status "${status}".`);
  }
  return {
    kind: 'response',
    from: require(raw, 'From'),
    to: require(raw, 'To'),
    reRequest: require(raw, 'Re-request'),
    status: status as ResponseSeed['status'],
    note: fieldOf(raw, 'Note'),
    sent: require(raw, 'Sent'),
  };
}
