import { redirect } from "next/navigation";
import { obtenirSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EnTete from "../../components/EnTete";
import AdministrateurClient from "./AdministrateurClient";
import { etatTroupeauDemo } from "@/lib/elevageDemo";
import { etatAtelierDemo } from "@/lib/atelierDemo";
import { etatCoproDemo } from "@/lib/coproprieteDemo";
import { etatImmoDemo } from "@/lib/immobilierDemo";
import { etatPaieDemo } from "@/lib/paieDemo";
import { etatQuartsDemo } from "@/lib/quartsDemo";
import { CLIENT } from "@/lib/client";

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

  const parametres = await prisma.parametre.findMany({ where: { cle: { in: ["module_calendrier", "module_comptabilite", "module_paie", "module_jobs_deplacement", "module_notifications", "module_documents", "module_elevage", "module_copropriete", "module_immobilier", "module_productivite", "module_quarts", "module_inspection", "module_pneus", "module_paiement_en_ligne", "module_double_verification", "compte_verrouille", "theme_developpeur", "taille_texte_developpeur"] } } });
  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));
  // Troupeau de démonstration : offert seulement si le module Élevage est actif
  const troupeauDemo = dict.module_elevage === "actif" ? await etatTroupeauDemo() : null;
  // Copropriété de démonstration : offerte seulement si le module Copropriété est actif
  const coproDemo = dict.module_copropriete === "actif" ? await etatCoproDemo() : null;
  // Immobilier de démonstration : offert seulement si le module Immobilier est actif
  const immoDemo = dict.module_immobilier === "actif" ? await etatImmoDemo() : null;
  // Paie de démonstration : offerte seulement si le module Paie est actif
  const paieDemo = dict.module_paie === "actif" ? await etatPaieDemo() : null;
  // Pointage de démonstration : offert seulement si le module Pointage de quart est actif
  const quartsDemo = dict.module_quarts === "actif" ? await etatQuartsDemo() : null;

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <AdministrateurClient
        modules={[
          { id: "calendrier", label: "Calendrier", description: "Rendez-vous, réservations en ligne", actif: dict.module_calendrier !== "inactif" },
          { id: "comptabilite", label: "Comptabilité", description: "Plan comptable, écritures automatiques, journal général", actif: dict.module_comptabilite !== "inactif" },
          { id: "paie", label: "Paie", description: "Paie — retenues à la source, cotisations de l'employeur, heures supplémentaires, jours fériés, talons et sommaires T4 / RL-1", actif: dict.module_paie === "actif" },
          { id: "inspection", label: "Inspection numérique", description: "Inspection multipoint sur le bon (grille complète, rapide ou VR) : état de chaque point, mesures, constats et photos ; rapport envoyé au client par courriel ou texto, qui approuve et signe en ligne les travaux recommandés, ajoutés ensuite au bon", actif: dict.module_inspection !== "inactif" },
          { id: "paiement_en_ligne", label: "Paiement en ligne (Stripe)", description: "Le client paie le solde de sa facture par carte (lien dans le courriel de la facture ou par texto), ou verse un dépôt en approuvant sa soumission ou les travaux de son inspection ; le paiement s'inscrit tout seul sur la facture ou en dépôt, frais de Stripe compris. Exige STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET (avis vers /api/stripe/webhook) dans Railway", actif: dict.module_paiement_en_ligne === "actif" },
          { id: "pneus", label: "Entreposage de pneus", description: "Jeux de pneus des clients gardés à l'atelier : emplacements, étiquettes à code QR, historique, changement de saison sur le bon (pose du jeu entreposé, entreposage de celui qui sort, prix de l'entreposage ajouté au bon) et rappels aux clients avant le 1er décembre et au printemps", actif: dict.module_pneus === "actif" },
          { id: "productivite", label: "Productivité par employés", description: "Rapport de productivité (heures poinçonnées, facturables, poinçons oubliés) et rentabilité par employé", actif: dict.module_productivite !== "inactif" },
          { id: "quarts", label: "Pointage de quart et feuilles de temps", description: "Pointage d'arrivée, de dîner, de pause et de départ à l'horodateur ; feuilles de temps par période (heures supplémentaires à la semaine), efficacité (présence comparée au temps sur les bons), approbation du gérant avec journal des corrections, export CSV / Excel vers un logiciel de paie. La paie et la productivité prennent alors les heures de présence", actif: dict.module_quarts === "actif" },
          { id: "notifications", label: "Notifications", description: "Cloche 🔔, avis automatiques (rendez-vous, pièces reçues, stock bas…) et messages aux employés", actif: dict.module_notifications !== "inactif" },
          { id: "double_verification", label: "Double vérification à la connexion", description: "Gérants et niveau 4 : après le mot de passe, un code à 6 chiffres envoyé par courriel (une fois par appareil aux 30 jours). Exige l'envoi de courriel configuré", actif: dict.module_double_verification === "actif" },
          { id: "documents", label: "Documents", description: "Lettres (référence d'emploi, promotion…), envoi par courriel et envoi groupé aux clients", actif: dict.module_documents === "actif" },
          { id: "jobs_deplacement", label: "Jobs en déplacement", description: "Envoi de bons à des employés précis, avis par notification, suivi GPS des déplacements", actif: dict.module_jobs_deplacement === "actif" },
          { id: "elevage", label: "Élevage", description: "Troupeau (bœuf wagyu…) de la naissance à la table : pesées, coût de revient, abattage, découpe en paquets selon les rendements, vente en boutique et en ligne", actif: dict.module_elevage === "actif" },
          { id: "copropriete", label: "Copropriété", description: "Syndicat de copropriété : unités, copropriétaires, quotes-parts et charges communes, demandes de réparation, bons de travail, entretien préventif, documents et portail sécurisé des copropriétaires", actif: dict.module_copropriete === "actif" },
          { id: "immobilier", label: "Immobilier", description: "Propriétaire d'un ou de plusieurs immeubles locatifs : logements, locataires et baux (avis de modification selon les délais du TAL, renouvellement), loyers et retards, dépenses et rendement par immeuble, réparations, documents. Autonome : relié ni à la comptabilité ni aux autres modules", actif: dict.module_immobilier === "actif" },
        ]}
        atelierDemo={CLIENT.atelierDemo ? await etatAtelierDemo() : null}
        troupeauDemo={troupeauDemo}
        coproDemo={coproDemo}
        immoDemo={immoDemo}
        paieDemo={paieDemo}
        quartsDemo={quartsDemo}
        verrouilleInit={dict.compte_verrouille === "actif"}
        estDeveloppeur={session.role === "DEVELOPPEUR"}
        themeInit={dict.theme_developpeur === "sombre" ? "sombre" : "clair"}
        tailleTexteInit={dict.taille_texte_developpeur === "grand" ? "grand" : "normal"}
      />
    </div>
  );
}
