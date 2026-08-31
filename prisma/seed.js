const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("Nettoyage de la base…");
  await prisma.entreeTemps.deleteMany();
  await prisma.pieceUtilisee.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.probleme.deleteMany();
  await prisma.bonTravail.deleteMany();
  await prisma.client.deleteMany();
  await prisma.piece.deleteMany();
  await prisma.user.deleteMany();

  console.log("Création des 3 comptes de démo…");
  const [gerant, secretaire, mecanicien1, mecanicien2] = await Promise.all([
    prisma.user.create({
      data: {
        nom: "Marc Tremblay", courriel: "gerant@garage.com",
        motDePasse: await bcrypt.hash("gerant123", 10), role: "GERANT", pin: "9999",
      },
    }),
    prisma.user.create({
      data: {
        nom: "Chantal Bouchard", courriel: "secretaire@garage.com",
        motDePasse: await bcrypt.hash("secretaire123", 10), role: "SECRETAIRE",
      },
    }),
    prisma.user.create({
      data: {
        nom: "Marc-André Tremblay", courriel: "mecanicien@garage.com",
        motDePasse: await bcrypt.hash("mecanicien123", 10), role: "MECANICIEN", pin: "1111",
        qbId: "QB-EMP-001",
      },
    }),
    prisma.user.create({
      data: {
        nom: "Sophie Bergeron", courriel: "sophie@garage.com",
        motDePasse: await bcrypt.hash("mecanicien123", 10), role: "MECANICIEN", pin: "2222",
        qbId: "QB-EMP-002",
      },
    }),
  ]);

  console.log("Création de l'inventaire (miroir QuickBooks)…");
  const pieces = await Promise.all([
    prisma.piece.create({ data: { nom: "Filtre à huile", numero: "FO-2201", qte: 14, qteMin: 5, prix: 12.99, qbId: "QB-ITM-118" } }),
    prisma.piece.create({ data: { nom: "Plaquettes de frein avant", numero: "PF-4410", qte: 3, qteMin: 4, prix: 64.5, qbId: "QB-ITM-119" } }),
    prisma.piece.create({ data: { nom: "Huile moteur 5W30 (litre)", numero: "HM-5W30", qte: 38, qteMin: 12, prix: 8.25, qbId: "QB-ITM-120" } }),
    prisma.piece.create({ data: { nom: "Batterie 12V", numero: "BAT-12V-A", qte: 2, qteMin: 3, prix: 145.0, qbId: "QB-ITM-121" } }),
  ]);

  console.log("Création d'un client et bon de travail de démo…");
  const client = await prisma.client.create({
    data: { nom: "Denis Ouellet", telephone: "418-555-0142", courriel: "denis.ouellet@example.com" },
  });
  await prisma.bonTravail.create({
    data: {
      numero: "2026-0114",
      statut: "EN_COURS",
      clientId: client.id,
      problemes: {
        create: [
          { description: "Bruit de freinage à l'avant" },
          { description: "Vibration au freinage à haute vitesse" },
        ],
      },
    },
  });

  console.log("\nTerminé ✅");
  console.log("Comptes de démo :");
  console.log("  gerant@garage.com / gerant123");
  console.log("  secretaire@garage.com / secretaire123");
  console.log("  mecanicien@garage.com / mecanicien123");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
