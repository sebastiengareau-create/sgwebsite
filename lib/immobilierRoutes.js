// Routes d'API types de l'immobilier : création (POST), modification
// (PATCH) et suppression (DELETE) d'un modèle, avec l'accès au module, la
// validation de SPECS (lib/immobilier.js) et des messages d'erreur clairs.
// Chaque route n'a plus qu'à dire quel modèle et, au besoin, quoi vérifier
// de plus :
//
//   export const { POST } = routesCollection("immeubleImmo", "immeuble");
//
// Crochets (facultatifs, peuvent être async) :
//   avant(data, { session, body, element }) → { erreur } pour refuser, ou
//     rien ; peut compléter data (ex. creePar)
//   apres(element, { session, body, avant })  → après l'écriture
//   avantSuppression(element) → { erreur } pour refuser
//
// Immobilier relié à la comptabilité (lib/immobilierCompta.js) : une pièce
// dans une période comptable verrouillée ou fermée est refusée, et les livres
// sont remis à jour après chaque écriture (sans effet si le lien est inactif).
import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { sessionImmo, normaliserModele, messageErreurPrisma, refus, erreur } from "./immobilier";
import { periodeImmoBloquee, synchroniserComptaImmo } from "./immobilierCompta";

// Date comptable des modèles qui vont aux livres quand le lien est actif
const DATE_COMPTABLE = { chargeImmo: "date", paiementImmo: "date", depenseImmo: "date", reparationImmo: "dateFin" };

async function periodeRefusee(modele, { avant, apres }) {
  const champ = DATE_COMPTABLE[modele];
  if (!champ) return null;
  const nouvelle = apres && (champ in apres ? apres[champ] : avant?.[champ]);
  return periodeImmoBloquee({ anciennes: avant ? [avant[champ]] : [], nouvelles: nouvelle ? [nouvelle] : [] });
}

// Livres remis à jour → { avertissement } à joindre à la réponse, s'il y a un écart
async function livres(session, options = {}) {
  const r = await synchroniserComptaImmo({ creePar: session.nom, ...options });
  return r?.erreurs?.length ? { avertissement: `Comptabilité : ${r.erreurs.join(" · ")}` } : {};
}

export function routesCollection(modele, spec, { avant, apres, creer, doublon } = {}) {
  async function POST(request) {
    const session = await sessionImmo();
    if (!session) return refus();
    const body = await request.json().catch(() => ({}));
    const r = normaliserModele(spec, body, { creation: true });
    if (r.erreur) return erreur(r.erreur);
    const verdict = await avant?.(r.data, { session, body });
    if (verdict?.erreur) return erreur(verdict.erreur);
    const periode = await periodeRefusee(modele, { apres: r.data });
    if (periode) return erreur(periode, 423);
    try {
      const element = creer ? await creer(r.data, { session, body }) : await prisma[modele].create({ data: r.data });
      await apres?.(element, { session, body });
      // « Déjà payée » à la saisie d'une dépense : la facture est payée tout de suite
      const payer = modele === "depenseImmo" && body.payee === true ? { [element.id]: { mode: typeof body.modePaiement === "string" ? body.modePaiement : null } } : {};
      return NextResponse.json({ ok: true, id: element.id, numero: element.numero, ...(await livres(session, { payer })) });
    } catch (e) {
      const message = messageErreurPrisma(e, doublon);
      if (message) return erreur(message, 409);
      throw e;
    }
  }
  return { POST };
}

export function routesElement(modele, spec, { avant, apres, avantSuppression, doublon } = {}) {
  async function trouver(props) {
    const { id } = await props.params;
    return prisma[modele].findUnique({ where: { id } });
  }

  async function PATCH(request, props) {
    const session = await sessionImmo();
    if (!session) return refus();
    const element = await trouver(props);
    if (!element) return erreur("Introuvable.", 404);
    const body = await request.json().catch(() => ({}));
    const r = normaliserModele(spec, body);
    if (r.erreur) return erreur(r.erreur);
    const verdict = await avant?.(r.data, { session, body, element });
    if (verdict?.erreur) return erreur(verdict.erreur);
    const periode = await periodeRefusee(modele, { avant: element, apres: r.data });
    if (periode) return erreur(periode, 423);
    try {
      const modifie = await prisma[modele].update({ where: { id: element.id }, data: r.data });
      await apres?.(modifie, { session, body, avant: element });
      return NextResponse.json({ ok: true, ...(await livres(session)) });
    } catch (e) {
      const message = messageErreurPrisma(e, doublon);
      if (message) return erreur(message, 409);
      throw e;
    }
  }

  async function DELETE(request, props) {
    const session = await sessionImmo();
    if (!session) return refus();
    const element = await trouver(props);
    if (!element) return erreur("Introuvable.", 404);
    const verdict = await avantSuppression?.(element);
    if (verdict?.erreur) return erreur(verdict.erreur, 409);
    const periode = await periodeRefusee(modele, { avant: element });
    if (periode) return erreur(periode, 423);
    await prisma[modele].delete({ where: { id: element.id } });
    return NextResponse.json({ ok: true, ...(await livres(session)) });
  }

  return { PATCH, DELETE };
}
