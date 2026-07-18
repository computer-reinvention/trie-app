# AGM — Handoff: remaining visual/UX issues

Most of the prior backlog (halo overlap, Filesystem dominance, unlabeled-dot
field, even angular spread, starburst spokes, trace constellations, zoom-to-fit,
and the restore bug) has been handled. Sub-agent activity now flows into the map
and the chat, placement is collision-free (`resolveLayout`), clusters occupy
separate regions, and halos/headings appear at turn end. What remains below.

Files: `app/src/components/AGMCanvas/index.tsx`, `app/src/agm/layout.ts`,
`app/src/agm/style.ts`.

---

## Remaining

1. **Near-duplicate roles read as redundant** (e.g. `CONFIG` vs
   `CONFIG-MANAGEMENT`). They're distinct trie roles but sit adjacent and look
   like the same region twice. Consider role de-duplication / clearer
   separation, or showing the role only once.

2. **The centre anchor doesn't read as meaningful.** It's a faint `+`. Give it a
   subtle ring / keep an empty inner radius so the "attention origin" reads as a
   deliberate anchor, with the hottest real symbol orbiting just outside it.

3. **Dot size barely varies with relevance** — hard to tell a warm dot from a
   cold one. Widen the dot radius/opacity range so heat reads at a glance.

4. **Region styling is very subtle** — the dashed stroke + faint fill make halos
   read as ghost circles. Either commit to a touch more presence or replace with
   a label-only treatment + faint member tint.

---

## Open design questions

- **Named set:** top-N absolute (always name the 6–8 hottest) vs. the current
  top-10% percentile, so a turn's real subjects are always labelled.
- **Role collapsing:** merge near-duplicate roles (CONFIG vs CONFIG-MANAGEMENT)
  at a glance, or keep them visually distinct.

---

## Verifying layout changes headlessly

Before launching the app, the collision/placement invariants can be checked with
the ASCII verifiers (real engine + layout, no Electron):

```
cd app && npx tsx scripts/sim/verify-layout.ts     # full investigation, 0 overlaps
cd app && npx tsx scripts/sim/verify-clusters.ts   # clusters occupy separate regions
cd app && npx tsx scripts/sim/verify-equal-mass.ts # equal-mass cluster fans 2-D, no column
```

Unit invariants live in `app/src/agm/layout.test.ts` (no-overlap, fixed-node,
cluster separation, equal-mass-no-column). Gates: `npx tsc --noEmit`,
`npx vitest run`, `npx electron-vite build`.
</content>
</invoke>
