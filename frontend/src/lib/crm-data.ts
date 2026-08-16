import { SETTINGS_UPDATED_EVENT, STORE_READY_EVENT, store } from "./store";
import type { Company, Product, ProductComponent } from "./types";

export type {
  CompanyKey,
  Company,
  Product,
  ProductComponent,
  SupplierOffer,
} from "./types";

/**
 * Données de référence des écrans.
 *
 * Le catalogue et les tarifs vivent désormais en base (voir store.ts) : ce
 * fichier ne garde que les repères stables du groupe et les petits utilitaires
 * d'affichage.
 */

const DEFAULT_COMPANIES: Company[] = [
  { key: "cpte", name: "CPTE Conseil", short: "CPTE", color: "#2563eb" },
  { key: "pose", name: "HM Pose", short: "POSE", color: "#14b8a6" },
  { key: "instal", name: "HM Instal", short: "INSTAL", color: "#8b5cf6" },
  { key: "pac", name: "HM PAC", short: "PAC", color: "#f59e0b" },
];

/**
 * Les sociétés servent de valeur importée dans plusieurs écrans : on met le
 * tableau à jour sur place, sans le remplacer, pour que toutes les références
 * déjà en mémoire voient les mêmes données.
 */
export const companies: Company[] = [...DEFAULT_COMPANIES];

const syncCompanies = () => {
  if (!store.companies.length) return;
  companies.length = 0;
  companies.push(...store.companies);
};

if (typeof window !== "undefined") {
  window.addEventListener(STORE_READY_EVENT, syncCompanies);
  window.addEventListener(SETTINGS_UPDATED_EVENT, syncCompanies);
}

/** Prix d'un sous-produit chez un fournisseur donné. */
export const componentPrice = (item: ProductComponent, supplier: string) =>
  item.supplierPrices?.[supplier] || 0;

/**
 * Rubrique d'affichage : en électricité, on sépare les câbles du reste, car
 * ils se commandent à la couronne.
 */
export const productSection = (product: Pick<Product, "family" | "subfamily">) =>
  product.family === "Électricité"
    ? product.subfamily === "Câbles"
      ? "Câbles"
      : "Consommables"
    : product.family;

/** Familles présentes dans le catalogue courant, pour les filtres. */
export const productFamiliesFrom = (products: Product[]) => [
  "Tous",
  ...Array.from(new Set(products.map((product) => product.family))),
];

export const money = (value: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
