"use client";

import { useState } from "react";
import { ETATS_POINT } from "@/lib/grillesInspection";

const FUSEAU = "America/Toronto";
const DATE = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "long", year: "numeric", timeZone: FUSEAU });
const QUAND = new Intl.DateTimeFormat("fr-CA", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: FUSEAU });
const argent = (n) => Number(n || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
const date = (iso) => (iso ? DATE.format(new Date(iso)) : "");
const STATUTS_BON = { EN_ATTENTE: "Prévu", EN_COURS: "En cours" };

const carte = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 16, marginBottom: 14 };
const titre = { fontSize: 16, fontWeight: 800, margin: "0 0 10px" };
const ligne = { padding: "10px 0", borderTop: "1px solid var(--border)" };
const discret = { fontSize: 12.5, color: "var(--text-muted)" };
const boutonPlein = { display: "inline-block", padding: "9px 14px", borderRadius: 10, fontSize: 13.5, fontWeight: 700, textDecoration: "none", background: "var(--accent)", color: "#221f18" };
const boutonContour = { display: "inline-block", padding: "8px 12px", borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: "none", border: "1px solid var(--border)", color: "var(--text)" };

// Le dossier du client : d'abord ce qui demande son attention, puis ses
// travaux, rendez-vous, véhicules, factures et coordonnées
export default function PortailVue({ jeton, donnees: d, telephone, lienRendezVous }) {
  const prenom = String(d.client.nom || "").trim().split(/\s+/)[0];
  const soumissionsARepondre = d.soumissions.filter((s) => s.aRepondre);
  const inspectionsARepondre = d.inspections.filter((i) => i.aRepondre);
  const rienAFaire = d.aPayer.length === 0 && soumissionsARepondre.length === 0 && inspectionsARepondre.length === 0;
  const totalDu = d.aPayer.reduce((s, f) => s + f.solde, 0);

  return (
    <div>
      <h1 style={{ fontSize: 22, margin: "0 0 4px" }}>Bonjour {prenom}</h1>
      <p style={{ ...discret, margin: "0 0 16px" }}>Votre dossier, à jour en tout temps. Ce lien vous est personnel : ne le partagez pas.</p>

      <section style={{ ...carte, borderColor: rienAFaire ? "var(--border)" : "var(--accent)" }} aria-labelledby="a-faire">
        <h2 id="a-faire" style={titre}>{rienAFaire ? "Rien à faire pour l'instant ✓" : "À faire"}</h2>
        {d.aPayer.length > 0 && (
          <div>
            <div style={{ fontSize: 14, marginBottom: 6 }}>Solde à payer : <b>{argent(totalDu)}</b></div>
            {d.aPayer.map((f) => (
              <div key={f.id} style={ligne}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                  <b style={{ flex: 1, minWidth: 0 }}>Facture {f.numero}</b>
                  <b style={{ fontVariantNumeric: "tabular-nums" }}>{argent(f.solde)}</b>
                </div>
                <div style={discret}>{date(f.date)}{f.vehicule ? ` · ${f.vehicule}` : ""}{f.solde < f.total - 0.005 ? ` · total ${argent(f.total)}` : ""}</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  {f.lienPaiement && <a href={f.lienPaiement} style={boutonPlein}>Payer en ligne</a>}
                  <a href={`/api/portail-client/${jeton}/factures/${f.id}`} target="_blank" rel="noopener noreferrer" style={boutonContour}>Voir la facture (PDF)</a>
                </div>
              </div>
            ))}
          </div>
        )}
        {soumissionsARepondre.map((s) => (
          <div key={s.id} style={ligne}>
            <b>Soumission {s.numero}</b> — en attente de votre réponse
            <div style={discret}>{date(s.date)}{s.vehicule ? ` · ${s.vehicule}` : ""}</div>
            <a href={s.lien} style={{ ...boutonPlein, marginTop: 8 }}>Consulter et répondre</a>
          </div>
        ))}
        {inspectionsARepondre.map((i) => (
          <div key={i.id} style={ligne}>
            <b>Rapport d&apos;inspection</b> — travaux recommandés à approuver
            <div style={discret}>{date(i.date)}{i.vehicule ? ` · ${i.vehicule}` : ""}</div>
            <a href={i.lien} style={{ ...boutonPlein, marginTop: 8 }}>Voir le rapport</a>
          </div>
        ))}
      </section>

      {d.enCours.length > 0 && (
        <section style={carte} aria-labelledby="en-cours">
          <h2 id="en-cours" style={titre}>Travaux en cours</h2>
          {d.enCours.map((b, n) => (
            <div key={b.id} style={{ ...ligne, ...(n === 0 && { borderTop: "none", paddingTop: 0 }) }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                <b style={{ flex: 1, minWidth: 0 }}>{b.vehicule || `Bon ${b.numero}`}</b>
                <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "var(--surface-alt)" }}>{STATUTS_BON[b.statut] || b.statut}</span>
              </div>
              <div style={discret}>Bon {b.numero} · {date(b.date)}</div>
              {b.taches.length > 0 && <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13.5 }}>{b.taches.map((t, i) => <li key={i}>{t}</li>)}</ul>}
            </div>
          ))}
        </section>
      )}

      <section style={carte} aria-labelledby="rendez-vous">
        <h2 id="rendez-vous" style={titre}>Rendez-vous</h2>
        {d.rendezVous.length === 0 ? (
          <p style={{ ...discret, margin: 0 }}>Aucun rendez-vous à venir.</p>
        ) : d.rendezVous.map((r, n) => (
          <div key={r.id} style={{ ...ligne, ...(n === 0 && { borderTop: "none", paddingTop: 0 }) }}>
            <b style={{ textTransform: "capitalize" }}>{QUAND.format(new Date(r.date))}</b>
            <div style={discret}>{[r.motif, r.vehicule].filter(Boolean).join(" · ")}</div>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
          {lienRendezVous && <a href={lienRendezVous} target="_blank" rel="noopener noreferrer" style={boutonContour}>Prendre rendez-vous</a>}
          {telephone && <span style={discret}>Pour déplacer un rendez-vous : <a href={`tel:${telephone.replace(/[^\d+]/g, "")}`} style={{ color: "var(--text)" }}>{telephone}</a></span>}
        </div>
      </section>

      {d.vehicules.length > 0 && (
        <section style={carte} aria-labelledby="vehicules">
          <h2 id="vehicules" style={titre}>Mes véhicules</h2>
          {d.vehicules.map((v, n) => (
            <div key={v.id} style={{ ...ligne, ...(n === 0 && { borderTop: "none", paddingTop: 0 }) }}>
              <b>{v.libelle}</b>
              <div style={discret}>
                {[v.plaque && `Plaque ${v.plaque}`, v.kilometrage && `${v.kilometrage.toLocaleString("fr-CA")} km`, v.derniereVisite && `Dernière visite le ${date(v.derniereVisite)}`].filter(Boolean).join(" · ")}
              </div>
              {v.aSurveiller.length > 0 && (
                <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 10, background: "var(--avertissement-fond)" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--avertissement)" }}>À surveiller, noté à la dernière inspection</div>
                  <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 13 }}>
                    {v.aSurveiller.map((p, i) => <li key={i}>{p.libelle} — {ETATS_POINT[p.etat]?.libelleClient || p.etat}{p.recommandation ? ` : ${p.recommandation}` : ""}</li>)}
                  </ul>
                </div>
              )}
              {v.pneus.length > 0 && (
                <div style={{ ...discret, marginTop: 6 }}>
                  🛞 {v.pneus.map((j) => `${j.libelle} (${j.statut === "ENTREPOSE" ? "entreposés chez nous" : "sur le véhicule"})`).join(" · ")}
                </div>
              )}
            </div>
          ))}
          {d.pneusSansVehicule.length > 0 && (
            <div style={{ ...discret, ...ligne }}>🛞 Pneus entreposés chez nous : {d.pneusSansVehicule.map((j) => j.libelle).join(" · ")}</div>
          )}
        </section>
      )}

      <section style={carte} aria-labelledby="factures">
        <h2 id="factures" style={titre}>Factures</h2>
        {d.factures.length === 0 ? (
          <p style={{ ...discret, margin: 0 }}>Aucune facture pour l&apos;instant.</p>
        ) : d.factures.map((f, n) => (
          <a key={f.id} href={`/api/portail-client/${jeton}/factures/${f.id}`} target="_blank" rel="noopener noreferrer" style={{ display: "flex", gap: 10, alignItems: "center", textDecoration: "none", color: "var(--text)", ...ligne, ...(n === 0 && { borderTop: "none", paddingTop: 0 }) }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <b>Facture {f.numero}</b>
              <span style={{ ...discret, display: "block" }}>{date(f.date)}{f.vehicule ? ` · ${f.vehicule}` : ""}</span>
            </span>
            <span style={{ textAlign: "right" }}>
              <b style={{ fontVariantNumeric: "tabular-nums" }}>{argent(f.total)}</b>
              <span style={{ display: "block", fontSize: 12, color: f.payee ? "var(--success)" : "var(--avertissement)" }}>{f.payee ? "Payée" : `Solde ${argent(f.solde)}`}</span>
            </span>
            <span aria-hidden style={{ color: "var(--text-muted)" }}>PDF ↗</span>
          </a>
        ))}
      </section>

      {d.inspections.length > 0 && (
        <section style={carte} aria-labelledby="inspections">
          <h2 id="inspections" style={titre}>Rapports d&apos;inspection</h2>
          {d.inspections.map((i, n) => (
            <a key={i.id} href={i.lien} style={{ display: "block", textDecoration: "none", color: "var(--text)", ...ligne, ...(n === 0 && { borderTop: "none", paddingTop: 0 }) }}>
              <b>{i.titre || "Inspection"}</b>
              <span style={{ ...discret, display: "block" }}>{date(i.date)}{i.vehicule ? ` · ${i.vehicule}` : ""}</span>
            </a>
          ))}
        </section>
      )}

      <Coordonnees jeton={jeton} client={d.client} telephone={telephone} />
    </div>
  );
}

