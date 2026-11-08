"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icone, TEINTES, TitrePanneau, BoutonAction, stylePanneau } from "../../../components/StyleSection";
import ChampsVehicule, { VEHICULE_VIDE } from "../../../components/ChampsVehicule";
import { libelleVehicule, identifiantsVehicule, valeursFormulaireVehicule } from "@/lib/vehicules";

// Dossier véhicule sur la fiche client : tous les véhicules du client, avec
// ajout, modification et suppression (bloquée si le véhicule figure sur un bon).
export default function DossierVehicules({ clientId, vehicules }) {
  const router = useRouter();
  const [edition, setEdition] = useState(null); // null | "nouveau" | id du véhicule
  const [valeur, setValeur] = useState(VEHICULE_VIDE);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  function ouvrir(v) {
    setErreur("");
    setEdition(v ? v.id : "nouveau");
    setValeur(v ? valeursFormulaireVehicule(v) : VEHICULE_VIDE);
  }

  async function sauvegarder(e) {
    e.preventDefault();
    setErreur("");
    setEnCours(true);
    const res = await fetch(edition === "nouveau" ? `/api/clients/${clientId}/vehicules` : `/api/vehicules/${edition}`, {
      method: edition === "nouveau" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(valeur),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    setEdition(null);
    router.refresh();
  }

  async function supprimer(v) {
    if (!window.confirm(`Retirer « ${libelleVehicule(v) || "ce véhicule"} » du dossier ?`)) return;
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/vehicules/${v.id}`, { method: "DELETE" });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de la suppression.");
      return;
    }
    router.refresh();
  }

  return (
    <div style={stylePanneau}>
      <TitrePanneau
        icone="vehicule" teinte={TEINTES.bleu} titre="Véhicules"
        sousTitre={vehicules.length === 0 ? "Aucun véhicule au dossier." : `${vehicules.length} véhicule${vehicules.length !== 1 ? "s" : ""} au dossier`}
      />

      {vehicules.map((v, i) =>
        edition === v.id ? null : (
          <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 2px", borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
            <span style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 11, background: TEINTES.bleu.fond, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icone nom="vehicule" taille={19} couleur={TEINTES.bleu.couleur} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{libelleVehicule(v) || "Véhicule sans description"}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", overflowWrap: "anywhere" }}>
                {identifiantsVehicule(v) || "Aucune plaque ni NIV"}
                {v._count?.bons > 0 && ` · ${v._count.bons} bon${v._count.bons > 1 ? "s" : ""}`}
              </div>
            </div>
            <BoutonIcone icone="crayon" titre="Modifier" onClick={() => ouvrir(v)} disabled={enCours} />
            <BoutonIcone icone="poubelle" titre="Retirer du dossier" couleur="var(--danger)" onClick={() => supprimer(v)} disabled={enCours} />
          </div>
        )
      )}

      {edition !== null ? (
        <form onSubmit={sauvegarder} style={{ marginTop: 10, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>{edition === "nouveau" ? "Nouveau véhicule" : "Modifier le véhicule"}</div>
          <ChampsVehicule valeur={valeur} onChange={setValeur} />
          {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>{erreur}</p>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
            <button type="submit" disabled={enCours} className="bouton-3d" style={{ padding: 11, borderRadius: 12, fontWeight: 700, fontSize: 14 }}>
              {enCours ? "…" : "Sauvegarder"}
            </button>
            <BoutonAction icone="bloque" couleur="var(--text-muted)" onClick={() => setEdition(null)}>Annuler</BoutonAction>
          </div>
        </form>
      ) : (
        <>
          {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 6 }}>{erreur}</p>}
          <button type="button" onClick={() => ouvrir(null)} style={boutonAjout}>+ Ajouter un véhicule</button>
        </>
      )}
    </div>
  );
}

function BoutonIcone({ icone, titre, couleur = "var(--text-muted)", onClick, disabled }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} title={titre} aria-label={titre}
      style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
    >
      <Icone nom={icone} taille={16} couleur={couleur} />
    </button>
  );
}

const boutonAjout = {
  width: "100%", marginTop: 10, padding: "10px 8px", borderRadius: 12, fontSize: 13.5, fontWeight: 700, cursor: "pointer",
  color: "var(--accent-ombre)", background: "none", border: "1.5px dashed var(--accent)",
};
