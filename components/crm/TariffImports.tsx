"use client";

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
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";
import { money, products, supplierNames, type Product } from "@/lib/crm-data";
import {
  effectivePrice,
  getImportHistory,
  getImportedProducts,
  priceKey,
  saveTariffImport,
  type ImportHistoryItem,
  type PriceOverride,
} from "@/lib/tariff-storage";

type RawLine = { name: string; reference: string; price: number };
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

async function readPdf(file: File): Promise<RawLine[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const document = await pdfjs.getDocument({ data: await readFileAsArrayBuffer(file) })
    .promise;
  const lines: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const byLine = new Map<number, { x: number; text: string }[]>();
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5] / 3) * 3;
      const entries = byLine.get(y) ?? [];
      entries.push({ x: item.transform[4], text: item.str.trim() });
      byLine.set(y, entries);
    }
    [...byLine.entries()]
      .sort((a, b) => b[0] - a[0])
      .forEach(([, entries]) =>
        lines.push(
          entries
            .sort((a, b) => a.x - b.x)
            .map((item) => item.text)
            .join(" "),
        ),
      );
  }
  return lines.flatMap((line) => {
    const priceMatch = line.match(/(\d{1,5}(?:[\s.]\d{3})*[,.]\d{2})\s*€?\s*$/);
    if (!priceMatch) return [];
    const price = parsePrice(priceMatch[1]);
    const beforePrice = line.slice(0, priceMatch.index).trim();
    const referenceMatch = beforePrice.match(
      /^([A-Z0-9][A-Z0-9./_-]{2,})\s+(.+)/i,
    );
    const name = (referenceMatch?.[2] || beforePrice).trim();
    return name.length > 3 && price > 0
      ? [{ name, reference: referenceMatch?.[1] || "", price }]
      : [];
  });
}

const similarity = (source: RawLine, product: Product) => {
  const sourceText = normalize(`${source.name} ${source.reference}`);
  const targetText = normalize(
    `${product.name} ${product.offers.map((offer) => offer.reference).join(" ")}`,
  );
  if (sourceText === targetText || targetText.includes(sourceText)) return 1;
  const sourceTokens = new Set(
    sourceText.split(" ").filter((item) => item.length > 1),
  );
  const targetTokens = new Set(
    targetText.split(" ").filter((item) => item.length > 1),
  );
  const common = [...sourceTokens].filter((token) =>
    targetTokens.has(token),
  ).length;
  return common / Math.max(sourceTokens.size, targetTokens.size, 1);
};

const findProduct = (line: RawLine, catalog: Product[]) => {
  const candidates = catalog
    .map((product) => ({ product, score: similarity(line, product) }))
    .sort((a, b) => b.score - a.score);
  return candidates[0]?.score >= 0.42 ? candidates[0].product : undefined;
};

const supplierFamily = (supplier: string): Product["family"] =>
  supplier === "CLIM+"
    ? "Climatisation"
    : ["CEDEO", "AUBADE", "DAST SOLUTION"].includes(supplier)
      ? "Plomberie"
      : "Électricité";

export function TariffImports() {
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
  const [saved, setSaved] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>(() =>
    [...products, ...getImportedProducts()].sort((a, b) =>
      a.name.localeCompare(b.name, "fr"),
    ),
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
      const uniqueRows = [
        ...new Map(
          raw.map((line) => [
            normalize(`${line.reference} ${line.name}`),
            line,
          ]),
        ).values(),
      ];
      setLines(
        uniqueRows.map((line, index) => {
          const product = findProduct(line, catalogProducts);
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
    selected.forEach((line, index) => {
      if (line.product) {
        overrides[priceKey(line.product.id, supplier)] = line.price;
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
    saveTariffImport({ overrides, newProducts, history: item });
    if (newProducts.length) {
      setCatalogProducts((current) =>
        [...current, ...newProducts].sort((a, b) =>
          a.name.localeCompare(b.name, "fr"),
        ),
      );
    }
    setHistory(getImportHistory());
    setSaved(true);
  };

  const visibleLines = lines.filter(
    (line) => filter === "all" || line.status === filter,
  );

  return (
    <div className="screen tariff-screen">
      <div className="page-title standard">
        <div>
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
              {supplierNames.map((name) => (
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
                    <small>{line.reference || "Sans référence"}</small>
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
    </div>
  );
}
