#!/usr/bin/env node
// Runnable two-brain demo: the same handoff packet, framed through two different
// brains, produces two visibly different briefs. Run: `node demo/two-brains.mjs`
// (or `npm run demo:two-brains`).
//
// The briefs are produced by a deterministic DEMO stand-in (see twoBrainFramer.mjs);
// in production the agent frames them through its own memory via the shim.
import { BRAINS, SAMPLE_PACKET, frameBrief } from './twoBrainFramer.mjs';

const sep = '─'.repeat(66);
for (const key of ['engManager', 'cfo']) {
  console.log(sep);
  process.stdout.write(frameBrief(SAMPLE_PACKET, BRAINS[key]));
}
console.log(sep);
console.log('Same packet. Different brains. Different briefs — the difference is the');
console.log('brain. (Briefs above are a deterministic demo stand-in for the agent.)');
