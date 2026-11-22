import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { obtenirInfosEntreprise } from "@/lib/config";
import { origineAppli } from "@/lib/origine";
import { libelleVehicule } from "@/lib/vehicules";
import { refusPneus, urlJeu } from "@/lib/pneus";
import { genererPdfEtiquettesPneus } from "@/lib/pdfEtiquettesPneus";
import { FORMATS_ETIQUETTES_PNEUS, JANTES, libelleJeu } from "@/lib/pneusCalculs";

// Étiquettes d'un jeu (PDF) : une par pneu (copies, par défaut la quantité
// du jeu), avec un QR vers sa fiche. { jeuId, copies, format, depart, origine }
export async function POST(request) {
  const session = await obtenirSession();
  const refus = await refusPneus(session);
  if (refus) return Response.json({ erreur: refus.erreur }, { status: refus.status });
  const { jeuId, copies, format, depart, origine } = await request.json().catch(() => ({}));
  if (!FORMATS_ETIQUETTES_PNEUS.some((f) => f.code === format)) return Response.json({ erreur: "Format d'étiquette inconnu." }, { status: 400 });

  const [jeu, { nomEntreprise }] = await Promise.all([
    prisma.jeuPneus.findUnique({ where: { id: String(jeuId || "") }, include: { client: { select: { nom: true } }, vehicule: true } }),
    obtenirInfosEntreprise(),
  ]);
  if (!jeu) return Response.json({ erreur: "Jeu de pneus introuvable." }, { status: 404 });
  const nombre = Math.min(12, Math.max(1, Math.floor(Number(copies) || jeu.quantite)));
  const vehicule = jeu.vehicule ? [libelleVehicule(jeu.vehicule), jeu.vehicule.plaque].filter(Boolean).join(" · ") : null;
  const base = origineAppli(request, origine);

  const etiquettes = Array.from({ length: nombre }, (_, i) => ({
    contenuQr: urlJeu(base, jeu.id),
    entete: nomEntreprise,
    titre: `${jeu.numero} · ${jeu.client.nom}`,
    details: [vehicule, `${libelleJeu(jeu)} · ${JANTES[jeu.jantes] || ""}`, jeu.marque && [jeu.marque, jeu.modele].filter(Boolean).join(" ")],
    pied: `${jeu.emplacement ? `Emplacement ${jeu.emplacement} · ` : ""}pneu ${i + 1} de ${nombre}`,
  }));
  const pdf = await genererPdfEtiquettesPneus(etiquettes, format, depart);
  return new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="etiquettes-${jeu.numero}.pdf"` } });
}
