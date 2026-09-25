"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BoutonFlottantNouveau from "../../components/BoutonFlottantNouveau";
import BandeauSection from "../../components/BandeauSection";

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

export default function CalendrierClient({ jours, rendezVous, indisponibles, heuresParJour, capacite, dateSelectionnee }) {
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

  return (
    <div style={{ padding: 16, maxWidth: vue === "grille" ? 1100 : 480, margin: "0 auto", width: "100%" }}>
      <BandeauSection icone="📅" titre="Calendrier" sousTitre="Rendez-vous et disponibilités de l'atelier." />

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 4, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 3 }}>
          <button onClick={() => setVue("grille")} style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 7, border: "none", cursor: "pointer", background: vue === "grille" ? "var(--accent)" : "none", color: vue === "grille" ? "#17150f" : "var(--text-muted)" }}>
            ▦ Grille
          </button>
          <button onClick={() => setVue("liste")} style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 7, border: "none", cursor: "pointer", background: vue === "liste" ? "var(--accent)" : "none", color: vue === "liste" ? "#17150f" : "var(--text-muted)" }}>
            ☰ Liste
          </button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <button onClick={() => changerSemaine(-7)} className="bouton-3d-sombre" style={{ padding: "8px 14px", borderRadius: 8, fontSize: 14, fontWeight: 700 }}>←</button>
        <span style={{ flex: 1, textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>
          Semaine du {new Date(`${jours[0]}T12:00:00`).toLocaleDateString("fr-CA", { day: "numeric", month: "long" })}
        </span>
        <button onClick={() => changerSemaine(7)} className="bouton-3d-sombre" style={{ padding: "8px 14px", borderRadius: 8, fontSize: 14, fontWeight: 700 }}>→</button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>
        {Object.values(SOURCES).map((s) => <span key={s.label} title={s.titre}>{s.icone} {s.label}</span>)}
        {capacite && <span>· Case fermée après {capacite} rendez-vous simultané{capacite > 1 ? "s" : ""}</span>}
      </div>

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
              <div style={{ marginTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)" }}>Détail du rendez-vous</span>
                  <button onClick={() => setRdvSelectionneId(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 16, cursor: "pointer" }}>✕</button>
                </div>
                <CarteRendezVous rdv={rdvSelectionne} onChange={() => router.refresh()} />
              </div>
            );
          })()}
        </>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 16 }}>
            {jours.map((j) => {
              const actif = j === jourActif;
              const nbRdv = (rdvParJour[j] || []).filter((r) => r.statut !== "ANNULE").length;
              const jourNum = new Date(`${j}T12:00:00`).getDate();
              return (
                <button
                  key={j}
                  onClick={() => setJourActif(j)}
                  className={actif ? "bouton-3d" : "bouton-3d-sombre"}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 2px", borderRadius: 10 }}
                >
                  <span style={{ fontSize: 10, fontWeight: 600 }}>{JOURS_LABEL[new Date(`${j}T12:00:00`).getDay()]}</span>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{jourNum}</span>
                  {nbRdv > 0 && <span style={{ fontSize: 9, fontWeight: 700 }}>{nbRdv}</span>}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ color: "var(--text-muted)", fontSize: 12, margin: 0 }}>
              {heuresParJour[jourActif] ? `Ouvert de ${heuresParJour[jourActif].ouverture} à ${heuresParJour[jourActif].fermeture}` : "Fermé ce jour-là"}
            </p>
            {indisponibles.filter((p) => portionDuJour(p, jourActif)).map((p) => (
              <div key={p.id} style={{ ...styleIndispo, borderRadius: 10, padding: 10, fontSize: 12 }}>
                ⛔ {formatPeriode(p)}{p.motif ? ` — ${p.motif}` : ""}
              </div>
            ))}
            {rdvDuJour.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucun rendez-vous ce jour-là.</p>}
            {rdvDuJour.map((r) => (
              <CarteRendezVous key={r.id} rdv={r} onChange={() => router.refresh()} />
            ))}
          </div>
        </>
      )}
      <SectionIndisponibilites
        indisponibles={indisponibles}
        afficherForm={afficherFormIndispo}
        setAfficherForm={setAfficherFormIndispo}
        dateParDefaut={jourActif}
        onChange={() => router.refresh()}
      />
      <BoutonFlottantNouveau />
    </div>
  );
}

