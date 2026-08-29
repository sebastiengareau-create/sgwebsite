const { PrismaClient } = require("@prisma/client");

// Évite de créer une nouvelle connexion à chaque rechargement en développement
const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

module.exports = { prisma };
