"use client";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Minus,
  Package,
  Plus,
  Search,
  Send,
  Users,
} from "lucide-react";
import {
  companies,
  componentPrice,
  type CompanyKey,
  money,
  productSection,
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
import { usePurchasingSettings } from "@/lib/use-purchasing-settings";
type Teams = Record<CompanyKey, number>;
type Selected = Record<number, number>;
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
    [supplier, setSupplier] = useState(
      initialOrder?.supplier || settings.suppliers[0]?.name || "",
    ),
    [selected, setSelected] = useState<Selected>(() =>
      Object.fromEntries(
        initialOrder?.lines.map((line) => [line.productId, line.quantity]) || [],
      ),
    ),
    [query, setQuery] = useState(""),
    [family, setFamily] = useState("Tous"),
    [group, setGroup] = useState("Tous les groupes"),
    [sent, setSent] = useState(false),
    [mailOpen, setMailOpen] = useState(false),
    [showTeams, setShowTeams] = useState(false),
    [orderId] = useState(() => initialOrder?.id || nextOrderId()),
    [reference] = useState(() => initialOrder?.reference || orderReference());
  const products = useCatalogProducts();
  const families = ["Tous", ...new Set(products.map((product) => product.family))];
  const groups = [
    "Tous les groupes",
    ...new Set(
      products
        .filter((product) => family === "Tous" || product.family === family)
        .map((product) => productSection(product)),
    ),
  ];
  const totalTeams = Math.max(
    1,
    Object.values(teams).reduce((a, b) => a + b, 0),
  );
  const filtered = products.filter(
    (p) =>
      p.offers.some((o) => o.supplier === supplier) &&
      (family === "Tous" || p.family === family) &&
      (group === "Tous les groupes" || productSection(p) === group) &&
      p.name.toLowerCase().includes(query.toLowerCase()),
  );
  const total = useMemo(
    () =>
      Object.entries(selected).reduce((sum, [id, qty]) => {
        const o = products
          .find((p) => p.id === Number(id))
          ?.offers.find((x) => x.supplier === supplier);
        return sum + (o?.price || 0) * qty;
      }, 0),
    [products, selected, supplier],
  );
  const team = (key: CompanyKey, value: number) =>
      setTeams((t) => ({ ...t, [key]: Math.max(0, value) })),
    qty = (id: number, value: number) =>
      setSelected((s) => ({ ...s, [id]: Math.max(0, value) }));
  const sharesFor = (n: number) => {
    let used = 0;
    return companies.map((c, i) => {
      const value =
        i === companies.length - 1
          ? Math.max(0, n - used)
          : Math.min(n - used, Math.round((n * teams[c.key]) / totalTeams));
      used += value;
      return value;
    });
  };
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
            dispatch: Object.fromEntries(
              companies.map((company, index) => [
                company.key,
                sharesFor(quantity)[index],
              ]),
            ) as Record<CompanyKey, number>,
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
      <section className="panel wizard-panel">
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
                    onMinus={() => team(c.key, teams[c.key] - 1)}
                    onPlus={() => team(c.key, teams[c.key] + 1)}
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
          <div className="wizard-content">
            <Heading
              icon={<Package />}
              title="Sélection des produits"
              text="Les quantités sont saisies en ensembles, cartons ou pièces."
            />
            <div className="product-toolbar">
              <label>
                FOURNISSEUR
                <select
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                >
                  {settings.suppliers.map(({ name }) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>
              <label>
                CATÉGORIE
                <select
                  value={family}
                  onChange={(event) => {
                    setFamily(event.target.value);
                    setGroup("Tous les groupes");
                  }}
                >
                  {families.map((name) => <option key={name}>{name}</option>)}
                </select>
              </label>
              <label>
                GROUPE
                <select value={group} onChange={(event) => setGroup(event.target.value)}>
                  {groups.map((name) => <option key={name}>{name}</option>)}
                </select>
              </label>
              <div className="search-box">
                <Search size={18} />
                <input
                  placeholder="Rechercher un produit…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="select-products">
              {filtered.map((p) => {
                const o = p.offers.find((x) => x.supplier === supplier)!,
                  n = selected[p.id] || 0;
                return (
                  <div
                    className={"select-product " + (n ? "chosen" : "")}
                    key={p.id}
                  >
                    <div className="product-check">
                      {n ? <Check size={15} /> : null}
                    </div>
                    <div className="product-copy">
                      <strong>{p.name}</strong>
                      <span>
                        {p.family === "Électricité"
                          ? `Électricité · ${productSection(p)}`
                          : p.family}
                      </span>
                      <small>
                        {o.packaging}
                        {p.kind === "ensemble" ? " · Ensemble complet" : ""}
                      </small>
                      {p.contents && (
                        <div className="order-components">
                          {p.contents.map((item) => (
                            <span key={item.name}>
                              {item.quantity} × {item.name} —{" "}
                              <b>
                                {componentPrice(item, supplier)
                                  ? `${money(componentPrice(item, supplier))} / unité`
                                  : "Prix à saisir"}
                              </b>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <strong className="unit-price">
                      {o.price ? money(o.price) : "Prix à saisir"}
                      <small>/ {p.unit.toLowerCase()}</small>
                    </strong>
                    <NumberControl
                      compact
                      value={n}
                      onMinus={() => qty(p.id, n - 1)}
                      onPlus={() => qty(p.id, n + 1)}
                    />
                  </div>
                );
              })}
            </div>
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
            <Heading
              icon={<CheckCircle2 />}
              title="Bon fournisseur"
              text="Vérifiez le document avant de créer la commande."
            />
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
                      o = p.offers.find((x) => x.supplier === supplier)!,
                      shares = sharesFor(n);
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
                          <NumberControl
                            compact
                            value={n}
                            onMinus={() => qty(Number(id), n - 1)}
                            onPlus={() => qty(Number(id), n + 1)}
                          />
                        </span>
                        <span>{o.price ? money(o.price) : "À saisir"}</span>
                        <span>
                          <strong>
                            {o.price ? money(o.price * n) : "À saisir"}
                          </strong>
                        </span>
                        {shares.map((value, index) => (
                          <span key={companies[index].key}>{value}</span>
                        ))}
                      </div>
                    );
                  })}
              </div>
              <div className="doc-note">
                Le nombre d’équipes n’apparaît jamais sur ce document.
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
              <button className="primary-btn" onClick={createOrder}>
                <Check size={17} />
                Créer la commande
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
function NumberControl({
  value,
  onMinus,
  onPlus,
  compact,
}: {
  value: number;
  onMinus: () => void;
  onPlus: () => void;
  compact?: boolean;
}) {
  return (
    <div className={"number-control " + (compact ? "compact" : "")}>
      <button onClick={onMinus}>
        <Minus size={16} />
      </button>
      <strong>{value}</strong>
      <button onClick={onPlus}>
        <Plus size={16} />
      </button>
    </div>
  );
}
