#!/usr/bin/env node
import { Command } from 'commander';
import { registerAccept } from './commands/accept.js';
import { registerBrain } from './commands/brain.js';
import { registerDecline } from './commands/decline.js';
import { registerInbox } from './commands/inbox.js';
import { registerInit } from './commands/init.js';
import { registerNew } from './commands/new.js';
import { registerOpen } from './commands/open.js';
import { registerRequest } from './commands/request.js';
import { registerShare } from './commands/share.js';
import { registerUpgrade } from './commands/upgrade.js';
import { computeInbox, renderInbox } from './services/inbox.js';
import { VERSION } from './version.js';

const program = new Command();

program
  .name('mirador-v1')
  .description('Mirador v1 CLI — collaborative AI artifacts on git.')
  .version(VERSION);

registerInit(program);
registerNew(program);
registerOpen(program);
registerBrain(program);
registerShare(program);
registerRequest(program);
registerAccept(program);
registerDecline(program);
registerInbox(program);
registerUpgrade(program);

// Default action: when called with no args, show inbox
program.action(async () => {
  const items = await computeInbox();
  process.stdout.write(renderInbox(items));
});

program.parseAsync().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
