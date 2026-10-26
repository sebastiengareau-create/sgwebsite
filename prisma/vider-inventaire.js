// ============================================================
// SCRIPT À USAGE UNIQUE — vide l'inventaire (pièces) pour repartir d'un
// nouveau fichier Excel (Inventaire → Importer).
//
// - Pièce jamais utilisée (aucun bon, commande, facture fournisseur ni pièce
//   à commander) : effacée, avec son journal et son historique.
// - Pièce utilisée : gardée pour l'historique des bons et des factures (qui
//   affichent son nom, inchangé), mais stock à 0 (mouvement « AJUSTEMENT »),
//   désactivée, numéro renommé « ANCIEN-… », code-barres et autres numéros
//   libérés — sinon l'import la reconnaîtrait et ne créerait pas de fiche
//   neuve pour ce numéro.
//
// Ensuite, le compte 1200 est aligné sur le stock (contrepartie 3010, aucun
// effet sur le bénéfice), comme un ajustement manuel dans l'appli.
// Catégories et fournisseurs ne sont pas touchés.
//
// Utilisation (avec la base du client connectée — via `railway ssh` sur le
// service de l'appli, ou le tunnel comme pour une migration) :
//
//   node prisma/vider-inventaire.js              → aperçu, ne change rien
//   node prisma/vider-inventaire.js --confirmer  → applique
// ============================================================

const { prisma } = require("../lib/prisma");
const { alignerInventaireAuGL } = require("../lib/comptabilite");

const NOTE = "Inventaire vidé (nouvel import)";
const PAR = "Inventaire vidé (script)";
const PREFIXE = "ANCIEN-";

async function main() {
  const confirmer = process.argv.includes("--confirmer");

  const pieces = await prisma.piece.findMany({
    select: {
      id: true, numero: true, qte: true, coutant: true,
      _count: { select: { utilisee: true, lignesCommande: true, lignesDepense: true, piecesACommander: true } },
    },
  });
  const estUtilisee = (p) => Object.values(p._count).some((n) => n > 0);
  const aEffacer = pieces.filter((p) => !estUtilisee(p));
  const aGarder = pieces.filter(estUtilisee);
  const valeur = pieces.reduce((s, p) => s + p.qte * p.coutant, 0);

  console.log(`${pieces.length} pièce(s) au total, valeur du stock au coûtant ${valeur.toFixed(2)} $.`);
  console.log(`- ${aEffacer.length} jamais utilisée(s) : effacée(s).`);
  console.log(`- ${aGarder.length} utilisée(s) sur des bons, commandes ou factures : stock à 0, désactivée(s), numéro « ${PREFIXE}… ».`);

  if (!confirmer) {
    console.log("\nAperçu seulement. Pour appliquer : node prisma/vider-inventaire.js --confirmer");
    return;
  }

  const { count } = await prisma.piece.deleteMany({ where: { id: { in: aEffacer.map((p) => p.id) } } });
  console.log(`\n✅ ${count} pièce(s) effacée(s).`);

  const numerosPris = new Set(
    (await prisma.piece.findMany({ select: { numero: true } })).map((p) => p.numero.toLowerCase())
  );
  for (const p of aGarder) {
    let numero = p.numero;
    if (!numero.startsWith(PREFIXE)) {
      numero = `${PREFIXE}${p.numero}`;
      for (let i = 2; numerosPris.has(numero.toLowerCase()); i++) numero = `${PREFIXE}${i}-${p.numero}`;
      numerosPris.add(numero.toLowerCase());
    }
    await prisma.piece.update({
      where: { id: p.id },
      data: {
        numero, codeBarre: null, autresNumeros: [], qte: 0, actif: false,
        ...(p.qte !== 0 && {
          mouvements: { create: { type: "AJUSTEMENT", qte: -p.qte, solde: 0, note: NOTE, creePar: PAR } },
        }),
      },
    });
  }
  console.log(`✅ ${aGarder.length} pièce(s) mise(s) de côté (stock à 0, désactivée(s)).`);

  // Comme dans l'appli : l'inventaire est déjà vidé, un échec comptable (ex.
  // période fermée) est seulement signalé.
  try {
    const ecriture = await alignerInventaireAuGL(PAR, NOTE);
    console.log(ecriture ? "✅ Compte 1200 aligné sur le stock." : "Grand livre : aucune écriture nécessaire.");
  } catch (e) {
    console.error(`⚠️ Grand livre non aligné : ${e.message.replace(/^PERIODE_LOCK:/, "")}`);
  }
  console.log("\nL'inventaire est prêt pour l'import du nouveau fichier Excel.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
