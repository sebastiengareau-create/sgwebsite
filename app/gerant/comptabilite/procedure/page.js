import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import EnTete from "../../../components/EnTete";

const ETAPES = [
  {
    numero: 1,
    titre: "Écritures supplémentaires",
    obligatoire: false,
    description: "Ajoute toute écriture manquante pour que tes livres reflètent exactement ce qui apparaît sur ton relevé de banque — frais bancaires, intérêts, corrections, dépenses oubliées, etc.",
    lien: { href: "/gerant/comptabilite/ecriture-manuelle", label: "✍️ Écriture supplémentaire" },
  },
  {
    numero: 2,
    titre: "Rapprochement bancaire",
    obligatoire: false,
    description: "Coche chaque écriture du compte Banque qui apparaît sur ton relevé, puis entre le solde du relevé. Ça révèle ce qui est vraiment passé en banque par rapport à ce qui reste « en circulation » (chèque ou dépôt pas encore traité par la banque).",
    lien: { href: "/gerant/comptabilite/rapprochement", label: "🏦 Rapprochement bancaire" },
  },
  {
    numero: 3,
    titre: "Amortissement du mois",
    obligatoire: true,
    obligatoireSi: "seulement si tu as des immobilisations actives",
    description: "Si tu as de l'équipement immobilisé, comptabilise l'amortissement du mois. Le logiciel bloque la fermeture du mois tant que ce n'est pas fait, dès qu'une immobilisation active existe.",
    lien: { href: "/gerant/comptabilite/immobilisations", label: "🏗️ Immobilisations" },
  },
  {
    numero: 4,
    titre: "Paie complétée",
    obligatoire: true,
    description: "Assure-toi qu'aucun lot de paie du mois n'est encore en brouillon. Le logiciel bloque la fermeture du mois tant qu'il reste un brouillon.",
    lien: { href: "/gerant/paie", label: "🧾 Paie" },
  },
  {
    numero: 5,
    titre: "Remises gouvernementales",
    obligatoire: false,
    description: "Comptabilise le paiement de la TPS/TVQ et des DAS (impôts, RRQ, RQAP, AE) dus pour le mois. Pas vérifié par le logiciel pour fermer, mais garde tes comptes à jour et évite les surprises au mois suivant.",
    lien: { href: "/gerant/comptabilite/remise-gouvernementale", label: "🏛️ Remise gouvernementale" },
  },
  {
    numero: 6,
    titre: "Vérifier et fermer le mois",
    obligatoire: false,
    description: "Ouvre l'assistant de fermeture du mois concerné : il affiche la checklist (obligatoires + informatifs) et un résumé (revenus, dépenses, bénéfice net, TPS/TVQ à remettre, comptes clients/fournisseurs, solde bancaire). Une fois la checklist à 100 %, verrouille (optionnel, réversible) ou ferme le mois.",
    lien: { href: "/gerant/comptabilite/fermeture", label: "🔒 Fermeture de période" },
  },
];

export default async function ProcedureFermeture() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) redirect("/gerant");

  const moduleComptabilite = await prisma.parametre.findUnique({ where: { cle: "module_comptabilite" } });
  if (moduleComptabilite?.valeur === "inactif") redirect("/gerant");

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <div className="conteneur-page">
        <Link href="/gerant/comptabilite" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour au plan comptable</Link>
        <h1 style={{ fontSize: 20, marginTop: 8, marginBottom: 4 }}>📋 Procédure de fermeture de mois</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 6 }}>
          L'ordre recommandé pour fermer un mois comptable proprement avec ce logiciel. Les étapes marquées{" "}
          <span style={{ color: "var(--danger)", fontWeight: 700 }}>obligatoire</span> sont vérifiées automatiquement —
          le logiciel refuse de fermer le mois tant qu'elles ne sont pas faites. Les autres sont fortement
          recommandées, mais le logiciel ne les impose pas.
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 20, fontStyle: "italic" }}>
          Rien n'empêche de faire les étapes dans un autre ordre — celui-ci évite simplement les allers-retours (ex :
          rapprocher la banque avant d'avoir ajouté les écritures manquantes veut souvent dire recommencer).
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {ETAPES.map((e) => (
            <div key={e.numero} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: "50%", flexShrink: 0, marginTop: 2,
                  background: "linear-gradient(180deg, var(--accent-clair), var(--accent))",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: "#17150f",
                }}>
                  {e.numero}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{e.titre}</span>
                    {e.obligatoire && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: "var(--danger)", border: "1px solid var(--danger)", borderRadius: 999, padding: "2px 8px" }}>
                        OBLIGATOIRE{e.obligatoireSi ? ` — ${e.obligatoireSi}` : ""}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 10px" }}>{e.description}</p>
                  <Link
                    href={e.lien.href}
                    className="bouton-3d-sombre"
                    style={{ display: "inline-block", padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: "none" }}
                  >
                    {e.lien.label} →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Après la fermeture</div>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0 }}>
            « 🟡 Verrouiller » empêche de modifier les écritures existantes du mois, mais accepte encore de nouvelles
            écritures datées dans ce mois — utile pour un premier arrêt pendant que tu termines le reste. « 🔴 Fermer »
            bloque tout, définitivement, sauf réouverture. Une réouverture reste possible en tout temps (gérant
            seulement), avec un motif obligatoire, consigné dans l'historique — voir « Fermeture de période → Historique ».
          </p>
        </div>
      </div>
    </div>
  );
}
