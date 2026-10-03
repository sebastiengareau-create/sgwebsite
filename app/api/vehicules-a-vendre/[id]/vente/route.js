import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { obtenirSession, aAccesSection, estGerantOuDev } from "@/lib/auth";
import { creerAvecNumero, prochainNumeroClient } from "@/lib/numerotation";
import { verifierPeriodeModifiable } from "@/lib/comptabilite";
import { trouverDoublonsClient, messageDoublons } from "@/lib/clients";
import { CLIENT } from "@/lib/client";
import {
  coutantTotal, obtenirClientInterne, prochainNumeroFactureVente, posterVenteEmise, posterVentePayee,
} from "@/lib/vehiculesAVendre";

async function acces(session) {
  return CLIENT.vehiculesAVendre && (await aAccesSection(session, "inventaire"));
}

function messageComptable(e) {
  if (e.message.startsWith("PERIODE_LOCK:")) return e.message.replace("PERIODE_LOCK:", "").split("\n")[0];
  console.error("Erreur comptabilisation vente de véhicule :", e);
  return null;
}

async function compteEncaissement(compteTresorerieId) {
  if (!compteTresorerieId) return null;
  return prisma.compteTresorerie.findUnique({ where: { id: compteTresorerieId }, include: { compte: true } });
}

// Vend le véhicule : émet la facture de vente (taxes normales) au client
// acheteur — existant (clientId) ou nouveau (clientNom…) — et fige le
// coûtant. Le dossier véhicule passe au client, pour ses prochains bons.
// payee : encaissée tout de suite (compte + mode de paiement).
export async function POST(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await acces(session))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });

  const body = await request.json();
  const prixVente = Math.round(Number(String(body.prixVente ?? "").replace(",", ".").replace(/\s/g, "")) * 100) / 100;
  if (!Number.isFinite(prixVente) || prixVente <= 0) return NextResponse.json({ erreur: "Indique le prix de vente." }, { status: 400 });

  const vv = await prisma.vehiculeVente.findUnique({
    where: { id: params.id },
    include: { factureVente: true, bons: { include: { facture: true } } },
  });
  if (!vv) return NextResponse.json({ erreur: "Véhicule introuvable." }, { status: 404 });
  if (vv.factureVente) return NextResponse.json({ erreur: "Ce véhicule est déjà vendu." }, { status: 409 });
  // Le coûtant se fige à la vente : tous les bons doivent être facturés
  const ouverts = vv.bons.filter((b) => !b.facture);
  if (ouverts.length > 0) {
    return NextResponse.json({ erreur: `Facture d'abord ${ouverts.length > 1 ? "les bons" : "le bon"} ${ouverts.map((b) => `#${b.numero}`).join(", ")} (ou supprime-${ouverts.length > 1 ? "les" : "le"}) : leur montant doit être compris dans le coûtant.` }, { status: 409 });
  }

  let compteTresorerie = null;
  if (body.payee) {
    compteTresorerie = await compteEncaissement(body.compteTresorerieId);
    if (!compteTresorerie) return NextResponse.json({ erreur: "Choisis un compte pour l'encaissement." }, { status: 400 });
  }

  // Acheteur
  const interne = await obtenirClientInterne();
  let clientId = body.clientId || null;
  if (clientId) {
    if (clientId === interne.id || !(await prisma.client.findUnique({ where: { id: clientId } }))) {
      return NextResponse.json({ erreur: "Client introuvable." }, { status: 400 });
    }
  } else {
    const nom = String(body.clientNom || "").trim();
    if (!nom) return NextResponse.json({ erreur: "Choisis l'acheteur ou entre son nom." }, { status: 400 });
    if (!body.confirmerDoublon) {
      const doublons = await trouverDoublonsClient({ nom, telephone: body.clientTelephone });
      if (doublons.length > 0) {
        return NextResponse.json({ erreur: `${messageDoublons(doublons)} Choisis-le dans la liste, ou confirme qu'il s'agit d'un autre client.`, doublonPossible: true }, { status: 409 });
      }
    }
    const client = await creerAvecNumero(prochainNumeroClient, (numero) => prisma.client.create({
      data: {
        numero, nom,
        telephone: String(body.clientTelephone || "").trim() || null,
        courriel: String(body.clientCourriel || "").trim() || null,
        adresse: String(body.clientAdresse || "").trim() || null,
        ville: String(body.clientVille || "").trim() || null,
        codePostal: String(body.clientCodePostal || "").trim() || null,
      },
    }));
    clientId = client.id;
  }

  const parametres = await prisma.parametre.findMany({ where: { cle: { in: ["tps_taux", "tvq_taux"] } } });
  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));
  const tpsMontant = Math.round(prixVente * Number(dict.tps_taux || 5)) / 100;
  const tvqMontant = Math.round(prixVente * Number(dict.tvq_taux || 9.975)) / 100;
  const maintenant = new Date();

  const fv = await creerAvecNumero(prochainNumeroFactureVente, (numero) => prisma.$transaction(async (tx) => {
    const f = await tx.factureVente.create({
      data: {
        numero,
        vehiculeVenteId: vv.id,
        clientId,
        prixVente,
        tpsMontant,
        tvqMontant,
        totalAvecTaxes: Math.round((prixVente + tpsMontant + tvqMontant) * 100) / 100,
        coutantVehicule: Math.round(coutantTotal(vv) * 100) / 100,
        note: String(body.note || "").trim() || null,
        dateEmission: maintenant,
        creePar: session.nom,
        ...(compteTresorerie && {
          statut: "PAYEE", datePaiement: maintenant, compteTresorerieId: compteTresorerie.id,
          modePaiement: body.modePaiement || null, referenceVersement: String(body.reference || "").trim() || null,
        }),
      },
    });
    await tx.vehiculeVente.update({ where: { id: vv.id }, data: { statut: "VENDU" } });
    await tx.vehicule.update({ where: { id: vv.vehiculeId }, data: { clientId } });
    return f;
  }));

  let avertissementComptable = null;
  try {
    await posterVenteEmise(fv, vv, session.nom);
    if (compteTresorerie) await posterVentePayee(fv, compteTresorerie.compte.numero, fv.modePaiement, session.nom);
  } catch (e) {
    avertissementComptable = messageComptable(e);
  }
  return NextResponse.json({ id: fv.id, numero: fv.numero, avertissementComptable });
}

