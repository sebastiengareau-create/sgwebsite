import { prisma } from "@/lib/prisma";
import EnTete from "../../components/EnTete";
import { exigerAccesImmo, simple } from "../acces";
import EntretienClient from "./EntretienClient";

// Entretien préventif de tous les immeubles (lib/entretienImmo.js)
export default async function EntretienImmo(props) {
  const session = await exigerAccesImmo();
  const params = await props.searchParams;
  const [entretiens, immeubles] = await Promise.all([
    prisma.entretienImmo.findMany({
      include: {
        immeuble: { select: { id: true, nom: true } },
        reparations: { where: { statut: "TERMINEE" }, select: { id: true, numero: true, dateFin: true, coutReel: true }, orderBy: { dateFin: "desc" }, take: 3 },
      },
      orderBy: { prochaineDate: "asc" },
    }),
    prisma.immeubleImmo.findMany({ select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
  ]);
  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <EntretienClient {...simple({ entretiens, immeubles })} immeubleInitial={params?.immeuble || ""} courriel={Boolean(process.env.RESEND_API_KEY)} />
    </div>
  );
}
