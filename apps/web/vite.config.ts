import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // El .env compartido vive en la raiz del monorepo (junto al del backend), no en apps/web.
  envDir: path.resolve(dirname, "../.."),
  server: {
    port: 5173,
  },
});
