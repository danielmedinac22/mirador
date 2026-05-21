import * as github from '../adapters/github.js';

export interface ResolveResult {
  handle: string;
  source: 'github-email' | 'local-part-fallback';
}

export async function resolveEmail(email: string): Promise<ResolveResult> {
  const handle = await github.resolveEmailToHandle(email);
  if (handle) return { handle, source: 'github-email' };
  const localPart = email.split('@')[0] ?? email;
  return { handle: localPart, source: 'local-part-fallback' };
}
