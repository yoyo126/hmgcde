import { isProduction } from "../config/index.js";

/**
 * Évite un try/catch dans chaque contrôleur : toute promesse rejetée part
 * directement vers le gestionnaire d'erreurs.
 */
export const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

/** Erreur métier volontaire, avec son code HTTP. */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const notFound = (req, res) => {
  res.status(404).json({ error: `Route inconnue : ${req.method} ${req.originalUrl}` });
};

export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  const status = error.status || 500;
  if (status >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, error);
  }

  // Messages MySQL traduits : plus parlants que « ER_DUP_ENTRY » à l'écran.
  if (error.code === "ER_DUP_ENTRY") {
    return res.status(409).json({ error: "Cet enregistrement existe déjà." });
  }
  if (error.code === "ER_NO_REFERENCED_ROW_2") {
    return res.status(400).json({ error: "Référence inconnue (produit, fournisseur ou société)." });
  }
  if (error.code === "ECONNREFUSED" || error.code === "ER_ACCESS_DENIED_ERROR") {
    return res.status(503).json({ error: "Base de données injoignable." });
  }

  res.status(status).json({
    error: status >= 500 && isProduction ? "Erreur interne du serveur." : error.message,
  });
};
