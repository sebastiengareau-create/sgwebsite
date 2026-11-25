"use client";

// Case de montant d'argent : on tape « 350 », « 350,5 » ou « 1 234.56 $ »,
// et en sortant de la case elle affiche « 350,00 $ » (lib/format.js). La
// valeur transmise au formulaire reste un nombre simple (« 350.00 ») que
// toutes les validations des API comprennent.
//
// Remplace <input inputMode="decimal" …> tel quel : onChange reçoit un
// événement { target: { value } }, comme une case ordinaire.

import { useState } from "react";
import { argent } from "@/lib/format";

// « 1 234,5 $ » → 1234.5 ; null si vide ; NaN si illisible
export function lireMontant(brut) {
  let t = String(brut ?? "").replace(/[\s$]/g, "").replace(/−/g, "-");
  if (t === "") return null;
  // Virgule et point ensemble : le dernier est le séparateur décimal
  const v = t.lastIndexOf(","), p = t.lastIndexOf(".");
  if (v >= 0 && p >= 0) t = v > p ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  else t = t.replace(",", ".");
  return /^-?(\d+\.?\d*|\.\d+)$/.test(t) ? Number(t) : NaN;
}

// Valeur transmise : « 350.00 », ou le texte tapé s'il est illisible (l'API
// répondra alors « montant invalide » plutôt que de l'ignorer)
function valeurPropre(brut) {
  const n = lireMontant(brut);
  if (n === null) return "";
  return Number.isFinite(n) ? n.toFixed(2) : String(brut);
}

// Texte à modifier : « 350,00 » (virgule, sans $ ni espaces)
function texteEdition(valeur) {
  const n = lireMontant(valeur);
  if (n === null) return "";
  return Number.isFinite(n) ? n.toFixed(2).replace(".", ",") : String(valeur);
}

export default function ChampArgent({ value, onChange, onFocus, onBlur, negatif = true, ...autres }) {
  const [edition, setEdition] = useState(null); // texte tapé pendant que la case a le focus
  const n = lireMontant(value);
  const affiche = edition !== null ? edition : n === null ? "" : Number.isFinite(n) ? argent(n) : String(value ?? "");

  function changer(e) {
    let t = e.target.value;
    if (!negatif) t = t.replace(/[-−]/g, "");
    setEdition(t);
    onChange?.({ target: { value: valeurPropre(t) } });
  }

  return (
    <input
      {...autres}
      inputMode="decimal"
      value={affiche}
      onChange={changer}
      onFocus={(e) => { setEdition(texteEdition(value)); e.target.select?.(); onFocus?.(e); }}
      onBlur={(e) => { setEdition(null); onBlur?.(e); }}
    />
  );
}
