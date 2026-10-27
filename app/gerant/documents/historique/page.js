import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenirSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { destinatairesPermis } from "@/lib/documentsServeur";
import EnTete from "../../../components/EnTete";

const NB_ENVOIS = 100;

// Historique des courriels envoyés depuis Documents — seulement les envois
// aux destinataires que la personne peut gérer (employés et/ou clients)
export default async function HistoriqueCourriels() {
  const session = await obtenirSession();
  if (!session) redirect("/login");
  const permis = await destinatairesPermis(session);
  if (permis.length === 0) redirect("/gerant");

  const envois = await prisma.envoiCourrielDocument.findMany({
    where: { destinataire: { in: permis } },
    orderBy: { creeLe: "desc" },
    take: NB_ENVOIS,
  });
  const dateHeure = (d) => d.toLocaleString("fr-CA", { timeZone: "America/Toronto", dateStyle: "medium", timeStyle: "short" });

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <div className="conteneur-page">
        <Link href="/gerant/documents" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour aux documents</Link>
        <h1 style={{ fontSize: 20, margin: "10px 0 4px" }}>🕘 Historique des courriels</h1>
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: "0 0 16px" }}>
          Les {NB_ENVOIS} derniers envois de la section Documents. Touche un envoi pour voir ses destinataires et son texte.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {envois.map((e) => (
            <details key={e.id} className="carte carte-m">
              <summary style={{ cursor: "pointer", listStyle: "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                  <div style={{ fontWeight: 600, minWidth: 0 }}>{e.groupe ? "📢 " : "✉️ "}{e.sujet}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{dateHeure(e.creeLe)}</div>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  {e.modeleNom} · par {e.envoyePar || "—"} ·{" "}
                  {e.groupe ? `${e.nbEnvoyes} envoyé${e.nbEnvoyes > 1 ? "s" : ""}` : (e.destinataires[0]?.nom || "")}
                  {e.nbEchecs > 0 && <span style={{ color: "var(--danger)", fontWeight: 600 }}> · {e.nbEchecs} échec{e.nbEchecs > 1 ? "s" : ""}</span>}
                </div>
              </summary>
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>Destinataires</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 260, overflowY: "auto" }}>
                  {e.destinataires.map((d, i) => (
                    <div key={i} style={{ fontSize: 12.5 }}>
                      {d.erreur ? "❌" : "✅"} {d.nom} <span style={{ color: "var(--text-muted)" }}>· {d.a}</span>
                      {d.erreur && <div style={{ fontSize: 11.5, color: "var(--danger)", marginLeft: 20 }}>{d.erreur}</div>}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)", margin: "12px 0 6px" }}>
                  {e.groupe ? "Texte envoyé (rempli pour chaque client)" : "Texte envoyé"}
                </div>
                <div style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.5, background: "var(--bg)", borderRadius: 8, padding: 12 }}>{e.texte}</div>
              </div>
            </details>
          ))}
          {envois.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucun courriel envoyé encore.</p>}
        </div>
      </div>
    </div>
  );
}
