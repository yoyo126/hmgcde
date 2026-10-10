import {
  CATALOG_CHANGED_EVENT,
  persistPriceChanges,
  persistProductDeletion,
  persistProducts,
  persistTariffImport,
  setProducts,
  store,
} from "./store";
import type {
  ImportHistoryItem,
  ManualPriceChange,
  ManualPriceHistoryItem,
  PriceOverride,
  Product,
  ReferenceApprise,
} from "./types";

export type {
  ImportHistoryItem,
  ManualPriceChange,
  ManualPriceHistoryItem,
  PriceOverride,
  ReferenceApprise,
} from "./types";
export { CATALOG_CHANGED_EVENT } from "./store";

/**
 * Catalogue et tarifs.
 *
 * Les prix ne sont plus des « surcharges » posées sur un catalogue figé : ils
 * font partie du produit, en base. Les fonctions historiques sont conservées
 * telles quelles pour les écrans, avec la même sémantique.
 */

const SEPARATOR = "|||";

export const priceKey = (productId: number, supplier: string) =>
  `${productId}${SEPARATOR}${supplier}`;

export const componentPriceKey = (productId: number, itemName: string, supplier: string) =>
  `${productId}${SEPARATOR}${itemName}${SEPARATOR}${supplier}`;

export const getCatalogProducts = (): Product[] => store.products;

/** Tous les prix produit/fournisseur connus, à plat. */
export const getPriceOverrides = (): PriceOverride => {
  const prices: PriceOverride = {};
  for (const product of store.products) {
    for (const offer of product.offers) {
      if (offer.price) prices[priceKey(product.id, offer.supplier)] = offer.price;
    }
  }
  return prices;
};

/** Idem pour les éléments des ensembles (coffrets, cartons, kits). */
export const getComponentPriceOverrides = (): PriceOverride => {
  const prices: PriceOverride = {};
  for (const product of store.products) {
    for (const item of product.contents || []) {
      for (const [supplier, price] of Object.entries(item.supplierPrices || {})) {
        if (price) prices[componentPriceKey(product.id, item.name, supplier)] = price;
      }
    }
  }
  return prices;
};

export const effectivePrice = (productId: number, supplier: string, basePrice: number) => {
  const product = store.products.find((item) => item.id === productId);
  const offer = product?.offers.find((item) => item.supplier === supplier);
  return offer?.price ?? basePrice;
};

export const effectiveComponentPrice = (
  productId: number,
  itemName: string,
  supplier: string,
  basePrice: number,
) => {
  const product = store.products.find((item) => item.id === productId);
  const component = product?.contents?.find((item) => item.name === itemName);
  return component?.supplierPrices?.[supplier] ?? basePrice;
};

export const getImportHistory = (): ImportHistoryItem[] => store.importHistory;
export const getManualPriceHistory = (): ManualPriceHistoryItem[] => store.priceHistory;

/** Enregistre le catalogue tel que l'écran Produits vient de le composer. */
export const saveCatalogProducts = (products: Product[]) => {
  const known = new Set(store.products.map((product) => product.id));
  const merged = [
    ...store.products.map(
      (product) => products.find((item) => item.id === product.id) || product,
    ),
    ...products.filter((product) => !known.has(product.id)),
  ];
  setProducts(merged);
  void persistProducts(products);
};

export const deleteCatalogProducts = (productIds: number[]) => {
  const removed = new Set(productIds);
  setProducts(store.products.filter((product) => !removed.has(product.id)));
  void persistProductDeletion(productIds);
};

/**
 * Modification volontaire des prix depuis l'écran Produits. Les clés reçues
 * sont celles de priceKey() / componentPriceKey().
 */
