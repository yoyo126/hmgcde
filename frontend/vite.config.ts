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
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      port: Number(env.VITE_PORT || 5173),
      host: "127.0.0.1",
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