// Encaissement de la facture de vente (statut PAYEE / IMPAYEE)
export async function PATCH(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await acces(session))) return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });

  const { statut, compteTresorerieId, modePaiement, reference } = await request.json();
  if (!["IMPAYEE", "PAYEE"].includes(statut)) return NextResponse.json({ erreur: "Statut invalide." }, { status: 400 });
  const ancienne = await prisma.factureVente.findUnique({ where: { vehiculeVenteId: params.id } });
  if (!ancienne) return NextResponse.json({ erreur: "Aucune facture de vente." }, { status: 404 });

  let compteTresorerie = null;
  if (statut === "PAYEE") {
    compteTresorerie = await compteEncaissement(compteTresorerieId);
    if (!compteTresorerie) return NextResponse.json({ erreur: "Choisis un compte pour l'encaissement." }, { status: 400 });
  }
  const payee = statut === "PAYEE";
  const fv = await prisma.factureVente.update({
    where: { id: ancienne.id },
    data: {
      statut,
      datePaiement: payee ? new Date() : null,
      compteTresorerieId: payee ? compteTresorerie.id : null,
      modePaiement: payee ? modePaiement || null : null,
      referenceVersement: payee ? String(reference || "").trim() || null : null,
    },
  });

  // Comme une facture de bon : l'encaissement se comptabilise au passage à
  // « Payée » ; revenir à « Impayée » retire l'écriture d'encaissement.
  let avertissementComptable = null;
  try {
    if (payee && ancienne.statut !== "PAYEE") {
      await posterVentePayee(fv, compteTresorerie.compte.numero, fv.modePaiement, session.nom);
    } else if (!payee && ancienne.statut === "PAYEE") {
      const ecritures = await prisma.ecritureComptable.findMany({ where: { source: "VENTE_VEHICULE_PAYEE", sourceId: fv.id } });
      for (const e of ecritures) await verifierPeriodeModifiable(e.date, { nouvellePiece: false });
      await prisma.ecritureComptable.deleteMany({ where: { source: "VENTE_VEHICULE_PAYEE", sourceId: fv.id } });
    }
  } catch (e) {
    avertissementComptable = messageComptable(e);
  }
  return NextResponse.json({ ok: true, avertissementComptable });
}

// Annule la vente (gérant) : la facture de vente et ses écritures sont
// retirées, le véhicule revient en stock et dans le dossier interne.
export async function DELETE(request, props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await acces(session)) || !estGerantOuDev(session)) {
    return NextResponse.json({ erreur: "Seul le gérant peut annuler une vente." }, { status: 403 });
  }

  const vv = await prisma.vehiculeVente.findUnique({ where: { id: params.id }, include: { factureVente: true } });
  if (!vv?.factureVente) return NextResponse.json({ erreur: "Aucune facture de vente." }, { status: 404 });
  // Le véhicule revient au dossier interne : impossible s'il a déjà des
  // bons au nom de son acheteur
  const bonsAcheteur = await prisma.bonTravail.count({ where: { vehiculeId: vv.vehiculeId, vehiculeVenteId: null } });
  if (bonsAcheteur > 0) {
    return NextResponse.json({ erreur: "L'acheteur a déjà des bons de travail sur ce véhicule — la vente ne peut plus être annulée." }, { status: 409 });
  }
  try {
    await verifierPeriodeModifiable(vv.factureVente.dateEmission, { nouvellePiece: false });
  } catch (e) {
    return NextResponse.json({ erreur: e.message.replace("PERIODE_LOCK:", "") }, { status: 423 });
  }

  const interne = await obtenirClientInterne();
  await prisma.$transaction(async (tx) => {
    await tx.ecritureComptable.deleteMany({ where: { source: { in: ["VENTE_VEHICULE_EMISE", "VENTE_VEHICULE_PAYEE"] }, sourceId: vv.factureVente.id } });
    await tx.factureVente.delete({ where: { id: vv.factureVente.id } });
    await tx.vehiculeVente.update({ where: { id: vv.id }, data: { statut: "EN_STOCK" } });
    await tx.vehicule.update({ where: { id: vv.vehiculeId }, data: { clientId: interne.id } });
  });
  return NextResponse.json({ ok: true });
}
