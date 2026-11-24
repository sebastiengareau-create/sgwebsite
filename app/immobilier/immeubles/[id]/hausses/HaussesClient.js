"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TEINTES } from "../../../../components/StyleSection";
import {
  argent, dateLisible, nomLogement, nomsLocataires, etatFinBail, haussesImmeuble, loyersImmeuble, pourcentageBase, periodeTalLisible, hausseLisible,
  POURCENTAGE_IMMOBILISATIONS_TAL,
} from "@/lib/immobilierCalculs";
import { Retour, Panneau, Vide, Erreur, PastilleEtat, champStyle, labelStyle, boutonPrincipal, lien, useApi } from "../../../ui";

// « 1 234,56 » → 1234.56 ; vide ou invalide → null
const nombre = (v) => {
  const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return String(v ?? "").trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null;
};
const texte = (n) => (n == null ? "" : String(Math.round(n * 100) / 100).replace(".", ","));
const pc = (n, d = 2) => `${(Math.round(n * 10 ** d) / 10 ** d).toString().replace(".", ",")} %`;

export default function HaussesClient({ immeuble, parAnnee, travaux: travauxProposes, inscrits, annee: anneeDefaut, bailVise }) {
  const [annee, setAnnee] = useState(anneeDefaut);
  const prerempli = (a) => ({
    taxes: { avant: texte(parAnnee.taxes[a - 1]), apres: texte(parAnnee.taxes[a]) },
    assurances: { avant: texte(parAnnee.assurances[a - 1]), apres: texte(parAnnee.assurances[a]) },
  });
  const [charges, setCharges] = useState(() => prerempli(anneeDefaut));
  const [taux, setTaux] = useState(() => Object.fromEntries(Object.entries(inscrits).map(([p, t]) => [p, texte(t)])));
  const [travaux, setTravaux] = useState(() => travauxProposes.map((t) => ({ ...t, montant: texte(t.montant), aide: "", logementId: t.logementId || "" })));
  const [pdf, setPdf] = useState(true);
  const [resultat, setResultat] = useState(null);
  const { appeler, enCours, erreur } = useApi();

  const changerAnnee = (a) => { setAnnee(a); setCharges(prerempli(a)); };
  const majCharge = (quoi, quand, v) => setCharges((c) => ({ ...c, [quoi]: { ...c[quoi], [quand]: v } }));
  const majTravaux = (cle, champ, v) => setTravaux((l) => l.map((t) => (t.cle === cle ? { ...t, [champ]: v } : t)));

  const entrees = useMemo(() => ({
    taux: Object.fromEntries(Object.entries(taux).map(([p, t]) => [p, nombre(t)]).filter(([, t]) => t > 0)),
    taxes: { avant: nombre(charges.taxes.avant), apres: nombre(charges.taxes.apres) },
    assurances: { avant: nombre(charges.assurances.avant), apres: nombre(charges.assurances.apres) },
    travaux: travaux.filter((t) => t.choisi && nombre(t.montant)).map((t) => ({ description: t.description, montant: nombre(t.montant), aide: nombre(t.aide) || 0, logementId: t.logementId || null })),
  }), [taux, charges, travaux]);
  const lignes = useMemo(() => haussesImmeuble(immeuble, entrees), [immeuble, entrees]);
  const { sansLoyer } = loyersImmeuble(immeuble.logements);
  const periodes = [...new Set(lignes.map((l) => l.periode))].sort();

  // Cochés au départ : les baux sans avis envoyé dont la période d'avis est ouverte ou à venir
  const [choisis, setChoisis] = useState(() => new Set(lignes.filter((l) => !l.bail.avisEnvoyeLe && (l.bail.id === bailVise || ["AVIS_A_ENVOYER", "PLUS_TARD", "INDETERMINEE"].includes(etatFinBail(l.bail).code))).map((l) => l.bail.id)));
  const basculer = (id) => setChoisis((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const aAppliquer = lignes.filter((l) => choisis.has(l.bail.id) && !l.bail.avisEnvoyeLe && l.calcul);

  useEffect(() => {
    if (bailVise) document.getElementById(`bail-${bailVise}`)?.scrollIntoView({ block: "center" });
  }, [bailVise]);

  async function appliquer() {
    setResultat(null);
    const corps = {
      bailIds: aAppliquer.map((l) => l.bail.id), annee, taux: entrees.taux, pdf,
      taxes: charges.taxes, assurances: charges.assurances,
      travaux: travaux.filter((t) => t.choisi).map(({ description, montant, aide, logementId }) => ({ description, montant, aide, logementId })),
    };
    const data = await appeler(`/api/immobilier/immeubles/${immeuble.id}/hausses`, "POST", corps);
    if (data) setResultat(data);
  }

  return (
    <div className="conteneur-page">
      <Retour href={`/immobilier/immeubles/${immeuble.id}`}>{immeuble.nom}</Retour>
      <h1 style={{ fontSize: 21, margin: "10px 0 6px" }}>🧮 Hausses de loyer</h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 16px" }}>
        Méthode du Tribunal administratif du logement pour les avis donnés depuis le 1er janvier 2026 : le pourcentage de base, la part de la hausse des taxes et des assurances qui dépasse ce pourcentage, et {POURCENTAGE_IMMOBILISATIONS_TAL} % des travaux majeurs. C'est une estimation à confirmer avec l'outil de calcul du TAL (tal.gouv.qc.ca) : si le locataire refuse la hausse, c'est le TAL qui fixe le loyer, sur pièces justificatives.
      </p>

      <Panneau icone="calculatrice" teinte={TEINTES.bleu} titre="Pourcentage de base" sousTitre="Publié par le TAL chaque janvier — moyenne sur trois ans de l'inflation au Québec">
        {periodes.length === 0 ? <Vide>Aucun bail résidentiel en cours dans cet immeuble.</Vide> : periodes.map((p) => <LignePourcentage key={p} periode={p} valeur={taux[p] ?? ""} onChange={(v) => setTaux((t) => ({ ...t, [p]: v }))} />)}
      </Panneau>

      <Panneau icone="banque" teinte={TEINTES.ambre} titre="Taxes et assurances de l'immeuble" sousTitre="Montants annuels — tirés des dépenses inscrites ; corrige-les avec les comptes de taxes et la police d'assurance">
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13, marginBottom: 10 }}>
          <label htmlFor="annee-avis">Avis envoyés en</label>
          <select id="annee-avis" value={annee} onChange={(e) => changerAnnee(Number(e.target.value))} style={{ ...champStyle, width: "auto", marginBottom: 0 }}>
            {[anneeDefaut - 1, anneeDefaut, anneeDefaut + 1].map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <span style={{ color: "var(--text-muted)" }}>: on compare {annee} à {annee - 1}.</span>
        </div>
        <LigneCharge titre="Taxes municipales et scolaires" annee={annee} valeurs={charges.taxes} onChange={(q, v) => majCharge("taxes", q, v)} />
        <LigneCharge titre="Assurances (incendie et responsabilité)" annee={annee} valeurs={charges.assurances} onChange={(q, v) => majCharge("assurances", q, v)} />
      </Panneau>

      <Panneau icone="outils" teinte={TEINTES.vert} titre="Travaux majeurs" sousTitre={`Dépenses d'immobilisation, aides et subventions déduites : ${POURCENTAGE_IMMOBILISATIONS_TAL} % par année`}>
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 8px" }}>Toiture, fenêtres, balcons, chauffage, remplacement d'équipements… — pas l'entretien courant (peinture, débouchage, petites réparations). Ceux marqués « immobilisation » sont déjà cochés ; ceux d'un seul logement ne comptent que pour lui.</p>
        {travaux.length === 0 && <Vide>Aucune réparation terminée avec un coût ni aucun achat « Travaux majeurs » ces deux dernières années.</Vide>}
        {travaux.map((t) => (
          <div key={t.cle} style={{ borderTop: "1px solid var(--border)", padding: "8px 0" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13.5, cursor: "pointer" }}>
              <input type="checkbox" checked={t.choisi} onChange={(e) => majTravaux(t.cle, "choisi", e.target.checked)} style={{ marginTop: 3 }} />
              {t.manuel
                ? <input value={t.description} onChange={(e) => majTravaux(t.cle, "description", e.target.value)} placeholder="Description des travaux" style={{ ...champStyle, marginBottom: 0 }} />
                : <span><strong>{t.description}</strong>{t.quand && <span style={{ color: "var(--text-muted)", fontSize: 12 }}> · {dateLisible(t.quand)}</span>}</span>}
            </label>
            {t.choisi && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, margin: "8px 0 0 24px" }}>
                <div><label style={labelStyle}>Coût ($)</label><input inputMode="decimal" value={t.montant} onChange={(e) => majTravaux(t.cle, "montant", e.target.value)} style={champStyle} /></div>
                <div><label style={labelStyle}>Aides, subventions ($)</label><input inputMode="decimal" value={t.aide} onChange={(e) => majTravaux(t.cle, "aide", e.target.value)} style={champStyle} /></div>
                <div>
                  <label style={labelStyle}>Pour</label>
                  <select value={t.logementId} onChange={(e) => majTravaux(t.cle, "logementId", e.target.value)} style={champStyle}>
                    <option value="">Tout l'immeuble</option>
                    {immeuble.logements.map((l) => <option key={l.id} value={l.id}>{nomLogement(l)}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>
        ))}
        <button type="button" onClick={() => setTravaux((l) => [...l, { cle: `m${Date.now()}`, description: "", montant: "", aide: "", logementId: "", choisi: true, manuel: true }])} style={{ background: "none", border: "none", padding: "8px 0 0", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: "var(--accent-ombre)" }}>
          + Ajouter des travaux
        </button>
      </Panneau>

      <Panneau icone="tendance" teinte={TEINTES.ambre} titre="Hausse proposée" sousTitre="Coche les baux à qui envoyer un avis de modification">
        {sansLoyer.length > 0 && (
          <p style={{ fontSize: 12.5, color: "var(--avertissement)", fontWeight: 700, margin: "0 0 8px" }}>
            {sansLoyer.map((l) => nomLogement(l)).join(", ")} : vacant sans loyer demandé, ne compte pas dans le partage des taxes, assurances et travaux. Inscris son loyer demandé dans sa fiche pour une part juste.
          </p>
        )}
        {lignes.length === 0 ? <Vide>Aucun bail résidentiel en cours.</Vide> : lignes.map((l) => <LigneBail key={l.bail.id} l={l} choisi={choisis.has(l.bail.id)} onBasculer={() => basculer(l.bail.id)} vise={l.bail.id === bailVise} />)}
        {lignes.length > 0 && (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 4 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={pdf} onChange={(e) => setPdf(e.target.checked)} /> Ranger le détail du calcul (PDF) dans les documents de chaque bail — la justification à garder si le locataire refuse
            </label>
            <Erreur texte={erreur} />
            <button type="button" onClick={appliquer} disabled={enCours || aAppliquer.length === 0} className="bouton-3d" style={boutonPrincipal}>
              {enCours ? "…" : aAppliquer.length === 0 ? "Coche au moins un bail" : `Inscrire le nouveau loyer ${aAppliquer.length > 1 ? `aux ${aAppliquer.length} baux cochés` : "au bail coché"}`}
            </button>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "8px 0 0" }}>Le nouveau loyer est noté au bail ; l'avis de modification se génère ensuite depuis chaque bail (Renouvellement), à envoyer dans la période d'avis.</p>
          </div>
        )}
        {resultat && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid var(--success)", background: "var(--success-fond)", fontSize: 13 }}>
            <strong>Nouveau loyer inscrit à {resultat.appliques.length} {resultat.appliques.length > 1 ? "baux" : "bail"}{resultat.appliques.some((a) => a.documentId) ? ", calcul rangé dans leurs documents" : ""}.</strong>
            {resultat.appliques.map((a) => {
              const l = lignes.find((x) => x.bail.id === a.bailId);
              return <div key={a.bailId}><Link href={`/immobilier/baux/${a.bailId}`} style={lien}>{l ? `${nomLogement(l.logement)} — ${nomsLocataires(l.bail)}` : "Bail"}</Link> : {argent(a.nouveauLoyer)} — générer l'avis de modification</div>;
            })}
            {resultat.ignores?.length > 0 && <div style={{ color: "var(--text-muted)", marginTop: 4 }}>Non modifiés : {resultat.ignores.join(" ; ")}.</div>}
          </div>
        )}
      </Panneau>
    </div>
  );
}

