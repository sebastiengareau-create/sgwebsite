import { obtenirInfosEntreprise, lignesEnteteEntreprise } from "@/lib/config";
import { libelleVehicule } from "@/lib/vehicules";
import { soldeFacture } from "@/lib/paiementsFactures";
import { factureParJeton, paiementEnLigneActif, modeTestStripe } from "@/lib/paiementEnLigne";
import LogoClient from "../../components/LogoClient";
import PaiementClient from "./PaiementClient";

// Page publique de paiement d'une facture : le solde, le PDF, et « Payer par
// carte » vers la page de paiement de Stripe (lib/paiementEnLigne.js).
// Protégée par le lien secret de la facture ; jamais indexée.
export const metadata = { title: "Paiement de facture", robots: { index: false, follow: false } };

export default async function PagePaiement(props) {
  const { jeton } = await props.params;
  const { paiement } = await props.searchParams;
  const [entreprise, facture, actif] = await Promise.all([obtenirInfosEntreprise(), factureParJeton(jeton), paiementEnLigneActif()]);

  if (!facture || facture.statut === "ANNULEE") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "var(--bg)" }}>
        <div style={{ maxWidth: 420, textAlign: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: 24 }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>🔒</div>
          <h1 style={{ fontSize: 20, margin: "0 0 10px" }}>{entreprise.nomEntreprise}</h1>
          <p style={{ fontSize: 14, margin: 0, color: "var(--text-muted)" }}>
            Ce lien n&apos;est plus valide. Communiquez avec nous{entreprise.telephone ? ` (${entreprise.telephone})` : ""}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "20px 16px 40px" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 14, marginBottom: 16, borderBottom: "2px solid var(--text)" }}>
          <LogoClient alt={entreprise.nomEntreprise} width={84} height={56} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{entreprise.nomEntreprise}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.45 }}>
              {lignesEnteteEntreprise(entreprise).map((l) => <div key={l}>{l}</div>)}
            </div>
          </div>
        </header>
        <PaiementClient
          jeton={jeton}
          retour={typeof paiement === "string" ? paiement : null}
          facture={{
            numero: facture.numero, date: facture.dateEmission, total: facture.totalAvecTaxes, paye: facture.montantPaye || 0,
            solde: soldeFacture(facture), payee: facture.statut === "PAYEE",
            client: (facture.bon.clientNomAffiche || "").trim() || facture.bon.client.nom,
            vehicule: facture.bon.vehicule ? libelleVehicule(facture.bon.vehicule) : "",
          }}
          actif={actif}
          modeTest={actif && modeTestStripe()}
          telephone={entreprise.telephone}
        />
      </div>
    </div>
  );
}
