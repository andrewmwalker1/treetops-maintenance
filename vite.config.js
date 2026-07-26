import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "injectManifest",
      srcDir: ".",
      filename: "sw.js",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
      },
      includeAssets: ["favicon-32.png", "apple-touch-icon.png"],
      manifest: {
        name: "Tree Tops Maintenance",
        short_name: "Maintenance",
        description: "Maintenance and H&S job tracking for Tree Tops Caravan Park.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#E7E2CC",
        theme_color: "#3F5837",
        orientation: "portrait",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
});
