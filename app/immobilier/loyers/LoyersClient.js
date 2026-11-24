"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BandeauSection from "../../components/BandeauSection";
import { argent, dateLisible, libelle, periodeLisible, nomsLocataires, loyerDuMois, MODES_PAIEMENT, JOURS_RETARD_TAL } from "@/lib/immobilierCalculs";
import { NavImmo, Section, Onglets, Vide, Tableau, cellule, celluleDroite, useApi, Erreur, Statistique, Solde, nomLogement, lien, aujourdhui, champStyle } from "../ui";

const ONGLETS = [{ code: "MOIS", label: "Loyers du mois" }, { code: "RETARDS", label: "Retards" }, { code: "PAIEMENTS", label: "Paiements reçus" }];

// Les 12 derniers mois et le suivant
function moisProposes(courante) {
  const [a, m] = courante.split("-").map(Number);
  return Array.from({ length: 14 }, (_, i) => new Date(Date.UTC(a, m - 1 + 1 - i, 15)).toISOString().slice(0, 7));
}

export default function LoyersClient({ courriel, periode, courante, baux, charges, soldes, comptes, paiements, dus, onglet: ongletInit }) {
  const [onglet, setOnglet] = useState(ongletInit);
  return (
    <div className="conteneur-page">
      <BandeauSection icone="💵" titre="Loyers" sousTitre="Loyers du mois, paiements reçus et retards." />
      <NavImmo actif="/immobilier/loyers" />
      <Onglets options={ONGLETS} valeur={onglet} onChange={setOnglet} />
      {onglet === "MOIS" && <Mois periode={periode} courante={courante} baux={baux} charges={charges} soldes={soldes} comptes={comptes} />}
      {onglet === "RETARDS" && <Retards dus={dus} comptes={comptes} courriel={courriel} />}
      {onglet === "PAIEMENTS" && <Paiements paiements={paiements} />}
    </div>
  );
}

