import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EnTete from "../../../../components/EnTete";
import HistoriqueFermeturesClient from "./HistoriqueFermeturesClient";

// Associe chaque fermeture à sa réouverture éventuelle (la première
// réouverture survenue après elle, avant toute fermeture suivante du même
// mois) — pour afficher "Réouverte : Oui/Non" et le motif dans le journal.
function associerReouvertures(historique) {
  const parPeriode = {};
  for (const h of historique) {
    (parPeriode[h.periodeId] ||= []).push(h);
  }
  const lignes = [];
  for (const evenements of Object.values(parPeriode)) {
    const tries = [...evenements].sort((a, b) => new Date(a.creeLe) - new Date(b.creeLe));
    const fermetures = tries.filter((e) => e.action === "FERMETURE");
    for (const f of fermetures) {
      const reouverture = tries.find(
        (e) => e.action === "REOUVERTURE" && new Date(e.creeLe) > new Date(f.creeLe)
      );
      lignes.push({ fermeture: f, reouverture: reouverture || null, periode: f.periode });
    }
  }
  return lignes.sort((a, b) => new Date(b.fermeture.creeLe) - new Date(a.fermeture.creeLe));
}

export default async function HistoriqueFermetures() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) redirect("/gerant");

  const historique = await prisma.fermeturePeriodeHistorique.findMany({
    include: { periode: true },
    orderBy: { creeLe: "asc" },
    take: 500,
  });

  const lignes = associerReouvertures(historique);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <HistoriqueFermeturesClient lignes={lignes} />
    </div>
  );
}
