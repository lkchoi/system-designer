import fs from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const certsExist = fs.existsSync(".certs/key.pem") && fs.existsSync(".certs/cert.pem");

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/sql.js")) return "sql-js";
          if (id.includes("node_modules/jszip")) return "jszip";
          if (id.includes("node_modules/@xyflow")) return "reactflow";
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    css: false,
    exclude: ["e2e/**", "node_modules/**", "server/**"],
  },
  server: certsExist
    ? {
        https: {
          key: fs.readFileSync(".certs/key.pem"),
          cert: fs.readFileSync(".certs/cert.pem"),
        },
      }
    : {},
});
