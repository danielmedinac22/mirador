import { writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import type { Command } from 'commander';
import { execa } from 'execa';
import { repoRoot } from '../adapters/git.js';
import { ALL_THEMES, type ThemeName, normaliseTheme } from '../services/document/index.js';
import {
  type ViewConfig,
  defaultViewerUrl,
  discoverDocs,
  gitMeta,
  inlineThemeCss,
  installConventionSkill,
  parseDocs,
  pushToViewer,
  readIntents,
  readState,
  readViewConfig,
  readVision,
  registerWithViewer,
  scaffoldMiradorDir,
} from '../services/view.js';
import { buildViewPage } from '../services/viewPage.js';
import { cobalt, muted } from '../shared/ansi.js';
import { MiradorError } from '../shared/errors.js';

async function gitUserName(dir: string): Promise<string | null> {
  try {
    const { stdout } = await execa('git', ['config', 'user.name'], { cwd: dir });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function assembleViewHtml(dir: string, config: ViewConfig): Promise<string> {
  const files = await discoverDocs(dir, config.docs);
  if (!files.length) {
    throw new MiradorError(
      'NO_DOCS',
      `No markdown documents found in ${dir}.`,
      'The artifact folder needs at least one .md file.',
    );
  }
  const docs = await parseDocs(dir, files);
  const theme = normaliseTheme(config.theme ?? 'page');
  const html = buildViewPage({
    title: config.title ?? basename(dir),
    theme,
    docs,
    vision: await readVision(dir),
    state: await readState(dir),
    intents: await readIntents(dir),
    git: await gitMeta(dir),
    generatedAt: new Date().toISOString(),
  });
  return inlineThemeCss(html, theme);
}

export function registerView(program: Command): void {
  const view = program
    .command('view')
    .description('The shared link: scaffold the in-repo convention and push the rendered view.');

  view
    .command('init [dir]')
    .description('Scaffold .mirador/ in a document folder, register its view, install the skill.')
    .option('--viewer <url>', 'Viewer base URL.', defaultViewerUrl())
    .option('--title <title>', 'View title (defaults to the folder name).')
    .option('--theme <theme>', `Theme: ${ALL_THEMES.join(' | ')}.`, 'page')
    .action(
      async (
        dirArg: string | undefined,
        opts: { viewer: string; title?: string; theme: string },
      ) => {
        const dir = resolve(dirArg ?? '.');
        const existing = await readViewConfig(dir);
        if (existing) {
          throw new MiradorError(
            'VIEW_ALREADY_INIT',
            'This folder already has a registered view.',
            `Run \`mirador view push\` — the link is ${existing.viewer.replace(/\/$/, '')}/v/${existing.slug}.`,
          );
        }
        const files = await discoverDocs(dir);
        if (!files.length) {
          throw new MiradorError(
            'NO_DOCS',
            `No markdown documents found in ${dir}.`,
            'Run it from (or point it at) the folder that holds the documents.',
          );
        }

        const title = opts.title ?? basename(dir);
        const docs = await parseDocs(dir, files);
        await scaffoldMiradorDir(dir, docs, await gitUserName(dir));

        const registration = await registerWithViewer(opts.viewer, title);
        const config: ViewConfig = {
          viewer: opts.viewer.replace(/\/$/, ''),
          slug: registration.slug,
          writeToken: registration.writeToken,
          title,
          theme: normaliseTheme(opts.theme) as ThemeName,
          docs: files,
        };
        await writeFile(
          join(dir, '.mirador', 'config.json'),
          `${JSON.stringify(config, null, 2)}\n`,
          'utf8',
        );

        let skillNote = '';
        const root = await repoRoot(dir);
        if (root) {
          const installed = await installConventionSkill(root);
          if (installed) skillNote = `\n  skill     ${muted(installed)}`;
        }

        const html = await assembleViewHtml(dir, config);
        const url = await pushToViewer(config, html);

        process.stdout.write(
          `${cobalt(title)} — view registered and pushed.\n` +
            `  link      ${url}\n` +
            `  state     ${muted(join(dir, '.mirador'))}${skillNote}\n` +
            `Next: set the vision in ${muted('.mirador/vision.md')}, commit, and share the link.\n`,
        );
      },
    );

  view
    .command('push [dir]')
    .description('Render the artifact folder and push the view to its registered link.')
    .action(async (dirArg: string | undefined) => {
      const dir = resolve(dirArg ?? '.');
      const config = await readViewConfig(dir);
      if (!config) {
        throw new MiradorError(
          'VIEW_NOT_INIT',
          'This folder has no registered view.',
          'Run `mirador view init` here first.',
        );
      }
      const html = await assembleViewHtml(dir, config);
      const url = await pushToViewer(config, html);
      process.stdout.write(`${cobalt(config.title ?? basename(dir))} — view updated.\n  ${url}\n`);
    });
}
