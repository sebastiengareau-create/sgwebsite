import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { obtenirSession } from "@/lib/auth";
import { accesPaieActif } from "@/lib/accesPaie";
import { RAISONS } from "@/lib/releveEmploiCalculs";
import EnTete from "../../../components/EnTete";
import BandeauSection from "../../../components/BandeauSection";
import { stylePanneau, TitrePanneau, TEINTES, Pastille } from "../../../components/StyleSection";
import NouveauReleve from "./NouveauReleve";

const DATE = new Intl.DateTimeFormat("fr-CA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

// Relevés d'emploi (RE) : un par départ d'employé, préparé à partir de ses
// paies puis téléversé dans RE Web (lib/releveEmploi.js)
export default async function RelevesEmploi() {
  const session = await obtenirSession();
  if (!(await accesPaieActif(session))) redirect("/gerant");

  const [releves, employes] = await Promise.all([
    prisma.releveEmploi.findMany({ include: { employe: { select: { nom: true } } }, orderBy: { creeLe: "desc" } }),
    prisma.user.findMany({ where: { paies: { some: { statut: "VERSEE" } } }, select: { id: true, nom: true, actif: true }, orderBy: [{ actif: "asc" }, { nom: "asc" }] }),
  ]);

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <div className="conteneur-page">
        <Link href="/gerant/paie" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour à la paie</Link>
        <div style={{ marginTop: 8 }}>
          <BandeauSection icone="📄" titre="Relevés d'emploi" sousTitre="Au départ d'un employé : préparé à partir de ses paies, à téléverser dans RE Web" />
        </div>

        <div style={stylePanneau}>
          <TitrePanneau icone="utilisateurPlus" teinte={TEINTES.bleu} titre="Nouveau relevé" sousTitre="À produire dans les 5 jours suivant la fin de la période de paie où la rémunération s'arrête" />
          <NouveauReleve employes={employes} />
        </div>

        <div style={stylePanneau}>
          <TitrePanneau icone="liste" teinte={TEINTES.vert} titre="Relevés produits" />
          {releves.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Aucun relevé pour l&apos;instant.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {releves.map((r) => (
                <Link key={r.id} href={`/gerant/paie/releves-emploi/${r.id}`} style={{ display: "block", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 12, textDecoration: "none", color: "var(--text)" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <b style={{ flex: 1, minWidth: 0 }}>{r.employe.nom}</b>
                    {r.statut === "TRANSMIS"
                      ? <Pastille couleur="var(--success)" fond="var(--success-fond)">Transmis{r.numeroSerie ? ` · ${r.numeroSerie}` : ""}</Pastille>
                      : <Pastille couleur="var(--avertissement)" fond="var(--avertissement-fond)">Brouillon</Pastille>}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                    Dernier jour payé : {DATE.format(r.dernierJourPaye)}{r.raison ? ` · ${r.raison} — ${RAISONS[r.raison] || ""}` : " · raison à choisir"}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