function Mois({ periode, courante, baux, charges, soldes, comptes }) {
  const router = useRouter();
  const { appeler, enCours, erreur } = useApi();
  const [message, setMessage] = useState("");
  const chargeDe = Object.fromEntries(charges.map((c) => [c.bailId, c]));
  const lignes = baux
    .map((b) => ({ ...b, du: loyerDuMois(b, periode), charge: chargeDe[b.id], solde: soldes[b.id] || 0, compte: comptes[b.id] }))
    .filter((b) => b.charge || (b.statut === "ACTIF" && b.du > 0))
    .sort((a, b) => a.logement.immeuble.nom.localeCompare(b.logement.immeuble.nom) || a.logement.numero.localeCompare(b.logement.numero, "fr", { numeric: true }));
  const aGenerer = lignes.filter((l) => !l.charge && l.statut === "ACTIF");
  const totalDu = lignes.reduce((s, l) => s + (l.charge?.montant ?? l.du), 0);
  const enRetard = lignes.filter((l) => l.compte?.enRetard > 0.005);
  const aRecevoir = lignes.filter((l) => l.solde > 0.005 && !(l.compte?.enRetard > 0.005));

  async function generer() {
    const data = await appeler("/api/immobilier/charges", "POST", { generer: periode });
    if (data) setMessage(`${data.creees} loyer${data.creees > 1 ? "s" : ""} inscrit${data.creees > 1 ? "s" : ""} pour ${periodeLisible(periode)}.`);
  }

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 14 }}>
        <select value={periode} onChange={(e) => router.push(`/immobilier/loyers?mois=${e.target.value}`)} style={{ ...champStyle, width: "auto", marginBottom: 0, textTransform: "capitalize" }}>
          {moisProposes(courante).map((p) => <option key={p} value={p}>{periodeLisible(p)}</option>)}
        </select>
        {aGenerer.length > 0 && (
          <button type="button" onClick={generer} disabled={enCours} className="bouton-3d" style={{ padding: "10px 16px", borderRadius: 12, fontSize: 14, fontWeight: 700 }}>
            {enCours ? "…" : `Inscrire les loyers de ${periodeLisible(periode)} (${aGenerer.length})`}
          </button>
        )}
        {message && <span style={{ fontSize: 13, fontWeight: 700, color: "var(--success)" }}>{message}</span>}
      </div>
      <Erreur texte={erreur} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 14 }}>
        <Statistique valeur={argent(totalDu)} label={`Loyers de ${periodeLisible(periode)}`} teinte="var(--bleu)" />
        <Statistique valeur={lignes.length - enRetard.length - aRecevoir.length} label="Comptes à jour" teinte="var(--success)" />
        <Statistique valeur={aRecevoir.length} label="À recevoir" note="loyer pas encore échu" teinte="var(--avertissement)" />
        <Statistique valeur={enRetard.length} label="Comptes en retard" teinte={enRetard.length ? "var(--danger)" : "var(--success)"} />
      </div>
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 10px" }}>
        Inscrire les loyers ajoute au compte de chaque bail en cours le loyer du mois (au prorata si le bail commence ou finit en cours de mois), payable au jour prévu au bail : il est « à recevoir » jusque-là, puis en retard dès le lendemain. « Payé » inscrit un paiement aujourd'hui pour le solde dû ; un autre montant s'inscrit depuis la fiche du bail. Les loyers peuvent aussi s'inscrire tout seuls le 1er du mois : <Link href="/immobilier/automatisations" style={lien}>Automatisations</Link>.
      </p>
      <div className="carte">
        {lignes.length === 0 ? <Vide>Aucun bail ne couvre ce mois.</Vide> : (
          <>
            <div className="ligne-loyer ligne-loyer-entete" aria-hidden="true">
              <span className="qui">Locataires et logement</span>
              <span className="loyer">Loyer du mois</span>
              <span className="solde">Compte</span>
              <span className="action" />
            </div>
            {parImmeuble(lignes).map(([immeuble, liste]) => (
              <section key={immeuble} aria-label={immeuble}>
                <div style={{ fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, padding: "12px 2px 2px" }}>{immeuble}</div>
                {liste.map((l) => (
                  <div key={l.id} className="ligne-loyer">
                    <span className="qui">
                      <Link href={`/immobilier/baux/${l.id}`} style={{ ...lien, fontWeight: 700 }}>{nomsLocataires(l)}</Link>
                      <Link href={`/immobilier/logements/${l.logement.id}`} style={{ display: "block", fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>{nomLogement(l.logement)}</Link>
                    </span>
                    <span className="loyer">
                      <span style={{ fontWeight: 700 }}>{argent(l.charge?.montant ?? l.du)}</span>
                      {!l.charge && <span style={{ display: "block", fontSize: 11, color: "var(--avertissement)", fontWeight: 700 }}>pas inscrit</span>}
                    </span>
                    <span className="solde"><Solde solde={l.solde} compte={l.compte} /></span>
                    <span className="action">{l.solde > 0.005 && <Encaisser bail={l} montant={l.solde} />}</span>
                  </div>
                ))}
              </section>
            ))}
          </>
        )}
      </div>
    </>
  );
}

// Lignes regroupées par immeuble, dans l'ordre du tri : [[nom, lignes], …]
function parImmeuble(lignes) {
  const groupes = new Map();
  for (const l of lignes) {
    const nom = l.logement.immeuble.nom;
    if (!groupes.has(nom)) groupes.set(nom, []);
    groupes.get(nom).push(l);
  }
  return [...groupes];
}

