"use client";

import { useState } from "react";
import Link from "next/link";
import BandeauSection from "../../components/BandeauSection";
import { BoutonPlein } from "../../components/StyleSection";
import {
  ENTRETIENS_SUGGERES_IMMO, TYPES_ENTRETIEN, CATEGORIES_REPARATION, argent, dateLisible, dateCourte, trouver, libelle, etatEcheance, frequenceLisible,
} from "@/lib/immobilierCalculs";
import { NavImmo, Section, Formulaire, Onglets, Vide, BoutonTexte, BoutonSupprimer, PastilleEtat, valeursDe, champStyle, labelStyle, useApi, Erreur, lien, aujourdhui } from "../ui";
import ChampArgent from "@/app/components/ChampArgent";

// Les essentiels d'un plex, ajoutés d'un coup à un immeuble
const ESSENTIELS = ["Vérification des avertisseurs de fumée", "Ramonage de la cheminée", "Inspection des chauffe-eau", "Nettoyage des gouttières", "Inspection de la toiture", "Inspection des balcons, escaliers et garde-corps"];

const champsEntretien = (immeubles) => [
  { nom: "titre", label: "Entretien ou inspection", pleineLargeur: true },
  ...(immeubles.length > 1 ? [{ nom: "immeubleId", label: "Immeuble", type: "choix", options: immeubles.map((i) => ({ code: i.id, label: i.nom })) }] : []),
  { nom: "type", label: "Type", type: "choix", options: TYPES_ENTRETIEN, defaut: "ENTRETIEN" },
  { nom: "categorie", label: "Catégorie", type: "choix", vide: "—", options: CATEGORIES_REPARATION },
  { nom: "frequenceMois", label: "Aux combien de mois", type: "nombre", defaut: "12" },
  { nom: "prochaineDate", label: "Prochaine date", type: "date" },
  { nom: "derniereDate", label: "Dernière fois", type: "date" },
  { nom: "entrepreneur", label: "Entrepreneur habituel" },
  { nom: "telephoneEntrepreneur", label: "Téléphone de l'entrepreneur", typeHtml: "tel" },
  { nom: "coutEstime", label: "Coût estimé ($)", type: "argent" },
  { nom: "obligatoire", label: "Exigé par la loi, un règlement municipal ou l'assureur", type: "case" },
  { nom: "dansLogements", label: "Se fait dans les logements (avis d'accès de 24 h aux locataires)", type: "case" },
  { nom: "actif", label: "Actif (dans le calendrier)", type: "case", defaut: true },
  { nom: "description", label: "Description, liste de vérification", type: "long", lignes: 3 },
];

