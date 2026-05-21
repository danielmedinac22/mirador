import { describe, expect, it } from 'vitest';
import { ensureFrontmatter } from './brainProposals.js';

describe('ensureFrontmatter', () => {
  it('passes through content that already has frontmatter', () => {
    const input = '---\nname: foo\n---\nbody';
    expect(ensureFrontmatter('foo', input)).toBe(input);
  });

  it('wraps content without frontmatter', () => {
    const result = ensureFrontmatter('new-topic', 'just a body');
    expect(result).toMatch(/^---\nname: new-topic/);
    expect(result).toContain('just a body');
    expect(result).toContain('type: brain');
  });
});
