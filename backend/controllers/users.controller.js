import { asyncHandler, HttpError } from "../middleware/errors.js";
import * as users from "../models/users.js";

/**
 * Identifiant d'un compte : une adresse e-mail, ou un nom simple.
 *
 * L'application n'envoie jamais rien aux comptes : l'identifiant ne sert qu'à
 * reconnaître la personne. Exiger une adresse obligeait à inventer des boîtes
 * qui n'existent pas — « admin@hmgroup.fr » ne reçoit aucun courrier — et
 * empêchait d'appeler simplement un compte « admin ».
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NOM_SIMPLE = /^[a-z0-9][a-z0-9._-]{2,}$/i;
const identifiantValide = (valeur) =>
  EMAIL_PATTERN.test(valeur) || NOM_SIMPLE.test(valeur);
const IDENTIFIANT_INVALIDE =
  "Identifiant invalide : une adresse e-mail, ou un nom d'au moins 3 caractères " +
  "(lettres, chiffres, point, tiret, tiret bas).";

const ROLES = ["admin", "acheteur", "demandeur", "lecteur"];

export const list = asyncHandler(async (req, res) => {
  res.json({ users: await users.listUsers() });
});

export const create = asyncHandler(async (req, res) => {
  const { email, name, password, role = "acheteur" } = req.body || {};
  if (!identifiantValide(String(email || "").trim())) {
    throw new HttpError(400, IDENTIFIANT_INVALIDE);
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
  if (email !== undefined && !identifiantValide(String(email).trim())) {
    throw new HttpError(400, IDENTIFIANT_INVALIDE);
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
