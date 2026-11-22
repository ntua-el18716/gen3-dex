import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Each map's Town Map area (`region_map_section` in its map.json), by map
 * id: MAP_ROUTE119 → MAPSEC_ROUTE_119. Areas that aren't a place on the
 * Town Map (MAPSEC_DYNAMIC, MAPSEC_NONE) are left out.
 */
export function readMapSections(repoDir: string): Map<string, string> {
  const out = new Map<string, string>();
  const mapsDir = path.join(repoDir, "data/maps");
  for (const folder of readdirSync(mapsDir).sort()) {
    let json: { id?: string; region_map_section?: string };
    try {
      json = JSON.parse(
        readFileSync(path.join(mapsDir, folder, "map.json"), "utf8"),
      ) as typeof json;
    } catch {
      continue; // folders without a map (shared layouts)
    }
    const section = json.region_map_section;
    if (json.id && section && !NOT_ON_MAP.has(section))
      out.set(json.id, section);
  }
  return out;
}

const NOT_ON_MAP = new Set(["MAPSEC_DYNAMIC", "MAPSEC_NONE"]);
