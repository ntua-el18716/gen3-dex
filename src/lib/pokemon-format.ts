/** Display helpers for Pokédex values, kept pure so they can be tested. */

/** The games store height in decimetres. */
export function formatHeight(dm: number): string {
  return `${(dm / 10).toFixed(1)} m`;
}

/** The games store weight in hectograms. */
export function formatWeight(hg: number): string {
  return `${(hg / 10).toFixed(1)} kg`;
}

/**
 * Gen 3 makes a Pokémon female when the low byte of its personality value
 * is below the species' gender ratio, so the chance is ratio / 256: 12.1%
 * for the "1 in 8" species, not the 12.5% usually quoted.
 */
export function genderLabel(ratio: number): string {
  if (ratio === 255) return "Genderless";
  if (ratio === 0) return "Always male";
  if (ratio === 254) return "Always female";
  const female = (ratio / 256) * 100;
  return `${(100 - female).toFixed(1)}% ♂ · ${female.toFixed(1)}% ♀`;
}

/** Egg groups and growth rates are stored kebab-case, e.g. "water-1". */
export function titleCase(value: string): string {
  return value
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
