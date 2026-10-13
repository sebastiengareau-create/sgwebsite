import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { obtenirInfosEntreprise } from "@/lib/config";
import { genererPdfRapportInventaire } from "@/lib/pdfRapportInventaire";
import { FILTRE_PIECES_RAPPORT, INCLUDE_PIECES_RAPPORT, trierPieces, libellePieceRapport, libelleNumerosFournisseurs } from "@/lib/rapportInventaire";

export async function GET(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite")) && !(await aAccesSection(session, "inventaire"))) {
    return new Response(JSON.stringify({ erreur: "Accès refusé." }), { status: 403 });
  }

  const tri = new URL(request.url).searchParams.get("tri");
  const [piecesBrutes, { nomEntreprise }] = await Promise.all([
    prisma.piece.findMany({ where: FILTRE_PIECES_RAPPORT, include: INCLUDE_PIECES_RAPPORT }),
    obtenirInfosEntreprise(),
  ]);
  const pieces = trierPieces(piecesBrutes, tri);

  const pdf = await genererPdfRapportInventaire(pieces.map((p) => ({ ...p, nom: libellePieceRapport(p), numerosFournisseurs: libelleNumerosFournisseurs(p) })), nomEntreprise);
  const nomFichier = `rapport-inventaire-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nomFichier}"`,
    },
  });
}
