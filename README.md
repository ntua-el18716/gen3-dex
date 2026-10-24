# Gen 3 Companion

An offline-first companion app for the Generation 3 Pokémon games (Ruby, Sapphire, Emerald, FireRed, LeafGreen): a Gen 3–accurate Pokédex, a playthrough guide with every trainer's team, and a Battle Frontier opponent lookup.

> Work in progress. See [`CLAUDE.md`](./CLAUDE.md) for the project brief and plan.

## Stack

- [Expo](https://expo.dev) + React Native + Expo Router (TypeScript)
- SQLite database bundled with the app, queried with Drizzle ORM (planned)
- Data imported from the [pret](https://github.com/pret) decompilations of the games (planned)

## Getting started

```bash
npm install
npx expo start
```

Then open the app on an Android emulator (press `a`) or scan the QR code with Expo Go on your phone.

## Scripts

| Command                | What it does                     |
| ---------------------- | -------------------------------- |
| `npm start`            | Start the Expo dev server        |
| `npm run lint`         | ESLint (Expo config + Prettier)  |
| `npm run typecheck`    | TypeScript, no emit              |
| `npm run format`       | Format everything with Prettier  |
| `npm run format:check` | Check formatting without writing |

## Project structure

```
src/app/      screens and layouts (Expo Router: every file is a route)
src/          everything else: components, hooks, db, utils
assets/       icons, splash, and later the bundled database
```

## Disclaimer

Fan project for personal and educational use. Pokémon and all related names are trademarks of Nintendo, Game Freak and Creatures Inc.
