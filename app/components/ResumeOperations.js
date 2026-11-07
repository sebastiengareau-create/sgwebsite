import { prisma } from "@/lib/prisma";
import { dateAujourdhuiQuebec, limitesJourQuebec } from "@/lib/temps";
import { argent } from "@/lib/format";

export default async function ResumeOperations() {
  // Un bon en attente dont la date prévue est après aujourd'hui est « planifié »
  const { fin: finAujourdhui } = limitesJourQuebec(dateAujourdhuiQuebec());
  const [enAttente, planifies, enCours, facturesImpayees, soumissionsEnAttente] = await Promise.all([
    prisma.bonTravail.count({ where: { statut: "EN_ATTENTE", OR: [{ datePrevue: null }, { datePrevue: { lte: finAujourdhui } }] } }),
    prisma.bonTravail.count({ where: { statut: "EN_ATTENTE", datePrevue: { gt: finAujourdhui } } }),
    prisma.bonTravail.count({ where: { statut: "EN_COURS" } }),
    prisma.facture.findMany({ where: { statut: "IMPAYEE" }, select: { totalAvecTaxes: true, montantPaye: true } }),
    prisma.soumission.count({ where: { statut: "EN_ATTENTE" } }),
  ]);
  const totalImpaye = facturesImpayees.reduce((s, f) => s + Math.max(0, f.totalAvecTaxes - f.montantPaye), 0); // facture de retour (négative) : rien à encaisser

  const stats = [
    { valeur: planifies, label: "Planifiés", couleur: "#9A7FC7" },
    { valeur: enAttente, label: "En attente", couleur: "var(--avertissement)" },
    { valeur: enCours, label: "En cours", couleur: "var(--bleu)" },
    { valeur: argent(totalImpaye, 0), label: "Impayé", couleur: "var(--danger)" },
    { valeur: soumissionsEnAttente, label: "Soumissions", couleur: "var(--accent-ombre)" },
  ];

  return (
    <div className="conteneur-page-large" style={{ margin: "0 auto", padding: "12px 16px 4px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8 }}>
        {stats.map((s) => (
          <div key={s.label} style={{
            position: "relative", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 14, padding: "10px 12px 10px 16px",
          }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: s.couleur }} />
            <div style={{ fontSize: 20, fontWeight: 800, color: s.couleur, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{s.valeur}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
