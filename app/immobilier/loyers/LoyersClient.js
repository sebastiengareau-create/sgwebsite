"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BandeauSection from "../../components/BandeauSection";
import { argent, dateLisible, libelle, periodeLisible, nomsLocataires, loyerDuMois, MODES_PAIEMENT } from "@/lib/immobilierCalculs";
import { NavImmo, Section, Onglets, Vide, Tableau, cellule, celluleDroite, useApi, Erreur, Statistique, Solde, nomLogement, lien, aujourdhui, champStyle } from "../ui";

const ONGLETS = [{ code: "MOIS", label: "Loyers du mois" }, { code: "RETARDS", label: "Retards" }, { code: "PAIEMENTS", label: "Paiements reçus" }];

// Les 12 derniers mois et le suivant
function moisProposes(courante) {
  const [a, m] = courante.split("-").map(Number);
  return Array.from({ length: 14 }, (_, i) => new Date(Date.UTC(a, m - 1 + 1 - i, 15)).toISOString().slice(0, 7));
}

export default function LoyersClient({ courriel, periode, courante, baux, charges, soldes, paiements, dus, onglet: ongletInit }) {
  const [onglet, setOnglet] = useState(ongletInit);
  return (
    <div className="conteneur-page">
      <BandeauSection icone="💵" titre="Loyers" sousTitre="Loyers du mois, paiements reçus et retards." />
      <NavImmo actif="/immobilier/loyers" />
      <Onglets options={ONGLETS} valeur={onglet} onChange={setOnglet} />
      {onglet === "MOIS" && <Mois periode={periode} courante={courante} baux={baux} charges={charges} soldes={soldes} />}
      {onglet === "RETARDS" && <Retards dus={dus} soldes={soldes} courriel={courriel} />}
      {onglet === "PAIEMENTS" && <Paiements paiements={paiements} />}
    </div>
  );
}

function Mois({ periode, courante, baux, charges, soldes }) {
  const router = useRouter();
  const { appeler, enCours, erreur } = useApi();
  const [message, setMessage] = useState("");
  const chargeDe = Object.fromEntries(charges.map((c) => [c.bailId, c]));
  const lignes = baux
    .map((b) => ({ ...b, du: loyerDuMois(b, periode), charge: chargeDe[b.id], solde: soldes[b.id] || 0 }))
    .filter((b) => b.charge || (b.statut === "ACTIF" && b.du > 0))
    .sort((a, b) => a.logement.immeuble.nom.localeCompare(b.logement.immeuble.nom) || a.logement.numero.localeCompare(b.logement.numero, "fr", { numeric: true }));
  const aGenerer = lignes.filter((l) => !l.charge && l.statut === "ACTIF");
  const totalDu = lignes.reduce((s, l) => s + (l.charge?.montant ?? l.du), 0);
  const enRetard = lignes.filter((l) => l.solde > 0.005);

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
        <Statistique valeur={lignes.length - enRetard.length} label="Comptes à jour" teinte="var(--success)" />
        <Statistique valeur={enRetard.length} label="Comptes en retard" teinte={enRetard.length ? "var(--danger)" : "var(--success)"} />
      </div>
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 10px" }}>
        Inscrire les loyers ajoute au compte de chaque bail en cours le loyer du mois (au prorata si le bail commence ou finit en cours de mois). « Payé » inscrit un paiement aujourd'hui pour le solde dû ; un autre montant s'inscrit depuis la fiche du bail.
      </p>
      <div className="carte">
        {lignes.length === 0 ? <Vide>Aucun bail ne couvre ce mois.</Vide> : (
          <Tableau entetes={["Logement", "Locataires", "Loyer", "Solde du compte", ""]} alignDroite={[2, 3]}>
            {lignes.map((l) => (
              <tr key={l.id}>
                <td style={cellule}><Link href={`/immobilier/logements/${l.logement.id}`} style={lien}>{nomLogement(l.logement)}</Link><div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{l.logement.immeuble.nom}</div></td>
                <td style={cellule}><Link href={`/immobilier/baux/${l.id}`} style={{ color: "inherit" }}>{nomsLocataires(l)}</Link></td>
                <td style={celluleDroite}>{argent(l.charge?.montant ?? l.du)}{!l.charge && <div style={{ fontSize: 11, color: "var(--accent)" }}>pas inscrit</div>}</td>
                <td style={celluleDroite}><Solde solde={l.solde} /></td>
                <td style={{ ...cellule, textAlign: "right", whiteSpace: "nowrap" }}>{l.solde > 0.005 && <Encaisser bail={l} montant={l.solde} />}</td>
              </tr>
            ))}
          </Tableau>
        )}
      </div>
    </>
  );
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
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <select value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Mode de paiement" style={{ ...champStyle, width: "auto", marginBottom: 0, padding: "5px 6px", fontSize: 12 }}>
        {MODES_PAIEMENT.map((m) => <option key={m.code} value={m.code}>{m.label.split(" ")[0]}</option>)}
      </select>
      <button type="button" onClick={payer} disabled={enCours} className="bouton-3d" style={{ padding: "6px 10px", borderRadius: 9, fontSize: 12.5, fontWeight: 700 }}>{enCours ? "…" : "💵 Payé"}</button>
      {erreur && <span style={{ color: "var(--danger)", fontSize: 12 }}>{erreur}</span>}
    </span>
  );
}

