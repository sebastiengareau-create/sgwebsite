// Conciliation bancaire — logique partagée entre la page et l'API.
//
// Principe : le solde du relevé doit égaler le solde d'ouverture (tout ce qui
// a été concilié et verrouillé auparavant) + les lignes pointées jusqu'à la
// date du relevé. Les lignes non pointées sont les éléments en circulation
// (chèques pas encore encaissés, dépôts en transit) : elles expliquent l'écart
// normal entre le solde des livres et le relevé. Une fois enregistrée, la
// conciliation verrouille ses lignes pointées (rapprochementId), qui forment
// alors le solde d'ouverture de la suivante.
const { prisma } = require("./prisma");

// Un relevé de carte de crédit montre le solde dû en positif, alors qu'au
// plan comptable c'est un passif (crédit − débit) : on inverse le signe pour
// que les montants se comparent directement au relevé.
function sensCompte(categorie) {
  return categorie === "CARTE_CREDIT" ? -1 : 1;
}

function montantLigne(ligne, sens) {
  return sens * (ligne.debit - ligne.credit);
}

async function obtenirSoldeOuverture(compteGlId, sens) {
  const total = await prisma.ligneEcriture.aggregate({
    where: { compteId: compteGlId, rapprochementId: { not: null } },
    _sum: { debit: true, credit: true },
  });
  return sens * ((total._sum.debit || 0) - (total._sum.credit || 0));
}

// Lignes encore modifiables (pas verrouillées par une conciliation), toutes
// dates confondues — la page filtre ensuite selon la date du relevé choisie.
async function obtenirLignesNonVerrouillees(compteGlId) {
  return prisma.ligneEcriture.findMany({
    where: { compteId: compteGlId, rapprochementId: null },
    include: { ecriture: true },
    orderBy: { ecriture: { date: "asc" } },
  });
}

module.exports = { sensCompte, montantLigne, obtenirSoldeOuverture, obtenirLignesNonVerrouillees };
