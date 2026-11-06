"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import BandeauSection from "../../components/BandeauSection";
import { argent } from "@/lib/format";

function fmtHeures(h) {
  const heures = Math.floor(h);
  const min = Math.round((h - heures) * 60);
  return `${heures}h${String(min).padStart(2, "0")}`;
}

// Construit une couleur par bon, une seule fois pour toute la page — en
// utilisant l'angle d'or (137.5°) pour garantir que deux bons différents
// affichés le même jour ont toujours des couleurs bien distinctes (plutôt
// que de compter sur le hasard d'un calcul indépendant par bon, qui peut
// donner des teintes presque identiques par coïncidence).
function construireCarteCouleurs(parMecanicien) {
  const toutes = parMecanicien
    .flatMap((m) => m.entrees)
    .sort((a, b) => new Date(a.debut) - new Date(b.debut));
  const carte = new Map();
  let index = 0;
  for (const e of toutes) {
    const num = e.probleme.bon.numero;
    if (!carte.has(num)) {
      const teinte = (index * 137.508) % 360;
      carte.set(num, `hsl(${teinte}, 65%, 55%)`);
      index++;
    }
  }
  return carte;
}

function numeroTache(entree) {
  return entree.probleme.bon.problemes.findIndex((p) => p.id === entree.probleme.id) + 1;
}

// Échelle de la frise : 7h à 19h, élargie au besoin pour couvrir les heures
// d'ouverture du jour.
const DEBUT_ECHELLE = 7;
const FIN_ECHELLE = 19;

function FriseHoraire({ entrees, entreesInternes, couleurs, heuresOuverture }) {
  const debutEchelle = Math.min(DEBUT_ECHELLE, heuresOuverture ? Math.floor(heuresOuverture.debut) : DEBUT_ECHELLE);
  const finEchelle = Math.max(FIN_ECHELLE, heuresOuverture ? Math.ceil(heuresOuverture.fin) : FIN_ECHELLE);
  const portee = finEchelle - debutEchelle;
  const pourcentage = (h) => Math.min(100, Math.max(0, ((h - debutEchelle) / portee) * 100));
  const pourcentagePourHeure = (date) => pourcentage(date.getHours() + date.getMinutes() / 60);
  const heures = Array.from({ length: portee + 1 }, (_, i) => debutEchelle + i);

  const bonsUniques = [];
  const vus = new Set();
  for (const e of entrees) {
    const num = e.probleme.bon.numero;
    if (!vus.has(num)) {
      vus.add(num);
      bonsUniques.push({ numero: num, client: e.probleme.bon.client.nom });
    }
  }
  const COULEUR_INTERNE = "#5c584f";

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ position: "relative", height: 32, background: "var(--bg)", borderRadius: 6, overflow: "hidden" }}>
        {heures.map((h) => (
          <div key={h} style={{ position: "absolute", left: `${pourcentage(h)}%`, top: 0, bottom: 0, width: 1, background: "var(--border)" }} />
        ))}
        {entrees.map((e) => {
          const debut = new Date(e.debut);
          const fin = e.fin ? new Date(e.fin) : new Date();
          const gauche = pourcentagePourHeure(debut);
          const droite = pourcentagePourHeure(fin);
          return (
            <div
              key={e.id}
              title={`#${e.probleme.bon.numero} — ${numeroTache(e)}. ${e.probleme.description}`}
              style={{
                position: "absolute", left: `${gauche}%`, width: `${Math.max(droite - gauche, 0.5)}%`,
                top: 3, bottom: 3, background: couleurs.get(e.probleme.bon.numero), borderRadius: 3,
              }}
            />
          );
        })}
        {(entreesInternes || []).map((e) => {
          const debut = new Date(e.debut);
          const fin = e.fin ? new Date(e.fin) : new Date();
          const gauche = pourcentagePourHeure(debut);
          const droite = pourcentagePourHeure(fin);
          return (
            <div
              key={e.id}
              title={`🛠️ ${e.tacheInterne.nom} (interne)`}
              style={{
                position: "absolute", left: `${gauche}%`, width: `${Math.max(droite - gauche, 0.5)}%`,
                top: 3, bottom: 3, background: COULEUR_INTERNE, borderRadius: 3,
                backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0, rgba(255,255,255,0.08) 3px, transparent 3px, transparent 6px)",
              }}
            />
          );
        })}
        {heuresOuverture && (
          <div
            title={`Heures d'ouverture ${heuresOuverture.libelle}`}
            style={{
              position: "absolute", left: `${pourcentage(heuresOuverture.debut)}%`,
              width: `${pourcentage(heuresOuverture.fin) - pourcentage(heuresOuverture.debut)}%`,
              top: 0, bottom: 0, border: "2px solid var(--text)", borderRadius: 6,
              boxSizing: "border-box", pointerEvents: "none",
            }}
          />
        )}
      </div>
      <div style={{ position: "relative", height: 12, fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>
        {/* Une heure sur deux, pour que les repères tiennent sur un téléphone */}
        {heures.map((h, i) => i % 2 === 0 && (
          <span
            key={h}
            style={{
              position: "absolute", left: `${pourcentage(h)}%`,
              transform: i === 0 ? "none" : i === heures.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
              fontWeight: heuresOuverture && (h === heuresOuverture.debut || h === heuresOuverture.fin) ? 700 : 400,
              color: heuresOuverture && h >= heuresOuverture.debut && h <= heuresOuverture.fin ? "var(--text)" : undefined,
            }}
          >
            {h}h
          </span>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
        {bonsUniques.map((b) => (
          <span key={b.numero} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--text-muted)" }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: couleurs.get(b.numero) }} />
            #{b.numero} {b.client}
          </span>
        ))}
        {entreesInternes && entreesInternes.length > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--text-muted)" }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: COULEUR_INTERNE }} />
            🛠️ Tâches internes
          </span>
        )}
      </div>
    </div>
  );
}

