// ── DEMO STAND-IN — NOT part of the Mirador CLI ──────────────────────────────
// The CLI never frames briefs: it emits a *deterministic* handoff packet, and
// the agent reads its own brain and frames the brief via the shim. There is no
// LLM in the CLI by design (SAD §10). This deterministic lens stands in for that
// agent cognition, solely so the launch payoff — "same packet, different brain →
// visibly different brief" (design §17.1) — is reproducible as a green test and
// a runnable demo. It is intentionally crude; production briefs are richer and
// come from the agent.

export const BRAINS = {
  engManager: {
    name: 'Daniel — eng manager',
    lens: ['timeline', 'scope', 'risk', 'owner', 'dependency', 'launch', 'date', 'slip'],
    cares: 'delivery risk and clear ownership',
  },
  cfo: {
    name: 'María — CFO',
    lens: ['retention', 'nrr', 'revenue', 'margin', 'cost', 'churn', 'number', 'figure'],
    cares: 'the numbers behind the narrative',
  },
};

// A sample handoff packet — the exact shape services/handoff.ts emits. In a real
// run this comes from `mirador handoff <slug>`; inlined here so the demo is
// self-contained and the test is fast.
export const SAMPLE_PACKET = {
  slug: 'q3-strategy',
  since: 'abc1234',
  head: 'def5678',
  vision: 'board-ready Q3 narrative anchored on NRR',
  diff: {
    changes: [
      { anchor: 'timeline', headingText: 'Timeline', kind: 'modified' },
      { anchor: 'retention', headingText: 'Retention', kind: 'modified' },
    ],
  },
  intents: [
    {
      sha: 'aaaaaaa',
      note: {
        move: 'reframe',
        author: 'sam',
        summary: 'Pushed launch to Q4; flagged a vendor dependency risk and named an owner.',
        body: 'The vendor SLA slips the launch date; assigning an owner for the dependency.',
        sections: ['timeline'],
      },
    },
    {
      sha: 'bbbbbbb',
      note: {
        move: 'tighten',
        author: 'sam',
        summary: 'Backed the retention claim with the Q2 NRR figure (112%).',
        body: 'Replaced the hand-wave with the actual NRR number and its source.',
        sections: ['retention'],
      },
    },
  ],
  brainSource: { agent: 'claude', label: 'Claude Code memory' },
};

function scoreChange(change, intents, lens) {
  const hit = intents.find((i) => (i.note.sections ?? []).includes(change.anchor));
  const hay =
    `${change.headingText} ${change.anchor} ${hit?.note.summary ?? ''} ${hit?.note.body ?? ''}`.toLowerCase();
  const matched = lens.filter((k) => hay.includes(k));
  return { change, intent: hit, score: matched.length, matched };
}

/** Reframe a handoff packet through one brain into a one-screen brief. */
export function frameBrief(packet, brain) {
  const ranked = packet.diff.changes
    .map((c) => scoreChange(c, packet.intents, brain.lens))
    .sort((a, b) => b.score - a.score || a.change.anchor.localeCompare(b.change.anchor));

  const lines = [`${packet.slug} — for ${brain.name}`];
  if (packet.vision) lines.push(`vision: ${packet.vision}`);
  lines.push('', 'WHAT CHANGED  ·  WHY IT MATTERS TO YOU');
  for (const r of ranked) {
    const why = r.matched.length
      ? `touches ${r.matched.slice(0, 2).join(' / ')} — your lens (${brain.cares})`
      : 'context to weigh';
    const reason = r.intent ? `  ‹${r.intent.note.summary}›` : '';
    lines.push(`  §${r.change.anchor} ${r.change.headingText} — ${why}${reason}`);
  }
  lines.push('', 'NEXT REFINEMENTS');
  const scored = ranked.filter((r) => r.score > 0);
  const picks = scored.length ? scored.slice(0, 3) : ranked.slice(0, 2);
  for (const r of picks) lines.push(`  → refine §${r.change.anchor} (${brain.cares})`);
  return `${lines.join('\n')}\n`;
}
