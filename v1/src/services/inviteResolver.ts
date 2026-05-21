import * as github from '../adapters/github.js';

export interface ResolveResult {
  handle: string;
  source: 'github-email' | 'local-part-fallback';
  warning?: string;
}

export async function resolveEmail(email: string): Promise<ResolveResult> {
  const handle = await github.resolveEmailToHandle(email);
  if (handle) return { handle, source: 'github-email' };
  const localPart = email.split('@')[0] ?? email;
  return {
    handle: localPart,
    source: 'local-part-fallback',
    warning: `Could not resolve "${email}" to a GitHub handle via the email-search API (usually means the recipient's GitHub email is private). Falling back to "${localPart}", which is likely wrong. Pass \`--handle <github-handle>\` to specify directly.`,
  };
}
