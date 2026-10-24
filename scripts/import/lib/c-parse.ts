/**
 * A small parser for the subset of C that pret uses for game data:
 * #defines, enums, designated-initializer arrays and string literals.
 *
 * It is deliberately not a full C parser. Each helper handles one data
 * shape, and the importer validates its output (counts, known values), so a
 * format change in pret fails loudly instead of producing silent garbage.
 */

/** Removes // and /* *\/ comments, leaving string and char literals intact. */
export function stripComments(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '"' || c === "'") {
      // Copy a string/char literal verbatim, honouring escapes.
      const quote = c;
      out += c;
      i++;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === "\\") {
          out += src[i] + (src[i + 1] ?? "");
          i += 2;
          continue;
        }
        out += src[i];
        i++;
      }
      out += src[i] ?? "";
      i++;
    } else if (c === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") i++;
    } else if (c === "/" && next === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) {
        if (src[i] === "\n") out += "\n"; // keep line numbers stable
        i++;
      }
      i += 2;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** Splits on `sep` at nesting depth 0 (ignoring separators inside (), {}, [] and strings). */
export function splitTopLevel(src: string, sep = ","): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  let inString = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inString) {
      current += c;
      if (c === "\\") {
        current += src[++i] ?? "";
      } else if (c === '"') {
        inString = false;
      }
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "(" || c === "{" || c === "[") depth++;
    else if (c === ")" || c === "}" || c === "]") depth--;
    if (c === sep && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  if (current.trim() !== "") parts.push(current.trim());
  return parts;
}

