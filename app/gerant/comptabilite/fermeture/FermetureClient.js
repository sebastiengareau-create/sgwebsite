"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BandeauSection from "../../../components/BandeauSection";
import { Icone, TEINTES, TitrePanneau, stylePanneau, BoutonContour, TitreGroupe, Pastille } from "../../../components/StyleSection";

const NOMS_MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const STATUT_INFO = {
  OUVERTE: { icone: "🟢", label: "Ouverte", couleur: "var(--success)", fond: "var(--success-fond)" },
  VERROUILLEE: { icone: "🟡", label: "Verrouillée", couleur: "var(--avertissement)", fond: "var(--avertissement-fond)" },
  FERMEE: { icone: "🔴", label: "Fermée", couleur: "var(--danger)", fond: "var(--danger-fond)" },
};

const TRIMESTRES = [
  { label: "T1 (jan-mars)", mois: [1, 2, 3] },
  { label: "T2 (avr-juin)", mois: [4, 5, 6] },
  { label: "T3 (juil-sept)", mois: [7, 8, 9] },
  { label: "T4 (oct-déc)", mois: [10, 11, 12] },
];

export default function FermetureClient({ periodes, annee }) {
  const router = useRouter();
  const [enCours, setEnCours] = useState(false);
  const [rapport, setRapport] = useState("");

  async function fermerPlage(moisListe, label) {
    if (!window.confirm(`Fermer ${label} ${annee} ? Chaque mois sera fermé un à la suite de l'autre.`)) return;
    setEnCours(true);
    setRapport("");
    const resultats = [];
    for (const mois of moisListe) {
      const res = await fetch(`/api/comptabilite/periodes/${annee}/${mois}/fermer`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      resultats.push(`${NOMS_MOIS[mois - 1]} : ${res.ok ? "✅ Fermé" : `❌ ${data.erreur || "Erreur"}`}`);
    }
    setEnCours(false);
    setRapport(resultats.join("\n"));
    router.refresh();
  }

  const compte = (statut) => periodes.filter((p) => p.statut === statut).length;

  return (
    <div className="conteneur-page">
      <Link href="/gerant/comptabilite" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à la comptabilité</Link>
      <div style={{ marginTop: 8 }}>
        <BandeauSection icone="🔒" titre="Fermeture de période" sousTitre="Ferme les livres d'un mois pour empêcher toute modification accidentelle une fois vérifié." />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <BoutonContour href="/gerant/comptabilite/procedure" icone="presse" style={boutonEgal}>Procédure de fermeture</BoutonContour>
        <BoutonContour href="/gerant/comptabilite/fermeture/historique" icone="livre" style={boutonEgal}>Journal des fermetures</BoutonContour>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, padding: 6, borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)" }}>
        <Link href={`/gerant/comptabilite/fermeture?annee=${annee - 1}`} aria-label="Année précédente" style={boutonAnnee}>
          <Icone nom="chevronGauche" taille={18} /> {annee - 1}
        </Link>
        <span style={{ fontSize: 20, fontWeight: 800, flex: 1, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{annee}</span>
        <Link href={`/gerant/comptabilite/fermeture?annee=${annee + 1}`} aria-label="Année suivante" style={boutonAnnee}>
          {annee + 1} <Icone nom="chevron" taille={18} />
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
        {Object.entries(STATUT_INFO).map(([cle, info]) => (
          <div key={cle} style={{ position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "10px 10px 10px 14px" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: info.couleur }} />
            <div style={{ fontSize: 22, fontWeight: 800, color: info.couleur }}>{compte(cle)}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{info.label}{compte(cle) > 1 ? "s" : ""}</div>
          </div>
        ))}
      </div>

      <TitreGroupe couleur="var(--accent)">Mois de {annee}</TitreGroupe>
      {/* 3 colonnes sur ordinateur, 2 sur cellulaire : 12 mois = rangées complètes */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(max(140px, 30%), 1fr))", gap: 8, marginBottom: 24 }}>
        {periodes.map((p) => {
          const info = STATUT_INFO[p.statut];
          return (
            <Link key={p.mois} href={`/gerant/comptabilite/fermeture/${annee}/${p.mois}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{ position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "12px 12px 12px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: info.couleur }} />
                <span style={{ fontSize: 15, fontWeight: 700 }}>{NOMS_MOIS[p.mois - 1]}</span>
                <span><Pastille couleur={info.couleur} fond={info.fond}>{info.label}</Pastille></span>
              </div>
            </Link>
          );
        })}
      </div>

      <div style={stylePanneau}>
        <TitrePanneau icone="cadenas" teinte={TEINTES.rouge} titre="Fermer une plage" sousTitre="Chaque mois est fermé un à la suite de l'autre" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, marginBottom: 8 }}>
          {TRIMESTRES.map((t) => (
            <button key={t.label} onClick={() => fermerPlage(t.mois, t.label)} disabled={enCours} style={boutonPlage}>
              Fermer {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => fermerPlage(Array.from({ length: 12 }, (_, i) => i + 1), `l'année`)}
          disabled={enCours}
          style={{ ...boutonPlage, width: "100%", borderColor: "var(--danger)", color: "var(--danger)" }}
        >
          Fermer l'année {annee} au complet
        </button>

        {rapport && (
          <pre style={{ fontSize: 13, whiteSpace: "pre-wrap", background: "var(--bg)", borderRadius: 12, padding: 12, margin: "12px 0 0", fontFamily: "inherit" }}>
            {rapport}
          </pre>
        )}
      </div>
    </div>
  );
}

const boutonEgal = { flex: "1 1 180px", justifyContent: "center", padding: "11px 12px" };
const boutonAnnee = {
  display: "inline-flex", alignItems: "center", gap: 4, padding: "9px 12px", borderRadius: 10, textDecoration: "none",
  fontSize: 13, fontWeight: 700, color: "var(--text)", background: "var(--bg)", border: "1px solid var(--border)",
};
const boutonPlage = {
  padding: 11, borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer",
  background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)",
};
