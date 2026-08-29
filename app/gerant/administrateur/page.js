import { redirect } from "next/navigation";
import { obtenirSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EnTete from "../../components/EnTete";
import AdministrateurClient from "./AdministrateurClient";

export default async function Administrateur() {
  const session = await obtenirSession();
  if (!session) redirect("/login");

  if (session.role !== "DEVELOPPEUR") {
    // Vérifié directement en base — jamais fait confiance au seul cookie de
    // session pour ce niveau d'accès, pour qu'un retrait de ce statut prenne
    // effet immédiatement, sans attendre une reconnexion.
    const utilisateur = await prisma.user.findUnique({ where: { id: session.id }, select: { estSuperAdmin: true } });
    if (!utilisateur?.estSuperAdmin) redirect("/gerant");
  }

  const parametres = await prisma.parametre.findMany({ where: { cle: { in: ["module_calendrier", "module_comptabilite", "module_paie", "compte_verrouille"] } } });
  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <AdministrateurClient
        modules={[
          { id: "calendrier", label: "Calendrier", description: "Rendez-vous, réservations en ligne", actif: dict.module_calendrier !== "inactif" },
          { id: "comptabilite", label: "Comptabilité", description: "Plan comptable, écritures automatiques, journal général", actif: dict.module_comptabilite !== "inactif" },
          { id: "paie", label: "Paie", description: "Estimation de paie — RRQ, RQAP, AE, impôts (à valider avec WebRAS)", actif: dict.module_paie === "actif" },
        ]}
        verrouilleInit={dict.compte_verrouille === "actif"}
      />
    </div>
  );
}
