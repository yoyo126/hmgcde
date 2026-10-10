
import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  FileClock,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  PackagePlus,
  Table2,
  UploadCloud,
} from "lucide-react";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.js?url";
import { money, type Product } from "@/lib/crm-data";
import {
  effectivePrice,
  getImportHistory,
  getManualPriceHistory,
  priceKey,
  saveTariffImport,
  type ImportHistoryItem,
  type ManualPriceChange,
  type PriceOverride,
  type ReferenceApprise,
} from "@/lib/tariff-storage";
import { useCatalogProducts } from "@/lib/use-catalog-products";
import { usePurchasingSettings } from "@/lib/use-purchasing-settings";
import {
  convertirPrix,
  prixAuMetre,
  type ResultatConversion,
} from "@/lib/conditionnement";
import { nomCsv, telechargerCsv } from "@/lib/export-csv";
import {
  lignesReferences,
  lireReferences,
  type ChangementsReferences,
} from "@/lib/references-csv";

type RawLine = {
  name: string;
  reference: string;
  /**
   * Second code porté par la ligne : les devis YESSS donnent à la fois leur
   * numéro d'article et le numéro de catalogue du constructeur. Les deux
   * servent à retrouver le produit.
   */
  catalogue?: string;
  price: number;
  /** Unité de vente du fournisseur, ex. « 100 Mètr » — affichée pour contrôle. */
  unit?: string;
};
type ReviewLine = RawLine & {
  id: string;
  product?: Product;
  oldPrice: number;
  status: "changed" | "new" | "unchanged";
  selected: boolean;
  /** Produits à proposer quand le rattachement n'est pas sûr. */
  suggestions: Product[];
  /**
   * Prix ramené au conditionnement de ce fournisseur, et ce qu'on en sait.
   * Un tarif parle en unités de vente — « 1000 Mètr » — l'application en
   * conditionnements : une couronne de 100 m.
   */
  conversion: ResultatConversion;
  /**
   * Prix au mètre, pour ce qui se vend à la longueur. C'est le repère que
   * l'on cherche sur un câble : deux fournisseurs ne proposent jamais la même
   * longueur de couronne, mais le prix au mètre se compare toujours.
   */
  prixMetre: number | null;
};

const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const parsePrice = (value: unknown) => {
  if (typeof value === "number") return value;
  const cleaned = String(value ?? "")
    .replace(/\s/g, "")
    .replace(/[€$£]/g, "")
    .replace(/,(?=\d{1,3}$)/, ".")
    .replace(/[^0-9.-]/g, "");
  const price = Number(cleaned);
  return Number.isFinite(price) && price > 0 ? price : 0;
};

const headerIndex = (headers: unknown[], terms: string[]) =>
  headers.findIndex((cell) =>
    terms.some((term) => normalize(cell).includes(normalize(term))),
  );

const readFileAsArrayBuffer = (file: File) => {
  if (typeof file.arrayBuffer === "function") return file.arrayBuffer();
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(new Error("Le fichier n’a pas pu être lu."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Lecture impossible."));
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Lecture d'un tarif Excel.
 *
 * La bibliothèque vient de cdn.sheetjs.com et non du registre npm : la
 * dernière version publiée sur npm (0.18.5) traîne deux failles connues, et
 * son éditeur ne publie plus que sur son propre site. Les fichiers lus ici
 * arrivent des fournisseurs, donc de l'extérieur : c'est exactement le cas
 * où la version corrigée compte.
 *
 * Elle lit aussi les vieux classeurs .xls, que les fournisseurs envoient
 * encore — raison pour laquelle elle n'est pas remplacée par une autre.
 */
async function readExcel(file: File): Promise<RawLine[]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await readFileAsArrayBuffer(file), { type: "array" });
  return workbook.SheetNames.flatMap((sheetName) => {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(
      workbook.Sheets[sheetName],
      { header: 1, defval: "", raw: true },
    );
    const headerRow = rows.findIndex((row) => {
      const cells = Array.isArray(row) ? row : [];
      return (
        headerIndex(cells, ["produit", "designation", "libelle", "article"]) >=
          0 && headerIndex(cells, ["prix", "tarif", "net", "pu ht"]) >= 0
      );
    });
    if (headerRow < 0) return [];
    const headers = rows[headerRow];
    const nameColumn = headerIndex(headers, [
      "produit",
      "designation",
      "libelle",
      "article",
    ]);
    const referenceColumn = headerIndex(headers, ["reference", "ref", "code"]);
    const priceColumn = headerIndex(headers, [
      "prix net",
      "prix unitaire",
      "pu ht",
      "tarif",
      "prix",
      "net",
    ]);
    return rows
      .slice(headerRow + 1)
      .map((row) => ({
        name: String(row[nameColumn] ?? "").trim(),
        reference:
          referenceColumn >= 0 ? String(row[referenceColumn] ?? "").trim() : "",
        price: parsePrice(row[priceColumn]),
      }))
      .filter((row) => row.name.length > 2 && row.price > 0);
  });
}

/**
 * Lecture d'un tarif ou d'un devis PDF.
 *
 * L'ancienne version cherchait « un prix en fin de ligne » : sur un devis
 * fournisseur, la dernière colonne est le *montant* de la ligne, pas le prix
 * unitaire, et le premier mot est la *quantité*, pas la référence. Résultat :
 * des prix faux, des références absurdes, et zéro correspondance.
 *
 * On lit donc le tableau comme un tableau : on repère la ligne d'en-tête,
 * on retient l'abscisse de chaque colonne, puis on range chaque fragment de
 * texte dans la colonne dont il est le plus proche.
 */

type Fragment = { x: number; xFin: number; texte: string };

/**
 * Un élément de texte positionné. pdf.js mélange dans `items` du texte et des
 * marqueurs de structure ; seuls les premiers portent des coordonnées.
 */
type ElementTexte = { str: string; transform: number[]; width?: number };

/**
 * pdf.js déclare `items` comme une union (texte | marqueur de structure) dont
 * seule la première branche porte `str` et `transform`. Le typage fourni ne se
 * laisse pas restreindre par un simple prédicat : on convertit donc une fois,
 * explicitement, puis on écarte les éléments sans texte.
 */
const elementsTexte = (items: unknown[]): ElementTexte[] =>
  (items as ElementTexte[]).filter(
    (item) => typeof item?.str === "string" && Array.isArray(item.transform),
  );

/** Regroupe les fragments d'une page en lignes, par ordonnée. */
const groupeEnLignes = (fragments: { x: number; y: number; xFin: number; texte: string }[]) => {
  const lignes = new Map<number, Fragment[]>();
  for (const f of fragments) {
    // Tolérance de 2 points : sur ces devis, le « NET » d'une remise est
    // parfois posé un point plus bas que le reste de sa ligne.
    const cle = [...lignes.keys()].find((y) => Math.abs(y - f.y) <= 2);
    const liste = cle === undefined ? [] : lignes.get(cle)!;
    liste.push({ x: f.x, xFin: f.xFin, texte: f.texte });
    lignes.set(cle === undefined ? f.y : cle, liste);
  }
  return [...lignes.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, cellules]) => cellules.sort((a, b) => a.x - b.x));
};

