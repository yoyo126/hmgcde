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
  ShoppingCart,
} from "lucide-react";
import { productFamilies, productSection } from "@/lib/crm-data";
import { useCatalogProducts } from "@/lib/use-catalog-products";
import {
  createOrdersFromRequest,
  getStoredRequests,
  nextRequestId,
  savePurchaseRequest,
  type StoredPurchaseRequest,
  type StoredOrder,
} from "@/lib/order-storage";

type Quantities = Record<number, number>;

export function PurchaseRequests({
  onFinalize,
}: {
  onFinalize: (orders: StoredOrder[]) => void;
}) {
  const [creating, setCreating] = useState(false),
    [sentId, setSentId] = useState<string | null>(null),
    [query, setQuery] = useState(""),
    [family, setFamily] = useState("Tous"),
    [quantities, setQuantities] = useState<Quantities>({}),
    [openProduct, setOpenProduct] = useState<number | null>(null),
    [openRequest, setOpenRequest] = useState<string | null>(null),
    [assignments, setAssignments] = useState<Record<number, string>>({}),
    [requests, setRequests] = useState<StoredPurchaseRequest[]>(() =>
      getStoredRequests(),
    );
  const products = useCatalogProducts();

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
    [family, products, query],
  );
  const selected = products.filter(
    (product) => (quantities[product.id] || 0) > 0,
  );
  const change = (id: number, value: number) =>
    setQuantities((current) => ({ ...current, [id]: Math.max(0, value) }));

  const submitRequest = () => {
    const id = nextRequestId();
    savePurchaseRequest({
      id,
      requester: "Entrepôt HM Group",
      date: new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date()),
      status: "À commander",
      lines: selected.map((product) => ({
        productId: product.id,
        name: product.name,
        unit: product.unit,
        quantity: quantities[product.id],
      })),
    });
    setRequests(getStoredRequests());
    setSentId(id);
  };

  const placeAssignedOrders = (request: StoredPurchaseRequest) => {
    const orders = createOrdersFromRequest(request, assignments);
    setRequests(getStoredRequests());
    setAssignments({});
    if (orders.length) onFinalize(orders);
  };

  if (sentId)
    return (
      <div className="screen success-screen">
        <div className="success-card">
          <div className="success-icon">
            <Check size={34} />
          </div>
          <span className="eyebrow">DEMANDE ENREGISTRÉE</span>
          <h1>{sentId}</h1>
          <p>
            La demande contient {selected.length} référence(s) en quantités
            globales. L’acheteur pourra choisir un fournisseur différent pour
            chaque ligne.
          </p>
          <button
            className="primary-btn"
            onClick={() => {
              setSentId(null);
              setCreating(false);
              setQuantities({});
              setOpenRequest(sentId);
            }}
          >
            Voir la demande
          </button>
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
            <p>
              Un besoin global peut être réparti entre plusieurs fournisseurs.
            </p>
          </div>
          <button className="primary-btn" onClick={() => setCreating(true)}>
            <Plus size={18} /> Nouvelle demande
          </button>
        </div>
        <section className="panel request-overview">
          <div className="request-intro">
            <span className="request-intro-icon">
              <ClipboardPlus />
            </span>
            <div>
              <h2>Traitement des demandes entrepôt</h2>
              <p>
                Affectez chaque produit au fournisseur retenu. Une commande
                séparée sera créée automatiquement par fournisseur.
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
          {requests.map((request) => (
            <div className="request-record" key={request.id}>
              <button
                className="request-list-row request-row-button"
                onClick={() => {
                  setOpenRequest(
                    openRequest === request.id ? null : request.id,
                  );
                  setAssignments(
                    Object.fromEntries(
                      request.lines
                        .filter((line) => line.supplier && !line.ordered)
                        .map((line) => [line.productId, line.supplier]),
                    ),
                  );
                }}
              >
                <strong>{request.id}</strong>
                <span>{request.requester}</span>
                <span>{request.date}</span>
                <span>{request.lines.length}</span>
                <i
                  className={`status request-status-${request.status
                    .toLowerCase()
                    .replaceAll(" ", "-")}`}
                >
                  {request.status}
                </i>
                {openRequest === request.id ? (
                  <ChevronDown size={18} />
                ) : (
                  <ChevronRight size={18} />
                )}
              </button>
              {openRequest === request.id && (
                <div className="request-processing">
                  <div className="request-processing-head">
                    <div>
                      <h3>Répartir les achats par fournisseur</h3>
                      <p>Le choix se fait produit par produit.</p>
                    </div>
                    <i className="status sent">{request.status}</i>
                  </div>
                  <div className="request-assignment-head">
                    <span>Produit</span>
                    <span>Quantité globale</span>
                    <span>Fournisseur retenu</span>
                    <span>État</span>
                  </div>
                  {request.lines.map((line) => {
                    const product = products.find(
                      (item) => item.id === line.productId,
                    );
                    return (
                      <div
                        className="request-assignment-line"
                        key={line.productId}
                      >
                        <strong>{line.name}</strong>
                        <span>
                          {line.quantity} {line.unit.toLowerCase()}
                        </span>
                        {line.ordered ? (
                          <b>{line.supplier}</b>
                        ) : (
                          <select
                            aria-label={`Fournisseur pour ${line.name}`}
                            value={assignments[line.productId] || ""}
                            onChange={(event) =>
                              setAssignments((current) => ({
                                ...current,
                                [line.productId]: event.target.value,
                              }))
                            }
                          >
                            <option value="">À choisir</option>
                            {product?.offers.map((offer) => (
                              <option key={offer.supplier}>
                                {offer.supplier}
                              </option>
                            ))}
                          </select>
                        )}
                        <span
                          className={
                            line.ordered ? "line-ordered" : "line-pending"
                          }
                        >
                          {line.ordered ? "Commandée" : "À commander"}
                        </span>
                      </div>
                    );
                  })}
                  {request.status !== "Commandée" && (
                    <div className="request-processing-footer">
                      <small>
                        Vous pouvez commander seulement une partie maintenant
                        et terminer plus tard.
                      </small>
                      <button
                        className="primary-btn"
                        disabled={!Object.values(assignments).some(Boolean)}
                        onClick={() => placeAssignedOrders(request)}
                      >
                        <ShoppingCart size={17} /> Valider et finaliser
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
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
            Saisie globale uniquement — le choix des fournisseurs se fera
            ensuite.
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
              const quantity = quantities[product.id] || 0;
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
                      {product.unit} · {product.offers.length} fournisseur(s)
                      possible(s)
                    </small>
                    {product.kind === "ensemble" && (
                      <button
                        className="composition-toggle"
                        onClick={() =>
                          setOpenProduct(
                            openProduct === product.id ? null : product.id,
                          )
                        }
                      >
                        <ChevronDown size={14} /> Détail des sous-produits
                      </button>
                    )}
                    {openProduct === product.id && (
                      <div className="composition-box">
                        {product.contents?.map((item) => (
                          <span key={item.name}>
                            {item.quantity} × {item.name}
                          </span>
                        ))}
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
              <ClipboardPlus size={18} />
            </span>
            <div>
              <h2>Demande globale</h2>
              <p>{selected.length} référence(s)</p>
            </div>
          </div>
          <div className="summary-lines">
            {selected.length ? (
              selected.map((product) => (
                <div key={product.id}>
                  <span>
                    <strong>{product.name}</strong>
                    <small>{product.unit}</small>
                  </span>
                  <b>{quantities[product.id]}</b>
                </div>
              ))
            ) : (
              <div className="empty-summary">
                <PackageOpen size={25} />
                <p>Ajoutez les produits demandés.</p>
              </div>
            )}
          </div>
          <div className="global-note">
            <Check size={16} />
            <span>
              <strong>Quantités globales</strong>
              <small>Les fournisseurs seront choisis par l’acheteur.</small>
            </span>
          </div>
          <button
            className="primary-btn request-submit"
            disabled={!selected.length}
            onClick={submitRequest}
          >
            <ClipboardPlus size={17} /> Envoyer la demande
          </button>
        </aside>
      </div>
    </div>
  );
}
