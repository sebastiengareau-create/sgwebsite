"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const JOURS = [
  { cle: "lun", label: "Lundi" },
  { cle: "mar", label: "Mardi" },
  { cle: "mer", label: "Mercredi" },
  { cle: "jeu", label: "Jeudi" },
  { cle: "ven", label: "Vendredi" },
  { cle: "sam", label: "Samedi" },
  { cle: "dim", label: "Dimanche" },
];

export default function ParametresClient({
  tauxHoraireInit, coutHoraireInit, horaireInit,
  tpsNumeroInit, tpsTauxInit, tvqNumeroInit, tvqTauxInit,
  quickbooksConnecte, urlFluxCalendrier,
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qbErreur = searchParams.get("qb_erreur");
  const qbConnecte = searchParams.get("qb_connecte");
  const [deconnexionEnCours, setDeconnexionEnCours] = useState(false);
  const [urlFlux, setUrlFlux] = useState(urlFluxCalendrier);
  const [copie, setCopie] = useState(false);
  const [regenerationEnCours, setRegenerationEnCours] = useState(false);

  async function deconnecterQuickbooks() {
    if (!window.confirm("Déconnecter QuickBooks ? Il faudra refaire l'autorisation pour reconnecter.")) return;
    setDeconnexionEnCours(true);
    await fetch("/api/quickbooks/deconnecter", { method: "POST" });
    setDeconnexionEnCours(false);
    router.refresh();
  }

  function copierUrlFlux() {
    navigator.clipboard.writeText(urlFlux);
    setCopie(true);
    setTimeout(() => setCopie(false), 2000);
  }

  async function regenererFlux() {
    if (!window.confirm("Régénérer le lien ? L'ancien lien cessera de fonctionner — il faudra le remettre à jour dans Outlook.")) return;
    setRegenerationEnCours(true);
    const res = await fetch("/api/calendrier/flux/regenerer", { method: "POST" });
    const { cle } = await res.json();
    const base = urlFlux.split("?")[0];
    setUrlFlux(`${base}?cle=${cle}`);
    setRegenerationEnCours(false);
  }


  const [tauxHoraire, setTauxHoraire] = useState(tauxHoraireInit);
  const [coutHoraire, setCoutHoraire] = useState(coutHoraireInit);
  const [horaire, setHoraire] = useState(horaireInit);
  const [tpsNumero, setTpsNumero] = useState(tpsNumeroInit);
  const [tpsTaux, setTpsTaux] = useState(tpsTauxInit);
  const [tvqNumero, setTvqNumero] = useState(tvqNumeroInit);
  const [tvqTaux, setTvqTaux] = useState(tvqTauxInit);
  const [enCours, setEnCours] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState("");

  const marge = (Number(tauxHoraire) || 0) - (Number(coutHoraire) || 0);
  const totalHeuresSemaine = Object.values(horaire).reduce((s, h) => s + (Number(h) || 0), 0);

  function changerJour(cle, valeur) {
    setHoraire((prev) => ({ ...prev, [cle]: valeur }));
  }

  async function sauvegarder(e) {
    e.preventDefault();
    setErreur("");
    setConfirmation("");
    setEnCours(true);
    const res = await fetch("/api/parametres", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taux_horaire_client: tauxHoraire,
        cout_horaire_mecanicien: coutHoraire,
        heures_lun: horaire.lun,
        heures_mar: horaire.mar,
        heures_mer: horaire.mer,
        heures_jeu: horaire.jeu,
        heures_ven: horaire.ven,
        heures_sam: horaire.sam,
        heures_dim: horaire.dim,
        tps_numero: tpsNumero,
        tps_taux: tpsTaux,
        tvq_numero: tvqNumero,
        tvq_taux: tvqTaux,
      }),
    });
    setEnCours(false);
    if (!res.ok) {
      setErreur("Erreur lors de la sauvegarde.");
      return;
    }
    setConfirmation("Sauvegardé ✓");
    router.refresh();
    setTimeout(() => setConfirmation(""), 2500);
  }

  return (
    <div className="conteneur-page">
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Paramètres</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>
        Valeurs clés utilisées dans tout le logiciel.
      </p>

      <form onSubmit={sauvegarder} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
        <label style={labelStyle}>Taux horaire facturé au client ($/h)</label>
        <p style={sousTexte}>Utilisé pour calculer le revenu de main-d'œuvre sur les bons de travail.</p>
        <ChampMontant valeur={tauxHoraire} onChange={setTauxHoraire} />

        <label style={{ ...labelStyle, marginTop: 18 }}>Coûtant horaire des mécaniciens ($/h)</label>
        <p style={sousTexte}>Ce que ça coûte réellement au garage — avantages inclus — peu importe si l'heure est facturable ou non.</p>
        <ChampMontant valeur={coutHoraire} onChange={setCoutHoraire} />

        <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: "var(--bg)", display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <span style={{ color: "var(--text-muted)" }}>Marge par heure réellement facturée</span>
          <span style={{ fontWeight: 700, color: marge >= 0 ? "var(--success)" : "var(--danger)" }}>{marge.toFixed(2)} $</span>
        </div>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>Horaire de travail attendu</div>
          <p style={sousTexte}>Heures prévues par jour — sert de référence dans le rapport journalier pour comparer au temps réellement poinçonné. Le coûtant s'applique à ces heures prévues, poinçonnées ou non.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {JOURS.map((j) => (
              <div key={j.cle} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 13, width: 90 }}>{j.label}</span>
                <input
                  type="number" min={0} step="0.5"
                  value={horaire[j.cle]}
                  onChange={(e) => changerJour(j.cle, e.target.value)}
                  style={{ ...champInput, width: 70, textAlign: "center" }}
                />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>h</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)", textAlign: "right" }}>
            Total semaine : <strong style={{ color: "var(--text)" }}>{totalHeuresSemaine}h</strong>
          </div>
        </div>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>Numéros de taxes</div>

          <label style={labelStyle}>Numéro TPS</label>
          <input value={tpsNumero} onChange={(e) => setTpsNumero(e.target.value)} placeholder="Ex : 784958142RT0001" style={{ ...champInput, fontFamily: "monospace" }} />

          <label style={{ ...labelStyle, marginTop: 10 }}>Taux TPS (%)</label>
          <input type="number" min={0} step="0.001" value={tpsTaux} onChange={(e) => setTpsTaux(e.target.value)} style={champInput} />

          <label style={{ ...labelStyle, marginTop: 14 }}>Numéro TVQ</label>
          <input value={tvqNumero} onChange={(e) => setTvqNumero(e.target.value)} placeholder="Ex : 1228169010TQ0001" style={{ ...champInput, fontFamily: "monospace" }} />

          <label style={{ ...labelStyle, marginTop: 10 }}>Taux TVQ (%)</label>
          <input type="number" min={0} step="0.001" value={tvqTaux} onChange={(e) => setTvqTaux(e.target.value)} style={champInput} />
        </div>

        {erreur && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 10 }}>{erreur}</p>}
        {confirmation && <p style={{ color: "var(--success)", fontSize: 12, marginTop: 10 }}>{confirmation}</p>}

        <button
          type="submit" disabled={enCours}
          style={{ width: "100%", marginTop: 16, padding: 10, borderRadius: 8, border: "none", background: "var(--accent)", color: "#17150f", fontWeight: 700, cursor: "pointer" }}
        >
          {enCours ? "Sauvegarde…" : "Sauvegarder"}
        </button>
      </form>

      <div style={{ marginTop: 20, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>QuickBooks</div>

        {qbConnecte && <p style={{ color: "var(--success)", fontSize: 12, marginBottom: 10 }}>Connexion réussie ✓</p>}
        {qbErreur && <p style={{ color: "var(--danger)", fontSize: 12, marginBottom: 10 }}>Erreur de connexion : {qbErreur}</p>}

        {quickbooksConnecte ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--success)" }} />
              <span style={{ fontSize: 13 }}>QuickBooks est connecté</span>
            </div>
            <button
              onClick={deconnecterQuickbooks}
              disabled={deconnexionEnCours}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--border)", background: "none", color: "var(--danger)", fontWeight: 600, cursor: "pointer", fontSize: 13 }}
            >
              {deconnexionEnCours ? "Déconnexion…" : "Déconnecter QuickBooks"}
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
              Pas encore connecté — la synchronisation de l'inventaire et des clients sera possible une fois relié.
            </p>
            <a
              href="/api/quickbooks/connect"
              style={{ display: "block", textAlign: "center", padding: 10, borderRadius: 8, background: "var(--accent)", color: "#17150f", fontWeight: 700, fontSize: 13, textDecoration: "none" }}
            >
              Connecter QuickBooks
            </a>
          </>
        )}
      </div>

      <div style={{ marginTop: 20, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>Synchronisation Outlook / Google Calendar</div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
          Ajoute cette adresse une seule fois comme "calendrier abonné" — les rendez-vous se mettent à jour
          automatiquement par la suite (environ une fois par heure), sans rien faire de plus.
        </p>

        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <input
            readOnly value={urlFlux}
            onFocus={(e) => e.target.select()}
            style={{ flex: 1, padding: "9px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text-muted)", fontSize: 11, fontFamily: "monospace" }}
          />
          <button
            onClick={copierUrlFlux}
            className="bouton-3d"
            style={{ padding: "9px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}
          >
            {copie ? "Copié ✓" : "Copier"}
          </button>
        </div>

        <details style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 12 }}>
          <summary style={{ cursor: "pointer", color: "var(--accent)" }}>Comment l'ajouter dans Outlook</summary>
          <p style={{ marginTop: 6, lineHeight: 1.5 }}>
            Outlook.com → Calendrier → Ajouter un calendrier → S'abonner à partir du web → colle l'adresse
            copiée ci-dessus → Importer. Dans Outlook (application de bureau), c'est sous
            Fichier → Paramètres du compte → Calendriers Internet → Nouveau.
          </p>
        </details>

        <button
          onClick={regenererFlux}
          disabled={regenerationEnCours}
          style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px dashed var(--danger)", background: "none", color: "var(--danger)", fontWeight: 600, cursor: "pointer", fontSize: 12 }}
        >
          {regenerationEnCours ? "Régénération…" : "🔄 Régénérer le lien (si compromis)"}
        </button>
      </div>

      <Link
        href="/gerant/administrateur/sauvegarde"
        className="bouton-3d-sombre"
        style={{ display: "block", textAlign: "center", marginTop: 20, padding: 14, borderRadius: 10, textDecoration: "none", fontSize: 13, fontWeight: 700 }}
      >
        💾 Sauvegarde des données
      </Link>
    </div>
  );
}

function ChampMontant({ valeur, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 16, color: "var(--text-muted)" }}>$</span>
      <input type="number" min={0} step="0.01" required value={valeur} onChange={(e) => onChange(e.target.value)} style={{ ...champInput, fontSize: 16, fontWeight: 700 }} />
      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>/h</span>
    </div>
  );
}

const labelStyle = { fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 };
const sousTexte = { fontSize: 11.5, color: "var(--text-muted)", marginBottom: 8 };
const champInput = {
  flex: 1, width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border)",
  background: "var(--bg)", color: "var(--text)", fontSize: 14, boxSizing: "border-box",
};