function LignePourcentage({ periode, valeur, onChange }) {
  const { appeler, enCours, erreur } = useApi();
  const publie = pourcentageBase(periode);
  return (
    <div style={{ borderTop: "1px solid var(--border)", padding: "9px 0", fontSize: 13.5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span>Baux qui commencent {periodeTalLisible(periode)}</span>
        {publie ? (
          <strong>{pc(publie.taux)} <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: 12 }}>publié par le TAL</span></strong>
        ) : (
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <input inputMode="decimal" value={valeur} onChange={(e) => onChange(e.target.value)} aria-label={`Pourcentage de base ${periodeTalLisible(periode)}`} placeholder="ex. 3,1" style={{ ...champStyle, width: 80, marginBottom: 0 }} />
            <span>%</span>
            <button type="button" onClick={() => appeler("/api/immobilier/pourcentage-tal", "POST", { periode, taux: valeur })} disabled={enCours} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, color: "var(--accent-ombre)" }}>{enCours ? "…" : "Garder"}</button>
          </span>
        )}
      </div>
      {!publie && <div style={{ fontSize: 12, color: "var(--avertissement)", marginTop: 4 }}>Pas encore publié : le TAL l'annonce vers la mi-janvier {periode}. Inscris-le dès sa sortie (« Garder » le retient pour tous les immeubles).</div>}
      <Erreur texte={erreur} />
    </div>
  );
}

