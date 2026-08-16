/**
 * Garde d'accès. Toute l'API métier est privée : sans session valide, on
 * répond 401 et l'interface renvoie vers l'écran de connexion.
 */
export const requireAuth = (req, res, next) => {
  if (!req.session?.user) {
    return res.status(401).json({ error: "Authentification requise." });
  }
  next();
};

/**
 * Restreint une route à certains rôles (la gestion des utilisateurs, par
 * exemple, reste réservée aux administrateurs).
 */
export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.session?.user) {
      return res.status(401).json({ error: "Authentification requise." });
    }
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: "Vous n'avez pas les droits pour cette action." });
    }
    next();
  };

/** Le rôle « lecteur » consulte mais n'écrit pas. */
export const requireWriteAccess = requireRole("admin", "acheteur");
