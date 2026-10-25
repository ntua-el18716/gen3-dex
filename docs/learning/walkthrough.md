# Code walkthrough

A guided tour of the Gen 3 Companion app as it is after step 3 (Pokédex). Read it next to the code: every chapter points at real files. Each chapter ends with **Check yourself** questions; if you can answer them without looking, move on. Answers are in the code, not here.

Suggested pace: one or two chapters per sitting. Chapters 1–4 are the foundation; 5–8 build on them; 9–10 are background.

When you're done with a chapter, the matching exercise in [practice-plan.md](practice-plan.md) is the best way to make it stick.

---

## 0. The big picture

```
Expo (tooling, native modules)  ─┐
React Native (View, Text, …)     ├─ the app, written in TypeScript + React
Expo Router (screens = files)    │
NativeWind (Tailwind classes)   ─┘
        │ reads
        ▼
assets/db/gen3.db  ← built by the importer (scripts/import) from the pret decompilations
        ▲
Drizzle ORM: typed queries, schema shared by importer and app (src/db/schema.ts)
```

- **React Native** renders real native views (Android `View`, iOS `UIView`); on web, **react-native-web** turns them into `<div>`s. You write the same components for all three.
- **Expo** is the toolkit around it: the dev server (Metro bundler), Expo Go, and modules like `expo-sqlite`, `expo-image`, `expo-router`.
- Everything is **offline**: the database ships inside the app. No server, no network calls.

Run it: `npx expo start`, then `a` (Android emulator), `w` (web) or scan the QR code with Expo Go.

**Check yourself:** Where does the data come from, and when is it created (build time or run time)? What turns `<View>` into a `<div>` on web?

---

## 1. React Native building blocks

Read: [src/components/pokemon-row.tsx](../../src/components/pokemon-row.tsx), [src/components/type-badge.tsx](../../src/components/type-badge.tsx)

- `View` is a box (like `div`), `Text` is the only place text may appear (a bare string inside a `View` is an error), `Image` shows pictures, `Pressable` makes anything tappable.
- **Layout is Flexbox, but the default direction is column** (top to bottom), unlike the web's row. That's why rows say `flex-row`.
- Styling uses **NativeWind**: Tailwind classes in `className`. NativeWind compiles them to React Native style objects at build time.
- Components are just functions that take props and return JSX. `PokemonRow({ pokemon })` takes one Pokémon and draws a card.
- `TypeBadge` shows a common trick: a lookup table from data to class names (`BACKGROUND[type]`). See chapter 8 for why the full class names must be written out.

**Check yourself:** Why does `PokemonRow` use `flex-row`? What would happen if you put the text `#001` directly inside a `View`? What does the `small` prop of `TypeBadge` change?

---

## 2. Navigation with Expo Router

Read: [src/app/_layout.tsx](../../src/app/_layout.tsx), [src/app/index.tsx](../../src/app/index.tsx), [src/app/pokemon/[id].tsx](../../src/app/pokemon/[id].tsx)

- **Every file in `src/app/` is a screen**, and its path is its URL: `index.tsx` is `/`, `pokemon/[id].tsx` is `/pokemon/25`, `/pokemon/386`…
- `[id]` in square brackets makes a **dynamic route**. The screen reads the value with `useLocalSearchParams()`. It always arrives as a **string** (`"25"`), hence `Number(id)`.
- `_layout.tsx` wraps all screens. Ours returns a `<Stack>`: screens are pushed on top of each other with a back button (Android back / browser back work for free).
- A screen sets its own header with `<Stack.Screen options={{ title: … }} />` inside its JSX.
- Navigating: `<Link href={{ pathname: "/pokemon/[id]", params: { id } }}>`. With `asChild`, `Link` doesn't render its own element; it hands its press handling to its child (`Pressable`), so the whole card is the link. See `PokemonRow` and `StageCard` in [evolution-page.tsx](../../src/components/pokemon/evolution-page.tsx).
- `typedRoutes` (in `app.json`) makes the `pathname` type-checked: a typo like `/pokemon/[idd]` fails `npm run typecheck`.

