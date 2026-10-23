const { Prisma } = require("@prisma/client");
const { prisma } = require("./prisma");
const { normaliserVehicule, libelleVehicule } = require("./vehicules");

// Véhicule d'une soumission, comme sur un bon : un véhicule du dossier du
// client (vehiculeId) ou un nouveau (vehicule). Le nouveau reste dans la
// soumission (vehiculeDetails) — il ne rejoint le dossier du client que si
// la soumission devient un bon, pour ne pas remplir le dossier d'estimés
// refusés. → { data } prêt pour Prisma, ou { erreur }.
async function lireVehiculeSoumission({ clientId, vehiculeId, vehicule }) {
  if (vehiculeId) {
    if (!clientId) return { erreur: "Un nouveau client n'a pas encore de véhicule au dossier." };
    const existant = await prisma.vehicule.findFirst({ where: { id: vehiculeId, clientId } });
    if (!existant) return { erreur: "Ce véhicule n'est pas au dossier de ce client." };
    return { data: { vehiculeId, vehiculeDetails: Prisma.DbNull, vehiculeInfo: libelleVehicule(existant) || null } };
  }
  const { data, vide, erreur } = normaliserVehicule(vehicule);
  if (erreur) return { erreur };
  return {
    data: {
      vehiculeId: null,
      vehiculeDetails: vide ? Prisma.DbNull : data,
      vehiculeInfo: vide ? null : libelleVehicule(data) || data.plaque || data.niv || null,
    },
  };
}

module.exports = { lireVehiculeSoumission };
