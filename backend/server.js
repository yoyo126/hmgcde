import { createApp } from "./app.js";
import { config } from "./config/index.js";
import { runMigrations } from "./db/migrate.js";
import { closePool, query } from "./db/pool.js";

const start = async () => {
  // Les migrations tournent au démarrage : un déploiement se résume à
  // redémarrer le service.
  if (process.env.AUTO_MIGRATE !== "false") {
    await runMigrations({ silent: true });
  }

  await query("SELECT 1");
  console.log(`✓ Base de données ${config.db.database} accessible sur ${config.db.host}.`);

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`✓ API Achats filiales HM Group sur http://127.0.0.1:${config.port} (${config.env})`);
  });

  const shutdown = (signal) => {
    console.log(`\n${signal} reçu, arrêt en cours…`);
    server.close(async () => {
      await closePool().catch(() => {});
      process.exit(0);
    });
    // Filet de sécurité si une connexion traîne.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

start().catch((error) => {
  console.error("Démarrage impossible :", error.message);
  process.exit(1);
});
