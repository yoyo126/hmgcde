
import { useMemo, useRef, useState } from "react";
import {
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
  UploadCloud,
} from "lucide-react";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.js?url";
import { money, type Product } from "@/lib/crm-data";
import {
  effectivePrice,
  getImportHistory,
  getManualPriceHistory,
  priceKey,
  saveCatalogProducts,
  saveTariffImport,
  type ImportHistoryItem,
  type ManualPriceChange,
  type PriceOverride,
} from "@/lib/tariff-storage";
import { useCatalogProducts } from "@/lib/use-catalog-products";
import { usePurchasingSettings } from "@/lib/use-purchasing-settings";

type RawLine = {
  name: string;
  reference: string;
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

const estElementTexte = (item: unknown): item is ElementTexte =>
  typeof item === "object" &&
  item !== null &&
  "str" in item &&
  "transform" in item &&
  Array.isArray((item as ElementTexte).transform);

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

const EN_TETES = {
  quantite: ["qte", "qté", "quantite", "quantité"],
  reference: ["article", "reference", "référence", "ref", "code"],
  designation: ["designation", "désignation", "libelle", "libellé", "produit"],
  prixNet: ["prix net", "prixnet", "net", "prix unitaire", "pu ht", "p.u."],
  prixBrut: ["prix brut", "prixbrut", "brut", "tarif"],
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
    const fragments = contenu.items
      .filter(estElementTexte)
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
      const nombreNet = (par.prixNet || []).find(estNombre);
      const nombreBrut = (par.prixBrut || []).find(estNombre);
      const prix = parsePrice(nombreNet ?? nombreBrut);
      if (!designation || designation.length < 3 || !(prix > 0)) continue;

      const unite = [...(par.quantite || []).filter(estNombre).slice(0, 1), ...(par.unite || [])]
        .join(" ")
        .trim();

      resultats.push({
        name: designation,
        reference: reference.trim(),
        price: prix,
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
 */
const findProduct = (line: RawLine, catalog: Product[], supplier: string) => {
  const reference = normalize(line.reference);
  if (reference) {
    const parReference = catalog.find((product) =>
      product.offers.some(
        (offer) =>
          offer.supplier === supplier &&
          offer.reference &&
          normalize(offer.reference) === reference,
      ),
    );
    if (parReference) return { product: parReference, byReference: true };
  }
  const candidates = catalog
    .map((product) => ({ product, score: similarity(line, product) }))
    .sort((a, b) => b.score - a.score);
  return candidates[0]?.score >= 0.42
    ? { product: candidates[0].product, byReference: false }
    : { product: undefined, byReference: false };
};

const supplierFamily = (supplier: string): Product["family"] =>
  supplier === "CLIM+"
    ? "Climatisation"
    : ["CEDEO", "AUBADE", "DAST SOLUTION"].includes(supplier)
      ? "Plomberie"
      : "Électricité";

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
      setLines(
        uniqueRows.map((line, index) => {
          const { product } = findProduct(line, catalogProducts, supplier);
          const offer = product?.offers.find(
            (item) => item.supplier === supplier,
          );
          const oldPrice = product
            ? effectivePrice(product.id, supplier, offer?.price || 0)
            : 0;
          const status = !product
            ? "new"
            : Math.abs(oldPrice - line.price) < 0.01
              ? "unchanged"
              : "changed";
          return {
            ...line,
            id: `${index}-${line.reference}-${line.name}`,
            product,
            oldPrice,
            status,
            selected: status !== "unchanged",
          };
        }),
      );
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

  const assignProduct = (lineId: string, productId: string) => {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== lineId) return line;
        const product = catalogProducts.find(
          (item) => item.id === Number(productId),
        );
        if (!product) {
          return { ...line, product: undefined, oldPrice: 0, status: "new" };
        }
        const offer = product.offers.find((item) => item.supplier === supplier);
        const oldPrice = effectivePrice(product.id, supplier, offer?.price || 0);
        return {
          ...line,
          product,
          oldPrice,
          status:
            Math.abs(oldPrice - line.price) < 0.01 ? "unchanged" : "changed",
          selected: true,
        };
      }),
    );
  };

  const validateImport = () => {
    const selected = lines.filter((line) => line.selected);
    const overrides: PriceOverride = {};
    const newProducts: Product[] = [];
    const priceChanges: ManualPriceChange[] = [];
    // Produits dont il faut mémoriser la référence fournisseur : c'est ce qui
    // rend les imports suivants automatiques. Sans cela, il faudrait refaire
    // les mêmes associations à chaque tarif reçu.
    const referencesApprises: Product[] = [];

    selected.forEach((line, index) => {
      if (line.product) {
        overrides[priceKey(line.product.id, supplier)] = line.price;
        const offreConnue = line.product.offers.find((offer) => offer.supplier === supplier);
        const referenceInconnue =
          line.reference &&
          normalize(offreConnue?.reference || "") !== normalize(line.reference);
        if (referenceInconnue) {
          referencesApprises.push({
            ...line.product,
            offers: line.product.offers.map((offer) =>
              offer.supplier === supplier
                ? { ...offer, reference: line.reference, supplierName: line.name }
                : offer,
            ),
          });
        }
        if (line.oldPrice !== line.price) {
          priceChanges.push({
            product: line.product.name,
            supplier,
            oldPrice: line.oldPrice,
            newPrice: line.price,
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
            packaging: "À renseigner",
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
    saveTariffImport({ overrides, newProducts, history: item, changes: priceChanges });
    // Les références apprises rejoignent le catalogue : au prochain tarif de
    // ce fournisseur, ces lignes seront reconnues toutes seules.
    if (referencesApprises.length) {
      saveCatalogProducts(referencesApprises);
    }
    setHistory(getImportHistory());
    setPriceHistory(getManualPriceHistory());
    setSaved(true);
  };

  const visibleLines = lines.filter(
    (line) => filter === "all" || line.status === filter,
  );

  return (
    <div className="screen tariff-screen">
      <div className="page-title standard">
        <div>
          {onBack && (
            <button className="back-link" onClick={onBack}>← Paramètres</button>
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
              <span>Nouveaux produits</span>
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
              <Check /> Aucun doublon ajouté automatiquement
            </span>
          </div>
        </section>
      </div>

      {lines.length > 0 && (
        <section className="panel import-review">
          <div className="review-toolbar">
            <div>
              <h2>Vérification avant validation</h2>
              <p>Cochez uniquement les lignes à appliquer au catalogue.</p>
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
                          ? "Nouveaux"
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
              const delta = line.oldPrice
                ? ((line.price - line.oldPrice) / line.oldPrice) * 100
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
                      {line.status === "new"
                        ? "Nouveau produit"
                        : line.status === "changed"
                          ? "Produit reconnu"
                          : "Prix identique"}
                    </i>
                    <select
                      className="product-match-select"
                      aria-label={`Associer ${line.name} à un produit`}
                      value={line.product?.id ?? ""}
                      onChange={(event) =>
                        assignProduct(line.id, event.target.value)
                      }
                    >
                      <option value="">Créer un nouveau produit</option>
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
                    <strong>{money(line.price)}</strong>
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
