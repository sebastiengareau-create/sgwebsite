import Link from "next/link";

export default function PrevisionsClient({ prevision }) {
  const {
    soldeActuel, clientsARecevoir, fournisseursAPayer, paiePrevue, paiePrevueEstimee, taxesARemettre, liquiditesProjetees,
  } = prevision;

  const lignes = [
    { label: "Solde actuel (liquidités)", montant: soldeActuel, signe: "" },
    { label: "Comptes clients à recevoir", montant: clientsARecevoir, signe: "+", href: "/gerant/comptabilite/rapports/comptes-clients" },
    { label: "Fournisseurs à payer", montant: fournisseursAPayer, signe: "−", href: "/gerant/comptabilite/comptes-a-payer" },
    { label: `Paie prévue${paiePrevueEstimee ? " (estimée)" : ""}`, montant: paiePrevue, signe: "−", href: "/gerant/paie" },
    { label: "Taxes et remises à remettre", montant: taxesARemettre, signe: "−", href: "/gerant/comptabilite/remise-gouvernementale" },
  ];

  return (
    <div className="conteneur-page">
      <Link href="/gerant/comptabilite/caisse-banque" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à Caisse & Banque</Link>
      <h1 style={{ fontSize: 20, margin: "8px 0 4px" }}>📊 Prévisions de trésorerie</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
        Ce que tes liquidités deviendraient si tout ce qui est déjà connu se réglait — pas une prédiction de nouvelles ventes.
      </p>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        {lignes.map((l) => (
          <LigneMontant key={l.label} {...l} />
        ))}
        <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Liquidités projetées</span>
          <span style={{ fontWeight: 700, fontSize: 20, color: liquiditesProjetees >= 0 ? "var(--success)" : "var(--danger)" }}>
            {liquiditesProjetees.toFixed(2)} $
          </span>
        </div>
      </div>

      {paiePrevueEstimee && paiePrevue > 0 && (
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 16 }}>
          Aucun lot de paie en préparation — la paie prévue est estimée à partir de la moyenne des 3 derniers lots réguliers versés.
        </p>
      )}
      {liquiditesProjetees < 0 && (
        <div style={{ background: "rgba(193,91,74,0.12)", borderRadius: 10, padding: 12, fontSize: 12.5, color: "var(--danger)", fontWeight: 600 }}>
          ⚠️ Si tout ce qui est dû se réglait maintenant, les liquidités deviendraient négatives.
        </div>
      )}
    </div>
  );
}

function LigneMontant({ label, montant, signe, href }) {
  const contenu = (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0" }}>
      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600 }}>
        {signe && `${signe} `}{montant.toFixed(2)} $
      </span>
    </div>
  );
  if (!href) return contenu;
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
      {contenu}
    </Link>
  );
}
