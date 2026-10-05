import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The dev server proxies /api to the Express backend, so the browser sees one
// origin and no CORS preflight is involved. Set VITE_API_BASE_URL only when
// the API lives somewhere this proxy cannot reach it.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_PROXY_TARGET || "http://localhost:5000",
        changeOrigin: true,
        // Fetching the environmental baseline calls out to a dozen external
        // providers and takes 1-4 minutes, well past any default timeout.
        timeout: 300000,
        proxyTimeout: 300000,
      },
    },
  },
});
