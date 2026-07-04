/**
 * Prism3 engine — `design.md` parser (pure, dependency-free).
 *
 * `design.md` is the authoring front door (docs/07 §6): a brand brief whose YAML
 * frontmatter compiles 1:1 to a `BrandInput` (the engine's validated IR), and
 * whose trailing prose is latitude an agent reads to make the judgment calls the
 * frontmatter can't encode. This module owns the frontmatter half.
 *
 * WHY a hand-rolled parser. The engine is dependency-free by design (no npm
 * install — the colour math is self-contained), and Node ships no YAML parser.
 * So, in the same spirit as owning `color.ts`, the CLI owns a minimal YAML-SUBSET
 * parser scoped to the `BrandInput` shape rather than pulling `js-yaml`. It is
 * pure (no `node:*`, no I/O): the file read lives in the I/O shell (cli.ts /
 * emit-dtcg.ts), keeping this on the portable core side of the fence (docs/07 §3).
 *
 * The supported subset (everything `BrandInput` uses, nothing it doesn't):
 *  - block mappings (indentation-nested `key: value`)
 *  - block sequences (`- item`, including sequences of mappings)
 *  - flow mappings  `{ l: 0.5, c: 0.18, h: 285 }`   (compact leaves)
 *  - flow sequences `[0, 480, 768, 1024]`
 *  - scalars: numbers, booleans, null, quoted + bare strings
 *  - `#` line comments (whole-line and quote/bracket-aware trailing)
 * Anchors, multi-doc, block scalars (`|`/`>`), merge keys — deliberately absent.
 *
 * `parseDesignMd(text)` returns the parsed frontmatter as a `BrandInput` plus the
 * raw prose. It does NOT validate against the schema — that is the caller's job
 * (cli.ts runs the shared `validateBrandInput`), keeping parse and validate as
 * separable steps.
 */
import { BrandInput } from './theme';

export type DesignMd = { input: BrandInput; prose: string };

// --- scalar typing: bare YAML scalar string → typed JS value ------------------
const unquote = (s: string): string => {
  const t = s.trim();
  if (t.length >= 2 && ((t[0] === '"' && t[t.length - 1] === '"') || (t[0] === "'" && t[t.length - 1] === "'"))) {
    return t.slice(1, -1);
  }
  return t;
};
const isQuoted = (s: string): boolean => {
  const t = s.trim();
  return t.length >= 2 && ((t[0] === '"' && t[t.length - 1] === '"') || (t[0] === "'" && t[t.length - 1] === "'"));
};
const typeScalar = (raw: string): unknown => {
  const t = raw.trim();
  if (isQuoted(t)) return unquote(t);                       // quoted → always a string ("3:1")
  if (t === '' || t === 'null' || t === '~') return null;
  if (t === 'true') return true;
  if (t === 'false') return false;
  // A JSON number (int/float/exponent/sign). Bare strings like `snappy`, `compact`,
  // `primary` fall through to string — this is the only place we widen to string.
  if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t)) return Number(t);
  return t;
};

// --- flow parser: `{ ... }` / `[ ... ]` one-liner leaves ----------------------
// A small recursive-descent parser for inline flow collections with unquoted keys
// and unquoted scalar values (the natural, compact YAML leaf form).
const parseFlow = (src: string): unknown => {
  let i = 0;
  const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };
  const scanBare = (stops: string): string => {           // scalar until a structural char
    const start = i;
    let depth = 0, q = '';
    while (i < src.length) {
      const c = src[i];
      if (q) { if (c === q) q = ''; i++; continue; }
      if (c === '"' || c === "'") { q = c; i++; continue; }
      if (c === '{' || c === '[') { depth++; i++; continue; }
      if (c === '}' || c === ']') { if (depth === 0) break; depth--; i++; continue; }
      if (depth === 0 && stops.includes(c)) break;
      i++;
    }
    return src.slice(start, i);
  };
  const value = (): unknown => {
    ws();
    if (src[i] === '{') return map();
    if (src[i] === '[') return seq();
    return typeScalar(scanBare(',}]'));
  };
  const map = (): Record<string, unknown> => {
    const o: Record<string, unknown> = {};
    i++; ws();                                             // skip '{'
    if (src[i] === '}') { i++; return o; }
    while (i < src.length) {
      ws();
      const key = unquote(scanBare(':')).trim();
      i++;                                                 // skip ':'
      o[key] = value();
      ws();
      if (src[i] === ',') { i++; continue; }
      i++; break;                                          // skip '}'
    }
    return o;
  };
  const seq = (): unknown[] => {
    const a: unknown[] = [];
    i++; ws();                                             // skip '['
    if (src[i] === ']') { i++; return a; }
    while (i < src.length) {
      a.push(value());
      ws();
      if (src[i] === ',') { i++; continue; }
      i++; break;                                          // skip ']'
    }
    return a;
  };
  return value();
};

