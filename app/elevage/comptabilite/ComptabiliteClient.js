"use client";

import Link from "next/link";
import BandeauFerme from "../BandeauFerme";
import LienComptabilite from "../../components/LienComptabilite";
import { NavElevage } from "../ui";

const lien = { color: "var(--accent)" };

// Élevage → Comptabilité (lib/elevageCompta.js), sur l'écran commun
export default function ComptabiliteClient(props) {
  return (
    <LienComptabilite
      {...props}
      api="/api/elevage/comptabilite"
      titre="Élevage relié à la comptabilité"
      module="l'Élevage"
      encaissements="Ventes de viande et ventes sur pied déposées dans"
      postes="Élevage — …"
      entete={<>
        <BandeauFerme icone="📚" titre="Lien avec la comptabilité" sousTitre="Achats, frais et abattages aux fournisseurs et aux comptes à payer ; ventes aux livres." />
        <NavElevage actif="/elevage/comptabilite" />
      </>}
      points={<>
        <li><strong>Achats de bêtes</strong> (origine « achetée », avec un coût) : facture du vendeur (provenance) aux <Link href="/gerant/comptabilite/comptes-a-payer" style={lien}>comptes à payer</Link>, au poste « Élevage — achats d'animaux ».</li>
        <li><strong>Frais des bêtes</strong> — alimentation, vétérinaire, transport, autres : facture du fournisseur inscrit aux frais, au poste de sa catégorie ; payée tout de suite si elle est cochée « déjà payée ».</li>
        <li><strong>Frais d'abattage et de découpe</strong> : facture de l'abattoir aux comptes à payer.</li>
        <li><strong>Ventes de viande</strong> (boutique et en ligne) et <strong>ventes sur pied</strong> : au compte de banque choisi ci-dessous, prêtes pour la conciliation bancaire, aux comptes « Ventes de viande » et « Ventes d'animaux ».</li>
        <li>Un fournisseur sans fiche est créé à son nom ; sans nom, « Divers — élevage ».</li>
      </>}
      notes={[
        "Les montants de l'Élevage sont avant taxes et vont aux livres ainsi : la viande, les animaux et les aliments du bétail sont détaxés.",
        "L'Élevage reste la source : une correction ou un retrait dans l'Élevage suit aux livres. Une facture se paie aux comptes à payer, mais se modifie dans l'Élevage.",
      ]}
    />
  );
}
