import { useEffect, useState } from "react";
import {
  Box,
  ChevronDown,
  ChevronRight,
  FileText,
  FileUp,
  History,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Truck,
  Users,
  X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { IS_DEMO } from "@/lib/demo-mode";
import type { AppUser } from "@/lib/types";
import {
  companies,
  componentPrice,
  money,
  productFamiliesFrom,
  productSection,
  type Product,
} from "@/lib/crm-data";
import {
  componentPriceKey,
  effectiveComponentPrice,
  effectivePrice,
  deleteCatalogProducts,
  getCatalogProducts,
  getManualPriceHistory,
  getPriceOverrides,
  priceKey,
  saveCatalogProducts,
  saveManualPriceChanges,
  type ManualPriceChange,
} from "@/lib/tariff-storage";
import {
  createMailPreview,
  copyOrderEmail,
  getStoredOrders,
  mailtoUrl,
  saveOrder,
  type StoredOrder,
} from "@/lib/order-storage";
import {
  getPurchasingSettings,
  savePurchasingSettings,
  type PurchasingSettings,
} from "@/lib/settings-storage";
import type { ScreenId } from "./Sidebar";
import { useCatalogProducts } from "@/lib/use-catalog-products";
import { usePurchasingSettings } from "@/lib/use-purchasing-settings";
import { CRM_VERSION, CRM_VERSION_HISTORY } from "@/lib/version";
export function OrdersScreen({
  onNavigate,
  initialOpenOrder,
}: {
  onNavigate: (id: ScreenId) => void;
  initialOpenOrder?: string | null;
}) {
  const [query, setQuery] = useState(""),
    [openOrder, setOpenOrder] = useState<string | null>(initialOpenOrder || null),
    [orders, setOrders] = useState<StoredOrder[]>(() => getStoredOrders());
  const orderCatalog = useCatalogProducts();
  const filteredOrders = orders.filter((order) =>
    `${order.id} ${order.supplier} ${order.status}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const openMail = async (order: StoredOrder) => {
    const email = createMailPreview(order);
    saveOrder({ ...order, email, status: "Envoyée" });
    setOrders(getStoredOrders());
    const copied = await copyOrderEmail({ ...order, email, status: "Envoyée" });
    if (!copied) {
      window.alert("Le tableau n’a pas pu être copié. Réessaie depuis Safari ou Chrome.");
      return;
    }
    window.open(mailtoUrl(email, false), "_self");
  };
  const printOrder = (withoutPrices: boolean) => {
    if (withoutPrices) document.body.classList.add("print-without-prices");
    const cleanup = () => {
      document.body.classList.remove("print-without-prices");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    window.setTimeout(cleanup, 60000);
  };
  return (
    <div className="screen">
      <div className="page-title standard">
        <div>
          <span className="eyebrow">SUIVI</span>
          <h1>Commandes</h1>
          <p>Consultez les commandes, leur contenu et les e-mails envoyés.</p>
        </div>
        <button className="primary-btn" onClick={() => onNavigate("new-order")}>
          <Plus size={18} />
          Nouvelle commande
        </button>
      </div>
      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={18} />
            <input
              placeholder="Rechercher une commande…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <button className="filter-btn">
            <SlidersHorizontal size={17} />
            Filtres
          </button>
        </div>
        <div className="data-table">
          <div className="table-head">
            <span>Commande</span>
            <span>Fournisseur</span>
            <span>Date</span>
            <span>Produits</span>
            <span>Total HT</span>
            <span>Statut</span>
            <span />
          </div>
          {filteredOrders.map((o) => (
            <div
              className={`order-record ${openOrder === o.id ? "open" : ""}`}
              key={o.id}
            >
              <button
                className="table-row order-row-button"
                onClick={() => setOpenOrder(openOrder === o.id ? null : o.id)}
              >
                <span>
                  <FileText size={17} />
                  <span className="order-reference-cell">
                    <strong>{o.reference}</strong>
                    <small>{o.id}</small>
                  </span>
                </span>
                <span>{o.supplier}</span>
                <span>{o.date}</span>
                <span>{o.lines.length}</span>
                <span>
                  <strong>{money(o.total)}</strong>
                </span>
                <span>
                  <i
                    className={
                      "status " +
                      (o.status === "Reçue"
                        ? "received"
                        : o.status === "Envoyée"
                          ? "sent"
                          : "draft")
                    }
                  >
                    {o.status}
                  </i>
                </span>
                {openOrder === o.id ? (
                  <ChevronDown size={18} />
                ) : (
                  <ChevronRight size={18} />
                )}
              </button>
              {openOrder === o.id && (
                <div className="order-detail-panel">
                  <div className="order-detail-head">
                    <div>
                      <span>COMMANDE FOURNISSEUR</span>
                      <h2>{o.reference}</h2>
                      <small>{o.id}</small>
                      {o.sourceRequestId && (
                        <small>Issue de la demande {o.sourceRequestId}</small>
                      )}
                    </div>
                    <div className="order-detail-actions">
                      <i
                        className={
                          "status " +
                          (o.status === "Reçue"
                            ? "received"
                            : o.status === "Envoyée"
                              ? "sent"
                              : "draft")
                        }
                      >
                        {o.status}
                      </i>
                      <button
                        className="secondary-btn"
                        onClick={() => printOrder(false)}
                      >
                        <Printer size={16} /> PDF avec prix
                      </button>
                      <button
                        className="secondary-btn"
                        onClick={() => printOrder(true)}
                      >
                        <Printer size={16} /> PDF sans prix
                      </button>
                      <button className="primary-btn" onClick={() => openMail(o)}>
                        <Mail size={16} />
                        {o.email ? "Recopier et rouvrir Mail" : "Copier le tableau et ouvrir Mail"}
                      </button>
                    </div>
                  </div>
                  <div className="order-lines-view">
                    <div className="order-lines-head">
                      <span>Produit</span>
                      <span>Conditionnement</span>
                      <span>Quantité</span>
                      <span className="price-column">Prix HT</span>
                      <span className="price-column">Total HT</span>
                    </div>
                    {o.lines.map((line) => {
                      const components =
                        line.components ||
                        orderCatalog.find(
                          (product) => product.id === line.productId,
                        )?.contents;
                      return (
                        <div className="order-line-view" key={line.productId}>
                          <strong>
                            {line.name}
                            {components?.length ? (
                              <span className="saved-order-components">
                                {components.map((item) => (
                                  <small key={item.name}>
                                    {item.quantity} × {item.name}
                                  </small>
                                ))}
                              </span>
                            ) : null}
                          </strong>
                          <span>{line.packaging}</span>
                          <b>{line.quantity}</b>
                          <span className="price-column">
                            {line.unitPrice
                              ? money(line.unitPrice)
                              : "À renseigner"}
                          </span>
                          <strong className="price-column">
                            {line.unitPrice
                              ? money(line.unitPrice * line.quantity)
                              : "À renseigner"}
                          </strong>
                        </div>
                      );
                    })}
                  </div>
                  <div className="order-detail-bottom">
                    <div className="order-total-card price-column">
                      <span>Total commande HT</span>
                      <strong>{money(o.total)}</strong>
                    </div>
                    <div className="sent-mail-preview">
                      <div className="mail-preview-head">
                        <Mail size={19} />
                        <div>
                          <strong>Aperçu de l’e-mail</strong>
                          <span>
                            {o.email ? `Envoyé le ${o.email.sentAt}` : "Aucun e-mail envoyé"}
                          </span>
                        </div>
                      </div>
                      {o.email ? (
                        <>
                          <p><b>À :</b> {o.email.to}</p>
                          <p><b>Objet :</b> {o.email.subject}</p>
                          <pre>{o.email.body}</pre>
                        </>
                      ) : (
                        <p>Le brouillon reste consultable avant son envoi.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
/**
 * Prix d'un ensemble (coffret, carton, kit) chez un fournisseur : la somme de
 * son contenu, quantité par quantité. Dès qu'un prix de détail est saisi, le
 * prix du coffret en découle — il n'y a plus à le recalculer à la main.
 *
 * `drafts` contient les prix en cours de saisie, pour que le total suive la
 * frappe avant même l'enregistrement.
 */
const bundlePriceFor = (
  product: Product,
  supplier: string,
  drafts: Record<string, string>,
) =>
  (product.contents || []).reduce((total, item) => {
    const draft = drafts[componentPriceKey(product.id, item.name, supplier)];
    const unitPrice =
      draft !== undefined && draft !== ""
        ? Number(draft)
        : effectiveComponentPrice(
            product.id,
            item.name,
            supplier,
            componentPrice(item, supplier),
          );
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) return total;
    return total + unitPrice * (Number(item.quantity) || 0);
  }, 0);

/** Un ensemble dont au moins un élément est chiffré pilote son propre prix. */
const isComputedBundle = (product: Product) =>
  Boolean(product.contents?.length);

export function ProductsScreen({ onBack }: { onBack?: () => void } = {}) {
  const [query, setQuery] = useState(""),
    [family, setFamily] = useState("Tous"),
    [open, setOpen] = useState<number | null>(null),
    [editing, setEditing] = useState(false),
    [selectedProducts, setSelectedProducts] = useState<number[]>([]),
    [showPriceHistory, setShowPriceHistory] = useState(false),
    [catalog, setCatalog] = useState<Product[]>(() => getCatalogProducts()),
    [priceRevision, setPriceRevision] = useState(
      () => Object.keys(getPriceOverrides()).length,
    ),
    [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({}),
    [componentPrices, setComponentPrices] = useState<Record<string, string>>(
      {},
    ),
    [priceHistory, setPriceHistory] = useState(() => getManualPriceHistory());
  const purchasingSettings = usePurchasingSettings();
  const configuredSupplierNames = purchasingSettings.suppliers.map(
    (supplier) => supplier.name,
  );
  const editingCatalog = editing;
  const editingPrices = editing;
  const deletingProducts = editing;

  const updateProduct = (productId: number, update: (product: Product) => Product) =>
    setCatalog((current) =>
      current.map((product) => (product.id === productId ? update(product) : product)),
    );

  const addProduct = (kind: Product["kind"]) => {
    const id = Date.now();
    const productFamily = family === "Tous" ? "Électricité" : family;
    const product: Product = {
      id,
      name: kind === "ensemble" ? "Nouvel ensemble" : "Nouveau produit",
      family: productFamily,
      subfamily:
        productFamily === "Électricité" ? "Consommables" : productFamily,
      unit: kind === "ensemble" ? "Ensemble" : "Pièce",
      kind,
      bundleLabel: kind === "ensemble" ? "Ensemble" : undefined,
      contents: kind === "ensemble" ? [] : undefined,
      offers: configuredSupplierNames.map((supplier) => ({
        supplier,
        supplierName: kind === "ensemble" ? "Nouvel ensemble" : "Nouveau produit",
        reference: "À renseigner",
        brand: "À renseigner",
        price: 0,
        packaging: kind === "ensemble" ? "Ensemble complet" : "Pièce",
        packagingType: "fixed",
      })),
    };
    setCatalog((current) => [product, ...current]);
    setOpen(kind === "ensemble" ? id : null);
  };

  const addComponent = (productId: number) =>
    updateProduct(productId, (product) => ({
      ...product,
      contents: [
        ...(product.contents || []),
        {
          name: "Nouveau sous-produit",
          quantity: 1,
          unitPrice: 0,
          supplierPrices: Object.fromEntries(
            configuredSupplierNames.map((supplier) => [supplier, 0]),
          ),
        },
      ],
    }));

  const deleteComponent = (productId: number, componentIndex: number) =>
    updateProduct(productId, (product) => ({
      ...product,
      contents: product.contents?.filter((_, index) => index !== componentIndex),
    }));

  const cancelEditing = () => {
    setCatalog(getCatalogProducts());
    setEditing(false);
    setSelectedProducts([]);
    setPriceDrafts({});
    setComponentPrices({});
  };

  const deleteSelectedProducts = () => {
    if (!selectedProducts.length) return;
    if (
      !window.confirm(
        `Supprimer définitivement ${selectedProducts.length} produit(s) du catalogue ?`,
      )
    )
      return;
    deleteCatalogProducts(selectedProducts);
    setCatalog((current) =>
      current.filter((product) => !selectedProducts.includes(product.id)),
    );
    setSelectedProducts([]);
  };

  const savePrices = () => {
    const prices: Record<string, number> = {};
    const components: Record<string, number> = {};
    const changes: ManualPriceChange[] = [];
    const originalCatalog = getCatalogProducts();
    catalog.forEach((product) => {
      // Un ensemble tire son prix de son contenu : on enregistre le total
      // calculé, pour que les commandes et les e-mails utilisent le bon.
      if (isComputedBundle(product)) {
        configuredSupplierNames.forEach((supplier) => {
          const total = bundlePriceFor(product, supplier, componentPrices);
          if (total <= 0) return;
          const key = priceKey(product.id, supplier);
          const offer = product.offers.find((item) => item.supplier === supplier);
          const oldPrice = effectivePrice(product.id, supplier, offer?.price || 0);
          const newPrice = Math.round(total * 100) / 100;
          if (newPrice === oldPrice) return;
          prices[key] = newPrice;
          changes.push({
            product: `${product.name} (total du détail)`,
            supplier,
            oldPrice,
            newPrice,
            scope: "Produit",
          });
        });
      }
      configuredSupplierNames.forEach((supplier) => {
        const key = priceKey(product.id, supplier);
        if (priceDrafts[key] === undefined) return;
        // Le total calculé l'emporte sur une ancienne saisie manuelle.
        if (isComputedBundle(product) && prices[key] !== undefined) return;
        const offer = product.offers.find((item) => item.supplier === supplier);
        const oldPrice = effectivePrice(
          product.id,
          supplier,
          offer?.price || 0,
        );
        const newPrice = Number(priceDrafts[key]);
        if (!Number.isFinite(newPrice) || newPrice < 0 || newPrice === oldPrice)
          return;
        prices[key] = newPrice;
        changes.push({
          product: product.name,
          supplier,
          oldPrice,
          newPrice,
          scope: "Produit",
        });
      });
      product.contents?.forEach((item) => {
        product.offers.forEach((offer) => {
          const key = componentPriceKey(product.id, item.name, offer.supplier);
          if (componentPrices[key] === undefined) return;
          const oldPrice = effectiveComponentPrice(
            product.id,
            item.name,
            offer.supplier,
            componentPrice(item, offer.supplier),
          );
          const newPrice = Number(componentPrices[key]);
          if (
            !Number.isFinite(newPrice) ||
            newPrice < 0 ||
            newPrice === oldPrice
          )
            return;
          components[key] = newPrice;
          changes.push({
            product: `${product.name} · ${item.name}`,
            supplier: offer.supplier,
            oldPrice,
            newPrice,
            scope: "Sous-produit",
          });
        });
      });
      product.offers.forEach((offer) => {
        const oldMeterPrice =
          originalCatalog
            .find((item) => item.id === product.id)
            ?.offers.find((item) => item.supplier === offer.supplier)
            ?.meterPrice || 0;
        const newMeterPrice = offer.meterPrice || 0;
        if (oldMeterPrice !== newMeterPrice) {
          changes.push({
            product: `${product.name} · prix au mètre`,
            supplier: offer.supplier,
            oldPrice: oldMeterPrice,
            newPrice: newMeterPrice,
            scope: "Produit",
          });
        }
      });
    });
    saveManualPriceChanges({ prices, componentPrices: components, changes });
    saveCatalogProducts(catalog);
    setPriceRevision((revision) => revision + 1);
    setPriceHistory(getManualPriceHistory());
    setEditing(false);
    setSelectedProducts([]);
    setPriceDrafts({});
    setComponentPrices({});
  };
  const filtered = catalog
    .filter(
      (p) =>
        (family === "Tous" || p.family === family) &&
        `${p.name} ${p.offers[0].reference}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      `${a.family} ${productSection(a)} ${a.name}`.localeCompare(
        `${b.family} ${productSection(b)} ${b.name}`,
        "fr",
      ),
    );
  const groups = Object.entries(
    filtered.reduce<Record<string, Product[]>>((result, product) => {
      const key = `${product.family}|||${productSection(product)}`;
      (result[key] ??= []).push(product);
      return result;
    }, {}),
  );
  return (
    <div className="screen">
      <div className="page-title standard product-page-title">
        <div>
          {onBack && (
            <button className="back-link" onClick={onBack}>← Paramètres</button>
          )}
          <span className="eyebrow">CATALOGUE UNIQUE</span>
          <h1>Produits</h1>
          <p>
            {catalog.length} produits en liste avec comparatif des {configuredSupplierNames.length}
            fournisseurs.
          </p>
        </div>
        <div className="price-edit-actions">
          {editing ? (
            <>
              <button className="secondary-btn" onClick={() => addProduct("simple")}>
                <Plus size={18} /> Produit
              </button>
              <button className="secondary-btn" onClick={() => addProduct("ensemble")}>
                <Plus size={18} /> Ensemble
              </button>
              <button className="secondary-btn" onClick={cancelEditing}>
                <X size={18} /> Annuler
              </button>
              <button
                className="danger-btn"
                disabled={!selectedProducts.length}
                onClick={deleteSelectedProducts}
              >
                <Trash2 size={18} /> Supprimer ({selectedProducts.length})
              </button>
              <button className="primary-btn" onClick={savePrices}>
                <Save size={18} /> Tout enregistrer
              </button>
            </>
          ) : (
            <>
              <button
                className="secondary-btn"
                onClick={() => setShowPriceHistory((visible) => !visible)}
              >
                <History size={18} /> Historique
              </button>
              <button
                className="primary-btn"
                onClick={() => setEditing(true)}
              >
                <Pencil size={18} /> Modifier
              </button>
            </>
          )}
        </div>
      </div>
      {editing && (
        <div className="price-edit-banner">
          <Pencil size={18} />
          <span>
            <strong>Mode modification actif</strong>
            Modifiez produits, prix, conditionnements et sous-produits, ou sélectionnez ceux à supprimer.
          </span>
        </div>
      )}
      {deletingProducts && (
        <div className="product-delete-banner">
          <span>
            <strong>Sélection multiple</strong>
            Coche les produits à supprimer, catégorie par catégorie.
          </span>
          <button
            className="secondary-btn"
            onClick={() => {
              const visibleIds = filtered.map((product) => product.id);
              const allSelected = visibleIds.every((id) =>
                selectedProducts.includes(id),
              );
              setSelectedProducts((current) =>
                allSelected
                  ? current.filter((id) => !visibleIds.includes(id))
                  : [...new Set([...current, ...visibleIds])],
              );
            }}
          >
            {filtered.length > 0 &&
            filtered.every((product) => selectedProducts.includes(product.id))
              ? "Tout désélectionner"
              : "Tout sélectionner"}
          </button>
        </div>
      )}
      {showPriceHistory && !editingPrices && (
        <section className="panel manual-price-history">
          <div className="panel-head">
            <div>
              <h2>Historique des modifications de prix</h2>
              <p>Les modifications manuelles et les imports sont conservés avec leur date.</p>
            </div>
          </div>
          {priceHistory.length ? (
            priceHistory.slice(0, 8).map((item) => (
              <details key={item.id}>
                <summary>
                  <span>
                    <strong>{item.date}</strong>
                    <small>{item.source || "Manuel"} · Administrateur HM</small>
                  </span>
                  <b>{item.changes.length} modification(s)</b>
                </summary>
                <div>
                  {item.changes.map((change, index) => (
                    <span key={`${change.product}-${change.supplier}-${index}`}>
                      <span>
                        <strong>{change.product}</strong>
                        <small>
                          {change.scope} · {change.supplier}
                        </small>
                      </span>
                      <b>
                        {money(change.oldPrice)} → {money(change.newPrice)}
                      </b>
                    </span>
                  ))}
                </div>
              </details>
            ))
          ) : (
            <div className="empty-price-history">
              Aucune évolution de prix enregistrée.
            </div>
          )}
        </section>
      )}
      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher un produit, une référence…"
            />
          </div>
          <select
            className="family-select"
            value={family}
            onChange={(event) => setFamily(event.target.value)}
          >
            {productFamiliesFrom(catalog).map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        <div className="supplier-legend">
          <strong>Comparatif des prix HT</strong>
          <span>Le prix le plus bas sera automatiquement mis en évidence.</span>
        </div>
        <div className="catalog-groups compact-catalog">
          {groups.map(([key, items]) => {
            const [itemFamily, section] = key.split("|||");
            return (
              <section className="catalog-section" key={key}>
                <div className="catalog-section-head">
                  <div>
                    <span>
                      {itemFamily === "Électricité"
                        ? "Électricité"
                        : "Catégorie"}
                    </span>
                    <h2>{section}</h2>
                  </div>
                  <b>
                    {items.length} produit{items.length > 1 ? "s" : ""}
                  </b>
                </div>
                <div className="product-list-scroll">
                  <div className="product-list">
                    <div className="product-list-head">
                      <span>Produit</span>
                      <span>Conditionnement</span>
                      {configuredSupplierNames.map((supplier) => (
                        <span key={supplier}>{supplier}</span>
                      ))}
                      <span />
                    </div>
                    {items.map((p) => {
                      const supplierPrices = configuredSupplierNames.map((supplier) => {
                        const offer = p.offers.find(
                          (item) => item.supplier === supplier,
                        );
                        const stored = effectivePrice(
                          p.id,
                          supplier,
                          offer?.price || 0,
                        );
                        // Pour un coffret, le détail fait foi dès qu'il est chiffré ;
                        // sinon on garde le prix saisi jusqu'ici.
                        const computed = isComputedBundle(p)
                          ? bundlePriceFor(p, supplier, componentPrices)
                          : 0;
                        return {
                          supplier,
                          offer,
                          price: computed > 0 ? computed : stored,
                          computed: computed > 0,
                        };
                      });
                      const knownPrices = supplierPrices
                        .map((item) => item.price)
                        .filter((price) => price > 0);
                      const bestPrice = knownPrices.length
                        ? Math.min(...knownPrices)
                        : 0;
                      return (
                        <article
                          className="product-list-item"
                          key={`${p.id}-${priceRevision}`}
                        >
                          <div className="product-list-row">
                            <span className="product-list-name">
                              {deletingProducts && (
                                <label className="product-delete-check">
                                  <input
                                    type="checkbox"
                                    checked={selectedProducts.includes(p.id)}
                                    onChange={() =>
                                      setSelectedProducts((current) =>
                                        current.includes(p.id)
                                          ? current.filter((id) => id !== p.id)
                                          : [...current, p.id],
                                      )
                                    }
                                  />
                                  Sélectionner
                                </label>
                              )}
                              {editingCatalog ? (
                                <>
                                  <input
                                    className="catalog-text-input"
                                    aria-label={`Nom du produit ${p.code || p.id}`}
                                    value={p.name}
                                    onChange={(event) =>
                                      updateProduct(p.id, (product) => ({
                                        ...product,
                                        name: event.target.value,
                                      }))
                                    }
                                  />
                                  <select
                                    className="catalog-text-input"
                                    aria-label={`Catégorie de ${p.name}`}
                                    value={p.family}
                                    onChange={(event) =>
                                      updateProduct(p.id, (product) => ({
                                        ...product,
                                        family: event.target.value,
                                        subfamily:
                                          event.target.value === "Électricité"
                                            ? product.subfamily
                                            : event.target.value,
                                      }))
                                    }
                                  >
                                    {["Électricité", "Plomberie", "Climatisation", "SSc"].map((item) => (
                                      <option key={item}>{item}</option>
                                    ))}
                                  </select>
                                  <select
                                    className="catalog-text-input"
                                    aria-label={`Type de ${p.name}`}
                                    value={p.kind}
                                    onChange={(event) =>
                                      updateProduct(p.id, (product) => ({
                                        ...product,
                                        kind: event.target.value as Product["kind"],
                                        contents:
                                          event.target.value === "ensemble"
                                            ? product.contents || []
                                            : undefined,
                                        bundleLabel:
                                          event.target.value === "ensemble"
                                            ? product.bundleLabel || "Ensemble"
                                            : undefined,
                                      }))
                                    }
                                  >
                                    <option value="simple">Produit simple</option>
                                    <option value="ensemble">Ensemble composé</option>
                                  </select>
                                  {p.kind === "ensemble" && (
                                    <input
                                      className="catalog-text-input"
                                      aria-label={`Nom du type d’ensemble ${p.name}`}
                                      value={p.bundleLabel || ""}
                                      placeholder="Ex. Coffret, carton, kit…"
                                      onChange={(event) =>
                                        updateProduct(p.id, (product) => ({
                                          ...product,
                                          bundleLabel: event.target.value,
                                        }))
                                      }
                                    />
                                  )}
                                </>
                              ) : (
                                <strong>{p.name}</strong>
                              )}
                              <small>
                                {p.kind === "ensemble"
                                  ? `${p.bundleLabel || "Ensemble"} avec sous-produits`
                                  : `Commande par ${p.unit.toLowerCase()}`}
                              </small>
                            </span>
                            <span
                              className="packaging-cell"
                              data-label="Conditionnement"
                            >
                              {editingCatalog ? (
                                <input
                                  className="catalog-text-input"
                                  aria-label={`Conditionnement de base de ${p.name}`}
                                  value={p.offers[0]?.packaging || ""}
                                  onChange={(event) =>
                                    updateProduct(p.id, (product) => ({
                                      ...product,
                                      offers: product.offers.map((offer) => ({
                                        ...offer,
                                        packaging: event.target.value,
                                      })),
                                    }))
                                  }
                                />
                              ) : (
                                p.offers[0]?.packaging || "À renseigner"
                              )}
                            </span>
                            {configuredSupplierNames.map((supplier) => {
                              const supplierPrice = supplierPrices.find(
                                (item) => item.supplier === supplier,
                              );
                              const offer = supplierPrice?.offer;
                              const price = supplierPrice?.price || 0;
                              const key = priceKey(p.id, supplier);
                              const draft = priceDrafts[key];
                              return (
                                <span
                                  className={
                                    !offer && !price
                                      ? "price-cell unavailable"
                                      : !editingPrices &&
                                          price &&
                                          price === bestPrice
                                        ? "price-cell best-price"
                                        : editingPrices
                                          ? "price-cell editing"
                                          : "price-cell"
                                  }
                                  key={supplier}
                                  data-label={supplier}
                                >
                                  {supplierPrice?.computed ? (
                                    <b className="computed-price">
                                      {money(price)}
                                      <small>calculé sur le détail</small>
                                    </b>
                                  ) : editingPrices && (offer || price > 0) ? (
                                    <label className="catalog-price-input">
                                      <input
                                        aria-label={`Prix de ${p.name} chez ${supplier}`}
                                        inputMode="decimal"
                                        min="0"
                                        onChange={(event) =>
                                          setPriceDrafts((current) => ({
                                            ...current,
                                            [key]: event.target.value,
                                          }))
                                        }
                                        placeholder="À saisir"
                                        step="0.01"
                                        type="number"
                                        value={
                                          draft ?? (price ? String(price) : "")
                                        }
                                      />
                                      <small>€ HT</small>
                                    </label>
                                  ) : (
                                    <b>
                                      {price
                                        ? money(price)
                                        : offer
                                          ? "À saisir"
                                          : "—"}
                                    </b>
                                  )}
                                  {(offer || price > 0) && (
                                    <small>
                                      {offer?.reference || "Tarif importé"}
                                    </small>
                                  )}
                                  {offer && p.subfamily === "Câbles" &&
                                    (editingPrices ? (
                                      <label className="meter-price-input">
                                        <input
                                          aria-label={`Prix au mètre de ${p.name} chez ${supplier}`}
                                          inputMode="decimal"
                                          min="0"
                                          step="0.01"
                                          type="number"
                                          value={offer.meterPrice || ""}
                                          onChange={(event) =>
                                            updateProduct(p.id, (product) => ({
                                              ...product,
                                              offers: product.offers.map((item) =>
                                                item.supplier === supplier
                                                  ? {
                                                      ...item,
                                                      meterPrice: Number(event.target.value),
                                                    }
                                                  : item,
                                              ),
                                            }))
                                          }
                                          placeholder="Prix/m"
                                        />
                                        <small>€/m</small>
                                      </label>
                                    ) : (
                                      <small>
                                        {offer.meterPrice
                                          ? `${offer.meterPrice.toFixed(2).replace(".", ",")} €/m`
                                          : "Prix/m à renseigner"}
                                      </small>
                                    ))}
                                  {offer && p.subfamily !== "Câbles" &&
                                    (editingCatalog ? (
                                      <input
                                        className="catalog-packaging-input"
                                        aria-label={`Conditionnement de ${p.name} chez ${supplier}`}
                                        value={offer.packaging}
                                        onChange={(event) =>
                                          updateProduct(p.id, (product) => ({
                                            ...product,
                                            offers: product.offers.map((item) =>
                                              item.supplier === supplier
                                                ? { ...item, packaging: event.target.value }
                                                : item,
                                            ),
                                          }))
                                        }
                                        placeholder="Conditionnement"
                                      />
                                    ) : (
                                      <small>{offer.packaging}</small>
                                    ))}
                                </span>
                              );
                            })}
                            <span className="product-actions">
                              {p.kind === "ensemble" && (
                                <button
                                  className="composition-link"
                                  onClick={() =>
                                    setOpen(open === p.id ? null : p.id)
                                  }
                                >
                                  {open === p.id ? "Fermer" : editingCatalog ? "Modifier" : "Détail"}
                                </button>
                              )}
                              <button className="more-btn" aria-label="Options">
                                <MoreHorizontal size={20} />
                              </button>
                            </span>
                          </div>
                          {open === p.id && (
                            <div className="composition-box list-composition">
                              <div className="component-title-row">
                                <strong className="component-comparison-title">
                                  {p.bundleLabel || "Ensemble"} · détail pièce par pièce
                                </strong>
                                {editingCatalog && (
                                  <button className="secondary-btn" onClick={() => addComponent(p.id)}>
                                    <Plus size={16} /> Ajouter un sous-produit
                                  </button>
                                )}
                              </div>
                              <div className="component-price-scroll">
                                <div
                                  className="component-price-grid"
                                  style={{
                                    gridTemplateColumns: `minmax(280px,2fr) 70px repeat(${p.offers.length},minmax(125px,1fr))`,
                                  }}
                                >
                                  <span className="component-price-head">
                                    Sous-produit
                                  </span>
                                  <span className="component-price-head">
                                    Qté
                                  </span>
                                  {p.offers.map((offer) => (
                                    <span
                                      className="component-price-head"
                                      key={offer.supplier}
                                    >
                                      {offer.supplier}
                                    </span>
                                  ))}
                                  {p.contents?.flatMap((item, componentIndex) => {
                                    const prices = p.offers
                                      .map((offer) => {
                                        const key = componentPriceKey(
                                          p.id,
                                          item.name,
                                          offer.supplier,
                                        );
                                        return Number(
                                          componentPrices[key] ??
                                            effectiveComponentPrice(
                                              p.id,
                                              item.name,
                                              offer.supplier,
                                              componentPrice(
                                                item,
                                                offer.supplier,
                                              ),
                                            ),
                                        );
                                      })
                                      .filter((price) => price > 0);
                                    const best = prices.length
                                      ? Math.min(...prices)
                                      : 0;
                                    return [
                                      <span
                                        className="component-product-name"
                                        key={`${item.name}-name`}
                                      >
                                        {editingCatalog ? (
                                          <input
                                            className="catalog-text-input"
                                            aria-label={`Nom du sous-produit ${item.name}`}
                                            value={item.name}
                                            onChange={(event) =>
                                              updateProduct(p.id, (product) => ({
                                                ...product,
                                                contents: product.contents?.map((content) =>
                                                  content === item
                                                    ? { ...content, name: event.target.value }
                                                    : content,
                                                ),
                                              }))
                                            }
                                          />
                                        ) : item.name}
                                        {editingCatalog && (
                                          <button
                                            className="component-delete-btn"
                                            aria-label={`Supprimer ${item.name}`}
                                            onClick={() => deleteComponent(p.id, componentIndex)}
                                          >
                                            <Trash2 size={15} />
                                          </button>
                                        )}
                                      </span>,
                                      <span
                                        className="component-quantity"
                                        key={`${item.name}-qty`}
                                      >
                                        {editingCatalog ? (
                                          <input
                                            className="catalog-quantity-input"
                                            aria-label={`Quantité de ${item.name}`}
                                            min="0"
                                            step="1"
                                            type="number"
                                            value={item.quantity}
                                            onChange={(event) =>
                                              updateProduct(p.id, (product) => ({
                                                ...product,
                                                contents: product.contents?.map((content) =>
                                                  content === item
                                                    ? { ...content, quantity: Number(event.target.value) }
                                                    : content,
                                                ),
                                              }))
                                            }
                                          />
                                        ) : item.quantity}
                                      </span>,
                                      ...p.offers.map((offer) => {
                                        const key = componentPriceKey(
                                          p.id,
                                          item.name,
                                          offer.supplier,
                                        );
                                        const savedValue = componentPrices[key];
                                        const currentPrice =
                                          effectiveComponentPrice(
                                            p.id,
                                            item.name,
                                            offer.supplier,
                                            componentPrice(
                                              item,
                                              offer.supplier,
                                            ),
                                          );
                                        const price = Number(
                                          savedValue ?? currentPrice,
                                        );
                                        return (
                                          <span
                                            className={
                                              !editingPrices &&
                                              price &&
                                              price === best
                                                ? "component-supplier-price best-price"
                                                : editingPrices
                                                  ? "component-supplier-price editing"
                                                  : "component-supplier-price"
                                            }
                                            data-label={offer.supplier}
                                            key={`${item.name}-${offer.supplier}`}
                                          >
                                            {editingPrices ? (
                                              <>
                                                <input
                                                  aria-label={`Prix unitaire ${item.name} chez ${offer.supplier}`}
                                                  inputMode="decimal"
                                                  min="0"
                                                  onChange={(event) =>
                                                    setComponentPrices(
                                                      (current) => ({
                                                        ...current,
                                                        [key]:
                                                          event.target.value,
                                                      }),
                                                    )
                                                  }
                                                  placeholder="À saisir"
                                                  step="0.01"
                                                  type="number"
                                                  value={
                                                    savedValue ??
                                                    (currentPrice
                                                      ? String(currentPrice)
                                                      : "")
                                                  }
                                                />
                                                <small>€ HT</small>
                                              </>
                                            ) : (
                                              <>
                                                <b>
                                                  {price
                                                    ? money(price)
                                                    : "À saisir"}
                                                </b>
                                                <small>unité HT</small>
                                              </>
                                            )}
                                          </span>
                                        );
                                      }),
                                    ];
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}
const ROLE_LABELS: Record<AppUser["role"], string> = {
  admin: "Administrateur",
  acheteur: "Commandes",
  lecteur: "Lecture seule",
};

const userInitials = (user: AppUser) =>
  (user.name || user.email)
    .split(/[\s.@_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "?";

export function UsersScreen({ onBack }: { onBack?: () => void } = {}) {
  const [users, setUsers] = useState<AppUser[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [adding, setAdding] = useState(false),
    [draft, setDraft] = useState({
      email: "",
      name: "",
      password: "",
      role: "acheteur" as AppUser["role"],
    });

  useEffect(() => {
    if (IS_DEMO) {
      // L'aperçu n'a pas de serveur : on montre l'écran avec un compte fictif.
      setUsers([
        {
          id: 0,
          email: "demo@hmgroup.fr",
          name: "Démonstration",
          role: "admin",
          active: true,
          lastLoginAt: null,
          createdAt: "",
        },
      ]);
      setLoading(false);
      return;
    }
    api
      .get<{ users: AppUser[] }>("/users")
      .then(({ users: list }) => setUsers(list))
      .catch((failure) =>
        setError(failure instanceof ApiError ? failure.message : "Chargement impossible."),
      )
      .finally(() => setLoading(false));
  }, []);

  const run = async (action: () => Promise<{ users: AppUser[] }>) => {
    setError(null);
    try {
      const { users: list } = await action();
      setUsers(list);
      return true;
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : "Action impossible.");
      return false;
    }
  };

  const addUser = async () => {
    const done = await run(() => api.post<{ users: AppUser[] }>("/users", draft));
    if (!done) return;
    setDraft({ email: "", name: "", password: "", role: "acheteur" });
    setAdding(false);
  };

  const toggleActive = (user: AppUser) =>
    run(() => api.put<{ users: AppUser[] }>(`/users/${user.id}`, { active: !user.active }));

  const removeUser = (user: AppUser) => {
    if (!window.confirm(`Supprimer définitivement le compte ${user.email} ?`)) return;
    void run(() => api.delete<{ users: AppUser[] }>(`/users/${user.id}`));
  };

  const changePassword = (user: AppUser) => {
    const password = window.prompt(`Nouveau mot de passe pour ${user.email} (10 caractères minimum) :`);
    if (!password) return;
    void run(() => api.put<{ users: AppUser[] }>(`/users/${user.id}`, { password }));
  };

  return (
    <div className="screen">
      {onBack && (
        <button className="back-link settings-back-link" onClick={onBack}>← Paramètres</button>
      )}
      <ScreenHeader
        eyebrow="ACCÈS"
        title="Utilisateurs et droits"
        description="Gérez simplement qui peut voir et modifier."
        action="Ajouter un utilisateur"
        onAction={() => setAdding((open) => !open)}
      />
      {error && <p className="login-error">{error}</p>}
      <div className="users-layout">
        <section className="panel user-list">
          <div className="panel-head">
            <div>
              <h2>{loading ? "Chargement…" : `${users.length} utilisateur${users.length > 1 ? "s" : ""}`}</h2>
              <p>Comptes ayant accès à l’application</p>
            </div>
          </div>

          {adding && (
            <div className="user-draft">
              <input
                type="email"
                placeholder="prenom@hmgroup.fr"
                value={draft.email}
                onChange={(event) => setDraft({ ...draft, email: event.target.value })}
              />
              <input
                placeholder="Nom et prénom"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
              <input
                type="password"
                placeholder="Mot de passe (10 caractères minimum)"
                value={draft.password}
                onChange={(event) => setDraft({ ...draft, password: event.target.value })}
              />
              <select
                value={draft.role}
                onChange={(event) =>
                  setDraft({ ...draft, role: event.target.value as AppUser["role"] })
                }
              >
                <option value="admin">Administrateur</option>
                <option value="acheteur">Commandes</option>
                <option value="lecteur">Lecture seule</option>
              </select>
              <button className="primary-btn" onClick={() => void addUser()}>
                <Plus size={16} /> Créer le compte
              </button>
            </div>
          )}

          {users.map((user) => (
            <div className="user-row" key={user.id}>
              <div className="avatar large">{userInitials(user)}</div>
              <div>
                <strong>{user.name || user.email}</strong>
                <span>
                  <Mail size={14} />
                  {user.email}
                </span>
              </div>
              <i className={"status " + (user.role === "admin" ? "sent" : "draft")}>
                {ROLE_LABELS[user.role]}
              </i>
              <span className={"account-state " + (user.active ? "active" : "")}>
                {user.active ? "Actif" : "Suspendu"}
              </span>
              <div className="user-row-actions">
                <button onClick={() => void changePassword(user)} title="Changer le mot de passe">
                  <Pencil size={16} />
                </button>
                <button onClick={() => void toggleActive(user)} title={user.active ? "Suspendre" : "Réactiver"}>
                  <ShieldCheck size={16} />
                </button>
                <button onClick={() => removeUser(user)} title="Supprimer">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </section>
        <aside className="panel rights-card">
          <div className="rights-icon">
            <ShieldCheck size={25} />
          </div>
          <h2>Droits simples</h2>
          <p>Trois niveaux suffisent pour garder l’application claire.</p>
          <div>
            <strong>Administrateur</strong>
            <span>Accès complet, gestion des comptes</span>
          </div>
          <div>
            <strong>Commandes</strong>
            <span>Création et suivi</span>
          </div>
          <div>
            <strong>Lecture seule</strong>
            <span>Consultation uniquement</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
export function SettingsScreen({
  onNavigate,
}: {
  onNavigate: (id: ScreenId) => void;
}) {
  const [section, setSection] = useState<
      null | "suppliers" | "teams" | "order" | "versions"
    >(null),
    [editing, setEditing] = useState(false),
    [saved, setSaved] = useState<PurchasingSettings>(() =>
      getPurchasingSettings(),
    ),
    [draft, setDraft] = useState<PurchasingSettings>(() =>
      getPurchasingSettings(),
    );
  const updateField = (
    field: keyof Omit<PurchasingSettings, "suppliers" | "defaultTeams">,
    value: string,
  ) => setDraft((current) => ({ ...current, [field]: value }));
  const save = () => {
    const cleaned = {
      ...draft,
      suppliers: draft.suppliers.filter((supplier) => supplier.name.trim()),
    };
    savePurchasingSettings(cleaned);
    setSaved(cleaned);
    setDraft(cleaned);
    setEditing(false);
  };
  return (
    <div className="screen">
      <div className="page-title standard settings-page-title">
        <div>
          <span className="eyebrow">CONFIGURATION</span>
          <h1>Paramètres</h1>
          <p>Adresses fournisseurs, modèle d’e-mail et livraison.</p>
        </div>
        {(section === "suppliers" || section === "teams" || section === "order") && (
          <div className="settings-actions">
          {editing ? (
            <>
              <button
                className="secondary-btn"
                onClick={() => {
                  setDraft(saved);
                  setEditing(false);
                }}
              >
                <X size={17} /> Annuler
              </button>
              <button className="primary-btn" onClick={save}>
                <Save size={17} /> Enregistrer
              </button>
            </>
          ) : (
            <button className="primary-btn" onClick={() => setEditing(true)}>
              <Pencil size={17} /> Modifier les paramètres
            </button>
          )}
          </div>
        )}
      </div>
      {section === null && (
      <div className="settings-hub-grid settings-main-grid">
        <button onClick={() => onNavigate("products")}>
          <span><Box size={22} /></span>
          <strong>Produits et ensembles</strong>
          <small>Produits, coffrets, cartons, kits et sous-produits</small>
        </button>
        <button onClick={() => onNavigate("tariff-imports")}>
          <span><FileUp size={22} /></span>
          <strong>Tarifs et historique</strong>
          <small>Imports Excel/PDF et évolution des prix</small>
        </button>
        <button onClick={() => onNavigate("users")}>
          <span><Users size={22} /></span>
          <strong>Utilisateurs et droits</strong>
          <small>Accès administrateur, commandes ou lecture</small>
        </button>
        <button onClick={() => setSection("suppliers")}>
          <span><Truck size={22} /></span>
          <strong>Fournisseurs et e-mails</strong>
          <small>Ajouter les fournisseurs et leurs destinataires</small>
        </button>
        <button onClick={() => setSection("teams")}>
          <span><ShieldCheck size={22} /></span>
          <strong>Équipes par défaut</strong>
          <small>Valeurs reprises automatiquement dans les commandes</small>
        </button>
        <button onClick={() => setSection("order")}>
          <span><Mail size={22} /></span>
          <strong>E-mail et livraison</strong>
          <small>Objet, message, signature et adresse HM Group</small>
        </button>
        <button onClick={() => setSection("versions")}>
          <span><History size={22} /></span>
          <strong>Versions du CRM</strong>
          <small>Version actuelle {CRM_VERSION} et historique des évolutions</small>
        </button>
      </div>
      )}
      {section !== null && (
        <button
          className="back-link settings-section-back"
          onClick={() => {
            setEditing(false);
            setDraft(saved);
            setSection(null);
          }}
        >
          ← Toutes les rubriques
        </button>
      )}
      {section === "versions" && (
        <section className="panel version-history-panel">
          <div className="panel-head">
            <div>
              <h2>Historique des versions</h2>
              <p>Version actuellement installée : {CRM_VERSION}</p>
            </div>
          </div>
          <div className="version-timeline">
            {CRM_VERSION_HISTORY.map((item, index) => (
              <article key={item.version} className={index === 0 ? "current" : ""}>
                <span className="version-number">v{item.version}</span>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.date}</small>
                  <ul>{item.changes.map((change) => <li key={change}>{change}</li>)}</ul>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      {(section === "suppliers" || section === "teams" || section === "order") && !editing && (
        <div className="settings-lock-note">
          <ShieldCheck size={18} /> Les paramètres sont verrouillés. Cliquez sur
          « Modifier les paramètres » pour les changer.
        </div>
      )}
      {(section === "suppliers" || section === "teams" || section === "order") && (
      <div className={`purchasing-settings-grid settings-view-${section}`}>
        <section className="panel settings-form-card supplier-settings-card">
          <div className="settings-form-head">
            <Truck size={21} />
            <div>
              <h2>Fournisseurs et e-mails</h2>
              <p>Ajoutez vos fournisseurs et plusieurs adresses séparées par « ; ».</p>
            </div>
            {editing && (
              <button
                className="secondary-btn add-supplier-btn"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    suppliers: [
                      ...current.suppliers,
                      { name: "", emails: "" },
                    ],
                  }))
                }
              >
                <Plus size={16} /> Ajouter
              </button>
            )}
          </div>
          <div className="supplier-email-list">
            {draft.suppliers.map((supplier, index) => (
              <div className="supplier-setting-row" key={`${supplier.name}-${index}`}>
                <label>
                <span>Fournisseur</span>
                <input
                  disabled={!editing}
                  placeholder="Nom du fournisseur"
                  type="text"
                  value={supplier.name}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      suppliers: current.suppliers.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, name: event.target.value }
                          : item,
                      ),
                    }))
                  }
                />
                </label>
                <label>
                <span>Destinataires</span>
                <input
                  disabled={!editing}
                  placeholder="commande@fournisseur.fr ; commercial@fournisseur.fr"
                  type="text"
                  value={supplier.emails}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      suppliers: current.suppliers.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, emails: event.target.value }
                          : item,
                      ),
                    }))
                  }
                />
                </label>
                {editing && (
                  <button
                    className="icon-danger-btn"
                    aria-label={`Supprimer ${supplier.name || "ce fournisseur"}`}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        suppliers: current.suppliers.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      }))
                    }
                  >
                    <Trash2 size={17} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="default-teams-settings">
            <div className="settings-form-head">
              <ShieldCheck size={21} />
              <div>
                <h2>Équipes par défaut</h2>
                <p>Ces nombres seront repris dans chaque nouvelle commande.</p>
              </div>
            </div>
            <div className="default-teams-grid">
              {companies.map((company) => (
                <label key={company.key}>
                  <span>{company.name}</span>
                  <input
                    disabled={!editing}
                    min="0"
                    type="number"
                    value={draft.defaultTeams[company.key]}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        defaultTeams: {
                          ...current.defaultTeams,
                          [company.key]: Math.max(0, Number(event.target.value)),
                        },
                      }))
                    }
                  />
                </label>
              ))}
            </div>
          </div>
        </section>
        <section className="panel settings-form-card mail-settings-card">
          <div className="settings-form-head">
            <Mail size={21} />
            <div>
              <h2>Modèle de l’e-mail</h2>
              <p>Le détail de la commande sera ajouté automatiquement.</p>
            </div>
          </div>
          <label>
            <span>Objet</span>
            <input
              disabled={!editing}
              value={draft.mailSubject}
              onChange={(event) => updateField("mailSubject", event.target.value)}
            />
          </label>
          <label>
            <span>Introduction</span>
            <input
              disabled={!editing}
              value={draft.greeting}
              onChange={(event) => updateField("greeting", event.target.value)}
            />
          </label>
          <label>
            <span>Consigne de livraison</span>
            <input
              disabled={!editing}
              value={draft.deliveryMessage}
              onChange={(event) =>
                updateField("deliveryMessage", event.target.value)
              }
            />
          </label>
          <label>
            <span>Signature</span>
            <textarea
              disabled={!editing}
              rows={3}
              value={draft.closing}
              onChange={(event) => updateField("closing", event.target.value)}
            />
          </label>
          <label>
            <span>Adresse de livraison affichée sur le bon</span>
            <textarea
              disabled={!editing}
              rows={3}
              value={draft.deliveryAddress}
              onChange={(event) =>
                updateField("deliveryAddress", event.target.value)
              }
            />
          </label>
          <div className="mail-template-preview">
            <strong>Aperçu</strong>
            <span>Objet : {draft.mailSubject}</span>
            <pre>{`${draft.greeting}\n\n${draft.deliveryMessage}\n\nCommande S35 du 27/08/2026\n\n2 × Vis à bois 5 × 70 — Boîte de 200\nDispatch : CPTE Conseil 1 | HM Pose 1 | HM Instal 0 | HM PAC 0\n\n${draft.closing}`}</pre>
          </div>
        </section>
      </div>
      )}
    </div>
  );
}
function ScreenHeader({
  eyebrow,
  title,
  description,
  action,
  onAction,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="page-title standard">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && (
        <button className="primary-btn" onClick={onAction}>
          <Plus size={18} />
          {action}
        </button>
      )}
    </div>
  );
}
