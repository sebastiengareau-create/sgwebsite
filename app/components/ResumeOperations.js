import { prisma } from "@/lib/prisma";

export default async function ResumeOperations() {
  const [enAttente, enCours, facturesImpayees, soumissionsEnAttente] = await Promise.all([
    prisma.bonTravail.count({ where: { statut: "EN_ATTENTE" } }),
    prisma.bonTravail.count({ where: { statut: "EN_COURS" } }),
    prisma.facture.findMany({ where: { statut: "IMPAYEE" }, select: { totalAvecTaxes: true } }),
    prisma.soumission.count({ where: { statut: "EN_ATTENTE" } }),
  ]);
  const totalImpaye = facturesImpayees.reduce((s, f) => s + f.totalAvecTaxes, 0);

  const stats = [
    { valeur: enAttente, label: "En attente", couleur: "#C9A227" },
    { valeur: enCours, label: "En cours", couleur: "var(--bleu)" },
    { valeur: `${totalImpaye.toFixed(0)} $`, label: "Impayé", couleur: "var(--danger)" },
    { valeur: soumissionsEnAttente, label: "Soumissions", couleur: "var(--accent)" },
  ];

  return (
    <div className="conteneur-page-large" style={{ margin: "0 auto", padding: "0 16px 14px" }}>
      <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
        {stats.map((s) => (
          <div key={s.label} style={{ flex: "1 0 auto", minWidth: 80, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px" }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: s.couleur }}>{s.valeur}</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
