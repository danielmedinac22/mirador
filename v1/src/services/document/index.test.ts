import { describe, expect, it } from 'vitest';
import * as doc from './index.js';

describe('services/document registry', () => {
  it('default impl is markdown', () => {
    expect(doc.getImpl().name).toBe('markdown');
    expect(doc.getImpl('markdown').name).toBe('markdown');
  });

  it('unknown impl throws with a helpful message', () => {
    expect(() => doc.getImpl('canvas')).toThrow(/Unknown document implementation/);
  });

  it('dispatch helpers round-trip through the default impl', () => {
    const model = doc.parse('# Title {#title}\n\nbody');
    expect(model.sections.map((s) => s.anchor)).toEqual(['title']);
    expect(doc.render(model, 'page')).toContain('<h1 id="title">');
    expect(doc.serialize(model)).toContain('# Title {#title}');
    expect(doc.diff(model, model).changes).toEqual([]);
  });

  it('normaliseTheme coerces unknown / legacy themes to page', () => {
    expect(doc.normaliseTheme('atlas')).toBe('atlas');
    expect(doc.normaliseTheme('default')).toBe('page');
    expect(doc.normaliseTheme('whatever')).toBe('page');
    expect(doc.normaliseTheme('NONE')).toBe('none');
  });
});
