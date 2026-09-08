"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import BandeauSection from "../../components/BandeauSection";

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

const DEBUT_ECHELLE = 6; // 6h
const FIN_ECHELLE = 19; // 19h
const PORTEE = FIN_ECHELLE - DEBUT_ECHELLE;

function pourcentagePourHeure(date) {
  const h = date.getHours() + date.getMinutes() / 60;
  return Math.min(100, Math.max(0, ((h - DEBUT_ECHELLE) / PORTEE) * 100));
}

function FriseHoraire({ entrees, entreesInternes, couleurs }) {
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
        {Array.from({ length: PORTEE + 1 }, (_, i) => DEBUT_ECHELLE + i).map((h) => (
          <div key={h} style={{ position: "absolute", left: `${((h - DEBUT_ECHELLE) / PORTEE) * 100}%`, top: 0, bottom: 0, width: 1, background: "var(--border)" }} />
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
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>
        <span>{DEBUT_ECHELLE}h</span>
        <span>{Math.round((DEBUT_ECHELLE + FIN_ECHELLE) / 2)}h</span>
        <span>{FIN_ECHELLE}h</span>
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

export default function RapportsClient({ dateStr, parMecanicien, heuresAttendues, coutHoraire, tauxHoraireClient }) {
  const router = useRouter();

  function changerDate(nouvelleDate) {
    router.push(`/gerant/rapports?date=${nouvelleDate}`);
  }

  const dateAfficheeBrute = new Date(`${dateStr}T12:00:00`).toLocaleDateString("fr-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const dateAffichee = dateAfficheeBrute.charAt(0).toUpperCase() + dateAfficheeBrute.slice(1);

  // Coût : sur les heures PRÉVUES, mais seulement pour les employés PRÉSENTS
  // (au moins un poinçon démarré ce jour-là) — un employé absent (aucun
  // poinçon) ne coûte rien dans ce calcul, pour ne pas fausser les chiffres
  // en cas de maladie, congé, etc.
  // Revenu : seulement sur les heures RÉELLEMENT poinçonnées (facturables)
  const presents = parMecanicien.filter((m) => m.entrees.length > 0 || m.entreesInternes.length > 0);
  const totalCoutEquipe = presents.length * heuresAttendues * coutHoraire;
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

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <button onClick={() => changerDate(decaler(dateStr, -1))} style={boutonJour}>← Veille</button>
        <input
          type="date"
          value={dateStr}
          onChange={(e) => changerDate(e.target.value)}
          style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 13 }}
        />
        <button onClick={() => changerDate(decaler(dateStr, 1))} style={boutonJour}>Lendemain →</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--danger)" }}>{totalCoutEquipe.toFixed(2)} $</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Coût (heures prévues)</div>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--success)" }}>{totalRevenuEquipe.toFixed(2)} $</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Revenu (heures poinçonnées)</div>
        </div>
      </div>
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Marge du jour (équipe)</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: margeEquipe >= 0 ? "var(--success)" : "var(--danger)" }}>{margeEquipe.toFixed(2)} $</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {parMecanicien.map(({ employe, entrees, entreesInternes, heuresPoinconnees, heuresInternes }) => {
          const absent = entrees.length === 0 && entreesInternes.length === 0;

          if (absent) {
            return (
              <div key={employe.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14, opacity: 0.6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600 }}>{employe.nom}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Absent — aucun poinçon</span>
                </div>
              </div>
            );
          }

          const tempsNonPoinconne = Math.max(0, heuresAttendues - heuresPoinconnees - heuresInternes);
          const coutJour = heuresAttendues * coutHoraire;
          const revenuJour = heuresPoinconnees * tauxHoraireClient;
          const margeJour = revenuJour - coutJour;

          return (
            <div key={employe.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600 }}>{employe.nom}</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{fmtHeures(heuresPoinconnees)} facturables{heuresInternes > 0 ? ` + ${fmtHeures(heuresInternes)} internes` : ""} / {heuresAttendues}h</span>
              </div>

              {tempsNonPoinconne > 0.05 && (
                <div style={{ fontSize: 11, color: "#C9A227", marginTop: 2 }}>
                  ⚠ {fmtHeures(tempsNonPoinconne)} non poinçonnées du tout — coûte {(tempsNonPoinconne * coutHoraire).toFixed(2)} $ sans revenu associé
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 8, paddingTop: 8, borderTop: "1px dashed var(--border)" }}>
                <span style={{ color: "var(--text-muted)" }}>Coût du jour ({heuresAttendues}h × {coutHoraire.toFixed(2)} $)</span>
                <span>{coutJour.toFixed(2)} $</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: "var(--text-muted)" }}>Revenu généré ({fmtHeures(heuresPoinconnees)} × {tauxHoraireClient.toFixed(2)} $)</span>
                <span>{revenuJour.toFixed(2)} $</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
                <span>Marge</span>
                <span style={{ color: margeJour >= 0 ? "var(--success)" : "var(--danger)" }}>{margeJour.toFixed(2)} $</span>
              </div>

              {(entrees.length > 0 || entreesInternes.length > 0) && <FriseHoraire entrees={entrees} entreesInternes={entreesInternes} couleurs={couleurs} />}

              {(entrees.length > 0 || entreesInternes.length > 0) && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                  {entrees.map((e) => {
                    const debut = new Date(e.debut);
                    const heureDebut = debut.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
                    const heureFin = e.fin ? new Date(e.fin).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" }) : "en cours";
                    const duree = e.fin ? (new Date(e.fin) - debut) / 3600000 : null;
                    return (
                      <div key={e.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, background: "var(--bg)", borderRadius: 6, padding: "6px 8px" }}>
                        <div>
                          <div><strong style={{ color: "var(--text-muted)" }}>{numeroTache(e)}.</strong> {e.probleme.description}</div>
                          <div style={{ color: "var(--text-muted)", fontSize: 10.5 }}>
                            #{e.probleme.bon.numero} · {e.probleme.bon.client.nom} · {heureDebut}–{heureFin}
                          </div>
                        </div>
                        <span style={{ fontWeight: 600, alignSelf: "center", color: e.fin ? "var(--text)" : "var(--accent)" }}>
                          {duree !== null ? fmtHeures(duree) : "●"}
                        </span>
                      </div>
                    );
                  })}
                  {entreesInternes.map((e) => {
                    const debut = new Date(e.debut);
                    const heureDebut = debut.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
                    const heureFin = e.fin ? new Date(e.fin).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" }) : "en cours";
                    const duree = e.fin ? (new Date(e.fin) - debut) / 3600000 : null;
                    return (
                      <div key={e.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, background: "var(--bg)", borderRadius: 6, padding: "6px 8px", opacity: 0.85 }}>
                        <div>
                          <div>🛠️ {e.tacheInterne.nom} <span style={{ color: "var(--text-muted)", fontSize: 10 }}>(interne, non facturable)</span></div>
                          <div style={{ color: "var(--text-muted)", fontSize: 10.5 }}>{heureDebut}–{heureFin}</div>
                        </div>
                        <span style={{ fontWeight: 600, alignSelf: "center", color: e.fin ? "var(--text)" : "var(--accent)" }}>
                          {duree !== null ? fmtHeures(duree) : "●"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
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
