"use client";

// Lignée d'une bête (parents et grands-parents inscrits au troupeau) et
// reproduction d'une femelle : saillies et inséminations, vêlage prévu,
// inscription du veau au vêlage, alerte de consanguinité.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TEINTES, Pastille, BoutonAction } from "../../components/StyleSection";
import {
  SEXES, TYPES_SAILLIE, STATUTS_SAILLIE, GESTATION_JOURS, libelle, dateLisible, velagePrevu, saillieEnCours, joursAvant,
  parente, decrireParente, nomBete,
} from "@/lib/elevageCalculs";
import { champStyle, boutonPrincipal, boutonLien, grille2, Champ, Erreur, useApi, aujourdhui, Section, BoutonRetirer } from "../ui";

const alerteStyle = { fontSize: 13, fontWeight: 700, color: "var(--danger)", background: "var(--danger-fond)", borderRadius: 12, padding: "10px 12px", margin: "0 0 12px" };

// ---------- Lignée ----------

// registre : Map id → bête ; texte : père entré à la main (hors troupeau)
function Ancetre({ role, bete, texte, registre, niveau }) {
  const mere = bete && registre.get(bete.mereId);
  const pere = bete && registre.get(bete.pereId);
  const suite = bete && niveau < 2 && (mere || pere || bete.pere);
  return (
    <div style={{ marginLeft: niveau === 1 ? 0 : 16, paddingLeft: niveau === 1 ? 0 : 12, borderLeft: niveau === 1 ? "none" : "2px solid var(--border)" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "6px 0", fontSize: 13.5 }}>
        <span style={{ color: "var(--text-muted)", flexShrink: 0, minWidth: niveau === 1 ? 44 : 92 }}>{role}</span>
        {bete ? (
          <Link href={`/elevage/${bete.id}`} style={{ color: "var(--accent-ombre)", fontWeight: 700, overflowWrap: "anywhere" }}>{nomBete(bete)}</Link>
        ) : (
          <span style={{ fontWeight: texte ? 700 : 400, color: texte ? "var(--text)" : "var(--text-muted)", overflowWrap: "anywhere" }}>{texte || "inconnu"}</span>
        )}
      </div>
      {suite && (
        <>
          <Ancetre role="Grand-père" bete={pere} texte={bete.pere} registre={registre} niveau={niveau + 1} />
          <Ancetre role="Grand-mère" bete={mere} registre={registre} niveau={niveau + 1} />
        </>
      )}
    </div>
  );
}

export function Lignee({ bete, registre }) {
  const parId = new Map(registre.map((b) => [b.id, b]));
  const mere = parId.get(bete.mereId);
  const pere = parId.get(bete.pereId);
  if (!mere && !pere && !bete.pere) return null;
  const liens = parente(bete.mereId, bete.pereId, parId);
  return (
    <Section titre="Lignée" icone="utilisateurs" teinte={TEINTES.bleu} sousTitre="Parents et grands-parents inscrits au troupeau">
      {liens.length > 0 && (
        <p style={alerteStyle}>⚠️ Parents apparentés — {liens.map((l) => decrireParente(l, "la mère", "le père")).join(" ; ")}.</p>
      )}
      <Ancetre role="Père" bete={pere} texte={bete.pere} registre={parId} niveau={1} />
      <Ancetre role="Mère" bete={mere} registre={parId} niveau={1} />
    </Section>
  );
}

// ---------- Reproduction (femelle) ----------

const SAILLIE_VIDE = { type: "NATURELLE", taureauId: "", semence: "", note: "" };

