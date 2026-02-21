import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  integrations: [react()],
  vite: {
    server: {
      proxy: {
        "/setup": "http://localhost:8000",
        "/state": "http://localhost:8000",
      },
    },
  },
});
