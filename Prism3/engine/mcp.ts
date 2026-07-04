/**
 * Prism3 engine — MCP adapter (docs/08 §5, roadmap C: "an agent themes Prism3").
 *
 * An agent-callable surface over the pure core. **Dependency-free JSON-RPC 2.0 over
 * stdio** — deliberately NO `@modelcontextprotocol/sdk`: MCP is just JSON-RPC plus a
 * three-method core (`initialize` / `tools/list` / `tools/call`), so we own the
 * transport the same way the engine owns its YAML parser and colour math. Keeps the
 * no-`npm install` invariant (docs/07 §3) and fits the "pure core, hosts at the edges"
 * posture (docs/15): this file is an **I/O SHELL** — `node:` is allowed here, the pure
 * core (`theme`/`tree`/`modes`/`ai-metadata`/`levers`) is imported and never modified.
 *
 * The request handler `handleRpc` + `callTool` are PURE and unit-tested directly; only
 * the stdio read/write loop behind `isMain` touches the process. Tools:
 *
 *   • list_levers    — the lever manifest: what an agent can turn (labels, groups, knob
 *                      types, enums, defaults, ranges). The presentation catalogue, the
 *                      same one the plugin + playground render from (continuity by source).
 *   • theme_brand    — a `BrandInput` (shape = `schema/theme-schema.json`) → the DTCG token
 *                      tree + `.ai.json` agent metadata + per-mode contrast-contract results
 *                      + the decisions log. The generate-and-verify payoff over one call.
 *   • validate_brand — a `BrandInput` → schema errors (or ok), without generating.
 *
 * The knob CATALOGUE derives from the lever manifest (list_levers); the input SHAPE is
 * `theme-schema.json` (the manifest is presentation, the schema is the precise OKLCH-aware
 * validation half — a `control:'color'` lever is an OKLCH object, not a string).
 *
 * Run: `npx tsx Prism3/engine/mcp.ts`  (speaks MCP over stdin/stdout; point a client at it).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { brandTheme, BrandInput } from './theme';
import { buildTree, validateBrandInput } from './emit-dtcg';
import { buildAiMetadata } from './ai-metadata';
import { buildLeverManifest } from './levers';

export const SERVER_INFO = { name: 'prism3-engine', version: '0.1.0' };
export const PROTOCOL_VERSION = '2024-11-05';

export type RpcId = number | string | null;
export type RpcRequest = { jsonrpc?: string; id?: RpcId; method: string; params?: any };
export type RpcResponse = { jsonrpc: '2.0'; id: RpcId; result?: unknown; error?: { code: number; message: string; data?: unknown } };
type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean };

/** Tool catalogue. `theme_brand`/`validate_brand` take a `BrandInput`, so their inputSchema
 *  IS the BrandInput schema (passed in — the shell loads it, `handleRpc` stays pure). */
export const toolDefs = (brandSchema: unknown) => [
  {
    name: 'list_levers',
    description: 'List every BrandInput control an agent can set — grouped, labelled, typed, with enums, defaults and UI ranges. The knob catalogue (the same lever manifest the Figma plugin and web playground render from). Call this first to learn what theme_brand accepts.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'theme_brand',
    description: 'Generate a full design-token system from a brand input. Returns the DTCG token tree (colour ramps + semantic roles across light/dark/high-contrast modes, dimension, typography, motion, shadow, layout), the .ai.json agent metadata (per-token rationale, consumers, avoid_when), the per-mode contrast-contract results (every a11y pair, computed on the resolved colours), and the decisions log. Arguments are a BrandInput — call list_levers to see the controls, or validate_brand to check one first.',
    inputSchema: brandSchema,
  },
  {
    name: 'validate_brand',
    description: 'Validate a BrandInput against the engine schema WITHOUT generating. Returns { valid, errors } — a fast pre-flight before theme_brand.',
    inputSchema: brandSchema,
  },
];