// Paiement du solde en un clic
function Encaisser({ bail, montant }) {
  const { appeler, enCours, erreur } = useApi();
  const [mode, setMode] = useState("VIREMENT");
  async function payer() {
    if (!window.confirm(`Inscrire un paiement de ${argent(montant)} reçu aujourd'hui de ${nomsLocataires(bail)} (${libelle(MODES_PAIEMENT, mode).toLowerCase()}) ?`)) return;
    await appeler("/api/immobilier/paiements", "POST", { bailId: bail.id, date: aujourdhui(), montant: String(montant), mode });
  }
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
      <select value={mode} onChange={(e) => setMode(e.target.value)} aria-label={`Mode de paiement — ${nomsLocataires(bail)}`} style={{ ...champStyle, width: "auto", marginBottom: 0, padding: "6px 6px", fontSize: 12.5 }}>
        {MODES_PAIEMENT.map((m) => <option key={m.code} value={m.code}>{m.label.split(" ")[0]}</option>)}
      </select>
      <button type="button" onClick={payer} disabled={enCours} aria-label={`Payé : ${argent(montant)} de ${nomsLocataires(bail)}`} className="bouton-3d" style={{ padding: "7px 11px", borderRadius: 9, fontSize: 13, fontWeight: 700 }}>{enCours ? "…" : "💵 Payé"}</button>
      {erreur && <span style={{ color: "var(--danger)", fontSize: 12, flexBasis: "100%", textAlign: "right" }}>{erreur}</span>}
    </span>
  );
}

function Retards({ dus, comptes, courriel }) {
  const lignes = dus.map((b) => ({ ...b, compte: comptes[b.id] })).filter((l) => l.compte).sort((a, b) => b.compte.joursRetard - a.compte.joursRetard || b.compte.enRetard - a.compte.enRetard);
  const total = lignes.reduce((s, l) => s + l.compte.enRetard, 0);
  const tal = lignes.filter((l) => l.compte.tal).length;
  return (
    <Section titre={`Comptes en retard — ${argent(total)}`}>
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 10px" }}>
        Un loyer est en retard dès le lendemain de son échéance ; un loyer inscrit d'avance n'est pas compté. Un retard de plus de trois semaines ({JOURS_RETARD_TAL} jours) permet de demander au Tribunal administratif du logement la résiliation du bail ; un retard fréquent cause un préjudice au propriétaire. Garde une trace de chaque rappel dans les documents du bail
        {courriel ? <> — ou laisse partir le rappel tout seul : <Link href="/immobilier/automatisations" style={lien}>Automatisations</Link>.</> : "."}
      </p>
      {tal > 0 && <p style={{ fontSize: 13, fontWeight: 700, color: "var(--danger)", margin: "0 0 10px" }}>{tal} compte{tal > 1 ? "s" : ""} en retard de plus de trois semaines.</p>}
      {courriel && lignes.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <EnvoiGroupe nombre={lignes.length} />
        </div>
      )}
      {lignes.length === 0 ? <Vide>Aucun retard. 🎉</Vide> : (
        <Tableau entetes={["Locataires et logement", "En retard"]} alignDroite={[1]}>
          {lignes.map((l) => (
            <tr key={l.id}>
              <td style={cellule}>
                <Link href={`/immobilier/baux/${l.id}`} style={{ ...lien, fontWeight: 700 }}>{nomsLocataires(l)}</Link>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{nomLogement(l.logement)} · {l.logement.immeuble.nom}{l.statut !== "ACTIF" && " · bail terminé"}</div>
                {l.locataires.map((x) => x.telephone).filter(Boolean).map((t) => <div key={t} style={{ fontSize: 12.5, whiteSpace: "nowrap" }}><a href={`tel:${t}`} style={lien}>{t}</a></div>)}
              </td>
              <td style={celluleDroite}>
                <div style={{ color: "var(--danger)", fontWeight: 700 }}>{argent(l.compte.enRetard)}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>depuis le {dateLisible(l.compte.depuis)}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: l.compte.tal ? "var(--danger)" : "var(--avertissement)" }}>{l.compte.joursRetard} j{l.compte.tal ? " · plus de 3 sem." : ""}</div>
              </td>
            </tr>
          ))}
        </Tableau>
      )}
    </Section>
  );
}