// Heure et jour au Québec, pour préremplir les champs d'ajustement
const FUSEAU = "America/Toronto";
const heureQuebec = (d) => new Intl.DateTimeFormat("en-GB", { timeZone: FUSEAU, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(d));
const jourQuebec = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: FUSEAU, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d));

const champPetit = { padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 12 };
const boutonPetit = { fontSize: 11, color: "var(--text-muted)", background: "none", border: "1px solid var(--border)", padding: "3px 7px", borderRadius: 6, cursor: "pointer" };

// Heures réellement travaillées par l'employé ce jour-là : remplacent les
// heures prévues de l'horaire dans le coût, la présence et la marge (et dans
// la rentabilité par période). Vide = retour aux heures prévues.
function EditeurHeuresJour({ employeId, dateStr, heuresReelles, heuresPrevues, onFini }) {
  const [valeur, setValeur] = useState(String(heuresReelles ?? heuresPrevues));
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  async function enregistrer(heures) {
    setEnCours(true);
    setErreur("");
    const res = await fetch("/api/heures-jour", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeId, date: dateStr, heures }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de l'enregistrement.");
      return;
    }
    onFini(true);
  }

  return (
    <div style={{ background: "var(--bg)", borderRadius: 6, padding: "8px 10px", marginTop: 6, fontSize: 12 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ color: "var(--text-muted)" }}>Heures travaillées ce jour :</span>
        <input
          type="number" inputMode="decimal" min="0" max="24" step="0.25" value={valeur}
          onChange={(e) => setValeur(e.target.value)}
          style={{ ...champPetit, width: 80 }}
        />
        <button onClick={() => enregistrer(valeur)} disabled={enCours || valeur === ""} style={{ ...boutonJour, padding: "5px 10px", color: "var(--text)" }}>
          {enCours ? "…" : "✓ Enregistrer"}
        </button>
        <button onClick={() => onFini(false)} disabled={enCours} style={boutonPetit}>Annuler</button>
      </div>
      {heuresReelles !== null && (
        <button onClick={() => enregistrer(null)} disabled={enCours} style={{ ...boutonPetit, border: "none", padding: "4px 0 0", textDecoration: "underline" }}>
          ↺ Revenir aux heures prévues ({heuresPrevues}h)
        </button>
      )}
      {erreur && <div style={{ color: "var(--danger)", fontSize: 11, marginTop: 4 }}>{erreur}</div>}
    </div>
  );
}

