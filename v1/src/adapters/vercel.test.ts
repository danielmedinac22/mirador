import { describe, expect, it } from 'vitest';
import { deriveProductionUrl } from './vercel.js';

describe('deriveProductionUrl', () => {
  it('strips deployment hash from team-scoped URL', () => {
    expect(
      deriveProductionUrl(
        'https://mirador-danielmedinac22-aakjuyzdl-danielmedinac2205s-projects.vercel.app',
        'mirador-danielmedinac22',
      ),
    ).toBe('https://mirador-danielmedinac22-danielmedinac2205s-projects.vercel.app');
  });

  it('handles project name with no scope segment', () => {
    expect(deriveProductionUrl('https://my-project-aakjuyzdl.vercel.app', 'my-project')).toBe(
      'https://my-project.vercel.app',
    );
  });

  it('returns input when URL does not match expected pattern', () => {
    expect(deriveProductionUrl('https://example.com/foo', 'whatever')).toBe(
      'https://example.com/foo',
    );
  });

  it('returns input when host does not start with project name', () => {
    expect(
      deriveProductionUrl('https://other-project-aakjuyzdl-scope.vercel.app', 'my-project'),
    ).toBe('https://other-project-aakjuyzdl-scope.vercel.app');
  });

  it('handles unparseable URL', () => {
    expect(deriveProductionUrl('not-a-url', 'my-project')).toBe('not-a-url');
  });
});
