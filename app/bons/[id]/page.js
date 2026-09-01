import { notFound, redirect } from "next/navigation";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assurerPlanComptable, COMPTES_REVENU_RESERVES } from "@/lib/comptabilite";
import EnTete from "../../components/EnTete";
import BonDetailClient from "../BonDetailClient";

export default async function DetailBonPage({ params }) {
  const session = await obtenirSession();
  if (!session) redirect("/login");

  const bon = await prisma.bonTravail.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      problemes: {
        orderBy: { id: "asc" },
        include: {
          photos: true,
          pieces: { include: { piece: true } },
          entreesTemps: { include: { employe: true } },
        },
      },
      facture: true,
    },
  });
  if (!bon) notFound();

  // N'importe quel mécanicien peut voir/travailler sur n'importe quel bon —
  // il n'y a plus d'assignation restrictive.

  const inventaire = await prisma.piece.findMany({ orderBy: { nom: "asc" } });
  const mecaniciens = await prisma.user.findMany({ where: { role: "MECANICIEN", actif: true }, orderBy: { nom: "asc" } });
  await assurerPlanComptable();
  const postesRevenu = await prisma.compte.findMany({
    where: { type: "REVENU", actif: true, numero: { notIn: COMPTES_REVENU_RESERVES } },
    orderBy: { numero: "asc" },
  });
  const parametres = await prisma.parametre.findMany();
  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));
  const tauxHoraireClient = Number(dict.taux_horaire_client || 195);
  const tpsTaux = Number(dict.tps_taux || 5);
  const tvqTaux = Number(dict.tvq_taux || 9.975);
  const peutModifier = await aAccesSection(session, "operations");
  const peutPoinconner = estGerantOuDev(session) || session.role === "MECANICIEN";

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <BonDetailClient
        bon={bon}
        inventaire={inventaire}
        mecaniciens={mecaniciens}
        postesRevenu={postesRevenu}
        tauxHoraireClient={tauxHoraireClient}
        tpsTaux={tpsTaux}
        tvqTaux={tvqTaux}
        peutModifier={peutModifier}
        peutPoinconner={peutPoinconner}
        estGerant={estGerantOuDev(session)}
        moi={session.id}
      />
    </div>
  );
}
