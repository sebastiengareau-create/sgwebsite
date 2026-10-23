"use client";

import { useState } from "react";
import ChampsVehicule, { VEHICULE_VIDE } from "./ChampsVehicule";
import OptionVehicule from "./OptionVehicule";
import { libelleVehicule, identifiantsVehicule, valeursFormulaireVehicule } from "@/lib/vehicules";

// Véhicule d'un bon ou d'une soumission : un véhicule du dossier du client
// (son id, modifiable sur place — plaque, NIV, kilométrage…), "nouveau"
// (formulaire ci-dessous) ou "" (non précisé, si permis).
//
// vehicules : ceux du dossier du client choisi ([] pour un nouveau client).
// onVehiculeModifie reçoit le véhicule enregistré au dossier.
export default function ChoixVehiculeClient({
  vehicules, choix, onChoix, vehicule, onVehicule, onVehiculeModifie,
  permettreNonPrecise = true, libelleNouveau = "+ Autre véhicule (ajouté au dossier du client)",
}) {
  // Véhicule du dossier en cours de modification : son id
  const [vehiculeEdite, setVehiculeEdite] = useState(null);
  const [valeurEditee, setValeurEditee] = useState(VEHICULE_VIDE);
  const [erreur, setErreur] = useState("");
  const [enregistrement, setEnregistrement] = useState(false);

  function modifier(v) {
    setErreur("");
    setVehiculeEdite(v.id);
    setValeurEditee(valeursFormulaireVehicule(v));
  }

  // Enregistré tout de suite au dossier du client, puis choisi
  async function enregistrer() {
    setErreur("");
    setEnregistrement(true);
    const res = await fetch(`/api/vehicules/${vehiculeEdite}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(valeurEditee),
    });
    setEnregistrement(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErreur(data.erreur || "Erreur.");
      return;
    }
    onVehiculeModifie(data);
    onChoix(data.id);
    setVehiculeEdite(null);
  }

  return (
    <>
      {vehicules.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 6 }}>
          {vehicules.map((v) => vehiculeEdite === v.id ? (
            // Pas de <form> imbriqué : Entrée enregistre le véhicule au lieu d'envoyer le formulaire principal
            <div key={v.id} onKeyDown={(e) => { if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); enregistrer(); } }}
              style={{ background: "var(--surface)", border: "1px solid var(--accent)", borderRadius: 8, padding: "4px 10px 10px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>Modifier le véhicule (enregistré au dossier du client)</div>
              <ChampsVehicule valeur={valeurEditee} onChange={setValeurEditee} />
              {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>{erreur}</p>}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button type="button" onClick={enregistrer} disabled={enregistrement} className="bouton-3d" style={{ flex: 1, padding: 9, borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
                  {enregistrement ? "…" : "Enregistrer"}
                </button>
                <button type="button" onClick={() => setVehiculeEdite(null)} className="bouton-3d-sombre" style={{ flex: 1, padding: 9, borderRadius: 8, fontSize: 13 }}>
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <div key={v.id} style={{ display: "flex", gap: 6 }}>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                <OptionVehicule actif={choix === v.id} onClick={() => onChoix(v.id)}
                  titre={libelleVehicule(v) || "Véhicule sans description"}
                  detail={identifiantsVehicule(v)}
                />
              </div>
              <button type="button" onClick={() => modifier(v)} disabled={vehiculeEdite !== null} className="bouton-3d-sombre"
                style={{ padding: "0 12px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
                ✏️ Modifier
              </button>
            </div>
          ))}
          <OptionVehicule actif={choix === "nouveau"} onClick={() => onChoix("nouveau")} titre={libelleNouveau} />
          {permettreNonPrecise && (
            <OptionVehicule actif={choix === ""} onClick={() => onChoix("")} titre="Non précisé" />
          )}
        </div>
      )}
      {choix === "nouveau" && <ChampsVehicule valeur={vehicule} onChange={onVehicule} />}
    </>
  );
}
