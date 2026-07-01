/**
 * nb-fixture — the I/O shell for the NB regression fixture.
 *
 * The engine core (theme.ts) is pure: it takes the *parsed* NB measurement data
 * as an argument (nbSpecsFrom / nbThemeFrom) and never touches the filesystem, so
 * it can run anywhere the pure core can — a Figma plugin sandbox, the browser, an
 * MCP server, a CLI. This module is the one place that reads nb-measured.json off
 * disk and adapts it into those pure builders, preserving the historical call-site
 * names (loadSpecs / nbTheme) so downstream (emit-dtcg, nb-regression) barely change.
 *
 * See docs/07-e2e-journey.md §3 (pure core / I/O shell separation).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { NbMeasured, RampSpec, Theme, nbSpecsFrom, nbThemeFrom } from './theme';

const here = dirname(fileURLToPath(import.meta.url));

/** Path to the NB *measurement* fixture (reverse-engineered NB anchors). */
export const NB_MEASURED = resolve(here, '../schema/nb-measured.json');

const readMeasured = (): NbMeasured => JSON.parse(readFileSync(NB_MEASURED, 'utf8'));

/** NB regression specs (reads the fixture, then defers to the pure core). */
export const loadSpecs = (): RampSpec[] => nbSpecsFrom(readMeasured());

/** The NB regression theme (reads the fixture, then defers to the pure core). */
export const nbTheme = (): Theme => nbThemeFrom(readMeasured());
