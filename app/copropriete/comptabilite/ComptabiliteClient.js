"use client";

import Link from "next/link";
import BandeauCopro from "@/app/copropriete/BandeauCopro";
import LienComptabilite from "../../components/LienComptabilite";
import { NavCopro, Retour } from "../ui";

const lien = { color: "var(--accent)" };

// Copropriété → Comptabilité (lib/coproprieteCompta.js), sur l'écran commun
export default function ComptabiliteClient(props) {
  return (
    <LienComptabilite
      {...props}
      api="/api/copropriete/comptabilite"
      titre="Copropriété reliée à la comptabilité"
      module="la Copropriété"
      encaissements="Paiements des copropriétaires déposés dans"
      postes="Copropriété — …"
      entete={<>
        <div style={{ marginBottom: 10 }}><Retour href="/copropriete/finances">Charges</Retour></div>
        <BandeauCopro icone="📚" titre="Lien avec la comptabilité" sousTitre="Cotisations, paiements et travaux aux livres du syndicat, aux fournisseurs et aux comptes à payer." />
        <NavCopro actif="/copropriete/finances" />
      </>}
      points={<>
        <li><strong>Cotisations aux charges communes</strong> : au compte « Cotisations à recevoir », réparties entre le <strong>fonds d'exploitation</strong>, le <strong>fonds de prévoyance</strong> et le <strong>fonds d'autoassurance</strong> dans la proportion du budget de l'exercice.</li>
        <li><strong>Cotisations spéciales</strong>, frais de stationnement et de rangement, et autres frais : chacun à son compte de revenus.</li>
        <li><strong>Paiements des copropriétaires</strong> : au compte de banque choisi ci-dessous, prêts pour la conciliation bancaire.</li>
        <li><strong>Bons de travail terminés</strong> avec un coût réel : facture du fournisseur aux <Link href="/gerant/comptabilite/comptes-a-payer" style={lien}>comptes à payer</Link> — au poste du fonds de prévoyance si le bon est coché « payé par le fonds de prévoyance ».</li>
        <li><strong>Autres dépenses du syndicat</strong> (assurances, électricité, déneigement, ménage, gestion…) : à entrer aux comptes à payer, aux postes « Copropriété — … ».</li>
      </>}
      notes={[
        "Un syndicat de copropriété résidentiel ne récupère pas la TPS ni la TVQ : elles restent dans le montant des factures. Un bon sans fournisseur va à « Divers — copropriété ».",
        "La Copropriété reste la source : une correction ou un retrait dans la Copropriété suit aux livres. Une facture de travaux se paie aux comptes à payer, mais se modifie dans son bon de travail.",
      ]}
    />
  );
}
