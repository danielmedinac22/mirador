#!/usr/bin/env node
import { Command } from 'commander';
import { registerConfig } from './commands/config.js';
import { registerInit } from './commands/init.js';
import { VERSION } from './version.js';

const program = new Command();

program
  .name('mirador')
  .description('Setup wizard for the Mirador HTML-publishing skill.')
  .version(VERSION);

registerInit(program);
registerConfig(program);

program.parseAsync().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
