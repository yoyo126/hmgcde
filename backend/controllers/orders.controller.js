import { hidesPrices, stripOrderPrices } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/errors.js";
import * as orders from "../models/orders.js";

export const list = asyncHandler(async (req, res) => {
  const list = await orders.listOrders();
  res.json({ orders: hidesPrices(req) ? stripOrderPrices(list) : list });
});

export const nextCode = asyncHandler(async (req, res) => {
  res.json({ code: await orders.nextOrderCode() });
});

export const save = asyncHandler(async (req, res) => {
  const order = req.body?.order;
  if (!order?.id) {
    throw new HttpError(400, "Commande invalide : identifiant manquant.");
  }
  await orders.saveOrder(order);
  res.json({ orders: await orders.listOrders() });
});

/** Enregistre plusieurs commandes d'un coup (éclatement d'une demande d'achat). */
export const saveMany = asyncHandler(async (req, res) => {
  const list = req.body?.orders;
  if (!Array.isArray(list)) {
    throw new HttpError(400, "Le corps de la requête doit contenir une liste `orders`.");
  }
  for (const order of list) {
    if (!order?.id) throw new HttpError(400, "Commande invalide : identifiant manquant.");
    await orders.saveOrder(order);
  }
  res.json({ orders: await orders.listOrders() });
});

export const remove = asyncHandler(async (req, res) => {
  const deleted = await orders.deleteOrder(req.params.code);
  if (!deleted) throw new HttpError(404, "Commande introuvable.");
  res.json({ orders: await orders.listOrders() });
});
