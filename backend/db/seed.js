import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { config } from "../config/index.js";
import { pool, query, queryOne, withTransaction, closePool } from "./pool.js";
import { catalogSeeds } from "./catalog-seeds.js";

// --- Données de référence -------------------------------------------------

const COMPANIES = [
  { code: "cpte", name: "CPTE Conseil", short_name: "CPTE", color: "#2563eb", teams: 3 },
  { code: "pose", name: "HM Pose", short_name: "POSE", color: "#14b8a6", teams: 4 },
  { code: "instal", name: "HM Instal", short_name: "INSTAL", color: "#8b5cf6", teams: 2 },
  { code: "pac", name: "HM PAC", short_name: "PAC", color: "#f59e0b", teams: 2 },
];

const SUPPLIERS = [
  "YESS ELECTRIQUE",
  "EURELEC",
  "REXEL",
  "CEDEO",
  "AUBADE",
  "DAST SOLUTION",
  "CLIM+",
];

const SETTINGS = {
  mailSubject: "COMMANDE HM",
  greeting: "Bonjour,",
  deliveryMessage: "A LIVRER CHEZ HM GROUP",
  closing: "Cordialement,\nHM Group",
  deliveryAddress: "Adresse de livraison HM Group à renseigner",
};

// --- Dérivation du catalogue ---------------------------------------------
// Reprise fidèle des règles de l'ancien lib/crm-data.ts : c'est ce qui donne
// à chaque produit ses fournisseurs, son unité et son conditionnement.

const suppliersForFamily = (family) => {
  if (family === "Électricité") return ["YESS ELECTRIQUE", "EURELEC", "REXEL"];
  if (family === "Plomberie" || family === "SSc") return ["CEDEO", "AUBADE", "DAST SOLUTION"];
  return ["CLIM+", "CEDEO", "AUBADE", "DAST SOLUTION"];
};

const describeSeed = (seed) => {
  // Un produit d'électricité avec un conditionnement renseigné est un câble :
  // il se vend à la couronne, dont la longueur est négociable.
  const isCable = seed.family === "Électricité" && Boolean(seed.packaging);
  const isPlumbingCarton = seed.name.toLowerCase().startsWith("carton plomberie");
  return {
    isCable,
    packaging: seed.packaging || (isPlumbingCarton ? "Carton complet" : "À renseigner"),
    subfamily: seed.family === "Électricité" ? (isCable ? "Câbles" : "Consommables") : seed.family,
    unit: isCable ? "Couronne" : isPlumbingCarton ? "Carton" : "Pièce",
    kind: seed.contents?.length ? "ensemble" : "simple",
  };
};

// --- Amorçage -------------------------------------------------------------

const seedCompanies = async (connection) => {
  for (const [index, company] of COMPANIES.entries()) {
    await connection.execute(
      `INSERT INTO hmgcde_companies (code, name, short_name, color, teams, position)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), short_name = VALUES(short_name),
         color = VALUES(color), position = VALUES(position)`,
      [company.code, company.name, company.short_name, company.color, company.teams, index],
    );
  }
};

const seedSuppliers = async (connection) => {
  for (const [index, name] of SUPPLIERS.entries()) {
    await connection.execute(
      `INSERT INTO hmgcde_suppliers (name, position) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE position = VALUES(position)`,
      [name, index],
    );
  }
};

const seedSettings = async (connection) => {
  for (const [key, value] of Object.entries(SETTINGS)) {
    await connection.execute(
      `INSERT INTO hmgcde_settings (setting_key, value) VALUES (?, CAST(? AS JSON))
       ON DUPLICATE KEY UPDATE setting_key = setting_key`,
      [key, JSON.stringify(value)],
    );
  }
};

