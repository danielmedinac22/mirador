import { homedir } from 'node:os';
import { join } from 'node:path';

const miradorHome = (): string => process.env.MIRADOR_HOME_OVERRIDE ?? join(homedir(), '.mirador');
const claudeHome = (): string => process.env.CLAUDE_HOME_OVERRIDE ?? join(homedir(), '.claude');
const codexHome = (): string => process.env.CODEX_HOME_OVERRIDE ?? join(homedir(), '.codex');

export const paths = {
  miradorHome,
  workspaceClone: () => join(miradorHome(), 'workspace'),
  sharedClonesRoot: () => join(miradorHome(), 'shared'),
  sessionSkillsRoot: () => join(miradorHome(), 'session-skills'),
  configFile: () => join(miradorHome(), 'config.json'),
  lastSeenFile: () => join(miradorHome(), 'last-seen.json'),
  claudeSkill: () => join(claudeHome(), 'skills', 'mirador'),
  claudeCommand: () => join(claudeHome(), 'commands', 'mirador.md'),
  codexSkill: () => join(codexHome(), 'skills', 'mirador'),
};
