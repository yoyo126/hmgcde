/**
 * Emblème HM Group.
 *
 * Dessiné en SVG plutôt qu'importé en image : il reste net à toutes les
 * tailles et s'adapte aux couleurs de l'application. Pour mettre le vrai logo
 * de la société à la place, déposer le fichier dans `frontend/public/` et
 * remplacer le contenu de ce composant par :
 *
 *     <img src="/logo-hm-group.svg" alt="HM Group" className={className} />
 */
export function HmLogo({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      role="img"
      aria-label="HM Group"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="hm-logo-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3267e3" />
          <stop offset="100%" stopColor="#17223b" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill="url(#hm-logo-gradient)" />
      {/* Monogramme HM */}
      <path
        d="M12 15v18M12 24h8M20 15v18"
        stroke="#ffffff"
        strokeWidth="3.1"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M27 33V15l4.5 9 4.5-9v18"
        stroke="#ffffff"
        strokeWidth="3.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
