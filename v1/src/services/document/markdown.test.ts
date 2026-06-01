import { describe, expect, it } from 'vitest';
import { markdownImpl, parseRichBlock } from './markdown.js';
import { type DocModel, isConflict } from './types.js';

const { parse, serialize, render, diff, merge } = markdownImpl;
const doc = (src: string): DocModel => parse(src);

const FIXTURE = `---
vision: board-ready Q3 narrative anchored on NRR
owner: daniel
title: Q3 Strategy
---

This is the lead paragraph before any heading.

# Q3 Strategy {#overview}

Intro under overview.

## Summary

A short summary with **bold** and a [link](https://example.com).

- one
- two

## Risks {#risks}

\`\`\`callout warn
Watch the **churn** trend.
\`\`\`

\`\`\`table
Quarter,NRR
Q1,108%
Q2,112%
\`\`\`

\`\`\`chart
type: bar
title: NRR by quarter
data:
  - label: Q1
    value: 108
  - label: Q2
    value: 112
\`\`\`

## Appendix {#appendix}

\`\`\`md
# Not A Heading
still appendix
\`\`\`
`;

describe('markdown++ · parse / anchors / frontmatter (T3)', () => {
  it('splits into sections in order, capturing the preamble', () => {
    const m = doc(FIXTURE);
    expect(m.sections.map((s) => s.anchor)).toEqual([
      '__preamble__',
      'overview',
      'summary',
      'risks',
      'appendix',
    ]);
    expect(m.sections[0]?.depth).toBe(0);
    expect(m.sections[0]?.body).toContain('lead paragraph');
    expect(m.sections[1]?.depth).toBe(1);
    expect(m.sections[2]?.depth).toBe(2);
  });

  it('uses explicit {#id}, else derives + slugifies the heading', () => {
    const m = doc('# Q3 Outlook\n\nx\n\n## Risks {#risks}\n\ny');
    expect(m.sections.map((s) => s.anchor)).toEqual(['q3-outlook', 'risks']);
  });

  it('dedupes colliding derived anchors with -2, -3', () => {
    const m = doc('## Notes\n\na\n\n## Notes\n\nb\n\n## Notes\n\nc');
    expect(m.sections.map((s) => s.anchor)).toEqual(['notes', 'notes-2', 'notes-3']);
  });

  it('parses frontmatter (vision / owner / title)', () => {
    const m = doc(FIXTURE);
    expect(m.frontmatter.vision).toBe('board-ready Q3 narrative anchored on NRR');
    expect(m.frontmatter.owner).toBe('daniel');
    expect(m.frontmatter.title).toBe('Q3 Strategy');
  });

  it('does not treat a #-line inside a fenced block as a heading', () => {
    const m = doc(FIXTURE);
    const appendix = m.sections.find((s) => s.anchor === 'appendix');
    expect(appendix?.body).toContain('# Not A Heading');
    expect(m.sections.some((s) => s.headingText === 'Not A Heading')).toBe(false);
  });

  it('serialize persists derived anchors as {#id}', () => {
    const s = serialize(doc('## Summary\n\nbody'));
    expect(s).toContain('## Summary {#summary}');
  });

  it('serialize ∘ parse is idempotent (stable anchors + output)', () => {
    const once = serialize(doc(FIXTURE));
    const twice = serialize(doc(once));
    expect(twice).toBe(once);
    expect(doc(once).sections.map((s) => s.anchor)).toEqual(
      doc(FIXTURE).sections.map((s) => s.anchor),
    );
  });

  it('round-trips frontmatter through serialize', () => {
    const s = serialize(doc(FIXTURE));
    const m = doc(s);
    expect(m.frontmatter.vision).toBe('board-ready Q3 narrative anchored on NRR');
  });
});

