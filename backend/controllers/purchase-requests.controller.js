import { asyncHandler, HttpError } from "../middleware/errors.js";
import * as requests from "../models/purchase-requests.js";

export const list = asyncHandler(async (req, res) => {
  res.json({ requests: await requests.listRequests() });
});

/**
 * Même règle que pour les commandes : sans numéro c'est une création, que le
 * serveur numérote ; avec un numéro c'est une mise à jour, refusée si la
 * demande n'existe plus.
 */
export const save = asyncHandler(async (req, res) => {
  const request = req.body?.request;
  if (!request) throw new HttpError(400, "Demande d'achat invalide : rien à enregistrer.");

  const code = request.id
    ? await requests.updateRequest(request)
    : await requests.createRequest(request);
  if (!code) {
    throw new HttpError(
      404,
      `Demande d'achat ${request.id} introuvable : elle a peut-être été supprimée.`,
    );
  }
  res.json({ code, requests: await requests.listRequests() });
});

export const remove = asyncHandler(async (req, res) => {
  const deleted = await requests.deleteRequest(req.params.code);
  if (!deleted) throw new HttpError(404, "Demande d'achat introuvable.");
  res.json({ requests: await requests.listRequests() });
});