/**
 * Colonnes reconnues dans l'en-téte d'un tableau.
 *
 * Toute colonne absente de cette liste n'est pas ignorée : son contenu est
 * rangé dans la colonne connue la plus proche. Un devis YESSS porte neuf
 * colonnes, et les trois qui manquaient ici — « Catalogue », « Prix » brut
 * et « Remises » — venaient donc se coller à la désignation et au prix net :
 * le nom du produit arrivait préfixé d'un numéro de catalogue, et le prix
 * brut pouvait être pris pour le prix net. D'où l'importance de les nommer,
 * même pour ne rien en faire.
 */
const EN_TETES = {
  quantite: ["qte", "qté", "quantite", "quantité"],
  reference: ["article", "reference", "référence", "ref", "code"],
  catalogue: ["catalogue", "cat.", "ref catalogue"],
  designation: ["designation", "désignation", "libelle", "libellé", "produit"],
  prixNet: ["prix net", "prixnet", "net", "prix unitaire", "pu ht", "p.u."],
  prixBrut: ["prix brut", "prixbrut", "brut", "tarif", "prix"],
  remise: ["remises", "remise", "remises (%)", "remise (%)", "%"],
  unite: ["uvte", "u.vte", "unite", "unité", "cond", "conditionnement"],
  montant: ["montant", "total"],
};

const estNombre = (texte: string) => /^-?\d{1,3}(?:[ .]\d{3})*(?:[.,]\d{1,4})?$/.test(texte.trim());

/** Repère la ligne d'en-tête et l'abscisse de chaque colonne utile. */
const trouveColonnes = (lignes: Fragment[][]) => {
  for (let i = 0; i < lignes.length; i += 1) {
    const cellules = lignes[i];
    const colonnes: Record<string, number> = {};
    for (const cellule of cellules) {
      const texte = normalize(cellule.texte);
      for (const [nom, motifs] of Object.entries(EN_TETES)) {
        if (colonnes[nom] === undefined && motifs.some((motif) => texte === normalize(motif))) {
          colonnes[nom] = cellule.x;
        }
      }
    }
    // Un en-tête crédible nomme au moins une désignation et un prix.
    if (colonnes.designation !== undefined && (colonnes.prixNet !== undefined || colonnes.prixBrut !== undefined)) {
      return { index: i, colonnes };
    }
  }
  return null;
};

/** Range les cellules d'une ligne dans les colonnes repérées. */
const rangeParColonne = (cellules: Fragment[], colonnes: Record<string, number>) => {
  const resultat: Record<string, string[]> = {};
  const noms = Object.keys(colonnes);
  for (const cellule of cellules) {
    let meilleur = noms[0];
    let ecart = Infinity;
    for (const nom of noms) {
      const d = Math.abs(colonnes[nom] - cellule.x);
      if (d < ecart) {
        ecart = d;
        meilleur = nom;
      }
    }
    (resultat[meilleur] ||= []).push(cellule.texte);
  }
  return resultat;
};

