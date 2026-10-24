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

## Data source: pret decompilations (NOT PokeAPI)

PokeAPI serves current-gen data. The pret decomp repos are the games' own data:

- `github.com/pret/pokeemerald`, `pret/pokefirered`, `pret/pokeruby` — clone into a gitignored folder (e.g. `data-src/`), shallow.
- Verified files in pokeemerald (`src/data/`):
  - `pokemon/species_info.h` — base stats, types, abilities, EV yield, catch rate, exp yield, gender ratio, egg cycles, friendship, growth rate, egg groups, held items, body color
  - `pokemon/level_up_learnsets.h`, `tmhm_learnsets.h`, `tutor_learnsets.h`, `egg_moves.h`, `evolution.h`, `pokedex_text.h`, `pokedex_entries.h`
  - `trainers.h`, `trainer_parties.h` — every trainer's team (gym leaders, E4, rivals)
  - `wild_encounters.json` — encounters per map
  - `battle_frontier/battle_frontier_mons.h` (~880 sets), `battle_frontier_trainer_mons.h`, `battle_frontier_trainers.h`, `battle_pyramid_*_wild_mons.h`, `battle_tent.h`
- Use pokeruby for R/S-specific data and pokefirered for FR/LG; keep per-version differences.
- PokeAPI is still OK for things the decomps don't give conveniently (e.g. sprite images).
- Stylianos also has his own **Battle Frontier CSV** from another source, location TBD. Not a priority; later, cross-check it against the pret data.

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

- **Step 1 (scaffold): done** on 2026-10-24, in a Claude app session (not Claude Code). Expo SDK 58, React Native 0.88, Expo Router, TypeScript strict, reset to a blank app (`src/app/_layout.tsx` with a Stack, `src/app/index.tsx`). ESLint (`eslint-config-expo` + `eslint-config-prettier`), Prettier with default settings. `npm run lint`, `npm run typecheck` and `npm run format:check` all pass.
  - Still open from step 1: copy sprites, type icons and Pokéball SVGs from the old `gen3-dex` on the laptop; commit the old `gen3-dex` WIP there.
  - Styling (NativeWind vs plain StyleSheet) not decided yet; ask before step 3.
- **Next: step 2.** Start by proposing a schema to Stylianos and agreeing on it before writing the importer.
- Also follow `AGENTS.md` (from the Expo template): use `npx expo install` for packages, check versioned Expo docs instead of memory, run lint and typecheck before calling anything done.

## Practical notes

- Machine: Windows (x64). Has Android Studio / `.android` and Expo history. Node 24 available.
- GitHub repo: `ntua-el18716/gen3-dex` (the name is historical; the app is "Gen 3 Companion"). On the laptop it is cloned at `Documents/Projects/PokeApp/gen3-companion/`.
- Keep commits small and descriptive.

## Working in cloud sessions (phone / web)

- This repo may be worked on from Claude Code cloud sessions, where the old local folders (`gen3-dex`, `pokeApi-v2`) are NOT available. Everything needed about them is summarised above.
- The sprites and type icons from `gen3-dex` are not in this repo yet; Stylianos will copy them in from his laptop, or ask him. Don't block on them: scaffolding and the importer don't need them.
- Cloud sessions can clone the pret repos from GitHub; nothing else needs network.
- Step 1 here = scaffold the Expo app in this repo (it starts with only this file). Skip the "commit gen3-dex" part; that happens on the laptop.
