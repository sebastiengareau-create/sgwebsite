const { prisma } = require("./prisma");

// Chiffres seulement, sans l'indicatif 1 — « (418) 555-0122 » et
// « 1-418-555-0122 » donnent la même clé.
function chiffresTelephone(tel) {
  const chiffres = String(tel || "").replace(/\D/g, "");
  return chiffres.length === 11 && chiffres.startsWith("1") ? chiffres.slice(1) : chiffres;
}

// Clients existants qui pourraient être la même personne : même nom, même
// téléphone ou même courriel. Deux homonymes restent permis — l'appelant
// avertit et laisse confirmer plutôt que de bloquer.
async function trouverDoublonsClient({ nom, telephone, courriel }, exclureId = null) {
  const tel = chiffresTelephone(telephone);
  const conditions = [];
  if (nom?.trim()) conditions.push({ nom: { equals: nom.trim(), mode: "insensitive" } });
  if (courriel?.trim()) conditions.push({ courriel: { equals: courriel.trim(), mode: "insensitive" } });
  // Le téléphone est du texte libre : on cherche par les 4 derniers chiffres,
  // puis on compare tous les chiffres.
  if (tel.length >= 7) conditions.push({ telephone: { contains: tel.slice(-4) } });
  if (conditions.length === 0) return [];

  const candidats = await prisma.client.findMany({
    where: { OR: conditions, ...(exclureId && { NOT: { id: exclureId } }) },
    select: { id: true, nom: true, telephone: true, courriel: true, numero: true },
    take: 20,
  });
  return candidats.filter((c) =>
    (nom?.trim() && c.nom.trim().toLowerCase() === nom.trim().toLowerCase()) ||
    (courriel?.trim() && c.courriel?.trim().toLowerCase() === courriel.trim().toLowerCase()) ||
    (tel.length >= 7 && chiffresTelephone(c.telephone) === tel)
  );
}

// Message d'avertissement lisible, ex. : Client existant semblable : « Jean Tremblay » (418-555-0122).
function messageDoublons(doublons) {
  const liste = doublons.slice(0, 3).map((d) => `« ${d.nom} »${d.telephone ? ` (${d.telephone})` : ""}`).join(", ");
  return `Client${doublons.length > 1 ? "s" : ""} existant${doublons.length > 1 ? "s" : ""} semblable${doublons.length > 1 ? "s" : ""} : ${liste}.`;
}

module.exports = { chiffresTelephone, trouverDoublonsClient, messageDoublons };
