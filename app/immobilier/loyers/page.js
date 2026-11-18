import { prisma } from "@/lib/prisma";
import EnTete from "../../components/EnTete";
import { soldesDesBaux } from "@/lib/immobilier";
import { periodeCourante } from "@/lib/immobilierCalculs";
import { exigerAccesImmo, simple } from "../acces";
import LoyersClient from "./LoyersClient";

const LOGEMENT = { select: { id: true, numero: true, type: true, immeuble: { select: { id: true, nom: true } } } };
const LOCATAIRES = { select: { id: true, nom: true, telephone: true } };

export default async function LoyersImmo(props) {
  const session = await exigerAccesImmo();
  const params = await props.searchParams;
  const courante = periodeCourante();
  const periode = /^\d{4}-(0[1-9]|1[0-2])$/.test(params?.mois || "") ? params.mois : courante;
  const [a, m] = periode.split("-").map(Number);
  const debutMois = new Date(Date.UTC(a, m - 1, 1, 12));
  const finMois = new Date(Date.UTC(a, m, 0, 12));
  const [baux, charges, soldes, paiements] = await Promise.all([
    // Baux qui couvrent ce mois (en cours, ou terminés en cours de mois)
    prisma.bailImmo.findMany({
      where: { dateDebut: { lte: finMois }, OR: [{ dateFin: null }, { dateFin: { gte: debutMois } }] },
      select: { id: true, loyer: true, statut: true, dateDebut: true, dateFin: true, jourPaiement: true, logement: LOGEMENT, locataires: LOCATAIRES },
    }),
    prisma.chargeImmo.findMany({ where: { periode, type: "LOYER" }, select: { id: true, bailId: true, montant: true } }),
    soldesDesBaux(),
    prisma.paiementImmo.findMany({
      orderBy: { date: "desc" }, take: 150,
      select: { id: true, date: true, montant: true, mode: true, reference: true, note: true, bail: { select: { id: true, logement: LOGEMENT, locataires: LOCATAIRES } } },
    }),
  ]);
  // Baux avec un solde dû (même terminés)
  const idsDus = Object.entries(soldes).filter(([, s]) => s > 0.005).map(([id]) => id);
  const dus = await prisma.bailImmo.findMany({ where: { id: { in: idsDus } }, select: { id: true, loyer: true, statut: true, logement: LOGEMENT, locataires: LOCATAIRES } });
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <LoyersClient {...simple({ periode, courante, baux, charges, soldes, paiements, dus, onglet: params?.onglet || "MOIS" })} />
    </div>
  );
}
