"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BandeauSection from "../components/BandeauSection";
import { correspondRecherche } from "@/lib/recherche";
import { nombre } from "@/lib/format";
import { Icone, BoutonPlein, Pastille } from "../components/StyleSection";
import {
  SEXES, GENETIQUES, STATUTS_BETE, libelle, age, dernierePesee, gainMoyenQuotidien, coutBete, revenusBete,
  carcasseDepuisVif, argent, kg, dateCourte, TYPES_SOIN, retraitEnCours, rappelsAFaire, joursAvant,
} from "@/lib/elevageCalculs";
import ScanElevage from "./ScanElevage";
import { champStyle, labelStyle, boutonPrincipal, grille2, Champ, Erreur, Onglets, Statistique, NavElevage, useApi } from "./ui";

const FILTRES = [
  { code: "ACTIVE", label: "Au troupeau" },
  { code: "ABATTUE", label: "Abattues" },
  { code: "SORTIES", label: "Vendues / mortes" },
  { code: "TOUTES", label: "Toutes" },
];

export default function TroupeauClient({ betes, rendementCarcasse }) {
  const router = useRouter();
  const [filtre, setFiltre] = useState("ACTIVE");
  const [recherche, setRecherche] = useState("");
  const [formulaire, setFormulaire] = useState(false);

  const q = recherche.trim().toLowerCase();
  const affichees = betes.filter((b) => {
    if (filtre === "SORTIES" ? !["VENDUE", "MORTE"].includes(b.statut) : filtre !== "TOUTES" && b.statut !== filtre) return false;
    return !q || correspondRecherche(q, b.numero, b.nom, b.identifiant, b.mere?.numero, b.mere?.nom);
  });

  const actives = betes.filter((b) => b.statut === "ACTIVE");
  const poidsVif = actives.reduce((s, b) => s + (dernierePesee(b.pesees)?.poids || 0), 0);
  const investi = actives.reduce((s, b) => s + coutBete(b), 0);
  const femelles = betes.filter((b) => b.sexe === "FEMELLE" && b.statut === "ACTIVE");

  return (
    <div className="conteneur-page">
      <BandeauSection icone="🐂" titre="Élevage" sousTitre="Le troupeau de la naissance à la table : pesées, coûts, abattage, découpe et vente de la viande." />
      <NavElevage actif="/elevage" />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <BoutonPlein icone={formulaire ? null : "plus"} onClick={() => setFormulaire((v) => !v)}>
          {formulaire ? "Annuler" : "Nouvelle bête"}
        </BoutonPlein>
        <ScanElevage />
      </div>
      {formulaire && <NouvelleBete femelles={femelles} onCree={(id) => router.push(`/elevage/${id}`)} />}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
        <Statistique valeur={actives.length} label="Bêtes au troupeau" teinte="var(--success)" />
        <Statistique valeur={kg(poidsVif, 0)} label="Poids vif (dernières pesées)" teinte="var(--bleu)" />
        <Statistique valeur={kg(carcasseDepuisVif(poidsVif, rendementCarcasse), 0)} label={`Carcasse estimée (${rendementCarcasse} %)`} teinte="var(--accent)" />
        <Statistique valeur={argent(investi)} label="Coût investi au troupeau" teinte="var(--danger)" />
      </div>

      <SoinsASuivre betes={actives} />

      <div style={{ position: "relative", marginBottom: 12 }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", display: "flex" }}>
          <Icone nom="loupe" taille={18} couleur="var(--text-muted)" />
        </span>
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Numéro, nom, boucle, mère…" style={{ ...champStyle, marginBottom: 0, padding: "11px 12px 11px 40px", fontSize: 14, borderRadius: 12, background: "var(--surface)" }} />
      </div>
      <Onglets options={FILTRES} valeur={filtre} onChange={setFiltre} />

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {affichees.map((b) => <CarteBete key={b.id} bete={b} />)}
        {affichees.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucune bête dans cette liste.</p>}
      </div>
    </div>
  );
}

function CarteBete({ bete: b }) {
  const statut = STATUTS_BETE.find((s) => s.code === b.statut);
  const pesee = dernierePesee(b.pesees);
  const gmq = gainMoyenQuotidien(b.pesees);
  const cout = coutBete(b);
  const revenus = revenusBete(b);
  const retrait = b.statut === "ACTIVE" ? retraitEnCours(b.soins) : null;
  return (
    <Link href={`/elevage/${b.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      <div style={{ position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "14px 16px 14px 20px", display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: statut?.couleur || "var(--border)" }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{b.numero}{b.nom && <span style={{ fontWeight: 600 }}> — {b.nom}</span>}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
            {libelle(SEXES, b.sexe).split(" (")[0]}
            {b.genetique && ` · ${libelle(GENETIQUES, b.genetique).split(" (")[0]}`}
            {b.pourcentageWagyu != null && ` ${b.pourcentageWagyu} %`}
            {b.dateNaissance && ` · ${age(b.dateNaissance, b.dateSortie || new Date())}`}
            {b.identifiant && ` · 🏷️ ${b.identifiant}`}
            {b.mere && ` · mère ${b.mere.numero}${b.mere.nom ? ` (${b.mere.nom})` : ""}`}
          </div>
          {statut && (
            <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
              <Pastille couleur={statut.couleur} fond={`${statut.couleur}22`}>{statut.label}</Pastille>
              {retrait && <Pastille couleur="var(--danger)" fond="var(--danger-fond)">En retrait jusqu'au {dateCourte(retrait.fin)}</Pastille>}
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, fontSize: 12.5 }}>
          {b.abattage ? (
            <div style={{ fontSize: 15, fontWeight: 800 }}>{kg(b.abattage.poidsCarcasse, 0)}<span style={{ display: "block", fontSize: 12, fontWeight: 400, color: "var(--text-muted)" }}>carcasse{b.abattage.bms && ` · BMS ${b.abattage.bms}`}</span></div>
          ) : (
            pesee && <div style={{ fontSize: 15, fontWeight: 800 }}>{kg(pesee.poids, 0)}<span style={{ display: "block", fontSize: 12, fontWeight: 400, color: "var(--text-muted)" }}>le {dateCourte(pesee.date)}</span></div>
          )}
          {gmq != null && !b.abattage && <div style={{ color: "var(--text-muted)" }}>{nombre(gmq)} kg/jour</div>}
          <div style={{ color: "var(--text-muted)" }}>Coût {argent(cout)}</div>
          {revenus > 0 && <div style={{ fontWeight: 700, color: revenus - cout >= 0 ? "var(--success)" : "var(--danger)" }}>Ventes {argent(revenus)}</div>}
        </div>
      </div>
    </Link>
  );
}

// Soins à suivre au troupeau : rappels en retard ou dus d'ici 30 jours, et
// bêtes dont un délai de retrait court encore
const HORIZON_RAPPELS = 30;

function SoinsASuivre({ betes }) {
  const rappels = betes
    .flatMap((b) => rappelsAFaire(b.soins).map((s) => ({ ...s, bete: b, jours: joursAvant(s.rappelLe) })))
    .filter((r) => r.jours <= HORIZON_RAPPELS)
    .sort((a, b) => a.jours - b.jours);
  const retraits = betes.map((b) => ({ bete: b, retrait: retraitEnCours(b.soins) })).filter((x) => x.retrait).sort((a, b) => a.retrait.fin - b.retrait.fin);
  if (rappels.length === 0 && retraits.length === 0) return null;
  const nomBete = (b) => `${b.numero}${b.nom ? ` — ${b.nom}` : ""}`;
  const ligne = { display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 2px", fontSize: 13.5, textDecoration: "none", color: "var(--text)" };
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "14px 16px", marginBottom: 16 }}>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>🩺 Soins à suivre</div>
      {rappels.map((r, i) => (
        <Link key={r.id} href={`/elevage/${r.bete.id}`} style={{ ...ligne, borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
          <span style={{ minWidth: 0, overflowWrap: "anywhere" }}><strong>{nomBete(r.bete)}</strong> · {libelle(TYPES_SOIN, r.type).split(" (")[0]}{r.produit ? ` — ${r.produit}` : ""}</span>
          <span style={{ flexShrink: 0, fontWeight: 700, color: r.jours < 0 ? "var(--danger)" : "var(--text-muted)" }}>
            {r.jours < 0 ? `en retard de ${-r.jours} j` : r.jours === 0 ? "aujourd'hui" : `dans ${r.jours} j`}
          </span>
        </Link>
      ))}
      {retraits.map(({ bete, retrait }, i) => (
        <Link key={bete.id} href={`/elevage/${bete.id}`} style={{ ...ligne, borderTop: i === 0 && rappels.length === 0 ? "none" : "1px solid var(--border)" }}>
          <span style={{ minWidth: 0, overflowWrap: "anywhere" }}><strong>{nomBete(bete)}</strong> · en retrait{retrait.soin.produit ? ` (${retrait.soin.produit})` : ""}</span>
          <span style={{ flexShrink: 0, fontWeight: 700, color: "var(--danger)" }}>jusqu'au {dateCourte(retrait.fin)}</span>
        </Link>
      ))}
    </div>
  );
}

export const FICHE_VIDE = {
  nom: "", identifiant: "", sexe: "", genetique: "FULLBLOOD", pourcentageWagyu: "100", dateNaissance: "",
  origine: "NEE_ICI", dateAcquisition: "", provenance: "", coutAcquisition: "", mereId: "", pere: "", notes: "",
};

function NouvelleBete({ femelles, onCree }) {
  const [fiche, setFiche] = useState({ ...FICHE_VIDE, poidsInitial: "" });
  const { appeler, enCours, erreur } = useApi();
  const maj = (champ) => (e) => setFiche((f) => ({ ...f, [champ]: e.target.value }));

  async function creer() {
    const data = await appeler("/api/elevage/betes", "POST", fiche);
    if (data) onCree(data.id);
  }

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--accent)", borderRadius: 16, padding: 16, marginBottom: 16 }}>
      <ChampsBete fiche={fiche} maj={maj} femelles={femelles} />
      <Champ label={fiche.origine === "ACHETEE" ? "Poids à l'arrivée (kg, facultatif)" : "Poids à la naissance (kg, facultatif)"}>
        <input inputMode="decimal" value={fiche.poidsInitial} onChange={maj("poidsInitial")} style={champStyle} />
      </Champ>
      <Erreur texte={erreur} />
      <button onClick={creer} disabled={enCours} className="bouton-3d" style={boutonPrincipal}>{enCours ? "…" : "Ajouter au troupeau"}</button>
    </div>
  );
}

// Champs de la fiche d'une bête — partagés avec la fiche détaillée
export function ChampsBete({ fiche, maj, femelles }) {
  return (
    <>
      <div style={grille2}>
        <Champ label="Sexe">
          <select value={fiche.sexe} onChange={maj("sexe")} style={champStyle}>
            <option value="">—</option>
            {SEXES.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
          </select>
        </Champ>
        <Champ label="Nom (facultatif)">
          <input value={fiche.nom} onChange={maj("nom")} style={champStyle} />
        </Champ>
        <Champ label="Boucle d'oreille (ATQ)">
          <input value={fiche.identifiant} onChange={maj("identifiant")} style={champStyle} />
        </Champ>
        <Champ label="Date de naissance">
          <input type="date" max="9999-12-31" value={fiche.dateNaissance} onChange={maj("dateNaissance")} style={champStyle} />
        </Champ>
        <Champ label="Génétique">
          <select value={fiche.genetique} onChange={maj("genetique")} style={champStyle}>
            <option value="">—</option>
            {GENETIQUES.map((g) => <option key={g.code} value={g.code}>{g.label}</option>)}
          </select>
        </Champ>
        <Champ label="% wagyu">
          <input inputMode="decimal" value={fiche.pourcentageWagyu} onChange={maj("pourcentageWagyu")} style={champStyle} />
        </Champ>
        <Champ label="Mère">
          <select value={fiche.mereId} onChange={maj("mereId")} style={champStyle}>
            <option value="">— (inconnue ou hors troupeau)</option>
            {femelles.map((f) => <option key={f.id} value={f.id}>{f.numero}{f.nom ? ` — ${f.nom}` : ""}</option>)}
          </select>
        </Champ>
        <Champ label="Père (taureau ou semence)">
          <input value={fiche.pere} onChange={maj("pere")} style={champStyle} />
        </Champ>
      </div>
      <label style={labelStyle}>Origine</label>
      <div style={{ display: "flex", gap: 14, fontSize: 13, marginBottom: 8 }}>
        {[["NEE_ICI", "Née ici"], ["ACHETEE", "Achetée"]].map(([code, texte]) => (
          <label key={code} style={{ display: "flex", gap: 5, alignItems: "center", cursor: "pointer" }}>
            <input type="radio" checked={fiche.origine === code} onChange={() => maj("origine")({ target: { value: code } })} />
            {texte}
          </label>
        ))}
      </div>
      {fiche.origine === "ACHETEE" && (
        <div style={grille2}>
          <Champ label="Date d'achat">
            <input type="date" max="9999-12-31" value={fiche.dateAcquisition} onChange={maj("dateAcquisition")} style={champStyle} />
          </Champ>
          <Champ label="Coût d'achat (avant taxes)">
            <input inputMode="decimal" value={fiche.coutAcquisition} onChange={maj("coutAcquisition")} placeholder="0,00" style={champStyle} />
          </Champ>
          <Champ label="Achetée de">
            <input value={fiche.provenance} onChange={maj("provenance")} placeholder="Éleveur, encan…" style={champStyle} />
          </Champ>
        </div>
      )}
      <Champ label="Notes">
        <textarea value={fiche.notes} onChange={maj("notes")} rows={2} style={{ ...champStyle, resize: "vertical" }} />
      </Champ>
    </>
  );
}
