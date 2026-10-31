import {readFileSync} from "node:fs";
import { execFileSync } from "node:child_process";
import { defineConfig, loadEnv } from "vite";
import { validateFrontendEnv } from "./scripts/frontend-env.mjs";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

function releaseMarker() {
  const packageVersion=JSON.parse(readFileSync(new URL("./package.json",import.meta.url),"utf8")).version;
  let commit = process.env.RENDER_GIT_COMMIT || process.env.GITHUB_SHA;
  if (!commit) {
    try {
      commit = execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim();
    } catch {
      commit = "unknown";
    }
  }
  let sourceDirty = true;
  try { sourceDirty = !!execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], {encoding:"utf8"}).trim(); } catch { /* Unverifiable source must not authorize a release notice. */ }
  return {
    name: "danqel-release-marker",
    transformIndexHtml() { return [{tag:"meta",attrs:{name:"danqel-build",content:commit},injectTo:"head"}]; },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source:
          JSON.stringify(
            { version: packageVersion, commit, sourceDirty, builtAt: new Date().toISOString() },
            null,
            2,
          ) + "\n",
      });
    },
  };
}
export default defineConfig(({ command, mode }) => {
  if (command === "build")
    validateFrontendEnv({
      ...loadEnv(mode, process.cwd(), "VITE_"),
      ...Object.fromEntries(
        Object.entries(process.env).filter(([key]) => key.startsWith("VITE_")),
      ),
    });
  return {
    server: {
      host: "0.0.0.0",
      allowedHosts: [".e2b.app", "localhost", "127.0.0.1"],
    },
    preview: { allowedHosts: [".e2b.app", "localhost", "127.0.0.1"] },
    plugins: [
      react(),
      releaseMarker(),
      VitePWA({
        registerType: "prompt",
        includeAssets: [
          "icons/*.png",
          "brand/*.webp",
          "offline.html",
          "push-handler.js",
        ],
        manifest: {
          name: "Danqel Social Boost",
          short_name: "Danqel",
          description:
            "Good Connections. Greater Reach. Discover and promote social profiles safely.",
          id: "/",
          scope: "/",
          lang: "en",
          theme_color: "#07080c",
          background_color: "#07080c",
          display: "standalone",
          start_url: "/",
          icons: [
            {
              src: "/icons/icon-192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "/icons/icon-maskable-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
            {
              src: "/icons/icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
          ],
        },
        workbox: {
          importScripts: ["/push-handler.js"],
          // Prefer deployed HTML when online. Do not serve the offline page for every navigation.
          navigateFallback: null,
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              urlPattern: ({ request, url }) =>
                request.mode === "navigate" &&
                url.origin === self.location.origin,
              handler: "NetworkFirst",
              options: {
                cacheName: "danqel-navigation-v2",
                networkTimeoutSeconds: 5,
                cacheableResponse: { statuses: [200] },
                expiration: { maxEntries: 10, maxAgeSeconds: 86400 },
                precacheFallback: { fallbackURL: "/offline.html" },
              },
            },
            {
              urlPattern: ({ url }) => url.pathname === "/version.json",
              handler: "NetworkOnly",
            },
            {
              urlPattern: /^https:\/\/[^/]+\.supabase\.(co|in)\//,
              handler: "NetworkOnly",
            },
          ],
          globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        },
      }),
    ],
  };
});