const parseScalarOrFlow = (s: string): unknown => {
  const t = s.trim();
  return t[0] === '{' || t[0] === '[' ? parseFlow(t) : typeScalar(t);
};

// --- comment stripping: drop `#` comments outside quotes and flow brackets -----
const stripComment = (line: string): string => {
  let q = '', depth = 0;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === q) q = ''; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') depth = Math.max(0, depth - 1);
    // A `#` starts a comment only at line start or after whitespace (YAML rule),
    // and only outside quotes / flow collections.
    else if (c === '#' && depth === 0 && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i);
  }
  return line;
};

// --- block parser: indentation-driven recursive descent -----------------------
type Line = { indent: number; content: string; src?: number };  // src = 1-based source line (for errors)
const colonSplit = (s: string): number => {              // top-level `key:` colon (outside quotes/flow)
  let q = '', depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === q) q = ''; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') depth = Math.max(0, depth - 1);
    else if (c === ':' && depth === 0) return i;
  }
  return -1;
};

const parseBlock = (lines: Line[]): Record<string, unknown> => {
  let pos = 0;
  const block = (indent: number): unknown =>
    lines[pos].content.startsWith('- ') || lines[pos].content === '-' ? seq(indent) : map(indent);

  const map = (indent: number): Record<string, unknown> => {
    const o: Record<string, unknown> = {};
    while (pos < lines.length && lines[pos].indent === indent && !lines[pos].content.startsWith('- ')) {
      const line = lines[pos].content;
      const ci = colonSplit(line);
      if (ci < 0) break;                                   // not a mapping line at this level
      const key = unquote(line.slice(0, ci)).trim();
      const rest = line.slice(ci + 1).trim();
      pos++;
      if (rest !== '') { o[key] = parseScalarOrFlow(rest); continue; }
      // Empty value → nested block on the following deeper lines. A block sequence
      // may sit at the key's own indent (common YAML) or deeper; a nested mapping
      // must be strictly deeper.
      const next = lines[pos];
      const nextIsSeq = next && (next.content.startsWith('- ') || next.content === '-');
      if (next && (next.indent > indent || (nextIsSeq && next.indent === indent))) o[key] = block(next.indent);
      else o[key] = null;
    }
    return o;
  };

  const seq = (indent: number): unknown[] => {
    const a: unknown[] = [];
    while (pos < lines.length && lines[pos].indent === indent &&
           (lines[pos].content.startsWith('- ') || lines[pos].content === '-')) {
      const after = lines[pos].content === '-' ? '' : lines[pos].content.slice(2);
      if (after !== '' && colonSplit(after) >= 0) {
        // Sequence of mappings: the item's first key is inline after `- `; its
        // remaining keys are deeper lines. Re-home the current line as the first
        // line of a mapping at a virtual indent, then let map() consume the rest.
        const virtual = indent + 2;
        lines[pos] = { indent: virtual, content: after, src: lines[pos].src };
        a.push(map(virtual));
      } else if (after === '') {
        // `-` on its own line → the item is the nested block beneath it.
        pos++;
        const next = lines[pos];
        if (next && next.indent > indent) a.push(block(next.indent));
        else a.push(null);
      } else {
        a.push(parseScalarOrFlow(after));
        pos++;
      }
    }
    return a;
  };

  const result = map(lines.length ? lines[0].indent : 0);
  // CR-05: every line must be consumed. A misindented line (or a stray no-colon/prose line)
  // ends the map/seq loop early — leaving it AND everything after it unparsed. Silently
  // dropping a designer's lever is the worst failure here, so fail LOUD at the first orphan.
  if (pos < lines.length) {
    const bad = lines[pos];
    throw new Error(`design.md: unparseable frontmatter at line ${bad.src ?? '?'} — "${bad.content}" (indent ${bad.indent}). This line's indentation doesn't fit its block, which would otherwise silently drop it and every line after it. Fix the indentation / structure.`);
  }
  return result;
};

