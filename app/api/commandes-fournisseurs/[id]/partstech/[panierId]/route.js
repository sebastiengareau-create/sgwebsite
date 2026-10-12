import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { ajouterACommande, trouverPieceParNumero, pieceDepuisRecherche } from "@/lib/brouillonsCommande";
import { prochainNumeroFournisseur } from "@/lib/numerotation";

async function charger(params) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) return { erreur: NextResponse.json({ erreur: "Accès refusé." }, { status: 403 }) };
  const panier = await prisma.sessionPartsTech.findUnique({ where: { id: params.panierId }, include: { commande: true } });
  if (!panier || panier.commandeId !== params.id) return { erreur: NextResponse.json({ erreur: "Panier introuvable." }, { status: 404 }) };
  if (panier.importeLe) return { erreur: NextResponse.json({ erreur: "Ce panier a déjà été ajouté." }, { status: 409 }) };
  return { session, panier };
}

// Ajoute un panier PartsTech reçu : chaque fournisseur PartsTech est associé
// (choix de l'employé) à un fournisseur de l'appli, ou en crée un ; ses
// pièces vont dans cette commande si c'est son fournisseur (et qu'elle est
// encore en brouillon), sinon dans le brouillon de leur fournisseur. Même
// logique que la recherche de pièces : fiche trouvée par le numéro, sinon
// créée au prix de vente donné.
// Corps : { choix: [{ fournisseurId } | { creer: true }] (un par fournisseur
// du panier, dans l'ordre), prixVente: { "<i>-<j>": "12.34" } }
export async function POST(request, props) {
  const params = await props.params;
  const { erreur, session, panier } = await charger(params);
  if (erreur) return erreur;
  if (!panier.panier?.fournisseurs?.length) return NextResponse.json({ erreur: "Le panier est vide." }, { status: 400 });

  const corps = await request.json().catch(() => ({}));
  const choix = Array.isArray(corps.choix) ? corps.choix : [];
  const prixVente = corps.prixVente || {};
  const groupes = panier.panier.fournisseurs;

  // Vérifications avant de toucher à quoi que ce soit
  const cibles = [];
  for (let i = 0; i < groupes.length; i++) {
    const c = choix[i] || {};
    if (c.creer) { cibles.push({ creer: true }); continue; }
    const f = c.fournisseurId ? await prisma.fournisseur.findUnique({ where: { id: c.fournisseurId } }) : null;
    if (!f || !f.actif) return NextResponse.json({ erreur: `Choisis le fournisseur de l'appli qui correspond à « ${groupes[i].nom} ».` }, { status: 400 });
    cibles.push({ fournisseur: f });
  }
  const manquants = [];
  for (let i = 0; i < groupes.length; i++) {
    for (let j = 0; j < groupes[i].pieces.length; j++) {
      const p = groupes[i].pieces[j];
      const existante = await trouverPieceParNumero(cibles[i].fournisseur?.id, p.numero);
      if (existante && !existante.actif) {
        return NextResponse.json({ erreur: `Le numéro ${p.numero} est celui de « ${existante.nom} », désactivée dans l'inventaire — réactive-la d'abord.` }, { status: 409 });
      }
      if (!existante && !(Number(String(prixVente[`${i}-${j}`] ?? "").replace(",", ".")) > 0)) manquants.push(p.numero);
    }
  }
  if (manquants.length) {
    return NextResponse.json({ erreur: `Indique le prix de vente des nouvelles pièces : ${manquants.join(", ")}.` }, { status: 400 });
  }

  const resultats = [];
  for (let i = 0; i < groupes.length; i++) {
    const groupe = groupes[i];
    let fournisseur = cibles[i].fournisseur;
    if (cibles[i].creer) {
      const pris = groupe.partstechId != null && (await prisma.fournisseur.findUnique({ where: { partstechId: groupe.partstechId } }));
      fournisseur = await prisma.fournisseur.create({
        data: { numero: await prochainNumeroFournisseur(), nom: groupe.nom, partstechId: pris ? null : groupe.partstechId },
      });
    } else if (groupe.partstechId != null && fournisseur.partstechId !== groupe.partstechId) {
      // Association retenue pour les prochains paniers (déplacée si un autre
      // fournisseur l'avait)
      await prisma.$transaction([
        prisma.fournisseur.updateMany({ where: { partstechId: groupe.partstechId }, data: { partstechId: null } }),
        prisma.fournisseur.update({ where: { id: fournisseur.id }, data: { partstechId: groupe.partstechId } }),
      ]);
    }

    const lignes = [];
    for (let j = 0; j < groupe.pieces.length; j++) {
      const p = groupe.pieces[j];
      const trouvee = await pieceDepuisRecherche({ fournisseurId: fournisseur.id, numero: p.numero, nom: p.nom, cout: p.cout, prixVente: prixVente[`${i}-${j}`] });
      if (trouvee.erreur) return NextResponse.json({ erreur: trouvee.erreur }, { status: trouvee.status });
      lignes.push({ pieceId: trouvee.piece.id, qte: p.qte, coutUnitaire: p.cout ?? undefined, numeroFournisseur: p.numero });
    }
    const dansCetteCommande = fournisseur.id === panier.commande.fournisseurId && panier.commande.statut === "BROUILLON";
    const commande = await ajouterACommande({
      fournisseurId: fournisseur.id,
      lignes,
      commandeId: dansCetteCommande ? panier.commandeId : undefined,
      ajouterAuBrouillon: true,
      note: `Panier PartsTech (depuis ${panier.commande.numero})`,
      creePar: session.nom,
    });
    resultats.push({ fournisseur: fournisseur.nom, commandeId: commande.id, numero: commande.numero, pieces: lignes.length, dansCetteCommande });
  }

  await prisma.sessionPartsTech.update({ where: { id: panier.id }, data: { importeLe: new Date() } });
  return NextResponse.json({ resultats });
}

// « Ignorer ce panier »
export async function DELETE(request, props) {
  const params = await props.params;
  const { erreur, panier } = await charger(params);
  if (erreur) return erreur;
  await prisma.sessionPartsTech.delete({ where: { id: panier.id } });
  return NextResponse.json({ ok: true });
}
