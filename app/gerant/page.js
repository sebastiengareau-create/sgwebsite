import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenirSession, estGerantOuDev } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { limitesMoisQuebec, dateAujourdhuiQuebec } from "@/lib/temps";
import { calculerResumeFermeture, calculerResumeRevenusDepenses } from "@/lib/rapportsComptables";
import EnTete from "../components/EnTete";
import LiveTimer from "../components/LiveTimer";
import VueGlobaleClient from "./VueGlobaleClient";

const NOMS_MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const NOMS_MOIS_COURT = ["Jan.", "Fév.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];
const INTERVALLE_JOURS_PAIE = { HEBDOMADAIRE: 7, BIHEBDOMADAIRE: 14, BIMENSUEL: 15, MENSUEL: 30 };
const JOUR_MS = 86400000;

function moisPrecedent(annee, mois) {
  return mois === 1 ? { annee: annee - 1, mois: 12 } : { annee, mois: mois - 1 };
}

// Score de santé financière — heuristique simplifiée à but indicatif
// seulement (pas un ratio comptable certifié) : marge bénéficiaire (40 pts),
// mois de réserve de liquidités (30 pts), ratio d'endettement fournisseurs
// vs actifs liquides+à recevoir (30 pts).
function calculerSanteFinanciere({ revenus, depenses, beneficeNet, soldeBancaire, clientsARecevoir, fournisseursAPayer }) {
  const aucuneDonnee = !revenus && !depenses && !soldeBancaire && !clientsARecevoir && !fournisseursAPayer;
  if (aucuneDonnee) {
    return { score: 0, label: "Aucune donnée", ratioEndettement: 0, margePct: 0 };
  }

  const margePct = revenus > 0 ? beneficeNet / revenus : 0;
  const margeScore = Math.max(0, Math.min(40, (margePct / 0.25) * 40));

  const depenseMensuelle = depenses > 0 ? depenses : 1;
  const moisReserve = soldeBancaire / depenseMensuelle;
  const liquiditeScore = Math.max(0, Math.min(30, (moisReserve / 3) * 30));

  const actifsDisponibles = soldeBancaire + clientsARecevoir;
  const ratioEndettement = actifsDisponibles > 0 ? fournisseursAPayer / actifsDisponibles : (fournisseursAPayer > 0 ? 1 : 0);
  const detteScore = Math.max(0, Math.min(30, 30 - (ratioEndettement / 0.5) * 30));

  const total = Math.round(margeScore + liquiditeScore + detteScore);
  let label = "À améliorer";
  if (total >= 80) label = "Excellente";
  else if (total >= 60) label = "Bonne";
  else if (total >= 40) label = "Moyenne";

  return { score: Math.max(0, Math.min(100, total)), label, ratioEndettement: ratioEndettement * 100, margePct: margePct * 100 };
}

export default async function EspaceGerant({ searchParams }) {
  const session = await obtenirSession();
  if (!session) redirect("/login");
  if (!estGerantOuDev(session)) redirect(`/${session.role.toLowerCase()}`);

  const aujourdhuiStr = dateAujourdhuiQuebec();
  const [anCourant, moisCourantDefaut] = aujourdhuiStr.split("-").map(Number);
  const annee = Number(searchParams?.annee) || anCourant;
  const mois = Number(searchParams?.mois) || moisCourantDefaut;

  const { debut, fin } = limitesMoisQuebec(annee, mois);
  const prec = moisPrecedent(annee, mois);
  const { debut: debutPrec, fin: finPrec } = limitesMoisQuebec(prec.annee, prec.mois);
  const maintenant = new Date();
  const dansUneSemaine = new Date(maintenant.getTime() + 7 * JOUR_MS);
  const ilYA30Jours = new Date(maintenant.getTime() - 30 * JOUR_MS);

  // 12 derniers mois se terminant au mois affiché, pour le graphique
  const moisGraphique = [];
  for (let i = 11; i >= 0; i--) {
    let a = annee, m = mois - i;
    while (m < 1) { m += 12; a -= 1; }
    moisGraphique.push({ annee: a, mois: m });
  }

  const [
    resumeCourant, resumePrecedent, historiqueBrut,
    facturesImpayeesCount, fournisseursImpayesDistincts,
    facturesEnRetard, depensesEcheanceProche, dernierePaie,
    enAttente, enCours, inventaire, poinconsActifs, poinconsInternesActifs,
  ] = await Promise.all([
    calculerResumeFermeture({ debut, fin }),
    calculerResumeFermeture({ debut: debutPrec, fin: finPrec }),
    Promise.all(moisGraphique.map((m) => calculerResumeRevenusDepenses(limitesMoisQuebec(m.annee, m.mois)))),
    prisma.facture.count({ where: { statut: "IMPAYEE", dateEmission: { lte: fin } } }),
    prisma.depense.findMany({ where: { statut: "IMPAYEE", dateFacture: { lte: fin } }, select: { fournisseurId: true }, distinct: ["fournisseurId"] }),
    prisma.facture.aggregate({ where: { statut: "IMPAYEE", dateEmission: { lte: ilYA30Jours } }, _sum: { totalAvecTaxes: true }, _count: true }),
    prisma.depense.aggregate({ where: { statut: "IMPAYEE", dateEcheance: { gte: maintenant, lte: dansUneSemaine } }, _sum: { montant: true }, _count: true }),
    prisma.paie.findFirst({ where: { statut: { not: "CORRIGEE" } }, orderBy: { periodeFin: "desc" }, include: { employe: true } }),
    prisma.bonTravail.count({ where: { statut: "EN_ATTENTE" } }),
    prisma.bonTravail.count({ where: { statut: "EN_COURS" } }),
    prisma.piece.findMany(),
    prisma.entreeTemps.findMany({
      where: { fin: null },
      include: { employe: true, probleme: { include: { bon: { include: { client: true, problemes: { orderBy: { id: "asc" } } } } } } },
      orderBy: { debut: "asc" },
    }),
    prisma.entreeTempsInterne.findMany({
      where: { fin: null },
      include: { employe: true, tacheInterne: true },
      orderBy: { debut: "asc" },
    }),
  ]);

  const stockBas = inventaire.filter((p) => p.qte <= p.qteMin);
  const totalPoinconsActifs = poinconsActifs.length + poinconsInternesActifs.length;

  function variation(actuel, precedent) {
    if (!precedent) return null;
    return ((actuel - precedent) / Math.abs(precedent)) * 100;
  }

  const kpis = {
    revenus: resumeCourant.revenus,
    revenusVariation: variation(resumeCourant.revenus, resumePrecedent.revenus),
    clientsARecevoir: resumeCourant.clientsARecevoir,
    facturesImpayeesCount,
    fournisseursAPayer: resumeCourant.fournisseursAPayer,
    fournisseursImpayesCount: fournisseursImpayesDistincts.length,
    soldeBancaire: resumeCourant.soldeBancaire,
    soldeBancaireVariation: variation(resumeCourant.soldeBancaire, resumePrecedent.soldeBancaire),
    beneficeNet: resumeCourant.beneficeNet,
    beneficeNetVariation: variation(resumeCourant.beneficeNet, resumePrecedent.beneficeNet),
  };

  const graphique = moisGraphique.map((m, i) => ({
    label: NOMS_MOIS_COURT[m.mois - 1],
    revenus: historiqueBrut[i].revenus,
    depenses: historiqueBrut[i].depenses,
    benefice: historiqueBrut[i].revenus - historiqueBrut[i].depenses,
  }));

  const sante = calculerSanteFinanciere(resumeCourant);

  let paieProchaine = null;
  if (dernierePaie) {
    const intervalle = INTERVALLE_JOURS_PAIE[dernierePaie.employe?.frequencePaie] || 14;
    paieProchaine = new Date(new Date(dernierePaie.periodeFin).getTime() + intervalle * JOUR_MS);
  }

  const alertes = [];
  if (facturesEnRetard._count > 0) {
    alertes.push({ niveau: "danger", icone: "🔴", texte: `${facturesEnRetard._count} facture${facturesEnRetard._count > 1 ? "s" : ""} en retard`, montant: facturesEnRetard._sum.totalAvecTaxes, href: "/secretaire/factures" });
  }
  if (depensesEcheanceProche._count > 0) {
    alertes.push({ niveau: "avertissement", icone: "🟠", texte: `${depensesEcheanceProche._count} fournisseur${depensesEcheanceProche._count > 1 ? "s" : ""} à payer cette semaine`, montant: depensesEcheanceProche._sum.montant, href: "/gerant/comptabilite/comptes-a-payer" });
  }
  if (resumeCourant.tpsARemettre + resumeCourant.tvqARemettre > 1) {
    alertes.push({ niveau: "avertissement", icone: "🟠", texte: "TPS/TVQ à remettre", montant: resumeCourant.tpsARemettre + resumeCourant.tvqARemettre, href: "/gerant/comptabilite/rapports/tps-tvq" });
  }
  if (stockBas.length > 0) {
    alertes.push({ niveau: "avertissement", icone: "🟠", texte: `${stockBas.length} pièce${stockBas.length > 1 ? "s" : ""} sous le seuil de stock`, href: "/secretaire/inventaire" });
  }
  if (paieProchaine) {
    alertes.push({ niveau: "info", icone: "🟢", texte: `Paie prochaine (estimée) : ${paieProchaine.toLocaleDateString("fr-CA", { timeZone: "America/Toronto", weekday: "long", day: "numeric", month: "long" })}`, href: "/gerant/paie" });
  }

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <VueGlobaleClient
        nomUtilisateur={session.nom}
        annee={annee}
        mois={mois}
        nomMois={NOMS_MOIS[mois - 1]}
        kpis={kpis}
        graphique={graphique}
        sante={sante}
        alertes={alertes}
      />

      <div className="conteneur-page" style={{ marginTop: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
          <Link href="/secretaire?statut=EN_ATTENTE" style={{ textDecoration: "none" }}><Carte label="Bons en attente" valeur={enAttente} /></Link>
          <Link href="/secretaire?statut=EN_COURS" style={{ textDecoration: "none" }}><Carte label="Bons en cours" valeur={enCours} /></Link>
          <Link href="/secretaire/inventaire" style={{ textDecoration: "none" }}><Carte label="Pièces sous le seuil" valeur={stockBas.length} alerte={stockBas.length > 0} /></Link>
        </div>

        <h2 style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 8 }}>
          ⏱ Horodateurs actifs ({totalPoinconsActifs})
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {poinconsActifs.map((t) => {
            const numeroTache = t.probleme.bon.problemes.findIndex((p) => p.id === t.probleme.id) + 1;
            return (
            <Link key={t.id} href={`/bons/${t.probleme.bon.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{ background: "var(--surface)", border: "1px solid var(--accent)", borderRadius: 10, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{t.employe.nom}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    #{t.probleme.bon.numero} · {t.probleme.bon.client.nom} · <strong>{numeroTache}.</strong> {t.probleme.description}
                  </div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700 }}>
                  <LiveTimer debut={t.debut.toISOString()} />
                </span>
              </div>
            </Link>
            );
          })}
          {poinconsInternesActifs.map((t) => (
            <div key={t.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{t.employe.nom}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>🛠️ {t.tacheInterne.nom} (interne, non facturable)</div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700 }}>
                <LiveTimer debut={t.debut.toISOString()} />
              </span>
            </div>
          ))}
          {totalPoinconsActifs === 0 && (
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Personne n'est poinçonné actuellement.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Carte({ label, valeur, alerte }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: alerte ? "var(--danger)" : "var(--accent)" }}>{valeur}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</div>
    </div>
  );
}
