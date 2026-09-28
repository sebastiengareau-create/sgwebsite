const { prisma } = require("./prisma");

// NIP d'employé : exactement 4 chiffres, unique entre tous les comptes.
// "" ou null = aucun NIP. Retourne { valeur } ou { erreur, status }.
async function validerPin(pin, exclureId = null) {
  const brut = String(pin ?? "").trim();
  if (!brut) return { valeur: null };
  if (!/^\d{4}$/.test(brut)) return { erreur: "Le NIP doit contenir exactement 4 chiffres.", status: 400 };
  const pris = await prisma.user.findFirst({ where: { pin: brut, ...(exclureId && { NOT: { id: exclureId } }) }, select: { id: true } });
  if (pris) return { erreur: "Ce NIP est déjà utilisé par un autre employé — choisis-en un autre.", status: 409 };
  return { valeur: brut };
}

module.exports = { validerPin };
