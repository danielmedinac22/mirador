import type { Command } from 'commander';
import { resolveBrainSource } from '../services/brain.js';
import { type ShimAgent, installShim, installSlashCommand } from '../services/skill.js';
import { cobalt, muted } from '../shared/ansi.js';
import { MiradorError } from '../shared/errors.js';
import { logActivity } from '../shared/log.js';

const SUPPORTED: ShimAgent[] = ['claude', 'codex', 'gemini'];

export function registerShim(program: Command): void {
  const shim = program.command('shim').description('Manage per-agent mirador shims.');

  shim
    .command('install')
    .description('Install/update the shim for your agent (auto-detected, or --agent).')
    .option('--agent <name>', 'claude | codex | gemini (default: detect)')
    .action(async (opts: { agent?: string }) => {
      const agent = await resolveAgent(opts.agent);
      const target = await installShim(agent);
      if (agent === 'claude') await installSlashCommand();
      await logActivity(`shim install agent=${agent}`);
      process.stdout.write(`Installed ${cobalt(agent)} shim → ${muted(target)}\n`);
    });
}

async function resolveAgent(explicit?: string): Promise<ShimAgent> {
  if (explicit) {
    if (!SUPPORTED.includes(explicit as ShimAgent)) {
      throw new MiradorError(
        'UNKNOWN_AGENT',
        `Unknown agent "${explicit}".`,
        `Supported: ${SUPPORTED.join(', ')}.`,
      );
    }
    return explicit as ShimAgent;
  }
  // Detect from the brain source; generic falls back to the fullest shim (claude).
  const { agent } = await resolveBrainSource();
  return agent === 'codex' || agent === 'gemini' ? agent : 'claude';
}
