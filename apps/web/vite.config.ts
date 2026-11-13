import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

const API = process.env.ARTEI_API ?? "http://localhost:8787";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Artei — music with a living visual world",
        short_name: "Artei",
        description: "Free, Creative Commons music with synced lyrics and a unique audio-reactive visual world for every song.",
        theme_color: "#07060b",
        background_color: "#07060b",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        scope: "/",
        categories: ["music", "entertainment"],
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          { name: "Search", url: "/search", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
          { name: "Library", url: "/library", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
        ],
      },
      workbox: {
        // Offline shell: the app, fonts and icons are precached.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            // Shelves, search results, track details and lyrics: fresh when online, cached when not.
            urlPattern: ({ url, request }) =>
              url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/stream/") && request.method === "GET",
            handler: "NetworkFirst",
            options: {
              cacheName: "artei-api",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Album artwork from Jamendo.
            urlPattern: ({ url }) => url.hostname.endsWith("jamendo.com") && url.pathname !== "/",
            handler: "CacheFirst",
            options: {
              cacheName: "artei-artwork",
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Audio (/api/stream) is never cached by the service worker: it uses
          // HTTP range requests and the browser's media cache handles it.
        ],
      },
    }),
  ],
  server: {
    host: true,
    proxy: { "/api": { target: API, changeOrigin: true } },
  },
  preview: {
    proxy: { "/api": { target: API, changeOrigin: true } },
  },
});
