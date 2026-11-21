// Inspection numérique multipoint (module « module_inspection », actif par
// défaut ; Administrateur → Modules).
//
// Sur un bon, le technicien choisit une grille (lib/grillesInspection.js) et
// vérifie chaque point : OK, à surveiller, urgent ou sans objet, avec une
// mesure, un constat, des photos et le travail recommandé. Le comptoir met
// un prix sur les travaux recommandés et envoie le rapport au client
// (courriel ou texto) : un lien secret vers /inspection/<jeton>, où le
// client voit les photos, coche les travaux qu'il accepte, signe et
// approuve — ou répond « pas maintenant ». L'atelier en est avisé, puis
// ajoute les travaux approuvés au bon (une tâche par point).
//
// Le bon facturé verrouille l'inspection (comme ses tâches et ses photos) ;
// son rapport reste consultable et peut encore être envoyé.
import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { lireParametre } from "./parametres";
import { bonEstVerrouille } from "./bons";
import { aAccesSection } from "./auth";
import { CLIENT } from "./client";
import { grillesParDefaut, normaliserGrilles, normaliserSeuils, pointsDeGrille, SEUILS_DEFAUT } from "./grillesInspection";

export const CLE_MODULE_INSPECTION = "module_inspection";

export async function inspectionActive() {
  return (await lireParametre(CLE_MODULE_INSPECTION)) !== "inactif";
}

// Refus d'une route d'inspection → { erreur, status }, ou null si permis.
// Remplir l'inspection : toute personne connectée (le technicien). Prix,
// envoi au client et ajout au bon (comptoir) : accès « Opérations ».
export async function refusInspection(session, { comptoir = false } = {}) {
  if (!session) return { erreur: "Non connecté.", status: 401 };
  if (!(await inspectionActive())) return { erreur: "Le module Inspection numérique est désactivé (Administrateur → Modules).", status: 403 };
  if (comptoir && !(await aAccesSection(session, "operations"))) return { erreur: "Accès refusé.", status: 403 };
  return null;
}

// Grilles du garage (Paramètres → Grilles d'inspection), gardées en JSON ;
// sans réglage (ou réglage illisible), les grilles d'origine du type de
// véhicules du profil
export const CLE_GRILLES = "grilles_inspection";

export async function lireGrilles() {
  const valeur = await lireParametre(CLE_GRILLES);
  if (valeur) {
    try {
      const { grilles } = normaliserGrilles(JSON.parse(valeur));
      if (grilles) return grilles;
    } catch {
      // réglage illisible : grilles d'origine
    }
  }
  return grillesParDefaut(CLIENT.typeVehicules);
}

// Seuils des états proposés selon la mesure (même page de Paramètres) ;
// sans réglage, les seuils conseillés
export const CLE_SEUILS = "seuils_inspection";

export async function lireSeuils() {
  const valeur = await lireParametre(CLE_SEUILS);
  if (valeur) {
    try {
      const { seuils } = normaliserSeuils(JSON.parse(valeur));
      if (seuils) return seuils;
    } catch {
      // réglage illisible : seuils conseillés
    }
  }
  return SEUILS_DEFAUT;
}

function adressePublique() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export function lienInspection(jeton) {
  return `${adressePublique()}/inspection/${jeton}`;
}

// Lien du rapport, créé au premier besoin
export async function assurerLienInspection(inspectionId) {
  const i = await prisma.inspection.findUnique({ where: { id: inspectionId }, select: { jetonClient: true } });
  if (!i) return null;
  if (i.jetonClient) return lienInspection(i.jetonClient);
  const jeton = crypto.randomBytes(24).toString("base64url");
  await prisma.inspection.update({ where: { id: inspectionId }, data: { jetonClient: jeton } });
  return lienInspection(jeton);
}

// Nouvelle inspection sur un bon, avec les points de la grille choisie
export async function creerInspection({ bonId, cleGrille, session }) {
  const grille = (await lireGrilles()).find((g) => g.cle === cleGrille && g.active);
  if (!grille) throw new Error("Grille d'inspection inconnue ou retirée des bons.");
  const bon = await prisma.bonTravail.findUnique({ where: { id: bonId }, select: { kilometrage: true, comptoir: true } });
  if (!bon) throw new Error("Bon introuvable.");
  if (bon.comptoir) throw new Error("Une facture comptoir n'a pas de véhicule à inspecter.");
  return prisma.inspection.create({
    data: {
      bonId,
      grille: grille.cle,
      titre: grille.titre,
      kilometrage: bon.kilometrage ?? null,
      technicienId: session.id || null,
      technicienNom: session.nom || null,
      points: { create: pointsDeGrille(grille) },
    },
    select: { id: true },
  });
}

// L'inspection et son bon, pour une route qui la modifie. → { inspection }
// ou { erreur, status } : introuvable, ou bon facturé (verrouillé).
export async function inspectionModifiable(inspectionId) {
  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    select: { id: true, bonId: true, statut: true, reponseClient: true },
  });
  if (!inspection) return { erreur: "Inspection introuvable.", status: 404 };
  if (await bonEstVerrouille(inspection.bonId)) {
    return { erreur: "Le bon est facturé : son inspection ne se modifie plus.", status: 409 };
  }
  return { inspection };
}

// Texte d'un point pour la tâche du bon : le travail recommandé, suivi du
// point vérifié s'il ne le nomme pas déjà
export function descriptionTache(point) {
  const travail = point.recommandation.trim();
  return travail.toLowerCase().includes(point.libelle.toLowerCase()) ? travail : `${travail} (${point.libelle})`;
}

// Réponse image d'une photo gardée en data URL (page de l'inspection et
// rapport public du client)
export function reponseImage(url, request) {
  const m = String(url).match(/^data:(image\/[a-z+]+);base64,(.*)$/s);
  if (!m) return NextResponse.redirect(new URL(url, request.url));
  return new NextResponse(Buffer.from(m[2], "base64"), {
    headers: { "Content-Type": m[1], "Cache-Control": "private, max-age=31536000, immutable" },
  });
}
