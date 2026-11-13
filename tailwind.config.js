const palette = require("./src/theme/palette.json");
const typeColors = require("./src/theme/type-colors.json");

/** `bg-surface` etc. read CSS variables that AppThemeProvider sets per scheme. */
const themeColors = Object.fromEntries(
  Object.keys(palette.light).map((token) => [
    token,
    `rgb(var(--${token}) / <alpha-value>)`,
  ]),
);

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  // NativeWind's web runtime sets the colour scheme itself, which throws under
  // the default "media" mode. Native platforms ignore this setting.
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ...themeColors,
        // The classic type colours (as used on Bulbapedia); shared with the
        // TypeScript code, which needs them as strings for gradients.
        type: typeColors,
        // One colour per game, for the game picker.
        game: {
          ruby: "#C0392B",
          sapphire: "#2563EB",
          emerald: "#059669",
          firered: "#EA580C",
          leafgreen: "#65A30D",
        },
      },
    },
  },
  plugins: [
    // Light values as the default, so classes work before the provider mounts.
    ({ addBase }) =>
      addBase({
        ":root": Object.fromEntries(
          Object.entries(palette.light).map(([token, rgb]) => [
            `--${token}`,
            rgb.join(" "),
          ]),
        ),
      }),
  ],
};
