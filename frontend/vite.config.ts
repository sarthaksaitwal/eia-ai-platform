import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Inside the container the source arrives over a bind mount from the Windows
// host, and those do not propagate inotify events to Linux. Vite's watcher
// would therefore see no edits and HMR would never fire -- silently, which is
// the worst kind. Polling costs CPU, so it is off unless compose asks for it.
const usePolling = process.env.VITE_USE_POLLING === "true";

// The dev server proxies /api to the Express backend, so the browser sees one
// origin and no CORS preflight is involved. Set VITE_API_BASE_URL only when
// the API lives somewhere this proxy cannot reach it.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Only set when polling is wanted; otherwise Vite keeps its own defaults.
    watch: usePolling ? { usePolling: true, interval: 300 } : undefined,
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
