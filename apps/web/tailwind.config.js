/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Deep navy/indigo "SNES-era JRPG menu" palette - kept the same token names
        // (ink/gold/ember) so every existing className in the app repaints automatically.
        ink: {
          950: "#0a0820",
          900: "#120e33",
          800: "#1c1650",
          700: "#2a2170",
          600: "#3d3296",
        },
        gold: {
          400: "#ffe066",
          500: "#ffc42e",
          600: "#d99a00",
        },
        ember: {
          400: "#ff7a6b",
          500: "#ff4433",
        },
      },
      fontFamily: {
        // Pixel/bitmap display font for headers, numbers, buttons, nav - the load-bearing
        // "16-bit menu" signal. Body copy stays on a normal sans so dense text (reward
        // lists, admin tables) stays legible.
        display: ["\"Press Start 2P\"", "monospace"],
        body: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 3px rgba(255, 196, 46, 0.5), 0 0 16px rgba(255, 196, 46, 0.35)",
        pixel: "3px 3px 0 0 #000",
        "pixel-sm": "2px 2px 0 0 #000",
      },
    },
  },
  plugins: [],
};
