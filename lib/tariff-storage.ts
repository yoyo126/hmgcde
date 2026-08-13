import type { Product } from "./crm-data";

export type PriceOverride = Record<string, number>;
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

const read = <T>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(localStorage.getItem(key) || "") as T;
  } catch {
    return fallback;
  }
};

export const priceKey = (productId: number, supplier: string) =>
  `${productId}|||${supplier}`;
export const getPriceOverrides = () => read<PriceOverride>(PRICE_KEY, {});
export const getImportedProducts = () => read<Product[]>(PRODUCT_KEY, []);
export const getImportHistory = () =>
  read<ImportHistoryItem[]>(HISTORY_KEY, []);
export const effectivePrice = (
  productId: number,
  supplier: string,
  basePrice: number,
) => getPriceOverrides()[priceKey(productId, supplier)] ?? basePrice;

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
