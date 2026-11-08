// Vite resolves `vite.config.js` before `vite.config.ts`.
// This keeps the original TypeScript config untouched while making the
// same-origin AI relay available to `npm run dev`, `npm run build` and
// `npm run preview` — including when those commands are launched directly.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { astraRelay } from "./server/astra-relay.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [astraRelay(), react(), tailwindcss(), viteSingleFile()],
  resolve: {
    // The hosted preview has a parent Next.js project. Keep one React instance
    // for both the app and the knowledge-graph renderer.
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
