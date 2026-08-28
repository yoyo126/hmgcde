import { asyncHandler, HttpError } from "../middleware/errors.js";
import * as users from "../models/users.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ["admin", "acheteur", "demandeur", "lecteur"];

export const list = asyncHandler(async (req, res) => {
  res.json({ users: await users.listUsers() });
});

export const create = asyncHandler(async (req, res) => {
  const { email, name, password, role = "acheteur" } = req.body || {};
  if (!EMAIL_PATTERN.test(String(email || ""))) {
    throw new HttpError(400, "Adresse e-mail invalide.");
  }
  if (String(password || "").length < 10) {
    throw new HttpError(400, "Le mot de passe doit faire au moins 10 caractères.");
  }
  if (!ROLES.includes(role)) {
    throw new HttpError(400, "Rôle inconnu.");
  }
  const created = await users.createUser({ email, name, password, role });
  res.status(201).json({ user: created, users: await users.listUsers() });
});

export const update = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const target = await users.findById(id);
  if (!target) throw new HttpError(404, "Utilisateur introuvable.");

  const { email, name, password, role, active } = req.body || {};
  if (email !== undefined && !EMAIL_PATTERN.test(String(email))) {
    throw new HttpError(400, "Adresse e-mail invalide.");
  }
  if (password !== undefined && String(password).length < 10) {
    throw new HttpError(400, "Le mot de passe doit faire au moins 10 caractères.");
  }
  if (role !== undefined && !ROLES.includes(role)) {
    throw new HttpError(400, "Rôle inconnu.");
  }

  // Ne jamais se retrouver sans administrateur actif : personne ne pourrait
  // plus gérer les comptes.
  const losesAdmin =
    target.role === "admin" && ((role !== undefined && role !== "admin") || active === false);
  if (losesAdmin && (await users.countAdmins()) <= 1) {
    throw new HttpError(400, "Impossible : ce compte est le dernier administrateur actif.");
  }

  res.json({
    user: await users.updateUser(id, { email, name, password, role, active }),
    users: await users.listUsers(),
  });
});

export const remove = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.session.user.id) {
    throw new HttpError(400, "Vous ne pouvez pas supprimer votre propre compte.");
  }
  const target = await users.findById(id);
  if (!target) throw new HttpError(404, "Utilisateur introuvable.");
  if (target.role === "admin" && (await users.countAdmins()) <= 1) {
    throw new HttpError(400, "Impossible : ce compte est le dernier administrateur actif.");
  }

  await users.deleteUser(id);
  res.json({ users: await users.listUsers() });
});
