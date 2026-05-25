/* Mirador — centralized user-facing strings.
   Single source for every string the user sees.
   Voice spec: docs/design/voice.md */

export const copy = {
  cli: {
    init: {
      intro: 'mirador setup',
      checking: 'Checking environment.',
      github: (user: string) => `GitHub: ${user}`,
      brainBootstrap: 'Brain bootstrap',
      brainHelp:
        'Private notes that shape how Claude Code reads artifacts you open with mirador.\nAnswer briefly — or press Enter to skip. Edit later with `mirador brain`.',
      createRepo: 'Creating workspace repo.',
      repoReady: (repo: string) => `Workspace: ${repo}`,
      scaffolding: 'Scaffolding workspace.',
      scaffolded: 'Workspace ready.',
      ensureVercel: 'Ensuring Vercel project.',
      vercelReady: (project: string, domain: string) => `Vercel: ${project} (${domain})`,
      installSkill: 'Installing Claude Code skill.',
      installCodexAsk: 'Also install for Codex?',
      skillsReady: 'Skills installed.',
      outro: 'Ready. Try `mirador new <slug>`.',
      alreadyInit: 'mirador is already initialized. Re-run with current values as defaults?',
      aborted: 'Aborted.',
    },
    new: {
      intro: (slug: string) => `mirador · new ${slug}`,
      askPurpose: 'Purpose of this artifact?',
      placeholderPurpose: 'e.g. Q3 forecast for the board',
      askAudience: 'Audience?',
      placeholderAudience: 'e.g. board; engineering leads; CFO',
      created: (path: string, slug: string) =>
        `Created at ${path}.\nOpen with \`mirador open ${slug}\`.`,
    },
    share: {
      intro: (slug: string) => `mirador · share ${slug}`,
      willDo: 'This will:',
      willCreateRepo: (slug: string) => `Create a private GitHub repo for "${slug}"`,
      willInvite: (emails: string) => `Invite ${emails}`,
      willDeploy: 'Deploy preview + landing to Vercel',
      willSkipDeploy: 'Skip Vercel deploy',
      proceed: 'Proceed?',
      sharedTo: (slug: string, repo: string) => `Shared "${slug}" to ${repo}.`,
      copyInvite: 'Invitation seed (copy and paste to collaborator):',
      live: (url: string) => `Live at ${url}`,
      deploySkipped: 'Deploy skipped (see logs for failure).',
      unshared: (slug: string) => `Unshared "${slug}".`,
    },
    errors: {
      ghAuthMissing: 'GitHub auth missing. Run `gh auth login`.',
      vercelAuthMissing: 'Vercel auth missing. Run `vercel login`.',
      vercelCliMissing: 'Vercel CLI missing. Run `npm i -g vercel`.',
      slugExists: (slug: string) => `Slug "${slug}" already exists in workspace.`,
      handleListMismatch: (handles: number, emails: number) =>
        `--handle list length (${handles}) must match --with list length (${emails}).`,
      emailToHandleFailed: (email: string) =>
        `Could not resolve ${email} to a GitHub handle. Pass --handle explicitly.`,
    },
  },

  landing: {
    invitation: {
      hero: (from: string, slug: string) => `${from} sent you ${slug}.`,
      sub: (role?: string) =>
        role ? `He wants your eyes on it. Open in Claude Code.` : `Open in Claude Code to start.`,
    },
    request: {
      hero: (from: string, slug: string) => `${from} wants you to write ${slug}.`,
      sub: 'Open in Claude Code to begin.',
    },
    ctaPrimary: 'Open in Claude Code',
    ctaPrimaryClicked: 'Copied. Paste it in.',
    ctaSecondary: 'Or just read it.',
    footer: "What's this? github.com/danielmedinac22/mirador.",
  },

  gate: {
    hero: 'Locked.',
    placeholder: 'Password',
    unlock: 'Unlock',
    wrong: 'Wrong password.',
    footer: 'Client-side gate. Deters viewers, not attackers.',
  },

  siteIndex: {
    heading: 'mirador',
    empty: 'Nothing here yet.',
    footer: 'github.com/danielmedinac22/mirador',
  },
} as const;

export type Copy = typeof copy;
