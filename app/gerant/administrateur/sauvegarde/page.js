import { redirect } from "next/navigation";
import { obtenirSession, estGerantOuDev } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CLE_COURRIEL } from "@/lib/planificateurSauvegarde";
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

  const parametreCourriel = peutRestaurer ? await prisma.parametre.findUnique({ where: { cle: CLE_COURRIEL } }) : null;

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <SauvegardeClient peutRestaurer={peutRestaurer} courrielAutoInit={parametreCourriel?.valeur || ""} />
    </div>
  );
}
