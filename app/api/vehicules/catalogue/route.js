import { NextResponse } from "next/server";
import { obtenirSession } from "@/lib/auth";
import { anneesDisponibles, marquesPour, modelesPour, versionsDuModele, SOURCE_CATALOGUE } from "@/lib/catalogueVehicules";

// Listes déroulantes du dossier véhicule, une étape à la fois :
//
//   GET /api/vehicules/catalogue                          → { annees: [2027, 2026, …] }
//   GET /api/vehicules/catalogue?annee=2019               → { marques: { populaires: [{cle, nom}], autres: […] } }
//   GET /api/vehicules/catalogue?annee=                   → toutes les marques, toutes années confondues
//   GET /api/vehicules/catalogue?annee=2019&marque=Honda  → { modeles: ["Accord", "Civic", …] }
//   GET …&marque=Honda&modele=Civic                       → { versions: ["DX", "LX", "EX", …] }
//
// Accessible à tout utilisateur connecté, ou au serveur du site de
// réservation avec la même clé secrète que le webhook (x-webhook-secret),
// pour qu'il offre exactement les mêmes listes que le logiciel.
export async function GET(request) {
  const cleRecue = request.headers.get("x-webhook-secret");
  const cleAttendue = process.env.GARAGE_BOOKING_WEBHOOK_SECRET;
  const parCle = !!cleAttendue && cleRecue === cleAttendue;
  if (!parCle && !(await obtenirSession())) {
    return NextResponse.json({ erreur: "Non autorisé." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const anneeTexte = searchParams.get("annee");
  const annee = anneeTexte ? Number(anneeTexte) : null;
  if (anneeTexte && !Number.isInteger(annee)) {
    return NextResponse.json({ erreur: "Année invalide." }, { status: 400 });
  }
  const marque = searchParams.get("marque");
  const modele = searchParams.get("modele");

  if (marque && modele) return NextResponse.json({ versions: versionsDuModele(marque, modele) });
  if (marque) return NextResponse.json({ modeles: modelesPour(marque, annee) });
  if (searchParams.has("annee")) return NextResponse.json({ marques: marquesPour(annee) });
  return NextResponse.json({ annees: anneesDisponibles(), source: SOURCE_CATALOGUE });
}
