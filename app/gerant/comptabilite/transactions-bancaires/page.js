import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assurerCategoriesDepense, CODE_CATEGORIE_INVENTAIRE } from "@/lib/comptabilite";
import { assurerComptesTresorerie, obtenirComptesTresoreriePourSelection } from "@/lib/tresorerie";
import { sensCompte } from "@/lib/rapprochement";
import { reparerStatuts, calculerSuggestions } from "@/lib/transactionsBancaires";
import EnTete from "../../../components/EnTete";
import TransactionsBancairesClient from "./TransactionsBancairesClient";

const jour = (date) => (date ? new Date(date).toISOString().slice(0, 10) : null);

// Ce à quoi une transaction examinée est reliée, en une ligne lisible
function resumeLiens(t) {
  return t.lignes.map((l) => ({ numero: l.ecriture.numero, description: l.description || l.ecriture.description }));
}

export default async function TransactionsBancaires(props) {
  const searchParams = await props.searchParams;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) redirect("/gerant");

  const moduleComptabilite = await prisma.parametre.findUnique({ where: { cle: "module_comptabilite" } });
  if (moduleComptabilite?.valeur === "inactif") redirect("/gerant");

  await assurerComptesTresorerie();
  await assurerCategoriesDepense();
  const comptesTresorerie = await obtenirComptesTresoreriePourSelection();
  const compteId = searchParams?.compte || comptesTresorerie.find((c) => c.categorie === "BANQUE")?.id || comptesTresorerie[0]?.id;
  const compte = compteId ? await prisma.compteTresorerie.findUnique({ where: { id: compteId }, include: { compte: true } }) : null;
  if (!compte) redirect("/gerant/comptabilite");

  await reparerStatuts(compte.id);
  const lienLignes = { include: { ecriture: { select: { numero: true, description: true } } } };
  const [aExaminer, examinees, exclues, dernier, totauxLivres, fournisseurs, categories, comptesGl, derniersPostes, parametres] = await Promise.all([
    prisma.transactionBancaire.findMany({ where: { compteTresorerieId: compte.id, statut: "A_EXAMINER" }, orderBy: [{ date: "desc" }, { description: "asc" }] }),
    prisma.transactionBancaire.findMany({
      where: { compteTresorerieId: compte.id, statut: { in: ["ASSOCIEE", "AJOUTEE"] } },
      include: { lignes: lienLignes },
      orderBy: [{ date: "desc" }, { description: "asc" }],
      take: 150,
    }),
    prisma.transactionBancaire.findMany({ where: { compteTresorerieId: compte.id, statut: "EXCLUE" }, orderBy: { date: "desc" }, take: 150 }),
    prisma.transactionBancaire.findFirst({ where: { compteTresorerieId: compte.id }, orderBy: { importeLe: "desc" }, select: { importId: true, fichier: true, importeLe: true } }),
    prisma.ligneEcriture.aggregate({ where: { compteId: compte.compteId }, _sum: { debit: true, credit: true } }),
    prisma.fournisseur.findMany({ where: { actif: true }, select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
    prisma.categorieDepense.findMany({ where: { actif: true, code: { not: CODE_CATEGORIE_INVENTAIRE } }, select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
    prisma.compte.findMany({ where: { actif: true, id: { not: compte.compteId } }, select: { numero: true, nom: true, type: true }, orderBy: { numero: "asc" } }),
    // Dernier poste utilisé pour chaque fournisseur — proposé d'office,
    // comme QuickBooks qui retient la catégorie d'un bénéficiaire
    prisma.depense.findMany({ distinct: ["fournisseurId"], orderBy: { creeLe: "desc" }, select: { fournisseurId: true, lignes: { select: { categorieDepenseId: true }, take: 1 } } }),
    prisma.parametre.findMany({ where: { cle: { in: ["tps_taux", "tvq_taux"] } } }),
  ]);

  const suggestions = await calculerSuggestions(compte, aExaminer);
  const dernierImport = dernier
    ? {
        importId: dernier.importId,
        fichier: dernier.fichier,
        importeLe: dernier.importeLe.toISOString(),
        aExaminer: aExaminer.filter((t) => t.importId === dernier.importId).length,
      }
    : null;
  const sens = sensCompte(compte.categorie);
  const taux = Object.fromEntries(parametres.map((p) => [p.cle, Number(p.valeur)]));
  const versClient = (t) => ({ id: t.id, date: jour(t.date), montant: t.montant, description: t.description, reference: t.reference });

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <TransactionsBancairesClient
        key={compte.id}
        comptesTresorerie={comptesTresorerie}
        compte={{
          id: compte.id,
          nom: compte.nom,
          categorie: compte.categorie,
          soldeReleve: compte.soldeReleveLe ? compte.soldeReleve : null,
          soldeReleveLe: jour(compte.soldeReleveLe),
          soldeLivres: sens * ((totauxLivres._sum.debit || 0) - (totauxLivres._sum.credit || 0)),
        }}
        aExaminer={aExaminer.map((t) => ({ ...versClient(t), suggestion: suggestions[t.id] || null }))}
        examinees={examinees.map((t) => ({ ...versClient(t), statut: t.statut, creeType: t.creeType, examinePar: t.examinePar, liens: resumeLiens(t) }))}
        exclues={exclues.map((t) => ({ ...versClient(t), examinePar: t.examinePar }))}
        dernierImport={dernierImport}
        fournisseurs={fournisseurs}
        categories={categories}
        comptesGl={comptesGl}
        dernierPosteParFournisseur={Object.fromEntries(derniersPostes.filter((d) => d.lignes[0]).map((d) => [d.fournisseurId, d.lignes[0].categorieDepenseId]))}
        tpsTaux={taux.tps_taux || 5}
        tvqTaux={taux.tvq_taux || 9.975}
      />
    </div>
  );
}
