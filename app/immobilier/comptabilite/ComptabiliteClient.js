"use client";

import Link from "next/link";
import BandeauImmo from "@/app/immobilier/BandeauImmo";
import LienComptabilite from "../../components/LienComptabilite";
import { NavImmo, lien, RetourArriere } from "../ui";

// Immobilier → Comptabilité (lib/immobilierCompta.js), sur l'écran commun
export default function ComptabiliteClient(props) {
  return (
    <LienComptabilite
      {...props}
      api="/api/immobilier/comptabilite"
      titre="Immobilier relié à la comptabilité"
      module="l'Immobilier"
      encaissements="Paiements des locataires déposés dans"
      postes="Immeubles — …"
      entete={<>
        <RetourArriere href="/immobilier/depenses" />
        <BandeauImmo icone="📚" titre="Lien avec la comptabilité" sousTitre="Loyers, paiements, dépenses et réparations aux livres, aux fournisseurs et aux comptes à payer." />
        <NavImmo actif="/immobilier/depenses" />
      </>}
      points={<>
        <li><strong>Loyers et frais</strong> inscrits aux baux : au compte « Loyers à recevoir » et aux revenus de location.</li>
        <li><strong>Paiements des locataires</strong> : au compte de banque choisi ci-dessous, prêts pour la conciliation bancaire.</li>
        <li><strong>Dépenses des immeubles</strong> : facture du fournisseur aux <Link href="/gerant/comptabilite/comptes-a-payer" style={lien}>comptes à payer</Link>, à payer là comme les autres — ou « déjà payée » à la saisie.</li>
        <li><strong>Réparations terminées</strong> avec un coût réel : facture de l'entrepreneur aux comptes à payer.</li>
        <li><strong>Travaux majeurs</strong> (dépense d'immobilisation) : au compte d'actif « Immeubles — améliorations », pas en dépense.</li>
      </>}
      notes={[
        "Le fournisseur se choisit dans la dépense ou la réparation ; sinon, celui du même nom que « Payé à » ou « Entrepreneur » est repris (ou créé). Taxes : le loyer résidentiel est exonéré, donc la TPS et la TVQ payées sur les dépenses d'un immeuble restent dans la dépense (pas de crédit de taxe).",
        "L'Immobilier reste la source : une correction ou un retrait dans l'Immobilier suit aux livres. Une facture de l'Immobilier se paie aux comptes à payer, mais se modifie ici.",
      ]}
    />
  );
}
