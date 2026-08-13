import { products as baseProducts, type Product } from "./crm-data";

export type PriceOverride = Record<string, number>;
export type ManualPriceChange = {
  product: string;
  supplier: string;
  oldPrice: number;
  newPrice: number;
  scope: "Produit" | "Sous-produit";
};
export type ManualPriceHistoryItem = {
  id: string;
  date: string;
  changes: ManualPriceChange[];
};
export type ImportHistoryItem = {
  id: string;
  date: string;
  fileName: string;
  supplier: string;
  changed: number;
  added: number;
  ignored: number;
};

const PRICE_KEY = "hm-tariff-price-overrides";
const PRODUCT_KEY = "hm-tariff-imported-products";
const HISTORY_KEY = "hm-tariff-import-history";
const COMPONENT_PRICE_KEY = "hm-component-price-overrides";
const MANUAL_HISTORY_KEY = "hm-manual-price-history";
const DELETED_PRODUCT_KEY = "hm-deleted-product-ids";
const CATALOG_OVERRIDE_KEY = "hm-catalog-product-overrides";
const CATALOG_VERSION_KEY = "hm-catalog-version";
const CATALOG_VERSION = "2026-08-14-catalogue-simple-v1";

const ensureCatalogVersion = () => {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(CATALOG_VERSION_KEY) === CATALOG_VERSION) return;
  [
    PRICE_KEY,
    PRODUCT_KEY,
    COMPONENT_PRICE_KEY,
    DELETED_PRODUCT_KEY,
    CATALOG_OVERRIDE_KEY,
  ].forEach((key) => localStorage.removeItem(key));
  localStorage.setItem(CATALOG_VERSION_KEY, CATALOG_VERSION);
};

const read = <T>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(localStorage.getItem(key) || "") as T;
  } catch {
    return fallback;
  }
};

const createLocalId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const priceKey = (productId: number, supplier: string) =>
  `${productId}|||${supplier}`;
export const componentPriceKey = (
  productId: number,
  itemName: string,
  supplier: string,
) => `${productId}|||${itemName}|||${supplier}`;
export const getPriceOverrides = () => read<PriceOverride>(PRICE_KEY, {});
export const getComponentPriceOverrides = () =>
  read<PriceOverride>(COMPONENT_PRICE_KEY, {});
export const getImportedProducts = () => read<Product[]>(PRODUCT_KEY, []);
export const getDeletedProductIds = () =>
  read<number[]>(DELETED_PRODUCT_KEY, []);
export const getCatalogProducts = () => {
  ensureCatalogVersion();
  const deleted = new Set(getDeletedProductIds());
  const overrides = read<Record<string, Product>>(CATALOG_OVERRIDE_KEY, {});
  return [...baseProducts, ...getImportedProducts()].map(
    (product) => overrides[String(product.id)] || product,
  ).filter(
    (product) => !deleted.has(product.id),
  );
};
export const saveCatalogProducts = (products: Product[]) => {
  localStorage.setItem(
    CATALOG_OVERRIDE_KEY,
    JSON.stringify(Object.fromEntries(products.map((product) => [String(product.id), product]))),
  );
};
export const deleteCatalogProducts = (productIds: number[]) => {
  const deleted = new Set([...getDeletedProductIds(), ...productIds]);
  localStorage.setItem(DELETED_PRODUCT_KEY, JSON.stringify([...deleted]));
};
export const getImportHistory = () =>
  read<ImportHistoryItem[]>(HISTORY_KEY, []);
export const getManualPriceHistory = () =>
  read<ManualPriceHistoryItem[]>(MANUAL_HISTORY_KEY, []);
export const effectivePrice = (
  productId: number,
  supplier: string,
  basePrice: number,
) => getPriceOverrides()[priceKey(productId, supplier)] ?? basePrice;
export const effectiveComponentPrice = (
  productId: number,
  itemName: string,
  supplier: string,
  basePrice: number,
) =>
  getComponentPriceOverrides()[
    componentPriceKey(productId, itemName, supplier)
  ] ?? basePrice;

export const saveManualPriceChanges = ({
  prices,
  componentPrices,
  changes,
}: {
  prices: PriceOverride;
  componentPrices: PriceOverride;
  changes: ManualPriceChange[];
}) => {
  localStorage.setItem(
    PRICE_KEY,
    JSON.stringify({ ...getPriceOverrides(), ...prices }),
  );
  localStorage.setItem(
    COMPONENT_PRICE_KEY,
    JSON.stringify({ ...getComponentPriceOverrides(), ...componentPrices }),
  );
  if (!changes.length) return;
  const historyItem: ManualPriceHistoryItem = {
    id: createLocalId(),
    date: new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date()),
    changes,
  };
  localStorage.setItem(
    MANUAL_HISTORY_KEY,
    JSON.stringify([historyItem, ...getManualPriceHistory()].slice(0, 50)),
  );
};

export const saveTariffImport = ({
  overrides,
  newProducts,
  history,
}: {
  overrides: PriceOverride;
  newProducts: Product[];
  history: ImportHistoryItem;
}) => {
  localStorage.setItem(
    PRICE_KEY,
    JSON.stringify({ ...getPriceOverrides(), ...overrides }),
  );
  const existing = getImportedProducts();
  localStorage.setItem(
    PRODUCT_KEY,
    JSON.stringify([...existing, ...newProducts]),
  );
  localStorage.setItem(
    HISTORY_KEY,
    JSON.stringify([history, ...getImportHistory()].slice(0, 30)),
  );
};
