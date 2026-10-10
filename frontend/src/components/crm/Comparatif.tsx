import { useMemo, useState } from "react";
import { ArrowLeft, Download, Search, X } from "lucide-react";
import { componentPrice, money, productFamiliesFrom, type Product } from "@/lib/crm-data";
import { comparer, libelleUnitaire } from "@/lib/comparatif";
import { nomCsv, telechargerCsv, type Cellule } from "@/lib/export-csv";
import { effectiveComponentPrice, effectivePrice } from "@/lib/tariff-storage";
import { useCatalogProducts } from "@/lib/use-catalog-products";
import { usePurchasingSettings } from "@/lib/use-purchasing-settings";
import { usePermissions } from "./permissions-context";

/**
 * Comparatif des tarifs fournisseurs.
 *
 * Le catalogue permettait déjà de voir les prix côte à côte, mais au creux de
 * l'écran de modification, produit par produit, et en comparant des prix
 * affichés — donc des conditionnements différents. Cet écran ne fait qu'une
 * chose : montrer, pour chaque produit, ce que chaque fournisseur demande à
 * l'unité, et qui est le moins cher.
 *
 * Le calcul vit dans @/lib/comparatif et est vérifié automatiquement : il
 * oriente des décisions d'achat.
 */

/** Prix d'un produit chez un fournisseur. Un ensemble vaut son contenu. */
const prixChezFournisseur = (produit: Product, fournisseur: string) => {
  if (produit.contents?.length) {
    return produit.contents.reduce((total, item) => {
      const unitaire = effectiveComponentPrice(
        produit.id,
        item.name,
        fournisseur,
        componentPrice(item, fournisseur),
      );
      return unitaire > 0 ? total + unitaire * (Number(item.quantity) || 0) : total;
    }, 0);
  }
  const offre = produit.offers.find((item) => item.supplier === fournisseur);
  return effectivePrice(produit.id, fournisseur, offre?.price || 0);
};