async function readPdf(file: File): Promise<RawLine[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.js");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const document = await pdfjs.getDocument({ data: await readFileAsArrayBuffer(file) }).promise;

  const resultats: RawLine[] = [];

  for (let numero = 1; numero <= document.numPages; numero += 1) {
    const page = await document.getPage(numero);
    const contenu = await page.getTextContent();
    const fragments = elementsTexte(contenu.items)
      .filter((item) => item.str.trim())
      .map((item) => ({
        x: item.transform[4],
        y: item.transform[5],
        xFin: item.transform[4] + (item.width || 0),
        texte: item.str.trim(),
      }));

    const lignes = groupeEnLignes(fragments);
    const entete = trouveColonnes(lignes);

    if (!entete) {
      // En-tête non reconnu (autre fournisseur, autre mise en page) : plutôt
      // que de ne rien remonter, on retient toute ligne comportant un libellé
      // et au moins un prix. Mieux vaut une liste à vérifier qu'un écran vide.
      for (const cellules of lignes) {
        const textes = cellules.map((c) => c.texte);
        const prixCandidats = textes.filter((t) => /\d[.,]\d{2}$/.test(t.trim()));
        if (!prixCandidats.length) continue;
        const libelle = textes
          .filter((t) => !estNombre(t) && t.length > 3 && !/^\d/.test(t))
          .join(" ")
          .trim();
        if (libelle.length < 4) continue;
        const reference = textes.find((t) => /^[A-Z0-9][A-Z0-9./_-]{3,}$/i.test(t) && /[-.]/.test(t)) || "";
        // Sans en-tête, le prix le plus bas est le plus souvent le prix
        // unitaire, le plus haut le montant total.
        const prix = Math.min(...prixCandidats.map((t) => parsePrice(t)).filter((n) => n > 0));
        if (!(prix > 0)) continue;
        resultats.push({ name: libelle, reference, price: prix });
      }
      continue;
    }

    for (const cellules of lignes.slice(entete.index + 1)) {
      const par = rangeParColonne(cellules, entete.colonnes);
      const designation = (par.designation || []).join(" ").trim();
      const reference = (par.reference || []).find((t) => !estNombre(t) || t.includes("-")) || "";
      const catalogue = (par.catalogue || []).join(" ").trim();
      const nombreNet = (par.prixNet || []).find(estNombre);
      const nombreBrut = (par.prixBrut || []).find(estNombre);
      const prix = parsePrice(nombreNet ?? nombreBrut);
      // Les titres de rubrique d'un devis (« COFFRET PAC MONO: »,
      // « PROTECTIONS ») n'ont pas de prix : ils tombent d'eux-mêmes.
      if (!designation || designation.length < 3 || !(prix > 0)) continue;

      // L'unité de vente vient de sa colonne — « 1000 Mètr ». La quantité
      // commandée ne s'y ajoute que si cette colonne n'a pas de nombre : sinon
      // on lisait « 0 1000 Mètr », la quantité du devis collée devant.
      const uniteBrute = par.unite || [];
      const unite = (
        uniteBrute.some(estNombre)
          ? uniteBrute
          : [...(par.quantite || []).filter(estNombre).slice(0, 1), ...uniteBrute]
      )
        .join(" ")
        .trim();

      resultats.push({
        name: designation,
        reference: reference.trim(),
        price: prix,
        ...(catalogue ? { catalogue } : {}),
        ...(unite ? { unit: unite } : {}),
      });
    }
  }

  return resultats;
}

const similarity = (source: RawLine, product: Product) => {
  const sourceText = normalize(`${source.name} ${source.reference}`);
  const targetText = normalize(
    `${product.name} ${product.offers.map((offer) => offer.reference).join(" ")}`,
  );
  if (sourceText === targetText || targetText.includes(sourceText)) return 1;
  const sourceTokens = sourceText
    .split(" ")
    .filter((item, index, all) => item.length > 1 && all.indexOf(item) === index);
  const targetTokens = targetText
    .split(" ")
    .filter((item, index, all) => item.length > 1 && all.indexOf(item) === index);
  const common = sourceTokens.filter((token) =>
    targetTokens.includes(token),
  ).length;
  return common / Math.max(sourceTokens.length, targetTokens.length, 1);
};

/**
 * Rapprochement d'une ligne de tarif avec le catalogue.
 *
 * La référence fournisseur d'abord : c'est la seule clé fiable. « BASIC
 * diam,25 gris ATF » chez YESSS ne ressemblera jamais à « Gaine ICT diamètre
 * 25 » chez nous, aucun réglage de similarité ne rattrapera cela. Le nom ne
 * sert que de suggestion, quand aucune référence n'est encore connue.
 *
 * Quand rien n'est sûr, on ne devine pas : on propose. Un mauvais
 * rattachement écrit un faux prix dans le catalogue, ce qui coûte plus cher
 * qu'un rattachement à faire à la main — et il ne se fait qu'une fois, la
 * référence étant mémorisée ensuite.
 */
const referencesDe = (line: RawLine) =>
  [line.reference, line.catalogue]
    .map((valeur) => normalize(valeur || ""))
    .filter((valeur) => valeur.length > 2);

const findProduct = (line: RawLine, catalog: Product[], supplier: string) => {
  const references = referencesDe(line);

  for (const reference of references) {
    const parReference = catalog.find((product) =>
      product.offers.some(
        (offer) =>
          offer.supplier === supplier &&
          offer.reference &&
          normalize(offer.reference) === reference,
      ),
    );
    if (parReference) {
      return { product: parReference, byReference: true, suggestions: [] as Product[] };
    }
  }

  const candidates = catalog
    .map((product) => ({ product, score: similarity(line, product) }))
    .sort((a, b) => b.score - a.score);
  if (candidates[0]?.score >= 0.42) {
    return { product: candidates[0].product, byReference: false, suggestions: [] as Product[] };
  }

  // La même référence chez un AUTRE fournisseur est un indice fort — c'est
  // souvent le numéro de catalogue du constructeur — mais pas une preuve :
  // deux fournisseurs peuvent réutiliser un code. Elle est proposée, jamais
  // appliquée seule.
  const ailleurs = catalog.filter((product) =>
    product.offers.some(
      (offer) => offer.reference && references.includes(normalize(offer.reference)),
    ),
  );
  const proches = candidates
    .filter((candidate) => candidate.score >= 0.22)
    .map((candidate) => candidate.product);
  const suggestions = [...ailleurs, ...proches]
    .filter((product, index, all) => all.findIndex((item) => item.id === product.id) === index)
    .slice(0, 3);

  return { product: undefined, byReference: false, suggestions };
};

