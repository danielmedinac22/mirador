import { describe, expect, it } from 'vitest';
import { BRAINS, SAMPLE_PACKET, frameBrief } from '../demo/twoBrainFramer.mjs';

/**
 * CV-04: the handoff is a vector, not just a delta — each change reads as
 * moving toward / away from the artifact's vision (design Q9 / §11).
 */
describe('CV-04 — handoff vector relative to the vision', () => {
  it('reads each change as a vector against the vision', () => {
    const cfo = frameBrief(SAMPLE_PACKET, BRAINS.cfo);
    // The vision is "…anchored on NRR"; §retention adds the NRR figure → toward.
    expect(cfo).toMatch(/§retention[^\n]*toward vision/);
    // §timeline (vendor/launch) doesn't touch the vision's terms → neutral.
    expect(cfo).toMatch(/§timeline[^\n]*neutral/);
  });
});
