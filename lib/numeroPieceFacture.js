// Nom d'une ligne de pièce sur la facture (page imprimée et PDF). Profil
// numeroPieceFacture : le numéro de la pièce d'inventaire devant son nom
// (« ABC-123 — Filtre à huile »). Une pièce sans fiche d'inventaire (texte
// libre d'une soumission) garde son nom seul. Client et serveur.
import { CLIENT } from "./client";

export function nomPieceFacture(nom, numero) {
  return CLIENT.numeroPieceFacture && numero ? `${numero} — ${nom}` : nom;
}