export default function EntretienClient({ entretiens, immeubles, immeubleInitial, courriel }) {
  const [immeuble, setImmeuble] = useState(immeubleInitial);
  const [formulaire, setFormulaire] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [edition, setEdition] = useState(null);
  const [vue, setVue] = useState("CALENDRIER");
  const champs = champsEntretien(immeubles);
  const visibles = entretiens.filter((e) => !immeuble || e.immeubleId === immeuble);
  const actifs = visibles.filter((e) => e.actif);
  const inactifs = visibles.filter((e) => !e.actif);
  const cible = immeuble || immeubles[0]?.id;
  const dejaLa = new Set(entretiens.filter((e) => e.immeubleId === cible).map((e) => e.titre));

  // Calendrier : les entretiens en retard en tête, puis mois par mois
  const mois = {};
  for (const e of actifs) {
    const etat = etatEcheance(e.prochaineDate);
    const cle = etat.code === "RETARD" ? "0000-00" : dateCourte(e.prochaineDate).slice(0, 7);
    (mois[cle] ||= []).push({ ...e, etat });
  }
  const cles = Object.keys(mois).sort();
  const enRetard = mois["0000-00"]?.length || 0;

  return (
    <div className="conteneur-page">
      <BandeauSection icone="🗓️" titre="Entretien préventif" sousTitre="Ramonage, avertisseurs, gouttières… ce qui revient chaque année dans tes immeubles." />
      <NavImmo actif="/immobilier/reparations" />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 14 }}>
        {immeubles.length > 0 && <BoutonPlein icone={formulaire ? null : "plus"} onClick={() => { setFormulaire((v) => !v); setSuggestion(null); }}>{formulaire ? "Annuler" : "Nouvel entretien"}</BoutonPlein>}
        {immeubles.length > 1 && (
          <select value={immeuble} onChange={(e) => setImmeuble(e.target.value)} aria-label="Immeuble" style={{ ...champStyle, width: "auto", marginBottom: 0 }}>
            <option value="">Tous les immeubles</option>
            {immeubles.map((i) => <option key={i.id} value={i.id}>{i.nom}</option>)}
          </select>
        )}
        <Link href="/immobilier/reparations" style={{ fontSize: 13.5, fontWeight: 700, ...lien }}>🛠️ Réparations</Link>
      </div>

      {immeubles.length === 0 && <Vide>Ajoute d'abord tes <Link href="/immobilier/immeubles" style={lien}>immeubles</Link>.</Vide>}
      {formulaire && (
        <>
          <Section titre="Suggestions pour un immeuble locatif" droite={<Essentiels immeubleId={cible} nom={immeubles.find((i) => i.id === cible)?.nom} dejaLa={dejaLa} onFini={() => setFormulaire(false)} />}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {ENTRETIENS_SUGGERES_IMMO.filter((s) => !dejaLa.has(s.titre)).map((s) => {
                const choisi = suggestion?.titre === s.titre;
                return (
                  <button key={s.titre} type="button" onClick={() => setSuggestion(s)} style={{ fontSize: 12.5, padding: "6px 10px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${choisi ? "var(--accent)" : "var(--border)"}`, background: choisi ? "var(--accent)" : "var(--bg)", color: choisi ? "#221f18" : "var(--text)" }}>
                    {trouver(TYPES_ENTRETIEN, s.type)?.icone} {s.titre}{s.obligatoire && " ⚖️"}
                  </button>
                );
              })}
            </div>
          </Section>
          <Formulaire
            key={`${suggestion?.titre || "vide"}-${cible}`} champs={champs} extra={immeubles.length > 1 ? {} : { immeubleId: cible }}
            initial={{
              immeubleId: cible, prochaineDate: aujourdhui(), actif: true,
              ...(suggestion && { titre: suggestion.titre, type: suggestion.type, categorie: suggestion.categorie, frequenceMois: String(suggestion.frequenceMois), obligatoire: Boolean(suggestion.obligatoire), dansLogements: Boolean(suggestion.dansLogements), description: suggestion.description || "" }),
            }}
            url="/api/immobilier/entretiens" bouton="Ajouter au calendrier" onFini={() => { setFormulaire(false); setSuggestion(null); }}
          />
        </>
      )}
      {edition && (
        <Section titre={`Modifier — ${edition.titre}`} droite={<BoutonTexte onClick={() => setEdition(null)}>Annuler</BoutonTexte>}>
          <Formulaire key={edition.id} cadre={false} champs={champs} initial={valeursDe(edition, champs)} url={`/api/immobilier/entretiens/${edition.id}`} methode="PATCH" onFini={() => setEdition(null)} />
          <div style={{ marginTop: 10 }}><BoutonSupprimer url={`/api/immobilier/entretiens/${edition.id}`} confirmation={`Supprimer « ${edition.titre} » du calendrier ? Ses interventions restent dans les réparations.`} onFini={() => setEdition(null)}>Supprimer</BoutonSupprimer></div>
        </Section>
      )}

      {visibles.length > 0 && <Onglets options={[{ code: "CALENDRIER", label: `Calendrier${enRetard ? ` (${enRetard} en retard)` : ""}` }, { code: "LISTE", label: "Tous les entretiens" }]} valeur={vue} onChange={setVue} />}
      {immeubles.length > 0 && visibles.length === 0 && !formulaire && (
        <Vide>Aucun entretien planifié. « Nouvel entretien » propose les essentiels d'un immeuble locatif : avertisseurs de fumée, ramonage, chauffe-eau, gouttières, toiture, balcons.</Vide>
      )}
      {vue === "CALENDRIER" && cles.map((cle) => (
        <Section key={cle} titre={cle === "0000-00" ? "⚠️ En retard" : new Intl.DateTimeFormat("fr-CA", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${cle}-15T12:00:00Z`))}>
          {mois[cle].map((e) => <LigneEntretien key={e.id} e={e} plusieurs={immeubles.length > 1} courriel={courriel} onModifier={() => setEdition(e)} />)}
        </Section>
      ))}
      {vue === "LISTE" && (
        <Section titre="Tous les entretiens et inspections">
          {[...actifs, ...inactifs].map((e) => <LigneEntretien key={e.id} e={{ ...e, etat: etatEcheance(e.prochaineDate) }} plusieurs={immeubles.length > 1} courriel={courriel} onModifier={() => setEdition(e)} detail />)}
        </Section>
      )}
    </div>
  );
}

// Ajoute d'un coup les entretiens essentiels qui manquent à l'immeuble
function Essentiels({ immeubleId, nom, dejaLa, onFini }) {
  const { appeler, enCours, erreur } = useApi();
  const manquants = ENTRETIENS_SUGGERES_IMMO.filter((s) => ESSENTIELS.includes(s.titre) && !dejaLa.has(s.titre));
  if (!immeubleId || manquants.length === 0) return null;
  async function ajouter() {
    if (!window.confirm(`Ajouter ${manquants.length} entretiens essentiels à ${nom} ? Prochaine date : aujourd'hui, à ajuster ensuite.`)) return;
    for (const s of manquants) {
      const r = await appeler("/api/immobilier/entretiens", "POST", { immeubleId, titre: s.titre, type: s.type, categorie: s.categorie, frequenceMois: String(s.frequenceMois), prochaineDate: aujourdhui(), obligatoire: Boolean(s.obligatoire), dansLogements: Boolean(s.dansLogements), description: s.description || "", actif: true });
      if (!r) return;
    }
    onFini();
  }
  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      <BoutonTexte onClick={ajouter} disabled={enCours}>{enCours ? "…" : `+ Les ${manquants.length} essentiels`}</BoutonTexte>
      <Erreur texte={erreur} />
    </span>
  );
}

function LigneEntretien({ e, plusieurs, courriel, onModifier, detail }) {
  const [ouvert, setOuvert] = useState(null); // "FAIT" | "AVIS"
  const basculer = (x) => setOuvert((v) => (v === x ? null : x));
  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid var(--border)", opacity: e.actif ? 1 : 0.6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>
          {trouver(TYPES_ENTRETIEN, e.type)?.icone} {e.titre}
          {e.obligatoire && <span title="Exigé par la loi, un règlement municipal ou l'assureur"> ⚖️</span>}
          {e.dansLogements && <span title="Se fait dans les logements : avis d'accès aux locataires"> 🏠</span>}
        </span>
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12.5 }}>
          <span style={{ color: "var(--text-muted)" }}>{dateLisible(e.prochaineDate)}</span>
          {e.actif ? <PastilleEtat etat={e.etat} /> : <span style={{ color: "var(--text-muted)" }}>inactif</span>}
        </span>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
        {[plusieurs && e.immeuble?.nom, frequenceLisible(e.frequenceMois), e.entrepreneur, e.coutEstime != null && `≈ ${argent(e.coutEstime)}`, e.derniereDate && `dernière fois : ${dateLisible(e.derniereDate)}`, detail && e.categorie && libelle(CATEGORIES_REPARATION, e.categorie)].filter(Boolean).join(" · ")}
      </div>
      {e.reparations?.length > 0 && (
        <div style={{ fontSize: 12, marginTop: 3 }}>
          {e.reparations.map((r, i) => <span key={r.id}>{i > 0 && " · "}<Link href={`/immobilier/reparations/${r.id}`} style={lien}>{r.numero}</Link> <span style={{ color: "var(--text-muted)" }}>{dateLisible(r.dateFin)}{r.coutReel != null ? `, ${argent(r.coutReel)}` : ""}</span></span>)}
        </div>
      )}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 7 }}>
        {e.actif && <BoutonTexte onClick={() => basculer("FAIT")}>✓ Fait</BoutonTexte>}
        {e.actif && e.dansLogements && <BoutonTexte onClick={() => basculer("AVIS")}>📣 Avis d'accès aux locataires</BoutonTexte>}
        <BoutonTexte onClick={onModifier}>Modifier</BoutonTexte>
      </div>
      {ouvert === "FAIT" && <FormFait e={e} onFini={() => setOuvert(null)} />}
      {ouvert === "AVIS" && <FormAvis e={e} courriel={courriel} />}
    </div>
  );
}

const boiteForm = { marginTop: 8, padding: 12, borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg)" };
const grille = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 };

