import { describe, expect, it } from 'vitest';
import { BRAINS, SAMPLE_PACKET, frameBrief } from '../demo/twoBrainFramer.mjs';

/**
 * CV-03 launch payoff (design §17.1), made reproducible: the SAME handoff packet,
 * framed through two different brains, yields two visibly different briefs — and
 * the difference is the brain. The framer here is a deterministic demo stand-in
 * for the agent's cognition (the CLI has no LLM); see demo/twoBrainFramer.mjs.
 */
describe('CV-03 — two-brain handoff (reproducible demo)', () => {
  it('one packet → two visibly different briefs, each shaped by its brain', () => {
    const eng = frameBrief(SAMPLE_PACKET, BRAINS.engManager);
    const cfo = frameBrief(SAMPLE_PACKET, BRAINS.cfo);

    expect(eng).not.toBe(cfo);

    // Each brief leads with the section its brain cares about.
    expect(eng.indexOf('§timeline')).toBeLessThan(eng.indexOf('§retention'));
    expect(cfo.indexOf('§retention')).toBeLessThan(cfo.indexOf('§timeline'));

    // Each names its own concern.
    expect(eng).toContain('delivery risk');
    expect(cfo).toContain('numbers');

    // Each ends in concrete next-refinements (imperatives, not a question).
    expect(eng).toContain('NEXT REFINEMENTS');
    expect(eng).toMatch(/→ refine §/);
    expect(eng).not.toContain('?');
  });

  it('the packet carries a brain *pointer*, never brain content', () => {
    expect(Object.keys(SAMPLE_PACKET.brainSource).sort()).toEqual(['agent', 'label']);
  });
});