**Check yourself:** What URL shows Pikachu's page? Why `Number(id)`? Where is the header's theme button added, and why does it then appear on every screen?

---

## 3. Providers and React context

Read: [src/app/_layout.tsx](../../src/app/_layout.tsx), [src/state/current-game.tsx](../../src/state/current-game.tsx), [src/components/game-picker.tsx](../../src/components/game-picker.tsx)

- Some values are needed everywhere: the database, the current game, the theme. Passing them as props through every component ("prop drilling") gets messy. **Context** solves it: a provider at the top holds the value, any component below reads it with a hook.
- The pattern, in `current-game.tsx`:
  1. `createContext(null)` creates the "channel".
  2. `CurrentGameProvider` keeps the state (`useState`) and provides `{ game, setGame }`.
  3. `useCurrentGame()` reads it with `use(…)`, and throws a clear error if used outside the provider.
- The **order of providers matters**: `AppThemeProvider` → `DatabaseProvider` → `CurrentGameProvider` → `Stack`. A component can only read providers that are _above_ it.
- When `setGame("firered")` runs, every component that called `useCurrentGame()` re-renders. That's why switching the game updates the list, the moves and the locations at once.
- `useMemo(() => ({ game, setGame }), [game])` keeps the provided object the same between renders unless `game` changes, so consumers don't re-render for nothing.

**Check yourself:** Why can't `DatabaseProvider` use `useCurrentGame()`? Which components re-render when you tap "FR"? What error do you get if you render `GamePicker` outside the provider, and where is it thrown?

---

## 4. The data layer

Read: [src/db/schema.ts](../../src/db/schema.ts) (skim), [src/db/context.ts](../../src/db/context.ts), [src/db/provider.tsx](../../src/db/provider.tsx), [src/db/provider.web.tsx](../../src/db/provider.web.tsx), [src/db/queries.ts](../../src/db/queries.ts), [src/db/queries.test.ts](../../src/db/queries.test.ts)

- **One schema, two users.** `schema.ts` defines the tables with Drizzle. The importer writes the database with it; the app reads with it. Rename a column and both sides fail to compile: that's the point.
- **Opening the bundled database:**
  - Native ([provider.tsx](../../src/db/provider.tsx)): `SQLiteProvider` copies `gen3.db` out of the app bundle into app storage on first launch, then opens it. The copy is named after the file's content hash so an updated app gets the new database (expo-sqlite never overwrites an existing copy).
  - Web ([provider.web.tsx](../../src/db/provider.web.tsx)): the database is loaded **into memory with sql.js** (SQLite compiled to WebAssembly).
  - **Platform files:** `provider.web.tsx` is picked automatically on web, `provider.tsx` everywhere else. Same trick for [preferences.ts](../../src/lib/preferences.ts) / `.web.ts`. Both export the same names, so the rest of the app doesn't care.
  - Both fill `DbContext`; screens call `useDb()`.
- **Suspense:** opening is asynchronous. The provider "suspends" until the database is ready and React shows the `fallback` (`LoadingScreen`) meanwhile, so screens never see a half-open database.
- **Queries** live in `queries.ts`, as plain functions that take a `Db`:
  - `db.select({...}).from(table).where(...).all()` reads like SQL, and the result type is inferred from the select. Hover over `listPokemon` in VS Code to see it.
  - Joins: `getLearnset` (moves + TM numbers), `getPokemonDetail` (held items through the `game` table).
  - Aggregates: `getLocations` uses `min`, `max`, `sum` with `groupBy`.
  - The driver is **synchronous**, so `.all()` / `.get()` return rows directly, no `await`.
- **Why `Db` is a generic type:** queries accept _any_ synchronous Drizzle database. In the app it's expo-sqlite or sql.js; in tests it's better-sqlite3 on the real `gen3.db`. That's how the queries are tested without a phone.

