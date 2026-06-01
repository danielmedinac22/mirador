#!/usr/bin/env node
import { Command } from 'commander';
import { registerAccept } from './commands/accept.js';
import { registerBrain } from './commands/brain.js';
import { registerComment } from './commands/comment.js';
import { registerDashboard } from './commands/dashboard.js';
import { registerDecline } from './commands/decline.js';
import { registerDiff } from './commands/diff.js';
import { registerHandoff } from './commands/handoff.js';
import { registerInbox } from './commands/inbox.js';
import { registerInit } from './commands/init.js';
import { registerList } from './commands/list.js';
import { registerNew } from './commands/new.js';
import { registerOpen } from './commands/open.js';
import { registerPreview } from './commands/preview.js';
import { registerPush } from './commands/push.js';
import { registerRefine } from './commands/refine.js';
import { registerRequest } from './commands/request.js';
import { registerShare } from './commands/share.js';
import { registerShim } from './commands/shim.js';
import { registerStatus } from './commands/status.js';
import { registerUpgrade } from './commands/upgrade.js';
import { registerVision } from './commands/vision.js';
import { registerWatch } from './commands/watch.js';
import { computeInbox, renderInbox } from './services/inbox.js';
import { VERSION } from './version.js';

const program = new Command();

program
  .name('mirador')
  .description('mirador — share AI-generated artifacts on git.')
  .version(VERSION);

registerInit(program);
registerNew(program);
registerOpen(program);
registerPreview(program);
registerDiff(program);
registerRefine(program);
registerPush(program);
registerHandoff(program);
registerVision(program);
registerStatus(program);
registerWatch(program);
registerShim(program);
registerComment(program);
registerBrain(program);
registerShare(program);
registerRequest(program);
registerAccept(program);
registerDecline(program);
registerInbox(program);
registerList(program);
registerDashboard(program);
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
