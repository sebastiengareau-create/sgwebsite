import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { peutGererElevage, lireRendementCarcasse, lireGmqCible, lirePoidsAbattage } from "@/lib/elevage";
import EnTete from "../components/EnTete";
import { momentQuebec } from "@/lib/immobilierVisuel";
import TroupeauClient from "./TroupeauClient";

export default async function Troupeau() {
  const session = await obtenirSession();
  if (!session) redirect("/login");
  if (!(await peutGererElevage(session))) redirect("/mecanicien");

  // Mois en cours (heure du Québec) : ventes de viande du mois
  const periode = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date()).slice(0, 7);
  const [a, m] = periode.split("-").map(Number);
  const [betes, rendementCarcasse, gmqCible, poidsAbattage, coupes, ventesMois, paquetsRecus, paquetsVendus] = await Promise.all([
    prisma.bete.findMany({
      include: {
        pesees: { select: { date: true, poids: true } },
        frais: { select: { montant: true } },
        soins: { select: { id: true, date: true, type: true, produit: true, retraitJours: true, rappelLe: true } },
        mere: { select: { numero: true, nom: true } },
        deplacements: { select: { date: true, creeLe: true, type: true, lieu: true, site: true } },
        saillies: { where: { statut: { in: ["EN_ATTENTE", "GESTANTE"] } }, select: { id: true, date: true, statut: true } },
        abattage: { select: { date: true, poidsCarcasse: true, bms: true, fraisAbattage: true, lots: { select: { ventes: { select: { montant: true } } } } } },
      },
      orderBy: { numero: "asc" },
    }),
    lireRendementCarcasse(),
    lireGmqCible(),
    lirePoidsAbattage(),
    prisma.coupeViande.findMany({ where: { actif: true } }),
    prisma.venteViande.aggregate({ where: { date: { gte: new Date(Date.UTC(a, m - 1, 1)), lt: new Date(Date.UTC(a, m, 1)) } }, _sum: { montant: true, nbPaquets: true } }),
    prisma.lotViande.aggregate({ _sum: { nbPaquets: true } }),
    prisma.venteViande.aggregate({ _sum: { nbPaquets: true } }),
  ]);
  const viande = {
    ventesMois: ventesMois._sum.montant || 0,
    paquetsVendusMois: ventesMois._sum.nbPaquets || 0,
    paquetsEnStock: Math.max(0, (paquetsRecus._sum.nbPaquets || 0) - (paquetsVendus._sum.nbPaquets || 0)),
  };

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <TroupeauClient
        betes={JSON.parse(JSON.stringify(betes))} rendementCarcasse={rendementCarcasse} gmqCible={gmqCible} poidsAbattage={poidsAbattage} coupes={coupes} viande={viande}
        // Ferme illustrée : ciel du moment au Québec, salutation par le prénom
        visuel={{ ...momentQuebec(), prenom: (session.nom || "").trim().split(/\s+/)[0] || "" }}
      />
    </div>
  );
}
