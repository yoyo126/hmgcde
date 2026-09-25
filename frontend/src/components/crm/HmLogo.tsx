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
export function HmLogo({ className = "" }: { className?: string }) {
  // `import.meta.env.BASE_URL` : le site est publié sous /hmgcde/ sur
  // l'aperçu GitHub Pages, et à la racine sur le serveur.
  const src = `${import.meta.env.BASE_URL}logo-achat-filiale.png`;
  return <img src={src} alt="HM Group Achat Filiale" className={`hm-logo ${className}`} />;
}