export function Reproduction({ bete, registre, taureaux }) {
  const [champs, setChamps] = useState({ date: aujourdhui(), ...SAILLIE_VIDE });
  const [formulaire, setFormulaire] = useState(false);
  const { appeler, enCours, erreur } = useApi();
  const maj = (champ) => (e) => setChamps((c) => ({ ...c, [champ]: e.target.value }));
  const active = bete.statut === "ACTIVE";
  const enCoursDeGestation = bete.saillies.find(saillieEnCours);
  const parId = new Map(registre.map((b) => [b.id, b]));
  const taureau = parId.get(champs.taureauId);
  const liens = taureau ? parente(bete.id, taureau.id, parId) : [];

  async function ajouter() {
    if (liens.length > 0 && !window.confirm(`${nomBete(taureau)} est apparenté à ${nomBete(bete)}. Enregistrer cette saillie quand même ?`)) return;
    if (await appeler(`/api/elevage/betes/${bete.id}/saillies`, "POST", champs)) {
      setChamps((c) => ({ ...c, ...SAILLIE_VIDE }));
      setFormulaire(false);
    }
  }

  return (
    <Section
      titre="Reproduction" icone="calendrier" teinte={TEINTES.ambre}
      sousTitre={enCoursDeGestation ? `Vêlage prévu le ${dateLisible(velagePrevu(enCoursDeGestation.date))}` : bete.saillies.length > 0 ? `${bete.saillies.length} saillie${bete.saillies.length > 1 ? "s" : ""}` : undefined}
    >
      {active && (formulaire ? (
        <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div style={grille2}>
            <Champ label="Date"><input type="date" max="9999-12-31" value={champs.date} onChange={maj("date")} style={champStyle} /></Champ>
            <Champ label="Type">
              <select value={champs.type} onChange={maj("type")} style={champStyle}>
                {TYPES_SAILLIE.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
              </select>
            </Champ>
            <Champ label="Taureau du troupeau">
              <select value={champs.taureauId} onChange={maj("taureauId")} style={champStyle}>
                <option value="">— (de l'extérieur ou semence)</option>
                {taureaux.map((t) => <option key={t.id} value={t.id}>{nomBete(t)}</option>)}
              </select>
            </Champ>
            {!champs.taureauId && (
              <Champ label="Semence ou taureau de l'extérieur"><input value={champs.semence} onChange={maj("semence")} placeholder="Nom du taureau, numéro de paillette…" style={champStyle} /></Champ>
            )}
          </div>
          {liens.length > 0 && (
            <p style={alerteStyle}>⚠️ Consanguinité — {liens.map((l) => decrireParente(l, nomBete(bete), nomBete(taureau))).join(" ; ")}.</p>
          )}
          <input value={champs.note} onChange={maj("note")} placeholder="Note (inséminateur, chaleur observée…)" style={champStyle} />
          {champs.date && <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 8px" }}>Vêlage prévu vers le {dateLisible(velagePrevu(`${champs.date}T12:00:00Z`))} ({GESTATION_JOURS} jours).</p>}
          <Erreur texte={erreur} />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={ajouter} disabled={enCours} className="bouton-3d" style={boutonPrincipal}>{enCours ? "…" : "Enregistrer la saillie"}</button>
            <button onClick={() => setFormulaire(false)} style={{ ...boutonLien, color: "var(--text-muted)", padding: "0 10px" }}>Annuler</button>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 12 }}><BoutonAction icone="plus" couleur="#221f18" fond="var(--accent)" bordure="var(--accent)" onClick={() => setFormulaire(true)} style={{ width: "100%" }}>Saillie ou insémination</BoutonAction></div>
      ))}
      {bete.saillies.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Aucune saillie enregistrée.</p>
      ) : (
        bete.saillies.map((s, i) => <LigneSaillie key={s.id} saillie={s} bete={bete} premiere={i === 0} />)
      )}
    </Section>
  );
}

