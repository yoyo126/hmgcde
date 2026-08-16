import { api, reportApiError } from "./api";
import { DEMO_USER, IS_DEMO, loadDemoState, saveDemoState } from "./demo-mode";
import type {
  Company,
  ImportHistoryItem,
  ManualPriceHistoryItem,
  Product,
  PurchasingSettings,
  SessionUser,
  StoredOrder,
  StoredPurchaseRequest,
} from "./types";

/**
 * Cache applicatif.
 *
 * Les écrans lisent leurs données de façon synchrone (héritage du localStorage).
 * On garde ce confort : tout est chargé en une fois au démarrage
 * (`GET /api/bootstrap`), conservé ici, et chaque écriture part vers l'API en
 * arrière-plan tout en mettant le cache à jour immédiatement — l'interface
 * reste instantanée, la base reste la référence.
 */

export const CATALOG_CHANGED_EVENT = "hm-catalog-changed";
export const PURCHASING_UPDATED_EVENT = "hm-purchasing-updated";
export const SETTINGS_UPDATED_EVENT = "hm-settings-updated";
export const STORE_READY_EVENT = "hm-store-ready";

export const defaultPurchasingSettings: PurchasingSettings = {
  suppliers: [],
  mailSubject: "COMMANDE HM",
  greeting: "Bonjour,",
  deliveryMessage: "A LIVRER CHEZ HM GROUP",
  closing: "Cordialement,\nHM Group",
  deliveryAddress: "Adresse de livraison HM Group à renseigner",
  defaultTeams: { cpte: 1, pose: 1, instal: 1, pac: 1 },
};

type StoreState = {
  ready: boolean;
  user: SessionUser | null;
  companies: Company[];
  settings: PurchasingSettings;
  products: Product[];
  orders: StoredOrder[];
  requests: StoredPurchaseRequest[];
  priceHistory: ManualPriceHistoryItem[];
  importHistory: ImportHistoryItem[];
};

const state: StoreState = {
  ready: false,
  user: null,
  companies: [],
  settings: defaultPurchasingSettings,
  products: [],
  orders: [],
  requests: [],
  priceHistory: [],
  importHistory: [],
};

export const store = state;

const emit = (...events: string[]) => {
  for (const event of events) window.dispatchEvent(new Event(event));
};

type Bootstrap = {
  user: SessionUser;
  companies: Company[];
  settings: PurchasingSettings;
  products: Product[];
  orders: StoredOrder[];
  requests: StoredPurchaseRequest[];
  priceHistory: ManualPriceHistoryItem[];
  importHistory: ImportHistoryItem[];
};

/** Charge toute l'application en un aller-retour. */
export const hydrate = async () => {
  // En démonstration (aperçu GitHub Pages), il n'y a pas de serveur :
  // les données viennent du navigateur.
  const data = IS_DEMO
    ? ({ ...loadDemoState(), user: DEMO_USER } as unknown as Bootstrap)
    : await api.get<Bootstrap>("/bootstrap");
  Object.assign(state, data, { ready: true });
  emit(CATALOG_CHANGED_EVENT, PURCHASING_UPDATED_EVENT, SETTINGS_UPDATED_EVENT, STORE_READY_EVENT);
  return data;
};

/** Photographie de l'état, mémorisée dans le navigateur en démonstration. */
const snapshotDemo = () =>
  saveDemoState({
    companies: state.companies,
    settings: state.settings,
    products: state.products,
    orders: state.orders,
    requests: state.requests,
    priceHistory: state.priceHistory,
    importHistory: state.importHistory,
  });

export const resetStore = () => {
  Object.assign(state, {
    ready: false,
    user: null,
    companies: [],
    settings: defaultPurchasingSettings,
    products: [],
    orders: [],
    requests: [],
    priceHistory: [],
    importHistory: [],
  });
};

/**
 * Enregistrement en arrière-plan : le cache a déjà été mis à jour, on
 * synchronise la base puis on adopte sa réponse (elle fait foi : numéros de
 * commande attribués, prix recalculés, modifications d'un collègue).
 */
