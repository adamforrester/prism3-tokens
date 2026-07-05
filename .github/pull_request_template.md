<!--
  One concern per PR. Keep the change surgical; edit only what the task needs.
  Fill the sections below — the Gates block is the load-bearing part: this repo's
  correctness contract is "regenerate out/*, then prove the gates green."
-->

## Summary

<!-- One or two sentences: what this changes and why. -->

## The change

<!-- What was wrong / missing, and the approach. Note any decision worth recording
     (it likely also belongs in Prism3/docs/00-progress.md's decisions log). -->

## Gates

<!-- Run these and report the results. Not a formality — a PR isn't done until they're green. -->

- [ ] `npx tsx Prism3/engine/test.ts` → _N/N passed_
- [ ] `npx tsx Prism3/engine/nb-regression.ts` → exits 0 (ΔE00 _…_)
- [ ] `npx tsx Prism3/engine/emit-dtcg.ts` → every alias resolves + every mode contrast contract passes (_…/…_)
- [ ] Web (if touched): `tsc --noEmit` clean

## out/* + fixtures

<!-- State the output impact explicitly:
     - byte-identical (validation-only / metadata change), OR
     - regenerated — and what changed and why (which brands/axes/files).
     If a fixture's byte-repro target moved, say so and why. -->

## Notes

<!-- Cross-lane coordination, follow-ups parked, issues opened/closed, screenshots. -->