/** Returns the index of the bracket matching the one at `open`. */
export function findMatching(src: string, open: number): number {
  const opener = src[open];
  const closer = opener === "{" ? "}" : opener === "(" ? ")" : "]";
  let depth = 0;
  let inString = false;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === opener) depth++;
    else if (c === closer) {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error(`Unbalanced ${opener} at offset ${open}`);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export type Constants = Map<string, number>;

const SAFE_EXPRESSION = /^[\d\s+\-*/%()<>|&^~xXa-fA-F]*$/;

/**
 * Evaluates a constant expression such as `(NUM_SPECIES + 1)` or
 * `1 << 3`, resolving identifiers from `known`. Returns undefined if any
 * identifier is unknown.
 */
export function evalExpression(
  expr: string,
  known: Constants,
): number | undefined {
  let unresolved = false;
  const substituted = expr
    .replace(/\b(?:u8|u16|u32|s8|s16|s32)\b/g, "") // casts like (u16)
    .replace(/\b(0x[\da-fA-F]+|\d+)[uUlL]*\b/g, "$1")
    .replace(/\b[A-Za-z_]\w*\b/g, (name) => {
      if (/^0x/i.test(name)) return name;
      const value = known.get(name);
      if (value === undefined) {
        unresolved = true;
        return "0";
      }
      return `(${value})`;
    });
  if (unresolved || !SAFE_EXPRESSION.test(substituted)) return undefined;
  try {
    const value = Function(
      `"use strict"; return (${substituted});`,
    )() as unknown;
    return typeof value === "number" && Number.isFinite(value)
      ? Math.trunc(value)
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Collects numeric #defines and enum members from one or more headers into
 * `into`. Definitions that reference not-yet-known names are retried until
 * nothing more resolves, so header order doesn't matter.
 */
export function parseConstants(
  sources: string[],
  into: Constants = new Map(),
): Constants {
  type Pending = { name: string; expr: string };
  let pending: Pending[] = [];

  for (const raw of sources) {
    const src = stripComments(raw);

    // #define NAME value   (skip function-like macros)
    for (const m of src.matchAll(
      /^[ \t]*#define[ \t]+([A-Za-z_]\w*)[ \t]+([^\n]*?)\s*$/gm,
    )) {
      const [, name, expr] = m;
      if (expr && !expr.includes('"'))
        pending.push({ name: name!, expr: expr.replace(/\\$/, "") });
    }

    // enum { A, B = 5, C }  (named or anonymous, optional typedef)
    for (const m of src.matchAll(/\benum\b[^{;]*\{/g)) {
      const open = m.index! + m[0].length - 1;
      const close = findMatching(src, open);
      const body = src.slice(open + 1, close).replace(/^[ \t]*#.*$/gm, "");
      let previous: { name: string; expr: string } | null = null;
      for (const member of splitTopLevel(body)) {
        const mm = /^([A-Za-z_]\w*)\s*(?:=\s*([\s\S]+))?$/.exec(member.trim());
        if (!mm) continue;
        const [, name, explicit] = mm;
        const expr: string =
          explicit ?? (previous ? `(${previous.name}) + 1` : "0");
        pending.push({ name: name!, expr });
        previous = { name: name!, expr };
      }
    }
  }

  // Resolve iteratively.
  let progress = true;
  while (pending.length > 0 && progress) {
    progress = false;
    const stillPending: Pending[] = [];
    for (const p of pending) {
      const value = evalExpression(p.expr, into);
      if (value === undefined) stillPending.push(p);
      else {
        if (!into.has(p.name)) into.set(p.name, value);
        progress = true;
      }
    }
    pending = stillPending;
  }
  return into;
}

/** Looks up a constant, throwing a helpful error if it's missing. */
export function constant(constants: Constants, name: string): number {
  const value = constants.get(name);
  if (value === undefined) throw new Error(`Unknown constant ${name}`);
  return value;
}

// ---------------------------------------------------------------------------
// Designated initializers
// ---------------------------------------------------------------------------

export type Entry = { key: string; body: string };

/**
 * Finds the array named `arrayName` and returns its `[KEY] = value` entries.
 * The key keeps any arithmetic (e.g. `MOVE_POUND - 1`), trimmed.
 */
export function parseDesignatedArray(
  rawSrc: string,
  arrayName: string,
): Entry[] {
  const src = stripComments(rawSrc);
  const decl = new RegExp(`\\b${arrayName}\\b[^=;]*=\\s*\\{`).exec(src);
  if (!decl) throw new Error(`Array ${arrayName} not found`);
  const open = decl.index + decl[0].length - 1;
  const close = findMatching(src, open);
  return parseDesignatedEntries(src.slice(open + 1, close));
}

/** Parses `[KEY] = value, [KEY2] = value2, …` from an initializer body. */
export function parseDesignatedEntries(body: string): Entry[] {
  const entries: Entry[] = [];
  for (const part of splitTopLevel(body)) {
    const m = /^\[([^\]]+)\]\s*=\s*([\s\S]*)$/.exec(part.trim());
    if (m) entries.push({ key: m[1]!.trim(), body: m[2]!.trim() });
  }
  return entries;
}

/** Parses `{ .a = 1, .b = {X, Y}, … }` (outer braces optional) into a field map. */
export function parseStructFields(value: string): Record<string, string> {
  let body = value.trim();
  if (body.startsWith("{")) body = body.slice(1, findMatching(body, 0));
  const fields: Record<string, string> = {};
  let last: string | null = null;
  for (const part of splitTopLevel(body)) {
    const m = /^\.(\w+)\s*=\s*([\s\S]*)$/.exec(part.trim());
    if (m) {
      last = m[1]!;
      fields[last] = m[2]!.trim();
    } else if (last) {
      // pokeruby writes some lists without braces: `.moves = MOVE_A, MOVE_B, …`
      fields[last] += `, ${part.trim()}`;
    }
  }
  return fields;
}

/** Parses `{A, B, C}` into ["A", "B", "C"]. */
export function parseList(value: string): string[] {
  let body = value.trim();
  if (body.startsWith("{")) body = body.slice(1, findMatching(body, 0));
  return splitTopLevel(body).filter((s) => s !== "");
}

/** Finds every `static const <type> NAME[] = { … };` array and returns name → body. */
export function parseNamedArrays(rawSrc: string): Map<string, string> {
  const src = stripComments(rawSrc);
  const arrays = new Map<string, string>();
  for (const m of src.matchAll(/\b([A-Za-z_]\w*)\s*\[[^\]]*\]\s*=\s*\{/g)) {
    const open = m.index! + m[0].length - 1;
    const close = findMatching(src, open);
    arrays.set(m[1]!, src.slice(open + 1, close));
  }
  return arrays;
}

// ---------------------------------------------------------------------------
// Strings
// ---------------------------------------------------------------------------

/** Concatenates every "…" literal in `value` (C joins adjacent literals). */
export function parseStringLiteral(value: string): string {
  let out = "";
  for (const m of value.matchAll(/"((?:[^"\\]|\\.)*)"/g)) out += m[1];
  return out
    .replace(/\\n/g, "\n")
    .replace(/\\l/g, "\n")
    .replace(/\\p/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

/** Finds `const u8 NAME[] = _("…");` declarations and returns name → text. */
export function parseStringDeclarations(rawSrc: string): Map<string, string> {
  const src = stripComments(rawSrc);
  const strings = new Map<string, string>();
  for (const m of src.matchAll(/\b([A-Za-z_]\w*)\s*\[[^\]]*\]\s*=\s*_\(/g)) {
    const open = m.index! + m[0].length - 1;
    const close = findMatching(src, open);
    strings.set(m[1]!, parseStringLiteral(src.slice(open + 1, close)));
  }
  return strings;
}

// ---------------------------------------------------------------------------
// Preprocessor
// ---------------------------------------------------------------------------

/**
 * Evaluates #if/#ifdef/#ifndef/#elif/#else/#endif for a set of defined
 * names (e.g. {"SAPPHIRE"}), dropping the inactive branches. Conditions
 * other than defined(X) / plain names are treated as false, which is what we
 * want for things like `#if MODERN` or `#if DEBUG`.
 */
export function preprocess(src: string, defined: ReadonlySet<string>): string {
  const isTrue = (cond: string): boolean => {
    const c = cond.trim();
    if (c.startsWith("!")) return !isTrue(c.slice(1));
    const or = splitTopLevelOperator(c, "||");
    if (or.length > 1) return or.some(isTrue);
    const and = splitTopLevelOperator(c, "&&");
    if (and.length > 1) return and.every(isTrue);
    const m =
      /^\(?\s*defined\s*\(?\s*(\w+)\s*\)?\s*\)?$/.exec(c) ??
      /^\(?\s*(\w+)\s*\)?$/.exec(c);
    if (m) return m[1] === "1" || defined.has(m[1]!);
    return false;
  };

  type Frame = { parentActive: boolean; taken: boolean; active: boolean };
  const stack: Frame[] = [];
  const out: string[] = [];
  const active = () =>
    stack.length === 0 ? true : stack[stack.length - 1]!.active;

  for (const line of src.split("\n")) {
    const d = /^\s*#\s*(ifdef|ifndef|if|elif|else|endif)\b(.*)$/.exec(line);
    if (!d) {
      out.push(active() ? line : "");
      continue;
    }
    const [, directive, rest] = d;
    const arg = (rest ?? "").replace(/\/\/.*$/, "").trim();
    if (directive === "ifdef" || directive === "ifndef" || directive === "if") {
      const parentActive = active();
      const cond =
        directive === "ifdef"
          ? defined.has(arg)
          : directive === "ifndef"
            ? !defined.has(arg)
            : isTrue(arg);
      stack.push({ parentActive, taken: cond, active: parentActive && cond });
    } else if (directive === "elif") {
      const f = stack[stack.length - 1]!;
      const cond = !f.taken && isTrue(arg);
      f.active = f.parentActive && cond;
      f.taken ||= cond;
    } else if (directive === "else") {
      const f = stack[stack.length - 1]!;
      f.active = f.parentActive && !f.taken;
      f.taken = true;
    } else {
      stack.pop();
    }
    out.push("");
  }
  return out.join("\n");
}

function splitTopLevelOperator(src: string, op: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "(") depth++;
    if (c === ")") depth--;
    if (depth === 0 && src.startsWith(op, i)) {
      parts.push(current);
      current = "";
      i += op.length - 1;
      continue;
    }
    current += c;
  }
  parts.push(current);
  return parts;
}

/** A macro whose body is a comma-separated list (continued over several lines). */
export type ListMacro = { params: string[]; body: string[] };

/**
 * Parses list macros such as `#define FRONTIER_MONS_X A, B, …` and
 * function-like ones such as `#define FRONTIER_MONS_EXPERT_2A(lastmon) …,
 * FRONTIER_MON_##lastmon##_5, …`.
 */
export function parseListMacros(rawSrc: string): Map<string, ListMacro> {
  const src = stripComments(rawSrc).replace(/\\\r?\n/g, " ");
  const macros = new Map<string, ListMacro>();
  for (const m of src.matchAll(
    /^[ \t]*#define[ \t]+([A-Za-z_]\w*)(?:\(([^)]*)\))?[ \t]+([^\n]*)$/gm,
  )) {
    const params =
      m[2] === undefined
        ? []
        : m[2]
            .split(",")
            .map((p) => p.trim())
            .filter((p) => p !== "");
    macros.set(m[1]!, {
      params,
      body: splitTopLevel(m[3]!).filter((t) => t !== ""),
    });
  }
  return macros;
}

/** Recursively expands list macros in `tokens`, including `NAME(arg)` calls with ## pasting. */
export function expandListMacros(
  tokens: string[],
  macros: Map<string, ListMacro>,
  depth = 0,
): string[] {
  if (depth > 10) throw new Error("Macro expansion too deep");
  return tokens.flatMap((token) => {
    const call = /^(\w+)\s*\(([^)]*)\)$/.exec(token.trim());
    const name = call ? call[1]! : token.trim();
    const macro = macros.get(name);
    if (!macro) return [token.trim()];
    const args = call ? call[2]!.split(",").map((a) => a.trim()) : [];
    const body = macro.body.map((t) =>
      macro.params
        .reduce(
          (out, param, i) =>
            out.replace(new RegExp(`\\b${param}\\b`, "g"), args[i] ?? ""),
          t,
        )
        .replace(/\s*##\s*/g, ""),
    );
    return expandListMacros(body, macros, depth + 1);
  });
}