function Retards({ dus, soldes, courriel }) {
  const lignes = dus.map((b) => ({ ...b, solde: soldes[b.id] || 0 })).sort((a, b) => b.solde - a.solde);
  const total = lignes.reduce((s, l) => s + l.solde, 0);
  return (
    <Section titre={`Comptes en retard — ${argent(total)}`}>
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 10px" }}>
        Un retard de plus de trois semaines permet de demander au Tribunal administratif du logement la résiliation du bail ; un retard fréquent cause un préjudice au propriétaire. Garde une trace de chaque rappel dans les documents du bail.
      </p>
      {courriel && lignes.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <EnvoiGroupe nombre={lignes.length} />
        </div>
      )}
      {lignes.length === 0 ? <Vide>Aucun retard. 🎉</Vide> : (
        <Tableau entetes={["Locataires", "Logement", "Dû", "Mois de loyer", "Téléphone"]} alignDroite={[2, 3]}>
          {lignes.map((l) => (
            <tr key={l.id}>
              <td style={cellule}><Link href={`/immobilier/baux/${l.id}`} style={{ ...lien, fontWeight: 700 }}>{nomsLocataires(l)}</Link>{l.statut !== "ACTIF" && <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>bail terminé</div>}</td>
              <td style={cellule}>{nomLogement(l.logement)} · {l.logement.immeuble.nom}</td>
              <td style={{ ...celluleDroite, color: "var(--danger)", fontWeight: 700 }}>{argent(l.solde)}</td>
              <td style={celluleDroite}>{(l.solde / l.loyer).toFixed(1).replace(".", ",")}</td>
              <td style={cellule}>{l.locataires.map((x) => x.telephone).filter(Boolean).map((t) => <div key={t}><a href={`tel:${t}`} style={lien}>{t}</a></div>)}</td>
            </tr>
          ))}
        </Tableau>
      )}
    </Section>
  );
}

function Paiements({ paiements }) {
  const mois = aujourdhui().slice(0, 7);
  const duMois = paiements.filter((p) => String(p.date).slice(0, 7) === mois).reduce((s, p) => s + p.montant, 0);
  return (
    <Section titre="Derniers paiements reçus" droite={<span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Ce mois-ci : <strong style={{ color: "var(--text)" }}>{argent(duMois)}</strong></span>}>
      {paiements.length === 0 ? <Vide>Aucun paiement inscrit.</Vide> : (
        <Tableau entetes={["Date", "Locataires", "Logement", "Mode", "Montant"]} alignDroite={[4]}>
          {paiements.map((p) => (
            <tr key={p.id}>
              <td style={{ ...cellule, whiteSpace: "nowrap" }}>{dateLisible(p.date)}</td>
              <td style={cellule}><Link href={`/immobilier/baux/${p.bail.id}`} style={lien}>{nomsLocataires(p.bail)}</Link></td>
              <td style={cellule}>{nomLogement(p.bail.logement)} · {p.bail.logement.immeuble.nom}</td>
              <td style={cellule}>{libelle(MODES_PAIEMENT, p.mode)}{p.reference && <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{p.reference}</div>}{p.note && <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{p.note}</div>}</td>
              <td style={{ ...celluleDroite, fontWeight: 700 }}>{argent(p.montant)}</td>
            </tr>
          ))}
        </Tableau>
      )}
    </Section>
  );
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
