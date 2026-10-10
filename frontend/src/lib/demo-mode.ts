import { catalogSeeds } from "./demo-catalog";
import { analyseConditionnement } from "./conditionnement";
import { repartir } from "./dispatch";
import type {
  Company,
  CompanyKey,
  Product,
  PurchasingSettings,
  SessionUser,
  StoredOrder,
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
const VERSION_CATALOGUE = "2026-10-10-prix-exemple";

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

/**
 * Prix d'exemple de la démonstration.
 *
 * L'aperçu est public : il ne portera jamais les tarifs négociés, qui vivent
 * sur le serveur. Mais sans aucun prix il ne montrait rien de ce qui touche à
 * l'argent — ni la répartition en euros entre les sociétés, ni les totaux de
 * l'accueil, ni l'écart d'un import de tarif, ni le prix au mètre. Ces
 * montants sont donc inventés, et seulement vraisemblables.
 *
 * Ils sont tirés d'une empreinte du code produit : le même produit vaut
 * toujours le même prix, d'une visite à l'autre et d'un navigateur à
 * l'autre. Un aperçu dont les chiffres changent à chaque rechargement ne se
 * juge pas.
 */
const empreinte = (texte: string) => {
  let valeur = 7;
  for (let index = 0; index < texte.length; index += 1) {
    valeur = (valeur * 31 + texte.charCodeAt(index)) % 1000003;
  }
  return valeur / 1000003;
};

/** Un montant dans une fourchette, stable pour une graine donnée. */
const montant = (graine: string, bas: number, haut: number) =>
  Math.round((bas + empreinte(graine) * (haut - bas)) * 100) / 100;

/** Écart entre fournisseurs : ±9 %, de quoi faire émerger un meilleur prix. */
const ecartFournisseur = (graine: string) => 0.91 + empreinte(graine) * 0.18;

/** Fourchettes par famille, pour rester dans l'ordre de grandeur du réel. */
const FOURCHETTES: Record<string, [number, number]> = {
  "Électricité": [0.4, 45],
  Climatisation: [12, 320],
  Plomberie: [8, 180],
  SSc: [40, 350],
};

/** Référence d'exemple : deux lettres du fournisseur et quatre chiffres. */
const referenceDemo = (code: string, supplier: string) => {
  const lettres = supplier.replace(/[^A-Z]/g, "").slice(0, 2) || "XX";
  return `${lettres}-${Math.floor(empreinte(`${supplier}#${code}`) * 9000) + 1000}`;
};

const buildProducts = (): Product[] =>
  catalogSeeds.map((seed, index) => {
    const isCable = seed.family === "Électricité" && Boolean(seed.packaging);
    const isPlumbingCarton = seed.name.toLowerCase().startsWith("carton plomberie");
    const packaging = seed.packaging || (isPlumbingCarton ? "Carton complet" : "À renseigner");
    const supplierList = SUPPLIERS;

    // Un câble se chiffre au mètre puis se multiplie par sa couronne : prix et
    // conditionnement restent ainsi cohérents, et le €/m affiché tombe juste.
    const longueur = analyseConditionnement(packaging);
    const [bas, haut] = FOURCHETTES[seed.family] ?? [5, 80];
    const prixDeBase =
      longueur && longueur.famille === "longueur"
        ? Math.round(montant(seed.code, 0.35, 8) * longueur.quantite * 100) / 100
        : montant(seed.code, bas, haut);

    const offers: SupplierOffer[] = supplierList.map((supplier) => {
      // Un fournisseur sur huit ne chiffre pas le produit : l'écran doit
      // aussi savoir montrer « À saisir ».
      const absent = empreinte(`${seed.code}|${supplier}`) < 0.12;
      return {
        supplier,
        supplierName: seed.name.toUpperCase(),
        reference: absent ? "À renseigner" : referenceDemo(seed.code, supplier),
        brand: "À renseigner",
        // Un ensemble tire son prix de son contenu : le sien reste à zéro.
        price:
          absent || seed.contents?.length
            ? 0
            : Math.round(prixDeBase * ecartFournisseur(`${supplier}|${seed.code}`) * 100) / 100,
        // Laissé à zéro exprès : le prix au mètre se déduit du
        // conditionnement, et l'aperçu doit montrer ce calcul-là.
        ...(isCable ? { meterPrice: 0 } : {}),
        packaging,
        packagingType: isCable ? ("modifiable" as const) : ("fixed" as const),
      };
    });

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
            contents: seed.contents.map((item) => {
              // Le prix d'un coffret se calcule sur son contenu : ce sont donc
              // les éléments qu'il faut chiffrer, pas l'ensemble.
              const base = montant(`${seed.code}/${item.name}`, 1.2, 38);
              return {
                name: item.name,
                quantity: item.quantity,
                unitPrice: base,
                supplierPrices: Object.fromEntries(
                  supplierList.map((fournisseur) => [
                    fournisseur,
                    Math.round(base * ecartFournisseur(`${fournisseur}/${item.name}`) * 100) / 100,
                  ]),
                ),
              };
            }),
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

/**
 * Commandes d'exemple.
 *
 * Sans elles, l'aperçu n'ouvre rien de ce qui ne se voit qu'une fois des
 * commandes passées : les totaux de l'accueil, le suivi, et surtout la
 * répartition en euros entre les quatre sociétés. La répartition est calculée
 * par la règle de l'application elle-même, sur le nombre d'équipes par
 * défaut : elle est juste, pas figurative.
 */
const COMMANDES_EXEMPLE = [
  {
    code: "CMD-2026-049",
    reference: "Commande S40 du 28/09/2026",
    supplier: "YESS ELECTRIQUE",
    date: "28 septembre 2026",
    status: "Envoyée",
    lignes: 4,
  },
  {
    code: "CMD-2026-050",
    reference: "Commande S41 du 02/10/2026",
    supplier: "CEDEO",
    date: "2 octobre 2026",
    status: "Envoyée",
    lignes: 3,
  },
  {
    code: "CMD-2026-051",
    reference: "Commande S41 du 08/10/2026",
    supplier: "REXEL",
    date: "8 octobre 2026",
    status: "Brouillon",
    lignes: 3,
  },
] as const;

const buildOrders = (products: Product[]): StoredOrder[] => {
  const equipes = buildSettings().defaultTeams;
  const cles = COMPANIES.map((societe) => societe.key);

  return COMMANDES_EXEMPLE.map((modele) => {
    const eligibles = products.filter((produit) =>
      produit.offers.some(
        (offre) => offre.supplier === modele.supplier && offre.price > 0,
      ),
    );
    // Un départ différent par commande : trois commandes de suite sur les
    // mêmes produits ne montreraient pas grand-chose.
    const depart = Math.floor(
      empreinte(modele.code) * Math.max(1, eligibles.length - modele.lignes),
    );
    const lines = eligibles.slice(depart, depart + modele.lignes).map((produit) => {
      const offre = produit.offers.find((item) => item.supplier === modele.supplier)!;
      const quantity = 2 + Math.floor(empreinte(`${modele.code}/${produit.id}`) * 8);
      const parts = repartir(
        quantity,
        cles.map((cle) => equipes[cle]),
      );
      return {
        productId: produit.id,
        name: produit.name,
        packaging: offre.packaging,
        quantity,
        unitPrice: offre.price,
        dispatch: Object.fromEntries(
          cles.map((cle, index) => [cle, parts[index]]),
        ) as Record<CompanyKey, number>,
      };
    });

    return {
      id: modele.code,
      reference: modele.reference,
      supplier: modele.supplier,
      date: modele.date,
      status: modele.status,
      total:
        Math.round(
          lines.reduce((somme, ligne) => somme + ligne.quantity * ligne.unitPrice, 0) * 100,
        ) / 100,
      lines,
    };
  });
};

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
const etatNeuf = (): DemoState => {
  const products = buildProducts();
  return {
    version: VERSION_CATALOGUE,
    companies: COMPANIES,
    settings: buildSettings(),
    products,
    orders: buildOrders(products),
    requests: [],
    priceHistory: [],
    importHistory: [],
  };
};

export const loadDemoState = (): DemoState => {
  try {
    const saved = localStorage.getItem(DEMO_KEY);
    if (!saved) return etatNeuf();
    const etat = JSON.parse(saved) as DemoState;
    if (etat.version === VERSION_CATALOGUE) return etat;
    // Catalogue périmé : on le reconstruit, mais on garde les commandes et
    // les demandes déjà saisies — les perdre serait inutilement brutal.
    const products = buildProducts();
    return {
      ...etat,
      version: VERSION_CATALOGUE,
      companies: COMPANIES,
      settings: { ...buildSettings(), ...(etat.settings || {}) },
      products,
      // Un aperçu sans commande ne montre pas la répartition en euros : on en
      // pose au besoin, sans toucher à celles que le visiteur a saisies.
      orders: etat.orders?.length ? etat.orders : buildOrders(products),
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
