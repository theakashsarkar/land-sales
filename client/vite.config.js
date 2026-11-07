import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // admin backend must be matched before the marketing "/api" rule
      "/api/v1": "http://localhost:4001",
      "/api": "http://localhost:4000",
    },
  },
});
