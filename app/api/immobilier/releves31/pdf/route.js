import { prisma } from "@/lib/prisma";
import { sessionImmo, refus, erreur } from "@/lib/immobilier";
import { bailAu31Decembre, donneesReleve31 } from "@/lib/immobilierCalculs";
import { obtenirInfosEntreprise } from "@/lib/config";
import { lireLocateur } from "@/lib/locateurImmo";
import { releves31Pdf } from "@/lib/pdfReleve31";

// Relevés 31 en PDF, une page par locataire : ?annee=2026 (tous les
// logements occupés au 31 décembre) ou &bailId=… (un seul logement) ;
// &proprietaire=1 ajoute une copie pour les dossiers du propriétaire
export async function GET(request) {
  const session = await sessionImmo();
  if (!session) return refus();
  const params = new URL(request.url).searchParams;
  const annee = Number(params.get("annee"));
  if (!(annee >= 2000 && annee <= 2100)) return erreur("Année invalide.");
  const bailId = params.get("bailId");
  const baux = await prisma.bailImmo.findMany({
    where: {
      ...(bailId ? { id: bailId } : {}),
      dateDebut: { lte: new Date(Date.UTC(annee, 11, 31, 23)) },
      OR: [{ dateFin: null }, { dateFin: { gte: new Date(Date.UTC(annee, 11, 31)) } }],
      logement: { type: "LOGEMENT" },
    },
    select: {
      id: true, dateDebut: true, dateFin: true, terminaisonLe: true,
      locataires: { select: { nom: true }, orderBy: { nom: "asc" } },
      logement: { select: { numero: true, type: true, numeroLogementRq: true, adresseCivique: true, immeuble: { select: { nom: true, adresse: true, ville: true, codePostal: true } } } },
    },
  });
  const releves = baux
    .filter((b) => bailAu31Decembre(b, annee))
    .sort((a, b) => a.logement.immeuble.nom.localeCompare(b.logement.immeuble.nom) || a.logement.numero.localeCompare(b.logement.numero, "fr", { numeric: true }))
    .map((b) => ({ rl: donneesReleve31(b) }));
  if (bailId && releves.length === 0) return erreur(`Ce bail n'était pas en cours au 31 décembre ${annee}.`, 404);

  const entreprise = await obtenirInfosEntreprise();
  const { locateurs } = await lireLocateur(entreprise);
  const l = locateurs[0] || {};
  const proprietaire = {
    nom: locateurs.map((x) => x.nom).filter(Boolean).join(" et ") || entreprise.nomEntreprise || "",
    adresse: [[l.no, l.rue].filter(Boolean).join(" ") + (l.app ? `, app. ${l.app}` : ""), l.ville, l.codePostal].filter(Boolean).join(", "),
    telephone: l.telephone || "",
  };
  const pdf = await releves31Pdf({ annee, releves, proprietaire, copieProprietaire: params.get("proprietaire") === "1" });
  const nom = bailId ? `releve-31-${annee}-${releves[0].rl.c1 || releves[0].rl.c2 || "logement"}` : `releves-31-${annee}`;
  return new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${nom.replace(/[^\w.-]+/g, "-")}.pdf"` } });
}