**Check yourself:** What happens on a phone that has `gen3-<oldhash>.db` when you ship a new database? Why does the web use sql.js instead of expo-sqlite? Find the SQL `GROUP BY` in `getLocations`: what does `rate` add up? Run `npx vitest run src/db` and read one test.

---

## 5. Lists that scroll fast

Read: [src/app/index.tsx](../../src/app/index.tsx), [src/components/pokemon-card.tsx](../../src/components/pokemon-card.tsx), [src/components/pokemon/moves-page.tsx](../../src/components/pokemon/moves-page.tsx)

- `FlatList` only renders the rows near the screen (**virtualization**). 386 rows stay smooth. Never `.map()` a long list inside a `ScrollView`.
- `keyExtractor` gives each row a stable key so React can reuse rows.
- **Responsive grid:** `useWindowDimensions()` gives the window width; below 640 px it's one column of rows, above it a grid of cards with `numColumns`. `numColumns` can't change on a mounted list, so the list gets `key={columns}`: a new key makes React throw the old list away and mount a new one.
- `ListHeaderComponent` puts the search box and game picker _inside_ the list, so they scroll away with it.
- `SectionList` (moves page) is a `FlatList` with section headers; `stickySectionHeadersEnabled` keeps the current header pinned.

**Check yourself:** Why does changing `key` remount the list? What is `cardWidth` for, and why not just `flex-1`? What does `ListEmptyComponent` show?

---

## 6. State, derived values and effects

Read: [src/app/index.tsx](../../src/app/index.tsx) (search), [src/app/pokemon/[id].tsx](../../src/app/pokemon/[id].tsx), [src/theme/theme.tsx](../../src/theme/theme.tsx) (`useEffect`)

- `useState` holds what the user changes (`query`). Everything computable from it is **derived** during render: `shown = all.filter(...)`. Don't store derived values in state.
- `useMemo` caches expensive work between renders (`listPokemon(db)` runs once, not on every keystroke). The dependency array says when to recompute.
- The project has the **React Compiler** on (`app.json` → `reactCompiler`), which memoizes a lot automatically. Explicit `useMemo` is still clearer to read and works without it.
- `useEffect` is only for syncing with something **outside React**: the Android window colour (`SystemUI`), NativeWind's colour scheme. Not for computing values.
- **Lint rules enforce this:** calling `setState` directly inside an effect is an error in this project (see `react-hooks/set-state-in-effect`).

**Check yourself:** Why is `shown` not a `useState`? What would go wrong if `listPokemon(db)` had no `useMemo`? Name the two effects in `theme.tsx` and what outside thing each one updates.

---

## 7. The swipe pages

Read: [src/components/swipe-tabs.tsx](../../src/components/swipe-tabs.tsx)

- The pages sit side by side in a **horizontal `ScrollView` with `pagingEnabled`**: it snaps one page at a time.
- Two-way sync:
  - swipe → `onScroll` computes `round(x / width)` → `setIndex` → the tab bar highlights;
  - tap a tab → `pager.current.scrollTo({ x: i * width })` → the pager moves.
- `useRef` keeps a handle to the `ScrollView` so we can call `scrollTo`. (In React Native 0.88 the ref type is `ScrollViewInstance`.)
- `onLayout` measures the area the pages get. Each page is given that **exact width and height**.
  - Width: on big screens the detail column is narrower than the window.
  - Height: **this was the web scroll bug.** Without a fixed height, on web each page's vertical `ScrollView` grew to its whole content and had nothing to scroll.
- The detail screen gives `SwipeTabs` a `key={dexNumber}` so opening another Pokémon (from Evolution) starts on the first page again.

**Check yourself:** What two things keep the tab bar and the pages in sync? Why does every page need an explicit height on web?

---

## 8. Theming and dark mode

