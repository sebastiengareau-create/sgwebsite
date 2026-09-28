const { PrismaClient } = require("@prisma/client");

// Évite de créer une nouvelle connexion à chaque rechargement en développement
const globalForPrisma = globalThis;

// Le mot de passe (haché) et le NIP des employés ne sortent jamais d'une
// requête par défaut — sinon un `include: { employe: true }` les enverrait
// jusqu'au navigateur. Les rares endroits qui en ont besoin (connexion,
// sauvegarde) les demandent explicitement : `omit: { motDePasse: false }`.
const OMIS_PAR_DEFAUT = { user: { motDePasse: true, pin: true } };

const prisma = globalForPrisma.prisma || new PrismaClient({ omit: OMIS_PAR_DEFAUT });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

module.exports = { prisma };
