// Routes d'API types de la copropriété : création (POST), modification
// (PATCH) et suppression (DELETE) d'un modèle, avec l'accès au module, la
// validation de SPECS (lib/copropriete.js) et des messages d'erreur clairs.
// Chaque route n'a plus qu'à dire quel modèle et, au besoin, quoi vérifier
// de plus :
//
//   export const { POST } = routesCollection("batimentCopro", "batiment");
//
// Crochets (facultatifs, peuvent être async) :
//   avant(data, { session, body, element }) → { erreur } pour refuser, ou
//     rien ; peut compléter data (ex. creePar)
//   apres(element, { session, body, avant })  → après l'écriture
//   avantSuppression(element) → { erreur } pour refuser
import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { sessionCopro, normaliserModele, messageErreurPrisma, refus, erreur } from "./copropriete";

export function routesCollection(modele, spec, { avant, apres, creer, doublon } = {}) {
  async function POST(request) {
    const session = await sessionCopro();
    if (!session) return refus();
    const body = await request.json().catch(() => ({}));
    const r = normaliserModele(spec, body, { creation: true });
    if (r.erreur) return erreur(r.erreur);
    const verdict = await avant?.(r.data, { session, body });
    if (verdict?.erreur) return erreur(verdict.erreur);
    try {
      const element = creer ? await creer(r.data, { session, body }) : await prisma[modele].create({ data: r.data });
      await apres?.(element, { session, body });
      return NextResponse.json({ ok: true, id: element.id, numero: element.numero });
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
    const session = await sessionCopro();
    if (!session) return refus();
    const element = await trouver(props);
    if (!element) return erreur("Introuvable.", 404);
    const body = await request.json().catch(() => ({}));
    const r = normaliserModele(spec, body);
    if (r.erreur) return erreur(r.erreur);
    const verdict = await avant?.(r.data, { session, body, element });
    if (verdict?.erreur) return erreur(verdict.erreur);
    try {
      const modifie = await prisma[modele].update({ where: { id: element.id }, data: r.data });
      await apres?.(modifie, { session, body, avant: element });
      return NextResponse.json({ ok: true });
    } catch (e) {
      const message = messageErreurPrisma(e, doublon);
      if (message) return erreur(message, 409);
      throw e;
    }
  }

  async function DELETE(request, props) {
    const session = await sessionCopro();
    if (!session) return refus();
    const element = await trouver(props);
    if (!element) return erreur("Introuvable.", 404);
    const verdict = await avantSuppression?.(element);
    if (verdict?.erreur) return erreur(verdict.erreur, 409);
    await prisma[modele].delete({ where: { id: element.id } });
    return NextResponse.json({ ok: true });
  }

  return { PATCH, DELETE };
}