Read: [src/theme/palette.json](../../src/theme/palette.json), [tailwind.config.js](../../tailwind.config.js), [src/theme/theme.tsx](../../src/theme/theme.tsx), [src/components/theme-toggle.tsx](../../src/components/theme-toggle.tsx)

- Colours are **semantic tokens** (`canvas`, `surface`, `sunken`, `line`, `ink`, `ink-muted`, `ink-subtle`, `accent`), each with a light and a dark value in `palette.json`.
- `tailwind.config.js` turns each token into a class that reads a **CSS variable**: `bg-surface` means `rgb(var(--surface))`.
- `AppThemeProvider` sets those variables with NativeWind's `vars()` on the root view, choosing the light or dark set. Change the variables → every `bg-surface` in the app changes. No `dark:` classes anywhere.
- Things that need a real colour string (navigation header, `placeholderTextColor`, the spinner, Android ripple) use `useColors()`.
- **Tailwind only generates classes it can find written out in full** in the source. `bg-type-${type}` would silently produce nothing. That's why `TYPE_TINT`, `BACKGROUND` and the game colours are lookup tables of complete class names.
- The switch: `useThemePreference()` → `setPreference("dark")` → saved with `writePreference` → NativeWind's `colorScheme.set("dark")` → `useColorScheme()` reports dark → new variables.

**Check yourself:** To make cards slightly blue in dark mode, which single file do you edit? Why would `className={"bg-type-" + type}` not work? Where is the theme choice stored on Android, and on web?

---

## 9. Game logic and tests

Read: [src/lib/stats.ts](../../src/lib/stats.ts) + [stats.test.ts](../../src/lib/stats.test.ts), [src/lib/evolution.ts](../../src/lib/evolution.ts), [src/lib/pokemon-format.ts](../../src/lib/pokemon-format.ts), [src/lib/damage-class.ts](../../src/lib/damage-class.ts)

- Game rules are **pure functions** (no React, no database): easy to test, easy to reuse in the Battle Frontier tool.
  - `hpStat` / `otherStat` follow the game's integer maths exactly (note the `Math.floor`s).
  - `statRange` gives the worst and best value at a level (shown on the overview).
  - `genderLabel` uses the real Gen 3 odds (ratio / 256, so 12.1% not 12.5%).
  - `damageClass`: in Gen 3, physical/special comes from the move's _type_.
- Tests use **Vitest**: `npm test` runs everything, `npx vitest run src/lib` runs a folder, `npx vitest` watches. Test values come from known sources (Bulbapedia examples, the real database).
- CI (`.github/workflows/ci.yml`) runs lint, typecheck, format check and tests on every push.

**Check yourself:** Why are these functions outside `src/components`? Write down the Lv 50 HP range of a base-100 Pokémon by hand, then check it with `statRange`.

---

## 10. Lessons from debugging (short stories)

These are in the git history; each taught something general.

- **Web crashed with `SharedArrayBuffer is not defined`.** expo-sqlite's web version needs special server headers (cross-origin isolation) that the dev server couldn't send. Fix: on web, use sql.js in memory. _Lesson: "works on Android" ≠ "works on web"; read the platform notes._
- **Hydration mismatch on web.** The server pre-rendered HTML without a database (empty list), the browser rendered 386 Pokémon. Fix: `web.output: "single"` (no server rendering). _Lesson: offline apps don't need SSR._
- **Reload broke the database on web.** A browser file lock (OPFS) was still held by the previous page. Removed by the in-memory approach. _Lesson: prefer designs with no shared state over workarounds._
- **"Compiling JS failed" in Expo Go.** The emulator downloaded a corrupted bundle over the LAN; `adb reverse` fixed it. _Lesson: when an error moves around and the code is unchanged, suspect the environment._
- **Detail pages didn't scroll on web.** See chapter 7. _Lesson: on web, scroll containers need a bounded height._

---

When you've read it all: open [practice-plan.md](practice-plan.md).
