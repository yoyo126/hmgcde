import crypto from "node:crypto";
import { closePool } from "../db/pool.js";
import { createUser, findByEmail, updateUser } from "../models/users.js";

/**
 * Création ou mise à jour d'un compte en ligne de commande, sans passer par
 * l'interface :
 *   npm run create-user -- jean@hmgroup.fr "Jean Dupont" acheteur
 * Le mot de passe est généré et affiché une seule fois.
 */
const [email, name = "", role = "acheteur"] = process.argv.slice(2);

if (!email) {
  console.error('Usage : npm run create-user -- <email> ["Nom Prénom"] [admin|acheteur|lecteur]');
  process.exit(1);
}

const password = crypto.randomBytes(9).toString("base64url");

try {
  const existing = await findByEmail(email);
  if (existing) {
    await updateUser(existing.id, { name: name || existing.name, role, password, active: true });
    console.log(`✓ Compte mis à jour : ${email}`);
  } else {
    await createUser({ email, name, password, role });
    console.log(`✓ Compte créé : ${email} (${role})`);
  }
  console.log(`  Mot de passe : ${password}`);
  console.log("  Notez-le : il ne sera plus affiché.");
} catch (error) {
  console.error("Échec :", error.message);
  process.exitCode = 1;
} finally {
  await closePool();
}
