import { cp, mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { AgentKey } from '../config.js';

export async function installAgents(agents: AgentKey[], pkgDir: string): Promise<void> {
  for (const a of agents) {
    if (a === 'claude-code') await installClaudeCode(pkgDir);
    else if (a === 'codex') await installCodex(pkgDir);
    else if (a === 'other') await installOther(pkgDir);
  }
}

async function installClaudeCode(pkgDir: string): Promise<void> {
  // The skill's frontmatter `name: mirador` already registers `/mirador` in
  // Claude Code; no separate slash-command file is needed (it would duplicate
  // the entry in the picker).
  const skillDir = join(homedir(), '.claude', 'skills', 'mirador');
  await mkdir(skillDir, { recursive: true });
  await cp(join(pkgDir, 'skill'), skillDir, { recursive: true, force: true });

  // Clean up legacy slash command from earlier alphas, if present.
  const legacyCmd = join(homedir(), '.claude', 'commands', 'mirador.md');
  try {
    const { rm } = await import('node:fs/promises');
    await rm(legacyCmd, { force: true });
  } catch {
    // ignore
  }

  console.log(`Claude Code: installed skill to ${skillDir}`);
}

async function installCodex(pkgDir: string): Promise<void> {
  const candidate = join(homedir(), '.codex', 'skills', 'mirador');
  try {
    await mkdir(candidate, { recursive: true });
    await cp(join(pkgDir, 'skill'), candidate, { recursive: true, force: true });
    console.log(`Codex: installed to ${candidate} (best-effort; verify in your Codex docs)`);
  } catch {
    const hints = join(homedir(), '.mirador', 'install-hints', 'codex');
    await mkdir(hints, { recursive: true });
    await cp(join(pkgDir, 'skill'), hints, { recursive: true, force: true });
    console.log(`Codex: auto-install failed. Files saved to ${hints} — copy per your Codex setup.`);
  }
}

async function installOther(pkgDir: string): Promise<void> {
  const hints = join(homedir(), '.mirador', 'install-hints', 'other');
  await mkdir(hints, { recursive: true });
  await cp(join(pkgDir, 'skill'), hints, { recursive: true, force: true });
  await writeFile(
    join(hints, 'README.md'),
    "Copy SKILL.md to your agent platform's skills directory.\n",
    'utf8',
  );
  console.log(`Manual install: files in ${hints}`);
}
