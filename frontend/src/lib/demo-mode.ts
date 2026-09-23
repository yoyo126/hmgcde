import { catalogSeeds } from "./demo-catalog";
import type {
  Company,
  Product,
  PurchasingSettings,
  SessionUser,
  SupplierOffer,
} from "./types";

/**
 * Mode démonstration.
 *
 * Utilisé par l'aperçu publié sur GitHub Pages, qui ne peut héberger que des
 * fichiers : il n'y a ni serveur ni base de données. L'application tourne
 * alors entièrement dans le navigateur, avec ses données dans le
 * localStorage — de quoi parcourir tous les écrans et juger du résultat avant
 * la mise en ligne réelle sur le serveur.
 *
 * Ce n'est PAS l'application de production : chaque navigateur a ses propres
 * données, rien n'est partagé entre les sociétés.
 */

export const IS_DEMO = import.meta.env.VITE_DEMO === "1";

const DEMO_KEY = "hmgcde-demo-state";

/**
 * Version du catalogue de démonstration.
 *
 * L'aperçu mémorise ses données dans le navigateur. Sans ce repère, une
 * correction du catalogue restait invisible pour qui avait déjà ouvert
 * l'application : le navigateur resservait l'ancienne version. C'est ce qui
 * faisait croire que certains fournisseurs ne proposaient rien hors de leur
 * famille d'origine. À chaque changement de règle, on incrémente.
 */
const VERSION_CATALOGUE = "2026-09-23-tous-fournisseurs";

export const DEMO_USER: SessionUser = {
  id: 0,
  email: "demo@hmgroup.fr",
  name: "Démonstration",
  role: "admin",
};

const COMPANIES: Company[] = [
  { key: "cpte", name: "CPTE Conseil", short: "CPTE", color: "#2563eb", teams: 3 },
  { key: "pose", name: "HM Pose", short: "POSE", color: "#14b8a6", teams: 4 },
  { key: "instal", name: "HM Instal", short: "INSTAL", color: "#8b5cf6", teams: 2 },
  { key: "pac", name: "HM PAC", short: "PAC", color: "#f59e0b", teams: 2 },
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

// La démo doit montrer exactement le catalogue de l'application réelle : le
// serveur propose chaque produit chez TOUS les fournisseurs (voir
// completeOffers dans backend/models/catalog.js), donc la démo aussi.

const buildProducts = (): Product[] =>
  catalogSeeds.map((seed, index) => {
    const isCable = seed.family === "Électricité" && Boolean(seed.packaging);
    const isPlumbingCarton = seed.name.toLowerCase().startsWith("carton plomberie");
    const packaging = seed.packaging || (isPlumbingCarton ? "Carton complet" : "À renseigner");
    const supplierList = SUPPLIERS;

    const offers: SupplierOffer[] = supplierList.map((supplier) => ({
      supplier,
      supplierName: seed.name.toUpperCase(),
      reference: "À renseigner",
      brand: "À renseigner",
      price: 0,
      ...(isCable ? { meterPrice: 0 } : {}),
      packaging,
      packagingType: isCable ? ("modifiable" as const) : ("fixed" as const),
    }));

    return {
      id: index + 1,
      code: seed.code,
      name: seed.name,
      family: seed.family,
      subfamily:
        seed.family === "Électricité" ? (isCable ? "Câbles" : "Consommables") : seed.family,
      unit: isCable ? "Couronne" : isPlumbingCarton ? "Carton" : "Pièce",
      kind: seed.contents?.length ? ("ensemble" as const) : ("simple" as const),
      ...(seed.contents?.length
        ? {
            contents: seed.contents.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              unitPrice: 0,
              supplierPrices: Object.fromEntries(supplierList.map((s) => [s, 0])),
            })),
          }
        : {}),
      offers,
    };
  });

const buildSettings = (): PurchasingSettings => ({
  suppliers: SUPPLIERS.map((name) => ({ name, emails: "" })),
  mailSubject: "COMMANDE HM",
  greeting: "Bonjour,",
  deliveryMessage: "A LIVRER CHEZ HM GROUP",
  closing: "Cordialement,\nHM Group",
  deliveryAddress: "Adresse de livraison HM Group à renseigner",
  defaultTeams: { cpte: 3, pose: 4, instal: 2, pac: 2 },
});

export type DemoState = {
  /** Repère de fraîcheur du catalogue mémorisé dans le navigateur. */
  version?: string;
  companies: Company[];
  settings: PurchasingSettings;
  products: Product[];
  orders: unknown[];
  requests: unknown[];
  priceHistory: unknown[];
  importHistory: unknown[];
};

/** État de départ, ou celui laissé par la visite précédente. */
const etatNeuf = (): DemoState => ({
  version: VERSION_CATALOGUE,
  companies: COMPANIES,
  settings: buildSettings(),
  products: buildProducts(),
  orders: [],
  requests: [],
  priceHistory: [],
  importHistory: [],
});

export const loadDemoState = (): DemoState => {
  try {
    const saved = localStorage.getItem(DEMO_KEY);
    if (!saved) return etatNeuf();
    const etat = JSON.parse(saved) as DemoState;
    if (etat.version === VERSION_CATALOGUE) return etat;
    // Catalogue périmé : on le reconstruit, mais on garde les commandes et
    // les demandes déjà saisies — les perdre serait inutilement brutal.
    return {
      ...etat,
      version: VERSION_CATALOGUE,
      companies: COMPANIES,
      settings: { ...buildSettings(), ...(etat.settings || {}) },
      products: buildProducts(),
    };
  } catch {
    /* données illisibles : on repart du catalogue de départ */
  }
  return etatNeuf();
};

export const saveDemoState = (state: DemoState) => {
  try {
    // La version est apposée à l'écriture : si l'appelant l'omet, l'état ne
    // doit pas passer pour périmé au prochain chargement — sinon le catalogue
    // serait reconstruit à chaque visite, effaçant les prix saisis.
    localStorage.setItem(
      DEMO_KEY,
      JSON.stringify({ ...state, version: VERSION_CATALOGUE }),
    );
  } catch {
    /* quota dépassé : la démo continue, sans mémoriser */
  }
};

export const resetDemoState = () => localStorage.removeItem(DEMO_KEY);
