// Catalogue des véhicules pour les listes déroulantes du dossier véhicule,
// selon le profil du client (lib/client.js) : automobile (lib/catalogueAuto.js,
// NHTSA) ou véhicules récréatifs (lib/catalogueVr.js). Les deux exposent les
// mêmes fonctions, pour que le reste du logiciel n'ait pas à choisir.
//
// Côté serveur seulement — le navigateur interroge /api/vehicules/catalogue.
import * as auto from "./catalogueAuto";
import * as vr from "./catalogueVr";
import { estVr } from "./client";

const c = estVr ? vr : auto;

export const {
  decoderNiv, anneesDisponibles, marquesPour, modelesPour, versionsDuModele,
  cleMarque, nomMarque, modeleCanonique, marqueDepuisNiv, SOURCE_CATALOGUE,
} = c;
