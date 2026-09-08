import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { obtenirInfosEntreprise } from "@/lib/config";
import BoutonsExportInventaire from "./BoutonsExportInventaire";

export default async function RapportInventaire() {
  const session = await obtenirSession();
  const { nomEntreprise, adresseLigne1, adresseLigne2 } = await obtenirInfosEntreprise();
  if (!(await aAccesSection(session, "comptabilite"))) redirect("/gerant");

  const pieces = await prisma.piece.findMany({ orderBy: { nom: "asc" } });

  const totalQte = pieces.reduce((s, p) => s + p.qte, 0);
  const totalValeurCoutant = pieces.reduce((s, p) => s + p.qte * p.coutant, 0);
  const totalValeurVendant = pieces.reduce((s, p) => s + p.qte * p.prix, 0);
  const totalMarge = pieces.reduce((s, p) => s + p.qte * (p.prix - p.coutant), 0);

  return (
    <div>
      <style>{`
        @media print { .cacher-impression { display: none !important; } body { background: white !important; } }
        body { background: #f2f0ea; margin: 0; }
      `}</style>
      <div className="cacher-impression" style={{ padding: 16, textAlign: "center" }}>
        <BoutonsExportInventaire />
      </div>
      <div style={{ maxWidth: 760, margin: "0 auto 40px", background: "white", color: "#17150f", padding: "36px 40px", fontFamily: "Arial, sans-serif" }}>
        <div style={{ borderBottom: "2px solid #17150f", paddingBottom: 16, marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>{nomEntreprise}</h1>
          <p style={{ fontSize: 11.5, color: "#666", margin: "3px 0 0" }}>{adresseLigne1}, {adresseLigne2}</p>
          <p style={{ fontSize: 16, fontWeight: 700, marginTop: 12, marginBottom: 0 }}>Rapport d'inventaire</p>
          <p style={{ fontSize: 11.5, color: "#666", margin: "2px 0 0" }}>
            Au {new Date().toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })} — {pieces.length} pièce{pieces.length !== 1 ? "s" : ""}
          </p>
        </div>

        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #17150f" }}>
              <th style={{ textAlign: "left", padding: "6px 4px", fontSize: 10.5, textTransform: "uppercase", color: "#888" }}>No pièce</th>
              <th style={{ textAlign: "left", padding: "6px 4px", fontSize: 10.5, textTransform: "uppercase", color: "#888" }}>Description</th>
              <th style={{ textAlign: "right", padding: "6px 4px", fontSize: 10.5, textTransform: "uppercase", color: "#888" }}>Qté</th>
              <th style={{ textAlign: "right", padding: "6px 4px", fontSize: 10.5, textTransform: "uppercase", color: "#888" }}>Coûtant</th>
              <th style={{ textAlign: "right", padding: "6px 4px", fontSize: 10.5, textTransform: "uppercase", color: "#888" }}>Vendant</th>
              <th style={{ textAlign: "right", padding: "6px 4px", fontSize: 10.5, textTransform: "uppercase", color: "#888" }}>Marge</th>
            </tr>
          </thead>
          <tbody>
            {pieces.map((p) => {
              const marge = p.prix - p.coutant;
              return (
                <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "6px 4px", fontFamily: "monospace" }}>{p.numero}</td>
                  <td style={{ padding: "6px 4px" }}>{p.nom}</td>
                  <td style={{ padding: "6px 4px", textAlign: "right" }}>{p.qte}</td>
                  <td style={{ padding: "6px 4px", textAlign: "right" }}>{p.coutant.toFixed(2)} $</td>
                  <td style={{ padding: "6px 4px", textAlign: "right" }}>{p.prix.toFixed(2)} $</td>
                  <td style={{ padding: "6px 4px", textAlign: "right", color: marge < 0 ? "#a83232" : "#17150f" }}>{marge.toFixed(2)} $</td>
                </tr>
              );
            })}
            {pieces.length === 0 && (
              <tr><td colSpan={6} style={{ padding: "10px 4px", color: "#999", fontStyle: "italic" }}>Aucune pièce en inventaire</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid #17150f" }}>
              <td style={{ padding: "8px 4px", fontWeight: 700 }} colSpan={2}>Total</td>
              <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 700 }}>{totalQte}</td>
              <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 700 }}>{totalValeurCoutant.toFixed(2)} $</td>
              <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 700 }}>{totalValeurVendant.toFixed(2)} $</td>
              <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 700 }}>{totalMarge.toFixed(2)} $</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
