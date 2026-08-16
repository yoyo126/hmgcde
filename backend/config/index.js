import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
export const backendRoot = path.resolve(here, "..");
export const projectRoot = path.resolve(backendRoot, "..");

dotenv.config({ path: path.join(backendRoot, ".env") });

const required = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. Copiez backend/.env.example vers backend/.env et complétez-le.`,
    );
  }
  return value;
};

export const config = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3001),
  // Dossier des fichiers compilés du frontend, servis par Express en production.
  frontendDist: process.env.FRONTEND_DIST || path.join(projectRoot, "frontend", "dist"),
  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "hmgcde",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "hmgcde",
    connectionLimit: Number(process.env.DB_POOL || 10),
  },
  session: {
    secret: process.env.SESSION_SECRET || (process.env.NODE_ENV === "production" ? required("SESSION_SECRET") : "dev-secret-non-securise"),
    // 12 h : une journée de travail, sans forcer une reconnexion à midi.
    maxAge: Number(process.env.SESSION_MAX_AGE || 12 * 60 * 60 * 1000),
  },
  seed: {
    adminEmail: process.env.SEED_ADMIN_EMAIL || "admin@hmgroup.fr",
    adminPassword: process.env.SEED_ADMIN_PASSWORD || "",
    adminName: process.env.SEED_ADMIN_NAME || "Administrateur HM",
  },
};

export const isProduction = config.env === "production";
