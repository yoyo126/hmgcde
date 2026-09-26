import { Fragment, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Search,
  X,
  Send,
  Users,
} from "lucide-react";
import {
  companies,
  componentPrice,
  type CompanyKey,
  money,
  productSection,
  type Product,
} from "@/lib/crm-data";
import { useCatalogProducts } from "@/lib/use-catalog-products";
import {
  createMailPreview,
  copyOrderEmail,
  mailtoUrl,
  nextOrderId,
  orderReference,
  saveOrder,
  type StoredOrder,
} from "@/lib/order-storage";
import type { ScreenId } from "./Sidebar";
import { getPurchasingSettings } from "@/lib/settings-storage";
import { repartir } from "@/lib/dispatch";
import { usePurchasingSettings } from "@/lib/use-purchasing-settings";
import { NumberControl } from "./NumberControl";
type Teams = Record<CompanyKey, number>;
type Selected = Record<number, number>;
type Dispatches = Record<number, Record<CompanyKey, number>>;
export function NewOrder({
  onNavigate,
  initialOrder,
  remainingDrafts = 0,
  onNextDraft,
}: {
  onNavigate: (id: ScreenId) => void;
  initialOrder?: StoredOrder;
  remainingDrafts?: number;
  onNextDraft?: () => void;
}) {
  const settings = usePurchasingSettings();
  const [step, setStep] = useState(initialOrder ? 4 : 2),
    [teams, setTeams] = useState<Teams>(
      () => getPurchasingSettings().defaultTeams,
    ),
    // Volontairement vide : présélectionner un fournisseur, c'est risquer
    // d'envoyer la commande au mauvais sans s'en apercevoir.
    [supplier, setSupplier] = useState(initialOrder?.supplier || ""),
    [selected, setSelected] = useState<Selected>(() =>
      Object.fromEntries(
        initialOrder?.lines.map((line) => [line.productId, line.quantity]) || [],
      ),
    ),
    [dispatchOverrides, setDispatchOverrides] = useState<Dispatches>(() =>
      Object.fromEntries(
        initialOrder?.lines
          .filter((line) => line.dispatch)
          .map((line) => [line.productId, line.dispatch]) || [],
      ) as Dispatches,
    ),
    [query, setQuery] = useState(""),
    [family, setFamily] = useState(""),
    [group, setGroup] = useState(""),
    [sent, setSent] = useState(false),
    [mailOpen, setMailOpen] = useState(false),
    [editingRecap, setEditingRecap] = useState(false),
    [showTeams, setShowTeams] = useState(false),
    [orderId] = useState(() => initialOrder?.id || nextOrderId()),
    [reference] = useState(() => initialOrder?.reference || orderReference());
  const products = useCatalogProducts();
  const families = [...new Set(products.map((product) => product.family))];
  const totalTeams = Math.max(
    1,
    Object.values(teams).reduce((a, b) => a + b, 0),
  );
  // Comparatif des fournisseurs : replié par défaut, car sept colonnes de
  // prix mangent la largeur des noms. On le déplie quand on arbitre.
  const [comparatif, setComparatif] = useState(false);

  // Le catalogue est visible dès l'ouverture : les filtres restreignent, ils
  // ne conditionnent plus l'affichage.
  // Le fournisseur se choisit à la validation : on compose d'abord sa
  // commande, on désigne ensuite chez qui on la passe. Le catalogue entier
  // est donc proposé, sans dépendre d'un fournisseur.
  const chezCeFournisseur = products;
  const countFor = (nomFamille: string) =>
    chezCeFournisseur.filter((p) => !nomFamille || p.family === nomFamille).length;

  /**
   * Offre de référence : celle du fournisseur retenu, sinon la première qui
   * porte un conditionnement réel — afficher « À renseigner » quand une autre
   * offre connaît la couronne ou le carton n'aide personne.
   */
  const offreDe = (produit: Product) =>
    produit.offers.find((o) => o.supplier === supplier) ||
    produit.offers.find((o) => o.packaging && o.packaging !== "À renseigner") ||
    produit.offers[0];

  /** Prix le plus bas connu, tous fournisseurs confondus. */
  const meilleurPrix = (produit: Product) => {
    const prix = produit.offers.map((o) => o.price).filter((v) => v > 0);
    return prix.length ? Math.min(...prix) : 0;
  };
  const recherche = query.trim().toLowerCase();
  const filtered = chezCeFournisseur.filter(
    (p) =>
      (!family || p.family === family) &&
      (!group || productSection(p) === group) &&
      (!recherche ||
        p.name.toLowerCase().includes(recherche) ||
        (p.code || "").toLowerCase().includes(recherche) ||
        p.offers.some((o) => (o.reference || "").toLowerCase().includes(recherche))),
  );
  // Le catalogue est présenté par groupes plutôt qu'en une liste continue :
  // 75 lignes d'affilée se lisent mal, surtout au doigt.
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

  /**
   * Total de la commande.
   *
   * Tant qu'aucun fournisseur n'est désigné — ce qui est le cas pendant toute
   * la sélection — on additionne les prix les plus bas connus, ceux-là mêmes
   * qui s'affichent sur les lignes. Auparavant le total cherchait le prix du
   * fournisseur retenu et retombait donc à zéro, alors que chaque ligne
   * affichait un montant.
   */
  const total = useMemo(
    () =>
      Object.entries(selected).reduce((sum, [id, quantite]) => {
        const produit = products.find((p) => p.id === Number(id));
        if (!produit) return sum;
        const offre = supplier
          ? produit.offers.find((x) => x.supplier === supplier)
          : undefined;
        const prix = offre?.price || meilleurPrix(produit);
        return sum + prix * quantite;
      }, 0),
    [products, selected, supplier],
  );
  const team = (key: CompanyKey, value: number) =>
      setTeams((t) => ({ ...t, [key]: Math.max(0, value) })),
    qty = (id: number, value: number) =>
      setSelected((s) => ({ ...s, [id]: Math.max(0, value) }));
  // Le calcul vit dans @/lib/dispatch et est vérifié automatiquement.
  const sharesFor = (n: number) =>
    repartir(n, companies.map((c) => teams[c.key] || 0));

  const dispatchFor = (productId: number, quantity: number) => {
    const existant = dispatchOverrides[productId];
    if (existant) return existant;
    const parts = sharesFor(quantity);
    return Object.fromEntries(
      companies.map((company, index) => [company.key, parts[index]]),
    ) as Record<CompanyKey, number>;
  };
  const updateDispatch = (
    productId: number,
    quantity: number,
    company: CompanyKey,
    value: number,
  ) =>
    setDispatchOverrides((current) => ({
      ...current,
      [productId]: {
        ...dispatchFor(productId, quantity),
        [company]: Math.max(0, value),
      },
    }));
  const selectedLines = Object.entries(selected).filter(([, quantity]) => quantity > 0);
  const dispatchValid = selectedLines.every(([id, quantity]) =>
    Object.values(dispatchFor(Number(id), quantity)).reduce((sum, value) => sum + value, 0) === quantity,
  );
  const companyTotals = Object.fromEntries(
    companies.map((company) => [
      company.key,
      selectedLines.reduce(
        (sum, [id, quantity]) =>
          sum + dispatchFor(Number(id), quantity)[company.key],
        0,
      ),
    ]),
  ) as Record<CompanyKey, number>;
  const buildOrder = (status: "Brouillon" | "Envoyée"): StoredOrder => {
    const order: StoredOrder = {
      id: orderId,
      reference,
      supplier,
      date: new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date()),
      status,
      lines: Object.entries(selected)
        .filter(([, quantity]) => quantity > 0)
        .map(([id, quantity]) => {
          const product = products.find((item) => item.id === Number(id))!;
          const offer = product.offers.find(
            (item) => item.supplier === supplier,
          )!;
          return {
            productId: product.id,
            name: product.name,
            packaging: offer.packaging,
            quantity,
            unitPrice: offer.price,
            components: product.contents?.map(({ name, quantity }) => ({
              name,
              quantity,
            })),
            dispatch: dispatchFor(product.id, quantity),
          };
        }),
      total,
      sourceRequestId: initialOrder?.sourceRequestId,
    };
    return status === "Envoyée"
      ? { ...order, email: createMailPreview(order) }
      : order;
  };
  const createOrder = () => {
    saveOrder(buildOrder("Brouillon"));
    setSent(true);
  };
  const markEmailSent = async () => {
    const order = buildOrder("Envoyée");
    saveOrder(order);
    const copied = await copyOrderEmail(order);
    setMailOpen(true);
    if (!copied) {
      window.alert("Le tableau n’a pas pu être copié. Réessaie depuis Safari ou Chrome.");
      return;
    }
    window.open(mailtoUrl(order.email!, false), "_self");
  };
  if (sent)
    return (
      <div className="screen success-screen">
        <div className="success-card">
          <div className="success-icon">
            <Check size={34} />
          </div>
          <span className="eyebrow">COMMANDE ENREGISTRÉE</span>
          <h1>Prête à être envoyée</h1>
          <p>
            La commande <strong>{reference}</strong> a été créée pour{" "}
            {supplier}. Le bon fournisseur ne contient aucune information sur
            les équipes.
          </p>
          <div className="success-actions">
            {remainingDrafts > 0 && onNextDraft && (
              <button className="primary-btn" onClick={onNextDraft}>
                Finaliser la commande suivante ({remainingDrafts})
              </button>
            )}
            <button
              className="secondary-btn"
              onClick={() => onNavigate("orders")}
            >
              Voir les commandes
            </button>
            <button className="primary-btn" onClick={markEmailSent}>
              <Send size={17} />
              Copier le tableau et ouvrir Mail
            </button>
          </div>
          {mailOpen && (
            <div className="sent-mail-preview compact-mail-preview">
              <strong>Le tableau complet est copié</strong>
              <span>Dans Mail, maintiens ton doigt dans le message puis choisis « Coller ».</span>
              <span>À : {buildOrder("Envoyée").email?.to || "À renseigner dans Paramètres"}</span>
              <span>Objet : {settings.mailSubject}</span>
              <button
                className="text-btn"
                onClick={() => onNavigate("orders")}
              >
                Consulter la commande et l’e-mail
              </button>
            </div>
          )}
        </div>
      </div>
    );
  return (
    <div className="screen">
      <div className="page-title">
        <div>
          <button className="back-link" onClick={() => onNavigate("dashboard")}>
            <ArrowLeft size={17} />
            Retour
          </button>
          <h1>Nouvelle commande</h1>
          <p>Créez et répartissez une commande fournisseur.</p>
        </div>
        <div className="draft-tag">Brouillon automatique</div>
      </div>
      <div className="stepper two-steps">
        {[
          { id: 2, label: "Produits" },
          { id: 4, label: "Validation" },
        ].map(
          ({ id, label }, i) => (
            <div
              key={label}
              className={
                "step " +
                (step === id ? "active " : "") +
                (step > id ? "done" : "")
              }
            >
              <span>{step > id ? <Check size={15} /> : i + 1}</span>
              <div>
                <small>ÉTAPE {i + 1}</small>
                <strong>{label}</strong>
              </div>
            </div>
          ),
        )}
      </div>
      <section
        className={
          "panel wizard-panel" + (step === 2 ? " wizard-panel-large" : "")
        }
      >
        {step === 1 && (
          <div className="wizard-content">
            <Heading
              icon={<Users />}
              title="Nombre d’équipes par société"
              text="Ces valeurs servent uniquement au calcul de la répartition."
            />
            <div className="teams-grid">
              {companies.map((c) => (
                <div className="team-card" key={c.key}>
                  <div className="company-line">
                    <span
                      className="company-dot"
                      style={{ background: c.color }}
                    />
                    <div>
                      <strong>{c.name}</strong>
                      <small>Nombre d’équipes</small>
                    </div>
                  </div>
                  <NumberControl
                    value={teams[c.key]}
                    label={`Équipes ${c.name}`}
                    onMinus={() => team(c.key, teams[c.key] - 1)}
                    onPlus={() => team(c.key, teams[c.key] + 1)}
                    onSet={(valeur) => team(c.key, valeur)}
                  />
                </div>
              ))}
            </div>
            <Info
              icon={<Users />}
              title={totalTeams + " équipes au total"}
              text="La répartition sera calculée proportionnellement entre les quatre sociétés."
            />
          </div>
        )}
        {step === 2 && (
          /* Étape Produits : un vrai tableau, comme la maquette validée.
             L'ancienne version empilait nom, famille et conditionnement dans
             des blocs de 78 px de haut, sans en-tête de colonnes : aucune
             feuille de style ne pouvait en faire un tableau compact. */
          <div className="comptoir-avec-panier">
          <div className="comptoir">
            <div className="comptoir-outils">
              <div className="comptoir-recherche">
                <Search size={16} />
                <input
                  autoFocus
                  placeholder="Rechercher un produit, une référence…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                {query && (
                  <button aria-label="Effacer la recherche" onClick={() => setQuery("")}>
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="comptoir-bascule" role="group" aria-label="Affichage des prix">
                <button aria-pressed={!comparatif} onClick={() => setComparatif(false)}>
                  Meilleur prix
                </button>
                <button aria-pressed={comparatif} onClick={() => setComparatif(true)}>
                  Tous les fournisseurs
                </button>
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
              {families.map((name) => (
                <button
                  key={name}
                  className={family === name ? "actif" : ""}
                  onClick={() => {
                    setFamily(family === name ? "" : name);
                    setGroup("");
                  }}
                >
                  {name} <b>{countFor(name)}</b>
                </button>
              ))}
            </div>

            <div className="comptoir-table">
              <table>
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th>Conditionnement</th>
                    {comparatif ? (
                      settings.suppliers.map(({ name }) => (
                        <th key={name} className="chiffre">
                          {name.split(" ")[0]}
                        </th>
                      ))
                    ) : (
                      <th className="chiffre">Meilleur prix</th>
                    )}
                    <th className="chiffre">Qté</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map(({ titre, produits }) => (
                    <Fragment key={titre}>
                      <tr className="comptoir-section">
                        <td colSpan={comparatif ? settings.suppliers.length + 3 : 4}>
                          {titre} — {produits.length} produit(s)
                        </td>
                      </tr>
                      {produits.map((p) => {
                        const offre = offreDe(p);
                        const n = selected[p.id] || 0;
                        const meilleur = meilleurPrix(p);
                        return (
                          <tr key={p.id} className={n ? "retenue" : ""}>
                            <td>
                              <strong>{p.name}</strong>
                              {p.code && <span className="comptoir-ref">{p.code}</span>}
                            </td>
                            <td className="comptoir-cond">
                              {offre?.packaging && offre.packaging !== "À renseigner"
                                ? offre.packaging
                                : p.unit}
                            </td>
                            {comparatif ? (
                              settings.suppliers.map(({ name }) => {
                                const prix =
                                  p.offers.find((o) => o.supplier === name)?.price || 0;
                                return (
                                  <td
                                    key={name}
                                    className={
                                      prix > 0 && prix === meilleur
                                        ? "chiffre comptoir-meilleur"
                                        : "chiffre comptoir-autre"
                                    }
                                  >
                                    {prix ? money(prix) : "—"}
                                  </td>
                                );
                              })
                            ) : (
                              <td className="chiffre">
                                {meilleur ? (
                                  <span className="comptoir-meilleur">{money(meilleur)}</span>
                                ) : (
                                  <span className="comptoir-autre">à saisir</span>
                                )}
                              </td>
                            )}
                            <td className="chiffre">
                              <NumberControl
                                compact
                                value={n}
                                label={`Quantité ${p.name}`}
                                onMinus={() => qty(p.id, n - 1)}
                                onPlus={() => qty(p.id, n + 1)}
                                onSet={(valeur) => qty(p.id, valeur)}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                  {!filtered.length && (
                    <tr>
                      <td colSpan={comparatif ? settings.suppliers.length + 3 : 4} className="comptoir-vide">
                        Aucun produit ne correspond à cette recherche.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Panier : rétabli à la demande, dans la langue du comptoir. */}
          <aside className="comptoir-panier">
            <div className="panier-tete">
              <span>Votre commande</span>
              <b>{selectedLines.length} réf.</b>
            </div>
            <div className="panier-lignes">
              {selectedLines.length ? (
                selectedLines.map(([id, quantite]) => {
                  const produit = products.find((item) => item.id === Number(id));
                  if (!produit) return null;
                  const prix = meilleurPrix(produit);
                  return (
                    <div className="panier-ligne" key={id}>
                      <span>
                        <strong>{produit.name}</strong>
                        <small>
                          {quantite} × {offreDe(produit)?.packaging &&
                          offreDe(produit)?.packaging !== "À renseigner"
                            ? offreDe(produit)?.packaging
                            : produit.unit}
                        </small>
                      </span>
                      <b>{prix ? money(prix * quantite) : "—"}</b>
                      <button
                        aria-label={`Retirer ${produit.name}`}
                        onClick={() => qty(Number(id), 0)}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  );
                })
              ) : (
                <p className="panier-vide">Ajoutez les produits à commander.</p>
              )}
            </div>
            {selectedLines.length > 0 && (
              <div className="panier-total">
                <span>Total estimé</span>
                <strong>{money(total)}</strong>
              </div>
            )}
            <p className="panier-note">
              Fournisseur choisi à l'étape suivante. Les prix affichés sont les plus
              bas connus, tous fournisseurs confondus.
            </p>
          </aside>
          </div>
        )}
        {step === 3 && (
          <div className="wizard-content">
            <Heading
              icon={<Users />}
              title="Répartition par société"
              text="Le dispatch est calculé selon le nombre d’équipes. Vous pourrez le corriger."
            />
            <div className="dispatch-table">
              <div className="dispatch-head">
                <span>Produit</span>
                <span>Total</span>
                {companies.map((c) => (
                  <span key={c.key}>{c.short}</span>
                ))}
              </div>
              {Object.entries(selected)
                .filter(([, q]) => q > 0)
                .map(([id, n]) => {
                  const p = products.find((x) => x.id === Number(id))!,
                    shares = sharesFor(n);
                  return (
                    <div className="dispatch-row" key={id}>
                      <span>
                        <strong>{p.name}</strong>
                        <small>{p.unit}</small>
                      </span>
                      <span className="global-qty editable-order-qty">
                        <NumberControl
                          compact
                          value={n}
                          onMinus={() => qty(Number(id), n - 1)}
                          onPlus={() => qty(Number(id), n + 1)}
                          onSet={(valeur) => qty(Number(id), valeur)}
                        />
                      </span>
                      {shares.map((v, i) => (
                        <span className="dispatch-input" key={companies[i].key}>
                          {v}
                        </span>
                      ))}
                    </div>
                  );
                })}
            </div>
            <Info
              icon={<CheckCircle2 />}
              title="Contrôle automatique activé"
              text="La somme des quatre filiales correspond toujours à la quantité globale."
            />
          </div>
        )}
        {step === 4 && (
          <div className="wizard-content">
            <div className="final-recap-heading">
              <Heading
                icon={<CheckCircle2 />}
                title="Récapitulatif final"
                text="Tous les produits et leur répartition sont regroupés dans ce tableau."
              />
              <button
                className={editingRecap ? "primary-btn" : "secondary-btn"}
                onClick={() => setEditingRecap((editing) => !editing)}
              >
                {editingRecap ? <Check size={17} /> : null}
                {editingRecap ? "Terminer les modifications" : "Modifier le récapitulatif"}
              </button>
            </div>
            {/* C'est ici que la commande prend son fournisseur : les prix,
                le document et l'e-mail en découlent. Pour commander les mêmes
                produits ailleurs, on refait une commande avec un autre
                fournisseur. */}
            <div className="order-supplier-pick">
              <div>
                <strong>Fournisseur de cette commande</strong>
                <small>
                  Les prix, le bon de commande et l'e-mail seront les siens.
                </small>
              </div>
              <select
                aria-label="Fournisseur de la commande"
                value={supplier}
                onChange={(event) => setSupplier(event.target.value)}
              >
                <option value="">Choisir un fournisseur…</option>
                {settings.suppliers.map(({ name }) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </div>
            <div className="default-team-summary">
              <div>
                <strong>Équipes appliquées automatiquement</strong>
                <span>
                  {companies
                    .map((company) => `${company.short} : ${teams[company.key]}`)
                    .join(" · ")}
                </span>
              </div>
              <button
                className="secondary-btn"
                onClick={() => setShowTeams((visible) => !visible)}
              >
                <Users size={17} />
                {showTeams ? "Fermer" : "Modifier les équipes"}
              </button>
            </div>
            {showTeams && (
              <div className="inline-team-editor">
                <div className="teams-grid">
                  {companies.map((company) => (
                    <div className="team-card" key={company.key}>
                      <div className="company-line">
                        <span
                          className="company-dot"
                          style={{ background: company.color }}
                        />
                        <div>
                          <strong>{company.name}</strong>
                          <small>Nombre d’équipes</small>
                        </div>
                      </div>
                      <NumberControl
                        value={teams[company.key]}
                        label={`Équipes ${company.name}`}
                        onSet={(valeur) => team(company.key, valeur)}
                        onMinus={() =>
                          team(company.key, teams[company.key] - 1)
                        }
                        onPlus={() =>
                          team(company.key, teams[company.key] + 1)
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="supplier-document">
              <div className="doc-brand">
                <div className="brand-mark">HM</div>
                <div>
                  <strong>HM GROUP</strong>
                  <small>BON DE COMMANDE FOURNISSEUR</small>
                </div>
                <div className="doc-meta">
                  <strong>{reference}</strong>
                  <span>13/08/2026</span>
                </div>
              </div>
              <div className="delivery-box">
                <small>LIVRAISON</small>
                <strong>HM Group</strong>
                <span>{settings.deliveryAddress}</span>
              </div>
              <div className="doc-table">
                <div>
                  <span>PRODUIT</span>
                  <span>COND.</span>
                  <span>QTÉ</span>
                  <span>P.U. HT</span>
                  <span>TOTAL HT</span>
                  <span>CPTE</span>
                  <span>POSE</span>
                  <span>INSTAL</span>
                  <span>PAC</span>
                </div>
                {Object.entries(selected)
                  .filter(([, q]) => q > 0)
                  .map(([id, n]) => {
                    const p = products.find((x) => x.id === Number(id))!,
                      o = offreDe(p),
                      dispatch = dispatchFor(Number(id), n),
                      dispatchTotal = Object.values(dispatch).reduce(
                        (sum, value) => sum + value,
                        0,
                      );
                    return (
                      <div key={id}>
                        <span>
                          <strong>{o.supplierName}</strong>
                          <small>
                            {o.reference} · {o.brand}
                          </small>
                          {p.contents && (
                            <span className="doc-component-list">
                              {p.contents.map((item) => (
                                <span key={item.name}>
                                  <span>
                                    {item.quantity} × {item.name}
                                  </span>
                                  <b>
                                    {componentPrice(item, supplier)
                                      ? `${money(componentPrice(item, supplier))} / unité`
                                      : "Prix à saisir"}
                                  </b>
                                </span>
                              ))}
                            </span>
                          )}
                        </span>
                        <span>{o.packaging}</span>
                        <span className="validation-qty">
                          {editingRecap ? (
                            <input
                              className="recap-qty-input"
                              type="number"
                              min="0"
                              value={n}
                              onChange={(event) =>
                                qty(Number(id), Number(event.target.value))
                              }
                            />
                          ) : (
                            <strong>{n}</strong>
                          )}
                        </span>
                        <span>{o.price ? money(o.price) : "À saisir"}</span>
                        <span>
                          <strong>
                            {o.price ? money(o.price * n) : "À saisir"}
                          </strong>
                        </span>
                        {companies.map((company) => (
                          <span className="dispatch-quantity-control" key={company.key}>
                            {editingRecap ? (
                              <input
                                className="recap-qty-input"
                                type="number"
                                min="0"
                                value={dispatch[company.key]}
                                onChange={(event) =>
                                  updateDispatch(
                                    Number(id),
                                    n,
                                    company.key,
                                    Number(event.target.value),
                                  )
                                }
                              />
                            ) : (
                              <strong>{dispatch[company.key]}</strong>
                            )}
                          </span>
                        ))}
                        {dispatchTotal !== n && (
                          <small className="dispatch-error">
                            Répartition : {dispatchTotal} au lieu de {n}
                          </small>
                        )}
                      </div>
                    );
                  })}
                <div className="dispatch-total-row">
                  <span><strong>TOTAL PAR SOCIÉTÉ</strong></span>
                  <span />
                  <span>{selectedLines.reduce((sum, [, quantity]) => sum + quantity, 0)}</span>
                  <span />
                  <span />
                  {companies.map((company) => (
                    <span key={company.key}><strong>{companyTotals[company.key]}</strong></span>
                  ))}
                </div>
              </div>
              <div className="doc-note">
                Vue globale avant validation. Le nombre d’équipes n’apparaît jamais sur le document fournisseur.
              </div>
            </div>
          </div>
        )}
        <div className="wizard-footer">
          <div>
            {step === 4 && !initialOrder && (
              <button
                className="secondary-btn"
                onClick={() => setStep(2)}
              >
                <ArrowLeft size={17} />
                Précédent
              </button>
            )}
          </div>
          <div className="footer-summary">
            <span>
              {Object.values(selected).filter((q) => q > 0).length} produit(s) ·{" "}
              <strong>{money(total)}</strong>
            </span>
            {step === 2 ? (
              <button
                className="primary-btn"
                disabled={!Object.values(selected).some((quantity) => quantity > 0)}
                onClick={() => setStep(4)}
              >
                Continuer <ArrowRight size={17} />
              </button>
            ) : (
              <button
                className="primary-btn"
                onClick={createOrder}
                disabled={!dispatchValid || !supplier}
              >
                <Check size={17} />
                {!supplier
                  ? "Choisir un fournisseur"
                  : dispatchValid
                    ? "Créer la commande"
                    : "Corriger la répartition"}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
function Heading({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="wizard-heading">
      <span className="section-icon">{icon}</span>
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
    </div>
  );
}
function Info({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="info-strip">
      {icon}
      <span>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
    </div>
  );
}
