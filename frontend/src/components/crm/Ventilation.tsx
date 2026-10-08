import { useEffect, useState } from "react";
import { Building2, Download, X } from "lucide-react";
import { companies, money } from "@/lib/crm-data";
import { filtrerCommandes } from "@/lib/order-filters";
import { getStoredOrders } from "@/lib/order-storage";
import {
  partEnPourcent,
  ventilerChaqueCommande,
  ventilerCommandes,
  ventilerParFournisseur,
} from "@/lib/ventilation";
import { nomCsv, telechargerCsv, type Cellule } from "@/lib/export-csv";
import { usePermissions } from "./permissions-context";

/**
 * Répartition des achats entre les sociétés, en euros.
 *
 * La répartition d'une commande n'existait qu'en quantités : elle partait en
 * colonnes dans l'e-mail du fournisseur et s'arrêtait là. Rien ne disait ce
 * qu'une société avait consommé sur le mois — la question même qui décide de
 * la refacturation entre les quatre sociétés du groupe.
 *
 * Le calcul vit dans @/lib/ventilation et est vérifié automatiquement : il
 * porte des montants qui serviront de base à des écritures.
 */
export function Ventilation() {
  const can = usePermissions();
  const [orders, setOrders] = useState(() => getStoredOrders()),
    [supplierFilter, setSupplierFilter] = useState(""),
    // Par défaut, les commandes envoyées seules : un brouillon n'a pas de
    // facture en face, le compter gonflerait la refacturation.
    [statut, setStatut] = useState("Envoyée"),
    [du, setDu] = useState(""),
    [au, setAu] = useState("");

  useEffect(() => {
    const refresh = () => setOrders(getStoredOrders());
    window.addEventListener("hm-purchasing-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("hm-purchasing-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const societes = companies.map((company) => company.key);
  const retenues = filtrerCommandes(orders, {
    statut,
    fournisseur: supplierFilter,
    du,
    au,
  });
  const ensemble = ventilerCommandes(retenues, societes);
  const parFournisseur = ventilerParFournisseur(retenues, societes);
  const parCommande = ventilerChaqueCommande(retenues, societes);
  const fournisseursConnus = [...new Set(orders.map((order) => order.supplier))].sort();
  const filtreActif = Boolean(supplierFilter || du || au || statut !== "Envoyée");
  const periode = [du, au].filter(Boolean).join(" au ") || "toutes périodes";

  /** Un en-tête de colonne par société, dans l'ordre des sociétés. */
  const colonnes = companies.map((company) => company.short);

  const exporterRepartition = () => {
    const lignes: Cellule[][] = [
      ["Répartition des achats par société"],
      ["Période", periode],
      ["Statut des commandes", statut || "toutes"],
      ["Fournisseur", supplierFilter || "tous"],
      ["Commandes retenues", ensemble.nombre],
      [],
      ["Société", "Montant HT", "Part du ventilé (%)"],
      ...companies.map((company) => [
        company.name,
        ensemble.parSociete[company.key],
        partEnPourcent(ensemble.parSociete[company.key], ensemble.ventile),
      ]),
      ["Total ventilé", ensemble.ventile, 100],
      ["Non imputé (livraisons globales)", ensemble.nonVentile, ""],
      ["Total commandé", ensemble.total, ""],
      [],
      ["Fournisseur", ...colonnes, "Non imputé", "Total"],
      ...parFournisseur.map((ligne) => [
        ligne.fournisseur,
        ...companies.map((company) => ligne.parSociete[company.key]),
        ligne.nonVentile,
        ligne.total,
      ]),
    ];
    telechargerCsv(nomCsv("repartition-par-societe", du, au), lignes);
  };

  const exporterDetail = () => {
    const lignes: Cellule[][] = [
      ["Commande", "Date", "Fournisseur", "Statut", ...colonnes, "Non imputé", "Total HT"],
      ...parCommande.map(({ commande, parSociete, nonVentile }) => [
        commande.id,
        commande.date,
        commande.supplier,
        commande.status,
        ...companies.map((company) => parSociete[company.key]),
        nonVentile,
        commande.total,
      ]),
    ];
    telechargerCsv(nomCsv("commandes-par-societe", du, au), lignes);
  };

  if (!can.canSeePrices) {
    return (
      <div className="screen">
        <div className="page-title standard">
          <div>
            <span className="eyebrow">COMPTABILITÉ</span>
            <h1>Répartition par société</h1>
            <p>Cet écran porte des montants : votre profil ne les affiche pas.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="page-title standard">
        <div>
          <span className="eyebrow">COMPTABILITÉ</span>
          <h1>Répartition par société</h1>
          <p>
            Ce que chaque société a consommé, en euros, d’après la répartition
            saisie sur les commandes.
          </p>
        </div>
        <div className="settings-actions">
          <button className="secondary-btn" onClick={exporterDetail}>
            <Download size={17} /> Détail des commandes
          </button>
          <button className="primary-btn" onClick={exporterRepartition}>
            <Download size={17} /> Exporter la répartition
          </button>
        </div>
      </div>

      <section className="panel table-panel">
        <div className="family-chips table-chips">
          {[
            { cle: "Envoyée", libelle: "Envoyées" },
            { cle: "", libelle: "Toutes" },
            { cle: "Brouillon", libelle: "Brouillons" },
          ].map(({ cle, libelle }) => (
            <button
              key={libelle}
              className={statut === cle ? "active" : ""}
              onClick={() => setStatut(cle)}
            >
              {libelle}
              <b>{orders.filter((order) => !cle || order.status === cle).length}</b>
            </button>
          ))}
        </div>
        <div className="filtres-commandes">
          <label>
            <span>Fournisseur</span>
            <select
              value={supplierFilter}
              onChange={(event) => setSupplierFilter(event.target.value)}
            >
              <option value="">Tous les fournisseurs</option>
              {fournisseursConnus.map((nom) => (
                <option key={nom}>{nom}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Du</span>
            <input type="date" value={du} onChange={(event) => setDu(event.target.value)} />
          </label>
          <label>
            <span>Au</span>
            <input type="date" value={au} onChange={(event) => setAu(event.target.value)} />
          </label>
          {filtreActif && (
            <button
              className="secondary-btn"
              onClick={() => {
                setSupplierFilter("");
                setDu("");
                setAu("");
                setStatut("Envoyée");
              }}
            >
              <X size={16} /> Réinitialiser
            </button>
          )}
        </div>

        <div className="bandeau-totaux">
          <div className="total-principal">
            <span>
              {ensemble.nombre} commande{ensemble.nombre > 1 ? "s" : ""} · {periode}
            </span>
            <strong>{money(ensemble.total)}</strong>
          </div>
          <div className="total-fournisseurs">
            <span>
              <b>Ventilé</b>
              {money(ensemble.ventile)}
              <small>imputé aux sociétés</small>
            </span>
            {ensemble.nonVentile !== 0 && (
              <span>
                <b>Non imputé</b>
                {money(ensemble.nonVentile)}
                <small>livraisons globales</small>
              </span>
            )}
          </div>
        </div>

        <div className="comptoir-table">
          <table>
            <thead>
              <tr>
                <th>Société</th>
                <th className="chiffre">Montant HT</th>
                <th className="chiffre">Part</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.key}>
                  <td>
                    <span className="order-reference-cell">
                      <span
                        className="company-dot"
                        style={{ background: company.color }}
                      />
                      {company.name}
                    </span>
                  </td>
                  <td className="chiffre">
                    <strong className="order-total">
                      {money(ensemble.parSociete[company.key])}
                    </strong>
                  </td>
                  <td className="chiffre">
                    {partEnPourcent(ensemble.parSociete[company.key], ensemble.ventile)} %
                  </td>
                </tr>
              ))}
              {ensemble.nonVentile !== 0 && (
                <tr>
                  <td>
                    Non imputé
                    <small> · livré globalement, sans répartition saisie</small>
                  </td>
                  <td className="chiffre">{money(ensemble.nonVentile)}</td>
                  <td className="chiffre">—</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel table-panel">
        <div className="panel-head">
          <div>
            <h2>Par fournisseur</h2>
            <p>Quelle société paie quoi, chez qui.</p>
          </div>
        </div>
        <div className="comptoir-table">
          <table>
            <thead>
              <tr>
                <th>Fournisseur</th>
                {companies.map((company) => (
                  <th className="chiffre" key={company.key}>
                    {company.short}
                  </th>
                ))}
                <th className="chiffre">Non imputé</th>
                <th className="chiffre">Total</th>
              </tr>
            </thead>
            <tbody>
              {parFournisseur.map((ligne) => (
                <tr key={ligne.fournisseur}>
                  <td>{ligne.fournisseur}</td>
                  {companies.map((company) => (
                    <td className="chiffre" key={company.key}>
                      {money(ligne.parSociete[company.key])}
                    </td>
                  ))}
                  <td className="chiffre">
                    {ligne.nonVentile === 0 ? "—" : money(ligne.nonVentile)}
                  </td>
                  <td className="chiffre">
                    <strong className="order-total">{money(ligne.total)}</strong>
                  </td>
                </tr>
              ))}
              {!parFournisseur.length && (
                <tr>
                  <td colSpan={companies.length + 3}>
                    Aucune commande sur cette période.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel table-panel">
        <div className="panel-head">
          <div>
            <h2>Détail par commande</h2>
            <p>C’est ce tableau qui se rapproche d’une facture fournisseur.</p>
          </div>
        </div>
        <div className="comptoir-table">
          <table>
            <thead>
              <tr>
                <th>Commande</th>
                <th>Date</th>
                <th>Fournisseur</th>
                {companies.map((company) => (
                  <th className="chiffre" key={company.key}>
                    {company.short}
                  </th>
                ))}
                <th className="chiffre">Total HT</th>
              </tr>
            </thead>
            <tbody>
              {parCommande.map(({ commande, parSociete }) => (
                <tr key={commande.id}>
                  <td>
                    <span className="order-reference-cell">
                      <Building2 size={16} />
                      {commande.reference}
                      <small>{commande.id}</small>
                    </span>
                  </td>
                  <td className="order-date">{commande.date}</td>
                  <td>{commande.supplier}</td>
                  {companies.map((company) => (
                    <td className="chiffre" key={company.key}>
                      {parSociete[company.key] === 0
                        ? "—"
                        : money(parSociete[company.key])}
                    </td>
                  ))}
                  <td className="chiffre">
                    <strong className="order-total">{money(commande.total)}</strong>
                  </td>
                </tr>
              ))}
              {!parCommande.length && (
                <tr>
                  <td colSpan={companies.length + 4}>
                    Aucune commande sur cette période.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
