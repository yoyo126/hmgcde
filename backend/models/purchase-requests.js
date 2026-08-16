import { query, withTransaction } from "../db/pool.js";
import { toSqlDate } from "./orders.js";

/**
 * Demandes d'achat (DA-2026-011…) : ce que les filiales réclament avant que
 * l'acheteur ne les transforme en commandes fournisseurs.
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

export const nextRequestCode = async () => {
  const year = new Date().getFullYear();
  const rows = await query(
    `SELECT code FROM hmgcde_purchase_requests WHERE code LIKE ? ORDER BY code DESC LIMIT 1`,
    [`DA-${year}-%`],
  );
  const highest = rows.length ? Number(rows[0].code.split("-").pop()) || 0 : 11;
  return `DA-${year}-${String(highest + 1).padStart(3, "0")}`;
};

export const saveRequest = async (request) =>
  withTransaction(async (connection) => {
    const [suppliers] = await connection.execute("SELECT id, name FROM hmgcde_suppliers");
    const supplierIdByName = new Map(suppliers.map((row) => [row.name, row.id]));

    await connection.execute(
      `INSERT INTO hmgcde_purchase_requests (code, requester, request_date, status, seen)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         requester = VALUES(requester), request_date = VALUES(request_date),
         status = VALUES(status), seen = VALUES(seen)`,
      [
        request.id,
        request.requester || "",
        toSqlDate(request.date),
        request.status || "À commander",
        request.seen === false ? 0 : 1,
      ],
    );

    const [current] = await connection.execute(
      "SELECT id FROM hmgcde_purchase_requests WHERE code = ?",
      [request.id],
    );
    const requestId = current[0].id;

    await connection.execute("DELETE FROM hmgcde_purchase_request_lines WHERE request_id = ?", [
      requestId,
    ]);

    for (const [index, line] of (request.lines || []).entries()) {
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

    return request.id;
  });

export const deleteRequest = async (code) => {
  const result = await query("DELETE FROM hmgcde_purchase_requests WHERE code = ?", [code]);
  return result.affectedRows > 0;
};
