import { query, withTransaction } from "../db/pool.js";

/**
 * Paramètres d'achat. L'interface les voit comme un seul objet ; ils viennent
 * en réalité de trois endroits : les textes d'e-mail (table settings), la liste
 * des fournisseurs et leurs adresses, et le nombre d'équipes par société.
 */

const TEXT_KEYS = [
  "mailSubject",
  "greeting",
  "deliveryMessage",
  "closing",
  "deliveryAddress",
];

const DEFAULTS = {
  mailSubject: "COMMANDE HM",
  greeting: "Bonjour,",
  deliveryMessage: "A LIVRER CHEZ HM GROUP",
  closing: "Cordialement,\nHM Group",
  deliveryAddress: "Adresse de livraison HM Group à renseigner",
};

/**
 * mysql2 décode déjà les colonnes JSON : une valeur revient donc en objet ou
 * en chaîne selon les cas. On accepte les deux plutôt que de supposer.
 */
const parseValue = (value) => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export const getSettings = async () => {
  const [rows, suppliers, companies] = await Promise.all([
    query("SELECT setting_key, value FROM hmgcde_settings"),
    query("SELECT name, emails FROM hmgcde_suppliers WHERE is_active = 1 ORDER BY position, name"),
    query("SELECT code, teams FROM hmgcde_companies WHERE is_active = 1 ORDER BY position, id"),
  ]);

  const texts = { ...DEFAULTS };
  for (const row of rows) {
    if (TEXT_KEYS.includes(row.setting_key)) texts[row.setting_key] = parseValue(row.value);
  }

  return {
    ...texts,
    suppliers: suppliers.map((row) => ({ name: row.name, emails: row.emails })),
    defaultTeams: Object.fromEntries(companies.map((row) => [row.code, row.teams])),
  };
};

export const saveSettings = async (settings) =>
  withTransaction(async (connection) => {
    for (const key of TEXT_KEYS) {
      if (settings[key] === undefined) continue;
      await connection.execute(
        `INSERT INTO hmgcde_settings (setting_key, value) VALUES (?, CAST(? AS JSON))
         ON DUPLICATE KEY UPDATE value = VALUES(value)`,
        [key, JSON.stringify(settings[key])],
      );
    }

    if (Array.isArray(settings.suppliers)) {
      const kept = settings.suppliers
        .map((supplier) => ({
          name: String(supplier.name || "").trim(),
          emails: String(supplier.emails || "").trim(),
        }))
        .filter((supplier, index, all) =>
          Boolean(supplier.name) && all.findIndex((item) => item.name === supplier.name) === index,
        );

      for (const [index, supplier] of kept.entries()) {
        await connection.execute(
          `INSERT INTO hmgcde_suppliers (name, emails, position, is_active)
           VALUES (?, ?, ?, 1)
           ON DUPLICATE KEY UPDATE emails = VALUES(emails), position = VALUES(position), is_active = 1`,
          [supplier.name, supplier.emails, index],
        );
      }

      // Un fournisseur retiré de l'écran est désactivé, jamais supprimé : les
      // commandes passées et l'historique des prix le mentionnent encore.
      const names = kept.map((supplier) => supplier.name);
      if (names.length) {
        const placeholders = names.map(() => "?").join(",");
        await connection.execute(
          `UPDATE hmgcde_suppliers SET is_active = 0 WHERE name NOT IN (${placeholders})`,
          names,
        );
      }
    }

    if (settings.defaultTeams && typeof settings.defaultTeams === "object") {
      for (const [code, teams] of Object.entries(settings.defaultTeams)) {
        await connection.execute("UPDATE hmgcde_companies SET teams = ? WHERE code = ?", [
          Math.max(0, Number(teams) || 0),
          code,
        ]);
      }
    }
  });

export const listCompanies = async () => {
  const rows = await query(
    `SELECT code, name, short_name, color, teams
       FROM hmgcde_companies WHERE is_active = 1 ORDER BY position, id`,
  );
  return rows.map((row) => ({
    key: row.code,
    name: row.name,
    short: row.short_name,
    color: row.color,
    teams: row.teams,
  }));
};
