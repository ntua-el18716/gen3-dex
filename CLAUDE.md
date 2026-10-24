# Gen 3 Companion — project brief

Read this first. It records decisions made with Stylianos on 2026-10-24 (planning chat in the Claude app).

## What we're building

An **offline-first mobile companion for the Gen 3 Pokémon games** (Ruby, Sapphire, Emerald, FireRed, LeafGreen; GameCube games are a later stretch goal). Three parts:

1. **Pokédex** — rich per-Pokémon pages with Gen 3–accurate data (see `gen3-dex/../AppPlanning.txt` for the original feature list: version filter, type filter, sort by stats, sprites incl. shiny, weight/height, flavor text per game, base stats at Lv50/Lv100/custom, abilities, locations per version, breeding info, catch rate, EV yield, growth rate, happiness, held items).
2. **Playthrough guide** — gym leaders, Elite Four, rivals and their exact teams; wild encounters per route and version.
3. **Battle Frontier tool** — the headline feature: which sets an opponent can have, set details (moves, item, nature, EVs), real stats at Lv50 / open level. Later: damage calc.

## Goals of the project (important for how you work)

- **Learning is a goal, not just shipping.** Stylianos wants to learn React Native / Expo. For the app screens: explain the concept first, let him write the code, then review it. Don't silently generate whole screens unless he asks.
- Tedious, low-learning work (data parsing, tooling, config, dependency chores) — Claude can do most of it, with him reviewing.
- **CV-worthy**: the selling points are the custom data pipeline from game source, offline-first architecture, typed queries, real domain logic (Frontier predictor, stat formulas), tests, CI, an installable Android build + demo video, a solid README. Keep quality at that level.
- Do not plan on an app-store listing (Nintendo takes down Pokémon fan apps). GitHub + APK + demo video is the target.

## Stack (decided)

- **Expo + React Native + Expo Router**, TypeScript. Check the current Expo SDK version when scaffolding; don't assume.
- **SQLite bundled with the app** (expo-sqlite), read-only, ships prebuilt as an asset. No backend, no server, no Postgres.
- **Drizzle ORM** with the expo-sqlite driver for typed queries in the app.
- **One shared Drizzle schema file** used by both the importer (writes the DB) and the app (reads it), so schema changes break at compile time on both sides.
- **Importer = TypeScript script run with tsx** (`npm run import` or similar), not a server.
- Styling: decide when scaffolding (NativeWind would keep Tailwind knowledge; ask him).

## Data pipeline (built in step 2)