/** Valeur du menu déroulant qui demande la création d'un produit. */
const CREER = "creer";

const supplierFamily = (supplier: string): Product["family"] =>
  supplier === "CLIM+"
    ? "Climatisation"
    : ["CEDEO", "AUBADE", "DAST SOLUTION"].includes(supplier)
      ? "Plomberie"
      : "Électricité";

/**
 * État d'une ligne face au catalogue : ancien prix, prix ramené au
 * conditionnement de ce fournisseur, et le statut qui en découle.
 *
 * La comparaison porte sur le prix CONVERTI : comparer 810,56 € le touret à
 * 81,06 € la couronne ferait croire à une hausse de 900 %.
 */
const evalueLigne = (
  line: RawLine,
  product: Product | undefined,
  supplier: string,
): Pick<ReviewLine, "oldPrice" | "conversion" | "status" | "prixMetre"> => {
  // Le prix au mètre se tire de l'unité de vente seule : il tient même quand
  // le produit n'est pas encore rattaché ou le conditionnement inconnu.
  const prixMetre = prixAuMetre(line.price, line.unit);
  if (!product) {
    return {
      oldPrice: 0,
      conversion: { etat: "indeterminee", prix: line.price, raison: "produit à rattacher" },
      status: "new",
      prixMetre,
    };
  }
  const offer = product.offers.find((item) => item.supplier === supplier);
  const oldPrice = effectivePrice(product.id, supplier, offer?.price || 0);
  const conversion = convertirPrix(line.price, line.unit, offer?.packaging);
  return {
    oldPrice,
    conversion,
    status: Math.abs(oldPrice - conversion.prix) < 0.01 ? "unchanged" : "changed",
    prixMetre,
  };
};

