import { homedir } from 'node:os';
import { join } from 'node:path';

const miradorHome = (): string => process.env.MIRADOR_HOME_OVERRIDE ?? join(homedir(), '.mirador');
const claudeHome = (): string => process.env.CLAUDE_HOME_OVERRIDE ?? join(homedir(), '.claude');
const codexHome = (): string => process.env.CODEX_HOME_OVERRIDE ?? join(homedir(), '.codex');
const geminiHome = (): string => process.env.GEMINI_HOME_OVERRIDE ?? join(homedir(), '.gemini');
// The project the user is collaborating from — root for agent-native brain
// sources (Claude memory project slug, AGENTS.md/GEMINI.md/CLAUDE.md convention).
const projectRoot = (): string => process.env.MIRADOR_PROJECT_OVERRIDE ?? process.cwd();

export const paths = {
  miradorHome,
  claudeHome,
  codexHome,
  geminiHome,
  projectRoot,
  workspaceClone: () => join(miradorHome(), 'workspace'),
  sharedClonesRoot: () => join(miradorHome(), 'shared'),
  sessionSkillsRoot: () => join(miradorHome(), 'session-skills'),
  configFile: () => join(miradorHome(), 'config.json'),
  lastSeenFile: () => join(miradorHome(), 'last-seen.json'),
  claudeSkill: () => join(claudeHome(), 'skills', 'mirador'),
  claudeCommand: () => join(claudeHome(), 'commands', 'mirador.md'),
  codexSkill: () => join(codexHome(), 'skills', 'mirador'),
  geminiSkill: () => join(geminiHome(), 'skills', 'mirador'),
  /** Claude Code memory dir for a project: ~/.claude/projects/<slug>/memory */
  claudeMemoryDir: (root: string) =>
    join(claudeHome(), 'projects', root.replaceAll('/', '-'), 'memory'),
};