describe('markdown++ · render + golden per theme (T4)', () => {
  const THEMES = ['page', 'memo', 'deck', 'console', 'atlas', 'none'] as const;

  for (const theme of THEMES) {
    it(`renders the canonical doc under "${theme}" (golden)`, () => {
      expect(render(doc(FIXTURE), theme)).toMatchSnapshot();
    });
  }

  it('wraps semantic HTML in .mirador-content with anchored section headings', () => {
    const html = render(doc(FIXTURE), 'page');
    expect(html).toContain('data-mirador-theme="page"');
    expect(html).toContain('<link rel="stylesheet" href="/themes/page/theme.css">');
    expect(html).toContain('<div class="mirador-content">');
    expect(html).toContain('<section id="risks">');
    expect(html).toContain('<h2 id="risks">Risks</h2>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toMatch(/<ul>[\s\S]*<li>one<\/li>/);
  });

  it('theme "none" omits the theme stylesheet link', () => {
    const html = render(doc('# A {#a}\n\nx'), 'none');
    expect(html).toContain('data-mirador-theme="none"');
    expect(html).not.toContain('/themes/');
  });

  it('deck theme includes its script', () => {
    expect(render(doc('# A {#a}\n\nx'), 'deck')).toContain('/themes/deck/deck.js');
  });
});

describe('markdown++ · fenced rich blocks (T5)', () => {
  it('parseRichBlock yields typed nodes', () => {
    expect(parseRichBlock('callout warn', 'hi')).toEqual({
      type: 'callout',
      kind: 'warn',
      markdown: 'hi',
    });
    expect(parseRichBlock('callout', 'hi')?.type).toBe('callout');
    const table = parseRichBlock('table', 'A,B\n1,2\n3,4');
    expect(table).toEqual({
      type: 'table',
      columns: ['A', 'B'],
      rows: [
        ['1', '2'],
        ['3', '4'],
      ],
    });
    const chart = parseRichBlock('chart', 'type: bar\ndata:\n  - label: Q1\n    value: 108');
    expect(chart).toMatchObject({
      type: 'chart',
      chartType: 'bar',
      data: [{ label: 'Q1', value: 108 }],
    });
    expect(parseRichBlock('js', 'const x=1')).toBeNull();
  });

  it('renders callout/table/chart under page + atlas', () => {
    for (const theme of ['page', 'atlas'] as const) {
      const html = render(doc(FIXTURE), theme);
      expect(html).toContain('<aside class="callout callout-warn">');
      expect(html).toContain('<strong>churn</strong>'); // callout body is rendered markdown
      expect(html).toContain('<table class="data-table">');
      expect(html).toMatch(/<th>Quarter<\/th>/);
      expect(html).toMatch(/<td>108%<\/td>/);
      expect(html).toContain('<figure class="chart">');
      expect(html).toContain('class="chart-bar" style="--v:100%"'); // Q2=112 is the max
      expect(html).toContain('<div class="chart-title">NRR by quarter</div>');
    }
  });
});

describe('markdown++ · diff (T6)', () => {
  const BASE = '# A {#a}\n\nalpha\n\n# B {#b}\n\nbravo';

  it('edit of §B reports only §B', () => {
    const d = diff(doc(BASE), doc('# A {#a}\n\nalpha\n\n# B {#b}\n\nBRAVO CHANGED'));
    expect(d.changes).toEqual([{ anchor: 'b', headingText: 'B', kind: 'modified' }]);
  });

  it('reports added and removed sections', () => {
    expect(diff(doc(BASE), doc(`${BASE}\n\n# C {#c}\n\ncharlie`)).changes).toEqual([
      { anchor: 'c', headingText: 'C', kind: 'added' },
    ]);
    expect(diff(doc(BASE), doc('# A {#a}\n\nalpha')).changes).toEqual([
      { anchor: 'b', headingText: 'B', kind: 'removed' },
    ]);
  });

  it('heading-text edit keeps the anchor → modified, not add+remove', () => {
    const d = diff(doc('## Risks {#risks}\n\nx'), doc('## Open Risks {#risks}\n\nx'));
    expect(d.changes).toEqual([{ anchor: 'risks', headingText: 'Open Risks', kind: 'modified' }]);
  });

  it('reordering sections without content change reports nothing', () => {
    const reordered = '# B {#b}\n\nbravo\n\n# A {#a}\n\nalpha';
    expect(diff(doc(BASE), doc(reordered)).changes).toEqual([]);
  });
});

describe('markdown++ · merge (T6)', () => {
  const BASE = '# A {#a}\n\nalpha\n\n# B {#b}\n\nbravo';

  it('merges edits to different sections cleanly', () => {
    const result = merge(
      doc(BASE),
      doc('# A {#a}\n\nALPHA-ours\n\n# B {#b}\n\nbravo'),
      doc('# A {#a}\n\nalpha\n\n# B {#b}\n\nBRAVO-theirs'),
    );
    expect(isConflict(result)).toBe(false);
    if (!isConflict(result)) {
      const byAnchor = new Map(result.sections.map((s) => [s.anchor, s.body]));
      expect(byAnchor.get('a')).toBe('ALPHA-ours');
      expect(byAnchor.get('b')).toBe('BRAVO-theirs');
    }
  });

  it('identical same-section edits merge cleanly', () => {
    const same = '# A {#a}\n\nSAME\n\n# B {#b}\n\nbravo';
    const result = merge(doc(BASE), doc(same), doc(same));
    expect(isConflict(result)).toBe(false);
    if (!isConflict(result)) {
      expect(result.sections.find((s) => s.anchor === 'a')?.body).toBe('SAME');
    }
  });

  it('divergent same-section edits return Conflict[] (never throws)', () => {
    const result = merge(
      doc(BASE),
      doc('# A {#a}\n\nOURS\n\n# B {#b}\n\nbravo'),
      doc('# A {#a}\n\nTHEIRS\n\n# B {#b}\n\nbravo'),
    );
    expect(isConflict(result)).toBe(true);
    if (isConflict(result)) {
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ anchor: 'a', ours: 'OURS', theirs: 'THEIRS' });
    }
  });

  it('keeps a section added on only one side', () => {
    const result = merge(doc(BASE), doc(`${BASE}\n\n# C {#c}\n\ncharlie`), doc(BASE));
    expect(isConflict(result)).toBe(false);
    if (!isConflict(result)) {
      expect(result.sections.map((s) => s.anchor)).toContain('c');
    }
  });

  it('drops a section one side deleted while the other left it untouched', () => {
    const result = merge(doc(BASE), doc('# A {#a}\n\nalpha'), doc(BASE));
    expect(isConflict(result)).toBe(false);
    if (!isConflict(result)) {
      expect(result.sections.map((s) => s.anchor)).toEqual(['a']);
    }
  });
});
