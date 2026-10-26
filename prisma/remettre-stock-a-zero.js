// ============================================================
// SCRIPT À USAGE UNIQUE — remet à zéro le stock (qté) de TOUTES les pièces
// d'inventaire, actives ou désactivées, y compris les stocks négatifs.
// Pour un recomptage complet : on repart de zéro, puis on entre le stock
// réel (ajustement manuel, import ou réceptions).
//
// Comme un ajustement manuel dans l'appli : chaque pièce modifiée reçoit un
// mouvement « AJUSTEMENT » dans son journal, puis le compte 1200 est aligné
// sur la nouvelle valeur du stock (contrepartie 3010, aucun effet sur le
// bénéfice). Les pièces ajoutées à des bons sont déjà sorties du stock :
// elles ne sont pas touchées.
//
// Utilisation (avec la base du client connectée — via le tunnel comme pour
// une migration) :
//
//   node prisma/remettre-stock-a-zero.js              → aperçu, ne change rien
//   node prisma/remettre-stock-a-zero.js --confirmer  → applique
// ============================================================

const { prisma } = require("../lib/prisma");
const { alignerInventaireAuGL } = require("../lib/comptabilite");

const NOTE = "Remise à zéro du stock (recomptage)";
const PAR = "Remise à zéro (script)";

async function main() {
  const confirmer = process.argv.includes("--confirmer");

  const pieces = await prisma.piece.findMany({
    where: { qte: { not: 0 } },
    select: { id: true, numero: true, nom: true, qte: true, coutant: true, actif: true },
    orderBy: { numero: "asc" },
  });

  if (pieces.length === 0) {
    console.log("Aucune pièce avec du stock : rien à faire.");
    return;
  }

  const valeur = pieces.reduce((s, p) => s + p.qte * p.coutant, 0);
  for (const p of pieces) {
    console.log(`${p.numero.padEnd(20)} ${String(p.qte).padStart(6)}  ${p.nom}${p.actif ? "" : " (désactivée)"}`);
  }
  console.log(`\n${pieces.length} pièce(s), ${pieces.reduce((s, p) => s + p.qte, 0)} unité(s), valeur au coûtant ${valeur.toFixed(2)} $.`);

  if (!confirmer) {
    console.log("\nAperçu seulement. Pour appliquer : node prisma/remettre-stock-a-zero.js --confirmer");
    return;
  }

  await prisma.$transaction(
    pieces.map((p) =>
      prisma.piece.update({
        where: { id: p.id },
        data: {
          qte: 0,
          mouvements: { create: { type: "AJUSTEMENT", qte: -p.qte, solde: 0, note: NOTE, creePar: PAR } },
        },
      })
    )
  );
  console.log(`\n✅ Stock remis à zéro pour ${pieces.length} pièce(s).`);

  // Comme dans l'appli : le stock est déjà à zéro, un échec comptable (ex.
  // période fermée) est seulement signalé.
  try {
    const ecriture = await alignerInventaireAuGL(PAR, NOTE);
    console.log(ecriture ? "✅ Compte 1200 aligné sur le stock." : "Grand livre : aucune écriture nécessaire.");
  } catch (e) {
    console.error(`⚠️ Grand livre non aligné : ${e.message.replace(/^PERIODE_LOCK:/, "")}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
