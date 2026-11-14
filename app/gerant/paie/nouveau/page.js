import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection, ROLES_VALIDES } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EnTete from "../../../components/EnTete";
import NouveauLotClient from "./NouveauLotClient";
import Link from "next/link";
import { quartsActif } from "@/lib/quarts";

export default async function NouveauLotPaie() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "paie"))) redirect("/gerant");

  const modulePaie = await prisma.parametre.findUnique({ where: { cle: "module_paie" } });
  if (modulePaie?.valeur !== "actif") redirect("/gerant");

  const employes = await prisma.user.findMany({
    where: { actif: true, role: { in: ROLES_VALIDES } },
    orderBy: { nom: "asc" },
  });

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      {/* Module Pointage de quart : les heures de la paie viennent des feuilles de temps */}
      {(await quartsActif()) && (
        <div className="conteneur-page" style={{ paddingBottom: 0 }}>
          <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px", fontSize: 13, background: "var(--surface)" }}>
            🕒 Les heures des employés qui pointent viennent de leurs quarts (présence réelle, dîner et arrondi compris).{" "}
            <Link href="/gerant/feuilles-temps" style={{ fontWeight: 700, color: "var(--accent-ombre)" }}>Approuve et verrouille la feuille de temps</Link> de la période avant de calculer la paie : un départ non pointé compte pour zéro tant qu'il n'est pas corrigé.
          </div>
        </div>
      )}
      <NouveauLotClient employes={employes} />
    </div>
  );
}
