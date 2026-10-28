import { execFileSync } from "node:child_process";
import { defineConfig, loadEnv } from "vite";
import { validateFrontendEnv } from "./scripts/frontend-env.mjs";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

function releaseMarker() {
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
  return {
    name: "danqel-release-marker",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source:
          JSON.stringify(
            { commit, builtAt: new Date().toISOString() },
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
          "icons/icon-192.svg",
          "icons/icon-512.svg",
          "offline.html",
        ],
        manifest: {
          name: "Danqel Social Boost",
          short_name: "Danqel",
          description:
            "Good Connections. Greater Reach. Discover and promote social profiles safely.",
          theme_color: "#0a0614",
          background_color: "#0a0614",
          display: "standalone",
          start_url: "/",
          icons: [
            {
              src: "/icons/icon-192.svg",
              sizes: "192x192",
              type: "image/svg+xml",
            },
            {
              src: "/icons/icon-512.svg",
              sizes: "512x512",
              type: "image/svg+xml",
              purpose: "any maskable",
            },
          ],
        },
        workbox: {
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
