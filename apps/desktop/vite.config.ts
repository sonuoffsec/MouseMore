import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: {
    target: "es2021",
    sourcemap: false,
    // Two windows: the app (index.html) and the transparent overlay (overlay.html).
    rollupOptions: { input: { main: "index.html", overlay: "overlay.html" } },
  },
});
