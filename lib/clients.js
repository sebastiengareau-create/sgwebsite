const { prisma } = require("./prisma");
const { normaliserVehicule } = require("./vehicules");
const { motsRecherche, correspondRecherche } = require("./recherche");

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
  // Nom comparé sans accents, majuscules, ponctuation ni ordre des mots :
  // « Helene Cote », « Hélène Côté » et « Côté, Hélène » sont le même nom.
  // La base compare les accents : les noms sont donc comparés ici.
  const cleNom = cleNomClient(nom);
  const conditions = [];
  if (courriel?.trim()) conditions.push({ courriel: { equals: courriel.trim(), mode: "insensitive" } });
  // Le téléphone est du texte libre : on cherche par les 4 derniers chiffres,
  // puis on compare tous les chiffres.
  if (tel.length >= 7) conditions.push({ telephone: { contains: tel.slice(-4) } });
  if (!cleNom && conditions.length === 0) return [];

  const champs = { id: true, nom: true, telephone: true, courriel: true, numero: true };
  const sauf = exclureId ? { NOT: { id: exclureId } } : {};
  const [parNom, parCoordonnees] = await Promise.all([
    cleNom ? prisma.client.findMany({ where: sauf, select: champs }).then((liste) => liste.filter((c) => cleNomClient(c.nom) === cleNom)) : [],
    conditions.length ? prisma.client.findMany({ where: { OR: conditions, ...sauf }, select: champs, take: 50 }) : [],
  ]);
  const vus = new Set(parNom.map((c) => c.id));
  return [
    ...parNom,
    ...parCoordonnees.filter((c) => !vus.has(c.id) && (
      (courriel?.trim() && c.courriel?.trim().toLowerCase() === courriel.trim().toLowerCase()) ||
      (tel.length >= 7 && chiffresTelephone(c.telephone) === tel)
    )),
  ];
}

// Clé de comparaison d'un nom : mots normalisés (lib/recherche.js), triés
function cleNomClient(nom) {
  return motsRecherche(nom).sort().join(" ");
}

// Message d'avertissement lisible, ex. : Client existant semblable : « Jean Tremblay » (418-555-0122).
function messageDoublons(doublons) {
  const liste = doublons.slice(0, 3).map((d) => `« ${d.nom} »${d.telephone ? ` (${d.telephone})` : ""}`).join(", ");
  return `Client${doublons.length > 1 ? "s" : ""} existant${doublons.length > 1 ? "s" : ""} semblable${doublons.length > 1 ? "s" : ""} : ${liste}.`;
}

// Véhicule d'un rendez-vous ou d'une soumission ({ annee, marque, …,
// kilometrage }) → versé au dossier du client, sans doublon si ce véhicule
// y est déjà : même NIV ou même plaque, ou — sans l'un ni l'autre — même
// année, marque, modèle et version. Un kilométrage indiqué met à jour celui
// du véhicule existant. → son id, ou null si les détails sont vides.
async function verserVehiculeAuDossier(clientId, details) {
  const { data: vehicule, vide } = normaliserVehicule(details);
  if (!vehicule || vide) return null;
  const identifiants = [vehicule.niv && { niv: vehicule.niv }, vehicule.plaque && { plaque: vehicule.plaque }].filter(Boolean);
  if (!identifiants.length) {
    identifiants.push({ annee: vehicule.annee, marque: vehicule.marque, modele: vehicule.modele, version: vehicule.version, niv: null, plaque: null });
  }
  const existant = await prisma.vehicule.findFirst({ where: { clientId, OR: identifiants } });
  if (!existant) return (await prisma.vehicule.create({ data: { ...vehicule, clientId } })).id;
  if (vehicule.kilometrage != null && vehicule.kilometrage !== existant.kilometrage) {
    await prisma.vehicule.update({ where: { id: existant.id }, data: { kilometrage: vehicule.kilometrage } });
  }
  return existant.id;
}

// Kilométrage actuel d'un véhicule du dossier, à figer sur un nouveau bon
async function kilometrageVehicule(vehiculeId) {
  if (!vehiculeId) return null;
  const v = await prisma.vehicule.findUnique({ where: { id: vehiculeId }, select: { kilometrage: true } });
  return v?.kilometrage ?? null;
}

// Clients dont le nom correspond à une recherche, sans tenir compte des
// accents ni de l'ordre des mots (voir lib/recherche.js) — la base, elle,
// compare les accents. → liste d'id, pour filtrer bons et factures.
async function idsClientsCorrespondants(texte) {
  const mots = motsRecherche(texte);
  if (mots.length === 0) return [];
  const clients = await prisma.client.findMany({ select: { id: true, nom: true } });
  return clients.filter((c) => correspondRecherche(mots, c.nom)).map((c) => c.id);
}

// Bons dont le nom corrigé (clientNomAffiche) correspond à une recherche
async function idsBonsNomAfficheCorrespondant(texte) {
  const mots = motsRecherche(texte);
  if (mots.length === 0) return [];
  const bons = await prisma.bonTravail.findMany({ where: { clientNomAffiche: { not: null } }, select: { id: true, clientNomAffiche: true } });
  return bons.filter((b) => correspondRecherche(mots, b.clientNomAffiche)).map((b) => b.id);
}

module.exports = { idsClientsCorrespondants, idsBonsNomAfficheCorrespondant, chiffresTelephone, trouverDoublonsClient, messageDoublons, verserVehiculeAuDossier, kilometrageVehicule };