/** Parse YAML-frontmatter source (no fences) into a plain object. */
export const parseYamlSubset = (src: string): Record<string, unknown> => {
  const lines: Line[] = [];
  const rawLines = src.split('\n');
  for (let i = 0; i < rawLines.length; i++) {
    const stripped = stripComment(rawLines[i]);
    if (stripped.trim() === '') continue;                  // blank / comment-only
    const indent = stripped.length - stripped.trimStart().length;
    lines.push({ indent, content: stripped.slice(indent).trimEnd(), src: i + 1 });
  }
  return lines.length ? parseBlock(lines) : {};
};

/**
 * Parse a `design.md` file: split the `---`-fenced YAML frontmatter from the
 * trailing prose, compile the frontmatter to a `BrandInput`. Throws with a clear
 * message if the frontmatter fence is missing (an unfenced file is a mistake, not
 * an empty brand). The returned `input` is NOT yet schema-validated.
 */
export const parseDesignMd = (text: string): DesignMd => {
  const nl = text.indexOf('\n');
  const firstLine = (nl < 0 ? text : text.slice(0, nl)).trim();
  if (firstLine !== '---') {
    throw new Error("design.md must open with a '---' YAML frontmatter fence on the first line");
  }
  const rest = text.slice(nl + 1);
  const close = rest.indexOf('\n---');
  if (close < 0) throw new Error("design.md frontmatter is not closed with a '---' line");
  const fm = rest.slice(0, close);
  // Prose = everything after the closing fence line.
  const afterFence = rest.slice(close + 4);
  const proseStart = afterFence.indexOf('\n');
  const prose = (proseStart < 0 ? '' : afterFence.slice(proseStart + 1)).trim();
  return { input: parseYamlSubset(fm) as unknown as BrandInput, prose };
};

// --- serialize: BrandInput → design.md (the inverse of parseDesignMd) ----------
// Emits each DEFINED top-level key as a one-line flow value, so the existing flow
// parser reads it straight back — `parseDesignMd(toDesignMd(x)).input` deep-equals
// `x` (gated in test.ts). Only own defined keys are emitted: an omitted optional
// (e.g. no `root`) stays omitted, preserving the exact round-trip. Prose, if given,
// follows the closing fence. Pairs with `parseDesignMd` for the E2E export leg.
const bareOk = (s: string): boolean =>
  s.length > 0 && s.trim() === s && !/[,{}[\]:#"']/.test(s) &&
  !/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s) && !['true', 'false', 'null', '~'].includes(s);
const serScalar = (v: unknown): string => {
  if (v === null) return 'null';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  const s = String(v);
  return bareOk(s) ? s : `"${s.replace(/"/g, '\\"')}"`;
};
const serValue = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.map(serValue).join(', ')}]`;
  if (v && typeof v === 'object') {
    const body = Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => x !== undefined)
      .map(([k, x]) => `${bareOk(k) ? k : `"${k}"`}: ${serValue(x)}`)
      .join(', ');
    return `{ ${body} }`;
  }
  return serScalar(v);
};

/** Serialize a `BrandInput` to `design.md` text (frontmatter + optional prose). */
export const toDesignMd = (input: BrandInput, prose = ''): string => {
  const fm = Object.entries(input as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${serValue(v)}`);
  const body = prose.trim();
  return `---\n${fm.join('\n')}\n---\n${body ? `\n${body}\n` : ''}`;
};
