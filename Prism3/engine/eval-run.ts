/**
 * Prism3 engine — consumption-eval HARNESS (docs/17 §3). Drives a cold agent over a fixed set
 * of sample UI tasks against a themed brand and scores the token refs it produces with `eval.ts`.
 *
 * PURE orchestration — the model call is INJECTED as a `ModelRunner`, so this file has no I/O
 * and no LLM dependency of its own. A keyed environment supplies a real runner (a Claude-API
 * shell); tests supply a mock. Prompt-building, ref-extraction, and scoring are all deterministic
 * and gated. The payoff is the DIFFERENTIAL: run the same tasks WITH the token catalogue vs.
 * WITHOUT (the agent must guess), and the invented-token rate collapses — the value of the surface.
 *
 * First measured run (2026-07-04, cold general-purpose subagents, `atlas` brand): WITH the
 * catalogue → 0% invented / 0% primitive-leak (53/53 valid); WITHOUT → 48% invented (21/40 valid).
 * See docs/17 §5.
 */
import { scoreConsumption, ConsumptionScore, scoreContractCompliance, ContractCompliance, UsedPair } from './eval';

export type EvalTask = { name: string; brief: string };

/** The fixed sample set — data-only, brand-agnostic. Each is a small component whose token
 *  needs span colour (incl. states + semantics), geometry, focus, and type. */
export const SAMPLE_TASKS: EvalTask[] = [
  { name: 'primary-button', brief: 'a primary action button with default, hover, pressed, and disabled states. Cover: fill colour per state, the label colour on the fill, corner radius, horizontal + vertical padding, focus ring.' },
  { name: 'success-alert', brief: 'a success alert/banner. Cover: the tinted surface background, body text colour, border colour, the success icon colour, corner radius, internal padding.' },
  { name: 'form-field-error', brief: 'a single-line text input in its ERROR state. Cover: field border colour, input text colour, label colour, error-message text colour, focus ring, corner radius, padding.' },
  { name: 'card', brief: 'a content card with a title, body text, and a CTA button. Cover: card surface background, border, corner radius, internal padding/gap, title + body text colours and type styles, the CTA.' },
];

/** An injected model call: prompt in, the model's raw text out. The harness never talks to a
 *  model directly — a keyed shell (or a mock) provides this, keeping this file pure + testable. */
export type ModelRunner = (prompt: string) => Promise<string>;

/**
 * Build the task prompt. `catalog` present ⇒ the WITH-surface arm (the agent is handed the token
 * paths); absent ⇒ the WITHOUT arm (the agent must guess the system's names). Both ask for a
 * strict JSON object mapping each task to the token dotted-paths the agent would reference.
 */
export const buildPrompt = (tasks: EvalTask[], catalog?: string[], wantPairs = false, guidance?: string, skill?: string): string => {
  const cat = catalog
    ? `You have the system's token catalogue — reference ONLY these paths:\n${catalog.join('\n')}\n`
    : `You do NOT have the token catalogue — reference tokens by your best guess of how such a system names them.\n`;
  // Optional semantic guidance (the .ai.json layer): when_to_use / avoid_when / intended contrast per
  // role. Honouring it lets an agent skip contrast checks the raw names can't convey (a decorative
  // border isn't a 3:1 target; a disabled label is exempt) — the metadata differential.
  const withGuidance = guidance ? `${cat}\nSemantic guidance — honour when_to_use / avoid_when / intended contrast (only pair colours where a real contrast contract applies):\n${guidance}\n` : cat;
  // Optional consumption SKILL (the portable-instructions layer): brand-agnostic rules for using the
  // tokens well — semantic-not-primitive, respect modes, the decorative-border / disabled-exempt edges,
  // the pairs self-check. Composes ON TOP of the catalogue; unlike `guidance` (per-brand .ai.json data)
  // it carries no brand-specific role names, so the differential measures whether portable discipline
  // reaches the same compliance the per-brand sidecar did (docs/17 §4).
  const surface = skill ? `${withGuidance}\nConsumption skill — apply these portable rules when choosing and pairing tokens:\n${skill}\n` : withGuidance;
  const taskList = tasks.map((t) => `- **${t.name}**: ${t.brief}`).join('\n');
  const preamble = `You are a frontend engineer building UI components for the "Prism3" design system, referencing design tokens by dotted path (e.g. color.action.default, space.400, radius.md).\n${surface}\n`;
  if (!wantPairs) {
    return `${preamble}For each task, list the token dotted-paths you would reference:\n${taskList}\n\nReturn ONLY a JSON object mapping each task name to an array of token paths:\n{${tasks.map((t) => `"${t.name}": ["..."]`).join(', ')}}`;
  }
  // Pairs mode: also elicit the ink-on-surface colour PAIRINGS so contract-compliance can be scored.
  return `${preamble}For each task, give (a) every design token you'd reference, and (b) the ink-on-surface COLOUR PAIRINGS you'd render — each as {fg, bg, kind} where kind is "text" (body copy, needs 4.5:1), "large-text", or "ui" (borders/icons/large — needs 3:1). Only pair colour roles.\n${taskList}\n\nReturn ONLY a JSON object mapping each task name to {"refs": ["..."], "pairs": [{"fg":"color.…","bg":"color.…","kind":"text"}]}:\n{${tasks.map((t) => `"${t.name}": {"refs":["..."],"pairs":[...]}`).join(', ')}}`;
};

