"use client";
import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
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
  Truck,
  X,
} from "lucide-react";
import {
  componentPrice,
  money,
  productFamilies,
  productSection,
  products,
  supplierNames,
  type Product,
} from "@/lib/crm-data";
import {
  componentPriceKey,
  effectiveComponentPrice,
  effectivePrice,
  getManualPriceHistory,
  getImportedProducts,
  getPriceOverrides,
  priceKey,
  saveManualPriceChanges,
  type ManualPriceChange,
} from "@/lib/tariff-storage";
import {
  createMailPreview,
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
export function OrdersScreen({
  onNavigate,
}: {
  onNavigate: (id: ScreenId) => void;
}) {
  const [query, setQuery] = useState(""),
    [openOrder, setOpenOrder] = useState<string | null>(null),
    [orders, setOrders] = useState<StoredOrder[]>(() => getStoredOrders());
  const filteredOrders = orders.filter((order) =>
    `${order.id} ${order.supplier} ${order.status}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const openMail = (order: StoredOrder) => {
    const email = createMailPreview(order);
    saveOrder({ ...order, email, status: "Envoyée" });
    setOrders(getStoredOrders());
    window.open(mailtoUrl(email), "_self");
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
                        onClick={() => window.print()}
                      >
                        <Printer size={16} /> Imprimer / PDF
                      </button>
                      <button className="primary-btn" onClick={() => openMail(o)}>
                        <Mail size={16} />
                        {o.email ? "Rouvrir dans Mail" : "Ouvrir dans Mail"}
                      </button>
                    </div>
                  </div>
                  <div className="order-lines-view">
                    <div className="order-lines-head">
                      <span>Produit</span>
                      <span>Conditionnement</span>
                      <span>Quantité</span>
                      <span>Prix HT</span>
                      <span>Total HT</span>
                    </div>
                    {o.lines.map((line) => (
                      <div className="order-line-view" key={line.productId}>
                        <strong>{line.name}</strong>
                        <span>{line.packaging}</span>
                        <b>{line.quantity}</b>
                        <span>{line.unitPrice ? money(line.unitPrice) : "À renseigner"}</span>
                        <strong>
                          {line.unitPrice
                            ? money(line.unitPrice * line.quantity)
                            : "À renseigner"}
                        </strong>
                      </div>
                    ))}
                  </div>
                  <div className="order-detail-bottom">
                    <div className="order-total-card">
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
export function ProductsScreen() {
  const [query, setQuery] = useState(""),
    [family, setFamily] = useState("Tous"),
    [open, setOpen] = useState<number | null>(null),
    [editingPrices, setEditingPrices] = useState(false),
    [showPriceHistory, setShowPriceHistory] = useState(false),
    [catalog] = useState<Product[]>(() => [
      ...products,
      ...getImportedProducts(),
    ]),
    [priceRevision, setPriceRevision] = useState(
      () => Object.keys(getPriceOverrides()).length,
    ),
    [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({}),
    [componentPrices, setComponentPrices] = useState<Record<string, string>>(
      {},
    ),
    [priceHistory, setPriceHistory] = useState(() => getManualPriceHistory());

  const cancelPriceEditing = () => {
    setEditingPrices(false);
    setPriceDrafts({});
    setComponentPrices({});
  };

  const savePrices = () => {
    const prices: Record<string, number> = {};
    const components: Record<string, number> = {};
    const changes: ManualPriceChange[] = [];
    catalog.forEach((product) => {
      supplierNames.forEach((supplier) => {
        const key = priceKey(product.id, supplier);
        if (priceDrafts[key] === undefined) return;
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
    });
    saveManualPriceChanges({ prices, componentPrices: components, changes });
    setPriceRevision((revision) => revision + 1);
    setPriceHistory(getManualPriceHistory());
    cancelPriceEditing();
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
          <span className="eyebrow">CATALOGUE UNIQUE</span>
          <h1>Produits</h1>
          <p>
            {catalog.length} produits en liste avec comparatif des 7
            fournisseurs.
          </p>
        </div>
        <div className="price-edit-actions">
          {editingPrices ? (
            <>
              <button className="secondary-btn" onClick={cancelPriceEditing}>
                <X size={18} /> Annuler
              </button>
              <button className="primary-btn" onClick={savePrices}>
                <Save size={18} /> Enregistrer les prix
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
                onClick={() => setEditingPrices(true)}
              >
                <Pencil size={18} /> Modifier les prix
              </button>
            </>
          )}
        </div>
      </div>
      {editingPrices && (
        <div className="price-edit-banner">
          <Pencil size={18} />
          <span>
            <strong>Mode modification actif</strong>
            Modifiez les prix utiles, puis enregistrez tout en une seule fois.
          </span>
        </div>
      )}
      {showPriceHistory && !editingPrices && (
        <section className="panel manual-price-history">
          <div className="panel-head">
            <div>
              <h2>Historique des modifications de prix</h2>
              <p>Chaque enregistrement manuel est conservé avec sa date.</p>
            </div>
          </div>
          {priceHistory.length ? (
            priceHistory.slice(0, 8).map((item) => (
              <details key={item.id}>
                <summary>
                  <span>
                    <strong>{item.date}</strong>
                    <small>Administrateur HM</small>
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
              Aucune modification manuelle enregistrée.
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
            {productFamilies.map((item) => (
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
                      {supplierNames.map((supplier) => (
                        <span key={supplier}>{supplier}</span>
                      ))}
                      <span />
                    </div>
                    {items.map((p) => {
                      const supplierPrices = supplierNames.map((supplier) => {
                        const offer = p.offers.find(
                          (item) => item.supplier === supplier,
                        );
                        return {
                          supplier,
                          offer,
                          price: effectivePrice(
                            p.id,
                            supplier,
                            offer?.price || 0,
                          ),
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
                              <strong>{p.name}</strong>
                              <small>
                                {p.kind === "ensemble"
                                  ? "Ensemble avec sous-produits"
                                  : `Commande par ${p.unit.toLowerCase()}`}
                              </small>
                            </span>
                            <span
                              className="packaging-cell"
                              data-label="Conditionnement"
                            >
                              {p.offers[0].packaging}
                            </span>
                            {supplierNames.map((supplier) => {
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
                                  {editingPrices && (offer || price > 0) ? (
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
                                  {open === p.id ? "Fermer" : "Détail"}
                                </button>
                              )}
                              <button className="more-btn" aria-label="Options">
                                <MoreHorizontal size={20} />
                              </button>
                            </span>
                          </div>
                          {open === p.id && (
                            <div className="composition-box list-composition">
                              <strong className="component-comparison-title">
                                Comparatif pièce par pièce
                              </strong>
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
                                  {p.contents?.flatMap((item) => {
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
                                        {item.name}
                                      </span>,
                                      <span
                                        className="component-quantity"
                                        key={`${item.name}-qty`}
                                      >
                                        {item.quantity}
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
export function UsersScreen() {
  const users = [
    ["Administrateur HM", "admin@exemple.fr", "Administrateur", "AH", "Actif"],
    ["Responsable achats", "achats@exemple.fr", "Commandes", "RA", "Actif"],
    ["Consultation", "lecture@exemple.fr", "Lecture seule", "CL", "Suspendu"],
  ];
  return (
    <div className="screen">
      <ScreenHeader
        eyebrow="ACCÈS"
        title="Utilisateurs et droits"
        description="Gérez simplement qui peut voir et modifier."
        action="Ajouter un utilisateur"
      />
      <div className="users-layout">
        <section className="panel user-list">
          <div className="panel-head">
            <div>
              <h2>3 utilisateurs</h2>
              <p>Comptes ayant accès à l’application</p>
            </div>
          </div>
          {users.map((u) => (
            <div className="user-row" key={u[1]}>
              <div className="avatar large">{u[3]}</div>
              <div>
                <strong>{u[0]}</strong>
                <span>
                  <Mail size={14} />
                  {u[1]}
                </span>
              </div>
              <i
                className={
                  "status " + (u[2] === "Administrateur" ? "sent" : "draft")
                }
              >
                {u[2]}
              </i>
              <span
                className={
                  "account-state " + (u[4] === "Actif" ? "active" : "")
                }
              >
                {u[4]}
              </span>
              <button className="more-btn">
                <MoreHorizontal size={19} />
              </button>
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
            <span>Accès complet</span>
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
export function SettingsScreen() {
  const [editing, setEditing] = useState(false),
    [saved, setSaved] = useState<PurchasingSettings>(() =>
      getPurchasingSettings(),
    ),
    [draft, setDraft] = useState<PurchasingSettings>(() =>
      getPurchasingSettings(),
    );
  const updateField = (
    field: keyof Omit<PurchasingSettings, "suppliers">,
    value: string,
  ) => setDraft((current) => ({ ...current, [field]: value }));
  const save = () => {
    savePurchasingSettings(draft);
    setSaved(draft);
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
      </div>
      {!editing && (
        <div className="settings-lock-note">
          <ShieldCheck size={18} /> Les paramètres sont verrouillés. Cliquez sur
          « Modifier les paramètres » pour les changer.
        </div>
      )}
      <div className="purchasing-settings-grid">
        <section className="panel settings-form-card supplier-settings-card">
          <div className="settings-form-head">
            <Truck size={21} />
            <div>
              <h2>E-mails des fournisseurs</h2>
              <p>Plusieurs adresses possibles, séparées par une virgule.</p>
            </div>
          </div>
          <div className="supplier-email-list">
            {draft.suppliers.map((supplier, index) => (
              <label key={supplier.name}>
                <span>{supplier.name}</span>
                <input
                  disabled={!editing}
                  placeholder="commande@fournisseur.fr"
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
            ))}
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
    </div>
  );
}
function ScreenHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: string;
}) {
  return (
    <div className="page-title standard">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && (
        <button className="primary-btn">
          <Plus size={18} />
          {action}
        </button>
      )}
    </div>
  );
}
