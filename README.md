# Gen 3 Companion

An offline-first companion app for the Generation 3 Pokémon games (Ruby, Sapphire, Emerald, FireRed, LeafGreen): a Gen 3–accurate Pokédex, a playthrough guide with every trainer's team, and a Battle Frontier opponent lookup.

> Work in progress. See [`CLAUDE.md`](./CLAUDE.md) for the project brief and plan.

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
- **One schema** (`src/db/schema.ts`) is shared by the importer and the app, so a schema change breaks both at compile time.

What's in it: 386 Pokémon, 354 moves, 77 abilities, ~300 items, 79k learnset entries, 9.3k encounter slots across 245 locations, 3.4k trainers and the 882 Battle Frontier sets with their 300 trainers. Sprites (front/back, normal/shiny) are generated from the games' graphics and palettes.

## Getting started

```bash
npm install
npx expo start
```

Then open the app on an Android emulator (press `a`) or scan the QR code with Expo Go on your phone.

## Scripts

| Command               | What it does                                                     |
| --------------------- | ---------------------------------------------------------------- |
| `npm start`           | Start the Expo dev server                                        |
| `npm run import`      | Fetch the pinned pret sources and rebuild `assets/db/gen3.db`    |
| `npm run sprites`     | Rebuild the sprites from pret's graphics (run `import` first)    |
| `npm test`            | Unit tests (parser, game rules, stat formulas) + database checks |
| `npm run lint`        | ESLint (Expo config + Prettier)                                  |
| `npm run typecheck`   | TypeScript for the app and the scripts                           |
| `npm run format`      | Format everything with Prettier                                  |
| `npm run db:generate` | Regenerate the SQL migration after changing `src/db/schema.ts`   |

## Project structure

```
src/app/          screens and layouts (Expo Router: every file is a route)
src/db/schema.ts  the database schema, shared with the importer
src/lib/          game logic used by the app (stat formulas, damage class)
src/generated/    generated code (sprite map); don't edit by hand
scripts/import/   the pret → SQLite importer
scripts/sprites/  the sprite generator
assets/db/        the generated database
assets/sprites/   the generated sprites
drizzle/          SQL migration generated from the schema
```

## Disclaimer

Fan project for personal and educational use. Pokémon and all related names are trademarks of Nintendo, Game Freak and Creatures Inc. Game data and sprites come from the pret decompilation projects.