export function TariffImports({ onBack }: { onBack?: () => void } = {}) {
  const settings = usePurchasingSettings();
  const inputRef = useRef<HTMLInputElement>(null);
  const [supplier, setSupplier] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lines, setLines] = useState<ReviewLine[]>([]);
  const [filter, setFilter] = useState<"all" | ReviewLine["status"]>("all");
  const [history, setHistory] = useState<ImportHistoryItem[]>(() =>
    getImportHistory(),
  );
  const [priceHistory, setPriceHistory] = useState(() =>
    getManualPriceHistory(),
  );
  const [saved, setSaved] = useState(false);
  const liveCatalogProducts = useCatalogProducts();
  const catalogProducts = useMemo(
    () =>
      [...liveCatalogProducts].sort((a, b) =>
        a.name.localeCompare(b.name, "fr"),
      ),
    [liveCatalogProducts],
  );

  const counts = useMemo(
    () => ({
      changed: lines.filter((line) => line.status === "changed").length,
      new: lines.filter((line) => line.status === "new").length,
      unchanged: lines.filter((line) => line.status === "unchanged").length,
    }),
    [lines],
  );

  const analyseFile = async (file: File) => {
    setError("");
    setSaved(false);
    if (!supplier) {
      setError("Choisis d’abord le fournisseur du tarif.");
      return;
    }
    if (!/\.(xlsx?|pdf)$/i.test(file.name)) {
      setError("Format accepté : Excel (.xlsx, .xls) ou PDF.");
      return;
    }
    setBusy(true);
    setFileName(file.name);
    try {
      const raw = /\.pdf$/i.test(file.name)
        ? await readPdf(file)
        : await readExcel(file);
      if (!raw.length) {
        throw new Error("Aucune ligne produit avec un prix n’a été détectée.");
      }
      const uniqueRows = raw.filter(
        (line, index, all) =>
          all.findIndex(
            (candidate) =>
              normalize(`${candidate.reference} ${candidate.name}`) ===
              normalize(`${line.reference} ${line.name}`),
          ) === index,
      );
      const relues: ReviewLine[] = uniqueRows.map((line, index) => {
        const { product, suggestions } = findProduct(line, catalogProducts, supplier);
        const evalue = evalueLigne(line, product, supplier);
        return {
          ...line,
          id: `${index}-${line.reference}-${line.name}`,
          product,
          ...evalue,
          suggestions,
          // Une ligne qu'on n'a pas su rattacher n'est pas cochée.
          // Elle l'était, et le menu proposait par défaut « créer un nouveau
          // produit » : valider un devis fabriquait donc des dizaines de
          // produits « À renseigner » qu'il fallait ensuite compléter un par
          // un. Un import est là pour mettre à jour le prix des produits
          // qu'on achète, pas pour avaler le catalogue du fournisseur.
          selected: evalue.status === "changed",
        };
      });
      setLines(relues);
      // On ouvre sur ce qui compte : les prix qui bougent.
      setFilter(relues.some((line) => line.status === "changed") ? "changed" : "all");
    } catch (caught) {
      setLines([]);
      setError(
        caught instanceof Error
          ? caught.message
          : "Le fichier n’a pas pu être lu.",
      );
    } finally {
      setBusy(false);
    }
  };

  /**
   * Trois issues pour une ligne : la rattacher à un produit, en créer un, ou
   * l'ignorer. « Ignorer » et « créer » se ressemblent — aucun produit
   * rattaché — et ne se distinguent que par la case à cocher : c'est elle
   * qui dit si la ligne part à l'enregistrement.
   */
  const assignProduct = (lineId: string, productId: string) => {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== lineId) return line;
        if (productId === CREER) {
          return {
            ...line,
            product: undefined,
            ...evalueLigne(line, undefined, supplier),
            selected: true,
          };
        }
        const product = catalogProducts.find(
          (item) => item.id === Number(productId),
        );
        if (!product) {
          return {
            ...line,
            product: undefined,
            ...evalueLigne(line, undefined, supplier),
            selected: false,
          };
        }
        // Le conditionnement vient de l'offre du produit retenu : changer de
        // produit peut donc changer la conversion.
        return { ...line, product, ...evalueLigne(line, product, supplier), selected: true };
      }),
    );
  };

  const validateImport = () => {
    const selected = lines.filter((line) => line.selected);
    const overrides: PriceOverride = {};
    // Les prix au mètre voyagent à part : ils n'ont de sens que pour ce qui se
    // vend à la longueur, et ils ne remplacent jamais le prix.
    const meterPrices: PriceOverride = {};
    const newProducts: Product[] = [];
    const priceChanges: ManualPriceChange[] = [];
    // Références fournisseur à mémoriser : c'est ce qui rend les imports
    // suivants automatiques. Sans cela, il faudrait refaire les mêmes
    // associations à chaque tarif reçu.
    //
    // Elles partent avec les prix, dans le même enregistrement. Elles étaient
    // envoyées juste après, sous la forme du produit entier tel qu'il était
    // AVANT l'import : le second appel reposait donc l'ancien prix par-dessus
    // le nouveau, et le tarif ne s'appliquait qu'à moitié.
    const referencesApprises: ReferenceApprise[] = [];

    selected.forEach((line, index) => {
      if (line.product) {
        // Le prix ramené au conditionnement de ce fournisseur, jamais le prix
        // brut du tarif : c'est lui qui multipliera les quantités commandées.
        overrides[priceKey(line.product.id, supplier)] = line.conversion.prix;
        if (line.prixMetre !== null) {
          meterPrices[priceKey(line.product.id, supplier)] = line.prixMetre;
        }
        const offreConnue = line.product.offers.find((offer) => offer.supplier === supplier);
        const referenceInconnue =
          line.reference &&
          normalize(offreConnue?.reference || "") !== normalize(line.reference);
        if (referenceInconnue) {
          referencesApprises.push({
            productId: line.product.id,
            supplier,
            reference: line.reference,
            supplierName: line.name,
          });
        }
        if (line.oldPrice !== line.conversion.prix) {
          priceChanges.push({
            product: line.product.name,
            supplier,
            oldPrice: line.oldPrice,
            newPrice: line.conversion.prix,
            scope: "Produit",
          });
        }
        return;
      }
      newProducts.push({
        id: Date.now() + index,
        name: line.name,
        family: supplierFamily(supplier),
        subfamily: "À classer",
        unit: "Pièce",
        kind: "simple",
        offers: [
          {
            supplier,
            supplierName: line.name,
            reference: line.reference || "À renseigner",
            brand: "À renseigner",
            price: line.price,
            ...(line.prixMetre !== null ? { meterPrice: line.prixMetre } : {}),
            // Le conditionnement est celui de l'unité de vente du tarif : le
            // prix est celui-là, et les deux doivent se correspondre, sans
            // quoi la première commande multiplierait un prix de 100 pièces
            // par un nombre de pièces.
            packaging: line.unit || "À renseigner",
            packagingType: "fixed",
          },
        ],
      });
      priceChanges.push({
        product: line.name,
        supplier,
        oldPrice: 0,
        newPrice: line.price,
        scope: "Produit",
      });
    });
    const item: ImportHistoryItem = {
      id: crypto.randomUUID(),
      date: new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date()),
      fileName,
      supplier,
      changed: selected.filter((line) => line.status === "changed").length,
      added: selected.filter((line) => line.status === "new").length,
      ignored: lines.length - selected.length,
    };
    // Un seul enregistrement : prix, produits inconnus et références apprises.
    // Au prochain tarif de ce fournisseur, ces lignes seront reconnues seules.
    saveTariffImport({
      overrides,
      meterPrices,
      newProducts,
      history: item,
      changes: priceChanges,
      references: referencesApprises,
    });
    setHistory(getImportHistory());
    setPriceHistory(getManualPriceHistory());
    setSaved(true);
  };

  // --- Références fournisseur par tableur ------------------------------
  // Rattacher un devis ligne par ligne ne se fait qu'une fois par produit et
  // par fournisseur, mais cette fois-là coûte une cinquantaine de recherches
  // dans un menu déroulant. Le même travail se fait d'un coup d'œil dans un
  // tableur, puis revient ici en un fichier.
  const nomsFournisseurs = settings.suppliers.map((contact) => contact.name);
  const [refNom, setRefNom] = useState("");
  const [refLu, setRefLu] = useState<ChangementsReferences | null>(null);
  const [refErreur, setRefErreur] = useState("");
  const [refEnregistre, setRefEnregistre] = useState(false);
  const refInputRef = useRef<HTMLInputElement>(null);

  const exporterReferences = () => {
    telechargerCsv(
      nomCsv("references-fournisseurs"),
      lignesReferences(catalogProducts, nomsFournisseurs),
    );
  };

  const lireFichierReferences = async (file: File) => {
    setRefErreur("");
    setRefEnregistre(false);
    setRefLu(null);
    if (!/\.csv$/i.test(file.name)) {
      setRefErreur("Format attendu : le fichier CSV exporté depuis cet écran.");
      return;
    }
    setRefNom(file.name);
    try {
      const lu = lireReferences(await file.text(), catalogProducts, nomsFournisseurs);
      setRefLu(lu);
      if (!lu.references.length && !Object.keys(lu.overrides).length) {
        setRefErreur("Rien n'a changé par rapport au catalogue.");
      }
    } catch {
      setRefErreur("Le fichier n’a pas pu être lu.");
    }
  };

  const validerReferences = () => {
    if (!refLu) return;
    const changements: ManualPriceChange[] = Object.entries(refLu.overrides).map(
      ([cle, prix]) => {
        const [identifiant, fournisseur] = cle.split("|||");
        const produit = catalogProducts.find((item) => item.id === Number(identifiant));
        const offre = produit?.offers.find((item) => item.supplier === fournisseur);
        return {
          product: produit?.name || identifiant,
          supplier: fournisseur,
          oldPrice: offre?.price || 0,
          newPrice: prix,
          scope: "Produit" as const,
        };
      },
    );
    saveTariffImport({
      overrides: refLu.overrides,
      newProducts: [],
      history: {
        id: crypto.randomUUID(),
        date: new Intl.DateTimeFormat("fr-FR", {
          dateStyle: "short",
          timeStyle: "short",
        }).format(new Date()),
        fileName: refNom,
        supplier: "Références (tableur)",
        changed: changements.length,
        added: 0,
        ignored: refLu.inconnus.length,
      },
      changes: changements,
      references: refLu.references,
    });
    setHistory(getImportHistory());
    setPriceHistory(getManualPriceHistory());
    setRefLu(null);
    setRefEnregistre(true);
  };

  const visibleLines = lines.filter(
    (line) => filter === "all" || line.status === filter,
  );

  // Ce que la validation va faire, dit en clair : l'écran annonçait seulement
  // « cochez les lignes à appliquer », sans jamais dire ce qui partait.
  const aAppliquer = lines.filter((line) => line.selected && line.product).length;
  const aCreer = lines.filter((line) => line.selected && !line.product).length;
  const ignorees = lines.length - aAppliquer - aCreer;
  const converties = lines.filter(
    (line) => line.selected && line.conversion.etat === "convertie",
  ).length;
  const aVerifier = lines.filter(
    (line) =>
      line.selected && line.product && line.conversion.etat === "indeterminee",
  ).length;

  return (
    <div className="screen tariff-screen">
      <div className="page-title standard">
        <div>
          {onBack && (
            <button className="back-link" onClick={onBack}>
              <ArrowLeft size={16} /> Rubriques
            </button>
          )}
          <span className="eyebrow">MISE À JOUR FOURNISSEURS</span>
          <h1>Import tarifs</h1>
          <p>
            Importez un Excel ou un PDF, puis validez uniquement les changements
            utiles.
          </p>
        </div>
      </div>

      <div className="import-top-grid">
        <section className="panel import-panel">
          <div className="import-panel-title">
            <span className="settings-icon">
              <UploadCloud />
            </span>
            <div>
              <h2>Nouveau tarif</h2>
              <p>Le fichier original restera visible dans l’historique.</p>
            </div>
          </div>
          <label className="supplier-field">
            Fournisseur
            <select
              value={supplier}
              onChange={(event) => setSupplier(event.target.value)}
            >
              <option value="">Choisir un fournisseur</option>
              {settings.suppliers.map(({ name }) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </label>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.pdf"
            hidden
            onChange={(event) =>
              event.target.files?.[0] && analyseFile(event.target.files[0])
            }
          />
          <button
            className="drop-zone"
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (event.dataTransfer.files[0])
                analyseFile(event.dataTransfer.files[0]);
            }}
          >
            {busy ? <LoaderCircle className="spin" /> : <UploadCloud />}
            <strong>
              {busy ? "Analyse en cours…" : "Déposer le tarif ici"}
            </strong>
            <span>ou toucher pour choisir un fichier · Excel ou PDF</span>
          </button>
          {error && (
            <div className="import-error">
              <AlertTriangle />
              {error}
            </div>
          )}
        </section>

        <section className="panel import-summary">
          <div className="panel-head">
            <div>
              <h2>Résultat du contrôle</h2>
              <p>{fileName || "En attente d’un fichier"}</p>
            </div>
          </div>
          <div className="import-kpis">
            <div className="changed">
              <ArrowUp />
              <strong>{counts.changed}</strong>
              <span>Prix modifiés</span>
            </div>
            <div className="new">
              <PackagePlus />
              <strong>{counts.new}</strong>
              <span>Non rattachés</span>
            </div>
            <div className="same">
              <CheckCircle2 />
              <strong>{counts.unchanged}</strong>
              <span>Prix identiques</span>
            </div>
          </div>
          <div className="control-list">
            <span>
              <Check /> Concordance produit et référence
            </span>
            <span>
              <Check /> Comparaison ancien / nouveau prix
            </span>
            <span>
              <Check /> Aucun produit créé sans votre accord
            </span>
          </div>
        </section>
      </div>

      {/* Rattacher un devis se fait une fois par produit et par fournisseur.
          Autant le faire d'un coup d'œil dans un tableur, et ne plus jamais
          y revenir : les devis suivants se reconnaissent à la référence. */}
      <section className="panel references-panel">
        <div className="panel-head">
          <div>
            <h2>Références fournisseur par tableur</h2>
            <p>
              Exportez vos produits, remplissez les références du fournisseur
              dans un tableur, rendez le fichier. Les devis suivants se
              rattacheront tout seuls.
            </p>
          </div>
          <div className="settings-actions">
            <button className="secondary-btn" onClick={exporterReferences}>
              <Table2 size={17} /> Exporter le catalogue
            </button>
            <button
              className="primary-btn"
              onClick={() => refInputRef.current?.click()}
            >
              <UploadCloud size={17} /> Rendre le fichier
            </button>
          </div>
        </div>
        <input
          ref={refInputRef}
          type="file"
          accept=".csv"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void lireFichierReferences(file);
            event.target.value = "";
          }}
        />
        {refErreur && (
          <div className="import-error">
            <AlertTriangle />
            {refErreur}
          </div>
        )}
        {refEnregistre && (
          <div className="import-success">
            <CheckCircle2 />
            Références enregistrées. Le prochain devis de ce fournisseur sera
            reconnu sans intervention.
          </div>
        )}
        {refLu && (
          <div className="references-bilan">
            <p>
              <strong>{refNom}</strong> — {refLu.references.length} référence
              {refLu.references.length > 1 ? "s" : ""} à apprendre,{" "}
              {Object.keys(refLu.overrides).length} prix à mettre à jour.
              {refLu.inconnus.length > 0 && (
                <>
                  {" "}
                  {refLu.inconnus.length} ligne
                  {refLu.inconnus.length > 1 ? "s" : ""} dont l’identifiant est
                  inconnu, ignorée{refLu.inconnus.length > 1 ? "s" : ""}.
                </>
              )}
              {refLu.colonnesIgnorees.length > 0 && (
                <>
                  {" "}
                  Colonnes non reconnues : {refLu.colonnesIgnorees.join(", ")}.
                </>
              )}
            </p>
            <div className="settings-actions">
              <button className="secondary-btn" onClick={() => setRefLu(null)}>
                Annuler
              </button>
              <button className="primary-btn" onClick={validerReferences}>
                <Check size={17} /> Appliquer au catalogue
              </button>
            </div>
          </div>
        )}
      </section>

      {lines.length > 0 && (
        <section className="panel import-review">
          <div className="review-toolbar">
            <div>
              <h2>Vérification avant validation</h2>
              <p>
                {aAppliquer} prix mis à jour
                {aCreer > 0 ? ` · ${aCreer} produit${aCreer > 1 ? "s" : ""} créé${aCreer > 1 ? "s" : ""}` : ""}
                {ignorees > 0 ? ` · ${ignorees} ligne${ignorees > 1 ? "s" : ""} ignorée${ignorees > 1 ? "s" : ""}` : ""}
                . Une ligne non rattachée est ignorée tant qu’on ne lui
                désigne pas de produit.
                {converties > 0 &&
                  ` ${converties} prix ramené${converties > 1 ? "s" : ""} au conditionnement du fournisseur.`}
                {aVerifier > 0 &&
                  ` ${aVerifier} à vérifier : le conditionnement de ce fournisseur n’est pas renseigné.`}
              </p>
            </div>
            <div className="review-filters">
              {(["all", "changed", "new", "unchanged"] as const).map(
                (value) => (
                  <button
                    key={value}
                    className={filter === value ? "active" : ""}
                    onClick={() => setFilter(value)}
                  >
                    {value === "all"
                      ? "Tout"
                      : value === "changed"
                        ? "Prix modifiés"
                        : value === "new"
                          ? "Non rattachés"
                          : "Identiques"}
                  </button>
                ),
              )}
            </div>
          </div>
          <div className="import-table">
            <div className="import-table-head">
              <span />
              <span>Produit du fichier</span>
              <span>Concordance catalogue</span>
              <span>Ancien prix</span>
              <span>Nouveau prix</span>
              <span>Écart</span>
            </div>
            {visibleLines.map((line) => {
              // L'écart se mesure sur le prix converti : comparer le touret
              // à la couronne annoncerait une hausse de 900 %.
              const delta = line.oldPrice
                ? ((line.conversion.prix - line.oldPrice) / line.oldPrice) * 100
                : 0;
              return (
                <div className="import-line" key={line.id}>
                  <input
                    type="checkbox"
                    aria-label={`Sélectionner ${line.name}`}
                    checked={line.selected}
                    onChange={() =>
                      setLines((current) =>
                        current.map((item) =>
                          item.id === line.id
                            ? { ...item, selected: !item.selected }
                            : item,
                        ),
                      )
                    }
                  />
                  <span data-label="Produit">
                    <strong>{line.name}</strong>
                    <small>
                      {line.reference || "Sans référence"}
                      {/* Unité de vente du fournisseur : « 100 Mètr » signifie
                          que le prix porte sur 100 mètres, pas sur un mètre. */}
                      {line.unit ? ` · vendu par ${line.unit}` : ""}
                    </small>
                  </span>
                  <span data-label="Concordance">
                    <i className={`match-status ${line.status}`}>
                      {line.product
                        ? line.status === "changed"
                          ? "Produit reconnu"
                          : "Prix identique"
                        : line.selected
                          ? "Sera créé"
                          : "Non rattaché"}
                    </i>
                    {/* Chercher dans soixante-quinze produits pour chaque
                        ligne prenait un temps fou : on propose les trois plus
                        probables, rattachables d'un clic. */}
                    {!line.product && line.suggestions.length > 0 && (
                      <span className="match-suggestions">
                        <small>Serait-ce&nbsp;:</small>
                        {line.suggestions.map((product) => (
                          <button
                            key={product.id}
                            onClick={() => assignProduct(line.id, String(product.id))}
                          >
                            {product.name}
                          </button>
                        ))}
                      </span>
                    )}
                    <select
                      className="product-match-select"
                      aria-label={`Associer ${line.name} à un produit`}
                      value={line.product?.id ?? (line.selected ? CREER : "")}
                      onChange={(event) =>
                        assignProduct(line.id, event.target.value)
                      }
                    >
                      <option value="">Ignorer cette ligne</option>
                      <option value={CREER}>Créer un nouveau produit</option>
                      {catalogProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.family} · {product.name}
                        </option>
                      ))}
                    </select>
                  </span>
                  <span data-label="Ancien prix">
                    {line.oldPrice ? money(line.oldPrice) : "—"}
                  </span>
                  <span data-label="Nouveau prix">
                    <strong>{money(line.conversion.prix)}</strong>
                    {line.prixMetre !== null && (
                      <small className="prix-metre">
                        {line.prixMetre.toFixed(2).replace(".", ",")} €/m
                      </small>
                    )}
                    {line.conversion.etat === "convertie" && (
                      <small className="conversion-faite">
                        {money(line.price)} pour {line.conversion.depuis} →{" "}
                        {line.conversion.vers}
                      </small>
                    )}
                    {line.conversion.etat === "indeterminee" && line.product && (
                      <small className="conversion-douteuse">
                        Prix repris tel quel — {line.conversion.raison}
                      </small>
                    )}
                  </span>
                  <span
                    data-label="Écart"
                    className={delta > 0 ? "delta-up" : "delta-down"}
                  >
                    {line.status === "changed" ? (
                      <>
                        {delta > 0 ? <ArrowUp /> : <ArrowDown />}
                        {Math.abs(delta).toFixed(1)} %
                      </>
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="review-footer">
            <span>
              {lines.filter((line) => line.selected).length} ligne(s)
              sélectionnée(s)
            </span>
            <button
              className="primary-btn"
              onClick={validateImport}
              disabled={!lines.some((line) => line.selected)}
            >
              <Check />
              Valider l’import
            </button>
          </div>
          {saved && (
            <div className="import-success">
              <CheckCircle2 />
              Tarifs enregistrés et historique mis à jour.
            </div>
          )}
        </section>
      )}

      <section className="panel import-history">
        <div className="panel-head">
          <div>
            <h2>Historique des imports</h2>
            <p>Retrouvez chaque fichier et les modifications appliquées.</p>
          </div>
          <FileClock />
        </div>
        {history.length ? (
          history.map((item) => (
            <article key={item.id}>
              <span className="history-file">
                {item.fileName.toLowerCase().endsWith(".pdf") ? (
                  <FileText />
                ) : (
                  <FileSpreadsheet />
                )}
              </span>
              <span>
                <strong>{item.fileName}</strong>
                <small>
                  {item.supplier} · {item.date}
                </small>
              </span>
              <span>
                <b>{item.changed}</b>
                <small>prix modifiés</small>
              </span>
              <span>
                <b>{item.added}</b>
                <small>ajouts</small>
              </span>
              <span>
                <b>{item.ignored}</b>
                <small>ignorés</small>
              </span>
            </article>
          ))
        ) : (
          <div className="empty-history">
            <FileClock />
            <strong>Aucun import pour le moment</strong>
            <span>Votre premier fichier apparaîtra ici après validation.</span>
          </div>
        )}
      </section>
      <section className="panel manual-price-history">
        <div className="panel-head">
          <div>
            <h2>Historique complet des prix</h2>
            <p>Modifications manuelles et imports, avec ancien et nouveau prix.</p>
          </div>
          <FileClock />
        </div>
        {priceHistory.length ? (
          priceHistory.map((item) => (
            <details key={item.id}>
              <summary>
                <span>
                  <strong>{item.date}</strong>
                  <small>{item.source || "Manuel"}</small>
                </span>
                <b>{item.changes.length} modification(s)</b>
              </summary>
              <div>
                {item.changes.map((change, index) => (
                  <span key={`${change.product}-${change.supplier}-${index}`}>
                    <span>
                      <strong>{change.product}</strong>
                      <small>{change.supplier} · {change.scope}</small>
                    </span>
                    <b>{money(change.oldPrice)} → {money(change.newPrice)}</b>
                  </span>
                ))}
              </div>
            </details>
          ))
        ) : (
          <div className="empty-history">Aucune évolution de prix enregistrée.</div>
        )}
      </section>
    </div>
  );
}
