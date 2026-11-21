import { NextResponse } from "next/server";
import { obtenirSession } from "@/lib/auth";
import { obtenirInfosEntreprise } from "@/lib/config";
import { calculerFeuillets } from "@/lib/feuilletsFiscaux";
import { genererT4Xml, verifierPreparation, lireCodeDentaireDefaut } from "@/lib/finAnnee";
import { accesPaieActif, anneeDemandee } from "@/lib/accesPaie";

// Déclaration T4 de l'année en XML (?annee=AAAA), à transmettre à l'ARC par
// le Transfert de fichiers par Internet. Refusée (409, liste de ce qui
// manque) tant qu'un renseignement obligatoire manque. Contient les NAS.
export async function GET(request) {
  const session = await obtenirSession();
  if (!(await accesPaieActif(session))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  const annee = anneeDemandee(request);
  if (!annee) return NextResponse.json({ erreur: "Année invalide." }, { status: 400 });

  const [entreprise, { feuillets }, codeDentaireDefaut] = await Promise.all([obtenirInfosEntreprise(), calculerFeuillets(annee), lireCodeDentaireDefaut()]);
  if (feuillets.length === 0) return NextResponse.json({ erreur: `Aucune paie versée en ${annee}.` }, { status: 409 });
  const { bloquants } = verifierPreparation({ entreprise, feuillets });
  if (bloquants.length > 0) return NextResponse.json({ erreur: "Il manque des renseignements avant de produire le fichier.", manque: bloquants }, { status: 409 });

  const { xml, nomFichier } = genererT4Xml({ annee, feuillets, entreprise, codeDentaireDefaut });
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
      "Cache-Control": "no-store",
    },
  });
}
