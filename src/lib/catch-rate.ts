/**
 * Gen 3 capture odds, as pokeemerald computes them (Cmd_handleballthrow in
 * src/battle_script_commands.c). All integer maths, like the game:
 *
 *   odds = (catchRate × ball / 10) × (3·maxHP − 2·HP) / (3·maxHP)
 *   ×2 if asleep or frozen, ×1.5 if poisoned, burned or paralysed
 *   odds > 254 → always caught; otherwise
 *   shake = 1048560 / Sqrt(Sqrt(16711680 / odds))
 *   and the ball must pass four checks of Random() (0–65535) < shake.
 */

export type CaptureStatus =
  "none" | "sleep" | "freeze" | "poison" | "burn" | "paralysis";

/** Ball multipliers ×10 (Poké Ball 10, Great Ball 15, Ultra Ball 20). */
export const BALL_MULTIPLIER = { poke: 10, great: 15, ultra: 20 } as const;

/** pret's Sqrt: the integer square root (rounded down). */
function isqrt(n: number): number {
  let r = Math.floor(Math.sqrt(n));
  while (r * r > n) r--;
  while ((r + 1) * (r + 1) <= n) r++;
  return r;
}

/** The chance (0–1) that one ball catches the Pokémon. */
export function captureChance(
  catchRate: number,
  {
    ball = BALL_MULTIPLIER.poke,
    maxHp = 100,
    hp = maxHp,
    status = "none",
  }: {
    ball?: number;
    maxHp?: number;
    hp?: number;
    status?: CaptureStatus;
  } = {},
): number {
  let odds = Math.floor(
    (Math.floor((catchRate * ball) / 10) * (maxHp * 3 - hp * 2)) / (3 * maxHp),
  );
  if (status === "sleep" || status === "freeze") odds *= 2;
  else if (status !== "none") odds = Math.floor((odds * 15) / 10);

  if (odds > 254) return 1;
  if (odds <= 0) return 0;
  const shake = Math.floor(1048560 / isqrt(isqrt(Math.floor(16711680 / odds))));
  return Math.min(1, shake / 65536) ** 4;
}