// Paiements reçus des 12 derniers mois, groupés par mois : le plus récent
// ouvert, les autres repliés avec leur total
function Paiements({ paiements }) {
  const mois = groupesParMois(paiements);
  const courant = aujourdhui().slice(0, 7);
  const duMois = mois.find((m) => m.cle === courant)?.total || 0;
  const [ouverts, setOuverts] = useState(() => new Set(mois.slice(0, 1).map((m) => m.cle)));
  const basculer = (cle) => setOuverts((o) => { const n = new Set(o); if (n.has(cle)) n.delete(cle); else n.add(cle); return n; });
  return (
    <Section titre="Paiements reçus — 12 derniers mois" droite={<span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Ce mois-ci : <strong style={{ color: "var(--text)" }}>{argent(duMois)}</strong></span>}>
      {mois.length === 0 ? <Vide>Aucun paiement reçu ces 12 derniers mois.</Vide> : mois.map((m) => {
        const ouvert = ouverts.has(m.cle);
        return (
          <div key={m.cle} style={{ borderTop: "1px solid var(--border)" }}>
            <button
              type="button" onClick={() => basculer(m.cle)} aria-expanded={ouvert} aria-controls={`paiements-${m.cle}`}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 2px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", color: "var(--text)", textAlign: "left" }}
            >
              <span style={{ display: "inline-block", width: 12, color: "var(--text-muted)", transition: "transform 0.15s", transform: ouvert ? "rotate(90deg)" : "none" }} aria-hidden="true">›</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 800, textTransform: "capitalize" }}>{periodeLisible(m.cle)}</span>
              <span style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 800 }}>{argent(m.total)}</span>
                <span style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)" }}>{m.paiements.length} paiement{m.paiements.length > 1 ? "s" : ""}</span>
              </span>
            </button>
            {ouvert && (
              <div id={`paiements-${m.cle}`} style={{ paddingLeft: 22, paddingBottom: 6 }}>
                {m.paiements.map((p) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "9px 2px", borderTop: "1px solid var(--border)", fontSize: 13.5 }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/immobilier/baux/${p.bail.id}`} style={{ ...lien, fontWeight: 700 }}>{nomsLocataires(p.bail)}</Link>
                      <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)" }}>{nomLogement(p.bail.logement)} · {p.bail.logement.immeuble.nom}</span>
                      <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)" }}>{[dateLisible(p.date), libelle(MODES_PAIEMENT, p.mode), p.reference, p.note].filter((x) => x && x !== "—").join(" · ")}</span>
                    </span>
                    <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{argent(p.montant)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </Section>
  );
}

// [{ cle: "2026-11", total, paiements }] du mois le plus récent au plus ancien
// (dates enregistrées à midi UTC : le jour UTC est le bon)
function groupesParMois(paiements) {
  const groupes = new Map();
  for (const p of paiements) {
    const cle = String(p.date).slice(0, 7);
    if (!groupes.has(cle)) groupes.set(cle, { cle, total: 0, paiements: [] });
    const g = groupes.get(cle);
    g.total = Math.round((g.total + p.montant) * 100) / 100;
    g.paiements.push(p);
  }
  return [...groupes.values()].sort((a, b) => b.cle.localeCompare(a.cle));
}

// Relevé de compte par courriel à tous les locataires en retard
function EnvoiGroupe({ nombre }) {
  const { appeler, enCours, erreur } = useApi();
  const [resultat, setResultat] = useState("");
  async function envoyer() {
    if (!window.confirm(`Envoyer leur relevé de compte par courriel aux locataires des ${nombre} comptes en retard ? Les locataires sans courriel sont sautés.`)) return;
    setResultat("");
    const r = await appeler("/api/immobilier/releves-comptes", "POST", {});
    if (r) setResultat(`Relevé envoyé pour ${r.baux} compte${r.baux > 1 ? "s" : ""} (${r.envoyes} courriel${r.envoyes > 1 ? "s" : ""})${r.ignores ? ` ; ${r.ignores} sans courriel` : ""}.`);
  }
  return (
    <span style={{ display: "inline-flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <button type="button" onClick={envoyer} disabled={enCours} className="bouton-3d" style={{ padding: "9px 14px", borderRadius: 10, fontSize: 13.5, fontWeight: 700 }}>{enCours ? "Envoi…" : `✉️ Envoyer le relevé de compte aux ${nombre} comptes en retard`}</button>
      {resultat && <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--success)" }}>{resultat}</span>}
      <Erreur texte={erreur} />
    </span>
  );
}
