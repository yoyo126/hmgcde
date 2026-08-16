import { asyncHandler, HttpError } from "../middleware/errors.js";
import * as requests from "../models/purchase-requests.js";

export const list = asyncHandler(async (req, res) => {
  res.json({ requests: await requests.listRequests() });
});

export const nextCode = asyncHandler(async (req, res) => {
  res.json({ code: await requests.nextRequestCode() });
});

export const save = asyncHandler(async (req, res) => {
  const request = req.body?.request;
  if (!request?.id) {
    throw new HttpError(400, "Demande d'achat invalide : identifiant manquant.");
  }
  await requests.saveRequest(request);
  res.json({ requests: await requests.listRequests() });
});

export const remove = asyncHandler(async (req, res) => {
  const deleted = await requests.deleteRequest(req.params.code);
  if (!deleted) throw new HttpError(404, "Demande d'achat introuvable.");
  res.json({ requests: await requests.listRequests() });
});
