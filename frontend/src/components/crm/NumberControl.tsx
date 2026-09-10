import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";

/**
 * Compteur de quantité, commun à tous les écrans.
 *
 * La valeur se tape au clavier autant qu'elle se règle aux boutons : commander
 * 120 mètres de câble à coups de « + » n'a pas de sens. Le champ garde son
 * propre texte pendant la frappe, sinon l'effacer pour retaper ramènerait
 * aussitôt un zéro sous les doigts.
 */
export function NumberControl({
  value,
  onMinus,
  onPlus,
  onSet,
  compact,
  label,
  className = "",
}: {
  value: number;
  onMinus: () => void;
  onPlus: () => void;
  onSet?: (valeur: number) => void;
  compact?: boolean;
  label?: string;
  className?: string;
}) {
  const [saisie, setSaisie] = useState(String(value));
  useEffect(() => setSaisie(String(value)), [value]);

  const change = (texte: string) => {
    setSaisie(texte);
    if (!onSet) return;
    const nombre = Number(texte.replace(",", "."));
    if (texte !== "" && Number.isFinite(nombre) && nombre >= 0) onSet(nombre);
  };

  return (
    <div className={`number-control ${compact ? "compact" : ""} ${className}`}>
      <button aria-label={`Diminuer ${label || "la quantité"}`} onClick={onMinus}>
        <Minus size={16} />
      </button>
      {onSet ? (
        <input
          className="number-control-input"
          aria-label={label || "Quantité"}
          inputMode="numeric"
          min="0"
          type="number"
          value={saisie}
          onChange={(event) => change(event.target.value)}
          onFocus={(event) => event.target.select()}
          onBlur={() => setSaisie(String(value))}
        />
      ) : (
        <strong>{value}</strong>
      )}
      <button aria-label={`Augmenter ${label || "la quantité"}`} onClick={onPlus}>
        <Plus size={16} />
      </button>
    </div>
  );
}
