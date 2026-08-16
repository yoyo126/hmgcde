import crypto from "node:crypto";
import { query, withTransaction } from "../db/pool.js";

/**
 * Catalogue produits.
 *
 * L'interface manipule un objet `Product` unique (offres fournisseurs + contenu
 * des ensembles imbriqués). La base, elle, éclate cela en quatre tables. Ce
 * modèle fait la traduction dans les deux sens, pour que les écrans React
 * restent inchangés.
 */

const SEPARATOR = "|||";

// --- Lecture --------------------------------------------------------------

export const listCatalog = async () => {
  const [products, offers, components, componentPrices] = await Promise.all([
    query(
      `SELECT id, code, name, family, subfamily, unit, kind, bundle_label
         FROM hmgcde_products
        WHERE is_deleted = 0
        ORDER BY id`,
    ),
    query(
      `SELECT sp.product_id, s.name AS supplier, sp.supplier_label, sp.reference, sp.brand,
              sp.price, sp.meter_price, sp.packaging, sp.packaging_type
         FROM hmgcde_supplier_products sp
         JOIN hmgcde_suppliers s ON s.id = sp.supplier_id
        ORDER BY sp.product_id, s.position, s.name`,
    ),
    query(
      `SELECT id, product_id, name, quantity, unit_price
         FROM hmgcde_product_components
        ORDER BY product_id, position, id`,
    ),
    query(
      `SELECT cp.component_id, s.name AS supplier, cp.price
         FROM hmgcde_product_component_prices cp
         JOIN hmgcde_suppliers s ON s.id = cp.supplier_id`,
    ),
  ]);

  const pricesByComponent = new Map();
  for (const row of componentPrices) {
    const map = pricesByComponent.get(row.component_id) || {};
    map[row.supplier] = Number(row.price);
    pricesByComponent.set(row.component_id, map);
  }

  const offersByProduct = new Map();
  for (const row of offers) {
    const list = offersByProduct.get(row.product_id) || [];
    list.push({
      supplier: row.supplier,
      supplierName: row.supplier_label,
      reference: row.reference,
      brand: row.brand,
      price: Number(row.price),
      ...(row.meter_price === null ? {} : { meterPrice: Number(row.meter_price) }),
      packaging: row.packaging,
      packagingType: row.packaging_type,
    });
    offersByProduct.set(row.product_id, list);
  }

  const contentsByProduct = new Map();
  for (const row of components) {
    const list = contentsByProduct.get(row.product_id) || [];
    list.push({
      name: row.name,
      quantity: Number(row.quantity),
      unitPrice: Number(row.unit_price),
      supplierPrices: pricesByComponent.get(row.id) || {},
    });
    contentsByProduct.set(row.product_id, list);
  }

  return products.map((product) => ({
    id: Number(product.id),
    ...(product.code ? { code: product.code } : {}),
    name: product.name,
    family: product.family,
    subfamily: product.subfamily,
    unit: product.unit,
    kind: product.kind,
    ...(product.bundle_label ? { bundleLabel: product.bundle_label } : {}),
    ...(contentsByProduct.has(product.id)
      ? { contents: contentsByProduct.get(product.id) }
      : {}),
    offers: offersByProduct.get(product.id) || [],
  }));
};

export const listPriceHistory = async (limit = 50) => {
  const rows = await query(
    `SELECT batch_id, changed_at, source, scope, product_name, component_name,
            supplier_name, old_price, new_price
       FROM hmgcde_price_history
      ORDER BY changed_at DESC, id DESC
      LIMIT 500`,
  );

  // L'écran attend un historique groupé par validation, pas ligne à ligne.
  const batches = new Map();
  for (const row of rows) {
    const batch = batches.get(row.batch_id) || {
      id: row.batch_id,
      date: formatDateTime(row.changed_at),
      source: row.source,
      changes: [],
    };
    batch.changes.push({
      product: row.product_name,
      supplier: row.supplier_name,
      oldPrice: Number(row.old_price),
      newPrice: Number(row.new_price),
      scope: row.scope,
    });
    batches.set(row.batch_id, batch);
  }
  return [...batches.values()].slice(0, limit);
};

export const listImportHistory = async (limit = 30) => {
  // LIMIT n'accepte pas de paramètre lié dans une requête préparée : on borne
  // la valeur nous-mêmes avant de l'insérer.
  const size = Math.min(Math.max(Number(limit) || 30, 1), 200);
  const rows = await query(
    `SELECT batch_id, imported_at, file_name, supplier_name,
            changed_count, added_count, ignored_count
       FROM hmgcde_tariff_imports
      ORDER BY imported_at DESC, id DESC
      LIMIT ${size}`,
  );
  return rows.map((row) => ({
    id: row.batch_id,
    date: formatDateTime(row.imported_at),
    fileName: row.file_name,
    supplier: row.supplier_name,
    changed: row.changed_count,
    added: row.added_count,
    ignored: row.ignored_count,
  }));
};

