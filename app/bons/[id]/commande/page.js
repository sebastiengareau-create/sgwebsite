import { notFound, redirect } from "next/navigation";
import { obtenirSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { obtenirInfosEntreprise } from "@/lib/config";
import BoutonImprimer from "../imprimer/BoutonImprimer";

export default async function BonDeCommande({ params }) {
  const session = await obtenirSession();
  const { nomEntreprise } = await obtenirInfosEntreprise();
  if (!session) redirect("/login");

  const bon = await prisma.bonTravail.findUnique({
    where: { id: params.id },
    include: { client: true, problemes: { orderBy: { id: "asc" } } },
  });
  if (!bon) notFound();

  return (
    <div>
      <style>{`
        @media print {
          .cacher-impression { display: none !important; }
          body { background: white !important; }
        }
        body { background: #f2f0ea; margin: 0; }
      `}</style>

      <div className="cacher-impression" style={{ padding: 16, textAlign: "center" }}>
        <BoutonImprimer />
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto 40px", background: "white", color: "#17150f", padding: "36px 40px", fontFamily: "Arial, sans-serif" }}>
        <div style={{ borderBottom: "2px solid #17150f", paddingBottom: 16, marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>BON DE TRAVAIL</h1>
          <p style={{ fontSize: 12, color: "#666", margin: "4px 0 0" }}>Document interne — {nomEntreprise}</p>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", color: "#888", marginBottom: 4 }}>Client</div>
            <div style={{ fontWeight: 600 }}>{bon.client.nom}</div>
            {bon.client.telephone && <div style={{ fontSize: 13 }}>{bon.client.telephone}</div>}
            {bon.client.garantieProlongee && (
              <div style={{ fontSize: 12, marginTop: 6, padding: "4px 8px", background: "#f2f0ea", borderRadius: 4, display: "inline-block" }}>
                🛡️ Garantie prolongée — #{bon.client.garantieProlongee}
              </div>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "monospace" }}>#{bon.numero}</div>
            <div style={{ fontSize: 12, color: "#666" }}>{new Date(bon.creeLe).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}</div>
          </div>
        </div>

        <div style={{ fontSize: 11, textTransform: "uppercase", color: "#888", marginBottom: 8 }}>Tâches à effectuer</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {bon.problemes.map((pr, idx) => (
            <div key={pr.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", paddingBottom: 10, borderBottom: "1px solid #eee" }}>
              <div style={{ width: 18, height: 18, border: "2px solid #17150f", borderRadius: 4, flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 14 }}><strong>{idx + 1}.</strong> {pr.description}</div>
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 10, color: "#999", marginTop: 40, textAlign: "center" }}>
          Document à usage interne — ne pas remettre au client
        </p>
      </div>
    </div>
  );
}
