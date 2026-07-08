/**
 * Prism3 engine — MATERIALISE-TO-FIGMA (the round-trip payload generator).
 *
 * Turns the emitted raw-figma export (`out/figma/<brand>/`) into the deterministic
 * plugin-JS payloads you paste into `figma_execute` to build the variables in a real
 * Figma file. It exists because the two "smart" paths both drop the semantics the
 * docs/10 §3 contract enforces:
 *   - `figma_import_tokens` is DTCG-only — our export is raw-figma-shaped.
 *   - `figma_batch_create_variables` can't set scopes / description / hiddenFromPublishing.
 * So the only faithful path is executing the Variables plugin API directly, which is
 * fiddly to hand-roll — this shell makes it one deterministic `tsx` invocation.
 *
 * It encodes the hard-won materialisation rules (see docs/10 §3 + the #84 round-trip):
 *   - **Collection ordering** — `core-palette` (primitives) first; the `color` collection's
 *     aliases can only bind once the palette var IDs exist.
 *   - **Two-pass colour write** — pass A creates every var + literal fallback values in all
 *     modes; pass B rebinds aliases. Alias targets must exist before binding.
 *   - **PER-MODE alias binding** — pass B binds *each mode to its own target* (the #84
 *     round-trip caught a hand-rolled script that bound light's target to all four modes,
 *     collapsing every mode to identical values). This generator reads each mode file's own
 *     alias target, so the collapse can't happen.
 *   - **Payload budget** — data is embedded compactly (scope codes, array rows); each pass is
 *     a separate `figma_execute` call so no single payload blows the budget.
 *   - **API-probe verification** — the `verify` pass reads back via `getLocalVariablesAsync`
 *     (authoritative for scopes / aliases / modes / hidden), and asserts **modes are distinct**
 *     (the collapse guard) + reports the interactive/disabled slot scopes.
 *
 * SHELL (not pure): reads `out/figma/<brand>/`, prints plugin JS to stdout. No Figma I/O
 * here — the emitter lane pastes the output into `figma_execute`.
 *
 *   npx tsx Prism3/engine/materialise-to-figma.ts <brand>            # manifest: passes + byte sizes
 *   npx tsx Prism3/engine/materialise-to-figma.ts <brand> --pass palette
 *   npx tsx Prism3/engine/materialise-to-figma.ts <brand> --pass color-create
 *   npx tsx Prism3/engine/materialise-to-figma.ts <brand> --pass color-aliases
 *   npx tsx Prism3/engine/materialise-to-figma.ts <brand> --pass verify
 *
 * Scope today: the `core-palette` + `color` collections (what the round-trip re-test needs).
 * Other axes (dims / layout / font / shadow) can be added the same way when needed.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

// Canonical mode order (matches emit-figma's COLOR_MODES); wireframe is opt-in and only
// present for brands that generate it.
const MODE_ORDER = ['light', 'dark', 'hc-light', 'hc-dark', 'wireframe'] as const;

// Compact scope codes — keep the colour payload inside the figma_execute budget. Decoded
// back to the Figma enum inside the generated plugin JS (SC map below must mirror this).
const SCOPE_CODE: Record<string, string> = {
  FRAME_FILL: 'f', SHAPE_FILL: 's', TEXT_FILL: 't', STROKE_COLOR: 'k',
};
const encodeScopes = (scopes: string[]): string =>
  scopes.map((s) => SCOPE_CODE[s] ?? '?').sort().join('');

type FigmaVar = {
  name: string; resolvedType: string; scopes: string[]; description: string;
  value: { r: number; g: number; b: number; a: number };
  alias: { type: string; name: string } | null; hiddenFromPublishing?: boolean;
};
type FigmaFile = { $collection: string; $mode: string; variables: FigmaVar[] };

const round = (n: number) => Math.round(n * 1e5) / 1e5;
const rgba = (v: FigmaVar['value']) => ({ r: round(v.r), g: round(v.g), b: round(v.b), a: round(v.a) });

const load = (brand: string, file: string): FigmaFile => {
  const p = resolve(HERE, `out/figma/${brand}/${file}`);
  if (!existsSync(p)) throw new Error(`missing emitted file: ${p} — run \`npx tsx Prism3/engine/emit-figma.ts\` first`);
  return JSON.parse(readFileSync(p, 'utf8'));
};

// Which colour modes did this brand emit? (light/dark/hc-* always; wireframe if opted in.)
const colourModes = (brand: string): string[] =>
  MODE_ORDER.filter((m) => existsSync(resolve(HERE, `out/figma/${brand}/color.${m}.json`)));

// ---- the SC decode map + shared helpers, injected into every plugin payload -----------
const PRELUDE = `const SC={f:'FRAME_FILL',s:'SHAPE_FILL',t:'TEXT_FILL',k:'STROKE_COLOR'};
const decode=(c)=>[...c].map(x=>SC[x]);
const cols=async()=>figma.variables.getLocalVariableCollectionsAsync();
const findCol=async(n)=>(await cols()).find(c=>c.name===n);`;

// ---- pass: palette (core-palette, one Default mode, literal values, hidden primitives) --
const palettePass = (brand: string): string => {
  const pal = load(brand, 'core-palette.json');
  // row: [name, scopeCode, description, value, hidden]
  const P = pal.variables.map((v) => [v.name, encodeScopes(v.scopes), v.description, rgba(v.value), v.hiddenFromPublishing ? 1 : 0]);
  return `(async()=>{
${PRELUDE}
const P=${JSON.stringify(P)};
let col=await findCol('core-palette');
if(!col)col=figma.variables.createVariableCollection('core-palette');
const mode=col.modes[0].modeId;
const have=new Map((await figma.variables.getLocalVariablesAsync()).filter(v=>v.variableCollectionId===col.id).map(v=>[v.name,v]));
let created=0;
for(const [name,sc,desc,val,hidden] of P){
  let v=have.get(name);
  if(!v){v=figma.variables.createVariable(name,col,'COLOR');created++;}
  v.scopes=decode(sc);v.description=desc;v.hiddenFromPublishing=!!hidden;
  v.setValueForMode(mode,val);
}
return {collection:'core-palette',total:P.length,created};
})()`;
};

// ---- pass: color-create (color collection, N modes, literal fallback values) -----------
const colorCreatePass = (brand: string): string => {
  const modes = colourModes(brand);
  const files = modes.map((m) => load(brand, `color.${m}.json`));
  const base = files[0].variables;
  // row: [name, scopeCode, description, [value per mode, in `modes` order]]
  const C = base.map((v, i) => [
    v.name, encodeScopes(v.scopes), v.description,
    files.map((f) => rgba(f.variables[i].value)),
  ]);
  return `(async()=>{
${PRELUDE}
const MODES=${JSON.stringify(modes)};
const C=${JSON.stringify(C)};
let col=await findCol('color');
if(!col)col=figma.variables.createVariableCollection('color');
col.renameMode(col.modes[0].modeId,MODES[0]);
const modeIds={[MODES[0]]:col.modes[0].modeId};
for(let i=1;i<MODES.length;i++){const m=col.modes.find(x=>x.name===MODES[i]);modeIds[MODES[i]]=m?m.modeId:col.addMode(MODES[i]);}
const have=new Map((await figma.variables.getLocalVariablesAsync()).filter(v=>v.variableCollectionId===col.id).map(v=>[v.name,v]));
let created=0;
for(const [name,sc,desc,vals] of C){
  let v=have.get(name);
  if(!v){v=figma.variables.createVariable(name,col,'COLOR');created++;}
  v.scopes=decode(sc);v.description=desc;
  MODES.forEach((m,i)=>v.setValueForMode(modeIds[m],vals[i]));
}
return {collection:'color',modes:MODES,total:C.length,created};
})()`;
};

// The per-mode alias targets for the colour collection: one row per variable,
// `[name, [target-name per mode, in `modes` order]]`. Exported + pure so the suite can
// assert the rows are DISTINCT per mode — locking the collapse-proofing (each mode binds
// its OWN target, not light's for all four) into the gate without needing a live Figma.
export type AliasRow = [string, (string | null)[]];
export const aliasRows = (brand: string): { modes: string[]; rows: AliasRow[] } => {
  const modes = colourModes(brand);
  const files = modes.map((m) => load(brand, `color.${m}.json`));
  const base = files[0].variables;
  const rows: AliasRow[] = base.map((v, i) => [v.name, files.map((f) => f.variables[i].alias?.name ?? null)]);
  return { modes, rows };
};

// ---- pass: color-aliases (rebind PER MODE — the collapse-proof pass) --------------------
const colorAliasesPass = (brand: string): string => {
  const { modes, rows: A } = aliasRows(brand);
  return `(async()=>{
${PRELUDE}
const MODES=${JSON.stringify(modes)};
const A=${JSON.stringify(A)};
const vars=await figma.variables.getLocalVariablesAsync();
const byName=new Map(vars.map(v=>[v.name,v]));
const col=await findCol('color');
const modeIds={};for(const m of MODES){const mm=col.modes.find(x=>x.name===m);modeIds[m]=mm&&mm.modeId;}
let bound=0;const misses=[];
for(const [name,targets] of A){
  const v=byName.get(name);
  if(!v){misses.push('var:'+name);continue;}
  MODES.forEach((m,i)=>{
    const t=targets[i];if(!t)return;
    const tv=byName.get(t);
    if(!tv){misses.push(name+' @'+m+' -> '+t);return;}
    v.setValueForMode(modeIds[m],figma.variables.createVariableAlias(tv));bound++;
  });
}
return {bound,expected:A.length*MODES.length,misses};
})()`;
};

// ---- pass: verify (API-probe read-back; the collapse guard lives here) ------------------
const verifyPass = (brand: string): string => {
  const modes = colourModes(brand);
  return `(async()=>{
${PRELUDE}
const MODES=${JSON.stringify(modes)};
const vars=await figma.variables.getLocalVariablesAsync();
const col=await findCol('color');
const cvars=vars.filter(v=>v.variableCollectionId===col.id);
const byName=new Map(cvars.map(v=>[v.name,v]));
const modeIds={};MODES.forEach(m=>{const mm=col.modes.find(x=>x.name===m);modeIds[m]=mm&&mm.modeId;});
const targetOf=(val)=>val&&val.type==='VARIABLE_ALIAS'?(vars.find(x=>x.id===val.id)||{}).name:JSON.stringify(val);
// modes-distinct guard: background/primary must NOT be identical across modes (the collapse bug)
const probe=byName.get('color/background/primary');
const perMode=Object.fromEntries(MODES.map(m=>[m,targetOf(probe&&probe.valuesByMode[modeIds[m]])]));
const modesDistinct=new Set(Object.values(perMode)).size>1;
const scope=(n)=>{const v=byName.get(n);return v?[...v.scopes].sort().join(','):'ABSENT';};
const absent=(n)=>!byName.has(n);
return {
  colorVars:cvars.length,
  modes:col.modes.map(m=>m.name),
  modesDistinct,
  backgroundPrimaryByMode:perMode,
  slotScopes:{
    'interactive/primary/text':scope('color/interactive/primary/text'),
    'interactive/primary/border':scope('color/interactive/primary/border'),
    'disabled/fill':scope('color/disabled/fill'),
    'disabled/on-fill':scope('color/disabled/on-fill'),
    'disabled/text':scope('color/disabled/text'),
    'disabled/icon':scope('color/disabled/icon'),
    'disabled/border':scope('color/disabled/border'),
    'field/fill':scope('color/field/fill'),
    'field/border':scope('color/field/border'),
    'field/placeholder':scope('color/field/placeholder'),
  },
  fieldFamilyPresent:['color/field/fill','color/field/border','color/field/placeholder'].every(n=>byName.has(n)),
  retiredRolesAbsent:['color/action/default','color/text/on-action','color/text/on-disabled','color/foreground/danger/default'].every(absent),
  // renamed by #86 (.surface -> .fill / .on-disabled -> .on-fill) + field never used .surface — all must be gone.
  renamedRolesAbsent:['color/disabled/surface','color/disabled/on-disabled','color/field/surface'].every(absent),
  bareDangerPresent:byName.has('color/foreground/danger'),
};
})()`;
};

// ---- CLI --------------------------------------------------------------------------------
const PASSES: Record<string, (b: string) => string> = {
  palette: palettePass, 'color-create': colorCreatePass, 'color-aliases': colorAliasesPass, verify: verifyPass,
};
const ORDER = ['palette', 'color-create', 'color-aliases', 'verify'];

// CLI — wrapped so importing `aliasRows` into the test suite is side-effect-free.
const runCli = (): void => {
  const argv = process.argv.slice(2);
  const brand = argv.find((a) => !a.startsWith('--')) ?? 'nb';
  const passIdx = argv.indexOf('--pass');
  const pass = passIdx >= 0 ? argv[passIdx + 1] : undefined;

  if (pass) {
    const fn = PASSES[pass];
    if (!fn) { console.error(`unknown --pass '${pass}' — one of: ${ORDER.join(', ')}`); process.exit(1); }
    process.stdout.write(fn(brand));
  } else {
    // manifest: byte size per pass + the paste order + a budget warning.
    const BUDGET = 45_000;
    console.log(`materialise-to-figma — brand '${brand}', colour modes: ${colourModes(brand).join(', ')}`);
    console.log('Paste each pass into figma_execute IN ORDER (palette first — the color aliases target it):\n');
    for (const name of ORDER) {
      const size = Buffer.byteLength(PASSES[name](brand), 'utf8');
      const flag = size > BUDGET ? '  ⚠ over budget — consider chunking' : '';
      console.log(`  ${name.padEnd(14)} ${String(size).padStart(7)} bytes${flag}`);
    }
    console.log(`\nEmit one pass:  npx tsx Prism3/engine/materialise-to-figma.ts ${brand} --pass <name>`);
    console.log('The `verify` pass reads back via getLocalVariablesAsync and asserts modes are distinct.');
  }
};

// Run the CLI only when invoked directly — not when test.ts imports `aliasRows`.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runCli();
