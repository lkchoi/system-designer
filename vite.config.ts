import fs from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const certsExist = fs.existsSync(".certs/key.pem") && fs.existsSync(".certs/cert.pem");

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: certsExist
    ? {
        https: {
          key: fs.readFileSync(".certs/key.pem"),
          cert: fs.readFileSync(".certs/cert.pem"),
        },
      }
    : {},
});
