/**
 * Turns the games' ALL CAPS names and text into normal display text.
 * "MR. MIME" → "Mr. Mime", "POKéMON" → "Pokémon",
 * "Not hit by GROUND attacks." → "Not hit by Ground attacks."
 */

/** Words that stay upper case. */
const KEEP_UPPER = new Set([
  "HP",
  "PP",
  "KO",
  "OK",
  "TV",
  "PC",
  "EXP",
  "UFO",
  "SS",
  "TM",
  "HM",
]);

/** Whole-word replacements applied after title-casing. */
const WORD_FIXES: Record<string, string> = {
  Pkmn: "Pokémon",
};

function titleCaseWord(word: string): string {
  // Leave TM/HM numbers ("TM26") and anything with no letters alone.
  if (/^(TM|HM)\d+$/.test(word) || !/[A-Za-zÀ-ÿ]/.test(word)) return word;
  const bare = word.replace(/[^A-Za-zÀ-ÿ]/g, "");
  if (KEEP_UPPER.has(bare.toUpperCase()) && bare === bare.toUpperCase())
    return word;

  let out = "";
  let capitalizeNext = true;
  for (const ch of word) {
    if (/[A-Za-zÀ-ÿ]/.test(ch)) {
      out += capitalizeNext ? ch.toUpperCase() : ch.toLowerCase();
      capitalizeNext = false;
    } else {
      out += ch;
      // Capitalise after hyphens and periods (Ho-Oh, S.S.), not apostrophes (Farfetch'd).
      capitalizeNext = ch === "-" || ch === ".";
    }
  }
  return out;
}

/**
 * The games write these names as one ALL CAPS word; their official Gen 3
 * English spelling has internal capitals, which title-casing can't recover.
 */
const GEN3_SPELLINGS: Record<string, string> = Object.fromEntries(
  [
    // Moves
    "DoubleSlap",
    "ThunderPunch",
    "SonicBoom",
    "BubbleBeam",
    "SolarBeam",
    "PoisonPowder",
    "ThunderShock",
    "SmokeScreen",
    "DynamicPunch",
    "DragonBreath",
    "ExtremeSpeed",
    "AncientPower",
    "SmellingSalt",
    "FeatherDance",
    "GrassWhistle",
    // Items
    "EnergyPowder",
    "ThunderStone",
    "TinyMushroom",
    "BrightPowder",
    "SilverPowder",
    "DeepSeaTooth",
    "DeepSeaScale",
    "BlackGlasses",
    "NeverMeltIce",
    "TwistedSpoon",
    "MysticTicket",
    "AuroraTicket",
  ].map((name) => [name.toUpperCase(), name]),
);

/** Title-cases a name: "DOUBLE-EDGE" → "Double-Edge", "KING'S ROCK" → "King's Rock". */
export function titleCase(name: string): string {
  const special = GEN3_SPELLINGS[name.trim()];
  if (special) return special;
  return name
    .split(" ")
    .map(titleCaseWord)
    .map((w) => WORD_FIXES[w] ?? w)
    .join(" ");
}

/** True for words the games capitalise for emphasis (types, stats, POKéMON). */
function isShoutedWord(word: string): boolean {
  // The games write "POKéMON" with a lower-case é, so ignore it when checking case.
  const letters = word
    .replace(/'s\b/g, "") // possessive: "GENGAR's"
    .replace(/[^A-Za-zÀ-ÿ]/g, "")
    .replace(/é/g, "");
  return (
    letters.length >= 2 &&
    letters === letters.toUpperCase() &&
    /[A-Z]/.test(letters)
  );
}

/**
 * Normalises descriptive game text: joins the games' hard line breaks into
 * one paragraph and title-cases the ALL CAPS words, keeping HP/PP/etc.
 */
export function gameText(text: string): string {
  return text
    .replace(/\{[^}]*\}/g, "") // control codes like {COLOR RED}
    .replace(/-\n/g, "-") // words hyphenated across lines
    .replace(/\s*\n\s*/g, " ")
    .split(" ")
    .map((w) => (isShoutedWord(w) ? titleCase(w) : w))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lower-kebab-case for enum values: "WATER_1" → "water-1", "HUMAN_LIKE" → "human-like". */
export function kebab(constantSuffix: string): string {
  return constantSuffix.toLowerCase().replace(/_/g, "-");
}

const MAP_WORD_FIXES: Record<string, string> = {
  Ss: "S.S.",
  Mt: "Mt.",
  Pokemon: "Pokémon",
  Sevii: "Sevii",
};

/**
 * Turns a map constant into a display name:
 * MAP_ROUTE101 → "Route 101", MAP_GRANITE_CAVE_B1F → "Granite Cave B1F".
 */
export function mapName(mapKey: string): string {
  return mapKey
    .replace(/^MAP_/, "")
    .replace(/^ROUTE(\d+)/, "ROUTE_$1")
    .split("_")
    .filter((w) => w !== "")
    .map((w) => {
      if (/^(B?\d+F|\d+R|B\d+|N|S|E|W|NE|NW|SE|SW)$/.test(w)) return w; // floors, room numbers, compass
      const t = w.charAt(0) + w.slice(1).toLowerCase();
      return MAP_WORD_FIXES[t] ?? t;
    })
    .join(" ");
}