export function Comparatif({ onBack }: { onBack?: () => void } = {}) {
  const can = usePermissions();
  const settings = usePurchasingSettings();
  const produits = useCatalogProducts();
  const [recherche, setRecherche] = useState("");
  const [famille, setFamille] = useState("");
  const [seulementComparables, setSeulementComparables] = useState(false);

  const fournisseurs = settings.suppliers.map((contact) => contact.name);
  const familles = productFamiliesFrom(produits);

  const lignes = useMemo(() => {
    const mots = recherche.trim().toLowerCase();
    return produits
      .filter((produit) => !famille || famille === "Tous" || produit.family === famille)
      .filter(
        (produit) =>
          !mots ||
          produit.name.toLowerCase().includes(mots) ||
          produit.offers.some((offre) =>
            (offre.reference || "").toLowerCase().includes(mots),
          ),
      )
      .map((produit) => ({
        produit,
        comparatif: comparer(
          fournisseurs.map((fournisseur) => ({
            fournisseur,
            prix: prixChezFournisseur(produit, fournisseur),
            conditionnement:
              produit.offers.find((offre) => offre.supplier === fournisseur)?.packaging || "",
          })),
        ),
      }));
  }, [produits, fournisseurs, famille, recherche]);

  const visibles = seulementComparables
    ? lignes.filter((ligne) => ligne.comparatif.meilleur)
    : lignes;

  // Qui l'emporte, et combien de fois : c'est la lecture qu'on vient chercher.
  const podium = useMemo(() => {
    const compte = new Map<string, number>();
    for (const { comparatif } of lignes) {
      if (!comparatif.meilleur) continue;
      compte.set(comparatif.meilleur, (compte.get(comparatif.meilleur) || 0) + 1);
    }
    return [...compte.entries()].sort((a, b) => b[1] - a[1]);
  }, [lignes]);

  const comparables = lignes.filter((ligne) => ligne.comparatif.meilleur).length;
  const filtreActif = Boolean(recherche || famille || seulementComparables);

  const exporter = () => {
    const entetes: Cellule[] = ["Produit", "Famille"];
    for (const fournisseur of fournisseurs) {
      entetes.push(`${fournisseur} prix`, `${fournisseur} conditionnement`, `${fournisseur} unitaire`);
    }
    entetes.push("Meilleur", "Obstacle");
    const corps = visibles.map(({ produit, comparatif }) => {
      const cellules: Cellule[] = [produit.name, produit.family];
      for (const fournisseur of fournisseurs) {
        const offre = comparatif.offres.find((item) => item.fournisseur === fournisseur);
        cellules.push(
          offre && offre.prix > 0 ? offre.prix : "",
          offre?.conditionnement || "",
          offre?.unitaire ?? "",
        );
      }
      cellules.push(comparatif.meilleur || "", comparatif.obstacle || "");
      return cellules;
    });
    telechargerCsv(nomCsv("comparatif-fournisseurs"), [entetes, ...corps]);
  };

  if (!can.canSeePrices) {
    return (
      <div className="screen">
        <div className="page-title standard">
          <div>
            <span className="eyebrow">TARIFS</span>
            <h1>Comparatif fournisseurs</h1>
            <p>Cet écran ne montre que des prix : votre profil ne les affiche pas.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="page-title standard">
        <div>
          {onBack && (
            <button className="back-link" onClick={onBack}>
              <ArrowLeft size={16} /> Rubriques
            </button>
          )}
          <span className="eyebrow">TARIFS</span>
          <h1>Comparatif fournisseurs</h1>
          <p>
            Ce que chaque fournisseur demande à l’unité — l’euro du mètre ou de
            la pièce. C’est le seul chiffre comparable quand les
            conditionnements diffèrent.
          </p>
        </div>
        <button className="primary-btn" onClick={exporter}>
          <Download size={17} /> Exporter
        </button>
      </div>

      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={18} />
            <input
              placeholder="Rechercher un produit, une référence…"
              value={recherche}
              onChange={(event) => setRecherche(event.target.value)}
            />
            {recherche && (
              <button
                className="search-clear"
                aria-label="Effacer la recherche"
                onClick={() => setRecherche("")}
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        <div className="family-chips table-chips">
          {familles.map((nom) => (
            <button
              key={nom}
              className={(famille || "Tous") === nom ? "active" : ""}
              onClick={() => setFamille(nom === "Tous" ? "" : nom)}
            >
              {nom}
              <b>
                {nom === "Tous"
                  ? produits.length
                  : produits.filter((produit) => produit.family === nom).length}
              </b>
            </button>
          ))}
          <button
            className={seulementComparables ? "active" : ""}
            onClick={() => setSeulementComparables((actif) => !actif)}
          >
            Comparables seulement
            <b>{comparables}</b>
          </button>
        </div>

        <div className="bandeau-totaux">
          <div className="total-principal">
            <span>
              {visibles.length} produit{visibles.length > 1 ? "s" : ""}
              {filtreActif ? " (filtrés)" : ""}
            </span>
            <strong>{comparables} comparables</strong>
          </div>
          {podium.length > 0 && (
            <div className="total-fournisseurs">
              {podium.map(([fournisseur, nombre]) => (
                <span key={fournisseur}>
                  <b>{fournisseur}</b>
                  {nombre}
                  <small>fois le moins cher</small>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="comptoir-table">
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                {fournisseurs.map((fournisseur) => (
                  <th className="chiffre" key={fournisseur}>
                    {fournisseur}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map(({ produit, comparatif }) => (
                <tr key={produit.id}>
                  <td>
                    <span className="order-reference-cell">
                      <strong>{produit.name}</strong>
                      <small>
                        {produit.family}
                        {comparatif.obstacle ? ` · ${comparatif.obstacle}` : ""}
                      </small>
                    </span>
                  </td>
                  {fournisseurs.map((fournisseur) => {
                    const offre = comparatif.offres.find(
                      (item) => item.fournisseur === fournisseur,
                    );
                    const meilleur = comparatif.meilleur === fournisseur;
                    if (!offre || offre.prix <= 0) {
                      return (
                        <td className="chiffre comparatif-vide" key={fournisseur}>
                          —
                        </td>
                      );
                    }
                    return (
                      <td
                        className={"chiffre" + (meilleur ? " comparatif-meilleur" : "")}
                        key={fournisseur}
                        data-label={fournisseur}
                      >
                        {offre.unitaire !== null && offre.unite ? (
                          <strong className="comparatif-unitaire">
                            {libelleUnitaire(offre.unitaire, offre.unite)}
                          </strong>
                        ) : (
                          <strong className="comparatif-unitaire sans-unite">
                            unité inconnue
                          </strong>
                        )}
                        <small>
                          {money(offre.prix)}
                          {offre.conditionnement ? ` · ${offre.conditionnement}` : ""}
                        </small>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {!visibles.length && (
                <tr>
                  <td colSpan={fournisseurs.length + 1}>
                    Aucun produit ne correspond à ce filtre.
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