function FormFait({ e, onFini }) {
  const { appeler, enCours, erreur } = useApi();
  const [v, setV] = useState({ date: aujourdhui(), coutReel: "", entrepreneur: e.entrepreneur || "", numeroFacture: "" });
  const maj = (k) => (ev) => setV((o) => ({ ...o, [k]: ev.target.value }));
  async function envoyer() {
    const r = await appeler(`/api/immobilier/entretiens/${e.id}/fait`, "POST", v);
    if (r) onFini();
  }
  return (
    <div style={boiteForm}>
      <div style={grille}>
        <div><label style={labelStyle}>Fait le</label><input type="date" value={v.date} onChange={maj("date")} style={champStyle} /></div>
        <div><label style={labelStyle}>Coût réel ($)</label><ChampArgent negatif={false} value={v.coutReel} onChange={maj("coutReel")} placeholder={e.coutEstime != null ? String(e.coutEstime).replace(".", ",") : ""} style={champStyle} /></div>
        <div><label style={labelStyle}>Entrepreneur</label><input value={v.entrepreneur} onChange={maj("entrepreneur")} style={champStyle} /></div>
        <div><label style={labelStyle}>N° de facture</label><input value={v.numeroFacture} onChange={maj("numeroFacture")} style={champStyle} /></div>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "2px 0 8px" }}>L'intervention s'inscrit dans les réparations de l'immeuble (historique ; le coût compte dans les dépenses et l'impôt) ; prochaine fois dans {e.frequenceMois} mois.</p>
      <Erreur texte={erreur} />
      <button type="button" onClick={envoyer} disabled={enCours} className="bouton-3d" style={{ padding: "9px 14px", borderRadius: 10, fontSize: 13.5, fontWeight: 700 }}>{enCours ? "…" : "Inscrire comme fait"}</button>
    </div>
  );
}

