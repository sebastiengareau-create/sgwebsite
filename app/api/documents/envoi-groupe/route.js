import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { remplirModele, passagesACompleter } from "@/lib/documents";
import { peutGererDestinataire, preparerValeurs } from "@/lib/documentsServeur";
import { courrielConfigure, courrielValide, preparerCourriel, envoyerCourriels } from "@/lib/courrielDocuments";

// Envoi groupé d'un modèle aux clients choisis — { modeleId, sujet,
// contenu, clientIds }. Le contenu (le modèle, ajusté pour cet envoi) est
// rempli pour chaque client ; ceux sans courriel ou désabonnés sont ignorés.
export async function POST(request) {
  const session = await obtenirSession();
  const { modeleId, sujet, contenu, clientIds } = await request.json().catch(() => ({}));
  const modele = modeleId ? await prisma.modeleDocument.findUnique({ where: { id: String(modeleId) } }) : null;
  if (!modele || modele.destinataire !== "CLIENT") return NextResponse.json({ erreur: "Modèle introuvable." }, { status: 404 });
  if (!(await peutGererDestinataire(session, "CLIENT"))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  if (!courrielConfigure()) return NextResponse.json({ erreur: "L'envoi de courriel n'est pas configuré (RESEND_API_KEY manquant)." }, { status: 400 });

  const sujetModele = String(sujet || "").trim();
  const texteModele = String(contenu || "").trim();
  if (!sujetModele || !texteModele) return NextResponse.json({ erreur: "Le sujet et le texte sont requis." }, { status: 400 });
  // Personne ne relit chaque courriel : rien ne doit rester à compléter
  const restants = passagesACompleter(`${sujetModele}\n${texteModele}`);
  if (restants.length) return NextResponse.json({ erreur: `À compléter avant l'envoi : ${restants.join(" · ")}` }, { status: 400 });
  if (!Array.isArray(clientIds) || clientIds.length === 0) return NextResponse.json({ erreur: "Aucun client choisi." }, { status: 400 });

  const clients = await prisma.client.findMany({ where: { id: { in: clientIds.map(String) } } });
  const destinataires = clients.filter((c) => !c.promotionsRefuseesLe && courrielValide(c.courriel?.trim()));
  const { entreprise, pour } = await preparerValeurs(session, "CLIENT");
  const courriels = await Promise.all(destinataires.map(async (c) => {
    const valeurs = await pour(c);
    return preparerCourriel({
      a: c.courriel.trim(),
      sujet: remplirModele(sujetModele, valeurs, "CLIENT", { effacerVides: true }),
      texte: remplirModele(texteModele, valeurs, "CLIENT", { effacerVides: true }),
      entreprise, clientId: c.id,
    });
  }));

  const { envoyes, echecs } = await envoyerCourriels(courriels);
  return NextResponse.json({ envoyes, echecs, ignores: clients.length - destinataires.length });
}
