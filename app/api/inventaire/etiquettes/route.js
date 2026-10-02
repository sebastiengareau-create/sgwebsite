import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { genererPdfEtiquettesPieces, FORMATS_ETIQUETTES } from "@/lib/pdfEtiquettesPieces";
import { urlEtiquettePiece } from "@/lib/codesBarres";

const MAX_ETIQUETTES = 3000;

// Adresse publique de l'appli, encodée dans les QR : celle d'où l'utilisateur
// imprime (envoyée par le navigateur), sinon reconstituée des en-têtes du
// proxy (Railway).
function origineAppli(request, origineNavigateur) {
  if (typeof origineNavigateur === "string" && /^https?:\/\/[^/\s]+$/.test(origineNavigateur)) return origineNavigateur;
  const hote = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const protocole = request.headers.get("x-forwarded-proto") || "https";
  return `${protocole}://${hote}`;
}

export async function POST(request) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) {
    return Response.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  // elements : [{ id, copies }] — copies : un nombre, ou "stock" pour une
  // étiquette par unité en stock.
  const { elements, format, depart, origine } = await request.json();
  if (!FORMATS_ETIQUETTES[format]) return Response.json({ erreur: "Format d'étiquette inconnu." }, { status: 400 });
  if (!Array.isArray(elements) || elements.length === 0) return Response.json({ erreur: "Aucune pièce choisie." }, { status: 400 });

  const pieces = await prisma.piece.findMany({ where: { id: { in: elements.map((e) => String(e.id)) } } });
  const parId = new Map(pieces.map((p) => [p.id, p]));
  const base = origineAppli(request, origine);

  const etiquettes = [];
  for (const { id, copies } of elements) {
    const piece = parId.get(id);
    if (!piece) continue;
    const nombre = copies === "stock" ? Math.max(0, piece.qte) : Math.max(0, Math.floor(Number(copies) || 0));
    const etiquette = { nom: piece.nom, numero: piece.numero, emplacement: piece.emplacement, contenuQr: urlEtiquettePiece(base, piece.id) };
    for (let i = 0; i < nombre; i++) etiquettes.push(etiquette);
  }
  if (etiquettes.length === 0) return Response.json({ erreur: "Aucune étiquette à imprimer (stock à zéro ?)." }, { status: 400 });
  if (etiquettes.length > MAX_ETIQUETTES) {
    return Response.json({ erreur: `Trop d'étiquettes d'un coup (${etiquettes.length}) — maximum ${MAX_ETIQUETTES}.` }, { status: 400 });
  }

  const pdf = await genererPdfEtiquettesPieces(etiquettes, format, depart);
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="etiquettes-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
