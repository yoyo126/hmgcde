import { hidesPrices, stripOrderPrices, stripProductPrices } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/errors.js";
import * as catalog from "../models/catalog.js";
import * as orders from "../models/orders.js";
import * as requests from "../models/purchase-requests.js";
import * as settings from "../models/settings.js";

/**
 * Charge en une seule requête tout ce dont l'interface a besoin au démarrage.
 * L'application affiche des écrans complets (catalogue + commandes + demandes)
 * dès la première seconde : mieux vaut un aller-retour que six.
 */
export const bootstrap = asyncHandler(async (req, res) => {
  const [products, orderList, requestList, appSettings, companies, priceHistory, importHistory] =
    await Promise.all([
      catalog.listCatalog(),
      orders.listOrders(),
      requests.listRequests(),
      settings.getSettings(),
      settings.listCompanies(),
      catalog.listPriceHistory(),
      catalog.listImportHistory(),
    ]);

  // Le profil « demandeur » ne reçoit tout simplement pas les montants.
  const masque = hidesPrices(req);

  res.json({
    user: req.session.user,
    companies,
    settings: appSettings,
    products: masque ? stripProductPrices(products) : products,
    orders: masque ? stripOrderPrices(orderList) : orderList,
    requests: requestList,
    priceHistory: masque ? [] : priceHistory,
    importHistory: masque ? [] : importHistory,
  });
});
