import { redirect } from "next/navigation";
import { obtenirSession, estGerantOuDev } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EnTete from "../../../components/EnTete";
import SauvegardeClient from "./SauvegardeClient";

export default async function Sauvegarde() {
  const session = await obtenirSession();
  if (!estGerantOuDev(session)) redirect("/gerant");

  let peutRestaurer = session.role === "DEVELOPPEUR";
  if (!peutRestaurer) {
    const utilisateur = await prisma.user.findUnique({ where: { id: session.id }, select: { estSuperAdmin: true } });
    peutRestaurer = utilisateur?.estSuperAdmin || false;
  }

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <SauvegardeClient peutRestaurer={peutRestaurer} />
    </div>
  );
}