function SectionIndisponibilites({ indisponibles, afficherForm, setAfficherForm, dateParDefaut, onChange }) {
  const [enCours, setEnCours] = useState(null);

  async function supprimer(id) {
    if (!window.confirm("Retirer cette période indisponible ?")) return;
    setEnCours(id);
    await fetch(`/api/indisponibilites/${id}`, { method: "DELETE" });
    setEnCours(null);
    onChange();
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700 }}>Périodes indisponibles (semaine)</span>
        <button onClick={() => setAfficherForm((v) => !v)} className="bouton-3d-sombre" style={{ fontSize: 11, fontWeight: 700, padding: "6px 10px", borderRadius: 8 }}>
          {afficherForm ? "Annuler" : "+ Indisponibilité"}
        </button>
      </div>
      {afficherForm && (
        <FormulaireIndisponibilite
          dateParDefaut={dateParDefaut}
          onCree={() => { setAfficherForm(false); onChange(); }}
        />
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {indisponibles.map((p) => (
          <div key={p.id} style={{ ...styleIndispo, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, borderRadius: 8, padding: "8px 10px", fontSize: 12, opacity: enCours === p.id ? 0.5 : 1 }}>
            <span>⛔ {formatPeriode(p)}{p.motif ? ` — ${p.motif}` : ""}</span>
            <button onClick={() => supprimer(p.id)} disabled={enCours === p.id} style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 13, cursor: "pointer" }}>🗑️</button>
          </div>
        ))}
        {indisponibles.length === 0 && !afficherForm && (
          <p style={{ color: "var(--text-muted)", fontSize: 12, margin: 0 }}>Aucune cette semaine. Ajoutes-en une pour bloquer des heures (congé, férié, formation…).</p>
        )}
      </div>
    </div>
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
    <form onSubmit={enregistrer} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, marginBottom: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
        <input type="checkbox" checked={journeeEntiere} onChange={(e) => setJourneeEntiere(e.target.checked)} />
        Journée(s) entière(s)
      </label>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={styleEtiquette}>Du</span>
        <input type="date" required value={dateDebut} onChange={(e) => { setDateDebut(e.target.value); if (e.target.value > dateFin) setDateFin(e.target.value); }} style={styleChamp} />
        {!journeeEntiere && <input type="time" required value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} style={{ ...styleChamp, width: 100, flex: "none" }} />}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={styleEtiquette}>Au</span>
        <input type="date" required value={dateFin} min={dateDebut} onChange={(e) => setDateFin(e.target.value)} style={styleChamp} />
        {!journeeEntiere && <input type="time" required value={heureFin} onChange={(e) => setHeureFin(e.target.value)} style={{ ...styleChamp, width: 100, flex: "none" }} />}
      </div>
      <input placeholder="Motif (ex : Férié, formation, vacances)" value={motif} onChange={(e) => setMotif(e.target.value)} style={styleChamp} />
      {erreur && <p style={{ color: "var(--danger)", fontSize: 12, margin: 0 }}>{erreur}</p>}
      <button type="submit" disabled={enCours} className="bouton-3d" style={{ padding: 9, borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
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
    <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "var(--surface)" }}>
      {/* Colonne des heures */}
      <div style={{ width: 44, flexShrink: 0, borderRight: "1px solid var(--border)" }}>
        <div style={{ height: 28, borderBottom: "1px solid var(--border)" }} />
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
              <div style={{ height: 28, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, background: estAujourdhui ? "rgba(232,163,61,0.1)" : "none" }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{JOURS_LABEL[new Date(`${j}T12:00:00`).getDay()]}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: estAujourdhui ? "var(--accent)" : "var(--text)" }}>{jourNum}</span>
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
                      title={`${source.titre} — ${r.clientNom}`}
                      onClick={() => onSelectionner(selectionne ? null : r.id)}
                      style={{
                        position: "absolute", top, height: hauteur, background: couleur, borderRadius: 5,
                        left: `calc(${(col / nbCols) * 100}% + 2px)`, width: `calc(${100 / nbCols}% - 4px)`,
                        padding: "3px 5px", overflow: "hidden", cursor: "pointer", textAlign: "left",
                        border: selectionne ? "2px solid var(--text)" : "none", boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                      }}
                    >
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: "#17150f", lineHeight: 1.2 }}>{source.icone} {heureTxt} {r.clientNom}</div>
                      {hauteur > 32 && <div style={{ fontSize: 9, color: "#17150f", opacity: 0.85, lineHeight: 1.2 }}>{cle}</div>}
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

