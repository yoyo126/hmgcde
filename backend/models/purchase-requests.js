import { query, withTransaction } from "../db/pool.js";
import { attribuerNumero } from "./numerotation.js";
import { toSqlDate } from "./orders.js";

/**
 * Demandes d'achat (DA-2026-011…) : ce que les filiales réclament avant que
 * l'acheteur ne les transforme en commandes fournisseurs.
 *
 * Comme pour les commandes, création et mise à jour sont deux chemins
 * distincts : le numéro est attribué ici et une demande ne peut plus en
 * écraser une autre (voir numerotation.js).
 */

const displayDate = (value) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(value instanceof Date ? value : new Date(`${value}T12:00:00`));

export const listRequests = async () => {
  const [requests, lines] = await Promise.all([
    query(
      `SELECT id, code, requester, request_date, status, seen
         FROM hmgcde_purchase_requests
        ORDER BY request_date DESC, id DESC`,
    ),
    query(
      `SELECT l.request_id, l.product_id, l.name, l.unit, l.quantity, l.ordered,
              s.name AS supplier
         FROM hmgcde_purchase_request_lines l
         LEFT JOIN hmgcde_suppliers s ON s.id = l.supplier_id
        ORDER BY l.request_id, l.position, l.id`,
    ),
  ]);

  const linesByRequest = new Map();
  for (const row of lines) {
    const list = linesByRequest.get(row.request_id) || [];
    list.push({
      productId: row.product_id === null ? null : Number(row.product_id),
      name: row.name,
      unit: row.unit,
      quantity: Number(row.quantity),
      ...(row.supplier ? { supplier: row.supplier } : {}),
      ordered: Boolean(row.ordered),
    });
    linesByRequest.set(row.request_id, list);
  }

  return requests.map((request) => ({
    id: request.code,
    requester: request.requester,
    date: displayDate(request.request_date),
    status: request.status,
    seen: Boolean(request.seen),
    lines: linesByRequest.get(request.id) || [],
  }));
};

/**
 * Premier numéro de l'année : la série reprend la numérotation en cours,
 * elle ne repart pas de 1.
 */
const PREMIER_NUMERO = 12;

/** Même lecture à la valeur que pour les commandes, pour la même raison. */
export const nextRequestCode = async () => {
  const year = new Date().getFullYear();
  const rows = await query(
    `SELECT MAX(CAST(SUBSTRING_INDEX(code, '-', -1) AS UNSIGNED)) AS dernier
       FROM hmgcde_purchase_requests
      WHERE code LIKE ?`,
    [`DA-${year}-%`],
  );
  const dernier = Math.max(Number(rows[0]?.dernier) || 0, PREMIER_NUMERO - 1);
  return `DA-${year}-${String(dernier + 1).padStart(3, "0")}`;
};

/**
 * Réécrit les lignes d'une demande. L'interface envoie toujours la demande
 * complète : on remplace tout.
 */
const ecrireLignes = async (connection, requestId, lignes = []) => {
  const [suppliers] = await connection.execute("SELECT id, name FROM hmgcde_suppliers");
  const supplierIdByName = new Map(suppliers.map((row) => [row.name, row.id]));

  await connection.execute("DELETE FROM hmgcde_purchase_request_lines WHERE request_id = ?", [
    requestId,
  ]);

  for (const [index, line] of lignes.entries()) {
    await connection.execute(
      `INSERT INTO hmgcde_purchase_request_lines
         (request_id, product_id, name, unit, quantity, supplier_id, ordered, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        requestId,
        line.productId ?? null,
        line.name,
        line.unit || "Pièce",
        Number(line.quantity) || 0,
        line.supplier ? supplierIdByName.get(line.supplier) ?? null : null,
        line.ordered ? 1 : 0,
        index,
      ],
    );
  }
};

/**
 * Insère une demande sous le numéro proposé. Insertion sèche : un numéro déjà
 * pris fait remonter le refus de la base, jamais un écrasement.
 */
const insererDemande = (request, code) =>
  withTransaction(async (connection) => {
    const [result] = await connection.execute(
      `INSERT INTO hmgcde_purchase_requests (code, requester, request_date, status, seen)
       VALUES (?, ?, ?, ?, ?)`,
      [
        code,
        request.requester || "",
        toSqlDate(request.date),
        request.status || "À commander",
        request.seen === false ? 0 : 1,
      ],
    );
    await ecrireLignes(connection, result.insertId, request.lines);
    return code;
  });

/** Crée une demande et renvoie le numéro attribué par le serveur. */
export const createRequest = (request) =>
  attribuerNumero(nextRequestCode, (code) => insererDemande(request, code));

/**
 * Met à jour une demande existante. Renvoie `null` si le numéro est inconnu :
 * une demande supprimée entre-temps ne se recrée pas par mégarde.
 */
export const updateRequest = (request) =>
  withTransaction(async (connection) => {
    const [rows] = await connection.execute(
      "SELECT id FROM hmgcde_purchase_requests WHERE code = ?",
      [request.id],
    );
    if (!rows.length) return null;
    const requestId = rows[0].id;

    await connection.execute(
      `UPDATE hmgcde_purchase_requests
          SET requester = ?, request_date = ?, status = ?, seen = ?
        WHERE id = ?`,
      [
        request.requester || "",
        toSqlDate(request.date),
        request.status || "À commander",
        request.seen === false ? 0 : 1,
        requestId,
      ],
    );
    await ecrireLignes(connection, requestId, request.lines);
    return request.id;
  });

export const deleteRequest = async (code) => {
  const result = await query("DELETE FROM hmgcde_purchase_requests WHERE code = ?", [code]);
  return result.affectedRows > 0;
};