const persist = async <T extends Partial<StoreState>>(
  context: string,
  run: () => Promise<T>,
  events: string[],
) => {
  if (IS_DEMO) {
    // Le cache vient d'être mis à jour par l'appelant : il suffit de le garder.
    snapshotDemo();
    emit(...events);
    return;
  }
  try {
    const result = await run();
    Object.assign(state, result);
    emit(...events);
  } catch (error) {
    reportApiError(context, error);
    // La base n'a peut-être pas reçu l'écriture : on recharge pour ne jamais
    // laisser l'écran afficher un état que le serveur ignore.
    try {
      await hydrate();
    } catch {
      /* le rechargement échouera aussi si le serveur est à terre */
    }
  }
};

// --- Catalogue ------------------------------------------------------------

export const setProducts = (products: Product[]) => {
  state.products = products;
  emit(CATALOG_CHANGED_EVENT);
};

export const persistProducts = (products: Product[]) =>
  persist(
    "enregistrement du catalogue",
    () => api.put<{ products: Product[] }>("/catalog/products", { products }),
    [CATALOG_CHANGED_EVENT],
  );

export const persistProductDeletion = (ids: number[]) =>
  persist(
    "suppression de produits",
    () => api.post<{ products: Product[] }>("/catalog/products/delete", { ids }),
    [CATALOG_CHANGED_EVENT],
  );

export const persistPriceChanges = (payload: {
  prices: Record<string, number>;
  componentPrices: Record<string, number>;
  changes: unknown[];
}) =>
  persist(
    "enregistrement des prix",
    () =>
      api.post<{ products: Product[]; priceHistory: ManualPriceHistoryItem[] }>(
        "/catalog/prices",
        payload,
      ),
    [CATALOG_CHANGED_EVENT],
  );

export const persistTariffImport = (payload: {
  overrides: Record<string, number>;
  newProducts: Product[];
  history: ImportHistoryItem;
  changes: unknown[];
}) =>
  persist(
    "import de tarif",
    () =>
      api.post<{
        products: Product[];
        priceHistory: ManualPriceHistoryItem[];
        importHistory: ImportHistoryItem[];
      }>("/catalog/imports", payload),
    [CATALOG_CHANGED_EVENT],
  );

// --- Commandes et demandes d'achat ---------------------------------------

export const setOrders = (orders: StoredOrder[]) => {
  state.orders = orders;
  emit(PURCHASING_UPDATED_EVENT);
};

export const setRequests = (requests: StoredPurchaseRequest[]) => {
  state.requests = requests;
  emit(PURCHASING_UPDATED_EVENT);
};

export const persistOrder = (order: StoredOrder) =>
  persist(
    `enregistrement de la commande ${order.id}`,
    () => api.put<{ orders: StoredOrder[] }>("/orders", { order }),
    [PURCHASING_UPDATED_EVENT],
  );

export const persistOrders = (orders: StoredOrder[]) =>
  persist(
    "enregistrement des commandes",
    () => api.put<{ orders: StoredOrder[] }>("/orders/batch", { orders }),
    [PURCHASING_UPDATED_EVENT],
  );

export const persistRequest = (request: StoredPurchaseRequest) =>
  persist(
    `enregistrement de la demande ${request.id}`,
    () => api.put<{ requests: StoredPurchaseRequest[] }>("/purchase-requests", { request }),
    [PURCHASING_UPDATED_EVENT],
  );

// --- Paramètres -----------------------------------------------------------

export const setSettings = (settings: PurchasingSettings) => {
  state.settings = settings;
  emit(SETTINGS_UPDATED_EVENT);
};

export const persistSettings = (settings: PurchasingSettings) =>
  persist(
    "enregistrement des paramètres",
    () =>
      api.put<{ settings: PurchasingSettings; companies: Company[] }>("/settings", { settings }),
    [SETTINGS_UPDATED_EVENT, CATALOG_CHANGED_EVENT],
  );
