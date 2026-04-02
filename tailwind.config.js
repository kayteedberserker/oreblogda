module.exports = {
  darkMode: "class", // important for next-themes
  content: ["./app/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // --- APP THEME PROTOCOL v2.0 SYNC ---

        // Light Mode (Default)
        app: {
          bg: "#ffffff",
          card: "#f8fafc",
          text: "#0f172a",
          textSecondary: "#64748b",
          border: "#e2e8f0",

          // Functional Accents (Same for both usually, but can be split if needed)
          accent: "#2563eb", // Primary Blue
          streak: "#f97316", // Orange Flame
          danger: "#ef4444",
          success: "#22c55e",
        },

        // Dark Mode (Used with 'dark:' prefix, e.g., dark:bg-app-dark-bg)
        'app-dark': {
          bg: "#0a0a0a",
          card: "#111111",
          text: "#ffffff",
          textSecondary: "#94a3b8",
          border: "#1e293b",
        }
      },
    },
  },
  plugins: [],
};
