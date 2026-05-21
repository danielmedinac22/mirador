#!/usr/bin/env node
import { Command } from 'commander';
import { registerInit } from './commands/init.js';
import { registerNew } from './commands/new.js';
import { registerOpen } from './commands/open.js';
import { VERSION } from './version.js';

const program = new Command();

program
  .name('mirador-v1')
  .description('Mirador v1 CLI — collaborative AI artifacts on git.')
  .version(VERSION);

registerInit(program);
registerNew(program);
registerOpen(program);

program.parseAsync().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
