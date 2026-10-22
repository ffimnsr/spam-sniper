import path from "node:path";
import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, "");
  const apiProxyTarget =
    env.VITE_API_PROXY_TARGET?.trim() || "http://127.0.0.1:8787";

  // Production build config comes from the build environment (Cloudflare
  // build variables) or `.env`. Fail the build instead of shipping a bundle
  // that throws at module load or renders without a Turnstile widget.
  if (mode === "production") {
    const required = ["VITE_HIDDEN_ADMIN_PATH", "VITE_TURNSTILE_SITE_KEY"];
    const missing = required.filter((key) => !env[key]?.trim());

    if (missing.length > 0) {
      throw new Error(
        `Missing build environment variable(s): ${missing.join(", ")}`,
      );
    }
  }

  return {
    plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
    server: {
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: "dist",
    },
  };
});
