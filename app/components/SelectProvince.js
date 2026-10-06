"use client";

import { PROVINCES } from "@/lib/adresse";

// Liste déroulante des provinces et territoires — la valeur est le code à
// deux lettres (« QC »). Une valeur hors liste (ex. un État américain venu
// d'un import) reste affichée telle quelle pour ne pas être perdue.
export default function SelectProvince({ valeur, onChange, ...props }) {
  const horsListe = valeur && !PROVINCES.some((p) => p.code === valeur);
  return (
    <select value={valeur || ""} onChange={(e) => onChange(e.target.value)} {...props}>
      <option value="">Province…</option>
      {PROVINCES.map((p) => (
        <option key={p.code} value={p.code}>{p.nom}</option>
      ))}
      {horsListe && <option value={valeur}>{valeur}</option>}
    </select>
  );
}
