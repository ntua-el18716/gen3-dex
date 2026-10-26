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
- Styling: **NativeWind** (decided 2026-10-25; keeps his Tailwind knowledge).

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
  - Battle Frontier: the Tower/Palace/Arena rules are imported (see "Battle Frontier data" below). Not yet: the Dome (tournament seeding), Factory teams (rentals; its trainers use the same ranges), Pike and Pyramid rules and wild Pokémon, Battle Tents, special opponents (record-mixed players, e-Reader, Apprentice).
  - Altering Cave: only the default encounter table (Mystery Event variants skipped).
  - FRLG special tutors (Blast Burn, Frenzy Plant, Hydro Cannon) are taught by scripts, so not in `learnset`.
  - Sprites: Deoxys has its normal-form sprite only; Castform normal form; Unown "A".
- Stylianos also has his own **Battle Frontier CSV** from another source, location TBD. Cross-check it against `frontier_set` later.

## Battle Frontier data (imported 2026-10-25, by Claude at his request)

Read from pokeemerald's code (`battle_tower.c`, `frontier_util.c`; facility files and `data/maps/BattleFrontier_*/scripts.inc` are now in the sparse checkout). Applies to the Tower, Palace and Arena (their scripts all use `SetNextFacilityOpponent` + `FillFrontierTrainerParty`).