const formatDateTime = (value) =>
  new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(value instanceof Date ? value : new Date(value));

// --- Écriture -------------------------------------------------------------

const supplierIdMap = async (connection) => {
  const [rows] = await connection.execute("SELECT id, name FROM hmgcde_suppliers");
  return new Map(rows.map((row) => [row.name, row.id]));
};

/**
 * Crée le fournisseur s'il n'existe pas encore : un import de tarif ou un
 * produit créé à la volée peut mentionner un fournisseur inconnu de la base.
 */
const ensureSupplier = async (connection, suppliers, name) => {
  if (suppliers.has(name)) return suppliers.get(name);
  // La position est calculée à part : MySQL interdit de lire la table dans
  // laquelle on insère au sein de la même instruction.
  const [positions] = await connection.execute(
    "SELECT COALESCE(MAX(position), 0) + 1 AS next FROM hmgcde_suppliers",
  );
  const [result] = await connection.execute(
    `INSERT INTO hmgcde_suppliers (name, position) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
    [name, positions[0].next],
  );
  suppliers.set(name, result.insertId);
  return result.insertId;
};

const upsertProduct = async (connection, suppliers, product) => {
  await connection.execute(
    `INSERT INTO hmgcde_products (id, code, name, family, subfamily, unit, kind, bundle_label, is_deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
     ON DUPLICATE KEY UPDATE
       code = VALUES(code), name = VALUES(name), family = VALUES(family),
       subfamily = VALUES(subfamily), unit = VALUES(unit), kind = VALUES(kind),
       bundle_label = VALUES(bundle_label), is_deleted = 0`,
    [
      product.id,
      product.code ?? null,
      product.name,
      product.family,
      product.subfamily ?? "",
      product.unit ?? "Pièce",
      product.kind === "ensemble" ? "ensemble" : "simple",
      product.bundleLabel ?? null,
    ],
  );

  for (const offer of product.offers || []) {
    const supplierId = await ensureSupplier(connection, suppliers, offer.supplier);
    await connection.execute(
      `INSERT INTO hmgcde_supplier_products
         (product_id, supplier_id, supplier_label, reference, brand, price, meter_price, packaging, packaging_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         supplier_label = VALUES(supplier_label), reference = VALUES(reference),
         brand = VALUES(brand), price = VALUES(price), meter_price = VALUES(meter_price),
         packaging = VALUES(packaging), packaging_type = VALUES(packaging_type)`,
      [
        product.id,
        supplierId,
        offer.supplierName ?? "",
        offer.reference ?? "À renseigner",
        offer.brand ?? "À renseigner",
        Number(offer.price) || 0,
        offer.meterPrice === undefined || offer.meterPrice === null ? null : Number(offer.meterPrice),
        offer.packaging ?? "À renseigner",
        offer.packagingType === "modifiable" ? "modifiable" : "fixed",
      ],
    );
  }

  // Le contenu d'un ensemble est réécrit en entier : c'est ainsi que
  // l'interface l'envoie (liste complète), et cela évite les orphelins.
  if (Array.isArray(product.contents)) {
    await connection.execute("DELETE FROM hmgcde_product_components WHERE product_id = ?", [
      product.id,
    ]);
    for (const [index, item] of product.contents.entries()) {
      const [result] = await connection.execute(
        `INSERT INTO hmgcde_product_components (product_id, name, quantity, unit_price, position)
         VALUES (?, ?, ?, ?, ?)`,
        [product.id, item.name, Number(item.quantity) || 0, Number(item.unitPrice) || 0, index],
      );
      for (const [supplierName, price] of Object.entries(item.supplierPrices || {})) {
        const supplierId = await ensureSupplier(connection, suppliers, supplierName);
        await connection.execute(
          `INSERT INTO hmgcde_product_component_prices (component_id, supplier_id, price)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE price = VALUES(price)`,
          [result.insertId, supplierId, Number(price) || 0],
        );
      }
    }
  }
};

export const saveProducts = async (products) =>
  withTransaction(async (connection) => {
    const suppliers = await supplierIdMap(connection);
    for (const product of products) {
      await upsertProduct(connection, suppliers, product);
    }
    return products.length;
  });

/**
 * Suppression logique : les commandes passées gardent une trace du produit.
 */
export const deleteProducts = async (ids) => {
  if (!ids.length) return 0;
  const placeholders = ids.map(() => "?").join(",");
  const rows = await query(
    `UPDATE hmgcde_products SET is_deleted = 1 WHERE id IN (${placeholders})`,
    ids.map((id) => String(id)),
  );
  return rows.affectedRows ?? ids.length;
};

const setOfferPrice = async (connection, suppliers, productId, supplierName, price) => {
  const supplierId = await ensureSupplier(connection, suppliers, supplierName);
  const [updated] = await connection.execute(
    `UPDATE hmgcde_supplier_products SET price = ? WHERE product_id = ? AND supplier_id = ?`,
    [price, productId, supplierId],
  );
  if (updated.affectedRows) return;

  // Le fournisseur ne référençait pas encore ce produit : on crée l'offre en
  // reprenant le conditionnement déjà connu ailleurs pour ce produit.
  const [reference] = await connection.execute(
    `SELECT supplier_label, packaging, packaging_type FROM hmgcde_supplier_products
      WHERE product_id = ? LIMIT 1`,
    [productId],
  );
  const model = reference[0] || {
    supplier_label: "",
    packaging: "À renseigner",
    packaging_type: "fixed",
  };
  await connection.execute(
    `INSERT INTO hmgcde_supplier_products
       (product_id, supplier_id, supplier_label, packaging, packaging_type, price)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE price = VALUES(price)`,
    [productId, supplierId, model.supplier_label, model.packaging, model.packaging_type, price],
  );
};

const setComponentPrice = async (connection, suppliers, productId, itemName, supplierName, price) => {
  const [components] = await connection.execute(
    `SELECT id FROM hmgcde_product_components WHERE product_id = ? AND name = ? LIMIT 1`,
    [productId, itemName],
  );
  if (!components.length) return;
  const supplierId = await ensureSupplier(connection, suppliers, supplierName);
  await connection.execute(
    `INSERT INTO hmgcde_product_component_prices (component_id, supplier_id, price)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE price = VALUES(price)`,
    [components[0].id, supplierId, price],
  );
};

const recordChanges = async (connection, { batchId, source, changes, userId }) => {
  for (const change of changes) {
    await connection.execute(
      `INSERT INTO hmgcde_price_history
         (batch_id, source, scope, product_name, component_name, supplier_name, old_price, new_price, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        batchId,
        source,
        change.scope === "Sous-produit" ? "Sous-produit" : "Produit",
        change.product,
        // L'interface n'envoie que le libellé modifié ; `scope` dit déjà s'il
        // s'agit d'un produit ou d'un élément d'ensemble.
        change.scope === "Sous-produit" ? change.product : null,
        change.supplier,
        Number(change.oldPrice) || 0,
        Number(change.newPrice) || 0,
        userId ?? null,
      ],
    );
  }
};

/**
 * Saisie manuelle de prix. `prices` et `componentPrices` arrivent sous la forme
 * de clés composées, identiques à celles de l'ancien localStorage :
 *   "12|||REXEL"                       → prix produit
 *   "12|||Disjoncteur C16|||REXEL"     → prix d'un sous-produit
 */
export const applyPriceChanges = async ({ prices = {}, componentPrices = {}, changes = [], userId }) =>
  withTransaction(async (connection) => {
    const suppliers = await supplierIdMap(connection);
    const batchId = crypto.randomUUID();

    for (const [key, value] of Object.entries(prices)) {
      const [productId, supplierName] = key.split(SEPARATOR);
      if (!productId || !supplierName) continue;
      await setOfferPrice(connection, suppliers, productId, supplierName, Number(value) || 0);
    }

    for (const [key, value] of Object.entries(componentPrices)) {
      const [productId, itemName, supplierName] = key.split(SEPARATOR);
      if (!productId || !itemName || !supplierName) continue;
      await setComponentPrice(connection, suppliers, productId, itemName, supplierName, Number(value) || 0);
    }

    if (changes.length) {
      await recordChanges(connection, { batchId, source: "Manuel", changes, userId });
    }
    return { batchId, applied: Object.keys(prices).length + Object.keys(componentPrices).length };
  });

/**
 * Import d'un tarif fournisseur (Excel ou PDF) : nouveaux prix, produits
 * inconnus ajoutés au catalogue, et une ligne dans le journal des imports.
 */
export const applyTariffImport = async ({
  overrides = {},
  newProducts = [],
  history,
  changes = [],
  userId,
}) =>
  withTransaction(async (connection) => {
    const suppliers = await supplierIdMap(connection);
    const batchId = history?.id || crypto.randomUUID();

    for (const product of newProducts) {
      await upsertProduct(connection, suppliers, product);
    }

    for (const [key, value] of Object.entries(overrides)) {
      const [productId, supplierName] = key.split(SEPARATOR);
      if (!productId || !supplierName) continue;
      await setOfferPrice(connection, suppliers, productId, supplierName, Number(value) || 0);
    }

    if (changes.length) {
      await recordChanges(connection, { batchId, source: "Import tarif", changes, userId });
    }

    if (history) {
      await connection.execute(
        `INSERT INTO hmgcde_tariff_imports
           (batch_id, file_name, supplier_name, changed_count, added_count, ignored_count, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          batchId,
          history.fileName || "",
          history.supplier || "",
          Number(history.changed) || 0,
          Number(history.added) || 0,
          Number(history.ignored) || 0,
          userId ?? null,
        ],
      );
    }

    return { batchId, added: newProducts.length };
  });
