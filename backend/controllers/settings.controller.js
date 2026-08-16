import { asyncHandler, HttpError } from "../middleware/errors.js";
import * as settings from "../models/settings.js";

export const read = asyncHandler(async (req, res) => {
  res.json({ settings: await settings.getSettings() });
});

export const save = asyncHandler(async (req, res) => {
  const payload = req.body?.settings;
  if (!payload || typeof payload !== "object") {
    throw new HttpError(400, "Le corps de la requête doit contenir un objet `settings`.");
  }
  await settings.saveSettings(payload);
  res.json({ settings: await settings.getSettings(), companies: await settings.listCompanies() });
});

export const companies = asyncHandler(async (req, res) => {
  res.json({ companies: await settings.listCompanies() });
});
