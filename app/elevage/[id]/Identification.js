"use client";

// Identification et déplacements d'une bête : sa boucle ATQ et les boucles
// remplacées, l'enclos où elle se trouve, et ses déplacements.

import { useState } from "react";
import Link from "next/link";
import { TEINTES, BoutonAction, LigneDetail } from "../../components/StyleSection";
import { libelle, dateLisible } from "@/lib/elevageCalculs";
import { RAISONS_BOUCLE, TYPES_DEPLACEMENT, EVENEMENTS, formaterBoucle, emplacement } from "@/lib/registreElevage";
import { champStyle, boutonPrincipal, boutonLien, grille2, Champ, Erreur, useApi, aujourdhui, Section, BoutonRetirer } from "../ui";

// Champs d'un déplacement — partagés avec le registre (déplacement de groupe)
export function ChampsDeplacement({ champs, maj, lieux }) {
  return (
    <>
      <div style={grille2}>
        <Champ label="Type">
          <select value={champs.type} onChange={maj("type")} style={champStyle}>
            {TYPES_DEPLACEMENT.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
          </select>
        </Champ>
        <Champ label="Date"><input type="date" max="9999-12-31" value={champs.date} onChange={maj("date")} style={champStyle} /></Champ>
        {champs.type !== "SORTIE" && (
          <Champ label={champs.type === "ENTREE" ? "Enclos ou pâturage d'arrivée (facultatif)" : "Enclos ou pâturage"}>
            <input value={champs.lieu} onChange={maj("lieu")} list="lieux-elevage" placeholder="Pâturage nord, étable 2…" style={champStyle} />
            <datalist id="lieux-elevage">{lieux.map((l) => <option key={l} value={l} />)}</datalist>
          </Champ>
        )}
        {champs.type !== "INTERNE" && (
          <>
            <Champ label={champs.type === "SORTIE" ? "Site de destination" : "Site de provenance"}>
              <input value={champs.site} onChange={maj("site")} placeholder="Nom et numéro de site" style={champStyle} />
            </Champ>
            <Champ label="Transporteur et plaque (facultatif)"><input value={champs.transporteur} onChange={maj("transporteur")} style={champStyle} /></Champ>
          </>
        )}
      </div>
      <input value={champs.note} onChange={maj("note")} placeholder="Note" style={champStyle} />
    </>
  );
}

export const DEPLACEMENT_VIDE = { type: "INTERNE", lieu: "", site: "", transporteur: "", note: "" };

export default function Identification({ bete, lieux }) {
  const [panneau, setPanneau] = useState(null); // "boucle" | "deplacement"
  const [boucle, setBoucle] = useState({ numero: "", date: aujourdhui(), raison: "PERDUE", note: "" });
  const [depl, setDepl] = useState({ date: aujourdhui(), ...DEPLACEMENT_VIDE });
  const { appeler, enCours, erreur, setErreur } = useApi();
  const active = bete.statut === "ACTIVE";
  const ou = emplacement(bete.deplacements);
  const ouvrir = (p) => { setErreur(""); setPanneau((v) => (v === p ? null : p)); };
  const majBoucle = (champ) => (e) => setBoucle((b) => ({ ...b, [champ]: e.target.value }));
  const majDepl = (champ) => (e) => setDepl((d) => ({ ...d, [champ]: e.target.value }));

  async function remplacer() {
    if (await appeler(`/api/elevage/betes/${bete.id}/boucle`, "POST", boucle)) {
      setBoucle((b) => ({ ...b, numero: "", note: "" }));
      setPanneau(null);
    }
  }
  async function deplacer() {
    if (await appeler("/api/elevage/deplacements", "POST", { ...depl, beteIds: [bete.id] })) {
      setDepl((d) => ({ ...d, ...DEPLACEMENT_VIDE }));
      setPanneau(null);
    }
  }
  async function annulerBoucle(b) {
    if (window.confirm(`Annuler ce remplacement ? La boucle ${formaterBoucle(b.numero)} redevient celle de la bête.`)) await appeler(`/api/elevage/betes/${bete.id}/boucle?boucleId=${b.id}`, "DELETE");
  }
  async function retirerDeplacement(id) {
    if (window.confirm("Retirer ce déplacement ?")) await appeler(`/api/elevage/deplacements?id=${id}`, "DELETE");
  }

  return (
    <Section
      titre="Identification et déplacements" icone="epingle" teinte={TEINTES.bleu}
      droite={<Link href="/elevage/registre" style={{ padding: "4px 0", fontSize: 13, fontWeight: 700, color: "var(--accent-ombre)", textDecoration: "none", whiteSpace: "nowrap" }}>Registre</Link>}
    >
      <LigneDetail premiere label="Boucle ATQ" valeur={bete.identifiant ? formaterBoucle(bete.identifiant) : "à inscrire dans la fiche"} />
      <LigneDetail label="Emplacement" valeur={ou ? `${ou.horsFerme ? "Hors ferme — " : ""}${ou.lieu} (depuis le ${dateLisible(ou.depuis)})` : null} />

      {active && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "12px 0" }}>
          <BoutonAction icone="epingle" couleur="#221f18" fond="var(--accent)" bordure="var(--accent)" onClick={() => ouvrir("deplacement")}>Déplacer</BoutonAction>
          <BoutonAction icone="etiquette" onClick={() => ouvrir("boucle")} disabled={!bete.identifiant}>Remplacer la boucle</BoutonAction>
        </div>
      )}

      {panneau === "deplacement" && (
        <div style={{ background: "var(--bg)", border: "1px solid var(--accent)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <ChampsDeplacement champs={depl} maj={majDepl} lieux={lieux} />
          <Erreur texte={erreur} />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={deplacer} disabled={enCours} className="bouton-3d" style={boutonPrincipal}>{enCours ? "…" : "Enregistrer le déplacement"}</button>
            <button onClick={() => setPanneau(null)} style={{ ...boutonLien, color: "var(--text-muted)", padding: "0 10px" }}>Annuler</button>
          </div>
        </div>
      )}
      {panneau === "boucle" && (
        <div style={{ background: "var(--bg)", border: "1px solid var(--accent)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div style={grille2}>
            <Champ label="Nouvelle boucle (15 chiffres)"><input inputMode="numeric" value={boucle.numero} onChange={majBoucle("numero")} placeholder="124 000 …" style={champStyle} /></Champ>
            <Champ label="Date"><input type="date" max="9999-12-31" value={boucle.date} onChange={majBoucle("date")} style={champStyle} /></Champ>
            <Champ label="Raison">
              <select value={boucle.raison} onChange={majBoucle("raison")} style={champStyle}>
                {RAISONS_BOUCLE.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
              </select>
            </Champ>
            <Champ label="Note"><input value={boucle.note} onChange={majBoucle("note")} style={champStyle} /></Champ>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 8px" }}>L'ancienne boucle reste au dossier de la bête. Pour corriger une faute de frappe, modifie plutôt la fiche.</p>
          <Erreur texte={erreur} />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={remplacer} disabled={enCours} className="bouton-3d" style={boutonPrincipal}>{enCours ? "…" : "Remplacer la boucle"}</button>
            <button onClick={() => setPanneau(null)} style={{ ...boutonLien, color: "var(--text-muted)", padding: "0 10px" }}>Annuler</button>
          </div>
        </div>
      )}
      {!panneau && <Erreur texte={erreur} />}

      {bete.boucles.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={sousTitre}>Boucles remplacées</div>
          {bete.boucles.map((b, i) => (
            <div key={b.id} style={{ ...ligne, borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{formaterBoucle(b.numero)}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", overflowWrap: "anywhere" }}>
                  {[`retirée le ${dateLisible(b.retireeLe)}`, libelle(RAISONS_BOUCLE, b.raison).toLowerCase(), b.note, b.creePar && `par ${b.creePar}`].filter(Boolean).join(" · ")}
                </div>
              </div>
              {b.remplaceePar === bete.identifiant && <BoutonRetirer titre="Annuler ce remplacement" onClick={() => annulerBoucle(b)} />}
            </div>
          ))}
        </div>
      )}

      {bete.deplacements.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={sousTitre}>Déplacements</div>
          {bete.deplacements.map((d, i) => (
            <div key={d.id} style={{ ...ligne, borderTop: i === 0 ? "none" : "1px solid var(--border)" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, overflowWrap: "anywhere" }}>
                  {d.type === "INTERNE" ? d.lieu : `${EVENEMENTS[d.type]} — ${d.site}${d.type === "ENTREE" && d.lieu ? ` → ${d.lieu}` : ""}`}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", overflowWrap: "anywhere" }}>
                  {[dateLisible(d.date), d.transporteur, d.note, d.creePar && `par ${d.creePar}`].filter(Boolean).join(" · ")}
                </div>
              </div>
              <BoutonRetirer titre="Retirer ce déplacement" onClick={() => retirerDeplacement(d.id)} />
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

const sousTitre = { fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 };
const ligne = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 2px" };
