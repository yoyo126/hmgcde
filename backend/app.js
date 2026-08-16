import fs from "node:fs";
import path from "node:path";
import express from "express";
import session from "express-session";
import MySQLStoreFactory from "express-mysql-session";
import helmet from "helmet";
import { config, isProduction } from "./config/index.js";
import routes from "./routes/index.js";
import { errorHandler, notFound } from "./middleware/errors.js";

const MySQLStore = MySQLStoreFactory(session);

export const createApp = () => {
  const app = express();

  // Derrière Nginx : nécessaire pour que le cookie « secure » et la limitation
  // de débit voient la vraie adresse du client.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(
    helmet({
      // L'interface est une SPA servie depuis la même origine ; pas de CDN.
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", "data:", "blob:"],
              connectSrc: ["'self'"],
              workerSrc: ["'self'", "blob:"],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Les imports de tarifs passent par le navigateur, mais les catalogues
  // envoyés en JSON peuvent être volumineux.
  app.use(express.json({ limit: "12mb" }));

  const store = new MySQLStore({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    createDatabaseTable: true,
    schema: { tableName: "hmgcde_sessions" },
  });

  app.use(
    session({
      name: "hmgcde.sid",
      secret: config.session.secret,
      store,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        // 'auto' : cookie sécurisé dès que le site passe en HTTPS, sans casser
        // les essais en HTTP (leçon retenue du déploiement du CRM).
        secure: "auto",
        maxAge: config.session.maxAge,
      },
    }),
  );

  app.use("/api", routes);

  // En production, Express sert aussi les fichiers compilés du frontend.
  if (fs.existsSync(config.frontendDist)) {
    app.use(express.static(config.frontendDist, { index: false, maxAge: "1h" }));
    app.get(/^(?!\/api\/).*/, (req, res, next) => {
      const indexFile = path.join(config.frontendDist, "index.html");
      if (!fs.existsSync(indexFile)) return next();
      res.sendFile(indexFile);
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
