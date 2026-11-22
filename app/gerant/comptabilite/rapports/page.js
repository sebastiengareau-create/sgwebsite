import { redirect } from "next/navigation";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EnTete from "../../../components/EnTete";
import Link from "next/link";
import BandeauSection from "../../../components/BandeauSection";
import { TEINTES, GroupeLiens, TitrePanneau, stylePanneau } from "../../../components/StyleSection";
import ExportJournal from "./ExportJournal";

export default async function RapportsComptables() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) redirect("/gerant");

  const moduleComptabilite = await prisma.parametre.findUnique({ where: { cle: "module_comptabilite" } });
  if (moduleComptabilite?.valeur === "inactif") redirect("/gerant");

  const groupes = [
    {
      titre: "États financiers", teinte: TEINTES.vert,
      liens: [
        { href: "/gerant/comptabilite/rapports/etat-resultats", target: "_blank", icone: "graphique", label: "État des résultats", detail: "Revenus, dépenses et profit net" },
        { href: "/gerant/comptabilite/rapports/bilan", target: "_blank", icone: "balance", label: "Bilan", detail: "Actif, passif et capitaux propres" },
        { href: "/gerant/comptabilite/rapports/balance-verification", target: "_blank", icone: "liste", label: "Balance de vérification", detail: "Tous les comptes, débits et crédits" },
      ],
    },
    {
      titre: "Remises gouvernementales", teinte: TEINTES.bleu,
      liens: [
        { href: "/gerant/comptabilite/rapports/tps-tvq", target: "_blank", icone: "document", label: "Remise TPS/TVQ", detail: "Net à remettre pour une période" },
        { href: "/gerant/comptabilite/rapports/das", target: "_blank", icone: "banque", label: "DAS à remettre", detail: "ARC et Revenu Québec — impôts, RRQ, RQAP, AE" },
      ],
    },
  ];

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <div className="conteneur-page">
        <Link href="/gerant/comptabilite" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à la comptabilité</Link>
        <div style={{ marginTop: 8 }}>
          <BandeauSection icone="🖨️" titre="Rapports imprimables" sousTitre="Versions propres pour un comptable, une banque ou tes propres dossiers — PDF ou impression." />
        </div>

        {groupes.map((g) => <GroupeLiens key={g.titre} {...g} />)}

        <div style={stylePanneau}>
          <TitrePanneau icone="echange" teinte={TEINTES.ambre} titre="Export pour un comptable externe" sousTitre="Le journal général en .csv (s'ouvre dans Excel), pour la période choisie" />
          <ExportJournal />
        </div>
      </div>
    </div>
  );
}
