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
  const surCompte = { compteTresorerieId: compte.id };
  const [
    aExaminer, examinees, exclues, nbExaminees, totalDoublons, imports, enAttenteParImport, totauxLivres,
    fournisseurs, categories, comptesGl, derniersPostes, regles, parametres,
  ] = await Promise.all([
    prisma.transactionBancaire.findMany({ where: { ...surCompte, statut: "A_EXAMINER" }, orderBy: [{ date: "desc" }, { description: "asc" }] }),
    prisma.transactionBancaire.findMany({
      where: { ...surCompte, statut: { in: ["ASSOCIEE", "AJOUTEE"] } },
      include: { lignes: { include: { ecriture: { select: { numero: true, description: true } } } } },
      orderBy: [{ date: "desc" }, { description: "asc" }],
      take: 150,
    }),
    prisma.transactionBancaire.findMany({ where: { ...surCompte, statut: "EXCLUE" }, orderBy: { date: "desc" }, take: 150 }),
    prisma.transactionBancaire.count({ where: { ...surCompte, statut: { in: ["ASSOCIEE", "AJOUTEE"] } } }),
    prisma.importBancaire.aggregate({ where: surCompte, _sum: { nbDoublons: true } }),
    // Historique — sans le contenu des fichiers, téléchargé à la demande
    prisma.importBancaire.findMany({
      where: surCompte,
      orderBy: { importeLe: "desc" },
      take: 12,
      select: { id: true, nomFichier: true, format: true, numeroCompte: true, nbLues: true, nbImportees: true, nbDoublons: true, debut: true, fin: true, importePar: true, importeLe: true, annuleLe: true, annulePar: true },
    }),
    prisma.transactionBancaire.groupBy({ by: ["importId"], where: { ...surCompte, statut: "A_EXAMINER" }, _count: true }),
    prisma.ligneEcriture.aggregate({ where: { compteId: compte.compteId }, _sum: { debit: true, credit: true } }),
    prisma.fournisseur.findMany({ where: { actif: true }, select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
    prisma.categorieDepense.findMany({ where: { actif: true, code: { not: CODE_CATEGORIE_INVENTAIRE } }, select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
    prisma.compte.findMany({ where: { actif: true, id: { not: compte.compteId } }, select: { numero: true, nom: true, type: true }, orderBy: { numero: "asc" } }),
    // Dernier poste utilisé pour chaque fournisseur — proposé d'office,
    // comme QuickBooks qui retient la catégorie d'un bénéficiaire
    prisma.depense.findMany({ distinct: ["fournisseurId"], orderBy: { creeLe: "desc" }, select: { fournisseurId: true, lignes: { select: { categorieDepenseId: true }, take: 1 } } }),
    prisma.regleBancaire.findMany({
      include: { fournisseur: { select: { nom: true } }, categorieDepense: { select: { nom: true } } },
      orderBy: { derniereUtilisation: "desc" },
    }),
    prisma.parametre.findMany({ where: { cle: { in: ["tps_taux", "tvq_taux"] } } }),
  ]);

  const suggestions = await calculerSuggestions(compte, aExaminer);
  const enAttente = Object.fromEntries(enAttenteParImport.map((g) => [g.importId, g._count]));
  const nomCompte = Object.fromEntries(comptesGl.map((c) => [c.numero, c.nom]));
  const sens = sensCompte(compte.categorie);
  const taux = Object.fromEntries(parametres.map((p) => [p.cle, Number(p.valeur)]));
  const versClient = (t) => ({
    id: t.id, date: jour(t.date), montant: t.montant, description: t.description, reference: t.reference,
    journal: Array.isArray(t.journal) ? t.journal : [],
  });

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
          compteGl: `${compte.compte.numero} · ${compte.compte.nom}`,
          soldeReleve: compte.soldeReleveLe ? compte.soldeReleve : null,
          soldeReleveLe: jour(compte.soldeReleveLe),
          soldeLivres: sens * ((totauxLivres._sum.debit || 0) - (totauxLivres._sum.credit || 0)),
        }}
        aExaminer={aExaminer.map((t) => ({ ...versClient(t), suggestion: suggestions[t.id] || null }))}
        examinees={examinees.map((t) => ({
          ...versClient(t), statut: t.statut, creeType: t.creeType, examinePar: t.examinePar,
          liens: t.lignes.map((l) => ({ numero: l.ecriture.numero, description: l.description || l.ecriture.description })),
        }))}
        exclues={exclues.map((t) => ({ ...versClient(t), examinePar: t.examinePar }))}
        nbExaminees={nbExaminees}
        totalDoublons={totalDoublons._sum.nbDoublons || 0}
        imports={imports.map((i) => ({
          ...i, debut: jour(i.debut), fin: jour(i.fin), importeLe: i.importeLe.toISOString(), annuleLe: i.annuleLe?.toISOString() || null,
          aExaminer: enAttente[i.id] || 0,
        }))}
        regles={regles.map((r) => ({
          id: r.id, signature: r.signature, sens: r.sens, utilisations: r.utilisations,
          classement: r.action === "DEPENSE"
            ? `${r.fournisseur?.nom} · ${r.categorieDepense?.nom}${r.taxesIncluses ? " · taxes incluses" : ""}`
            : `${r.compteNumero} · ${nomCompte[r.compteNumero] || "compte"}`,
        }))}
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
