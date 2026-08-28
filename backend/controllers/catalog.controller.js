import { hidesPrices, stripProductPrices } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/errors.js";
import * as catalog from "../models/catalog.js";

export const list = asyncHandler(async (req, res) => {
  const products = await catalog.listCatalog();
  res.json({ products: hidesPrices(req) ? stripProductPrices(products) : products });
});

export const save = asyncHandler(async (req, res) => {
  const products = req.body?.products;
  if (!Array.isArray(products)) {
    throw new HttpError(400, "Le corps de la requête doit contenir une liste `products`.");
  }
  await catalog.saveProducts(products);
  res.json({ products: await catalog.listCatalog() });
});

export const remove = asyncHandler(async (req, res) => {
  const ids = req.body?.ids;
  if (!Array.isArray(ids)) {
    throw new HttpError(400, "Le corps de la requête doit contenir une liste `ids`.");
  }
  await catalog.deleteProducts(ids);
  res.json({ products: await catalog.listCatalog() });
});

export const savePrices = asyncHandler(async (req, res) => {
  const { prices = {}, componentPrices = {}, changes = [] } = req.body || {};
  await catalog.applyPriceChanges({
    prices,
    componentPrices,
    changes,
    userId: req.session.user.id,
  });
  res.json({
    products: await catalog.listCatalog(),
    priceHistory: await catalog.listPriceHistory(),
  });
});

export const saveImport = asyncHandler(async (req, res) => {
  const { overrides = {}, newProducts = [], history, changes = [] } = req.body || {};
  await catalog.applyTariffImport({
    overrides,
    newProducts,
    history,
    changes,
    userId: req.session.user.id,
  });
  res.json({
    products: await catalog.listCatalog(),
    priceHistory: await catalog.listPriceHistory(),
    importHistory: await catalog.listImportHistory(),
  });
});

export const history = asyncHandler(async (req, res) => {
  const [priceHistory, importHistory] = await Promise.all([
    catalog.listPriceHistory(),
    catalog.listImportHistory(),
  ]);
  res.json({ priceHistory, importHistory });
});
