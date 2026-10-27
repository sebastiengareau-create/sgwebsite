const { PrismaClient } = require("@prisma/client");
const { formaterTelephone } = require("./telephone");

// Évite de créer une nouvelle connexion à chaque rechargement en développement
const globalForPrisma = globalThis;

// Le mot de passe (haché) et le NIP des employés ne sortent jamais d'une
// requête par défaut — sinon un `include: { employe: true }` les enverrait
// jusqu'au navigateur. Les rares endroits qui en ont besoin (connexion,
// sauvegarde) les demandent explicitement : `omit: { motDePasse: false }`.
const OMIS_PAR_DEFAUT = { user: { motDePasse: true, pin: true } };

// Champs de téléphone, mis sous la forme (450) 555-1234 à chaque
// enregistrement, peu importe d'où vient le numéro (formulaire, import
// Excel, réservation en ligne…) — voir lib/telephone.js
const CHAMPS_TELEPHONE = {
  User: ["telephone"],
  Client: ["telephone"],
  Fournisseur: ["telephone"],
  Soumission: ["clientTelephone"],
  RendezVous: ["clientTelephone"],
};
function formaterDonnees(donnees, champs) {
  if (Array.isArray(donnees)) return donnees.map((d) => formaterDonnees(d, champs));
  if (!donnees || typeof donnees !== "object") return donnees;
  const copie = { ...donnees };
  for (const champ of champs) {
    if (typeof copie[champ] === "string") copie[champ] = formaterTelephone(copie[champ]);
  }
  return copie;
}
const ECRITURES = ["create", "createMany", "update", "updateMany", "upsert"];
function formaterTelephones(client) {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const champs = CHAMPS_TELEPHONE[model];
          if (champs && ECRITURES.includes(operation)) {
            args = { ...args };
            if (args.data) args.data = formaterDonnees(args.data, champs);
            if (args.create) args.create = formaterDonnees(args.create, champs);
            if (args.update) args.update = formaterDonnees(args.update, champs);
          }
          return query(args);
        },
      },
    },
  });
}

const prisma = globalForPrisma.prisma || formaterTelephones(new PrismaClient({ omit: OMIS_PAR_DEFAUT }));
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

module.exports = { prisma };
