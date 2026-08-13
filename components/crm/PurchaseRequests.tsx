"use client";
import { useMemo, useState } from "react";
import {
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardPlus,
  Minus,
  PackageOpen,
  Plus,
  Search,
  Send,
} from "lucide-react";
import {
  money,
  productFamilies,
  productSection,
  products,
} from "@/lib/crm-data";

type Quantities = Record<number, number>;

export function PurchaseRequests() {
  const [creating, setCreating] = useState(false),
    [sent, setSent] = useState(false),
    [query, setQuery] = useState(""),
    [family, setFamily] = useState("Tous"),
    [quantities, setQuantities] = useState<Quantities>({}),
    [open, setOpen] = useState<number | null>(null);
  const filtered = useMemo(
    () =>
      products
        .filter(
          (product) =>
            (family === "Tous" || product.family === family) &&
            `${product.name} ${product.offers[0].reference}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          `${a.family} ${productSection(a)} ${a.name}`.localeCompare(
            `${b.family} ${productSection(b)} ${b.name}`,
            "fr",
          ),
        ),
    [family, query],
  );
  const selected = products.filter(
    (product) => (quantities[product.id] || 0) > 0,
  );
  const change = (id: number, value: number) =>
    setQuantities((current) => ({ ...current, [id]: Math.max(0, value) }));
  if (sent)
    return (
      <div className="screen success-screen">
        <div className="success-card">
          <div className="success-icon">
            <Check size={34} />
          </div>
          <span className="eyebrow">DEMANDE ENVOYÉE</span>
          <h1>La demande est enregistrée</h1>
          <p>
            <strong>DA-2026-012</strong> contient {selected.length}{" "}
            référence(s). Les quantités sont globales, sans répartition par
            société.
          </p>
          <div className="success-actions">
            <button
              className="secondary-btn"
              onClick={() => {
                setSent(false);
                setCreating(false);
                setQuantities({});
              }}
            >
              Voir les demandes
            </button>
            <button
              className="primary-btn"
              onClick={() => {
                setSent(false);
                setQuantities({});
              }}
            >
              <ClipboardPlus size={17} />
              Nouvelle demande
            </button>
          </div>
        </div>
      </div>
    );
  if (!creating)
    return (
      <div className="screen">
        <div className="page-title standard">
          <div>
            <span className="eyebrow">ENTREPÔT</span>
            <h1>Demandes d’achat</h1>
            <p>Les besoins transmis à l’acheteur, en quantité globale.</p>
          </div>
          <button className="primary-btn" onClick={() => setCreating(true)}>
            <Plus size={18} />
            Nouvelle demande
          </button>
        </div>
        <section className="panel request-overview">
          <div className="request-intro">
            <span className="request-intro-icon">
              <ClipboardPlus />
            </span>
            <div>
              <h2>Demande simple pour l’entrepôt</h2>
              <p>
                Choisissez les références et indiquez seulement le nombre total
                de pièces, cartons, coffrets ou ensembles.
              </p>
            </div>
          </div>
          <div className="request-list-head">
            <span>Demande</span>
            <span>Demandeur</span>
            <span>Date</span>
            <span>Références</span>
            <span>Statut</span>
            <span />
          </div>
          <div className="request-list-row">
            <strong>DA-2026-011</strong>
            <span>Entrepôt HM Group</span>
            <span>12 août 2026</span>
            <span>6</span>
            <i className="status sent">À commander</i>
            <ChevronRight size={18} />
          </div>
        </section>
      </div>
    );
  return (
    <div className="screen">
      <div className="page-title standard">
        <div>
          <button className="back-link" onClick={() => setCreating(false)}>
            ← Retour aux demandes
          </button>
          <h1>Nouvelle demande d’achat</h1>
          <p>
            Saisie globale uniquement — aucune société ni équipe à renseigner.
          </p>
        </div>
        <span className="draft-tag">Brouillon</span>
      </div>
      <div className="request-layout">
        <section className="panel request-catalog">
          <div className="request-toolbar">
            <div className="search-box">
              <Search size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Produit ou référence…"
              />
            </div>
            <select
              value={family}
              onChange={(event) => setFamily(event.target.value)}
            >
              {productFamilies.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="request-products">
            {filtered.map((product) => {
              const quantity = quantities[product.id] || 0,
                isOpen = open === product.id,
                offer = product.offers[0];
              return (
                <article
                  className={
                    quantity ? "request-product selected" : "request-product"
                  }
                  key={product.id}
                >
                  <div className="request-product-icon">
                    {product.kind === "ensemble" ? (
                      <PackageOpen size={20} />
                    ) : (
                      <Box size={20} />
                    )}
                  </div>
                  <div className="request-product-copy">
                    <span>
                      {product.family === "Électricité"
                        ? `Électricité · ${productSection(product)}`
                        : product.family}
                    </span>
                    <h3>{product.name}</h3>
                    <small>
                      Réf. {offer.reference} · {product.unit} ·{" "}
                      {offer.price ? money(offer.price) : "Prix à saisir"}
                    </small>
                    {product.kind === "ensemble" && (
                      <button
                        className="composition-toggle"
                        onClick={() => setOpen(isOpen ? null : product.id)}
                      >
                        <ChevronDown size={14} />
                        Détail des sous-produits
                      </button>
                    )}
                    {isOpen && (
                      <div className="composition-box">
                        {product.contents?.length ? (
                          product.contents.map((item) => (
                            <span className="component-line" key={item.name}>
                              <span>
                                {item.quantity} × {item.name}
                              </span>
                              <b>{money(item.unitPrice)} / unité</b>
                            </span>
                          ))
                        ) : (
                          <span>
                            Composition détaillée à compléter dans la fiche
                            produit.
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="number-control compact">
                    <button
                      aria-label="Retirer"
                      onClick={() => change(product.id, quantity - 1)}
                    >
                      <Minus size={15} />
                    </button>
                    <strong>{quantity}</strong>
                    <button
                      aria-label="Ajouter"
                      onClick={() => change(product.id, quantity + 1)}
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
        <aside className="panel request-summary">
          <div className="summary-head">
            <span>
              <Send size={18} />
            </span>
            <div>
              <h2>Demande globale</h2>
              <p>{selected.length} référence(s)</p>
            </div>
          </div>
          <div className="summary-lines">
            {selected.length === 0 ? (
              <div className="empty-summary">
                <PackageOpen size={25} />
                <p>Ajoutez les produits demandés.</p>
              </div>
            ) : (
              selected.map((product) => {
                const offer = product.offers[0];
                return (
                  <div key={product.id}>
                    <span>
                      <strong>{product.name}</strong>
                      <small>
                        {product.unit} ·{" "}
                        {offer.price ? money(offer.price) : "Prix à saisir"}
                      </small>
                    </span>
                    <b>{quantities[product.id]}</b>
                  </div>
                );
              })
            )}
          </div>
          <div className="global-note">
            <Check size={16} />
            <span>
              <strong>Quantités globales</strong>
              <small>Aucune répartition par société.</small>
            </span>
          </div>
          <button
            className="primary-btn request-submit"
            disabled={!selected.length}
            onClick={() => setSent(true)}
          >
            <Send size={17} />
            Envoyer la demande
          </button>
        </aside>
      </div>
    </div>
  );
}
