import { prisma } from "@/lib/prisma";
import { sessionElevage } from "@/lib/elevage";
import { genererPdfEtiquettesElevage } from "@/lib/pdfEtiquettesElevage";
import {
  FORMATS_ETIQUETTES_ELEVAGE, GENETIQUES, SEXES, libelle, dateCourte, stockLot, urlEtiquetteLot, urlEtiquetteBete,
} from "@/lib/elevageCalculs";
import { obtenirInfosEntreprise } from "@/lib/config";
import { origineAppli } from "@/lib/origine";

const MAX_ETIQUETTES = 3000;

const genetique = (bete) => [bete.genetique && libelle(GENETIQUES, bete.genetique).split(" (")[0], bete.pourcentageWagyu != null && `${bete.pourcentageWagyu} % wagyu`].filter(Boolean).join(" · ");

// Planche d'étiquettes (PDF) d'une bête :
//  - type "viande" : les paquets de sa découpe — copies "recus" (une par
//    paquet reçu du boucher) ou "stock" (une par paquet encore en stock) ;
//    lotIds limite à certaines coupes ;
//  - type "bete" : son étiquette d'enclos, en `copies` exemplaires.
export async function POST(request) {
  if (!(await sessionElevage())) return Response.json({ erreur: "Accès refusé." }, { status: 403 });
  const { type, beteId, lotIds, copies, format, depart, origine } = await request.json();
  if (!FORMATS_ETIQUETTES_ELEVAGE.some((f) => f.code === format)) return Response.json({ erreur: "Format d'étiquette inconnu." }, { status: 400 });

  const [bete, { nomEntreprise }] = await Promise.all([
    prisma.bete.findUnique({
      where: { id: String(beteId || "") },
      include: { abattage: { include: { lots: { include: { coupe: true, ventes: { select: { nbPaquets: true, poids: true } } }, orderBy: { coupe: { ordre: "asc" } } } } } },
    }),
    obtenirInfosEntreprise(),
  ]);
  if (!bete) return Response.json({ erreur: "Bête introuvable." }, { status: 404 });
  const base = origineAppli(request, origine);
  const nomBete = `${bete.numero}${bete.nom ? ` — ${bete.nom}` : ""}`;

  const etiquettes = [];
  if (type === "bete") {
    const nombre = Math.min(100, Math.max(1, Math.floor(Number(copies) || 1)));
    const etiquette = {
      contenuQr: urlEtiquetteBete(base, bete.id), entete: nomEntreprise, titre: nomBete,
      details: [
        [libelle(SEXES, bete.sexe).split(" (")[0], bete.dateNaissance && `née le ${dateCourte(bete.dateNaissance)}`].filter(Boolean).join(" · "),
        genetique(bete),
      ],
      pied: bete.identifiant ? `Boucle ${bete.identifiant}` : null,
    };
    for (let i = 0; i < nombre; i++) etiquettes.push(etiquette);
  } else {
    if (!bete.abattage) return Response.json({ erreur: "Cette bête n'est pas abattue : elle n'a pas de paquets." }, { status: 400 });
    const choisis = Array.isArray(lotIds) && lotIds.length > 0 ? new Set(lotIds.map(String)) : null;
    for (const lot of bete.abattage.lots) {
      if (choisis && !choisis.has(lot.id)) continue;
      const nombre = copies === "stock" ? Math.max(0, stockLot(lot).paquets) : lot.nbPaquets;
      const etiquette = {
        contenuQr: urlEtiquetteLot(base, lot.id), entete: nomEntreprise, titre: lot.coupe.nom,
        details: [genetique(bete), bete.abattage.bms && `Persillage BMS ${bete.abattage.bms}`, `Bête ${nomBete}`],
        pied: `Abattage ${dateCourte(bete.abattage.date)}`,
      };
      for (let i = 0; i < nombre; i++) etiquettes.push(etiquette);
    }
  }
  if (etiquettes.length === 0) return Response.json({ erreur: "Aucune étiquette à imprimer (plus de paquets en stock ?)." }, { status: 400 });
  if (etiquettes.length > MAX_ETIQUETTES) return Response.json({ erreur: `Trop d'étiquettes d'un coup (${etiquettes.length}) — maximum ${MAX_ETIQUETTES}.` }, { status: 400 });

  const pdf = await genererPdfEtiquettesElevage(etiquettes, format, depart);
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="etiquettes-${bete.numero}.pdf"`,
    },
  });
}