- Tables (schema comment explains the rules): `frontier_trainer.fixed_iv` (parsed from `GetFrontierTrainerFixedIvs`), `frontier_set.open_level_only` (index > `FRONTIER_MONS_HIGH_TIER`), `frontier_trainer_range` (8 challenges × normal/7th battle), `frontier_brain` (name, Symbol schedule), `frontier_brain_mon` (fixed teams; none for the Factory, whose pret entry is unused).
- Rules as code: `src/lib/frontier.ts` (`battlePosition`, `opponentLevel`, `brainBattle`, `frontierStats`); the importer fails if its constants disagree with pret.
- Queries: `src/db/frontier-queries.ts` — `getTrainersForBattle`, `getPossibleSets` (the predictor: battle + level mode + species/trainer → sets with possible IVs), `getSetDetails`, `getFrontierBrain`. Tested in `frontier-queries.test.ts`.
- Facts worth knowing: battle 7 of each challenge draws harder trainers; from battle 57 on it's always trainers 200–299 (IVs 21 or 31); Anabel is battle 35 (Silver) and 70 (Gold), then every 35 once both Symbols are won; Brains only in singles; Pokémon with Frustration have 0 friendship.
- The migration was regenerated as a single `drizzle/0000_init.sql` (the importer only ever builds fresh databases; incremental `ALTER TABLE … NOT NULL` doesn't work in SQLite). `meta.schema` = `gen3-companion/3` (3 = static_encounter added).
- **Battle Factory** (added 2026-10-26): `factory_set_range` (sInitialRentalMonRanges: per level mode × challenge, a contiguous range of set ids) and `factory_iv` (sFixedIVTable). Opponents' Pokémon don't depend on the trainer — any set in the range (no Unown; Level 50 skips high tier; the game also skips species among your rentals). Rules in `src/lib/frontier.ts`: `factoryOpponentIv` (game bug: the IV row comes from the player's **Battle Tower Level 50** streak; 7th battle uses the higher column; row 8 is an out-of-bounds read → random IVs), `factoryBrainIv` (Noland: row = Factory challenge + 2). Query `getFactorySets` + `getFactoryIvTable`. The importer regex-checks pret's code for each quirk.
- **Battle Pike / Pyramid wild Pokémon** (added 2026-10-26): `pike_wild_mon` (level mode × tier × 3; tier from rooms cleared, thresholds 20/40/60 challenges of 14 rooms; rates 26/26/48), `pyramid_wild_mon` (level mode × 20 rounds × 8; round = floors cleared / 7 **mod 20**, so it cycles), `pyramid_floor_rate` (per floor 1–7, chance of each of the round's 8). The real tables are in C; wild_encounters.json only has placeholder headers whose slot species say which table entry is picked (Pyramid: species number − 1). Rules: `pikeWildTier`, `pikeWildLevel` (Open Level below 60 ignores the delta), `pyramidRound`, `pyramidWildLevels` (Open Level "lvl" is an offset below the opponent level; ±5). Pyramid's IV boost at 140+ floors reads the wrong array index in the real game (pret UB note), so it isn't modelled. Queries `getPikeWildMons`, `getPyramidWildMons`. Still not done: Dome, Pike's other rooms (trainers/Lucy), Pyramid trainers.
- Next for step 5: the Frontier screens (picker for facility/battle/level → possible trainers and sets with stats), then Dome/Factory/Pike/Pyramid rules, then damage calc.

## Gifts and one-time encounters (imported 2026-10-25, by Claude)

- Table `static_encounter` (game, location — null for roamers, pokemon, kind: starter/gift/egg/static/roaming/trade/prize, level — null for trades, count, held item, trade-for + nickname, note). Stage `scripts/import/stages/static-encounters.ts`; query `getStaticEncounters` + `getFoundGames`; shown first on the Locations page ("Gifts & one-time in …").
- How it's read: `scripts/import/lib/map-scripts.ts` parses every map's `scripts.inc` + `data/scripts/*.inc` (with `.ifdef` per game) into a label graph; a command runs on a map if the map defines the label, its `map.json` events point at it, or a reachable label refers to it. Unreachable scripts (Mystery Gift Pichu, pokeruby's debug menu) drop out by themselves. Variable species come from the `switch/case` that jumps to the command (Game Corner) or the `setvar`s leading to it (Dojo, Oak's starters). `count` = map events reaching a battle (6 Kecleon on Emerald Route 120).
- From C: Hoenn starters (`starter_choose.c`, level from `CB2_GiveStarter` in `battle_setup.c`), roamers (`roamer.c`; FRLG roamer by starter, R/S `ROAMER_SPECIES`), trades (`trade.h` / `ingame_trades.h` / pokeruby `trade.c`, located by the script's `setvar VAR_0x8008`). R/S version aliases (`SPECIES_GROUDON_OR_KYOGRE`) from pokeruby `constants/version.inc`.
- Hand-written: the notes (requirements like "needs the Devon Scope"; each must match a row or the import fails), the R/S hideout rule (Ruby only enters the Magma Hideout, Sapphire the Aqua one), skipping the Ghost Marowak (`special StartMarowakBattle`).
- Not covered: Jirachi/Celebi (bonus discs), the Johto starters' Hoenn Dex condition is a note only, Game Corner coin prices.
- Map names also got nicer (`Room1` → "Room 1", "Steven's", "Cave of Origin").

## Release build (set up 2026-10-26, by Claude)

- `npm run apk` (`scripts/apk/build-apk.ts`): `expo prebuild --platform android` (android/ is gitignored, never hand-edited; prebuild's rewrite of the `android`/`ios` npm scripts is undone), then `gradlew app:assembleRelease` → `dist/gen3-companion-<app.json version>.apk`. A clean build takes ~25–35 min on the laptop (prebuild recreates android/, so Gradle rebuilds the app module each time; native caches survive).
- Package id `com.stylianos.gen3companion` (app.json). Don't change it after a release: it's the app's identity for updates.
- Signing: `plugins/with-release-signing.js` (config plugin) adds a release signingConfig from Gradle properties `GEN3_UPLOAD_STORE_FILE/STORE_PASSWORD/KEY_ALIAS/KEY_PASSWORD`; falls back to the debug key if unset. On the laptop they're in `~/.gradle/gradle.properties`; keystore at `~/.android-keys/gen3-companion.jks` (PKCS12, alias `gen3-companion`, SHA-256 E2:19:3A:61:…:47:6F). Never commit either; Stylianos must back them up.
- Windows: the SDK's default CMake 3.22.1 ships ninja 1.10, which fails on the native modules' >260-char paths even with LongPathsEnabled=1. Installed `cmdline-tools/latest` + `cmake;3.31.6` (ninja 1.12.1); the build script writes `android/local.properties` `cmake.dir=` to the newest CMake 3.30+ on Windows.
- CI (`.github/workflows/ci.yml`, job `apk`, pushes only): builds the APK, uploads it as an artifact, attaches it to a GitHub Release on `v*` tags. Signs with the release key when these repo secrets exist: `GEN3_KEYSTORE_BASE64` (the .jks, base64), `GEN3_UPLOAD_STORE_PASSWORD`, `GEN3_UPLOAD_KEY_ALIAS` (`gen3-companion`), `GEN3_UPLOAD_KEY_PASSWORD` (same as the store password: PKCS12). Not yet run on GitHub (unpushed).
- Verified on the emulator (2026-10-26): release APK launches without a dev server, the bundled DB opens, an update installs over the previous build (same key), and `src/db/provider.tsx` deletes the previous DB copy (remembers the last name in the kv-store under `db.lastName`; copies from before this change aren't known and stay until the app is reinstalled).
- APK is ~110 MB: native libs for 4 ABIs (arm64-v8a, armeabi-v7a, x86, x86_64). For a release, `-PreactNativeArchitectures=arm64-v8a,armeabi-v7a` would shrink it a lot (but then it won't run on the x86_64 emulator).
- Bumping versions: `expo.version` (versionName) and `expo.android.versionCode` (must increase for updates) in app.json.

## Existing code (reference only, don't extend)

- `PokeApp/gen3-dex/` — earlier Next.js 15 + Drizzle + Postgres (Neon) attempt. Its WIP is committed ("checkpoint 0"; `.env` is not tracked). Reusable assets: `public/pokemon-images/` (892 PNGs), `public/pokeball*.svg` (per-version Pokéballs), `components/pokemon-types-svg/` (type icons). Its `.env` holds a Neon URL — never print or commit it.
- `gen3-dex/.q.cjs` is a stray helper script left by the planning session; safe to delete.
- `Documents/Projects/pokeApi-v2/` — old Express seeder that pulled from PokeAPI. Known bugs, for the record: Fairy-as-second-type check used `types[1].name` instead of `types[1].type.name` (so Marill, Jigglypuff, Ralts line, Mawile, Mr. Mime kept Fairy); ability filter list built without `await`; first ability never filtered (Gengar got Cursed Body); no handling of Gen 6/7 stat changes or Gen 8 friendship. `poke-api`, `poke-api-v1`, `pokeApi`, `pokeApi-v2 - Copy` are older, superseded.

## Plan

1. **Scaffold**: commit gen3-dex WIP; create the new Expo project in a new folder next to it (e.g. `PokeApp/gen3-companion/`); git init; TypeScript strict; ESLint/Prettier; copy over sprites and icons.
2. **Schema + importer**: design the schema _together with Stylianos_ (it decides what the app can show); importer parses pret files into `assets/db/gen3.db`; add tests for the parser and for stat formulas.
3. **Pokédex** list + detail screens (he writes, Claude guides).
4. **Playthrough guide** (optional — he's not sure he wants it): trainers, gyms, encounters per route. Keep it self-contained (own route group, e.g. `src/app/(guide)/`, plus its own components/queries) and don't make the Pokédex or Frontier tool depend on it, so it can be dropped without touching anything else.
5. **Battle Frontier tool.**
6. **Polish**: tests, GitHub Actions CI, release APK, README with architecture, demo video.

## Progress

> **Start here (next session, updated 2026-10-26):** Done since the last pointer: gifts/one-time encounters, Battle Factory rules, Pike/Pyramid wild Pokémon, a signed release APK (`npm run apk`, verified on the emulator), old-DB-copy cleanup, README refresh. **Waiting on Stylianos:** (1) `git push` (35+ local commits); (2) add the four CI signing secrets (steps in "Release build" below); (3) back up `~/.android-keys/gen3-companion.jks` + `~/.gradle/gradle.properties`. Claude's possible next items: Battle Dome rules; shrinking the APK (ABI filter); first CI run fixes after the push. His side: practice plan P1–P7, then the Frontier screens as a guided exercise.

- **Step 1 (scaffold): done** (2026-10-24). Expo SDK 58, React Native 0.88, Expo Router, TypeScript strict, blank app (`src/app/_layout.tsx` with a Stack, `src/app/index.tsx`). ESLint (`eslint-config-expo` + `eslint-config-prettier`), Prettier defaults.
  - Old `gen3-dex` WIP: committed as "checkpoint 0" (2026-10-24); its stray `.q.cjs` is in that commit too. Type icons and Pokéball SVGs from the old project could still be copied in (sprites now come from pret instead).
- **Step 2 (schema + importer): done** (2026-10-24). Schema agreed with Stylianos (his answers: title-case names; pret sprites; store per-game text — R/S turned out to differ). See "Data pipeline" above.
- **Step 3 (Pokédex screens): in progress** (started 2026-10-25). Styling: NativeWind.
  - DB wiring: done (he asked Claude to write it). `src/db/provider.tsx` (`SQLiteProvider` + `assetSource`, Suspense), `src/db/index.ts` (`useDb()` → typed Drizzle client; the expo-sqlite driver is sync, so `.get()`/`.all()`). SDK 58's default Metro config already bundles `.db` (the `metro.config.js` is only for NativeWind). The local copy is named `gen3-<metro asset hash>.db` because expo-sqlite never overwrites an existing copy; a rebuilt DB gets a new name. Follow-up: delete stale `gen3-*.db` copies after an update (9 MB each).
  - NativeWind: done. v4.2.7 (latest stable; officially lists SDK 57, works on 58) with Tailwind 3. `tailwind.config.js` scans `src/**`; type colours are `bg-type-<type>` (`???` → `mystery`). Class names must appear in full in source (see `src/components/type-badge.tsx`). Verified by `expo export`: compiled styles are in the bundle.
  - List screen: done by Claude at his request (2026-10-25): `src/app/index.tsx` (FlatList + search by name/number), `src/components/pokemon-row.tsx`, `type-badge.tsx`. Queries live in `src/db/queries.ts`, typed against any sync Drizzle DB (`Db`), so `queries.test.ts` runs them on the real gen3.db via better-sqlite3. Not yet checked on a device.
  - Web: a preview only (Android is the target). On web the DB is opened **in memory with sql.js** + `drizzle-orm/sql-js` (`src/db/provider.web.tsx`); native uses expo-sqlite (`provider.tsx`); both fill `DbContext` (`src/db/context.ts`, `useDb()`). Why: expo-sqlite's web sync API needs SharedArrayBuffer → cross-origin isolation, and the Expo dev server can't send COOP/COEP in "single" mode (Metro `enhanceMiddleware` runs after Expo's HTML middleware; the expo-router `headers` option only applies in server output); a service-worker workaround was flaky on reload, and OPFS file locks broke reloads. Also: `metro.config.js` adds `wasm` to assetExts; `darkMode: "class"` (NativeWind's web runtime throws under "media"); `web.output: "single"` (SSR rendered an empty list → hydration mismatch). Verified 2026-10-25 with a headless-Chrome walkthrough (list, search, detail, moves, game switch, back, reload, deep link) and on the Android emulator.
  - Data bug found: category "DNA" displays as "Dna" (importer's ALL CAPS → title case lowercases acronyms). Fix in `scripts/import/lib/text.ts`.
  - On first launch in Expo Go once showed "Compiling JS failed … invalid arrow function parameter list"; not reproducible (code unchanged worked on relaunch) — likely a bad first bundle download. If it recurs, reload.
  - CI: `.github/workflows/ci.yml` (lint, typecheck, format, test on Node 24). Not yet seen running on GitHub (unpushed as of 2026-10-25).
  - Decisions (2026-10-25):
    - **Game selection is per game (5 options), not per pair** — R/S, FR/LG differ (Dex text, encounters, Deoxys). A global "current game" (React context) drives the screens; where both games of a pair have identical data, show it once labelled e.g. "FR/LG".
    - **Detail screen = SmartDex-style swipeable pages/tabs**: 1) overview (sprite + shiny toggle, types, stats, Dex entries), 2) moves (level-up, TM/HM, tutor, egg), later locations and evolution/breeding. Exact split to be refined.
    - Filters wanted: by type, by game's Dex, sorting by stats.
  - Detail screen: done by Claude at his request (2026-10-25); **he wants a walkthrough of it afterwards** (dynamic routes, `useLocalSearchParams`, `Link asChild`, context, the swipe pager, the queries). Not yet checked on a device.
    - `src/app/pokemon/[id].tsx` loads data with `getPokemonDetail` / `getPokedexEntries` / `getLearnset` (`src/db/queries.ts`, tested on the real DB) and renders `SwipeTabs` (`src/components/swipe-tabs.tsx`, horizontal paging ScrollView, no extra library) with `components/pokemon/overview-page.tsx` and `moves-page.tsx`.
    - Current game: `src/state/current-game.tsx` (context, default Emerald, not persisted yet) + `components/game-picker.tsx` on the list and detail screens. `src/lib/games.ts` mirrors the `game` table (tested).
    - `src/lib/pokemon-format.ts`: units, gender odds as the game computes them (ratio/256, so 12.1% ♀ not 12.5%). `statRange()` in `stats.ts` gives min/max at Lv 50/100.
  - Theme + restyle: done by Claude at his request (2026-10-25). Light/dark follow the system. Colours are semantic tokens in `src/theme/palette.json` (canvas, surface, sunken, line, ink, ink-muted, ink-subtle, accent, on-accent); `tailwind.config.js` maps them to `rgb(var(--token))` classes (`bg-surface`, `text-ink`…) and `AppThemeProvider` (`src/theme/theme.tsx`) sets the variables with NativeWind `vars()`, themes React Navigation, the status bar and the Android window background. Use tokens, not raw greys or `dark:` variants; `useColors()` for props that need a colour string. Also `game-*` colours (picker) and `TYPE_TINT` (`bg-type-x/20`). `Sprite` component keeps pixel art crisp on web (`image-rendering: pixelated`; Android still smooths it).
  - List: phone = card rows (`pokemon-row.tsx`); width ≥ 640 = grid of `pokemon-card.tsx` (columns from width, max content width 1200). Detail capped at `max-w-3xl`; `SwipeTabs` measures its own width.
  - Testing setup that works: `adb reverse tcp:8082 tcp:8082` + `am start -W -a android.intent.action.VIEW -d exp://127.0.0.1:8082 host.exp.exponent` (launching over the LAN IP was flaky and twice gave a corrupt-bundle "Compiling JS failed"); web via headless Chrome + puppeteer-core, `emulateMediaFeatures` for dark; emulator dark mode via `adb shell cmd uimode night yes`.
  - Detail now has 4 swipe pages (2026-10-25, by Claude at his request): Overview, Moves, **Evolution** (`getEvolutionChain` → tree from the first stage, branches indented; labels in `src/lib/evolution.ts`), **Locations** (`getLocations` per game, grouped by place). Gifts/one-time encounters added 2026-10-25 (see their section).
    - Research for that (2026-10-25): map scripts (`data/maps/*/scripts.inc`, `data/scripts/`; add to the sparse paths of all three repos, plus `map.json` for map ids) have ~10–20 `givemon` / `setwildbattle` / `giveegg` per repo. Literal `SPECIES_X, level` ones parse easily. Need hand curation: variable species (FRLG Game Corner prizes `VAR_TEMP_1`, Saffron Dojo, `PLAYER_STARTER_SPECIES`), R/S version stand-ins (`SPECIES_GROUDON_OR_KYOGRE`, `SPECIES_LATIAS_OR_LATIOS`), Ruby `data/scripts/static_pokemon.inc` (Electrode, Kecleon; no map in the file), C-code encounters (Hoenn starters in `starter_choose.c`, roamers in `roamer.c`, event islands), in-game trades (`src/data/trade.h`). Exclude pokeruby `data/scripts/debug.inc`. Suggested table: `static_encounter(game, location, pokemon, level, kind: gift|egg|static|trade|roaming|prize|starter, note)`.
  - Web scrolling fixed: `SwipeTabs` gives pages an explicit height (on web a page's ScrollView otherwise grows to its content and never scrolls).
  - Theme switch: header button (`components/theme-toggle.tsx`) cycles Auto/Light/Dark; saved via `src/lib/preferences.ts` (native: `expo-sqlite/kv-store`; web: `localStorage`), applied with NativeWind `colorScheme.set()`. Any scheme change logs a dev-only "state update on a component that hasn't mounted yet" from NativeWind internals (also on a plain system switch) — harmless.
  - In Expo Go the dev "Tools" button covers the header's right side; launch with `?__expo_disable_fab=1` to test.
  - Next: filters/sorting on the list (type, game's Dex, stats); persist the current game (same preferences helper) — these are practice-plan exercises (his).
  - **Learning material (2026-10-25):** `docs/learning/walkthrough.md` (10-chapter tour of the code) and `docs/learning/practice-plan.md` (P1–P7: Hoenn number, remember game, type filter, regional Dex, stat sort, custom level, stretch). Those exercises are **his to write** — when he asks about one, give hints and review, don't implement it. Claude's share meanwhile: importer fixes ("Dna" → "DNA", gift/static encounters) and Battle Frontier data.
- Quality gates before calling anything done: `npm run lint`, `npm run typecheck`, `npm test`, `npm run format:check`. Also follow `AGENTS.md` (from the Expo template): `npx expo install` for packages, versioned Expo docs over memory.

## Practical notes

- Machine: Windows (x64). Has Android Studio / `.android` and Expo history. Node 24 (upgraded from 22.10, which is too old for Expo SDK 58).
- `package-lock.json` is regenerated on Windows with Node 24's npm; regenerate it there rather than in cloud sessions, so it matches the laptop.
- GitHub repo: `ntua-el18716/gen3-dex` (the name is historical; the app is "Gen 3 Companion"). On the laptop it is cloned at `Documents/Projects/PokeApp/gen3-companion/`.
- Keep commits small and descriptive.

## Working in cloud sessions (phone / web)

- The old local folders (`gen3-dex`, `pokeApi-v2`) are not available in cloud sessions; everything needed about them is summarised above.
- Cloud sessions can fetch the pret repos from GitHub; nothing else needs network.
- Pushing from Claude app sessions has failed so far (GitHub app access); work was handed over as git bundles that Stylianos pulls on his laptop.
