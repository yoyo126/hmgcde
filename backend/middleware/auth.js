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

/** Commandes, catalogue, prix, paramètres : réservé aux profils achats. */
export const requireWriteAccess = requireRole("admin", "acheteur");

/** Une demande d'achat peut aussi être saisie par un « demandeur ». */
export const requireRequestAccess = requireRole("admin", "acheteur", "demandeur");

/**
 * Le profil « demandeur » n'a pas accès aux prix. Plutôt que de compter sur
 * l'interface pour les masquer, on les retire de la réponse : un montant
 * jamais envoyé ne peut pas fuiter.
 */
export const hidesPrices = (req) => req.session?.user?.role === "demandeur";

const blankPrices = (offer) => ({
  ...offer,
  price: 0,
  ...(offer.meterPrice === undefined ? {} : { meterPrice: 0 }),
});

export const stripProductPrices = (products) =>
  products.map((product) => ({
    ...product,
    offers: (product.offers || []).map(blankPrices),
    ...(product.contents
      ? {
          contents: product.contents.map((item) => ({
            ...item,
            unitPrice: 0,
            supplierPrices: Object.fromEntries(
              Object.keys(item.supplierPrices || {}).map((supplier) => [supplier, 0]),
            ),
          })),
        }
      : {}),
  }));

export const stripOrderPrices = (orders) =>
  orders.map((order) => ({
    ...order,
    total: 0,
    lines: (order.lines || []).map((line) => ({ ...line, unitPrice: 0 })),
  }));
