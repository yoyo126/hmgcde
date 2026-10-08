import { query, withTransaction } from "../db/pool.js";
import { attribuerNumero } from "./numerotation.js";

/**
 * Commandes fournisseurs.
 *
 * L'interface identifie une commande par son code métier (CMD-2026-049) ; la
 * base garde en plus un identifiant technique. Les lignes et leur répartition
 * entre les sociétés sont réécrites en bloc à chaque enregistrement, comme le
 * faisait l'ancien localStorage.
 *
 * Création et mise à jour sont deux chemins distincts, et c'est volontaire :
 * l'enregistrement se faisait avant en « INSERT … ON DUPLICATE KEY UPDATE »,
 * si bien qu'une commande arrivant avec un numéro déjà pris écrasait celle
 * qui le portait. Une création ne peut plus toucher une commande existante
 * (voir numerotation.js), et une mise à jour ne peut plus en créer une.
 */

const displayDate = (value) =>
  new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(value instanceof Date ? value : new Date(`${value}T12:00:00`));

/** "12 août 2026" ou "2026-08-12" → "2026-08-12" pour la colonne DATE. */
export const toSqlDate = (value) => {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const months = {
    janvier: 1, février: 2, mars: 3, avril: 4, mai: 5, juin: 6,
    juillet: 7, août: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12,
  };
  const match = String(value).toLowerCase().match(/(\d{1,2})\s+([^\s]+)\s+(\d{4})/);
  if (!match || !months[match[2]]) return new Date().toISOString().slice(0, 10);
  return `${match[3]}-${String(months[match[2]]).padStart(2, "0")}-${match[1].padStart(2, "0")}`;
};

export const listOrders = async () => {
  const [orders, lines, dispatch] = await Promise.all([
    query(
      `SELECT o.id, o.code, o.reference, o.supplier_name, o.order_date, o.status, o.total,
              o.email_sent_at, o.email_to, o.email_subject, o.email_body,
              r.code AS source_request_code
         FROM hmgcde_orders o
         LEFT JOIN hmgcde_purchase_requests r ON r.id = o.source_request_id
        ORDER BY o.order_date DESC, o.id DESC`,
    ),
    query(
      `SELECT id, order_id, product_id, name, packaging, quantity, unit_price, components_json
         FROM hmgcde_order_lines
        ORDER BY order_id, position, id`,
    ),
    query(
      `SELECT d.order_line_id, c.code AS company, d.quantity
         FROM hmgcde_order_line_dispatch d
         JOIN hmgcde_companies c ON c.id = d.company_id`,
    ),
  ]);

  const dispatchByLine = new Map();
  for (const row of dispatch) {
    const map = dispatchByLine.get(row.order_line_id) || {};
    map[row.company] = Number(row.quantity);
    dispatchByLine.set(row.order_line_id, map);
  }

  const linesByOrder = new Map();
  for (const row of lines) {
    const list = linesByOrder.get(row.order_id) || [];
    list.push({
      productId: row.product_id === null ? null : Number(row.product_id),
      name: row.name,
      packaging: row.packaging,
      quantity: Number(row.quantity),
      unitPrice: Number(row.unit_price),
      ...(dispatchByLine.has(row.id) ? { dispatch: dispatchByLine.get(row.id) } : {}),
      ...(row.components_json ? { components: parseJson(row.components_json) } : {}),
    });
    linesByOrder.set(row.order_id, list);
  }

  return orders.map((order) => ({
    id: order.code,
    reference: order.reference,
    supplier: order.supplier_name,
    date: displayDate(order.order_date),
    total: Number(order.total),
    status: order.status,
    lines: linesByOrder.get(order.id) || [],
    ...(order.source_request_code ? { sourceRequestId: order.source_request_code } : {}),
    ...(order.email_subject
      ? {
          email: {
            sentAt: order.email_sent_at || "",
            to: order.email_to || "",
            subject: order.email_subject,
            body: order.email_body || "",
          },
        }
      : {}),
  }));
};

/** Même prudence que pour les réglages : la colonne JSON peut arriver déjà décodée. */
const parseJson = (value) => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};


/**
 * Premier numéro de l'année. La série ne part pas de 1 : c'est la valeur
 * héritée de la numérotation en cours, conservée telle quelle.
 */
const PREMIER_NUMERO = 49;

/**
 * Prochain numéro disponible, lu en base.
 *
 * Le dernier numéro est cherché à la valeur et non à l'ordre alphabétique :
 * « CMD-2026-1000 » se classe avant « CMD-2026-999 » entre chaînes, ce qui
 * aurait fait resservir indéfiniment un numéro déjà pris passé la 999e
 * commande de l'année.
 */
export const nextOrderCode = async () => {
  const year = new Date().getFullYear();
  const rows = await query(
    `SELECT MAX(CAST(SUBSTRING_INDEX(code, '-', -1) AS UNSIGNED)) AS dernier
       FROM hmgcde_orders
      WHERE code LIKE ?`,
    [`CMD-${year}-%`],
  );
  const dernier = Math.max(Number(rows[0]?.dernier) || 0, PREMIER_NUMERO - 1);
  return `CMD-${year}-${String(dernier + 1).padStart(3, "0")}`;
};

