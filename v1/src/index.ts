#!/usr/bin/env node
import { Command } from 'commander';
import { VERSION } from './version.js';

const program = new Command();

program
  .name('mirador-v1')
  .description('Mirador v1 — collaborative artifacts on git, brain-aware Claude Code sessions.')
  .version(VERSION);

// Commands wire up here as vertical slices land.
// See docs/superpowers/specs/2026-05-21-mirador-v2-design.md §8 for the surface.

program.parseAsync().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
