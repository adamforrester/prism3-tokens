/**
 * Prism3 engine — consumption-eval scoring core (docs/17, roadmap C follow-on).
 *
 * Measures whether an agent handed the MCP surface (`theme_brand` / `list_levers`, `mcp.ts`)
 * produced COMPLIANT output — turning "MCP-first > screenshot-first" (docs/07 §15) from an
 * assertion into a number. This is the **pure, deterministic** scoring half: given the token
 * refs an agent's output uses + the generated token tree, compute two mechanical metrics that
 * need no LLM judge (cheap because the name contract is locked — docs/11 names-are-the-API):
 *
 *   • invented-token rate — refs to token paths that DON'T exist in the tree (the hallucination
 *                           metric; ds-brain's "invented-component rate" adapted to tokens, docs/13).
 *   • primitive-leak rate — valid refs that reach PAST the semantic layer into a raw primitive
 *                           tier (`palette` / `dimension` / `font` — exactly the `core-*` tiers).
 *                           A consumer should reach for `color.action.default`, not `palette.primary.600`.
 *
 * PURE — no `node:*`, no I/O. The agent-in-the-loop harness (run a model on sample tasks against
 * the MCP server, extract its token refs, score them here) is a separate edge shell (docs/17 §3);
 * this module is the gate it scores against. Contract-compliance scoring (did the fg/bg pairs the
 * agent used clear the mode contracts?) is the next metric — deferred to the harness phase (§4).
 */

/** Token tiers a consumer should NOT reference directly — the raw primitives the semantic
 *  layer is built from. Matches the `core-palette` / `core-dimension` / `core-font` grouping. */
export const PRIMITIVE_TIERS = new Set(['palette', 'dimension', 'font']);

export type ConsumptionScore = {
  total: number;              // token refs examined
  valid: number;              // refs that resolve to a real leaf in the tree
  invented: string[];         // refs that resolve to nothing (hallucinated) — sorted, unique
  inventedRate: number;       // invented.length / total  (0 when total is 0)
  primitiveLeaks: string[];   // valid refs that point into a primitive tier — sorted, unique
  primitiveLeakRate: number;  // primitiveLeaks.length / valid  (0 when valid is 0)
};

/** Normalise a token ref to a root-relative dotted path. Accepts brace syntax (`{...}`),
 *  a root-qualified path (`prism.color.action.default`), or an already-relative path;
 *  strips a `$value`-style trailing segment nobody writes. `root` is the brand namespace. */
export const normalizeRef = (ref: string, root: string): string => {
  let r = ref.trim().replace(/^\{|\}$/g, '');            // drop brace wrapper
  if (r.startsWith(`${root}.`)) r = r.slice(root.length + 1); // drop the namespace prefix
  return r;
};

/** Every root-relative leaf path in a built tree (nodes carrying `$value`/`$type`). */
export const tokenPaths = (tree: any, root: string): Set<string> => {
  const paths = new Set<string>();
  const node = tree?.[root];
  const walk = (n: any, p: string[]): void => {
    if (!n || typeof n !== 'object') return;
    if (n.$value !== undefined || n.$type !== undefined) { paths.add(p.join('.')); return; }
    for (const [k, v] of Object.entries(n)) if (!k.startsWith('$')) walk(v, [...p, k]);
  };
  if (node) for (const [k, v] of Object.entries(node)) if (!k.startsWith('$')) walk(v, [k]);
  return paths;
};

/** True if a root-relative token path reaches into a raw primitive tier (palette/dimension/font). */
export const isPrimitiveRef = (path: string): boolean => PRIMITIVE_TIERS.has(path.split('.')[0]);

/**
 * Score the token refs an agent's output uses against the generated tree. `refs` are token
 * references however the agent wrote them (brace / root-qualified / relative — normalised here).
 * Invented = doesn't resolve; primitive-leak = resolves but into a raw primitive tier.
 */
export const scoreConsumption = (refs: string[], tree: any, root: string): ConsumptionScore => {
  const valid = tokenPaths(tree, root);
  const inventedSet = new Set<string>(), leakSet = new Set<string>();
  let validCount = 0, inventedCount = 0, leakCount = 0;    // occurrence counts drive the rates
  for (const raw of refs) {
    const ref = normalizeRef(raw, root);
    if (valid.has(ref)) { validCount++; if (isPrimitiveRef(ref)) { leakCount++; leakSet.add(ref); } }
    else { inventedCount++; inventedSet.add(ref); }
  }
  return {
    total: refs.length,
    valid: validCount,
    invented: [...inventedSet].sort(),                     // unique for reporting; rate is occurrence-based
    inventedRate: refs.length ? inventedCount / refs.length : 0,
    primitiveLeaks: [...leakSet].sort(),
    primitiveLeakRate: validCount ? leakCount / validCount : 0,
  };
};
