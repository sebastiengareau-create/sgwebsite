import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection, estGerantOuDev } from "@/lib/auth";
import { obtenirInfosEntreprise } from "@/lib/config";
import { courrielConfigure } from "@/lib/courrielDocuments";
import { lireReglagesRappels, vehiculesARelancer, texteRappel } from "@/lib/rappelsEntretien";
import EnTete from "../../../components/EnTete";
import RappelsClient from "./RappelsClient";

// Rappels d'entretien : véhicules qui ne sont pas revenus depuis un certain
// temps, à relancer par courriel — voir lib/rappelsEntretien.js
export default async function RappelsEntretien() {
  const session = await obtenirSession();
  if (!session) redirect("/login");
  if (!(await aAccesSection(session, "clients"))) redirect("/mecanicien");

  const reglages = await lireReglagesRappels();
  const [vehicules, entreprise] = await Promise.all([vehiculesARelancer(reglages), obtenirInfosEntreprise()]);
  // Aperçu du courriel : celui du premier client prêt (tous ses véhicules), sinon un exemple
  const premier = vehicules.find((v) => v.etat === "PRET");
  const exemple = premier
    ? vehicules.filter((v) => v.etat === "PRET" && v.client.id === premier.client.id)
    : [{ vehicule: "Honda Civic 2019", kilometrage: 85000, derniereVisite: new Date(Date.now() - reglages.mois * 30.5 * 86400000), client: { nom: "Julie Lavoie" } }];
  const apercu = texteRappel({ nomClient: exemple[0].client.nom, vehicules: exemple, entreprise, lien: reglages.lien });

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <RappelsClient
        vehicules={vehicules} reglages={reglages} apercu={apercu}
        courrielConfigure={courrielConfigure()} peutRegler={estGerantOuDev(session)} nomEntreprise={entreprise.nomEntreprise}
      />
    </div>
  );
}