function FormAvis({ e, courriel }) {
  const { appeler, enCours, erreur } = useApi();
  const demain = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const [v, setV] = useState({ dateAcces: dateCourte(e.prochaineDate) > aujourdhui() ? dateCourte(e.prochaineDate) : demain, heure: "entre 9 h et 12 h", envoyer: courriel });
  const [resultat, setResultat] = useState(null);
  async function envoyer() {
    const r = await appeler(`/api/immobilier/entretiens/${e.id}/avis-acces`, "POST", v);
    if (r) setResultat(r);
  }
  return (
    <div style={boiteForm}>
      <div style={grille}>
        <div><label style={labelStyle}>Date de la visite</label><input type="date" value={v.dateAcces} min={demain} onChange={(ev) => setV((o) => ({ ...o, dateAcces: ev.target.value }))} style={champStyle} /></div>
        <div><label style={labelStyle}>Heure</label><input value={v.heure} onChange={(ev) => setV((o) => ({ ...o, heure: ev.target.value }))} style={champStyle} /></div>
      </div>
      {courriel && (
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, margin: "0 0 8px", cursor: "pointer" }}>
          <input type="checkbox" checked={v.envoyer} onChange={(ev) => setV((o) => ({ ...o, envoyer: ev.target.checked }))} /> Envoyer aussi par courriel aux locataires (PDF joint)
        </label>
      )}
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 8px" }}>Un avis d'accès par bail en cours de l'immeuble, rangé dans les documents de chaque bail. Il se donne au moins 24 heures avant la visite ; la visite a lieu entre 9 h et 21 h.</p>
      <Erreur texte={erreur} />
      <button type="button" onClick={envoyer} disabled={enCours} className="bouton-3d" style={{ padding: "9px 14px", borderRadius: 10, fontSize: 13.5, fontWeight: 700 }}>{enCours ? "Préparation…" : "Préparer les avis d'accès"}</button>
      {resultat && (
        <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--success)", margin: "8px 0 0" }}>
          {resultat.generes} avis préparé{resultat.generes > 1 ? "s" : ""}{resultat.parCourriel ? `, ${resultat.envoyes} envoyé${resultat.envoyes > 1 ? "s" : ""} par courriel` : ""}{resultat.sansCourriel?.length ? ` — sans courriel : logement${resultat.sansCourriel.length > 1 ? "s" : ""} ${resultat.sansCourriel.join(", ")}` : ""}.
        </p>
      )}
    </div>
  );
}
