/**
 * Logo HM Group.
 *
 * Le fichier fourni était un JPEG sur fond noir : il a été détouré en PNG
 * transparent (`frontend/public/logo-hm-group.png`) pour se poser aussi bien
 * sur la barre latérale sombre que sur l'écran de connexion clair. Le
 * dégradé bleu d'origine est conservé tel quel.
 *
 * Pour remplacer le logo un jour, il suffit de déposer un nouveau fichier
 * sous ce nom dans `frontend/public/`.
 */
export function HmLogo({ className = "" }: { className?: string }) {
  // `import.meta.env.BASE_URL` : le site est publié sous /hmgcde/ sur
  // l'aperçu GitHub Pages, et à la racine sur le serveur.
  const src = `${import.meta.env.BASE_URL}logo-hm-group.png`;
  return <img src={src} alt="HM Group" className={`hm-logo ${className}`} />;
}
