import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { config } from "../config/index.js";

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

const MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS hmgcde_migrations (
    name       VARCHAR(190) NOT NULL,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

/**
 * Découpe un fichier .sql en instructions. Suffisant pour nos migrations :
 * du DDL simple, sans procédure stockée ni DELIMITER.
 */
const splitStatements = (sql) =>
  sql
    .split(/;\s*$/m)
    .map((statement) => statement.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean);

export const runMigrations = async ({ silent = false } = {}) => {
  // Connexion sans base sélectionnée : la migration crée la base si besoin.
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: false,
  });

  const log = (message) => {
    if (!silent) console.log(message);
  };

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await connection.changeUser({ database: config.db.database });
    await connection.query(MIGRATIONS_TABLE);

    const [applied] = await connection.query("SELECT name FROM hmgcde_migrations");
    const done = new Set(applied.map((row) => row.name));

    const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();

    let count = 0;
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
      for (const statement of splitStatements(sql)) {
        await connection.query(statement);
      }
      await connection.query("INSERT INTO hmgcde_migrations (name) VALUES (?)", [file]);
      log(`✓ migration appliquée : ${file}`);
      count += 1;
    }

    log(count ? `${count} migration(s) appliquée(s).` : "Base déjà à jour, rien à appliquer.");
    return count;
  } finally {
    await connection.end();
  }
};

// Exécution directe : `npm run migrate`
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Échec des migrations :", error.message);
      process.exit(1);
    });
}
