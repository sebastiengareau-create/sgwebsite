import { prisma } from "@/lib/prisma";
import { obtenirInfosEntreprise, lignesEnteteEntreprise } from "@/lib/config";
import { lireParametres } from "@/lib/parametres";
import { peutRepondre } from "@/lib/approbationSoumission";
import { paiementEnLigneActif, lirePourcentDepot, depotSoumission, modeTestStripe } from "@/lib/paiementEnLigne";
import LogoClient from "../../components/LogoClient";
import ApprobationClient from "./ApprobationClient";

// Page publique d'une soumission : le client la consulte, coche les travaux
// qu'il accepte, signe et approuve (lib/approbationSoumission.js). Protégée
// par le lien secret propre à la soumission ; jamais indexée.
export const metadata = { robots: { index: false, follow: false } };

export default async function SoumissionClient(props) {
  const { jeton } = await props.params;
  const { paiement } = await props.searchParams;
  const [entreprise, soumission, dict, paiementActif, pourcentDepot] = await Promise.all([
    obtenirInfosEntreprise(),
    prisma.soumission.findUnique({
      where: { jetonClient: jeton },
      omit: { signatureClient: false }, // masquée par défaut (lib/prisma.js)
      include: {
        taches: { orderBy: { id: "asc" }, include: { pieces: { orderBy: { id: "asc" }, select: { id: true, nom: true, prixEstime: true, qte: true } } } },
        depots: { select: { montant: true } },
      },
    }),
    lireParametres(["taux_horaire_client", "tps_taux", "tvq_taux"]),
    paiementEnLigneActif(),
    lirePourcentDepot(),
  ]);

  if (!soumission) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "var(--bg)" }}>
        <div style={{ maxWidth: 420, textAlign: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: 24 }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>🔒</div>
          <h1 style={{ fontSize: 20, margin: "0 0 10px" }}>{entreprise.nomEntreprise}</h1>
          <p style={{ fontSize: 14, margin: 0, color: "var(--text-muted)" }}>
            Ce lien n&apos;est plus valide. Communiquez avec nous pour recevoir votre soumission{entreprise.telephone ? ` (${entreprise.telephone})` : ""}.
          </p>
        </div>
      </div>
    );
  }

  // État montré au client : il peut répondre, il a déjà répondu, ou la
  // soumission a suivi son cours (travaux en cours, facturée)
  const etat = peutRepondre(soumission) ? "A_REPONDRE" : soumission.reponseClient || "TRAITEE";
  // Dépôt en ligne après l'approbation (lib/paiementEnLigne.js)
  const depotEnLigne = paiementActif && pourcentDepot
    ? { depot: await depotSoumission(soumission, pourcentDepot), pourcent: pourcentDepot, retour: typeof paiement === "string" ? paiement : null, modeTest: modeTestStripe() }
    : null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "20px 16px 40px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 14, marginBottom: 16, borderBottom: "2px solid var(--text)" }}>
          <LogoClient alt={entreprise.nomEntreprise} width={84} height={56} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{entreprise.nomEntreprise}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.45 }}>
              {lignesEnteteEntreprise(entreprise).map((l) => <div key={l}>{l}</div>)}
            </div>
          </div>
        </header>

        <ApprobationClient
          jeton={jeton}
          etat={etat}
          soumission={{
            numero: soumission.numero,
            clientNom: soumission.clientNom,
            vehiculeInfo: soumission.vehiculeInfo,
            creeLe: soumission.creeLe,
            reponseLe: soumission.reponseLe,
            signataireNom: soumission.signataireNom,
            signatureClient: soumission.signatureClient,
            noteClient: soumission.noteClient,
            totalDepots: soumission.depots.reduce((s, d) => s + d.montant, 0),
            taches: soumission.taches.map((t) => ({ id: t.id, description: t.description, tempsEstime: t.tempsEstime, refusee: t.refusee, pieces: t.pieces })),
          }}
          taux={{
            tauxHoraire: Number(dict.taux_horaire_client || 195),
            tpsTaux: Number(dict.tps_taux || 5),
            tvqTaux: Number(dict.tvq_taux || 9.975),
          }}
          conditions={entreprise.conditionsGenerales}
          telephone={entreprise.telephone}
          depotEnLigne={depotEnLigne}
        />
      </div>
    </div>
  );
}
