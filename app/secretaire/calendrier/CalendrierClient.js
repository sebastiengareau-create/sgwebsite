"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BoutonFlottantNouveau from "../../components/BoutonFlottantNouveau";

const JOURS_LABEL = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const DEBUT_GRILLE = 7; // 7h
const FIN_GRILLE = 19; // 19h
const HAUTEUR_HEURE = 52; // px

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

export default function CalendrierClient({ jours, rendezVous, dateSelectionnee }) {
  const router = useRouter();
  const [jourActif, setJourActif] = useState(jours.includes(dateSelectionnee) ? dateSelectionnee : jours[0]);
  const [vue, setVue] = useState("grille"); // "grille" | "liste"
  const [rdvSelectionneId, setRdvSelectionneId] = useState(null);

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h1 style={{ fontSize: 20 }}>Calendrier</h1>
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

      {vue === "grille" ? (
        <>
          <GrilleSemaine
            jours={jours}
            rdvParJour={rdvParJour}
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
            {rdvDuJour.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucun rendez-vous ce jour-là.</p>}
            {rdvDuJour.map((r) => (
              <CarteRendezVous key={r.id} rdv={r} onChange={() => router.refresh()} />
            ))}
          </div>
        </>
      )}
      <BoutonFlottantNouveau />
    </div>
  );
}

function GrilleSemaine({ jours, rdvParJour, couleursMotifs, rdvSelectionneId, onSelectionner }) {
  const heures = Array.from({ length: FIN_GRILLE - DEBUT_GRILLE }, (_, i) => DEBUT_GRILLE + i);
  const hauteurTotale = heures.length * HAUTEUR_HEURE;

  function positionPourDate(date) {
    const d = new Date(date);
    const h = d.getHours() + d.getMinutes() / 60;
    return Math.max(0, (h - DEBUT_GRILLE) * HAUTEUR_HEURE);
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
                {rdvs.map((r) => {
                  const top = positionPourDate(r.date);
                  const hauteur = Math.max(20, (r.dureeMinutes / 60) * HAUTEUR_HEURE - 2);
                  const cle = r.motif.split(" — ")[0].split(" (")[0].trim();
                  const couleur = couleursMotifs.get(cle) || "var(--accent)";
                  const heureTxt = new Date(r.date).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit", timeZone: "America/Toronto" });
                  const selectionne = rdvSelectionneId === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => onSelectionner(selectionne ? null : r.id)}
                      style={{
                        position: "absolute", top, left: 2, right: 2, height: hauteur, background: couleur, borderRadius: 5,
                        padding: "3px 5px", overflow: "hidden", cursor: "pointer", textAlign: "left",
                        border: selectionne ? "2px solid var(--text)" : "none", boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                      }}
                    >
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: "#17150f", lineHeight: 1.2 }}>{heureTxt} {r.clientNom}</div>
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
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{rdv.dureeMinutes} min</span>
      </div>
      <div style={{ fontWeight: 600, marginTop: 2 }}>{rdv.clientNom}</div>
      {rdv.vehiculeInfo && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{rdv.vehiculeInfo}</div>}
      {rdv.note && <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>{rdv.note}</div>}
      <div style={{ fontSize: 13, marginTop: 4 }}>{rdv.motif}</div>
      {rdv.clientTelephone && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{rdv.clientTelephone}</div>}

      {erreur && <p style={{ fontSize: 11, color: "var(--danger)", marginTop: 6 }}>{erreur}</p>}

      {converti ? (
        <Link href={`/bons/${rdv.bonId}`} style={{ display: "inline-block", marginTop: 10, fontSize: 11, fontWeight: 700, color: "var(--success)", textDecoration: "none" }}>
          ✓ Transformé en bon de travail →
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
