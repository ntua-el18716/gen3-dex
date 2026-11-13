# Gen 3 Companion

An offline-first companion app for the Generation 3 Pokémon games (Ruby, Sapphire, Emerald, FireRed, LeafGreen): a Gen 3–accurate Pokédex, a playthrough guide with every trainer's team, and a Battle Frontier opponent lookup.

> Work in progress. See [`CLAUDE.md`](./CLAUDE.md) for the project brief and plan.

## What the app does

Three tabs, all offline. The game you pick (R, S, E, FR, LG) drives the data and the app's accent colour.

- **Pokédex**: every Pokémon with per-game Pokédex text, stats with real Lv 50/100 ranges, moves per learn method, evolution family, and where to find it, including gifts and one-time encounters. Values the games compute are shown as the game computes them: capture odds with Gen 3's integer formula, gender odds as ratio/256, hatch steps. Sprites are the games' own, crisp at any size, FireRed/LeafGreen's redrawn ones in those games.
- **League**: gym leaders, Elite Four, Champion and rivals in story order, with full teams (held items, moves) and rematch teams. Rival teams follow the starter you picked.
- **Battle Frontier**: pick a facility and your streak, and see which trainers you can face, every species they can send out, and each possible set with its real stats for the IVs it can have. The Frontier Brains' teams and schedules, the Factory's IV quirk, and the Pike's and Pyramid's wild Pokémon are included.

## Why not PokeAPI?

