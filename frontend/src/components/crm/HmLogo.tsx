/**
 * Logo HM Group Achat Filiale.
 *
 * Logo propre à cette application, fourni détouré : il se pose aussi bien
 * sur la barre latérale sombre que sur l'écran de connexion clair. Comme il
 * porte déjà la mention « ACHAT FILIALE », le sous-titre qui l'accompagnait
 * a été retiré.
 *
 * Pour le remplacer un jour, il suffit de déposer un nouveau fichier sous ce
 * nom dans `frontend/public/`.
 */
export function HmLogo({
  className = "",
  clair = false,
  anime = false,
}: {
  className?: string;
  /** Variante éclaircie, pour se poser sur un fond sombre sans plaque. */
  clair?: boolean;
  /**
   * Arrivée animée : mise au point, puis un reflet qui balaie le logo une
   * fois. Réservée à l'écran de connexion — dans la barre latérale, un logo
   * qui s'anime à chaque navigation deviendrait vite pénible.
   *
   * Le reflet a besoin d'une couche par-dessus l'image : d'où l'enveloppe,
   * qui ne sert qu'à ça et n'apparaît que dans ce cas.
   */
  anime?: boolean;
}) {
  // `import.meta.env.BASE_URL` : le site est publié sous /hmgcde/ sur
  // l'aperçu GitHub Pages, et à la racine sur le serveur.
  const src = `${import.meta.env.BASE_URL}logo-achat-filiale${clair ? "-clair" : ""}.png`;
  const image = <img src={src} alt="HM Group Achat Filiale" className="hm-logo" />;

  if (!anime) {
    return <img src={src} alt="HM Group Achat Filiale" className={`hm-logo ${className}`} />;
  }
  return <span className={`hm-logo-anime ${className}`}>{image}</span>;
}