// Ajout à la main d'un poinçon terminé (début et fin) pour la journée
// affichée — sur une tâche interne seulement, jamais sur un bon
function AjoutPoinconInterne({ employeId, dateStr, tachesInternes, onFini }) {
  const [tacheId, setTacheId] = useState(tachesInternes.length === 1 ? tachesInternes[0].id : "");
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  async function enregistrer() {
    setEnCours(true);
    setErreur("");
    const res = await fetch("/api/entrees-temps-internes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeId, tacheInterneId: tacheId, date: dateStr, debut, fin }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de l'ajout.");
      return;
    }
    onFini(true);
  }

  if (tachesInternes.length === 0) {
    return (
      <div style={{ background: "var(--bg)", borderRadius: 6, padding: "8px 10px", marginTop: 6, fontSize: 12, color: "var(--text-muted)" }}>
        Aucune tâche interne active — crée-en une dans Paramètres → Tâches internes.{" "}
        <button onClick={() => onFini(false)} style={boutonPetit}>Fermer</button>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--bg)", borderRadius: 6, padding: "8px 10px", marginTop: 6, fontSize: 12 }}>
      <div style={{ color: "var(--text-muted)", marginBottom: 6 }}>🛠️ Ajouter un poinçon de tâche interne</div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <select value={tacheId} onChange={(ev) => setTacheId(ev.target.value)} style={{ ...champPetit, maxWidth: "100%" }}>
          <option value="">Tâche interne…</option>
          {tachesInternes.map((t) => <option key={t.id} value={t.id}>{t.nom}</option>)}
        </select>
        <span style={{ color: "var(--text-muted)", fontSize: 11 }}>De</span>
        <input type="time" value={debut} onChange={(ev) => setDebut(ev.target.value)} style={champPetit} />
        <span style={{ color: "var(--text-muted)", fontSize: 11 }}>à</span>
        <input type="time" value={fin} onChange={(ev) => setFin(ev.target.value)} style={champPetit} />
        <button onClick={enregistrer} disabled={enCours || !tacheId || !debut || !fin} style={{ ...boutonJour, padding: "5px 10px", color: "var(--text)" }}>
          {enCours ? "…" : "✓ Ajouter"}
        </button>
        <button onClick={() => onFini(false)} disabled={enCours} style={boutonPetit}>Annuler</button>
      </div>
      {erreur && <div style={{ color: "var(--danger)", fontSize: 11, marginTop: 4 }}>{erreur}</div>}
    </div>
  );
}

