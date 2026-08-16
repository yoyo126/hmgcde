import bcrypt from "bcryptjs";
import { query, queryOne } from "../db/pool.js";

/**
 * Utilisateurs. L'e-mail est la clé unique : c'est le pivot prévu pour une
 * authentification partagée avec le CRM HM Group le jour venu.
 */

const publicShape = (row) => ({
  id: row.id,
  email: row.email,
  name: row.name,
  role: row.role,
  active: Boolean(row.is_active),
  lastLoginAt: row.last_login_at,
  createdAt: row.created_at,
});

export const listUsers = async () => {
  const rows = await query(
    `SELECT id, email, name, role, is_active, last_login_at, created_at
       FROM hmgcde_users ORDER BY name, email`,
  );
  return rows.map(publicShape);
};

export const findById = async (id) => {
  const row = await queryOne(
    `SELECT id, email, name, role, is_active, last_login_at, created_at
       FROM hmgcde_users WHERE id = ?`,
    [id],
  );
  return row ? publicShape(row) : null;
};

export const findByEmail = (email) =>
  queryOne("SELECT * FROM hmgcde_users WHERE email = ?", [String(email).trim().toLowerCase()]);

export const verifyCredentials = async (email, password) => {
  const user = await findByEmail(email);
  if (!user || !user.is_active) return null;
  const valid = await bcrypt.compare(String(password), user.password_hash);
  return valid ? publicShape(user) : null;
};

export const touchLogin = (id) =>
  query("UPDATE hmgcde_users SET last_login_at = NOW() WHERE id = ?", [id]);

export const createUser = async ({ email, name, password, role = "acheteur" }) => {
  const hash = await bcrypt.hash(String(password), 12);
  const result = await query(
    `INSERT INTO hmgcde_users (email, name, password_hash, role) VALUES (?, ?, ?, ?)`,
    [String(email).trim().toLowerCase(), name || "", hash, role],
  );
  return findById(result.insertId);
};

export const updateUser = async (id, { email, name, role, active, password }) => {
  const fields = [];
  const values = [];
  if (email !== undefined) {
    fields.push("email = ?");
    values.push(String(email).trim().toLowerCase());
  }
  if (name !== undefined) {
    fields.push("name = ?");
    values.push(name);
  }
  if (role !== undefined) {
    fields.push("role = ?");
    values.push(role);
  }
  if (active !== undefined) {
    fields.push("is_active = ?");
    values.push(active ? 1 : 0);
  }
  if (password) {
    fields.push("password_hash = ?");
    values.push(await bcrypt.hash(String(password), 12));
  }
  if (!fields.length) return findById(id);

  values.push(id);
  await query(`UPDATE hmgcde_users SET ${fields.join(", ")} WHERE id = ?`, values);
  return findById(id);
};

export const deleteUser = async (id) => {
  const result = await query("DELETE FROM hmgcde_users WHERE id = ?", [id]);
  return result.affectedRows > 0;
};

export const countAdmins = async () => {
  const row = await queryOne(
    "SELECT COUNT(*) AS total FROM hmgcde_users WHERE role = 'admin' AND is_active = 1",
  );
  return row?.total ?? 0;
};
