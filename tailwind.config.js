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
        // The classic type colours (as used on Bulbapedia).
        type: {
          normal: "#A8A878",
          fighting: "#C03028",
          flying: "#A890F0",
          poison: "#A040A0",
          ground: "#E0C068",
          rock: "#B8A038",
          bug: "#A8B820",
          ghost: "#705898",
          steel: "#B8B8D0",
          mystery: "#68A090",
          fire: "#F08030",
          water: "#6890F0",
          grass: "#78C850",
          electric: "#F8D030",
          psychic: "#F85888",
          ice: "#98D8D8",
          dragon: "#7038F8",
          dark: "#705848",
        },
      },
    },
  },
  plugins: [],
};
