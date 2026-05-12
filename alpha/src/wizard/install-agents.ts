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
  const skillDir = join(homedir(), '.claude', 'skills', 'mirador');
  const cmdFile = join(homedir(), '.claude', 'commands', 'mirador.md');
  await mkdir(skillDir, { recursive: true });
  await cp(join(pkgDir, 'skill'), skillDir, { recursive: true, force: true });
  await mkdir(join(homedir(), '.claude', 'commands'), { recursive: true });
  await cp(join(pkgDir, 'command', 'mirador.md'), cmdFile);
  console.log(`Claude Code: installed skill to ${skillDir} and /mirador to ${cmdFile}`);
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
  await cp(join(pkgDir, 'command'), join(hints, 'command'), { recursive: true, force: true });
  await writeFile(
    join(hints, 'README.md'),
    "Copy SKILL.md to your agent platform's skills directory and command/mirador.md to its slash-commands directory.\n",
    'utf8',
  );
  console.log(`Manual install: files in ${hints}`);
}
