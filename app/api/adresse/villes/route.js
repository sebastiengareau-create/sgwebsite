import { NextResponse } from "next/server";
import { obtenirSession } from "@/lib/auth";
import { MUNICIPALITES, cleVille } from "@/lib/municipalitesQuebec";
import { villesDuSecteur } from "@/lib/secteursPostaux";

const MAX = 15;

// Suggestions du champ Ville, sans service externe : d'abord les
// municipalités du secteur postal (?cp=J7Y…), puis celles du Québec dont le
// nom commence par le texte tapé (?q=), puis celles qui le contiennent.
export async function GET(request) {
  const session = await obtenirSession();
  if (!session) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const cle = cleVille(String(searchParams.get("q") || "").slice(0, 100));
  const secteur = villesDuSecteur(searchParams.get("cp"));

  const correspond = (nom) => !cle || cleVille(nom).includes(cle);
  const commence = (nom) => cleVille(nom).startsWith(cle);
  const villes = new Set(secteur.filter(correspond));
  if (cle) {
    for (const nom of [...MUNICIPALITES.filter(commence), ...MUNICIPALITES.filter(correspond)]) {
      if (villes.size >= secteur.length + MAX) break;
      villes.add(nom);
    }
  }
  return NextResponse.json({ villes: [...villes], secteur });
}
