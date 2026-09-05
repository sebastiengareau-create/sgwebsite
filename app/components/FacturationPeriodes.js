import { prisma } from "@/lib/prisma";
import { dateAujourdhuiQuebec, limitesJourQuebec, limitesMoisQuebec } from "@/lib/temps";

function decalerJours(dateStr, delta) {
  const [an, mois, jour] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(an, mois - 1, jour + delta, 12));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function joursEntre(dateStr1, dateStr2) {
  const [a1, m1, j1] = dateStr1.split("-").map(Number);
  const [a2, m2, j2] = dateStr2.split("-").map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, j2) - Date.UTC(a1, m1 - 1, j1)) / 86400000);
}

// Lundi (heure du Québec) de la semaine contenant cette date
function lundiDeLaSemaine(dateStr) {
  const [an, mois, jour] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(an, mois - 1, jour, 12));
  const jourSemaine = d.getUTCDay(); // 0=dim..6=sam
  const decalage = jourSemaine === 0 ? -6 : 1 - jourSemaine;
  return decalerJours(dateStr, decalage);
}

async function sommeFacturee(debut, fin) {
  const r = await prisma.facture.aggregate({
    where: { dateEmission: { gte: debut, lte: fin }, statut: { not: "ANNULEE" } },
    _sum: { totalAvecTaxes: true },
  });
  return r._sum.totalAvecTaxes || 0;
}

export default async function FacturationPeriodes() {
  const aujourdHui = dateAujourdhuiQuebec();
  const [an, mois, jourNum] = aujourdHui.split("-").map(Number);

  // ---- Jour : aujourd'hui vs hier ----
  const hier = decalerJours(aujourdHui, -1);
  const { debut: debutJour, fin: finJour } = limitesJourQuebec(aujourdHui);
  const { debut: debutJourPrec, fin: finJourPrec } = limitesJourQuebec(hier);

  // ---- Semaine : lundi à aujourd'hui, comparé à la semaine précédente sur le même nombre de jours ----
  const lundi = lundiDeLaSemaine(aujourdHui);
  const joursEcoulesSemaine = joursEntre(lundi, aujourdHui) + 1;
  const lundiPrec = decalerJours(lundi, -7);
  const finSemainePrecComparable = decalerJours(lundiPrec, joursEcoulesSemaine - 1);
  const { debut: debutSemaine } = limitesJourQuebec(lundi);
  const { fin: finSemaine } = limitesJourQuebec(aujourdHui);
  const { debut: debutSemainePrec } = limitesJourQuebec(lundiPrec);
  const { fin: finSemainePrec } = limitesJourQuebec(finSemainePrecComparable);

  // ---- Mois : 1er à aujourd'hui, comparé au mois précédent sur le même nombre de jours ----
  const moisPrec = mois === 1 ? 12 : mois - 1;
  const anMoisPrec = mois === 1 ? an - 1 : an;
  const dernierJourMoisPrec = new Date(Date.UTC(anMoisPrec, moisPrec, 0)).getUTCDate();
  const jourComparableMoisPrec = Math.min(jourNum, dernierJourMoisPrec);
  const { debut: debutMois } = limitesMoisQuebec(an, mois);
  const { fin: finMois } = limitesJourQuebec(aujourdHui);
  const { debut: debutMoisPrec } = limitesMoisQuebec(anMoisPrec, moisPrec);
  const { fin: finMoisPrec } = limitesJourQuebec(
    `${anMoisPrec}-${String(moisPrec).padStart(2, "0")}-${String(jourComparableMoisPrec).padStart(2, "0")}`
  );

  const [jourActuel, jourPrecedent, semaineActuelle, semainePrecedente, moisActuel, moisPrecedent] = await Promise.all([
    sommeFacturee(debutJour, finJour),
    sommeFacturee(debutJourPrec, finJourPrec),
    sommeFacturee(debutSemaine, finSemaine),
    sommeFacturee(debutSemainePrec, finSemainePrec),
    sommeFacturee(debutMois, finMois),
    sommeFacturee(debutMoisPrec, finMoisPrec),
  ]);

  const cartes = [
    { label: "Facturation du jour", valeur: jourActuel, precedent: jourPrecedent, couleur: "var(--bleu)", comparaison: "hier" },
    { label: "Facturation de la semaine", valeur: semaineActuelle, precedent: semainePrecedente, couleur: "var(--accent-ombre)", comparaison: "semaine dernière" },
    { label: "Facturation du mois", valeur: moisActuel, precedent: moisPrecedent, couleur: "var(--success)", comparaison: "mois dernier" },
  ];

  return (
    <div className="conteneur-page-large" style={{ margin: "0 auto", padding: "16px 16px 0" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        {cartes.map((c) => {
          let compTexte, compCouleur;
          if (c.precedent === 0 && c.valeur === 0) {
            compTexte = `— vs ${c.comparaison}`;
            compCouleur = "rgba(242,238,228,0.65)";
          } else if (c.precedent === 0) {
            compTexte = `▲ nouveau vs ${c.comparaison}`;
            compCouleur = "#d7f5d3";
          } else {
            const variation = ((c.valeur - c.precedent) / c.precedent) * 100;
            const hausse = variation >= 0;
            compTexte = `${hausse ? "▲" : "▼"} ${Math.abs(variation).toFixed(0)}% vs ${c.comparaison}`;
            compCouleur = hausse ? "#d7f5d3" : "#f7d6ce";
          }
          return (
            <div key={c.label} style={{ background: c.couleur, borderRadius: 14, padding: "14px 16px" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(242,238,228,0.85)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                {c.label}
              </div>
              <div style={{ fontSize: 23, fontWeight: 800, marginTop: 4, color: "var(--text)" }}>{c.valeur.toFixed(0)} $</div>
              <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4, color: compCouleur }}>{compTexte}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
