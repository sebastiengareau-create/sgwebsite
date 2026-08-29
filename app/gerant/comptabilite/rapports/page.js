import { redirect } from "next/navigation";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EnTete from "../../../components/EnTete";
import Link from "next/link";

export default async function RapportsComptables() {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) redirect("/gerant");

  const moduleComptabilite = await prisma.parametre.findUnique({ where: { cle: "module_comptabilite" } });
  if (moduleComptabilite?.valeur === "inactif") redirect("/gerant");

  const rapports = [
    { href: "/gerant/comptabilite/rapports/etat-resultats", icone: "📊", titre: "État des résultats", description: "Revenus, dépenses et profit net" },
    { href: "/gerant/comptabilite/rapports/bilan", icone: "⚖️", titre: "Bilan", description: "Actif, passif et capitaux propres" },
    { href: "/gerant/comptabilite/rapports/balance-verification", icone: "🧮", titre: "Balance de vérification", description: "Tous les comptes, débits et crédits" },
    { href: "/gerant/comptabilite/rapports/tps-tvq", icone: "🧾", titre: "Remise TPS/TVQ", description: "Net à remettre pour une période" },
    { href: "/gerant/comptabilite/rapports/das", icone: "🏛️", titre: "DAS à remettre", description: "ARC et Revenu Québec — impôts, RRQ, RQAP, AE" },
    { href: "/gerant/comptabilite/rapports/comptes-clients", icone: "📋", titre: "Comptes clients (âgé)", description: "Qui te doit de l'argent, par ancienneté" },
    { href: "/gerant/comptabilite/rapports/comptes-fournisseurs", icone: "📋", titre: "Comptes fournisseurs (âgé)", description: "Qui payer en priorité, par ancienneté" },
  ];

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <div className="conteneur-page">
        <Link href="/gerant/comptabilite" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour au plan comptable</Link>
        <h1 style={{ fontSize: 20, marginTop: 8, marginBottom: 4 }}>📄 Rapports</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>
          Versions imprimables — format propre pour un comptable, une banque, ou tes propres dossiers.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rapports.map((r) => (
            <Link key={r.href} href={r.href} target="_blank" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="bouton-3d-sombre" style={{ borderRadius: 14, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 24 }}>{r.icone}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{r.titre}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{r.description}</div>
                </div>
                <span style={{ color: "var(--text-muted)", fontSize: 16 }}>›</span>
              </div>
            </Link>
          ))}
        </div>

        <div style={{ marginTop: 20, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>⬇️ Export pour un comptable externe</div>
          <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 10 }}>
            Le journal général complet en fichier .csv (s'ouvre dans Excel) — toutes les écritures, avec les comptes,
            débits, crédits, et qui les a créées.
          </p>
          <a
            href="/api/comptabilite/export"
            className="bouton-3d"
            style={{ display: "block", textAlign: "center", padding: 10, borderRadius: 10, textDecoration: "none", fontSize: 12, fontWeight: 700 }}
          >
            Télécharger le journal complet (.csv)
          </a>
        </div>
      </div>
    </div>
  );
}