/** Extract the token refs a model returned. Prefers a JSON `{task:[refs]}` object (tolerating
 *  ```json fences and leading/trailing prose); falls back to scraping dotted-path-shaped tokens
 *  from prose so a non-conforming model still yields a flat list. */
export const extractRefs = (text: string): { byTask: Record<string, string[]>; flat: string[] } => {
  const byTask: Record<string, string[]> = {};
  const flat: string[] = [];
  const m = text.match(/\{[\s\S]*\}/);                    // first {...} block (strips fences/prose)
  if (m) {
    try {
      const obj = JSON.parse(m[0]);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        for (const [k, v] of Object.entries(obj)) {
          // A task value is either `[refs]` (refs-only mode) or `{refs, pairs}` (pairs mode).
          const arr = Array.isArray(v) ? v : (v && typeof v === 'object' && Array.isArray((v as any).refs) ? (v as any).refs : []);
          const refs = arr.filter((x: unknown): x is string => typeof x === 'string');
          byTask[k] = refs; flat.push(...refs);
        }
        if (flat.length) return { byTask, flat };
      }
    } catch { /* fall through to regex */ }
  }
  // Fallback: dotted paths (2+ segments, kebab/alnum), optionally brace-wrapped.
  const scraped = text.match(/\{?[a-z][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*){1,}\}?/gi) ?? [];
  const uniq = [...new Set(scraped.map((s) => s.replace(/^\{|\}$/g, '')))];
  return { byTask: { all: uniq }, flat: uniq };
};

/** Extract the ink-on-surface pairs a model returned in pairs mode — the `pairs` array under each
 *  task in `{task: {refs, pairs}}`. Non-conforming entries are skipped; a `fg`+`bg` string pair is
 *  the minimum. Returns per-task + flat. Empty when the output isn't a conforming pairs object. */
export const extractPairs = (text: string): { byTask: Record<string, UsedPair[]>; all: UsedPair[] } => {
  const byTask: Record<string, UsedPair[]> = {};
  const all: UsedPair[] = [];
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      const obj = JSON.parse(m[0]);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        for (const [k, v] of Object.entries(obj)) {
          const raw = (v && typeof v === 'object' && Array.isArray((v as any).pairs)) ? (v as any).pairs : [];
          const pairs: UsedPair[] = raw
            .filter((p: any) => p && typeof p.fg === 'string' && typeof p.bg === 'string')
            .map((p: any) => ({ fg: p.fg, bg: p.bg, ...(p.kind === 'ui' || p.kind === 'large-text' || p.kind === 'text' ? { kind: p.kind } : {}) }));
          if (pairs.length) { byTask[k] = pairs; all.push(...pairs); }
        }
      }
    } catch { /* no pairs recoverable */ }
  }
  return { byTask, all };
};

export type EvalResult = {
  arm: 'with-surface' | 'without-surface';
  byTask: Record<string, ConsumptionScore>;
  aggregate: ConsumptionScore;
  // present only when a `theme` was supplied (pairs mode): did the agent pair colours legibly?
  complianceByTask?: Record<string, ContractCompliance>;
  complianceAggregate?: ContractCompliance;
};

/**
 * Run one arm end-to-end: build the prompt, call the injected runner, extract refs, score each
 * task + the aggregate against the tree. `catalog` present ⇒ the with-surface arm. When `theme`
 * is supplied the prompt also elicits ink-on-surface PAIRS, scored for contract compliance.
 */
export const runEval = async (
  tree: any, root: string, runner: ModelRunner,
  opts: { tasks?: EvalTask[]; catalog?: string[]; theme?: any; guidance?: string; skill?: string } = {},
): Promise<EvalResult> => {
  const tasks = opts.tasks ?? SAMPLE_TASKS;
  const wantPairs = !!opts.theme;
  const output = await runner(buildPrompt(tasks, opts.catalog, wantPairs, opts.guidance, opts.skill));
  const { byTask: refsByTask, flat } = extractRefs(output);
  const byTask: Record<string, ConsumptionScore> = {};
  for (const t of tasks) if (refsByTask[t.name]) byTask[t.name] = scoreConsumption(refsByTask[t.name], tree, root);
  const result: EvalResult = { arm: opts.catalog ? 'with-surface' : 'without-surface', byTask, aggregate: scoreConsumption(flat, tree, root) };
  if (wantPairs) {
    const { byTask: pairsByTask, all } = extractPairs(output);
    const complianceByTask: Record<string, ContractCompliance> = {};
    for (const t of tasks) if (pairsByTask[t.name]) complianceByTask[t.name] = scoreContractCompliance(pairsByTask[t.name], opts.theme);
    result.complianceByTask = complianceByTask;
    result.complianceAggregate = scoreContractCompliance(all, opts.theme);
  }
  return result;
};
