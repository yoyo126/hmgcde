import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// Le frontend est une SPA React servie par Vite en développement, et par
// Express (fichiers statiques de dist/) en production. Les appels /api sont
// relayés vers le backend Node afin de garder le cookie de session.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_PROXY || "http://127.0.0.1:3001";

  return {
    // GitHub Pages sert le site depuis /hmgcde/ ; en local, la racine.
    base: env.VITE_BASE || "/",
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      port: Number(env.VITE_PORT || 5173),
      // 0.0.0.0 dans un conteneur (Codespaces), sinon uniquement la machine.
      host: env.VITE_HOST || (env.CODESPACES ? "0.0.0.0" : "127.0.0.1"),
      // Codespaces sert l'aperçu depuis un sous-domaine github.dev.
      allowedHosts: [".app.github.dev", ".github.dev"],
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: false,
        },
      },
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
      sourcemap: mode !== "production",
    },
  };
});
