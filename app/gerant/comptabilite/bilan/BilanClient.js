"use client";

import Link from "next/link";

const COULEURS_ACTIF = ["#4F82C0", "#5AC8C8", "#7BA7D9", "#3E6A9E"];
const COULEURS_PASSIF = ["#C9A227", "#D4B24D", "#B8901A"];
const COULEURS_CAPITAUX = ["#9C978A", "#B0AA9C", "#E8A33D"];

export default function BilanClient({ lignes, resultatNetCumule }) {
  const actifs = lignes.filter((l) => l.type === "ACTIF" && l.solde !== 0).sort((a, b) => b.solde - a.solde);
  const passifs = lignes.filter((l) => l.type === "PASSIF" && l.solde !== 0).sort((a, b) => b.solde - a.solde);
  const capitauxComptes = lignes.filter((l) => l.type === "CAPITAUX_PROPRES").sort((a, b) => b.solde - a.solde);

  const totalActif = actifs.reduce((s, l) => s + l.solde, 0);
  const totalPassif = passifs.reduce((s, l) => s + l.solde, 0);
  const totalCapitauxComptes = capitauxComptes.reduce((s, l) => s + l.solde, 0);
  const totalCapitauxPropres = totalCapitauxComptes + resultatNetCumule;
  const totalPassifEtCapitaux = totalPassif + totalCapitauxPropres;
  const ecart = totalActif - totalPassifEtCapitaux;
  const equilibre = Math.abs(ecart) < 0.01;

  // Pour les barres proportionnelles des capitaux propres, on inclut le
  // résultat net cumulé comme une ligne à part entière
  const capitauxAvecResultat = [
    ...capitauxComptes.filter((l) => l.solde !== 0),
    ...(resultatNetCumule !== 0 ? [{ numero: "RESULTAT", nom: "Résultat net cumulé (non affecté)", solde: resultatNetCumule }] : []),
  ];

  return (
    <div style={{ padding: 16, maxWidth: 520, margin: "0 auto" }}>
      <Link href="/gerant/comptabilite" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour au plan comptable</Link>
      <h1 style={{ fontSize: 20, marginTop: 8, marginBottom: 4 }}>Bilan</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>À ce jour — Actif d'un côté, Passif et capitaux propres de l'autre.</p>

      {/* Vérification d'équilibre — mise en évidence en premier */}
      <div
        style={{
          padding: 18, borderRadius: 14, marginBottom: 24, textAlign: "center",
          background: equilibre ? "rgba(111,169,107,0.14)" : "rgba(193,91,74,0.14)",
          border: `1px solid ${equilibre ? "var(--success)" : "var(--danger)"}`,
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 800, color: equilibre ? "var(--success)" : "var(--danger)" }}>
          {equilibre ? "✓ Le bilan s'équilibre" : `Écart de ${Math.abs(ecart).toFixed(2)} $`}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
          Actif {totalActif.toFixed(2)} $ = Passif {totalPassif.toFixed(2)} $ + Capitaux propres {totalCapitauxPropres.toFixed(2)} $
        </div>
      </div>

      <SectionBarres titre="🏦 Actif" total={totalActif} lignes={actifs} couleurs={COULEURS_ACTIF} />
      <SectionBarres titre="📋 Passif" total={totalPassif} lignes={passifs} couleurs={COULEURS_PASSIF} />
      <SectionBarres titre="💼 Capitaux propres" total={totalCapitauxPropres} lignes={capitauxAvecResultat} couleurs={COULEURS_CAPITAUX} />

      {actifs.length === 0 && passifs.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", marginTop: 30 }}>
          Aucune donnée encore — émets ta première facture pour voir apparaître les chiffres ici.
        </p>
      )}
    </div>
  );
}

function SectionBarres({ titre, total, lignes, couleurs }) {
  if (lignes.length === 0) return null;
  const max = Math.max(...lignes.map((l) => Math.abs(l.solde)), 1);

  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{titre}</span>
        <span style={{ fontSize: 16, fontWeight: 800 }}>{total.toFixed(2)} $</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {lignes.map((l, i) => {
          const couleur = couleurs[i % couleurs.length];
          const largeur = Math.max(6, (Math.abs(l.solde) / max) * 100);
          const part = total !== 0 ? (l.solde / total) * 100 : 0;
          return (
            <div key={l.numero}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                <span>{l.nom}</span>
                <span style={{ fontWeight: 700 }}>{l.solde.toFixed(2)} $ <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({part.toFixed(0)}%)</span></span>
              </div>
              <div style={{ height: 10, background: "var(--surface)", borderRadius: 999, overflow: "hidden", border: "1px solid var(--border)" }}>
                <div style={{ width: `${largeur}%`, height: "100%", background: couleur, borderRadius: 999 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
