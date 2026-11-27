import { prisma } from "@/lib/prisma";
import { sessionImmo } from "@/lib/immobilier";
import { routesPhotoBatiment } from "@/lib/photoBatimentServeur";

// Photo de l'immeuble, ou vue de la rue (?vue=rue) — lib/photoBatimentServeur.js
export const { GET, POST, DELETE } = routesPhotoBatiment({
  champ: "immeubleId",
  session: sessionImmo,
  trouver: (id) => prisma.immeubleImmo.findUnique({ where: { id }, select: { adresse: true, ville: true, codePostal: true } }),
});
