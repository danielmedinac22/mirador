import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathExists } from '../adapters/fs.js';
import { paths } from '../shared/paths.js';

export interface InboxItem {
  what: string;
  who: string;
  where: string;
  when: string;
  priorityScore: number;
}

export async function computeInbox(): Promise<InboxItem[]> {
  const items: InboxItem[] = [];
  await collectIncoming(items);
  await collectOutgoing(items);
  await collectArtifactChanges(items);
  items.sort((a, b) => b.priorityScore - a.priorityScore);
  return items;
}

async function collectIncoming(items: InboxItem[]): Promise<void> {
  const dir = join(paths.workspaceClone(), 'incoming-requests');
  if (!(await pathExists(dir))) return;
  const files = await readdir(dir);
  for (const f of files) {
    if (!f.endsWith('.md')) continue;
    const content = await readFile(join(dir, f), 'utf8');
    const statusMatch = content.match(/^Status:\s*(\S+)/m);
    const status = statusMatch?.[1] ?? 'pending';
    if (status === 'pending') {
      const fromMatch = content.match(/^From:\s*(.+)$/m);
      const titleMatch = content.match(/^#\s*(.+?)$/m);
      items.push({
        what: titleMatch?.[1] ?? f.replace(/\.md$/, ''),
        who: shortenWho(fromMatch?.[1] ?? '—'),
        where: 'incoming',
        when: 'now',
        priorityScore: 100,
      });
    }
  }
}

async function collectOutgoing(items: InboxItem[]): Promise<void> {
  const dir = join(paths.workspaceClone(), 'outgoing-requests');
  if (!(await pathExists(dir))) return;
  const files = await readdir(dir);
  for (const f of files) {
    if (!f.endsWith('.md')) continue;
    const content = await readFile(join(dir, f), 'utf8');
    const status = content.match(/^Status:\s*(\S+)/m)?.[1] ?? 'pending';
    const expires = content.match(/^Expires:\s*(\S+)/m)?.[1];
    const isExpired = expires ? new Date(expires).getTime() < Date.now() : false;
    const isPending = status === 'pending';
    const toMatch = content.match(/^To:\s*(.+)$/m);

    if (isExpired && isPending) {
      items.push({
        what: `Expired: ${f.replace(/\.md$/, '')}`,
        who: shortenWho(toMatch?.[1] ?? ''),
        where: 'outgoing',
        when: 'expired',
        priorityScore: 80,
      });
    } else if (isPending) {
      items.push({
        what: `Waiting: ${f.replace(/\.md$/, '')}`,
        who: shortenWho(toMatch?.[1] ?? ''),
        where: 'outgoing',
        when: 'pending',
        priorityScore: 40,
      });
    }
  }
}

async function collectArtifactChanges(items: InboxItem[]): Promise<void> {
  const dir = join(paths.workspaceClone(), 'artifacts');
  if (!(await pathExists(dir))) return;
  const entries = await readdir(dir).catch(() => []);
  // Just record artifacts as low-priority "available" items (so empty inboxes still show something)
  for (const slug of entries) {
    items.push({
      what: `Open: ${slug}`,
      who: 'you',
      where: 'workspace',
      when: '—',
      priorityScore: 10,
    });
  }
}

function shortenWho(raw: string): string {
  // "Daniel Medina <d@x.com>" → "Daniel" or just the email user-part
  const angleMatch = raw.match(/^(.+?)\s*</);
  if (angleMatch) return angleMatch[1]?.split(' ')[0] ?? raw;
  return raw.split('@')[0] ?? raw;
}

export function renderInbox(items: InboxItem[]): string {
  if (items.length === 0) {
    return 'Nothing here yet.\n';
  }
  // Mode A: one item dominates (score gap > 30%)
  if (items.length === 1) return renderModeA(items[0] ?? items[0]);
  const top = items[0];
  const next = items[1];
  if (top && next && top.priorityScore > next.priorityScore * 1.3) {
    return renderModeA(top, items.length - 1);
  }
  return renderModeB(items);
}

function renderModeA(item: InboxItem | undefined, otherCount = 0): string {
  if (!item) return 'Nothing here yet.\n';
  const trailer = otherCount > 0 ? `\n+ ${otherCount} more · \`mirador inbox --all\`\n` : '';
  return `▪  ${item.what} — ${item.where} (${item.when})\n   from ${item.who}\n${trailer}`;
}

function renderModeB(items: InboxItem[]): string {
  const rows = items.slice(0, 8).map((i) => {
    const what = (i.what.length > 36 ? `${i.what.slice(0, 33)}...` : i.what).padEnd(36);
    const who = (i.who.length > 10 ? `${i.who.slice(0, 9)}…` : i.who).padEnd(12);
    const where = i.where.padEnd(12);
    return `${what}${who}${where}${i.when}`;
  });
  const header = `${'WHAT'.padEnd(36)}${'WHO'.padEnd(12)}${'WHERE'.padEnd(12)}WHEN`;
  const sep = '─'.repeat(72);
  const overflow = items.length > 8 ? `\n+ ${items.length - 8} more · \`mirador inbox --all\`` : '';
  return `${[header, sep, ...rows].join('\n')}${overflow}\n`;
}
