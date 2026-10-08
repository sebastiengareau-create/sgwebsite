import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection, estGerantOuDev } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { smsConfigure } from "@/lib/sms";
import { STATUTS_ACTIFS } from "@/lib/statutsEnvoi";
import EnTete from "../../../components/EnTete";
import OperationsTabs from "../../../components/OperationsTabs";
import EnvoisClient from "./EnvoisClient";
import CarteSuivi from "./CarteSuivi";

export default async function PageEnvois(props) {
  const searchParams = await props.searchParams;
  const session = await obtenirSession();
  if (!session) redirect("/login");
  if (!(await aAccesSection(session, "operations"))) redirect(`/${session.role.toLowerCase()}`);

  const [bons, employes, envois] = await Promise.all([
    prisma.bonTravail.findMany({
      where: { statut: { not: "TERMINE" } },
      select: {
        id: true, numero: true, datePrevue: true,
        client: { select: { nom: true, adresse: true, ville: true } },
        vehicule: { select: { annee: true, marque: true, modele: true } },
        problemes: { orderBy: { id: "asc" }, select: { description: true } },
      },
      orderBy: { creeLe: "desc" },
    }),
    prisma.user.findMany({
      where: { actif: true },
      select: { id: true, nom: true, telephone: true, assignation: true },
      orderBy: { nom: "asc" },
    }),
    // Envois en cours, et ceux fermés dans les 7 derniers jours
    prisma.envoiBon.findMany({
      where: {
        OR: [
          { statut: { in: STATUTS_ACTIFS } },
          { termineLe: { gte: new Date(Date.now() - 7 * 86400000) } },
        ],
      },
      include: {
        employe: { select: { nom: true } },
        bon: { select: { id: true, numero: true, client: { select: { nom: true } } } },
      },
      orderBy: { envoyeLe: "desc" },
      take: 200,
    }),
  ]);

  const estGerant = estGerantOuDev(session);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <OperationsTabs />
      <EnvoisClient
        bons={bons}
        employes={employes}
        envois={envois}
        smsActif={smsConfigure()}
        bonInitial={searchParams?.bon || ""}
      />
      {estGerant && <CarteSuivi employes={employes.map(({ id, nom }) => ({ id, nom }))} />}
    </div>
  );
}
