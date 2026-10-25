/**
 * Reads the games' event scripts (data/maps/<Map>/scripts.inc and the shared
 * data/scripts/*.inc) into a graph of labels, so the importer can ask "which
 * maps run this command?" and "what can this variable hold here?".
 *
 * Scripts are assembler macros:
 *
 *   Route120_EventScript_Kecleon1::     ← label
 *       setvar VAR_0x8009, 1            ← command, comma-separated args
 *       goto EventScript_Kecleon        ← reference to another label
 *
 * A label runs on a map when the map defines it, the map's map.json points an
 * event at it, or a label that runs on the map refers to it (goto, call,
 * case …). Commands in labels that no map reaches (Mystery Gift, debug menus)
 * are therefore ignored.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { preprocess, splitTopLevel } from "./c-parse";

export type ScriptCommand = {
  /** Macro name, e.g. "givemon". */
  name: string;
  args: string[];
  /** The label the command belongs to. */
  label: string;
};

type Label = {
  name: string;
  /** Map id (MAP_ROUTE101) when defined in a map's scripts.inc. */
  map: string | null;
  commands: ScriptCommand[];
};

/** Commands after which a label does not fall through into the next one. */
const TERMINATORS = new Set([
  "end",
  "return",
  "goto",
  "releaseend",
  "step_end",
]);

/** Turns assembler conditionals (.ifdef FIRERED … .endif) into C ones for `preprocess`. */
function asmToC(src: string): string {
  return src
    .replace(/^\s*\.(ifdef|ifndef|if|else|elif)\b/gm, "#$1")
    .replace(/^\s*\.(endif|endc)\b/gm, "#endif");
}

/** Removes `@ comments` (outside string literals). */
function stripAsmComment(line: string): string {
  let inString = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && line[i - 1] !== "\\") inString = !inString;
    if (!inString && c === "@") return line.slice(0, i);
  }
  return line;
}

/** Parses one script file into labels, in file order. */
export function parseScriptFile(
  src: string,
  map: string | null,
  defines: ReadonlySet<string>,
): Label[] {
  const labels: Label[] = [];
  let current: Label | null = null;
  for (const raw of preprocess(asmToC(src), defines).split("\n")) {
    const line = stripAsmComment(raw).trimEnd();
    if (line.trim() === "") continue;
    const label = /^(\w+)::?$/.exec(line);
    if (label) {
      current = { name: label[1]!, map, commands: [] };
      labels.push(current);
      continue;
    }
    const command = /^\s+([.\w]+)\s*(.*)$/.exec(line);
    if (!command || !current) continue;
    current.commands.push({
      name: command[1]!,
      args: command[2] ? splitTopLevel(command[2]).map((a) => a.trim()) : [],
      label: current.name,
    });
  }
  return labels;
}

export class ScriptGraph {
  private readonly labels = new Map<string, Label>();
  /** label → labels that refer to it (or fall through into it). */
  private readonly parents = new Map<string, Set<string>>();
  /** label → maps whose map.json events start it, with the number of events. */
  private readonly mapEvents = new Map<string, Map<string, number>>();

  /**
   * @param files script files with the map that owns them (null for shared scripts)
   * @param events map id → the script label of each event in its map.json
   */
  constructor(
    files: { src: string; map: string | null }[],
    events: Map<string, string[]>,
    defines: ReadonlySet<string>,
  ) {
    const fileLabels = files.map((f) => parseScriptFile(f.src, f.map, defines));
    for (const label of fileLabels.flat()) this.labels.set(label.name, label);

    const addParent = (child: string, parent: string) => {
      if (!this.labels.has(child) || child === parent) return;
      let set = this.parents.get(child);
      if (!set) this.parents.set(child, (set = new Set()));
      set.add(parent);
    };
    for (const labels of fileLabels) {
      labels.forEach((label, i) => {
        for (const c of label.commands)
          for (const arg of c.args)
            for (const token of arg.match(/\w+/g) ?? [])
              addParent(token, label.name);
        // Code without a final end/goto runs on into the next label. Data
        // (.string, .byte) doesn't run, so it never falls through.
        const last = label.commands[label.commands.length - 1];
        const next = labels[i + 1];
        if (
          next &&
          (!last || (!TERMINATORS.has(last.name) && !last.name.startsWith(".")))
        )
          addParent(next.name, label.name);
      });
    }
    for (const [map, scripts] of events) {
      for (const script of scripts) {
        let counts = this.mapEvents.get(script);
        if (!counts) this.mapEvents.set(script, (counts = new Map()));
        counts.set(map, (counts.get(map) ?? 0) + 1);
      }
    }
  }

