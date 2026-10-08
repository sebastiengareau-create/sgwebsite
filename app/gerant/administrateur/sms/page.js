import { redirect } from "next/navigation";
import { obtenirSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CLES_SMS } from "@/lib/sms";
import EnTete from "../../../components/EnTete";
import SmsClient from "./SmsClient";

export default async function ConfigurationSms() {
  const session = await obtenirSession();
  if (!session) redirect("/login");
  if (session.role !== "DEVELOPPEUR") {
    const utilisateur = await prisma.user.findUnique({ where: { id: session.id }, select: { estSuperAdmin: true } });
    if (!utilisateur?.estSuperAdmin) redirect("/gerant");
  }

  const lignes = await prisma.parametre.findMany({ where: { cle: { in: Object.values(CLES_SMS) } } });
  const dict = Object.fromEntries(lignes.map((l) => [l.cle, l.valeur]));

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <SmsClient
        init={{
          accountSid: dict[CLES_SMS.accountSid] || "",
          numero: dict[CLES_SMS.numero] || "",
          adressePublique: dict[CLES_SMS.adressePublique] || "",
          // Le jeton lui-même ne quitte jamais le serveur
          jetonEnregistre: !!dict[CLES_SMS.authToken],
        }}
      />
    </div>
  );
}
