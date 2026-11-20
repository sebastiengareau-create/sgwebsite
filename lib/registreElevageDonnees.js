// Lecture en base du registre de l'élevage (lib/registreElevage.js)
import { prisma } from "./prisma";
import { evenementsRegistre } from "./registreElevage";

// Toutes les bêtes avec ce qu'il faut au registre, et les événements déjà
// déclarés → { betes, evenements }
export async function chargerRegistre() {
  const [betes, declarations] = await Promise.all([
    prisma.bete.findMany({
      select: {
        id: true, numero: true, nom: true, identifiant: true, sexe: true, statut: true, origine: true, dateNaissance: true,
        dateAcquisition: true, provenance: true, dateSortie: true,
        deplacements: true, boucles: true, abattage: { select: { date: true, abattoir: true } },
      },
      orderBy: { numero: "asc" },
    }),
    prisma.declarationAtq.findMany(),
  ]);
  return { betes, evenements: evenementsRegistre(betes, new Map(declarations.map((d) => [d.cle, d]))) };
}