function LigneSaillie({ saillie: s, bete, premiere }) {
  const router = useRouter();
  const [velage, setVelage] = useState(null); // champs du formulaire de vêlage
  const { appeler, enCours, erreur } = useApi();
  const statut = STATUTS_SAILLIE.find((x) => x.code === s.statut);
  const prevu = velagePrevu(s.date);
  const jours = joursAvant(prevu);
  const url = `/api/elevage/betes/${bete.id}/saillies?saillieId=${s.id}`;
  const majVelage = (champ) => (e) => setVelage((v) => ({ ...v, [champ]: e.target.value }));

  async function inscrireVeau() {
    const data = await appeler(url, "PATCH", { velage });
    if (data) router.push(`/elevage/${data.veauId}`);
  }
  async function retirer() {
    if (window.confirm("Retirer cette saillie ?")) await appeler(url, "DELETE");
  }
  const bouton = (statutVise, texte) => (
    <button onClick={() => appeler(url, "PATCH", { statut: statutVise })} disabled={enCours} style={{ ...boutonLien, fontSize: 13, fontWeight: 700, color: "var(--accent-ombre)" }}>{texte}</button>
  );

  return (
    <div style={{ padding: "10px 2px", borderTop: premiere ? "none" : "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, overflowWrap: "anywhere" }}>
            {libelle(TYPES_SAILLIE, s.type)} — {s.taureau ? <Link href={`/elevage/${s.taureau.id}`} style={{ color: "var(--accent-ombre)" }}>{nomBete(s.taureau)}</Link> : s.semence || "géniteur retiré du registre"}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", overflowWrap: "anywhere" }}>
            {[dateLisible(s.date), s.note, s.creePar && `par ${s.creePar}`].filter(Boolean).join(" · ")}
          </div>
          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <Pastille couleur={statut?.couleur || "var(--text-muted)"} fond="var(--surface-alt)">{statut?.label || s.statut}</Pastille>
            {saillieEnCours(s) && <span style={{ fontSize: 12.5, fontWeight: 700, color: jours < 0 ? "var(--danger)" : "var(--text)" }}>Vêlage prévu le {dateLisible(prevu)} ({jours < 0 ? `dépassé de ${-jours} j` : `dans ${jours} j`})</span>}
            {s.veau && <Link href={`/elevage/${s.veau.id}`} style={{ fontSize: 12.5, fontWeight: 700, color: "var(--accent-ombre)" }}>Veau : {nomBete(s.veau)}</Link>}
          </div>
        </div>
        <BoutonRetirer titre="Retirer cette saillie" onClick={retirer} />
      </div>
      {!s.veau && !velage && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 8 }}>
          {s.statut !== "GESTANTE" && bouton("GESTANTE", "Gestation confirmée")}
          {s.statut !== "VIDE" && bouton("VIDE", "Non gestante")}
          {s.statut !== "EN_ATTENTE" && bouton("EN_ATTENTE", "À confirmer")}
          {s.statut !== "VIDE" && <button onClick={() => setVelage({ date: aujourdhui(), sexe: "", nom: "", poids: "" })} style={{ ...boutonLien, fontSize: 13, fontWeight: 700, color: "var(--success)" }}>Vêlage…</button>}
        </div>
      )}
      {velage && (
        <div style={{ background: "var(--bg)", border: "1px solid var(--accent)", borderRadius: 12, padding: 12, marginTop: 10 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 8 }}>Vêlage — inscrire le veau au troupeau</div>
          <div style={grille2}>
            <Champ label="Date de naissance"><input type="date" max="9999-12-31" value={velage.date} onChange={majVelage("date")} style={champStyle} /></Champ>
            <Champ label="Sexe">
              <select value={velage.sexe} onChange={majVelage("sexe")} style={champStyle}>
                <option value="">—</option>
                {SEXES.map((x) => <option key={x.code} value={x.code}>{x.label}</option>)}
              </select>
            </Champ>
            <Champ label="Nom (facultatif)"><input value={velage.nom} onChange={majVelage("nom")} style={champStyle} /></Champ>
            <Champ label="Poids à la naissance (kg)"><input inputMode="decimal" value={velage.poids} onChange={majVelage("poids")} style={champStyle} /></Champ>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 8px" }}>Sa mère, son père et sa génétique sont repris de cette saillie ; le reste se complète sur sa fiche.</p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={inscrireVeau} disabled={enCours} className="bouton-3d" style={boutonPrincipal}>{enCours ? "…" : "Inscrire le veau"}</button>
            <button onClick={() => setVelage(null)} style={{ ...boutonLien, color: "var(--text-muted)", padding: "0 10px" }}>Annuler</button>
          </div>
        </div>
      )}
      <Erreur texte={erreur} />
    </div>
  );
}
