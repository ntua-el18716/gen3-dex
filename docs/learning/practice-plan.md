# Practice plan: build it yourself

Real features for the app, in order of difficulty. Each one practises chapters from [walkthrough.md](walkthrough.md). They're meant to be written **by you**; Claude reviews.

How to work through one:

1. Read the goal and the hints. Try first without help; look at the referenced files for patterns to copy.
2. Make a branch: `git switch -c practice/p3-type-filter`.
3. Before calling it done: `npm run lint`, `npm run typecheck`, `npm test`, `npm run format` (fixes formatting). Try it on the emulator **and** on web.
4. Ask Claude: _"Review my P3"_. Expect comments, not a rewrite.
5. Commit with a descriptive message, merge into `main`.

Stuck for more than ~20 minutes? Ask for a **hint**, not the answer: _"Give me a hint for P4, step 2"_.

---

## P1. Show the Hoenn Pokédex number (warm-up, ~20 min)

**Goal:** On the overview header, next to `#025`, show the Hoenn number when there is one (e.g. `Hoenn #156` for Pikachu). Pokémon outside the Hoenn Dex show nothing.

**Practises:** reading data that's already loaded, props, conditional rendering (ch. 1, 4).

**Hints:**

- The column already exists: `pokemon.hoennDexNumber` (see `schema.ts`). `getPokemonDetail` already returns it.
- Find `Header` in [overview-page.tsx](../../src/components/pokemon/overview-page.tsx).
- `{value !== null && <Text>…</Text>}` renders only when there's a value. Careful: `{0 && …}` renders `0`.
- Reuse `dexNumber()` from `pokemon-row.tsx` for the padding, or write your own.

**Done when:** Pikachu shows its Hoenn number, Bulbasaur doesn't, and it looks right in light and dark.

---

## P2. Remember the selected game (~30 min)

**Goal:** Pick FireRed, close the app, reopen it: FireRed is still selected.

**Practises:** context, state initialisation, platform files (ch. 3, 4, 6).

**Hints:**

- [current-game.tsx](../../src/state/current-game.tsx) holds the game in `useState("emerald")`.
- [preferences.ts](../../src/lib/preferences.ts) already saves small values (`readPreference`, `writePreference`). The theme switch in [theme.tsx](../../src/theme/theme.tsx) is a complete example.
- `useState` accepts a function: `useState(() => readSomething())` runs only once.
- A saved value could be anything (old version, typo): check it's really one of `GAMES` before using it.
- Save inside `setGame`, not in a `useEffect`.

**Done when:** it survives a restart on Android and a reload on web, and a garbage saved value falls back to Emerald.

**Stretch:** write a tiny pure function `parseGame(value: string | null): Game` in `src/lib/games.ts` and a test for it.

---

## P3. Filter the list by type (~1–2 h)

**Goal:** A horizontally scrolling row of type chips above the list. Tap "Fire" → only Fire-type Pokémon (either type). Tap it again → all. Search and type filter work together.

**Practises:** state, derived values, horizontal `ScrollView`, literal Tailwind classes (ch. 5, 6, 8).

**Hints:**

- State: `const [type, setType] = useState<PokemonType | null>(null)`.
- Filtering is derived (no new state for the result): extend the `shown` computation in [index.tsx](../../src/app/index.tsx). `listPokemon` already returns `type1` and `type2`.
- Chips: `<ScrollView horizontal showsHorizontalScrollIndicator={false}>` with one `Pressable` per type. `TYPES` from the schema lists them; skip `"???"`.
- Colour the selected chip with the type colour. Remember chapter 8: you need full class names. `TypeBadge` has a table you can export and reuse.
- Put the chip row in the list header, next to the search box.
- Update the "386 Pokémon" counter text: it already handles "x of y".

**Done when:** Fire + search "char" shows the Charmander line; the selected chip is clearly highlighted; works in the grid on web too.

**Stretch:** allow two types at once (dual-type search, e.g. Water + Ground).

---

## P4. Regional Pokédex mode (~1–2 h)

**Goal:** A toggle "National / Regional". Regional shows the Pokémon in the current game's own Pokédex, in that Dex's order: the Hoenn Dex for R/S/E, the Kanto Dex (#1–151) for FR/LG.

**Practises:** context (current game), sorting, a small pure function with a test (ch. 3, 6, 9).

**Hints:**

- Hoenn order: `hoennDexNumber` (null = not in the Hoenn Dex). You'll need it in the list query: add it to the `select` in `listPokemon` (and see the type of `PokemonListItem` update by itself).
- Which Dex a game uses: `GAME_INFO[game].versionGroup` or the `region` column in the `game` table.
- Write the logic as a pure function, e.g. `regionalDex(list, game)` in `src/lib/`, that filters and sorts. Test it in Vitest with a few fake Pokémon objects.
- Show the regional number on cards when in regional mode (Hoenn #001 is Treecko).
- Before you code, check one fact with a quick query or Bulbapedia: is the FireRed/LeafGreen in-game Dex exactly #1–151 before the National Dex upgrade?

**Done when:** Emerald + Regional starts with Treecko, ends with the Hoenn legendaries; FireRed + Regional is #1–151; the test passes.

---

## P5. Sort by a stat (~1–2 h, includes a query)

**Goal:** A sort selector: Number (default), Name, Total, HP, Attack, Defense, Sp. Atk, Sp. Def, Speed (highest first).

**Practises:** Drizzle queries, query tests, derived sorting (ch. 4, 6, 9).

**Hints:**

- `listPokemon` doesn't return stats yet. Either add the six base stats to its `select`, or write a separate query. Think about which is simpler for the screen.
- Deoxys's stats differ per game (`base_stat_override`). Decide: ignore it for the list (and say so in a comment), or handle it. Ignoring is fine for now.
- Add a test in [queries.test.ts](../../src/db/queries.test.ts): e.g. the highest base Speed in Gen 3 is Deoxys (normal form, 150) or Ninjask (160)? Look it up, then assert it.
- Sorting a copy: `[...shown].sort((a, b) => b.speed - a.speed)`. Never sort the array returned by `useMemo` in place.
- Show the sorted stat on each row/card so the order makes sense (e.g. "Spe 160").

**Done when:** "Speed" puts Ninjask first; sort works together with search and type filter; your query test passes.

---

## P6. A custom level for stat ranges (~1 h)

**Goal:** On the overview's Base stats card, next to "Lv 50 / Lv 100", a third option to type any level 1–100.

**Practises:** `TextInput` with numbers, validation, pure game logic (ch. 6, 9).

**Hints:**

- `keyboardType="number-pad"` on `TextInput`. The value is always a string: parse it, clamp it to 1–100, ignore empty.
- `statRange(stat, base, level)` already works for any level.
- Add a test for `statRange` at an odd level (e.g. Lv 37) by computing one value by hand from the formula in `stats.ts`.

**Done when:** typing 37 updates all six ranges; typing 0, 150 or letters doesn't break anything.

---

## P7. Your choice (stretch)

Pick one:

- **Moves page filter:** a toggle to show only damaging moves, or only moves of the Pokémon's own types (STAB).
- **Type effectiveness** on the overview: weaknesses / resistances from the `type_chart` table (a query + a grid of badges). Remember Gen 3 has no Fairy type.
- **Long-press a list row** to toggle shiny sprites in the list.

---

## After the plan

You'll have written list state, a query with a test, game logic, and UI in both themes: everything needed to co-write the **Battle Frontier tool** (step 5 in the brief), where the domain logic is the interesting part.
