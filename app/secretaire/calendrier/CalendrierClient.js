"use client";

import BoutonTexto from "../../components/BoutonTexto";
import { MESSAGES_TEXTO } from "@/lib/textos";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BandeauSection from "../../components/BandeauSection";
import FichiersRendezVous from "../../components/FichiersRendezVous";
import { QUESTION_BON_NON_FACTURE } from "@/lib/bonsNonFactures";
import { Icone, CarteChiffre, GrilleChiffres, BoutonPlein, BoutonContour, Panneau, Pastille, TitreGroupe } from "../../components/StyleSection";

const JOURS_LABEL = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const DEBUT_GRILLE = 7; // 7h — élargie au besoin selon les heures d'ouverture
const FIN_GRILLE = 19; // 19h
const HAUTEUR_HEURE = 52; // px

// Heure décimale (ex. 9.5 pour 9h30) d'une date, en heure du Québec — peu
// importe le fuseau horaire du navigateur qui affiche la page.
function heureQuebec(date) {
  const parties = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Toronto", hourCycle: "h23", hour: "numeric", minute: "numeric",
  }).formatToParts(date);
  const h = Number(parties.find((p) => p.type === "hour").value);
  const m = Number(parties.find((p) => p.type === "minute").value);
  return h + m / 60;
}

// "YYYY-MM-DD" du jour civil au Québec d'une date.
function jourQuebec(date) {
  return new Date(date).toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
}

function heureDecimale(heureStr) {
  const [h, m] = heureStr.split(":").map(Number);
  return h + m / 60;
}

// Portion [début, fin] (heures décimales) d'une période indisponible qui
// tombe dans le jour dateStr, ou null si elle ne le touche pas.
function portionDuJour(periode, dateStr) {
  const jourDebut = jourQuebec(periode.debut);
  const jourFin = jourQuebec(periode.fin);
  if (jourDebut > dateStr || jourFin < dateStr) return null;
  const debut = jourDebut < dateStr ? 0 : heureQuebec(new Date(periode.debut));
  const fin = jourFin > dateStr ? 24 : heureQuebec(new Date(periode.fin));
  return fin > debut ? { debut, fin } : null;
}

function formatPeriode(p) {
  const debut = new Date(p.debut);
  const fin = new Date(p.fin);
  const optsDate = { timeZone: "America/Toronto", weekday: "short", day: "numeric", month: "short" };
  const optsHeure = { timeZone: "America/Toronto", hour: "2-digit", minute: "2-digit" };
  const journeeEntiere = heureQuebec(debut) === 0 && fin.getTime() - debut.getTime() >= 86400000 - 60000;
  if (journeeEntiere) {
    const d = debut.toLocaleDateString("fr-CA", optsDate);
    const f = new Date(fin.getTime() - 60000).toLocaleDateString("fr-CA", optsDate);
    return d === f ? `${d} · journée entière` : `Du ${d} au ${f}`;
  }
  const memeJour = jourQuebec(debut) === jourQuebec(fin);
  return memeJour
    ? `${debut.toLocaleDateString("fr-CA", optsDate)} · ${debut.toLocaleTimeString("fr-CA", optsHeure)}–${fin.toLocaleTimeString("fr-CA", optsHeure)}`
    : `Du ${debut.toLocaleDateString("fr-CA", optsDate)} ${debut.toLocaleTimeString("fr-CA", optsHeure)} au ${fin.toLocaleDateString("fr-CA", optsDate)} ${fin.toLocaleTimeString("fr-CA", optsHeure)}`;
}

// Provenance d'un rendez-vous (champ RendezVous.source)
const SOURCES = {
  WEB: { icone: "🌐", label: "Web", titre: "Réservé sur le site web" },
  LOCAL: { icone: "🏠", label: "Local", titre: "Entré au calendrier" },
  BON: { icone: "🔧", label: "Bon", titre: "Créé avec un bon de travail" },
};
function infosSource(rdv) {
  return SOURCES[rdv.source] || SOURCES.LOCAL;
}