function CarteRendezVous({ rdv, onChange, compact }) {
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

  async function convertir() {
    if (!window.confirm(`Créer un bon de travail pour ce rendez-vous ?`)) return;
    setErreur("");
    setEnCours(true);
    const res = await fetch(`/api/rendezvous/${rdv.id}/convertir`, { method: "POST" });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur.");
      return;
    }
    const { bonId } = await res.json();
    router.push(`/bons/${bonId}`);
  }

  return (
    <div style={{
      background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: 14,
      opacity: annule ? 0.6 : 1, borderLeft: `3px solid ${annule ? "#C15B4A" : converti ? "#6FA96B" : "var(--accent)"}`,
      boxShadow: compact ? "0 6px 16px rgba(0,0,0,0.5)" : "none",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{heure}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span title={infosSource(rdv).titre} style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
            {infosSource(rdv).icone} {infosSource(rdv).label}
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{rdv.dureeMinutes} min</span>
        </span>
      </div>
      <div style={{ fontWeight: 600, marginTop: 2 }}>{rdv.clientNom}</div>
      {rdv.vehiculeInfo && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{rdv.vehiculeInfo}</div>}
      {rdv.note && <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>{rdv.note}</div>}
      <div style={{ fontSize: 13, marginTop: 4 }}>{rdv.motif}</div>
      {rdv.clientTelephone && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{rdv.clientTelephone}</div>}
      {(rdv.clientAdresse || rdv.clientVille) && (
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {[rdv.clientAdresse, [rdv.clientVille, rdv.clientCodePostal].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
        </div>
      )}

      {erreur && <p style={{ fontSize: 11, color: "var(--danger)", marginTop: 6 }}>{erreur}</p>}

      {converti ? (
        <Link href={`/bons/${rdv.bonId}`} style={{ display: "inline-block", marginTop: 10, fontSize: 11, fontWeight: 700, color: "var(--success)", textDecoration: "none" }}>
          {rdv.source === "BON" ? "🔧 Voir le bon de travail →" : "✓ Transformé en bon de travail →"}
        </Link>
      ) : annule ? (
        <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 8 }}>Annulé</div>
      ) : (
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button onClick={convertir} disabled={enCours} className="bouton-3d" style={{ fontSize: 11, fontWeight: 700, padding: "6px 10px", borderRadius: 8 }}>
            → Créer le bon
          </button>
          <button onClick={annuler} disabled={enCours} className="bouton-3d-sombre" style={{ fontSize: 11, fontWeight: 600, padding: "6px 10px", borderRadius: 8 }}>
            Annuler
          </button>
          <button onClick={supprimer} disabled={enCours} className="bouton-3d-sombre" style={{ fontSize: 11, fontWeight: 600, padding: "6px 10px", borderRadius: 8, color: "var(--danger)" }}>
            🗑️
          </button>
        </div>
      )}
    </div>
  );
}

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