export const saveManualPriceChanges = ({
  prices,
  componentPrices,
  changes,
}: {
  prices: PriceOverride;
  componentPrices: PriceOverride;
  changes: ManualPriceChange[];
}) => {
  applyPricesToCache(prices, componentPrices);
  if (changes.length) {
    store.priceHistory = [
      {
        id: `local-${Date.now()}`,
        date: new Intl.DateTimeFormat("fr-FR", {
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date()),
        changes,
        source: "Manuel" as const,
      },
      ...store.priceHistory,
    ].slice(0, 50);
  }
  window.dispatchEvent(new Event(CATALOG_CHANGED_EVENT));
  void persistPriceChanges({ prices, componentPrices, changes });
};

/**
 * Import d'un tarif fournisseur (Excel ou PDF).
 *
 * Prix, produits inconnus et références apprises partent dans le même
 * enregistrement. C'est délibéré : les références étaient envoyées juste
 * après, par un second appel qui réécrivait le produit entier tel qu'il était
 * avant l'import. Les deux appels partaient ensemble, et celui qui arrivait en
 * dernier gagnait : la référence était apprise, le prix revenait à sa valeur
 * d'avant. Un tarif n'était donc appliqué qu'à moitié — seules les lignes
 * dont la référence était déjà connue gardaient leur nouveau prix.
 */
export const saveTariffImport = ({
  overrides,
  componentPrices = {},
  meterPrices = {},
  newProducts,
  history,
  changes = [],
  references = [],
}: {
  overrides: PriceOverride;
  componentPrices?: PriceOverride;
  meterPrices?: PriceOverride;
  newProducts: Product[];
  history: ImportHistoryItem;
  changes?: ManualPriceChange[];
  references?: ReferenceApprise[];
}) => {
  if (newProducts.length) {
    setProducts([...store.products, ...newProducts]);
  }
  applyPricesToCache(overrides, componentPrices);
  applyMeterPricesToCache(meterPrices);
  applyReferencesToCache(references);
  store.importHistory = [history, ...store.importHistory].slice(0, 30);
  if (changes.length) {
    store.priceHistory = [
      { id: `import-${history.id}`, date: history.date, changes, source: "Import tarif" as const },
      ...store.priceHistory,
    ].slice(0, 50);
  }
  window.dispatchEvent(new Event(CATALOG_CHANGED_EVENT));
  void persistTariffImport({
    overrides,
    componentPrices,
    meterPrices,
    newProducts,
    history,
    changes,
    references,
  });
};

/**
 * Pose les prix au mètre dans le cache. Ils n'entrent pas dans
 * `applyPricesToCache` parce qu'ils ne remplacent pas le prix : ils
 * l'éclairent, et une offre peut très bien avoir l'un sans l'autre.
 */
const applyMeterPricesToCache = (meterPrices: PriceOverride) => {
  const entrees = new Map<string, number>(Object.entries(meterPrices));
  if (!entrees.size) return;
  store.products = store.products.map((product) => ({
    ...product,
    offers: product.offers.map((offer) => {
      const prix = entrees.get(priceKey(product.id, offer.supplier));
      return prix === undefined ? offer : { ...offer, meterPrice: prix };
    }),
  }));
};

/**
 * Pose les références apprises dans le cache, sans toucher aux prix : c'est
 * tout l'intérêt de ne plus passer par une réécriture du produit.
 */
const applyReferencesToCache = (references: ReferenceApprise[]) => {
  if (!references.length) return;
  const parProduit = new Map(
    references.map((apprise) => [priceKey(apprise.productId, apprise.supplier), apprise]),
  );
  store.products = store.products.map((product) => ({
    ...product,
    offers: product.offers.map((offer) => {
      const apprise = parProduit.get(priceKey(product.id, offer.supplier));
      return apprise
        ? { ...offer, reference: apprise.reference, supplierName: apprise.supplierName }
        : offer;
    }),
  }));
};

/**
 * Répercute les nouveaux prix dans le cache pour que l'écran se rafraîchisse
 * sans attendre la réponse du serveur.
 */
const applyPricesToCache = (prices: PriceOverride, componentPrices: PriceOverride) => {
  const offerUpdates = new Map<string, number>(Object.entries(prices));
  const componentUpdates = new Map<string, number>(Object.entries(componentPrices));
  if (!offerUpdates.size && !componentUpdates.size) return;

  store.products = store.products.map((product) => ({
    ...product,
    offers: product.offers.map((offer) => {
      const price = offerUpdates.get(priceKey(product.id, offer.supplier));
      return price === undefined ? offer : { ...offer, price };
    }),
    contents: product.contents?.map((item) => ({
      ...item,
      supplierPrices: item.supplierPrices
        ? Object.fromEntries(
            Object.entries(item.supplierPrices).map(([supplier, price]) => [
              supplier,
              componentUpdates.get(componentPriceKey(product.id, item.name, supplier)) ?? price,
            ]),
          )
        : item.supplierPrices,
    })),
  }));
};
