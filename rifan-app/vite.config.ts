import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: { hmr: process.env.DISABLE_HMR === "true" ? false : { port: 24679 } },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ["recharts"],
          maps: ["leaflet", "react-leaflet"],
          spreadsheets: ["xlsx"],
        },
      },
    },
  },
});