  /** Every command with this macro name, in file order. */
  commands(name: string): ScriptCommand[] {
    return [...this.labels.values()].flatMap((l) =>
      l.commands.filter((c) => c.name === name),
    );
  }

  /** Commands in one label. */
  commandsIn(label: string): ScriptCommand[] {
    return this.labels.get(label)?.commands ?? [];
  }

  /** The label and every label that can lead to it. */
  ancestors(label: string): Set<string> {
    const seen = new Set([label]);
    const queue = [label];
    while (queue.length > 0) {
      for (const parent of this.parents.get(queue.pop()!) ?? []) {
        if (seen.has(parent)) continue;
        seen.add(parent);
        queue.push(parent);
      }
    }
    return seen;
  }

  /**
   * The maps where a label runs, each with the number of map events (people,
   * items, triggers) that lead to it — e.g. Route 120 has six Kecleon that
   * all use the same battle script. At least 1 per map.
   */
  maps(label: string): Map<string, number> {
    const result = new Map<string, number>();
    for (const name of this.ancestors(label)) {
      const own = this.labels.get(name)?.map;
      if (own && !result.has(own)) result.set(own, 0);
      for (const [map, n] of this.mapEvents.get(name) ?? [])
        result.set(map, (result.get(map) ?? 0) + n);
    }
    for (const [map, n] of result) if (n === 0) result.set(map, 1);
    return result;
  }

  /**
   * What a variable (VAR_TEMP_1, PLAYER_STARTER_SPECIES…) can hold when the
   * command in `label` runs: the `case` values that jump to the label, or
   * otherwise every `setvar` of the variable on the way there.
   */
  values(variable: string, label: string): string[] {
    const ancestors = this.ancestors(label);
    const cases = new Set<string>();
    const sets = new Set<string>();
    for (const name of ancestors) {
      for (const c of this.commandsIn(name)) {
        if (c.name === "setvar" && c.args[0] === variable) sets.add(c.args[1]!);
        if (c.name === "switch" && c.args[0] === variable) {
          // `case X, Target` lines follow their switch in the same label.
          const own = this.commandsIn(name);
          for (const k of own.slice(own.indexOf(c) + 1)) {
            if (k.name !== "case") continue;
            if (ancestors.has(k.args[1]!)) cases.add(k.args[0]!);
          }
        }
      }
    }
    return [...(cases.size > 0 ? cases : sets)];
  }
}

/** Loads every map's scripts and events plus the shared scripts of a checked-out repo. */
export function loadScriptGraph(
  repoDir: string,
  defines: ReadonlySet<string>,
): ScriptGraph {
  const files: { src: string; map: string | null }[] = [];
  const events = new Map<string, string[]>();
  const mapsDir = path.join(repoDir, "data/maps");
  // Sorted: directory order differs between file systems, the output must not.
  for (const folder of readdirSync(mapsDir).sort()) {
    let json: MapJson;
    try {
      json = JSON.parse(
        readFileSync(path.join(mapsDir, folder, "map.json"), "utf8"),
      ) as MapJson;
    } catch {
      continue; // folders without a map (shared layouts)
    }
    events.set(
      json.id,
      [
        ...(json.object_events ?? []),
        ...(json.coord_events ?? []),
        ...(json.bg_events ?? []),
      ]
        .map((e) => e.script)
        .filter((s): s is string => !!s && s !== "0x0"),
    );
    try {
      files.push({
        src: readFileSync(path.join(mapsDir, folder, "scripts.inc"), "utf8"),
        map: json.id,
      });
    } catch {
      // maps without scripts
    }
  }
  const sharedDir = path.join(repoDir, "data/scripts");
  for (const file of readdirSync(sharedDir).sort()) {
    // pokeruby's debug menu gives out test Pokémon.
    if (!file.endsWith(".inc") || file === "debug.inc") continue;
    files.push({
      src: readFileSync(path.join(sharedDir, file), "utf8"),
      map: null,
    });
  }
  return new ScriptGraph(files, events, defines);
}

type MapJson = {
  id: string;
  object_events?: { script?: string }[];
  coord_events?: { script?: string }[];
  bg_events?: { script?: string }[];
};
