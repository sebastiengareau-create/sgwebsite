import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { accesPaieActif } from "@/lib/accesPaie";
import { obtenirInfosEntreprise } from "@/lib/config";
import { dateAujourdhuiQuebec } from "@/lib/temps";
import { nasValide } from "@/lib/nas";
import { calculerFeuillets } from "@/lib/feuilletsFiscaux";
import { verifierPreparation, echeanceFeuillets, lireCodeDentaireDefaut, codePostalCanada, casesT4 } from "@/lib/finAnnee";
import { etatRl1 } from "@/lib/rl1";
import EnTete from "../../../components/EnTete";
import BandeauSection from "../../../components/BandeauSection";
import FinAnneeClient from "./FinAnneeClient";

export const metadata = { title: "Fin d'année de paie" };
const DATE = new Intl.DateTimeFormat("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

// Fin d'année de paie (?annee=AAAA) : vérifications, déclaration T4 en XML
// pour l'ARC, copies T4 des employés, RL-1 et relevés d'emploi
export default async function FinAnnee(props) {
  const session = await obtenirSession();
  if (!(await accesPaieActif(session))) redirect("/gerant");
  const { annee: anneeParam } = await props.searchParams;
  const [anCourant, moisCourant] = dateAujourdhuiQuebec().split("-").map(Number);
  const anneeDefaut = moisCourant <= 3 ? anCourant - 1 : anCourant;
  const annee = /^\d{4}$/.test(anneeParam || "") ? Number(anneeParam) : anneeDefaut;

  const [entreprise, { feuillets, totaux, nbBrouillons, maximumsAJour, anneeMaximums }, codeDentaireDefaut, nbRelevesBrouillon] = await Promise.all([
    obtenirInfosEntreprise(),
    calculerFeuillets(annee),
    lireCodeDentaireDefaut(),
    prisma.releveEmploi.count({ where: { statut: "BROUILLON" } }),
  ]);
  const { bloquants, aVerifier } = verifierPreparation({ entreprise, feuillets });
  if (nbBrouillons > 0) aVerifier.unshift(`${nbBrouillons} paie${nbBrouillons > 1 ? "s" : ""} de ${annee} encore en brouillon ne ${nbBrouillons > 1 ? "sont" : "est"} pas comptée${nbBrouillons > 1 ? "s" : ""}.`);
  if (!maximumsAJour) aVerifier.unshift(`Les gains admissibles (cases 24, 26, 56) utilisent les maximums de ${anneeMaximums}, pas ceux de ${annee}.`);
  const sommeT4 = (cle) => feuillets.reduce((s, f) => s + casesT4(f)[cle], 0);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <div className="conteneur-page" style={{ paddingBottom: 40 }}>
        <Link href="/gerant/paie" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à la paie</Link>
        <div style={{ marginTop: 8 }}>
          <BandeauSection icone="🧾" titre={`Fin d'année de paie ${annee}`} sousTitre={`T4, RL-1 et copies des employés — au plus tard le ${DATE.format(new Date(`${echeanceFeuillets(annee)}T12:00:00Z`))}`} />
        </div>
        <FinAnneeClient
          annee={annee}
          annees={[anCourant, anCourant - 1, anCourant - 2]}
          bloquants={bloquants}
          aVerifier={aVerifier}
          codeDentaireDefaut={codeDentaireDefaut}
          employes={feuillets.map((f) => ({
            id: f.employe.id, nom: f.employe.nom, prenom: f.employe.prenom || "", nomFamille: f.employe.nomFamille || "",
            codeDentaireT4: f.employe.codeDentaireT4 ?? "", nasOk: nasValide(f.employe.nas),
            adresseOk: !!(f.employe.adresse && f.employe.ville && codePostalCanada(f.employe.codePostal)),
          }))}
          t4={{ nb: feuillets.length, revenus: totaux.revenus, impot: totaux.impotFederal, ae: sommeT4("empe_eip_amt"), aeEmployeur: totaux.aeEmployeur }}
          rl1={{ ...etatRl1(annee, entreprise), numeroRq: entreprise.numeroEmployeurRq || "" }}
          nbRelevesBrouillon={nbRelevesBrouillon}
        />
      </div>
    </div>
  );
}
