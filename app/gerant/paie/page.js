import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dateAujourdhuiQuebec } from "@/lib/temps";
import EnTete from "../../components/EnTete";
import PaieClient from "./PaieClient";

function variation(actuel, precedent) {
  if (precedent === undefined || precedent === null || precedent === 0) return null;
  return ((actuel - precedent) / Math.abs(precedent)) * 100;
}

export default async function Paie() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "paie"))) redirect("/gerant");

  const modulePaie = await prisma.parametre.findUnique({ where: { cle: "module_paie" } });
  if (modulePaie?.valeur !== "actif") redirect("/gerant");

  const [lots, employesActifs] = await Promise.all([
    prisma.lotPaie.findMany({
      include: { paies: { include: { employe: true } } },
      orderBy: { creeLe: "desc" },
      take: 30,
    }),
    prisma.user.count({ where: { actif: true, role: { in: ["MECANICIEN", "SECRETAIRE", "GERANT"] } } }),
  ]);

  const lotsAvecTotaux = lots.map((lot) => ({
    id: lot.id,
    numero: lot.numero,
    periodeDebut: lot.periodeDebut,
    periodeFin: lot.periodeFin,
    dateVersementPrevue: lot.dateVersementPrevue,
    typePaie: lot.typePaie,
    statut: lot.statut,
    comptabiliseLe: lot.comptabiliseLe,
    nbEmployes: lot.paies.length,
    totalBrut: lot.paies.reduce((s, p) => s + p.salaireBrut, 0),
    totalDeductions: lot.paies.reduce((s, p) => s + p.totalDeductions, 0),
    totalNet: lot.paies.reduce((s, p) => s + p.salaireNet, 0),
  }));

  // Comparaison sur les lots de paie régulière seulement (une paie de
  // vacances ferait varier les totaux sans rapport avec l'activité réelle).
  const lotsReguliers = lotsAvecTotaux.filter((l) => l.typePaie === "REGULIERE");
  const dernierLotTotaux = lotsReguliers[0] || lotsAvecTotaux[0] || null;
  const lotPrecedentTotaux = lotsReguliers[0] ? lotsReguliers[1] : lotsAvecTotaux[1];

  const dernierLotComplet = dernierLotTotaux ? lots.find((l) => l.id === dernierLotTotaux.id) : null;
  const dernierLotDetail = dernierLotComplet
    ? {
        id: dernierLotComplet.id,
        numero: dernierLotComplet.numero,
        statut: dernierLotComplet.statut,
        periodeDebut: dernierLotComplet.periodeDebut,
        periodeFin: dernierLotComplet.periodeFin,
        paies: dernierLotComplet.paies.map((p) => ({
          id: p.id,
          nom: p.employe.nom,
          role: p.employe.role,
          heuresTravaillees: p.heuresTravaillees,
          heuresHorodateur: p.heuresHorodateur,
          salaireBrut: p.salaireBrut,
          totalDeductions: p.totalDeductions,
          salaireNet: p.salaireNet,
        })),
      }
    : null;

  const kpis = {
    employesActifs,
    brut: dernierLotTotaux?.totalBrut || 0,
    brutVariation: variation(dernierLotTotaux?.totalBrut, lotPrecedentTotaux?.totalBrut),
    deductions: dernierLotTotaux?.totalDeductions || 0,
    deductionsVariation: variation(dernierLotTotaux?.totalDeductions, lotPrecedentTotaux?.totalDeductions),
    net: dernierLotTotaux?.totalNet || 0,
    netVariation: variation(dernierLotTotaux?.totalNet, lotPrecedentTotaux?.totalNet),
  };

  // Alertes — seulement des constats vérifiables à partir des vraies
  // données (aucune alerte inventée type "échéance DAS" sans donnée réelle).
  const alertes = [];
  const brouillons = lotsAvecTotaux.filter((l) => l.statut === "BROUILLON");
  if (brouillons.length > 0) {
    alertes.push({
      icone: "🟡",
      texte: `${brouillons.length} lot${brouillons.length !== 1 ? "s" : ""} de paie en brouillon à traiter`,
      niveau: "avertissement",
      href: `/gerant/paie/lots/${brouillons[0].id}`,
    });
  }
  if (dernierLotDetail) {
    const ecarts = dernierLotDetail.paies.filter(
      (p) => p.heuresHorodateur != null && Math.abs(p.heuresHorodateur - p.heuresTravaillees) > 0.25
    );
    if (ecarts.length > 0) {
      alertes.push({
        icone: "🕒",
        texte: `${ecarts.length} employé${ecarts.length !== 1 ? "s" : ""} avec un écart entre heures poinçonnées et heures payées sur le dernier lot`,
        niveau: "avertissement",
        href: `/gerant/paie/lots/${dernierLotDetail.id}`,
      });
    }
  }

  // Prochaine paie prévue (ou la plus récente déjà passée si aucune future)
  const aujourdhui = dateAujourdhuiQuebec();
  const datesVersement = lotsAvecTotaux.filter((l) => l.dateVersementPrevue);
  const futures = datesVersement
    .filter((l) => l.dateVersementPrevue.toISOString().slice(0, 10) >= aujourdhui)
    .sort((a, b) => a.dateVersementPrevue - b.dateVersementPrevue);
  const prochainePaie = futures[0] || null;

  const calendrierDates = datesVersement.map((l) => ({
    dateStr: l.dateVersementPrevue.toISOString().slice(0, 10),
    numero: l.numero,
    statut: l.statut,
    lotId: l.id,
  }));

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <PaieClient
        lots={lotsAvecTotaux}
        employesActifs={employesActifs}
        kpis={kpis}
        dernierLot={dernierLotDetail}
        alertes={alertes}
        prochainePaie={prochainePaie ? { numero: prochainePaie.numero, dateStr: prochainePaie.dateVersementPrevue.toISOString().slice(0, 10) } : null}
        calendrierDates={calendrierDates}
      />
    </div>
  );
}