PokeAPI serves current-gen data, so everything comes from the pret decompilations (the games' own source):

- `npm run import` → fetches pinned commits of `pret/pokeemerald`, `pokefirered`, `pokeruby` into `data-src/` (gitignored, sparse + shallow; commits pinned in `scripts/import/sources.ts`), parses them, writes `assets/db/gen3.db`, runs validation checks. The build is deterministic (same commits → byte-identical file).
- `npm run sprites` → `assets/sprites/{front,front-shiny,back,back-shiny}/<dex>.png` + `src/generated/sprites.ts` (dex number → `require()`d image). Shinies = same pixels with pret's shiny palette.
- `npm test` → Vitest: parser, text normalisation, game rules, stat formulas, sprite conversion, and the validation checks run against the committed DB.
- Schema: `src/db/schema.ts` (single source of truth); migration in `drizzle/` (regenerate with `npm run db:generate` after schema changes, then re-run the import).
- Layout: `scripts/import/lib/c-parse.ts` (C-data parser: constants, enums, designated initializers, strings, #ifdef, list macros), `lib/text.ts` (ALL CAPS → display names), `context.ts` (games → repo + #defines; Lookups), `stages/*.ts` (one per data kind), `validate.ts` (known Gen 3 facts).
- Key design points:
  - Each game is read with its own `#ifdef`s (RUBY/SAPPHIRE/FIRERED/LEAFGREEN), so per-game differences come out naturally.
  - Repos name some constants differently (MOVE_SOLAR_BEAM vs MOVE_SOLARBEAM, ITEM_TM01 vs ITEM_TM01_FOCUS_PUNCH), so lookups resolve names with the source game's constants and compare numeric ids.
  - Species data is cross-checked across all three repos; any unexpected difference fails the import.
  - Trainers without listed moves get the game's default moveset (GiveBoxMonInitialMoveset), flagged `moves_computed`.
  - Physical/special is derived from type (Gen 3 rule), see `src/lib/damage-class.ts`. Stat formulas in `src/lib/stats.ts`.
- Findings worth knowing (all handled):
  - Deoxys' form depends on the game: Normal (R/S), Attack (FireRed), Defense (LeafGreen), Speed (Emerald) → `base_stat_override`; its learnset also differs between FR and LG, which is why `learnset` is keyed by game.
  - Wild held items differ by version group (Pikachu holds a Light Ball only in R/S/E).
  - 203 Pokémon have different Pokédex text in Ruby and Sapphire.
  - FireRed keeps unused Hoenn trainer slots filled with DUMMY_TRAINER_MON; skipped.
- Known gaps / later:
  - Ruby and Sapphire share one trainer table, so both villain teams' trainers are in both games' data. The playthrough guide needs curated per-game trainer lists (story order, locations), which live in map scripts, not data files.
  - Battle Frontier: which trainers appear at which streak, and the Frontier Brains' teams, are in code (`frontier_util.c`, `battle_tower.c`), not imported yet. Battle Pyramid/Pike wild Pokémon skipped. Battle Tents not imported.
  - Altering Cave: only the default encounter table (Mystery Event variants skipped).
  - FRLG special tutors (Blast Burn, Frenzy Plant, Hydro Cannon) are taught by scripts, so not in `learnset`.
  - Sprites: Deoxys has its normal-form sprite only; Castform normal form; Unown "A".
- Stylianos also has his own **Battle Frontier CSV** from another source, location TBD. Cross-check it against `frontier_set` later.

## Existing code (reference only, don't extend)

- `PokeApp/gen3-dex/` — earlier Next.js 15 + Drizzle + Postgres (Neon) attempt. Only the create-next-app commit exists; all real work is **uncommitted** — commit it as-is before anything else so nothing is lost. Reusable assets: `public/pokemon-images/` (892 PNGs), `public/pokeball*.svg` (per-version Pokéballs), `components/pokemon-types-svg/` (type icons). Its `.env` holds a Neon URL — never print or commit it.
- `gen3-dex/.q.cjs` is a stray helper script left by the planning session; safe to delete.
- `Documents/Projects/pokeApi-v2/` — old Express seeder that pulled from PokeAPI. Known bugs, for the record: Fairy-as-second-type check used `types[1].name` instead of `types[1].type.name` (so Marill, Jigglypuff, Ralts line, Mawile, Mr. Mime kept Fairy); ability filter list built without `await`; first ability never filtered (Gengar got Cursed Body); no handling of Gen 6/7 stat changes or Gen 8 friendship. `poke-api`, `poke-api-v1`, `pokeApi`, `pokeApi-v2 - Copy` are older, superseded.

## Plan

1. **Scaffold**: commit gen3-dex WIP; create the new Expo project in a new folder next to it (e.g. `PokeApp/gen3-companion/`); git init; TypeScript strict; ESLint/Prettier; copy over sprites and icons.
2. **Schema + importer**: design the schema _together with Stylianos_ (it decides what the app can show); importer parses pret files into `assets/db/gen3.db`; add tests for the parser and for stat formulas.
3. **Pokédex** list + detail screens (he writes, Claude guides).
4. **Playthrough guide**: trainers, gyms, encounters.
5. **Battle Frontier tool.**
6. **Polish**: tests, GitHub Actions CI, release APK, README with architecture, demo video.

## Progress

- **Step 1 (scaffold): done** (2026-10-24). Expo SDK 58, React Native 0.88, Expo Router, TypeScript strict, blank app (`src/app/_layout.tsx` with a Stack, `src/app/index.tsx`). ESLint (`eslint-config-expo` + `eslint-config-prettier`), Prettier defaults.
  - Still open: commit the old `gen3-dex` WIP on the laptop. Type icons and Pokéball SVGs from the old project could still be copied in (sprites now come from pret instead).
- **Step 2 (schema + importer): done** (2026-10-24). Schema agreed with Stylianos (his answers: title-case names; pret sprites; store per-game text — R/S turned out to differ). See "Data pipeline" above.
- **Next: step 3 (Pokédex screens).** Before he starts:
  - Ask about styling (NativeWind vs StyleSheet).
  - Wiring the bundled DB into the app is the first lesson: Metro must bundle `.db` assets (`metro.config.js` `resolver.assetExts`), then open it with expo-sqlite (check the SDK 58 docs for loading a database from assets) and wrap it with `drizzle-orm/expo-sqlite`. Let him write it with guidance.
- Quality gates before calling anything done: `npm run lint`, `npm run typecheck`, `npm test`, `npm run format:check`. Also follow `AGENTS.md` (from the Expo template): `npx expo install` for packages, versioned Expo docs over memory.

## Practical notes

- Machine: Windows (x64). Has Android Studio / `.android` and Expo history. Node 24 available.
- GitHub repo: `ntua-el18716/gen3-dex` (the name is historical; the app is "Gen 3 Companion"). On the laptop it is cloned at `Documents/Projects/PokeApp/gen3-companion/`.
- Keep commits small and descriptive.

## Working in cloud sessions (phone / web)

- The old local folders (`gen3-dex`, `pokeApi-v2`) are not available in cloud sessions; everything needed about them is summarised above.
- Cloud sessions can fetch the pret repos from GitHub; nothing else needs network.
- Pushing from Claude app sessions has failed so far (GitHub app access); work was handed over as git bundles that Stylianos pulls on his laptop.
