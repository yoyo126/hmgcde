import { useMemo, useState } from "react";
import {
  Box,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardPlus,
  PackageOpen,
  Plus,
  Search,
  ShoppingCart,
} from "lucide-react";
import { money, productSection } from "@/lib/crm-data";
import { useCatalogProducts } from "@/lib/use-catalog-products";
import { usePurchasingSettings } from "@/lib/use-purchasing-settings";
import { NumberControl } from "./NumberControl";
import {
  createOrdersFromRequest,
  getStoredRequests,
  markPurchaseRequestSeen,
  nextRequestId,
  savePurchaseRequest,
  updatePurchaseRequestQuantity,
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
    [family, setFamily] = useState(""),
    [group, setGroup] = useState(""),
    [bulkSupplier, setBulkSupplier] = useState(""),
    [assignmentGroup, setAssignmentGroup] = useState(""),
    [selectedAssignmentProducts, setSelectedAssignmentProducts] = useState<number[]>([]),
    [quantities, setQuantities] = useState<Quantities>({}),
    [openProduct, setOpenProduct] = useState<number | null>(null),
    [openRequest, setOpenRequest] = useState<string | null>(null),
    [requests, setRequests] = useState<StoredPurchaseRequest[]>(() =>
      getStoredRequests(),
    );
  const products = useCatalogProducts();

  /**
   * Conditionnement du produit demandé : une couronne de 100 m et une couronne
   * de 20 m ne se commandent pas pareil, l'info manquait sur les lignes.
   * On prend celui du fournisseur retenu quand il est déjà choisi.
   */
  const packagingFor = (productId: number, supplier?: string) => {
    const product = products.find((item) => item.id === productId);
    if (!product) return "";
    const offer =
      (supplier && product.offers.find((item) => item.supplier === supplier)) ||
      product.offers.find((item) => item.packaging && item.packaging !== "À renseigner") ||
      product.offers[0];
    return offer?.packaging && offer.packaging !== "À renseigner" ? offer.packaging : product.unit;
  };
  const settings = usePurchasingSettings();
  const families = [...new Set(products.map((product) => product.family))];
  const groups = useMemo(
    () => [
      ...new Set(
        products
          .filter((product) => product.family === family)
          .map((product) => productSection(product)),
      ),
    ],
    [family, products],
  );

  const filtered = useMemo(() => {
    const searching = Boolean(query.trim());
    if (!searching && (!family || !group)) return [];
    return products
        .filter(
          (product) =>
            (searching ||
              (product.family === family && productSection(product) === group)) &&
            `${product.name} ${product.offers[0].reference}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          `${a.family} ${productSection(a)} ${a.name}`.localeCompare(
            `${b.family} ${productSection(b)} ${b.name}`,
            "fr",
          ),
        );
  }, [family, group, products, query]);
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
      seen: false,
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

  /**
   * Crée la commande des lignes cochées chez le fournisseur désigné.
   *
   * Même geste que pour une commande directe : on compose, on désigne, on
   * crée. Il n'y a plus d'étape « affecter » intermédiaire, ni de choix
   * ligne par ligne : pour un autre fournisseur, on recommence — ce qui
   * laisse la demande en « partiellement commandée » entre-temps.
   */
  const placeAssignedOrders = (request: StoredPurchaseRequest) => {
    if (!bulkSupplier || !selectedAssignmentProducts.length) return;
    const affectation = Object.fromEntries(
      request.lines
        .filter(
          (line) =>
            !line.ordered && selectedAssignmentProducts.includes(line.productId),
        )
        .map((line) => [line.productId, bulkSupplier]),
    );
    const orders = createOrdersFromRequest(request, affectation);
    setRequests(getStoredRequests());
    setSelectedAssignmentProducts([]);
    setBulkSupplier("");
    if (orders.length) onFinalize(orders);
  };

  const changeStoredQuantity = (
    requestId: string,
    productId: number,
    quantity: number,
  ) => {
    updatePurchaseRequestQuantity(requestId, productId, quantity);
    setRequests(getStoredRequests());
  };



  const selectAssignmentGroup = (request: StoredPurchaseRequest) => {
    if (!assignmentGroup) return;
    const ids = request.lines
      .filter((line) => {
        if (line.ordered) return false;
        const product = products.find((item) => item.id === line.productId);
        return product && productSection(product) === assignmentGroup;
      })
      .map((line) => line.productId);
    setSelectedAssignmentProducts(ids);
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
              markPurchaseRequestSeen(sentId);
              setSentId(null);
              setCreating(false);
              setQuantities({});
              setOpenRequest(sentId);
              setRequests(getStoredRequests());
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
                  markPurchaseRequestSeen(request.id);
                  setRequests(getStoredRequests());
                  setOpenRequest(
                    openRequest === request.id ? null : request.id,
                  );
                  setAssignments(
                    Object.fromEntries(
                      request.lines
                        .filter((line) => line.supplier && !line.ordered)
                        .map((line) => [line.productId, line.supplier!]),
                    ),
                  );
                  setSelectedAssignmentProducts([]);
                  setAssignmentGroup("");
                }}
              >
                <strong>
                  {request.id}
                  {request.seen === false && (
                    <small className="new-request-pill">Nouveau</small>
                  )}
                </strong>
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
                      <h3>Commander ces produits</h3>
                      <p>
                        Cochez les lignes, désignez leur fournisseur, créez la
                        commande. Les lignes laissées de côté restent en
                        attente : vous les commanderez ailleurs, plus tard.
                      </p>
                    </div>
                    <i className="status sent">{request.status}</i>
                  </div>
                  {request.status !== "Commandée" && (
                    <div className="bulk-supplier-tools">
                      <strong>{selectedAssignmentProducts.length} produit(s) sélectionné(s)</strong>
                      <select
                        value={assignmentGroup}
                        onChange={(event) => setAssignmentGroup(event.target.value)}
                      >
                        <option value="">Sélectionner un groupe</option>
                        {[
                          ...new Set(
                            request.lines
                              .map((line) => products.find((item) => item.id === line.productId))
                              .filter(Boolean)
                              .map((product) => productSection(product!)),
                          ),
                        ].map((name) => <option key={name}>{name}</option>)}
                      </select>
                      <button className="secondary-btn" onClick={() => selectAssignmentGroup(request)} disabled={!assignmentGroup}>
                        Cocher ce groupe
                      </button>
                      <button className="text-btn" onClick={() => setSelectedAssignmentProducts([])}>
                        Tout décocher
                      </button>
                    </div>
                  )}
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
                        <strong className="assignment-product-name">
                          {!line.ordered && (
                            <input
                              type="checkbox"
                              checked={selectedAssignmentProducts.includes(line.productId)}
                              onChange={() =>
                                setSelectedAssignmentProducts((current) =>
                                  current.includes(line.productId)
                                    ? current.filter((id) => id !== line.productId)
                                    : [...current, line.productId],
                                )
                              }
                            />
                          )}
                          {line.name}
                        </strong>
                        <small className="request-line-packaging">
                          {packagingFor(line.productId, line.supplier)}
                        </small>
                        {line.ordered ? (
                          <span>{line.quantity} {line.unit.toLowerCase()}</span>
                        ) : (
                          <NumberControl
                            compact
                            className="request-line-quantity"
                            label={`Quantité de ${line.name}`}
                            value={line.quantity}
                            onMinus={() => changeStoredQuantity(request.id, line.productId, line.quantity - 1)}
                            onPlus={() => changeStoredQuantity(request.id, line.productId, line.quantity + 1)}
                            onSet={(valeur) => changeStoredQuantity(request.id, line.productId, valeur)}
                          />
                        )}
                        {line.ordered ? (
                          <b>{line.supplier}</b>
                        ) : (
                          <span className="line-supplier-hint">
                            {/* Prix le plus bas connu, à titre indicatif : le
                                fournisseur se désigne en bas, pour toute la
                                commande. */}
                            {(() => {
                              const chiffrees = (product?.offers || []).filter((o) => o.price > 0);
                              if (!chiffrees.length) return "Prix à renseigner";
                              const meilleure = [...chiffrees].sort((a, b) => a.price - b.price)[0];
                              return `dès ${money(meilleure.price)} · ${meilleure.supplier}`;
                            })()}
                          </span>
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
                      {/* Même encadré que la validation d'une commande
                          directe : on compose, on désigne, on crée. */}
                      <div className="order-supplier-pick">
                        <div>
                          <strong>Fournisseur de cette commande</strong>
                          <small>
                            {selectedAssignmentProducts.length
                              ? `${selectedAssignmentProducts.length} ligne(s) cochée(s)` +
                                (request.lines.filter(
                                  (line) =>
                                    !line.ordered &&
                                    !selectedAssignmentProducts.includes(line.productId),
                                ).length
                                  ? ` · ${request.lines.filter(
                                      (line) =>
                                        !line.ordered &&
                                        !selectedAssignmentProducts.includes(line.productId),
                                    ).length} resteront en attente`
                                  : "")
                              : "Cochez d'abord les lignes à commander."}
                          </small>
                        </div>
                        <select
                          aria-label="Fournisseur de la commande"
                          value={bulkSupplier}
                          onChange={(event) => setBulkSupplier(event.target.value)}
                        >
                          <option value="">Choisir un fournisseur…</option>
                          {settings.suppliers.map(({ name }) => (
                            <option key={name}>{name}</option>
                          ))}
                        </select>
                        <button
                          className="primary-btn"
                          disabled={!bulkSupplier || !selectedAssignmentProducts.length}
                          onClick={() => placeAssignedOrders(request)}
                        >
                          <ShoppingCart size={17} />
                          Créer la commande
                        </button>
                      </div>
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
              onChange={(event) => {
                setFamily(event.target.value);
                setGroup("");
              }}
            >
              <option value="">Choisir une catégorie</option>
              {families.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <select value={group} onChange={(event) => setGroup(event.target.value)}>
              <option value="">Choisir un groupe</option>
              {groups.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          {!query.trim() && !family && (
            <div className="catalog-navigation-cards request-navigation-cards">
              {families.map((name) => (
                <button key={name} onClick={() => setFamily(name)}>
                  <strong>{name}</strong>
                  <small>Afficher les groupes</small>
                </button>
              ))}
            </div>
          )}
          {!query.trim() && family && !group && (
            <div className="catalog-navigation-cards request-navigation-cards group-cards">
              <button className="navigation-back-card" onClick={() => setFamily("")}>
                <strong>← Catégories</strong>
              </button>
              {groups.map((name) => (
                <button key={name} onClick={() => setGroup(name)}>
                  <strong>{name}</strong>
                  <small>Voir les produits</small>
                </button>
              ))}
            </div>
          )}
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
                      Commande par {product.unit.toLowerCase()}
                      {(() => {
                        const packaging = packagingFor(product.id);
                        return packaging && packaging !== product.unit
                          ? ` · ${packaging}`
                          : "";
                      })()}
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
                  <NumberControl
                    compact
                    label={`Quantité de ${product.name}`}
                    value={quantity}
                    onMinus={() => change(product.id, quantity - 1)}
                    onPlus={() => change(product.id, quantity + 1)}
                    onSet={(valeur) => change(product.id, valeur)}
                  />
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
                    <small>{packagingFor(product.id) || product.unit}</small>
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