function Coordonnees({ jeton, client, telephone }) {
  const [promotions, setPromotions] = useState(client.promotions);
  const [message, setMessage] = useState(null);

  async function changer(valeur) {
    setPromotions(valeur);
    setMessage(null);
    const res = await fetch(`/api/portail-client/${jeton}/preferences`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ promotions: valeur }) }).catch(() => null);
    if (!res?.ok) {
      setPromotions(!valeur);
      setMessage({ texte: "Votre choix n'a pas été enregistré. Réessayez.", erreur: true });
      return;
    }
    setMessage({ texte: "Votre choix est enregistré." });
  }

  return (
    <section style={carte} aria-labelledby="coordonnees">
      <h2 id="coordonnees" style={titre}>Mes coordonnées</h2>
      <div style={{ fontSize: 14, lineHeight: 1.6 }}>
        <div>{client.nom}</div>
        {client.telephone && <div>{client.telephone}</div>}
        {client.courriel && <div>{client.courriel}</div>}
        {(client.adresse || client.ville) && <div>{[client.adresse, client.ville].filter(Boolean).join(", ")}</div>}
      </div>
      <p style={{ ...discret, margin: "6px 0 12px" }}>Une correction ? {telephone ? `Appelez-nous au ${telephone}.` : "Communiquez avec nous."}</p>
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, cursor: "pointer" }}>
        <input type="checkbox" checked={promotions} onChange={(e) => changer(e.target.checked)} style={{ width: 18, height: 18, marginTop: 1, flexShrink: 0 }} />
        <span>Recevoir par courriel les rappels d&apos;entretien et nos promotions</span>
      </label>
      {message && <p role={message.erreur ? "alert" : "status"} style={{ fontSize: 12.5, margin: "6px 0 0", color: message.erreur ? "var(--danger)" : "var(--success)" }}>{message.texte}</p>}
    </section>
  );
}
