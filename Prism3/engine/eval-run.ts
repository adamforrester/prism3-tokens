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
import { scoreConsumption, ConsumptionScore } from './eval';

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
export const buildPrompt = (tasks: EvalTask[], catalog?: string[]): string => {
  const surface = catalog
    ? `You have the system's token catalogue — reference ONLY these paths:\n${catalog.join('\n')}\n`
    : `You do NOT have the token catalogue — reference tokens by your best guess of how such a system names them.\n`;
  const taskList = tasks.map((t) => `- **${t.name}**: ${t.brief}`).join('\n');
  return `You are a frontend engineer building UI components for the "Prism3" design system, referencing design tokens by dotted path (e.g. color.action.default, space.400, radius.md).\n${surface}\nFor each task, list the token dotted-paths you would reference:\n${taskList}\n\nReturn ONLY a JSON object mapping each task name to an array of token paths:\n{${tasks.map((t) => `"${t.name}": ["..."]`).join(', ')}}`;
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
          const refs = (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === 'string');
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

export type EvalResult = {
  arm: 'with-surface' | 'without-surface';
  byTask: Record<string, ConsumptionScore>;
  aggregate: ConsumptionScore;
};

/**
 * Run one arm end-to-end: build the prompt, call the injected runner, extract refs, score each
 * task + the aggregate against the tree. `catalog` present ⇒ the with-surface arm.
 */
export const runEval = async (
  tree: any, root: string, runner: ModelRunner,
  opts: { tasks?: EvalTask[]; catalog?: string[] } = {},
): Promise<EvalResult> => {
  const tasks = opts.tasks ?? SAMPLE_TASKS;
  const output = await runner(buildPrompt(tasks, opts.catalog));
  const { byTask: refsByTask, flat } = extractRefs(output);
  const byTask: Record<string, ConsumptionScore> = {};
  for (const t of tasks) if (refsByTask[t.name]) byTask[t.name] = scoreConsumption(refsByTask[t.name], tree, root);
  return { arm: opts.catalog ? 'with-surface' : 'without-surface', byTask, aggregate: scoreConsumption(flat, tree, root) };
};
