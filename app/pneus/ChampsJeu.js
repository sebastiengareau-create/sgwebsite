"use client";

import { SAISONS, JANTES } from "@/lib/pneusCalculs";

// Champs d'un jeu de pneus (nouveau jeu, fiche, changement de saison sur le
// bon). champs : valeurs en texte ; onChange reçoit les champs modifiés.
// emplacement : afficher l'emplacement à l'entrepôt. compact : sans marque,
// modèle ni note (changement de saison).
export default function ChampsJeu({ champs, onChange, emplacement = true, compact = false }) {
  const changer = (cle) => (e) => onChange({ ...champs, [cle]: e.target.value });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div role="group" aria-label="Saison" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {Object.entries(SAISONS).map(([cle, s]) => (
          <button
            key={cle} type="button" aria-pressed={champs.saison === cle} onClick={() => onChange({ ...champs, saison: cle })}
            style={{
              flex: "1 1 90px", padding: "9px 8px", borderRadius: 10, fontSize: 13.5, fontWeight: 800, cursor: "pointer",
              border: `1.5px solid ${champs.saison === cle ? "var(--accent)" : "var(--border)"}`,
              background: champs.saison === cle ? "rgba(232,163,61,0.14)" : "var(--surface)", color: "var(--text)",
            }}
          >
            {s.libelle}
          </button>
        ))}
      </div>
      <div style={rangee}>
        <Champ libelle="Dimension" largeur="1 1 140px"><input value={champs.dimension} onChange={changer("dimension")} placeholder="225/65R17" className="champ" style={grand} /></Champ>
        <Champ libelle="Quantité" largeur="0 1 80px"><input value={champs.quantite} onChange={changer("quantite")} inputMode="numeric" className="champ" style={grand} /></Champ>
        <Champ libelle="Jantes" largeur="1 1 170px">
          <select value={champs.jantes} onChange={changer("jantes")} className="champ" style={grand}>
            {Object.entries(JANTES).map(([cle, libelle]) => <option key={cle} value={cle}>{libelle}</option>)}
          </select>
        </Champ>
      </div>
      {!compact && (
        <div style={rangee}>
          <Champ libelle="Marque" largeur="1 1 140px"><input value={champs.marque} onChange={changer("marque")} placeholder="Michelin" className="champ" style={grand} /></Champ>
          <Champ libelle="Modèle" largeur="1 1 160px"><input value={champs.modele} onChange={changer("modele")} placeholder="X-Ice Snow" className="champ" style={grand} /></Champ>
        </div>
      )}
      <div style={rangee}>
        <Champ libelle="Année ou code DOT" largeur="0 1 140px"><input value={champs.anneeFabrication} onChange={changer("anneeFabrication")} inputMode="numeric" placeholder="2021 ou 2321" className="champ" style={grand} /></Champ>
        <Champ libelle="Usure par pneu (/32 po)" largeur="1 1 160px"><input value={champs.usure} onChange={changer("usure")} placeholder="8, 8, 7, 7" className="champ" style={grand} /></Champ>
        {emplacement && (
          <Champ libelle="Emplacement" largeur="0 1 120px"><input value={champs.emplacement} onChange={changer("emplacement")} placeholder="A-12" className="champ" style={{ ...grand, textTransform: "uppercase" }} /></Champ>
        )}
      </div>
      {!compact && (
        <Champ libelle="Note">
          <input value={champs.note} onChange={changer("note")} placeholder="ex. Boulons antivol dans le coffre" className="champ" style={grand} />
        </Champ>
      )}
    </div>
  );
}

function Champ({ libelle, largeur = "1 1 auto", children }) {
  return (
    <label style={{ flex: largeur, minWidth: 0 }}>
      <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>{libelle}</span>
      {children}
    </label>
  );
}

// Champs d'un jeu en texte (formulaires), à partir d'un jeu enregistré
export function champsDuJeu(jeu) {
  return {
    saison: jeu?.saison || "", dimension: jeu?.dimension || "", marque: jeu?.marque || "", modele: jeu?.modele || "",
    quantite: String(jeu?.quantite ?? 4), jantes: jeu?.jantes || "SANS", anneeFabrication: jeu?.anneeFabrication ? String(jeu.anneeFabrication) : "",
    usure: jeu?.usure || "", emplacement: jeu?.emplacement || "", note: jeu?.note || "",
  };
}

const rangee = { display: "flex", gap: 8, flexWrap: "wrap" };
const grand = { fontSize: 15 };