/** Fournisseur et demande d'origine, traduits en identifiants de base. */
const resoudreLiens = async (connection, order) => {
  const [suppliers] = await connection.execute(
    "SELECT id FROM hmgcde_suppliers WHERE name = ?",
    [order.supplier || ""],
  );
  const [requests] = order.sourceRequestId
    ? await connection.execute("SELECT id FROM hmgcde_purchase_requests WHERE code = ?", [
        order.sourceRequestId,
      ])
    : [[]];
  return { supplierId: suppliers[0]?.id ?? null, requestId: requests[0]?.id ?? null };
};

/**
 * Réécrit les lignes et leur répartition. L'interface envoie toujours la
 * commande complète, jamais un delta : on remplace tout.
 */
const ecrireLignes = async (connection, orderId, lignes = []) => {
  const [companies] = await connection.execute("SELECT id, code FROM hmgcde_companies");
  const companyIdByCode = new Map(companies.map((row) => [row.code, row.id]));

  await connection.execute("DELETE FROM hmgcde_order_lines WHERE order_id = ?", [orderId]);

  for (const [index, line] of lignes.entries()) {
    const [result] = await connection.execute(
      `INSERT INTO hmgcde_order_lines
         (order_id, product_id, name, packaging, quantity, unit_price, components_json, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        line.productId ?? null,
        line.name,
        line.packaging || "",
        Number(line.quantity) || 0,
        Number(line.unitPrice) || 0,
        line.components?.length ? JSON.stringify(line.components) : null,
        index,
      ],
    );
    for (const [companyCode, quantity] of Object.entries(line.dispatch || {})) {
      const companyId = companyIdByCode.get(companyCode);
      if (!companyId) continue;
      await connection.execute(
        `INSERT INTO hmgcde_order_line_dispatch (order_line_id, company_id, quantity)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
        [result.insertId, companyId, Number(quantity) || 0],
      );
    }
  }
};

/**
 * Insère une commande sous le numéro proposé. L'insertion est sèche : si le
 * numéro est déjà pris, la base refuse et l'erreur remonte — c'est ce qui
 * permet à `attribuerNumero` de reprendre le numéro suivant plutôt que
 * d'écraser la commande d'un collègue.
 */
const insererCommande = (order, code) =>
  withTransaction(async (connection) => {
    const { supplierId, requestId } = await resoudreLiens(connection, order);
    const [result] = await connection.execute(
      `INSERT INTO hmgcde_orders
         (code, reference, supplier_id, supplier_name, order_date, status, total,
          source_request_id, email_sent_at, email_to, email_subject, email_body)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        code,
        order.reference || "",
        supplierId,
        order.supplier || "",
        toSqlDate(order.date),
        order.status || "Brouillon",
        Number(order.total) || 0,
        requestId,
        order.email?.sentAt ?? null,
        order.email?.to ?? null,
        order.email?.subject ?? null,
        order.email?.body ?? null,
      ],
    );
    await ecrireLignes(connection, result.insertId, order.lines);
    return code;
  });

/**
 * Crée une commande et renvoie le numéro que le serveur lui a attribué.
 * C'est le seul chemin de création : l'interface n'envoie plus de numéro.
 */
export const createOrder = (order) =>
  attribuerNumero(nextOrderCode, (code) => insererCommande(order, code));

/**
 * Met à jour une commande existante. Renvoie `null` si le numéro est inconnu :
 * une commande supprimée entre-temps ne doit pas être ressuscitée par un
 * écran resté ouvert.
 */
export const updateOrder = (order) =>
  withTransaction(async (connection) => {
    const [rows] = await connection.execute("SELECT id FROM hmgcde_orders WHERE code = ?", [
      order.id,
    ]);
    if (!rows.length) return null;
    const orderId = rows[0].id;

    const { supplierId, requestId } = await resoudreLiens(connection, order);
    await connection.execute(
      `UPDATE hmgcde_orders
          SET reference = ?, supplier_id = ?, supplier_name = ?, order_date = ?,
              status = ?, total = ?, source_request_id = ?,
              email_sent_at = ?, email_to = ?, email_subject = ?, email_body = ?
        WHERE id = ?`,
      [
        order.reference || "",
        supplierId,
        order.supplier || "",
        toSqlDate(order.date),
        order.status || "Brouillon",
        Number(order.total) || 0,
        requestId,
        order.email?.sentAt ?? null,
        order.email?.to ?? null,
        order.email?.subject ?? null,
        order.email?.body ?? null,
        orderId,
      ],
    );
    await ecrireLignes(connection, orderId, order.lines);
    return order.id;
  });

export const deleteOrder = async (code) => {
  const result = await query("DELETE FROM hmgcde_orders WHERE code = ?", [code]);
  return result.affectedRows > 0;
};
