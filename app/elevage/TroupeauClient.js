"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BandeauSection from "../components/BandeauSection";
import { correspondRecherche } from "@/lib/recherche";
import {
  SEXES, GENETIQUES, STATUTS_BETE, libelle, age, dernierePesee, gainMoyenQuotidien, coutBete, revenusBete,
  carcasseDepuisVif, argent, kg, dateCourte,
} from "@/lib/elevageCalculs";
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 12 }}>
        <Statistique valeur={actives.length} label="Bêtes au troupeau" />
        <Statistique valeur={kg(poidsVif, 0)} label="Poids vif (dernières pesées)" />
        <Statistique valeur={kg(carcasseDepuisVif(poidsVif, rendementCarcasse), 0)} label={`Carcasse estimée (${rendementCarcasse} %)`} />
        <Statistique valeur={argent(investi)} label="Coût investi au troupeau" />
      </div>

      <button onClick={() => setFormulaire((v) => !v)} className="bouton-3d" style={{ ...boutonPrincipal, padding: 11, borderRadius: 10, marginBottom: 12 }}>
        {formulaire ? "Annuler" : "+ Nouvelle bête"}
      </button>
      {formulaire && <NouvelleBete femelles={femelles} onCree={(id) => router.push(`/elevage/${id}`)} />}

      <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="🔍 Rechercher (numéro, nom, boucle, mère)…" style={{ ...champStyle, marginBottom: 10 }} />
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
  return (
    <Link href={`/elevage/${b.id}`} style={{ textDecoration: "none", color: "inherit" }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700 }}>{b.numero}{b.nom && ` — ${b.nom}`}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {libelle(SEXES, b.sexe).split(" (")[0]}
            {b.genetique && ` · ${libelle(GENETIQUES, b.genetique).split(" (")[0]}`}
            {b.pourcentageWagyu != null && ` ${b.pourcentageWagyu} %`}
            {b.dateNaissance && ` · ${age(b.dateNaissance, b.dateSortie || new Date())}`}
            {b.identifiant && ` · 🏷️ ${b.identifiant}`}
            {b.mere && ` · mère ${b.mere.numero}${b.mere.nom ? ` (${b.mere.nom})` : ""}`}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, fontSize: 12 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: statut?.couleur }}>{statut?.label}</div>
          {b.abattage ? (
            <div>Carcasse {kg(b.abattage.poidsCarcasse, 0)}{b.abattage.bms && ` · BMS ${b.abattage.bms}`}</div>
          ) : (
            pesee && <div>{kg(pesee.poids, 0)} <span style={{ color: "var(--text-muted)" }}>le {dateCourte(pesee.date)}</span></div>
          )}
          {gmq != null && !b.abattage && <div style={{ color: "var(--text-muted)" }}>{gmq.toFixed(2).replace(".", ",")} kg/jour</div>}
          <div style={{ color: "var(--text-muted)" }}>Coût {argent(cout)}</div>
          {revenus > 0 && <div style={{ fontWeight: 700, color: revenus - cout >= 0 ? "var(--success)" : "var(--danger)" }}>Ventes {argent(revenus)}</div>}
        </div>
      </div>
    </Link>
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
    <div className="carte carte-m" style={{ marginBottom: 14 }}>
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
