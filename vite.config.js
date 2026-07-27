import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync("./package.json", "utf-8"));

function gitShortSha() {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "unknown";
  }
}

export default defineConfig({
  base: "/",
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __GIT_SHA__: JSON.stringify(gitShortSha()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
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