function LigneCharge({ titre, annee, valeurs, onChange }) {
  const avant = nombre(valeurs.avant);
  const apres = nombre(valeurs.apres);
  const hausse = avant > 0 && apres != null ? apres - avant : null;
  return (
    <div style={{ borderTop: "1px solid var(--border)", padding: "9px 0" }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 6 }}>{titre}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        <div><label style={labelStyle}>{annee - 1} ($)</label><input inputMode="decimal" value={valeurs.avant} onChange={(e) => onChange("avant", e.target.value)} style={{ ...champStyle, marginBottom: 0 }} /></div>
        <div><label style={labelStyle}>{annee} ($)</label><input inputMode="decimal" value={valeurs.apres} onChange={(e) => onChange("apres", e.target.value)} placeholder={`compte de ${annee}`} style={{ ...champStyle, marginBottom: 0 }} /></div>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
        {hausse == null ? "Inscris les deux années pour en tenir compte." : `${hausse >= 0 ? "Hausse" : "Baisse"} de ${argent(Math.abs(hausse))} (${pc((hausse / avant) * 100, 1)}) — seule la part au-delà du pourcentage de base s'ajoute au loyer.`}
      </div>
    </div>
  );
}

function LigneBail({ l, choisi, onBasculer, vise }) {
  const c = l.calcul;
  const envoye = Boolean(l.bail.avisEnvoyeLe);
  const etat = etatFinBail(l.bail);
  const morceaux = c ? [
    ["Base", c.base], ["Taxes", c.taxes], ["Assurances", c.assurances], ["Travaux", c.travaux],
  ] : [];
  return (
    <div id={`bail-${l.bail.id}`} style={{ borderTop: "1px solid var(--border)", padding: "10px 0", ...(vise ? { boxShadow: "inset 3px 0 0 var(--accent)", paddingLeft: 10 } : {}) }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <input type="checkbox" checked={choisi && !envoye && Boolean(c)} disabled={envoye || !c} onChange={onBasculer} aria-label={`Inscrire la hausse — ${nomLogement(l.logement)}`} style={{ marginTop: 4 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <Link href={`/immobilier/baux/${l.bail.id}`} style={{ ...lien, fontWeight: 700 }}>{nomLogement(l.logement)} — {nomsLocataires(l.bail)}</Link>
            {c && <strong style={{ fontSize: 15 }}>{argent(c.nouveauLoyer)}</strong>}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "2px 0 6px" }}>
            {argent(l.bail.loyer)} aujourd'hui{c && ` · ${hausseLisible(l.bail.loyer, c.nouveauLoyer)}`} · à compter du {dateLisible(l.debut)} · part {pc(l.part * 100, 1)}
          </div>
          {c && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {morceaux.map(([n, v]) => (
                <span key={n} style={{ fontSize: 11.5, padding: "3px 8px", borderRadius: 999, background: "var(--surface-alt)", border: "1px solid var(--border)", color: v > 0 ? "var(--text)" : "var(--text-muted)" }}>
                  {n} {argent(v)}
                </span>
              ))}
            </div>
          )}
          {!c && <div style={{ fontSize: 12.5, color: "var(--avertissement)", fontWeight: 700 }}>Pourcentage de base des baux qui commencent {periodeTalLisible(l.periode)} inconnu : inscris-le plus haut.</div>}
          <div style={{ marginTop: 6 }}>
            {envoye
              ? <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Avis déjà envoyé le {dateLisible(l.bail.avisEnvoyeLe)}{l.bail.nouveauLoyer != null ? ` — nouveau loyer de ${argent(l.bail.nouveauLoyer)}` : ""} : non modifié ici.</span>
              : <PastilleEtat etat={etat} />}
          </div>
        </div>
      </div>
    </div>
  );
}
