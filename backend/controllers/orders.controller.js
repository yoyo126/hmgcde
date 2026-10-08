import { hidesPrices, stripOrderPrices } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/errors.js";
import * as orders from "../models/orders.js";

export const list = asyncHandler(async (req, res) => {
  const list = await orders.listOrders();
  res.json({ orders: hidesPrices(req) ? stripOrderPrices(list) : list });
});

/**
 * Enregistre une commande.
 *
 * Sans numéro, c'est une création : le serveur en attribue un et le renvoie,
 * car lui seul voit toutes les commandes. Avec un numéro, c'est la mise à
 * jour de cette commande-là — et si elle n'existe pas, on refuse au lieu de
 * la créer sous un numéro qui appartient peut-être déjà à quelqu'un d'autre.
 */
export const save = asyncHandler(async (req, res) => {
  const order = req.body?.order;
  if (!order) throw new HttpError(400, "Commande invalide : rien à enregistrer.");

  const code = order.id ? await orders.updateOrder(order) : await orders.createOrder(order);
  if (!code) {
    throw new HttpError(404, `Commande ${order.id} introuvable : elle a peut-être été supprimée.`);
  }
  res.json({ code, orders: await orders.listOrders() });
});

/**
 * Enregistre plusieurs commandes d'un coup (éclatement d'une demande d'achat).
 * Chacune suit la même règle que ci-dessus, et les numéros attribués sont
 * renvoyés dans l'ordre d'envoi.
 */
export const saveMany = asyncHandler(async (req, res) => {
  const list = req.body?.orders;
  if (!Array.isArray(list)) {
    throw new HttpError(400, "Le corps de la requête doit contenir une liste `orders`.");
  }

  const codes = [];
  for (const order of list) {
    const code = order?.id ? await orders.updateOrder(order) : await orders.createOrder(order);
    if (!code) {
      throw new HttpError(404, `Commande ${order.id} introuvable : elle a peut-être été supprimée.`);
    }
    codes.push(code);
  }
  res.json({ codes, orders: await orders.listOrders() });
});

export const remove = asyncHandler(async (req, res) => {
  const deleted = await orders.deleteOrder(req.params.code);
  if (!deleted) throw new HttpError(404, "Commande introuvable.");
  res.json({ orders: await orders.listOrders() });
});
