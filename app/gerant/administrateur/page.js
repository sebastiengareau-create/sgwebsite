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

  const parametres = await prisma.parametre.findMany({ where: { cle: { in: ["module_calendrier", "module_comptabilite", "module_paie", "module_jobs_deplacement", "module_notifications", "module_documents", "module_elevage", "module_copropriete", "module_productivite", "module_double_verification", "compte_verrouille", "theme_developpeur", "taille_texte_developpeur"] } } });
  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <AdministrateurClient
        modules={[
          { id: "calendrier", label: "Calendrier", description: "Rendez-vous, réservations en ligne", actif: dict.module_calendrier !== "inactif" },
          { id: "comptabilite", label: "Comptabilité", description: "Plan comptable, écritures automatiques, journal général", actif: dict.module_comptabilite !== "inactif" },
          { id: "paie", label: "Paie", description: "Paie — retenues à la source, cotisations de l'employeur, heures supplémentaires, jours fériés, talons et sommaires T4 / RL-1", actif: dict.module_paie === "actif" },
          { id: "productivite", label: "Productivité par employés", description: "Rapport de productivité (heures poinçonnées, facturables, poinçons oubliés) et rentabilité par employé", actif: dict.module_productivite !== "inactif" },
          { id: "notifications", label: "Notifications", description: "Cloche 🔔, avis automatiques (rendez-vous, pièces reçues, stock bas…) et messages aux employés", actif: dict.module_notifications !== "inactif" },
          { id: "double_verification", label: "Double vérification à la connexion", description: "Gérants et niveau 4 : après le mot de passe, un code à 6 chiffres envoyé par courriel (une fois par appareil aux 30 jours). Exige l'envoi de courriel configuré", actif: dict.module_double_verification === "actif" },
          { id: "documents", label: "Documents", description: "Lettres (référence d'emploi, promotion…), envoi par courriel et envoi groupé aux clients", actif: dict.module_documents === "actif" },
          { id: "jobs_deplacement", label: "Jobs en déplacement", description: "Envoi de bons à des employés précis, avis par notification, suivi GPS des déplacements", actif: dict.module_jobs_deplacement === "actif" },
          { id: "elevage", label: "Élevage", description: "Troupeau (bœuf wagyu…) de la naissance à la table : pesées, coût de revient, abattage, découpe en paquets selon les rendements, vente en boutique et en ligne", actif: dict.module_elevage === "actif" },
          { id: "copropriete", label: "Copropriété", description: "Syndicat de copropriété : unités, copropriétaires, quotes-parts et charges communes, demandes de réparation, bons de travail, entretien préventif, documents et portail sécurisé des copropriétaires", actif: dict.module_copropriete === "actif" },
        ]}
        verrouilleInit={dict.compte_verrouille === "actif"}
        estDeveloppeur={session.role === "DEVELOPPEUR"}
        themeInit={dict.theme_developpeur === "sombre" ? "sombre" : "clair"}
        tailleTexteInit={dict.taille_texte_developpeur === "grand" ? "grand" : "normal"}
      />
    </div>
  );
}