const seedCatalog = async (connection) => {
  const [supplierRows] = await connection.execute("SELECT id, name FROM hmgcde_suppliers");
  const supplierIdByName = new Map(supplierRows.map((row) => [row.name, row.id]));

  let created = 0;
  for (const seed of catalogSeeds) {
    const { isCable, packaging, subfamily, unit, kind } = describeSeed(seed);

    const [existing] = await connection.execute("SELECT id FROM hmgcde_products WHERE code = ?", [
      seed.code,
    ]);
    if (existing.length) continue; // catalogue déjà amorcé : on ne réécrit rien

    const [result] = await connection.execute(
      `INSERT INTO hmgcde_products (code, name, family, subfamily, unit, kind)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [seed.code, seed.name, seed.family, subfamily, unit, kind],
    );
    const productId = result.insertId;
    created += 1;

    const supplierNames = suppliersForFamily(seed.family);
    for (const supplierName of supplierNames) {
      const supplierId = supplierIdByName.get(supplierName);
      if (!supplierId) continue;
      await connection.execute(
        `INSERT INTO hmgcde_supplier_products
           (product_id, supplier_id, supplier_label, reference, brand, price, meter_price, packaging, packaging_type)
         VALUES (?, ?, ?, 'À renseigner', 'À renseigner', 0, ?, ?, ?)`,
        [
          productId,
          supplierId,
          seed.name.toUpperCase(),
          isCable ? 0 : null,
          packaging,
          isCable ? "modifiable" : "fixed",
        ],
      );
    }

    for (const [index, item] of (seed.contents || []).entries()) {
      const [componentResult] = await connection.execute(
        `INSERT INTO hmgcde_product_components (product_id, name, quantity, unit_price, position)
         VALUES (?, ?, ?, 0, ?)`,
        [productId, item.name, item.quantity, index],
      );
      for (const supplierName of supplierNames) {
        const supplierId = supplierIdByName.get(supplierName);
        if (!supplierId) continue;
        await connection.execute(
          `INSERT INTO hmgcde_product_component_prices (component_id, supplier_id, price)
           VALUES (?, ?, 0)`,
          [componentResult.insertId, supplierId],
        );
      }
    }
  }
  return created;
};

const seedAdmin = async (connection) => {
  const email = config.seed.adminEmail.toLowerCase();
  const [existing] = await connection.execute("SELECT id FROM hmgcde_users WHERE email = ?", [email]);
  if (existing.length) return null;

  // Sans mot de passe fourni, on en génère un : jamais de compte à mot de
  // passe deviné par défaut, même en développement.
  const password = config.seed.adminPassword || crypto.randomBytes(9).toString("base64url");
  const hash = await bcrypt.hash(password, 12);
  await connection.execute(
    `INSERT INTO hmgcde_users (email, name, password_hash, role) VALUES (?, ?, ?, 'admin')`,
    [email, config.seed.adminName, hash],
  );
  return { email, password, generated: !config.seed.adminPassword };
};

export const runSeed = async () => {
  const result = await withTransaction(async (connection) => {
    await seedCompanies(connection);
    await seedSuppliers(connection);
    await seedSettings(connection);
    const products = await seedCatalog(connection);
    const admin = await seedAdmin(connection);
    return { products, admin };
  });

  const total = await queryOne("SELECT COUNT(*) AS total FROM hmgcde_products WHERE is_deleted = 0");
  return { ...result, catalogSize: total?.total ?? 0 };
};

// Exécution directe : `npm run seed`
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  runSeed()
    .then(({ products, catalogSize, admin }) => {
      console.log(`✓ Sociétés, fournisseurs et réglages en place.`);
      console.log(`✓ Catalogue : ${products} produit(s) créé(s), ${catalogSize} au total.`);
      if (admin?.generated) {
        console.log("\n──────────────────────────────────────────────");
        console.log(`  Compte administrateur : ${admin.email}`);
        console.log(`  Mot de passe          : ${admin.password}`);
        console.log("  Notez-le : il ne sera plus jamais affiché.");
        console.log("──────────────────────────────────────────────\n");
      } else if (admin) {
        console.log(`✓ Compte administrateur créé : ${admin.email}`);
      }
      return closePool();
    })
    .then(() => process.exit(0))
    .catch(async (error) => {
      console.error("Échec de l'amorçage :", error.message);
      await pool.end().catch(() => {});
      process.exit(1);
    });
}

export { query };