// Ligne d'un poinçon de tâche interne, avec ajustement du début et de la fin
// (les heures d'origine sont gardées et montrées dans l'historique des tâches
// internes, Paramètres)
function LigneTacheInterne({ e, coutHoraire, onModifie }) {
  const [edition, setEdition] = useState(false);
  const [debut, setDebut] = useState(heureQuebec(e.debut));
  const [fin, setFin] = useState(e.fin ? heureQuebec(e.fin) : "");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const duree = e.fin ? (new Date(e.fin) - new Date(e.debut)) / 3600000 : null;
  const jourDebut = jourQuebec(e.debut);
  const jourFin = e.fin ? jourQuebec(e.fin) : jourDebut;

  async function enregistrer() {
    setEnCours(true);
    setErreur("");
    const res = await fetch(`/api/entrees-temps-internes/${e.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ debut: `${jourDebut}T${debut}`, fin: fin ? `${jourFin}T${fin}` : null }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de l'ajustement.");
      return;
    }
    setEdition(false);
    onModifie();
  }

  return (
    <div style={{ fontSize: 12, background: "var(--bg)", borderRadius: 6, padding: "6px 8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div>🛠️ {e.tacheInterne.nom} <span style={{ color: "var(--text-muted)", fontSize: 10 }}>(interne, non facturable)</span></div>
          <div style={{ color: "var(--text-muted)", fontSize: 10.5 }}>
            {heureQuebec(e.debut)}–{e.fin ? heureQuebec(e.fin) : "en cours"}
            {duree !== null && ` · coût ${argent((duree * coutHoraire))}`}
            {e.ajouteLe && <span title={`Ajouté à la main par ${e.ajoutePar || "?"}`}> · ✍️ ajouté à la main</span>}
            {e.modifieLe && <span title={`Ajusté par ${e.modifiePar || "?"}`}> · ✏️ ajusté</span>}
          </div>
        </div>
        <span style={{ display: "flex", gap: 6, alignItems: "center", whiteSpace: "nowrap" }}>
          <span style={{ fontWeight: 600, color: e.fin ? "var(--text)" : "var(--accent)" }}>{duree !== null ? fmtHeures(duree) : "●"}</span>
          {!edition && <button onClick={() => setEdition(true)} title="Ajuster le temps" style={boutonPetit}>✏️</button>}
        </span>
      </div>
      {edition && (
        <div style={{ marginTop: 6 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ color: "var(--text-muted)", fontSize: 11 }}>De</span>
            <input type="time" value={debut} onChange={(ev) => setDebut(ev.target.value)} style={champPetit} />
            <span style={{ color: "var(--text-muted)", fontSize: 11 }}>à</span>
            <input type="time" value={fin} onChange={(ev) => setFin(ev.target.value)} style={champPetit} />
            <button onClick={enregistrer} disabled={enCours || !debut || (e.fin && !fin)} style={{ ...boutonJour, padding: "5px 10px", color: "var(--text)" }}>
              {enCours ? "…" : "✓"}
            </button>
            <button onClick={() => { setEdition(false); setErreur(""); }} disabled={enCours} style={boutonPetit}>Annuler</button>
          </div>
          {!e.fin && <div style={{ color: "var(--text-muted)", fontSize: 10.5, marginTop: 3 }}>Fin vide : le poinçon reste en cours.</div>}
          {erreur && <div style={{ color: "var(--danger)", fontSize: 11, marginTop: 4 }}>{erreur}</div>}
        </div>
      )}
    </div>
  );
}

const fmtDateHeure = (d) => new Date(d).toLocaleString("fr-CA", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Poinçons oubliés (lib/productivite.js) : encore ouverts depuis trop
// longtemps, ou qui débordent sur un autre jour. Le gérant entre la vraie
// heure de fin directement ici.
function PoinconsOublies({ poincons }) {
  const router = useRouter();
  if (!poincons || poincons.length === 0) return null;
  return (
    <div className="carte carte-m" style={{ marginBottom: 16, border: "1px solid var(--danger)" }}>
      <div style={{ fontWeight: 700, color: "var(--danger)", marginBottom: 4 }}>
        ⚠ {poincons.length} poinçon{poincons.length > 1 ? "s" : ""} oublié{poincons.length > 1 ? "s" : ""} ?
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>
        Encore ouvert trop longtemps ou terminé un autre jour. Corrige l'heure de fin pour que la paie et les rapports soient justes.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {poincons.map((p) => <LignePoinconOublie key={`${p.type}-${p.id}`} p={p} onCorrige={() => router.refresh()} />)}
      </div>
    </div>
  );
}

function LignePoinconOublie({ p, onCorrige }) {
  const [fin, setFin] = useState(p.finProposee);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const duree = ((p.fin ? new Date(p.fin) : new Date()) - new Date(p.debut)) / 3600000;

  async function corriger() {
    setEnCours(true);
    setErreur("");
    const res = await fetch("/api/poincons-oublies", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: p.type, id: p.id, fin }),
    });
    setEnCours(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErreur(data.erreur || "Erreur lors de la correction.");
      return;
    }
    onCorrige();
  }

  return (
    <div style={{ background: "var(--bg)", borderRadius: 6, padding: "8px 10px", fontSize: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <strong>{p.employe}</strong>
        <span style={{ color: "var(--danger)", fontWeight: 600, whiteSpace: "nowrap" }}>{fmtHeures(duree)}{p.fin ? "" : " · en cours"}</span>
      </div>
      <div>
        {p.bonId ? <Link href={`/bons/${p.bonId}`} style={{ color: "inherit" }}>{p.libelle}</Link> : p.libelle}
      </div>
      <div style={{ color: "var(--text-muted)", fontSize: 10.5 }}>
        Début {fmtDateHeure(p.debut)} · {p.fin ? `fin ${fmtDateHeure(p.fin)}` : "jamais arrêté"}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Vraie fin :</span>
        <input
          type="datetime-local" value={fin} onChange={(e) => setFin(e.target.value)}
          style={{ flex: 1, minWidth: 0, padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 12 }}
        />
        <button onClick={corriger} disabled={enCours || !fin} style={{ ...boutonJour, padding: "6px 10px", color: "var(--text)" }}>
          {enCours ? "…" : "Corriger"}
        </button>
      </div>
      {erreur && <div style={{ color: "var(--danger)", fontSize: 11, marginTop: 4 }}>{erreur}</div>}
    </div>
  );
}

export default function RapportsClient({ dateStr, parMecanicien, heuresAttendues, coutHoraire, tauxHoraireClient, heuresOuverture, poinconsOublies, tachesInternes = [] }) {
  const router = useRouter();

  function changerDate(nouvelleDate) {
    router.push(`/gerant/rapports?date=${nouvelleDate}`);
  }

  const dateAfficheeBrute = new Date(`${dateStr}T12:00:00`).toLocaleDateString("fr-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const dateAffichee = dateAfficheeBrute.charAt(0).toUpperCase() + dateAfficheeBrute.slice(1);

  // Coût : sur les heures PRÉVUES (ou les heures réelles entrées par le
  // gérant), mais seulement pour les employés PRÉSENTS (au moins un poinçon
  // démarré ce jour-là, ou des heures réelles entrées) — un employé absent ne
  // coûte rien dans ce calcul, pour ne pas fausser les chiffres en cas de
  // maladie, congé, etc.
  // Revenu : seulement sur les heures RÉELLEMENT poinçonnées (facturables)
  // Heures du jour d'un employé : ses heures réelles si le gérant les a
  // entrées (« Coût du jour » ✏️), sinon les heures prévues de l'horaire.
  // Entrer des heures réelles compte l'employé présent même sans poinçon.
  const [editionHeures, setEditionHeures] = useState(null); // id de l'employé
  const [ajoutPoincon, setAjoutPoincon] = useState(null); // id de l'employé
  const heuresDuJour = (m) => m.heuresReelles ?? heuresAttendues;
  const presents = parMecanicien.filter((m) => m.entrees.length > 0 || m.entreesInternes.length > 0 || m.heuresReelles !== null);
  const totalCoutEquipe = presents.reduce((s, m) => s + heuresDuJour(m) * coutHoraire, 0);
  // Tâches internes : heures × coût horaire du garage (déjà comprises dans le
  // coût du jour — montré à part pour voir ce que coûte le temps non facturable)
  const totalHeuresInternes = parMecanicien.reduce((s, m) => s + m.heuresInternes, 0);
  const totalCoutInternes = totalHeuresInternes * coutHoraire;
  const finEdition = (modifie) => { setEditionHeures(null); if (modifie) router.refresh(); };
  const totalRevenuEquipe = parMecanicien.reduce((s, m) => s + m.heuresPoinconnees, 0) * tauxHoraireClient;
  const margeEquipe = totalRevenuEquipe - totalCoutEquipe;
  const couleurs = construireCarteCouleurs(parMecanicien);

  return (
    <div className="conteneur-page">
      <BandeauSection icone="📈" titre="Rapport journalier" sousTitre={`${dateAffichee} · ${heuresAttendues}h prévues`}>
        <Link href="/gerant/rapports/rentabilite" style={{ display: "inline-block", marginTop: 12, fontSize: 12, fontWeight: 600, color: "#fff", textDecoration: "none", border: "1px solid rgba(255,255,255,0.3)", padding: "6px 12px", borderRadius: 8 }}>
          📊 Voir la rentabilité par période →
        </Link>
      </BandeauSection>

      <PoinconsOublies poincons={poinconsOublies} />

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <button onClick={() => changerDate(decaler(dateStr, -1))} style={boutonJour}>← Veille</button>
        <input
          type="date" max="9999-12-31"
          value={dateStr}
          onChange={(e) => changerDate(e.target.value)}
          style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 13 }}
        />
        <button onClick={() => changerDate(decaler(dateStr, 1))} style={boutonJour}>Lendemain →</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div className="carte carte-s">
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--danger)" }}>{argent(totalCoutEquipe)}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Coût (heures travaillées)</div>
        </div>
        <div className="carte carte-s">
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--success)" }}>{argent(totalRevenuEquipe)}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Revenu (heures poinçonnées)</div>
        </div>
      </div>
      {totalHeuresInternes > 0 && (
        <div className="carte carte-s" style={{ marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>🛠️ Tâches internes ({fmtHeures(totalHeuresInternes)} × {argent(coutHoraire)}) — compris dans le coût</span>
          <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: "nowrap" }}>{argent(totalCoutInternes)}</span>
        </div>
      )}
      <div className="carte carte-s" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Marge du jour (équipe)</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: margeEquipe >= 0 ? "var(--success)" : "var(--danger)" }}>{argent(margeEquipe)}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {parMecanicien.map((m) => {
          const { employe, entrees, entreesInternes, heuresPoinconnees, heuresInternes, heuresReelles } = m;
          const absent = entrees.length === 0 && entreesInternes.length === 0 && heuresReelles === null;
          const editeur = editionHeures === employe.id && (
            <EditeurHeuresJour
              key={`${employe.id}-${dateStr}`}
              employeId={employe.id} dateStr={dateStr}
              heuresReelles={heuresReelles} heuresPrevues={heuresAttendues}
              onFini={finEdition}
            />
          );
          const ajout = ajoutPoincon === employe.id && (
            <AjoutPoinconInterne
              key={`ajout-${employe.id}-${dateStr}`}
              employeId={employe.id} dateStr={dateStr} tachesInternes={tachesInternes}
              onFini={(ajoute) => { setAjoutPoincon(null); if (ajoute) router.refresh(); }}
            />
          );
          const boutonAjout = ajoutPoincon !== employe.id && (
            <button onClick={() => setAjoutPoincon(employe.id)} title="Ajouter à la main un poinçon de tâche interne (début et fin)" style={boutonPetit}>+ Poinçon interne</button>
          );

          if (absent) {
            return (
              <div key={employe.id} className="carte carte-m">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, opacity: 0.6 }}>
                  <span style={{ fontWeight: 600 }}>{employe.nom}</span>
                  <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Absent — aucun poinçon</span>
                    {editionHeures !== employe.id && (
                      <button onClick={() => setEditionHeures(employe.id)} title="A travaillé sans poinçonner : entrer ses heures" style={boutonPetit}>✏️ Heures</button>
                    )}
                    {boutonAjout}
                  </span>
                </div>
                {editeur}
                {ajout}
              </div>
            );
          }

          const heuresJour = heuresDuJour(m);
          const tempsNonPoinconne = Math.max(0, heuresJour - heuresPoinconnees - heuresInternes);
          const coutJour = heuresJour * coutHoraire;
          const coutInternes = heuresInternes * coutHoraire;
          const revenuJour = heuresPoinconnees * tauxHoraireClient;
          const margeJour = revenuJour - coutJour;
          // Ratio de présence : (heures facturables + heures internes) ÷ heures
          // travaillées de la journée (réelles si entrées, sinon prévues). Null
          // si aucune heure ce jour-là.
          const ratioPresence = heuresJour > 0 ? ((heuresPoinconnees + heuresInternes) / heuresJour) * 100 : null;
          const couleurRatio = ratioPresence === null ? "var(--text-muted)"
            : ratioPresence >= 90 ? "var(--success)"
            : ratioPresence >= 75 ? "#C9A227"
            : "var(--danger)";

          return (
            <div key={employe.id} className="carte carte-m">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{employe.nom}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{fmtHeures(heuresPoinconnees)} facturables{heuresInternes > 0 ? ` + ${fmtHeures(heuresInternes)} internes` : ""} / {fmtHeures(heuresJour)}</div>
                </div>
                <div
                  title="Ratio de présence : (heures facturables + tâches internes) ÷ heures travaillées de la journée"
                  style={{ textAlign: "right", whiteSpace: "nowrap" }}
                >
                  <div style={{ fontSize: 20, fontWeight: 800, color: couleurRatio, lineHeight: 1.1 }}>
                    {ratioPresence === null ? "—" : `${Math.round(ratioPresence)} %`}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Présence</div>
                </div>
              </div>

              {tempsNonPoinconne > 0.05 && (
                <div style={{ fontSize: 11, color: "#C9A227", marginTop: 2 }}>
                  ⚠ {fmtHeures(tempsNonPoinconne)} non poinçonnées du tout — coûte {argent((tempsNonPoinconne * coutHoraire))} sans revenu associé
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 12, marginTop: 8, paddingTop: 8, borderTop: "1px dashed var(--border)" }}>
                <span style={{ color: "var(--text-muted)" }}>
                  Coût du jour ({fmtHeures(heuresJour)} × {argent(coutHoraire)})
                  {heuresReelles !== null && <span title={`Heures prévues : ${heuresAttendues}h`}> · heures réelles</span>}
                  {editionHeures !== employe.id && (
                    <button onClick={() => setEditionHeures(employe.id)} title="Modifier les heures travaillées de la journée" style={{ ...boutonPetit, marginLeft: 6 }}>✏️</button>
                  )}
                </span>
                <span>{argent(coutJour)}</span>
              </div>
              {editeur}
              {heuresInternes > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)" }}>
                  <span>dont tâches internes ({fmtHeures(heuresInternes)} × {argent(coutHoraire)})</span>
                  <span>{argent(coutInternes)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: "var(--text-muted)" }}>Revenu généré ({fmtHeures(heuresPoinconnees)} × {argent(tauxHoraireClient)})</span>
                <span>{argent(revenuJour)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
                <span>Marge</span>
                <span style={{ color: margeJour >= 0 ? "var(--success)" : "var(--danger)" }}>{argent(margeJour)}</span>
              </div>

              {(entrees.length > 0 || entreesInternes.length > 0) && <FriseHoraire entrees={entrees} entreesInternes={entreesInternes} couleurs={couleurs} heuresOuverture={heuresOuverture} />}

              {(entrees.length > 0 || entreesInternes.length > 0) && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                  {entrees.map((e) => {
                    const debut = new Date(e.debut);
                    const heureDebut = debut.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
                    const heureFin = e.fin ? new Date(e.fin).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" }) : "en cours";
                    const duree = e.fin ? (new Date(e.fin) - debut) / 3600000 : null;
                    return (
                      <Link
                        key={e.id}
                        href={`/bons/${e.probleme.bon.id}`}
                        title={`Ouvrir le bon #${e.probleme.bon.numero}`}
                        style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, background: "var(--bg)", borderRadius: 6, padding: "6px 8px", textDecoration: "none", color: "inherit" }}
                      >
                        <div>
                          <div><strong style={{ color: "var(--text-muted)" }}>{numeroTache(e)}.</strong> {e.probleme.description}</div>
                          <div style={{ color: "var(--text-muted)", fontSize: 10.5 }}>
                            #{e.probleme.bon.numero} · {e.probleme.bon.client.nom} · {heureDebut}–{heureFin}
                          </div>
                        </div>
                        <span style={{ fontWeight: 600, alignSelf: "center", whiteSpace: "nowrap", color: e.fin ? "var(--text)" : "var(--accent)" }}>
                          {duree !== null ? fmtHeures(duree) : "●"} <span style={{ color: "var(--text-muted)" }}>›</span>
                        </span>
                      </Link>
                    );
                  })}
                  {entreesInternes.map((e) => (
                    <LigneTacheInterne key={`${e.id}-${e.debut}-${e.fin}`} e={e} coutHoraire={coutHoraire} onModifie={() => router.refresh()} />
                  ))}
                </div>
              )}
              <div style={{ marginTop: 8 }}>{boutonAjout}</div>
              {ajout}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function decaler(dateStr, jours) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + jours);
  // Construit la date à partir des valeurs LOCALES (pas toISOString, qui
  // reconvertit toujours en UTC et peut décaler d'un jour en soirée)
  const an = d.getFullYear();
  const mois = String(d.getMonth() + 1).padStart(2, "0");
  const jour = String(d.getDate()).padStart(2, "0");
  return `${an}-${mois}-${jour}`;
}

const boutonJour = {
  fontSize: 12, fontWeight: 600, padding: "8px 10px", borderRadius: 8, whiteSpace: "nowrap",
  background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)", cursor: "pointer",
};
