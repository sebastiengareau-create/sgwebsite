// Réapprovisionnement suggéré selon les ventes — sans dépendance au serveur.
//
// Une pièce est proposée à la commande dans deux cas :
//  - SEUIL : son stock (plus ce qui est déjà commandé) est à son seuil
//    minimum ou sous lui — la règle de toujours (lib/commandesFournisseurs.js) ;
//  - VENTES : au rythme où elle se vend, il en reste pour moins de
//    JOURS_ALERTE jours, même si aucun seuil n'est réglé sur sa fiche.
// La quantité proposée couvre JOURS_COUVERTURE jours de ventes (ou remonte
// au seuil maximum, si c'est plus).
//
// Le rythme vient des sorties de stock des JOURS_PERIODE derniers jours
// (ventes moins retours). Une pièce vendue une seule fois n'a pas de rythme :
// elle n'est proposée que par son seuil.
import { quantiteSuggeree } from "./commandesFournisseurs";

export const JOURS_PERIODE = 90;
export const JOURS_ALERTE = 14;
export const JOURS_COUVERTURE = 30;
const VENTES_MINIMUM = 2;

// Jours sur lesquels calculer le rythme : la période, ou moins si
// l'installation n'a pas encore autant d'historique (au moins 14 jours)
export function joursObserves(premierMouvement, maintenant = new Date()) {
  if (!premierMouvement) return JOURS_PERIODE;
  const jours = Math.ceil((maintenant - new Date(premierMouvement)) / 86400000);
  return Math.min(JOURS_PERIODE, Math.max(14, jours));
}

// piece : { qte, qteMin, qteMax } ; vendu : unités sorties pendant `jours`.
// → null (rien à commander) ou { qte, raison, vendu, parMois, joursRestants }
//   joursRestants : null quand la pièce n'a pas de rythme de vente
export function suggestionReappro(piece, { enCommande = 0, vendu = 0, jours = JOURS_PERIODE } = {}) {
  const disponible = piece.qte + enCommande;
  const rythme = vendu >= VENTES_MINIMUM ? vendu / jours : 0; // unités par jour
  const joursRestants = rythme > 0 ? Math.max(0, Math.floor(disponible / rythme)) : null;

  const qteSeuil = quantiteSuggeree(piece, enCommande);
  const parVentes = joursRestants !== null && joursRestants < JOURS_ALERTE;
  if (qteSeuil === 0 && !parVentes) return null;

  // Assez pour JOURS_COUVERTURE jours de ventes, par-dessus le seuil minimum gardé en réserve
  const qteVentes = rythme > 0 ? Math.ceil(rythme * JOURS_COUVERTURE) + Math.max(0, piece.qteMin) - disponible : 0;
  return {
    qte: Math.max(1, qteSeuil, qteVentes),
    raison: qteSeuil > 0 ? "SEUIL" : "VENTES",
    vendu,
    parMois: Math.round(rythme * 30 * 10) / 10,
    joursRestants,
  };
}

// Unités sorties par pièce pendant la période (ventes moins retours), et le
// nombre de jours observés → { venduParPiece: { pieceId: n }, jours }
export async function ventesRecentes(prisma) {
  const debut = new Date(Date.now() - JOURS_PERIODE * 86400000);
  const [sorties, premier] = await Promise.all([
    prisma.mouvementInventaire.groupBy({ by: ["pieceId"], where: { type: { in: ["VENTE", "RETOUR"] }, creeLe: { gte: debut } }, _sum: { qte: true } }),
    prisma.mouvementInventaire.findFirst({ orderBy: { creeLe: "asc" }, select: { creeLe: true } }),
  ]);
  return {
    venduParPiece: Object.fromEntries(sorties.map((m) => [m.pieceId, Math.max(0, -(m._sum.qte || 0))])),
    jours: joursObserves(premier?.creeLe),
  };
}