Most Pokémon data sources describe the _current_ games. Gen 3 differs in many small ways: no Fairy type, Gen 6+ stat buffs, abilities added later, friendship values changed in Gen 8. This project reads the data straight from the [pret](https://github.com/pret) decompilations of the games themselves, so every number is the one the game uses.

## How the data is built

```
pret/pokeemerald ─┐
pret/pokefirered ─┼─▶ scripts/import ─▶ assets/db/gen3.db ─▶ app (expo-sqlite + Drizzle)
pret/pokeruby ────┘        │
                           └─ validated against known Gen 3 facts
```

- **Pinned sources.** The importer checks out fixed commits of the three repos (sparse and shallow), so the database is reproducible byte for byte.
- **A small C-data parser** reads the games' headers: constants, enums, designated initializers, string tables, `#ifdef` branches per game, and list macros.
- **Per-game accuracy.** Each game is read with its own build flags, so Ruby/Sapphire Pokédex text, FireRed/LeafGreen learnsets and Deoxys's form per game all come out right. The three repos are cross-checked wherever they should agree.
- **Game logic where the data is implicit.** Most trainers don't list their moves; the importer reproduces the game's default-moveset rule. Battle Frontier EV spreads follow the game's code, including its 8-bit wrap-around.
- **Event scripts, not just data tables.** Gifts, starters, legendaries, roamers and in-game trades live in the games' map scripts. The importer parses every script into a label graph and traces each `givemon`/`setwildbattle` to the maps that actually run it, so unreachable scripts (debug menus, Mystery Gift) drop out on their own.
- **Battle Frontier rules as tested code.** How each facility picks opponents is reimplemented as pure functions (`src/lib/frontier.ts`), and the importer checks pret's source for every rule it relies on, so an upstream change fails the build instead of silently producing wrong predictions.
- **One schema** (`src/db/schema.ts`) is shared by the importer and the app, so a schema change breaks both at compile time.

What's in it: 386 Pokémon, 354 moves, 77 abilities, ~300 items, 79k learnset entries, 9.3k wild encounter slots and 160 gifts/one-time encounters across 287 locations, 3.4k trainers, and the Battle Frontier: 882 sets, 300 trainers, the Frontier Brains, and the Battle Factory, Pike and Pyramid rules. Sprites (front/back, normal/shiny) are generated from the games' graphics and palettes.

## What reading the game's code turned up

Some of the most useful facts aren't in any data table:

- **Battle Factory IVs come from the wrong streak.** Factory opponents' IVs are read from your _Battle Tower Level 50_ streak, not your Factory streak (`FillFactoryFrontierTrainerParty`). With no Tower progress, Factory opponents keep the weakest IVs however far you get. At a Tower streak of 56–62 the lookup reads past the end of its table, giving random IVs.
- **The Battle Pyramid's wild Pokémon cycle.** The round is `(floors cleared / 7) % 20`, so after round 20 the easiest tables come back. Its intended IV boost after 140 floors indexes the wrong array, so the real game doesn't apply it reliably.
- **Capture odds aren't catch rate / 255.** The game does it in integers with two square roots and four shake checks (`Cmd_handleballthrow`), so a catch rate of 45 at full HP is 6.25%, not the 5.9% many tools show.
- **Versions differ more than expected.** Deoxys's form depends on the game (and so does its learnset between FireRed and LeafGreen), 203 Pokédex entries differ between Ruby and Sapphire, and Ruby only lets you into the Magma Hideout, Sapphire only the Aqua one.

## Getting started

```bash
npm install
npx expo start
```

Then open the app on an Android emulator (press `a`) or scan the QR code with Expo Go on your phone.

### Building the Android APK

```bash
npm run apk   # → dist/gen3-companion-<version>.apk
```

This regenerates `android/` from `app.json` (it's never edited by hand) and runs Gradle's release build. Needs JDK 17 and the Android SDK; on Windows also CMake 3.30+ from the SDK (`sdkmanager "cmake;3.31.6"`), because the default CMake's ninja can't handle the long paths of the native builds.

Release builds are signed with your own key when these Gradle properties are set (in `~/.gradle/gradle.properties`, or as `ORG_GRADLE_PROJECT_*` environment variables in CI): `GEN3_UPLOAD_STORE_FILE`, `GEN3_UPLOAD_STORE_PASSWORD`, `GEN3_UPLOAD_KEY_ALIAS`, `GEN3_UPLOAD_KEY_PASSWORD`. Without them the debug key is used. CI builds the APK on every push to `main` and attaches it to a GitHub Release for `v*` tags.

## Scripts

| Command               | What it does                                                     |
| --------------------- | ---------------------------------------------------------------- |
| `npm start`           | Start the Expo dev server                                        |
| `npm run import`      | Fetch the pinned pret sources and rebuild `assets/db/gen3.db`    |
| `npm run sprites`     | Rebuild the sprites from pret's graphics (run `import` first)    |
| `npm run icons`       | Rebuild the type-icon module from `assets/type-icons/`           |
| `npm run apk`         | Build the release APK into `dist/`                               |
| `npm test`            | Unit tests (parser, game rules, stat formulas) + database checks |
| `npm run lint`        | ESLint (Expo config + Prettier)                                  |
| `npm run typecheck`   | TypeScript for the app and the scripts                           |
| `npm run format`      | Format everything with Prettier                                  |
| `npm run db:generate` | Regenerate the SQL migration after changing `src/db/schema.ts`   |

## Project structure

```
src/app/          screens and layouts (Expo Router: every file is a route; tabs in (tabs)/)
src/components/   UI components (the collapsing Pokémon page, League and Frontier cards)
src/db/schema.ts  the database schema, shared with the importer
src/db/*queries.ts typed queries (tested against the real database)
src/lib/          game logic (stat formulas, capture odds, Battle Frontier rules, League lists)
src/theme/        colours: palette, type colours, per-game accents
src/generated/    generated code (sprite map, type icons); don't edit by hand
scripts/import/   the pret → SQLite importer
scripts/sprites/  the sprite generator
scripts/icons/    the type-icon generator
scripts/apk/      the release APK build
plugins/          Expo config plugins (release signing)
assets/db/        the generated database
assets/sprites/   the generated sprites
assets/type-icons/ the type icons (SVG)
drizzle/          SQL migration generated from the schema
```

## Disclaimer

Fan project for personal and educational use. Pokémon and all related names are trademarks of Nintendo, Game Freak and Creatures Inc. Game data and sprites come from the pret decompilation projects.
