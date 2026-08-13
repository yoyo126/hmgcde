"use client";
import { useState } from "react";
import {
  ChevronRight,
  CircleUserRound,
  FileText,
  Mail,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
} from "lucide-react";
import {
  componentPrice,
  initialOrders,
  money,
  productFamilies,
  productSection,
  products,
  supplierNames,
} from "@/lib/crm-data";
export function OrdersScreen() {
  return (
    <div className="screen">
      <ScreenHeader
        eyebrow="SUIVI"
        title="Commandes"
        description="Retrouvez toutes les commandes fournisseurs."
        action="Nouvelle commande"
      />
      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={18} />
            <input placeholder="Rechercher une commande…" />
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
          {initialOrders.map((o) => (
            <div className="table-row" key={o.id}>
              <span>
                <FileText size={17} />
                <strong>{o.id}</strong>
              </span>
              <span>{o.supplier}</span>
              <span>{o.date}</span>
              <span>{o.products}</span>
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
              <button>
                <ChevronRight size={18} />
              </button>
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
    [componentPrices, setComponentPrices] = useState<Record<string, string>>(
      {},
    );
  const componentKey = (
    productId: number,
    itemName: string,
    supplier: string,
  ) => `${productId}|||${itemName}|||${supplier}`;
  const filtered = products
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
    filtered.reduce<Record<string, typeof products>>((result, product) => {
      const key = `${product.family}|||${productSection(product)}`;
      (result[key] ??= []).push(product);
      return result;
    }, {}),
  );
  return (
    <div className="screen">
      <ScreenHeader
        eyebrow="CATALOGUE UNIQUE"
        title="Produits"
        description={`${products.length} produits en liste avec comparatif des 7 fournisseurs.`}
        action="Ajouter un produit"
      />
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
                      const knownPrices = p.offers
                        .map((offer) => offer.price)
                        .filter((price) => price > 0);
                      const bestPrice = knownPrices.length
                        ? Math.min(...knownPrices)
                        : 0;
                      return (
                        <article className="product-list-item" key={p.id}>
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
                              const offer = p.offers.find(
                                (item) => item.supplier === supplier,
                              );
                              return (
                                <span
                                  className={
                                    !offer
                                      ? "price-cell unavailable"
                                      : offer.price && offer.price === bestPrice
                                        ? "price-cell best-price"
                                        : "price-cell"
                                  }
                                  key={supplier}
                                  data-label={supplier}
                                >
                                  <b>
                                    {offer?.price
                                      ? money(offer.price)
                                      : offer
                                        ? "À saisir"
                                        : "—"}
                                  </b>
                                  {offer && <small>{offer.reference}</small>}
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
                                        const key = componentKey(
                                          p.id,
                                          item.name,
                                          offer.supplier,
                                        );
                                        return Number(
                                          componentPrices[key] ??
                                            componentPrice(
                                              item,
                                              offer.supplier,
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
                                        const key = componentKey(
                                          p.id,
                                          item.name,
                                          offer.supplier,
                                        );
                                        const savedValue = componentPrices[key];
                                        const initialPrice = componentPrice(
                                          item,
                                          offer.supplier,
                                        );
                                        const price = Number(
                                          savedValue ?? initialPrice,
                                        );
                                        return (
                                          <span
                                            className={
                                              price && price === best
                                                ? "component-supplier-price best-price"
                                                : "component-supplier-price"
                                            }
                                            data-label={offer.supplier}
                                            key={`${item.name}-${offer.supplier}`}
                                          >
                                            <input
                                              aria-label={`Prix unitaire ${item.name} chez ${offer.supplier}`}
                                              inputMode="decimal"
                                              min="0"
                                              onChange={(event) =>
                                                setComponentPrices(
                                                  (current) => ({
                                                    ...current,
                                                    [key]: event.target.value,
                                                  }),
                                                )
                                              }
                                              placeholder="À saisir"
                                              step="0.01"
                                              type="number"
                                              value={
                                                savedValue ??
                                                (initialPrice
                                                  ? String(initialPrice)
                                                  : "")
                                              }
                                            />
                                            <small>€ HT</small>
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
  return (
    <div className="screen">
      <ScreenHeader
        eyebrow="CONFIGURATION"
        title="Paramètres"
        description="Uniquement les réglages nécessaires."
      />
      <div className="settings-grid">
        <SettingsCard
          icon={<Truck />}
          title="Fournisseurs"
          text="Coordonnées, e-mails et conditions"
          value="3 fournisseurs"
        />
        <SettingsCard
          icon={<CircleUserRound />}
          title="Sociétés"
          text="Noms affichés dans les dispatchs"
          value="4 sociétés"
        />
        <SettingsCard
          icon={<Mail />}
          title="E-mail de commande"
          text="Objet et signature par défaut"
          value="Configuré"
        />
        <SettingsCard
          icon={<FileText />}
          title="Bon fournisseur"
          text="Adresse de livraison et numérotation"
          value="CMD-2026-…"
        />
      </div>
      <section className="panel minimal-note">
        <ShieldCheck size={22} />
        <div>
          <strong>Paramètres volontairement limités</strong>
          <p>
            Pas d’options inutiles : le CRM reste facile à comprendre et à
            maintenir.
          </p>
        </div>
      </section>
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
function SettingsCard({
  icon,
  title,
  text,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  value: string;
}) {
  return (
    <article className="panel settings-card">
      <span className="settings-icon">{icon}</span>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
        <strong>{value}</strong>
      </div>
      <ChevronRight size={19} />
    </article>
  );
}
