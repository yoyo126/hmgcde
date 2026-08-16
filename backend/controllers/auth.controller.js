import { asyncHandler, HttpError } from "../middleware/errors.js";
import * as users from "../models/users.js";

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    throw new HttpError(400, "E-mail et mot de passe sont obligatoires.");
  }

  const user = await users.verifyCredentials(email, password);
  if (!user) {
    // Message volontairement identique dans les deux cas : ne pas révéler
    // quels e-mails existent.
    throw new HttpError(401, "E-mail ou mot de passe incorrect.");
  }

  await users.touchLogin(user.id);
  // Régénère l'identifiant de session à la connexion (parade au vol de session).
  await new Promise((resolve, reject) =>
    req.session.regenerate((error) => (error ? reject(error) : resolve())),
  );
  req.session.user = { id: user.id, email: user.email, name: user.name, role: user.role };
  res.json({ user: req.session.user });
});

export const logout = asyncHandler(async (req, res) => {
  await new Promise((resolve) => req.session.destroy(resolve));
  res.clearCookie("hmgcde.sid");
  res.json({ ok: true });
});

export const me = (req, res) => {
  res.json({ user: req.session?.user || null });
};
