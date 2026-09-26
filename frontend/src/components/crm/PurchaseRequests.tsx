import { Fragment, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardPlus,
  Plus,
  Search,
  ShoppingCart,
  X,
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

  // Même logique que la nouvelle commande : le catalogue s'affiche dès
  // l'ouverture, les filtres ne font que restreindre.
  const recherche = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      products
        .filter(
          (product) =>
            (!family || product.family === family) &&
            (!group || productSection(product) === group) &&
            (!recherche ||
              product.name.toLowerCase().includes(recherche) ||
              (product.code || "").toLowerCase().includes(recherche) ||
              product.offers.some((offer) =>
                (offer.reference || "").toLowerCase().includes(recherche),
              )),
        ),
    // Pas de tri alphabétique : on suit l'ordre du catalogue, comme la
    // nouvelle commande, pour que les sections se présentent dans le même
    // ordre que les pastilles sur les deux écrans.
    [products, family, group, recherche],
  );

  const countFor = (nomFamille: string) =>
    products.filter((p) => !nomFamille || p.family === nomFamille).length;

  // Présentation par sections, comme pour une commande.
  const sections = useMemo(() => {
    const paquets = new Map<string, typeof filtered>();
    for (const produit of filtered) {
      const titre =
        produit.family === "Électricité"
          ? `Électricité · ${productSection(produit)}`
          : produit.family;
      paquets.set(titre, [...(paquets.get(titre) || []), produit]);
    }
    return [...paquets.entries()].map(([titre, produits]) => ({ titre, produits }));
  }, [filtered]);
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
          {/* Un vrai tableau, comme les deux écrans de saisie : mêmes
              colonnes alignées, même en-tête sombre, même densité. Le
              détail s'ouvre sur une ligne dépliée dessous, au lieu de
              faire gonfler la ligne elle-même. */}
          <div className="comptoir-table">
            <table>
              <thead>
                <tr>
                  <th>Demande</th>
                  <th>Demandeur</th>
                  <th>Date</th>
                  <th className="chiffre">Références</th>
                  <th>Statut</th>
                  <th />
                </tr>
              </thead>
              <tbody>
          {requests.map((request) => {
            const ouvrir = () => {
              markPurchaseRequestSeen(request.id);
              setRequests(getStoredRequests());
              setOpenRequest(openRequest === request.id ? null : request.id);
              // À l'ouverture, rien n'est présélectionné : ni lignes, ni
              // fournisseur. Le choix doit rester un geste conscient.
              setSelectedAssignmentProducts([]);
              setBulkSupplier("");
              setAssignmentGroup("");
            };
            return (
            <Fragment key={request.id}>
              <tr
                className={openRequest === request.id ? "retenue" : ""}
                onClick={ouvrir}
              >
                <td>
                  <button
                    className="lien-ligne"
                    aria-expanded={openRequest === request.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      ouvrir();
                    }}
                  >
                    {request.id}
                  </button>
                  {request.seen === false && (
                    <small className="new-request-pill">Nouveau</small>
                  )}
                </td>
                <td>{request.requester}</td>
                <td className="order-date">{request.date}</td>
                <td className="chiffre">{request.lines.length}</td>
                <td>
                  <i
                    className={`status request-status-${request.status
                      .toLowerCase()
                      .replaceAll(" ", "-")}`}
                  >
                    {request.status}
                  </i>
                </td>
                <td className="chiffre">
                  {openRequest === request.id ? (
                    <ChevronDown size={18} />
                  ) : (
                    <ChevronRight size={18} />
                  )}
                </td>
              </tr>
              {openRequest === request.id && (
                <tr className="ligne-depliee">
                  <td colSpan={6}>
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
                  </td>
                </tr>
              )}
            </Fragment>
            );
          })}
              </tbody>
            </table>
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
            Saisie globale uniquement — le choix des fournisseurs se fera
            ensuite.
          </p>
        </div>
        <span className="draft-tag">Brouillon</span>
      </div>
      {/* Même tableau que la nouvelle commande : les deux écrans se
          ressemblent enfin. Ici pas de prix — une demande ne porte que
          des quantités globales. */}
      <div className="comptoir-avec-panier">
        <div className="comptoir">
          <div className="comptoir-outils">
            <div className="comptoir-recherche">
              <Search size={16} />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher un produit, une référence…"
              />
              {query && (
                <button aria-label="Effacer la recherche" onClick={() => setQuery("")}>
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="comptoir-familles">
            <button
              className={family ? "" : "actif"}
              onClick={() => {
                setFamily("");
                setGroup("");
              }}
            >
              Tous <b>{countFor("")}</b>
            </button>
            {families.map((nom) => (
              <button
                key={nom}
                className={family === nom ? "actif" : ""}
                onClick={() => {
                  setFamily(family === nom ? "" : nom);
                  setGroup("");
                }}
              >
                {nom} <b>{countFor(nom)}</b>
              </button>
            ))}
          </div>

          {family && groups.length > 1 && (
            <div className="comptoir-familles comptoir-sous-familles">
              <button className={group ? "" : "actif"} onClick={() => setGroup("")}>
                Tout {family.toLowerCase()}
              </button>
              {groups.map((nom) => (
                <button
                  key={nom}
                  className={group === nom ? "actif" : ""}
                  onClick={() => setGroup(group === nom ? "" : nom)}
                >
                  {nom}
                </button>
              ))}
            </div>
          )}

          <div className="comptoir-table">
            <table>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Conditionnement</th>
                  <th className="chiffre">Qté demandée</th>
                </tr>
              </thead>
              <tbody>
                {sections.map(({ titre, produits }) => (
                  <Fragment key={titre}>
                    <tr className="comptoir-section">
                      <td colSpan={3}>
                        {titre} <b>{produits.length}</b>
                      </td>
                    </tr>
                    {produits.map((product) => {
                      const quantite = quantities[product.id] || 0;
                      // Le code interne d'abord : « à renseigner » n'est pas
                      // une référence, c'est un trou dans le tarif.
                      const reference =
                        product.code ||
                        product.offers.find(
                          (o) => o.reference && o.reference !== "À renseigner",
                        )?.reference;
                      return (
                        <Fragment key={product.id}>
                          <tr className={quantite ? "retenue" : ""}>
                            <td>
                              <strong>{product.name}</strong>
                              {reference && <span className="comptoir-ref">{reference}</span>}
                              {product.kind === "ensemble" && (
                                <button
                                  className="comptoir-detail"
                                  onClick={() =>
                                    setOpenProduct(
                                      openProduct === product.id ? null : product.id,
                                    )
                                  }
                                >
                                  <ChevronDown size={13} />
                                  {openProduct === product.id
                                    ? "Masquer le détail"
                                    : "Détail du lot"}
                                </button>
                              )}
                            </td>
                            <td className="comptoir-cond">{packagingFor(product.id)}</td>
                            <td className="chiffre">
                              <NumberControl
                                compact
                                value={quantite}
                                label={`Quantité de ${product.name}`}
                                onMinus={() => change(product.id, quantite - 1)}
                                onPlus={() => change(product.id, quantite + 1)}
                                onSet={(valeur) => change(product.id, valeur)}
                              />
                            </td>
                          </tr>
                          {openProduct === product.id && !!product.contents?.length && (
                            <tr className="comptoir-composition">
                              <td colSpan={3}>
                                {product.contents.map((item) => (
                                  <span key={item.name}>
                                    {item.quantity} × {item.name}
                                  </span>
                                ))}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </Fragment>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={3} className="comptoir-vide">
                      Aucun produit ne correspond à cette recherche.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="comptoir-panier">
          <div className="panier-tete">
            <span>Votre demande</span>
            <b>{selected.length} réf.</b>
          </div>
          <div className="panier-lignes">
            {selected.length ? (
              selected.map((product) => (
                <div className="panier-ligne" key={product.id}>
                  <span>
                    <strong>{product.name}</strong>
                    <small>{packagingFor(product.id)}</small>
                  </span>
                  <b>{quantities[product.id]}</b>
                  <button
                    aria-label={`Retirer ${product.name}`}
                    onClick={() => change(product.id, 0)}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))
            ) : (
              <p className="panier-vide">Ajoutez les produits demandés.</p>
            )}
          </div>
          <p className="panier-note">
            Quantités globales : les fournisseurs seront choisis par l’acheteur.
          </p>
          <button
            className="primary-btn panier-valider"
            disabled={!selected.length}
            onClick={submitRequest}
          >
            <ClipboardPlus size={16} /> Envoyer la demande
          </button>
        </aside>
      </div>
    </div>
  );
}