// Rendez-vous qui se chevauchent : placés côte à côte plutôt qu'empilés.
// Retourne, par id, sa colonne et le nombre de colonnes de son groupe.
function disposerColonnes(rdvs) {
  const tries = [...rdvs].sort((a, b) => new Date(a.date) - new Date(b.date));
  const disposition = {};
  let groupe = [];
  let finGroupe = 0;
  let colonnesFin = []; // fin (ms) du dernier rendez-vous de chaque colonne
  const fermerGroupe = () => {
    for (const r of groupe) disposition[r.id].nbCols = colonnesFin.length;
    groupe = [];
    colonnesFin = [];
  };
  for (const r of tries) {
    const debut = new Date(r.date).getTime();
    const fin = debut + r.dureeMinutes * 60000;
    if (groupe.length && debut >= finGroupe) fermerGroupe();
    let col = colonnesFin.findIndex((f) => f <= debut);
    if (col === -1) { col = colonnesFin.length; colonnesFin.push(fin); } else colonnesFin[col] = fin;
    disposition[r.id] = { col, nbCols: 1 };
    finGroupe = groupe.length ? Math.max(finGroupe, fin) : fin;
    groupe.push(r);
  }
  if (groupe.length) fermerGroupe();
  return disposition;
}

function decaler(dateStr, jours) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + jours);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Couleur par motif, distincte et stable pour la semaine affichée (angle
// d'or — garantit une bonne séparation visuelle entre les types de rendez-vous)
function construireCouleursMotifs(rendezVous) {
  const carte = new Map();
  let index = 0;
  for (const r of rendezVous) {
    const cle = r.motif.split(" — ")[0].split(" (")[0].trim(); // groupe par service, ignore la partie courriel/remarque
    if (!carte.has(cle)) {
      carte.set(cle, `hsl(${(index * 137.508) % 360}, 62%, 55%)`);
      index++;
    }
  }
  return carte;
}

export default function CalendrierClient({ jours, rendezVous, indisponibles, heuresParJour, capacite, dateSelectionnee, nomEntreprise = "" }) {
  const router = useRouter();
  const [jourActif, setJourActif] = useState(jours.includes(dateSelectionnee) ? dateSelectionnee : jours[0]);
  const [vue, setVue] = useState("grille"); // "grille" | "liste"
  const [rdvSelectionneId, setRdvSelectionneId] = useState(null);
  const [afficherFormIndispo, setAfficherFormIndispo] = useState(false);

  const rdvParJour = {};
  for (const j of jours) rdvParJour[j] = [];
  for (const r of rendezVous) {
    const cle = new Date(r.date).toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
    if (rdvParJour[cle]) rdvParJour[cle].push(r);
  }
  const rdvDuJour = (rdvParJour[jourActif] || []).sort((a, b) => new Date(a.date) - new Date(b.date));
  const couleursMotifs = useMemo(() => construireCouleursMotifs(rendezVous), [rendezVous]);

  function changerSemaine(decalageJours) {
    router.push(`/secretaire/calendrier?date=${decaler(jours[0], decalageJours)}`);
  }

  // Chiffres de la semaine affichée (rendez-vous annulés exclus)
  const aujourdhui = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const actifsSemaine = rendezVous.filter((r) => r.statut !== "ANNULE");
  const nbAujourdhui = (rdvParJour[aujourdhui] || []).filter((r) => r.statut !== "ANNULE").length;
  const aTransformer = actifsSemaine.filter((r) => !r.bonId).length;
  const nbWeb = actifsSemaine.filter((r) => r.source === "WEB").length;
  const semaineCourante = jours.includes(aujourdhui);
  // « 2 au 8 novembre 2026 », ou « 30 oct. au 5 nov. 2026 » sur deux mois
  const debutSem = new Date(`${jours[0]}T12:00:00`);
  const finSem = new Date(`${jours[6]}T12:00:00`);
  const libelleSemaine = debutSem.getMonth() === finSem.getMonth()
    ? `${debutSem.getDate()} au ${finSem.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })}`
    : `${debutSem.toLocaleDateString("fr-CA", { day: "numeric", month: "short" })} au ${finSem.toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div style={{ padding: 16, maxWidth: vue === "grille" ? 1100 : 560, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      <BandeauSection icone="📅" titre="Calendrier" sousTitre="Rendez-vous et disponibilités de l'atelier." />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
        <BoutonPlein href="/secretaire/calendrier/nouveau" icone="plus">Nouveau rendez-vous</BoutonPlein>
        <BoutonContour icone="bloque" actif={afficherFormIndispo} onClick={() => setAfficherFormIndispo((v) => !v)}>
          {afficherFormIndispo ? "Annuler" : "Indisponibilité"}
        </BoutonContour>
        <BoutonContour href="/secretaire/calendrier/parametres-web" icone="globe">Paramètres web</BoutonContour>
      </div>

      {afficherFormIndispo && (
        <div style={{ marginBottom: 18 }}>
          <FormulaireIndisponibilite dateParDefaut={jourActif} onCree={() => { setAfficherFormIndispo(false); router.refresh(); }} />
        </div>
      )}

      <GrilleChiffres>
        <CarteChiffre
          titre={semaineCourante ? "Aujourd'hui" : "Cette semaine-là"}
          montant={String(semaineCourante ? nbAujourdhui : actifsSemaine.length)}
          teinte="var(--accent)"
          note={semaineCourante ? `rendez-vous · ${actifsSemaine.length} dans la semaine` : "rendez-vous dans la semaine affichée"}
        />
        <CarteChiffre
          titre="À transformer en bon" montant={String(aTransformer)}
          couleur={aTransformer > 0 ? "var(--bleu)" : "var(--success)"} teinte={aTransformer > 0 ? "var(--bleu)" : "var(--success)"}
          note={aTransformer > 0 ? "Rendez-vous de la semaine sans bon de travail" : "Tous les rendez-vous ont leur bon"}
        />
        <CarteChiffre
          titre="Réservés en ligne" montant={String(nbWeb)} teinte="var(--success)"
          note="Cette semaine, sur le site web"
        />
      </GrilleChiffres>

      <Panneau
        titre={libelleSemaine}
        action={
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => changerSemaine(-7)} aria-label="Semaine précédente" style={boutonNav}><Icone nom="chevronGauche" taille={18} /></button>
            {!semaineCourante && (
              <button onClick={() => router.push("/secretaire/calendrier")} style={{ ...boutonNav, width: "auto", padding: "0 12px", fontSize: 13, fontWeight: 700 }}>Aujourd'hui</button>
            )}
            <button onClick={() => changerSemaine(7)} aria-label="Semaine suivante" style={boutonNav}><Icone nom="chevron" taille={18} /></button>
          </div>
        }
      >
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 12, background: "var(--bg)" }}>
            {[["grille", "grille", "Grille"], ["liste", "listePlate", "Liste"]].map(([cle, icone, label]) => (
              <button key={cle} onClick={() => setVue(cle)} style={{
                display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: vue === cle ? 700 : 600,
                padding: "7px 14px", borderRadius: 9, border: "none", cursor: "pointer",
                background: vue === cle ? "var(--surface)" : "transparent", color: vue === cle ? "var(--text)" : "var(--text-muted)",
                boxShadow: vue === cle ? "0 1px 3px rgba(0,0,0,0.10)" : "none",
              }}>
                <Icone nom={icone} taille={15} /> {label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
            {Object.values(SOURCES).map((s) => <span key={s.label} title={s.titre} style={legende}>{s.icone} {s.label}</span>)}
            <span title="Le client a joint un fichier — cliquer le rendez-vous pour l'ouvrir" style={legende}>📎 Pièce jointe</span>
            <span title="Rendez-vous transformé en bon de travail" style={legende}>✔️ Bon créé</span>
          </div>
        </div>
        {capacite && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>
            Une case se ferme sur le site après {capacite} rendez-vous simultané{capacite > 1 ? "s" : ""}.
          </p>
        )}

        {vue === "grille" ? (
          <>
            <GrilleSemaine
              jours={jours}
              rdvParJour={rdvParJour}
              indisponibles={indisponibles}
              heuresParJour={heuresParJour}
              couleursMotifs={couleursMotifs}
              rdvSelectionneId={rdvSelectionneId}
              onSelectionner={setRdvSelectionneId}
            />
            {rdvSelectionneId && (() => {
              const rdvSelectionne = rendezVous.find((r) => r.id === rdvSelectionneId);
              if (!rdvSelectionne) return null;
              return (
                <div style={{ marginTop: 16 }}>
                  <TitreGroupe couleur="var(--accent)" droite={
                    <button onClick={() => setRdvSelectionneId(null)} aria-label="Fermer" style={{ ...boutonNav, width: 32, height: 32 }}>✕</button>
                  }>
                    Détail du rendez-vous
                  </TitreGroupe>
                  <CarteRendezVous rdv={rdvSelectionne} nomEntreprise={nomEntreprise} onChange={() => router.refresh()} />
                </div>
              );
            })()}
          </>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, padding: 4, borderRadius: 12, background: "var(--bg)", marginBottom: 14 }}>
              {jours.map((j) => {
                const actif = j === jourActif;
                const nbRdv = (rdvParJour[j] || []).filter((r) => r.statut !== "ANNULE").length;
                const jourNum = new Date(`${j}T12:00:00`).getDate();
                const estAujourdhui = j === aujourdhui;
                return (
                  <button
                    key={j}
                    onClick={() => setJourActif(j)}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 2px", borderRadius: 9, border: "none", cursor: "pointer",
                      background: actif ? "var(--surface)" : "transparent", boxShadow: actif ? "0 1px 3px rgba(0,0,0,0.10)" : "none",
                      color: estAujourdhui ? "var(--accent-ombre)" : actif ? "var(--text)" : "var(--text-muted)",
                    }}
                  >
                    <span style={{ fontSize: 11, fontWeight: 600 }}>{JOURS_LABEL[new Date(`${j}T12:00:00`).getDay()]}</span>
                    <span style={{ fontSize: 16, fontWeight: 800 }}>{jourNum}</span>
                    <span style={{ minHeight: 16, fontSize: 10.5, fontWeight: 700, padding: nbRdv ? "0 6px" : 0, borderRadius: 999, background: nbRdv ? "rgba(232,163,61,0.18)" : "transparent", color: "var(--accent-ombre)" }}>
                      {nbRdv > 0 ? nbRdv : ""}
                    </span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
                <Icone nom="horloge" taille={15} />
                {heuresParJour[jourActif] ? `Ouvert de ${heuresParJour[jourActif].ouverture} à ${heuresParJour[jourActif].fermeture}` : "Fermé ce jour-là"}
              </p>
              {indisponibles.filter((p) => portionDuJour(p, jourActif)).map((p) => (
                <div key={p.id} style={{ ...styleIndispo, borderRadius: 12, padding: "10px 12px", fontSize: 13 }}>
                  ⛔ {formatPeriode(p)}{p.motif ? ` — ${p.motif}` : ""}
                </div>
              ))}
              {rdvDuJour.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>Aucun rendez-vous ce jour-là.</p>}
              {rdvDuJour.map((r) => (
                <CarteRendezVous key={r.id} rdv={r} nomEntreprise={nomEntreprise} onChange={() => router.refresh()} />
              ))}
            </div>
          </>
        )}
      </Panneau>

      <SectionIndisponibilites
        indisponibles={indisponibles}
        onChange={() => router.refresh()}
      />
    </div>
  );
}

const boutonNav = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 10,
  border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", cursor: "pointer",
};
const legende = { padding: "3px 9px", borderRadius: 999, background: "var(--bg)", whiteSpace: "nowrap" };

function SectionIndisponibilites({ indisponibles, onChange }) {
  const [enCours, setEnCours] = useState(null);

  async function supprimer(id) {
    if (!window.confirm("Retirer cette période indisponible ?")) return;
    setEnCours(id);
    await fetch(`/api/indisponibilites/${id}`, { method: "DELETE" });
    setEnCours(null);
    onChange();
  }

  return (
    <section style={{ marginBottom: 24 }}>
      <TitreGroupe couleur="var(--text-muted)">Périodes indisponibles de la semaine</TitreGroupe>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {indisponibles.map((p) => (
          <div key={p.id} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 14,
            background: "var(--surface)", border: "1px solid var(--border)", opacity: enCours === p.id ? 0.5 : 1,
          }}>
            <span style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, ...styleIndispo, border: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icone nom="bloque" taille={18} couleur="var(--text-muted)" />
            </span>
            <span style={{ flex: 1, fontSize: 13.5 }}>
              <span style={{ fontWeight: 700 }}>{formatPeriode(p)}</span>
              {p.motif && <span style={{ color: "var(--text-muted)" }}> — {p.motif}</span>}
            </span>
            <button onClick={() => supprimer(p.id)} disabled={enCours === p.id} aria-label="Retirer" style={{ ...boutonNav, color: "var(--danger)" }}>
              <Icone nom="poubelle" taille={17} />
            </button>
          </div>
        ))}
        {indisponibles.length === 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>Aucune cette semaine. Utilise « Indisponibilité » pour bloquer des heures (congé, férié, formation…).</p>
        )}
      </div>
    </section>
  );
}

function FormulaireIndisponibilite({ dateParDefaut, onCree }) {
  const [dateDebut, setDateDebut] = useState(dateParDefaut);
  const [dateFin, setDateFin] = useState(dateParDefaut);
  const [journeeEntiere, setJourneeEntiere] = useState(true);
  const [heureDebut, setHeureDebut] = useState("12:00");
  const [heureFin, setHeureFin] = useState("13:00");
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  async function enregistrer(e) {
    e.preventDefault();
    setErreur("");
    setEnCours(true);
    const res = await fetch("/api/indisponibilites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dateDebut, dateFin, journeeEntiere, heureDebut, heureFin, motif }),
    });
    setEnCours(false);
    if (!res.ok) {
      setErreur((await res.json().catch(() => ({}))).erreur || "Erreur lors de l'enregistrement.");
      return;
    }
    onCree();
  }

  return (
    <form onSubmit={enregistrer} style={{ background: "var(--surface)", border: "1px solid var(--accent)", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
        <input type="checkbox" checked={journeeEntiere} onChange={(e) => setJourneeEntiere(e.target.checked)} />
        Journée(s) entière(s)
      </label>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={styleEtiquette}>Du</span>
        <input type="date" max="9999-12-31" required value={dateDebut} onChange={(e) => { setDateDebut(e.target.value); if (e.target.value > dateFin) setDateFin(e.target.value); }} style={styleChamp} />
        {!journeeEntiere && <input type="time" required value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} style={{ ...styleChamp, width: 100, flex: "none" }} />}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={styleEtiquette}>Au</span>
        <input type="date" max="9999-12-31" required value={dateFin} min={dateDebut} onChange={(e) => setDateFin(e.target.value)} style={styleChamp} />
        {!journeeEntiere && <input type="time" required value={heureFin} onChange={(e) => setHeureFin(e.target.value)} style={{ ...styleChamp, width: 100, flex: "none" }} />}
      </div>
      <input placeholder="Motif (ex : Férié, formation, vacances)" value={motif} onChange={(e) => setMotif(e.target.value)} style={styleChamp} />
      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, margin: 0 }}>{erreur}</p>}
      <button type="submit" disabled={enCours} style={{ padding: 11, borderRadius: 12, fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer", background: "var(--accent)", color: "#221f18" }}>
        {enCours ? "Enregistrement…" : "Bloquer cette période"}
      </button>
    </form>
  );
}

function GrilleSemaine({ jours, rdvParJour, indisponibles, heuresParJour, couleursMotifs, rdvSelectionneId, onSelectionner }) {
  // La grille couvre au moins 7h–19h, élargie si l'atelier ouvre plus tôt ou ferme plus tard.
  const plages = Object.values(heuresParJour).filter(Boolean);
  const debutGrille = Math.min(DEBUT_GRILLE, ...plages.map((h) => Math.floor(heureDecimale(h.ouverture))));
  const finGrille = Math.max(FIN_GRILLE, ...plages.map((h) => Math.ceil(heureDecimale(h.fermeture))));
  const heures = Array.from({ length: finGrille - debutGrille }, (_, i) => debutGrille + i);
  const hauteurTotale = heures.length * HAUTEUR_HEURE;

  function positionPourDate(date) {
    const h = heureQuebec(new Date(date));
    return Math.max(0, (h - debutGrille) * HAUTEUR_HEURE);
  }

  // Bande [début, fin] en heures décimales, bornée à la grille, en px.
  function bande(debut, fin) {
    const d = Math.max(debut, debutGrille);
    const f = Math.min(fin, finGrille);
    return f > d ? { top: (d - debutGrille) * HAUTEUR_HEURE, height: (f - d) * HAUTEUR_HEURE } : null;
  }

  return (
    <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", background: "var(--surface)" }}>
      {/* Colonne des heures */}
      <div style={{ width: 44, flexShrink: 0, borderRight: "1px solid var(--border)" }}>
        <div style={{ height: 40, borderBottom: "1px solid var(--border)" }} />
        {heures.map((h) => (
          <div key={h} style={{ height: HAUTEUR_HEURE, fontSize: 10, color: "var(--text-muted)", textAlign: "right", paddingRight: 6, borderBottom: "1px solid var(--border)", boxSizing: "border-box" }}>
            {h}h
          </div>
        ))}
      </div>

      {/* 7 colonnes de jours */}
      <div style={{ display: "flex", flex: 1, overflowX: "auto" }}>
        {jours.map((j) => {
          const rdvs = (rdvParJour[j] || []).filter((r) => r.statut !== "ANNULE");
          const disposition = disposerColonnes(rdvs);
          const jourNum = new Date(`${j}T12:00:00`).getDate();
          const estAujourdhui = j === new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
          return (
            <div key={j} style={{ flex: "1 1 0", minWidth: 100, borderRight: "1px solid var(--border)", position: "relative" }}>
              <div style={{ height: 40, borderBottom: estAujourdhui ? "2px solid var(--accent)" : "1px solid var(--border)", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: estAujourdhui ? "rgba(232,163,61,0.12)" : "var(--surface-alt)" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>{JOURS_LABEL[new Date(`${j}T12:00:00`).getDay()]}</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: estAujourdhui ? "var(--accent-ombre)" : "var(--text)" }}>{jourNum}</span>
              </div>
              <div style={{ position: "relative", height: hauteurTotale }}>
                {heures.map((h, i) => (
                  <div key={h} style={{ position: "absolute", top: i * HAUTEUR_HEURE, left: 0, right: 0, borderBottom: "1px solid var(--border)" }} />
                ))}
                {/* Heures de fermeture — grisées */}
                {(heuresParJour[j]
                  ? [bande(0, heureDecimale(heuresParJour[j].ouverture)), bande(heureDecimale(heuresParJour[j].fermeture), 24)]
                  : [bande(0, 24)]
                ).filter(Boolean).map((b, i) => (
                  <div key={`ferme-${i}`} style={{ position: "absolute", left: 0, right: 0, ...b, background: "rgba(128,128,128,0.18)", pointerEvents: "none" }} />
                ))}
                {!heuresParJour[j] && (
                  <div style={{ position: "absolute", top: 8, left: 0, right: 0, textAlign: "center", fontSize: 10, color: "var(--text-muted)", pointerEvents: "none" }}>Fermé</div>
                )}
                {/* Périodes indisponibles */}
                {indisponibles.map((p) => {
                  const portion = portionDuJour(p, j);
                  const b = portion && bande(portion.debut, portion.fin);
                  if (!b) return null;
                  return (
                    <div key={p.id} title={p.motif || "Indisponible"} style={{ position: "absolute", left: 0, right: 0, ...b, ...styleIndispo, borderRadius: 0, padding: "3px 5px", overflow: "hidden", fontSize: 9.5, pointerEvents: "none" }}>
                      ⛔ {p.motif || "Indisponible"}
                    </div>
                  );
                })}
                {rdvs.map((r) => {
                  const top = positionPourDate(r.date);
                  const hauteur = Math.max(20, (r.dureeMinutes / 60) * HAUTEUR_HEURE - 2);
                  const cle = r.motif.split(" — ")[0].split(" (")[0].trim();
                  const couleur = couleursMotifs.get(cle) || "var(--accent)";
                  const heureTxt = new Date(r.date).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit", timeZone: "America/Toronto" });
                  const selectionne = rdvSelectionneId === r.id;
                  const { col, nbCols } = disposition[r.id];
                  const source = infosSource(r);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      title={`${source.titre} — ${r.clientNom}${r.pieceJointe ? " — pièce jointe" : ""}${r.bonId ? " — transformé en bon de travail" : ""}`}
                      onClick={() => onSelectionner(selectionne ? null : r.id)}
                      style={{
                        position: "absolute", top, height: hauteur, background: couleur, borderRadius: 8,
                        left: `calc(${(col / nbCols) * 100}% + 2px)`, width: `calc(${100 / nbCols}% - 4px)`,
                        padding: "3px 5px", overflow: "hidden", cursor: "pointer", textAlign: "left",
                        border: selectionne ? "2px solid var(--text)" : "none", boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
                      }}
                    >
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: "#17150f", lineHeight: 1.25 }}>{r.bonId && "✔️ "}{r.pieceJointe && "📎 "}{source.icone} {heureTxt} {r.clientNom}</div>
                      {hauteur > 32 && <div style={{ fontSize: 10, color: "#17150f", opacity: 0.85, lineHeight: 1.25 }}>{cle}</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CarteRendezVous({ rdv, onChange, compact, nomEntreprise }) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  const heure = new Date(rdv.date).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit", timeZone: "America/Toronto" });
  const annule = rdv.statut === "ANNULE";
  const converti = !!rdv.bonId;

  async function annuler() {
    if (!window.confirm("Annuler ce rendez-vous ?")) return;
    setEnCours(true);
    await fetch(`/api/rendezvous/${rdv.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: "ANNULE" }),
    });
    setEnCours(false);
    onChange();
  }

  async function supprimer() {
    if (!window.confirm("Supprimer définitivement ce rendez-vous ?")) return;
    setEnCours(true);
    await fetch(`/api/rendezvous/${rdv.id}`, { method: "DELETE" });
    setEnCours(false);
    onChange();
  }

  async function convertir(confirmerBonNonFacture = false) {
    if (!confirmerBonNonFacture && !window.confirm(`Créer un bon de travail pour ce rendez-vous ?`)) return;
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/rendezvous/${rdv.id}/convertir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmerBonNonFacture }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      // Le client a déjà un bon non facturé : continuer ou non
      if (data.bonNonFacture) {
        if (window.confirm(`${data.erreur}\n\n${QUESTION_BON_NON_FACTURE}`)) return convertir(true);
        return;
      }
      setErreur(data.erreur || "Erreur.");
      return;
    }
    const { bonId } = await res.json();
    router.push(`/bons/${bonId}`);
  }

  const teinte = annule ? "var(--danger)" : converti ? "var(--success)" : "var(--accent)";
  const source = infosSource(rdv);
  return (
    <div style={{
      position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16,
      padding: "14px 16px 14px 20px", opacity: annule ? 0.6 : 1, boxShadow: compact ? "0 6px 16px rgba(0,0,0,0.5)" : "none",
    }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: teinte }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{heure}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span title={source.titre} style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "var(--bg)", color: "var(--text-muted)" }}>
            {source.icone} {source.label}
          </span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{rdv.dureeMinutes} min</span>
        </span>
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{rdv.clientNom}</div>
      {rdv.vehiculeInfo && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{rdv.vehiculeInfo}</div>}
      {rdv.note && <div style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>{rdv.note}</div>}
      <div style={{ fontSize: 14, marginTop: 6 }}>{rdv.motif}</div>
      {rdv.taches?.length > 0 && (
        <ul style={{ fontSize: 13, margin: "2px 0 0", paddingLeft: 18 }}>
          {rdv.taches.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      )}
      {rdv.fichiers?.length > 0 ? (
        <FichiersRendezVous fichiers={rdv.fichiers} style={{ marginTop: 6 }} />
      ) : rdv.pieceJointe && (
        // Fichier gardé par le site seulement (réservation d'avant le transfert
        // des fichiers, ou transfert échoué) ou déjà effacé après 12 mois
        <div style={{ fontSize: 13, marginTop: 4 }}>
          📎 {rdv.piecesJointes?.length ? rdv.piecesJointes.join(", ") : "Pièce jointe"} <span style={{ color: "var(--text-muted)" }}>— voir le courriel de confirmation</span>
        </div>
      )}
      {(rdv.clientTelephone || rdv.clientAdresse || rdv.clientVille) && (
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 6 }}>
          {[rdv.clientTelephone, [rdv.clientAdresse, [rdv.clientVille, rdv.clientCodePostal].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
        </div>
      )}

      {erreur && <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 6 }}>{erreur}</p>}

      {converti ? (
        <Link href={`/bons/${rdv.bonId}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 10, fontSize: 13, fontWeight: 700, color: "var(--success)", textDecoration: "none" }}>
          {rdv.source === "BON" ? "Voir le bon de travail" : "Transformé en bon de travail"} <Icone nom="chevron" taille={15} />
        </Link>
      ) : annule ? (
        <div style={{ marginTop: 10 }}><Pastille couleur="var(--danger)" fond="var(--danger-fond)">Annulé</Pastille></div>
      ) : (
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button onClick={() => convertir()} disabled={enCours} style={{ ...boutonAction, background: "var(--accent)", borderColor: "var(--accent)", color: "#221f18" }}>
            <Icone nom="presse" taille={16} /> Créer le bon
          </button>
          {/* Rappel par texto, sans abonnement (lib/textos.js) */}
          <BoutonTexto
            telephone={rdv.clientTelephone || rdv.client?.telephone}
            message={MESSAGES_TEXTO.rappelRendezVous({ nom: rdv.clientNom, quand: quandRendezVous(rdv.date), nomEntreprise })}
            libelle="💬 Rappel" style={boutonAction} title="Texto de rappel au client — ouvre Messages avec le message déjà écrit"
          />
          <button onClick={annuler} disabled={enCours} style={boutonAction}>
            Annuler
          </button>
          <button onClick={supprimer} disabled={enCours} aria-label="Supprimer" style={{ ...boutonAction, color: "var(--danger)" }}>
            <Icone nom="poubelle" taille={16} />
          </button>
        </div>
      )}
    </div>
  );
}

// « le jeudi 12 novembre à 9 h 30 » (« à 9 h » pour une heure pile)
const FORMAT_QUAND = new Intl.DateTimeFormat("fr-CA", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" });
function quandRendezVous(date) {
  const p = Object.fromEntries(FORMAT_QUAND.formatToParts(new Date(date)).map((x) => [x.type, x.value]));
  return `le ${p.weekday} ${p.day} ${p.month} à ${Number(p.hour)} h${p.minute === "00" ? "" : ` ${p.minute}`}`;
}

const boutonAction = {
  display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, padding: "8px 14px", borderRadius: 10,
  border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", cursor: "pointer",
};

// Hachures grises, utilisées pour les périodes indisponibles dans la grille et les listes.
const styleIndispo = {
  background: "repeating-linear-gradient(45deg, rgba(128,128,128,0.22) 0 6px, rgba(128,128,128,0.08) 6px 12px)",
  border: "1px dashed var(--border)",
  color: "var(--text-muted)",
};

const styleEtiquette = { fontSize: 12, color: "var(--text-muted)", width: 22 };

const styleChamp = {
  flex: 1, minWidth: 0, padding: "8px 9px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 13, boxSizing: "border-box",
};
