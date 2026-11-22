import { prisma } from "@/lib/prisma";
import { obtenirInfosEntreprise, lignesEnteteEntreprise } from "@/lib/config";
import { lireParametres } from "@/lib/parametres";
import { libelleVehicule } from "@/lib/vehicules";
import { nomClientBon } from "@/lib/nomClient";
import { peutRepondreInspection } from "@/lib/grillesInspection";
import { paiementEnLigneActif, lirePourcentDepot, depotInspection, modeTestStripe } from "@/lib/paiementEnLigne";
import LogoClient from "../../components/LogoClient";
import RapportClient from "./RapportClient";

// Page publique d'un rapport d'inspection : le client voit l'état de son
// véhicule, les photos et les travaux recommandés, coche ceux qu'il accepte,
// signe et approuve (lib/inspections.js). Protégée par le lien secret du
// rapport ; jamais indexée.
export const metadata = { title: "Rapport d'inspection", robots: { index: false, follow: false } };

export default async function PageRapportInspection(props) {
  const { jeton } = await props.params;
  const { paiement } = await props.searchParams;
  const [entreprise, inspection, dict, paiementActif, pourcentDepot] = await Promise.all([
    obtenirInfosEntreprise(),
    prisma.inspection.findUnique({
      where: { jetonClient: jeton },
      include: {
        points: { orderBy: { ordre: "asc" }, include: { photos: { select: { id: true }, orderBy: { ajouteeLe: "asc" } } } },
        bon: { select: { numero: true, clientNomAffiche: true, client: { select: { nom: true } }, vehicule: true, depots: { select: { montant: true } } } },
      },
    }),
    lireParametres(["tps_taux", "tvq_taux"]),
    paiementEnLigneActif(),
    lirePourcentDepot(),
  ]);

  // Lien inconnu, ou inspection rouverte pour modification
  if (!inspection || inspection.statut !== "TERMINEE") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "var(--bg)" }}>
        <div style={{ maxWidth: 420, textAlign: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: 24 }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>🔒</div>
          <h1 style={{ fontSize: 20, margin: "0 0 10px" }}>{entreprise.nomEntreprise}</h1>
          <p style={{ fontSize: 14, margin: 0, color: "var(--text-muted)" }}>
            {inspection
              ? "Ce rapport est en cours de mise à jour. Réessayez un peu plus tard"
              : "Ce lien n'est plus valide. Communiquez avec nous pour recevoir votre rapport"}
            {entreprise.telephone ? ` (${entreprise.telephone})` : ""}.
          </p>
        </div>
      </div>
    );
  }

  const etat = peutRepondreInspection(inspection) ? "A_REPONDRE" : inspection.reponseClient || "CONSULTATION";
  // Dépôt en ligne sur les travaux approuvés (lib/paiementEnLigne.js)
  const depotEnLigne = paiementActif && pourcentDepot
    ? { depot: await depotInspection(inspection, inspection.bon.depots, pourcentDepot), pourcent: pourcentDepot, retour: typeof paiement === "string" ? paiement : null, modeTest: modeTestStripe() }
    : null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "20px 16px 40px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 14, marginBottom: 16, borderBottom: "2px solid var(--text)" }}>
          <LogoClient alt={entreprise.nomEntreprise} width={84} height={56} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{entreprise.nomEntreprise}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.45 }}>
              {lignesEnteteEntreprise(entreprise).map((l) => <div key={l}>{l}</div>)}
            </div>
          </div>
        </header>

        <RapportClient
          jeton={jeton}
          etat={etat}
          rapport={{
            titre: inspection.titre,
            date: inspection.termineeLe || inspection.creeLe,
            clientNom: nomClientBon(inspection.bon),
            vehicule: inspection.bon.vehicule ? libelleVehicule(inspection.bon.vehicule) : "",
            kilometrage: inspection.kilometrage,
            technicienNom: inspection.technicienNom,
            noteGenerale: inspection.noteGenerale,
            reponseLe: inspection.reponseLe,
            signataireNom: inspection.signataireNom,
            signatureClient: inspection.signatureClient,
            noteClient: inspection.noteClient,
            points: inspection.points.map((p) => ({
              id: p.id, section: p.section, libelle: p.libelle, ordre: p.ordre, unite: p.unite, etat: p.etat, mesure: p.mesure,
              constat: p.constat, recommandation: p.recommandation, prixEstime: p.prixEstime, approbation: p.approbation,
              photos: p.photos.map((ph) => ph.id),
            })),
          }}
          taux={{ tpsTaux: Number(dict.tps_taux || 5), tvqTaux: Number(dict.tvq_taux || 9.975) }}
          conditions={entreprise.conditionsGenerales}
          telephone={entreprise.telephone}
          depotEnLigne={depotEnLigne}
        />
      </div>
    </div>
  );
}
