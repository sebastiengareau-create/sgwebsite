import { prisma } from "@/lib/prisma";
import { sessionCopro } from "@/lib/copropriete";
import { routesPhotoBatiment } from "@/lib/photoBatimentServeur";

// Photo du bâtiment, ou vue de la rue (?vue=rue) — lib/photoBatimentServeur.js
export const { GET, POST, DELETE } = routesPhotoBatiment({
  champ: "batimentId",
  session: sessionCopro,
  trouver: (id) => prisma.batimentCopro.findUnique({ where: { id }, select: { adresse: true } }),
});
