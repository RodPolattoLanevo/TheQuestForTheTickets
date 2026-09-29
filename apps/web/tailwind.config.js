/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Dark tooled-leather / old-tome palette - kept the same token names (ink/gold/ember)
        // so every existing className in the app repaints automatically.
        ink: {
          950: "#120c08",
          900: "#1c140d",
          800: "#291d12",
          700: "#3a2a18",
          600: "#4d3820",
        },
        gold: {
          400: "#e8cb7d",
          500: "#c9a227",
          600: "#8f721b",
        },
        ember: {
          400: "#c1594a",
          500: "#8f2a22",
        },
      },
      fontFamily: {
        // Engraved-title serif for headers, numbers, buttons, nav; an old-book serif for
        // dense body copy (reward lists, admin tables) so it stays legible at small sizes.
        display: ["Cinzel", "Georgia", "serif"],
        decorative: ["\"Cinzel Decorative\"", "Cinzel", "Georgia", "serif"],
        body: ["\"EB Garamond\"", "Georgia", "serif"],
      },
      boxShadow: {
        glow: "0 0 0 2px rgba(201, 162, 39, 0.55), 0 0 20px rgba(201, 162, 39, 0.4)",
        engraved: "inset 0 2px 4px rgba(0, 0, 0, 0.7), inset 0 -1px 0 rgba(255, 224, 160, 0.06)",
        embossed: "0 1px 0 rgba(255, 224, 160, 0.12), 0 2px 6px rgba(0, 0, 0, 0.6)",
      },
    },
  },
  plugins: [],
};
