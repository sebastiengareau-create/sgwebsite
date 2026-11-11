import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { limitesMoisQuebec, dateAujourdhuiQuebec, dateQuebecStr } from "@/lib/temps";
import { calculerResumeFermeture, calculerResumeRevenusDepenses, calculerDetailRevenusDepenses } from "@/lib/rapportsComptables";
import EnTete from "../components/EnTete";
import LiveTimer from "../components/LiveTimer";
import VueGlobaleClient from "./VueGlobaleClient";
import { productiviteActif } from "@/lib/productivite";
import { totalAvantTaxesBon } from "@/lib/totalBon";
import { argent } from "@/lib/format";
import { NIVEAUX, niveauHorodateur } from "./niveaux";
import { TEINTES, CarteChiffre, Pastille, TitrePanneau, stylePanneau } from "../components/StyleSection";

const NOMS_MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const NOMS_MOIS_COURT = ["Jan.", "Fév.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];
const JOUR_MS = 86400000;

function moisPrecedent(annee, mois) {
  return mois === 1 ? { annee: annee - 1, mois: 12 } : { annee, mois: mois - 1 };
}

// Score de santé financière — heuristique simplifiée à but indicatif
// seulement (pas un ratio comptable certifié) : marge bénéficiaire (40 pts),
// mois de réserve de liquidités (30 pts), ratio d'endettement fournisseurs
// vs actifs liquides+à recevoir (30 pts).
// Les flux (revenus, dépenses) portent sur les 12 derniers mois se terminant
// au mois affiché — un seul mois, surtout le mois en cours incomplet, fait
// trop varier le score. Les soldes (banque, à recevoir, à payer) restent
// ceux de la fin du mois affiché.
function calculerSanteFinanciere({ historique, soldeBancaire, clientsARecevoir, fournisseursAPayer }) {
  const revenus = historique.reduce((s, m) => s + m.revenus, 0);
  const depenses = historique.reduce((s, m) => s + m.depenses, 0);
  const aucuneDonnee = !revenus && !depenses && !soldeBancaire && !clientsARecevoir && !fournisseursAPayer;
  if (aucuneDonnee) {
    return { score: 0, label: "Aucune donnée", aucuneDonnee: true, ratioEndettement: 0, margePct: 0, moisReserve: null };
  }

  const margePct = revenus > 0 ? (revenus - depenses) / revenus : 0;
  const margeScore = Math.max(0, Math.min(40, (margePct / 0.25) * 40));

  // Moyenne sur les mois ayant de l'activité seulement, pour ne pas sous-
  // estimer les dépenses d'une entreprise qui a moins de 12 mois d'historique.
  const moisActifs = historique.filter((m) => m.revenus || m.depenses).length || 1;
  const depenseMensuelle = depenses > 0 ? depenses / moisActifs : 1;
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

  return { score: Math.max(0, Math.min(100, total)), label, ratioEndettement: ratioEndettement * 100, margePct: margePct * 100, moisReserve: depenses > 0 ? moisReserve : null };
}

export default async function EspaceGerant(props) {
  const searchParams = await props.searchParams;
  const session = await obtenirSession();
  if (!session) redirect("/login");
  if (!(await aAccesSection(session, "vue-ensemble"))) {
    // GERANT est maintenant configurable ici aussi (voir aAccesSection) —
    // s'il n'a pas cette section, on ne peut plus le renvoyer vers /gerant
    // (boucle infinie), donc /secretaire comme repli sûr dans ce cas précis.
    redirect(session.role === "GERANT" ? "/secretaire" : `/${session.role.toLowerCase()}`);
  }

  const aujourdhuiStr = dateAujourdhuiQuebec();
  const [anCourant, moisCourantDefaut] = aujourdhuiStr.split("-").map(Number);
  const annee = Number(searchParams?.annee) || anCourant;
  const mois = Number(searchParams?.mois) || moisCourantDefaut;

  const { debut, fin } = limitesMoisQuebec(annee, mois);
  const prec = moisPrecedent(annee, mois);
  const { debut: debutPrec, fin: finPrec } = limitesMoisQuebec(prec.annee, prec.mois);
  const { debut: debutAnnee } = limitesMoisQuebec(annee, 1);
  const { fin: finAnnee } = limitesMoisQuebec(annee, 12);
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
    detailMois, detailAnnee,
    facturesImpayeesCount, fournisseursImpayesDistincts,
    facturesEnRetard, depensesEcheanceProche, dernierePaie, modulePaie,
    enAttente, enCours, bonsOuverts, tauxHoraireParam, inventaire, poinconsActifs, poinconsInternesActifs,
  ] = await Promise.all([
    calculerResumeFermeture({ debut, fin }),
    calculerResumeFermeture({ debut: debutPrec, fin: finPrec }),
    Promise.all(moisGraphique.map((m) => calculerResumeRevenusDepenses(limitesMoisQuebec(m.annee, m.mois)))),
    calculerDetailRevenusDepenses({ debut, fin }),
    calculerDetailRevenusDepenses({ debut: debutAnnee, fin: finAnnee }),
    prisma.facture.count({ where: { statut: "IMPAYEE", dateEmission: { lte: fin } } }),
    prisma.depense.findMany({ where: { statut: "IMPAYEE", dateFacture: { lte: fin } }, select: { fournisseurId: true }, distinct: ["fournisseurId"] }),
    prisma.facture.aggregate({ where: { statut: "IMPAYEE", dateEmission: { lte: ilYA30Jours } }, _sum: { totalAvecTaxes: true, montantPaye: true }, _count: true }),
    // inclut les échues : une facture en retard est encore plus urgente
    prisma.depense.aggregate({ where: { statut: "IMPAYEE", dateEcheance: { lte: dansUneSemaine } }, _sum: { montant: true }, _count: true }),
    prisma.paie.findFirst({ where: { statut: { not: "CORRIGEE" } }, orderBy: { dateVersement: "desc" } }),
    prisma.parametre.findUnique({ where: { cle: "module_paie" } }),
    prisma.bonTravail.count({ where: { statut: "EN_ATTENTE" } }),
    prisma.bonTravail.count({ where: { statut: "EN_COURS" } }),
    // Bons pas encore facturés, avec de quoi calculer leur montant (Travaux
    // en cours) — sans les bons internes sur un véhicule à vendre, qui ne
    // seront pas facturés à un client (leur montant va au coûtant du véhicule)
    prisma.bonTravail.findMany({
      where: { statut: { in: ["EN_ATTENTE", "EN_COURS"] }, facture: null, vehiculeVenteId: null },
      include: { problemes: { include: { pieces: { select: { qte: true, prix: true, kit: true } }, entreesTemps: { select: { debut: true, fin: true } } } } },
    }),
    prisma.parametre.findUnique({ where: { cle: "taux_horaire_client" } }),
    prisma.piece.findMany({ where: { actif: true, estKit: false }, select: { qte: true, qteMin: true } }),
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
  // Valeur avant taxes des bons en attente et en cours — à titre informatif
  // seulement (rien n'est comptabilisé avant la facture)
  const tauxHoraireClient = Number(tauxHoraireParam?.valeur || 195);
  const travauxEnCours = bonsOuverts.reduce((s, b) => s + totalAvantTaxesBon(b, tauxHoraireClient), 0);
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
    facturesEnRetardCount: facturesEnRetard._count,
    depensesAPayerBientotCount: depensesEcheanceProche._count,
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

  const sante = {
    ...calculerSanteFinanciere({ ...resumeCourant, historique: historiqueBrut }),
    periode: `${NOMS_MOIS_COURT[moisGraphique[0].mois - 1]} ${moisGraphique[0].annee} – ${NOMS_MOIS_COURT[mois - 1]} ${annee}`,
  };

  // Ajoute des jours à une journée civile Québec en restant ancré à midi
  // UTC — sinon l'ajout en millisecondes bruts peut retomber à minuit UTC,
  // qui affiche la veille une fois formaté en heure du Québec.
  function joursPlusTardQuebec(date, jours) {
    const d = new Date(`${dateQuebecStr(date)}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + jours);
    return d;
  }

  let paieProchaine = null;
  if (dernierePaie) {
    const derniereDateVersement = dernierePaie.dateVersement || dernierePaie.periodeFin;
    paieProchaine = joursPlusTardQuebec(derniereDateVersement, 14);
  }

  const alertes = [];
  if (facturesEnRetard._count > 0) {
    alertes.push({ niveau: "danger", icone: "🔴", texte: `${facturesEnRetard._count} facture${facturesEnRetard._count > 1 ? "s" : ""} en retard`, montant: (facturesEnRetard._sum.totalAvecTaxes || 0) - (facturesEnRetard._sum.montantPaye || 0), href: "/secretaire/factures" });
  }
  if (depensesEcheanceProche._count > 0) {
    alertes.push({ niveau: "avertissement", icone: "🟠", texte: `${depensesEcheanceProche._count} facture${depensesEcheanceProche._count > 1 ? "s" : ""} fournisseur à payer (échue${depensesEcheanceProche._count > 1 ? "s" : ""} ou cette semaine)`, montant: depensesEcheanceProche._sum.montant, href: "/gerant/comptabilite/comptes-a-payer" });
  }
  if (resumeCourant.tpsARemettre + resumeCourant.tvqARemettre > 1) {
    alertes.push({ niveau: "avertissement", icone: "🟠", texte: "TPS/TVQ à remettre", montant: resumeCourant.tpsARemettre + resumeCourant.tvqARemettre, href: "/gerant/comptabilite/rapports/tps-tvq" });
  }
  if (stockBas.length > 0) {
    alertes.push({ niveau: "avertissement", icone: "🟠", texte: `${stockBas.length} pièce${stockBas.length > 1 ? "s" : ""} sous le seuil de stock`, href: "/secretaire/inventaire" });
  }
  // Seulement si le module Paie est actif (désactivé par défaut)
  if (paieProchaine && modulePaie?.valeur === "actif") {
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
        rentabilite={{ mois: detailMois, annee: detailAnnee }}
        afficherRapports={(await productiviteActif()) && (await aAccesSection(session, "jobs-temps-reel"))}
      />

      <div className="conteneur-page" style={{ paddingTop: 0 }}>
        <div className="grille-deux" style={{ marginBottom: 20 }}>
          <Carte href="/secretaire?statut=EN_ATTENTE" label="Bons en attente" valeur={enAttente} niveau={enAttente > 0 ? "avertissement" : "neutre"} note={enAttente > 0 ? "À commencer" : "Aucun bon en attente"} />
          <Carte href="/secretaire?statut=EN_COURS" label="Bons en cours" valeur={enCours} niveau={enCours > 0 ? "bleu" : "neutre"} note={enCours > 0 ? "Au travail en ce moment" : "Aucun bon en cours"} />
          <Carte href="/secretaire" label="Travaux en cours" valeur={argent(travauxEnCours)} niveau="neutre" note="Bons en attente et en cours, avant taxes, sans les bons internes · à titre informatif" />
          <Carte href="/secretaire/inventaire" label="Pièces sous le seuil" valeur={stockBas.length} niveau={stockBas.length > 0 ? "danger" : "bon"} note={stockBas.length > 0 ? "À recommander" : "Stock suffisant"} />
        </div>

        <div style={stylePanneau}>
          <TitrePanneau
            icone="horloge" teinte={TEINTES.vert} titre="Horodateurs actifs"
            sousTitre={totalPoinconsActifs > 0 ? "Orange après 8 h · rouge après 10 h (probablement un oubli)." : "Personne n'est poinçonné actuellement."}
            droite={<Pastille couleur={totalPoinconsActifs > 0 ? "var(--success)" : "var(--text-muted)"} fond={totalPoinconsActifs > 0 ? "var(--success-fond)" : "var(--surface-alt)"}>{totalPoinconsActifs}</Pastille>}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {poinconsActifs.map((t) => {
              const numeroTache = t.probleme.bon.problemes.findIndex((p) => p.id === t.probleme.id) + 1;
              return (
                <Link key={t.id} href={`/bons/${t.probleme.bon.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                  <LigneHorodateur debut={t.debut} maintenant={maintenant} nom={t.employe.nom}>
                    Bon #{t.probleme.bon.numero} · {t.probleme.bon.client.nom} · <strong>{numeroTache}.</strong> {t.probleme.description}
                  </LigneHorodateur>
                </Link>
              );
            })}
            {poinconsInternesActifs.map((t) => (
              <LigneHorodateur key={t.id} debut={t.debut} maintenant={maintenant} nom={t.employe.nom}>
                {t.tacheInterne.nom} (interne, non facturable)
              </LigneHorodateur>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Carte chiffre cliquable, teintée selon le niveau (voir NIVEAUX)
function Carte({ href, label, valeur, niveau, note }) {
  const { couleur } = NIVEAUX[niveau];
  const neutre = niveau === "neutre";
  return <CarteChiffre href={href} titre={label} montant={String(valeur)} teinte={neutre ? "var(--border)" : couleur} couleur={neutre ? "var(--text)" : couleur} note={note} />;
}

// Une ligne par poinçon ouvert, colorée selon sa durée (voir niveauHorodateur)
function LigneHorodateur({ debut, maintenant, nom, children }) {
  const { niveau, etat } = niveauHorodateur(debut, maintenant);
  const { couleur, fond } = NIVEAUX[niveau];
  const neutre = niveau === "neutre";
  return (
    <div style={{ position: "relative", overflow: "hidden", display: "flex", alignItems: "center", gap: 12, padding: "10px 12px 10px 16px", borderRadius: 12, background: neutre ? "var(--bg)" : fond, border: `1px solid ${neutre ? "var(--border)" : couleur}` }}>
      <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: neutre ? "var(--success)" : couleur }} />
      <span style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: TEINTES.ambre.fond, color: TEINTES.ambre.couleur, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800 }}>
        {nom.charAt(0).toUpperCase()}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{nom}</span>
          {etat && <Pastille couleur={couleur} fond="var(--surface)">{etat}</Pastille>}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{children}</div>
      </div>
      <LiveTimer debut={debut.toISOString()} />
    </div>
  );
}