const text = (obj: unknown, isError = false): ToolResult =>
  ({ content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2) }], ...(isError ? { isError: true } : {}) });

/** Dispatch a tools/call. Pure — imports of the core are all pure functions. Tool-level
 *  failures (bad brand, generation throw) come back as `isError` results, not RPC errors,
 *  per the MCP convention (the call succeeded; the tool reported a problem). */
export const callTool = (name: string, args: any): ToolResult => {
  if (name === 'list_levers') return text(buildLeverManifest());

  if (name === 'validate_brand') {
    const errors = validateBrandInput(args);
    return text({ valid: errors.length === 0, errors });
  }

  if (name === 'theme_brand') {
    const errors = validateBrandInput(args);
    if (errors.length) return text({ error: 'BrandInput failed schema validation', errors }, true);
    let theme;
    try { theme = brandTheme(args as BrandInput); }
    catch (e) { return text({ error: `brandTheme failed: ${(e as Error).message}` }, true); }
    const { tree, modes, stats } = buildTree(theme);
    let checks = 0, pass = 0; const failures: string[] = [];
    for (const m of modes) for (const [k, r] of Object.entries(m.roles)) {
      const rr = r as { min: number; ratio: number };
      if (rr.min > 0) { checks++; if (rr.ratio >= rr.min) pass++; else failures.push(`${m.mode}.${k} ${rr.ratio}<${rr.min}`); }
    }
    return text({
      id: theme.id,
      tokens: tree,
      aiMetadata: buildAiMetadata(theme, tree),
      contracts: { checks, pass, failures },
      aliases: { total: stats.aliases, resolved: stats.resolved, broken: stats.broken },
      notes: theme.notes,
    });
  }

  return text({ error: `unknown tool: ${name}` }, true);
};

/** Handle one JSON-RPC message. Returns the response, or `null` for a notification
 *  (which gets no reply). Pure: `brandSchema` is injected so there is no file I/O here. */
export const handleRpc = (req: RpcRequest, brandSchema: unknown): RpcResponse | null => {
  const id = req.id ?? null;
  const ok = (result: unknown): RpcResponse => ({ jsonrpc: '2.0', id, result });
  const err = (code: number, message: string): RpcResponse => ({ jsonrpc: '2.0', id, error: { code, message } });

  switch (req.method) {
    case 'initialize':
      return ok({ protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: SERVER_INFO });
    case 'notifications/initialized':
    case 'initialized':
      return null; // notification — no response
    case 'ping':
      return ok({});
    case 'tools/list':
      return ok({ tools: toolDefs(brandSchema) });
    case 'tools/call': {
      const name = req.params?.name;
      if (!name) return err(-32602, 'tools/call requires params.name');
      return ok(callTool(name, req.params?.arguments ?? {}));
    }
    default:
      return err(-32601, `method not found: ${req.method}`);
  }
};

// --------------------------------------------------------------------------- I/O shell
// stdio transport: newline-delimited JSON-RPC (MCP messages carry no embedded newlines).
// Read stdin, dispatch each line, write single-line responses to stdout; stderr is the log.
const isMain = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMain) {
  const here = dirname(fileURLToPath(import.meta.url));
  const brandSchema = JSON.parse(readFileSync(resolve(here, '../schema/theme-schema.json'), 'utf8'));
  const send = (msg: RpcResponse) => process.stdout.write(JSON.stringify(msg) + '\n');
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk: string) => {
    buf += chunk;
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let req: RpcRequest;
      try { req = JSON.parse(line); }
      catch { send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }); continue; }
      let res: RpcResponse | null;
      try { res = handleRpc(req, brandSchema); }
      catch (e) { res = { jsonrpc: '2.0', id: req.id ?? null, error: { code: -32603, message: `internal error: ${(e as Error).message}` } }; }
      if (res) send(res);
    }
  });
  process.stderr.write('prism3 MCP server ready (stdio) — tools: list_levers, theme_brand, validate_brand\n');
}
