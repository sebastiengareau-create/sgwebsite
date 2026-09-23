import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { obtenirInfosEntreprise } from "@/lib/config";
import BoutonsExportListe from "../BoutonsExportListe";

export default async function RapportFournisseurs() {
  const session = await obtenirSession();
  const { nomEntreprise, adresseLigne1, adresseLigne2 } = await obtenirInfosEntreprise();
  if (!(await aAccesSection(session, "comptabilite")) && !(await aAccesSection(session, "fournisseurs"))) {
    redirect("/gerant");
  }

  const fournisseurs = await prisma.fournisseur.findMany({ orderBy: { nom: "asc" } });

  return (
    <div>
      <style>{`
        @media print { .cacher-impression { display: none !important; } body { background: white !important; } }
        body { background: #f2f0ea; margin: 0; }
      `}</style>
      <div className="cacher-impression" style={{ padding: 16, textAlign: "center" }}>
        <BoutonsExportListe hrefPdf="/api/fournisseurs/rapport/pdf" hrefCsv="/api/fournisseurs/rapport/csv" />
      </div>
      <div style={{ maxWidth: 760, margin: "0 auto 40px", background: "white", color: "#17150f", padding: "36px 40px", fontFamily: "Arial, sans-serif" }}>
        <div style={{ borderBottom: "2px solid #17150f", paddingBottom: 16, marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>{nomEntreprise}</h1>
          <p style={{ fontSize: 11.5, color: "#666", margin: "3px 0 0" }}>{adresseLigne1}, {adresseLigne2}</p>
          <p style={{ fontSize: 16, fontWeight: 700, marginTop: 12, marginBottom: 0 }}>Liste des fournisseurs</p>
          <p style={{ fontSize: 11.5, color: "#666", margin: "2px 0 0" }}>
            Au {new Date().toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })} — {fournisseurs.length} fournisseur{fournisseurs.length !== 1 ? "s" : ""}
          </p>
        </div>

        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #17150f" }}>
              <th style={{ textAlign: "left", padding: "6px 4px", fontSize: 10.5, textTransform: "uppercase", color: "#888" }}>No fournisseur</th>
              <th style={{ textAlign: "left", padding: "6px 4px", fontSize: 10.5, textTransform: "uppercase", color: "#888" }}>Nom</th>
              <th style={{ textAlign: "left", padding: "6px 4px", fontSize: 10.5, textTransform: "uppercase", color: "#888" }}>Adresse</th>
              <th style={{ textAlign: "left", padding: "6px 4px", fontSize: 10.5, textTransform: "uppercase", color: "#888" }}>Téléphone</th>
              <th style={{ textAlign: "left", padding: "6px 4px", fontSize: 10.5, textTransform: "uppercase", color: "#888" }}>Courriel</th>
              <th style={{ textAlign: "left", padding: "6px 4px", fontSize: 10.5, textTransform: "uppercase", color: "#888" }}>Statut</th>
            </tr>
          </thead>
          <tbody>
            {fournisseurs.map((f) => (
              <tr key={f.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "6px 4px", fontFamily: "monospace" }}>{f.numero || "—"}</td>
                <td style={{ padding: "6px 4px" }}>{f.nom}</td>
                <td style={{ padding: "6px 4px" }}>{[f.adresse, f.ville, f.codePostal].filter(Boolean).join(", ") || "—"}</td>
                <td style={{ padding: "6px 4px" }}>{f.telephone || "—"}</td>
                <td style={{ padding: "6px 4px" }}>{f.courriel || "—"}</td>
                <td style={{ padding: "6px 4px", color: f.actif ? "#17150f" : "#a83232" }}>{f.actif ? "Actif" : "Inactif"}</td>
              </tr>
            ))}
            {fournisseurs.length === 0 && (
              <tr><td colSpan={6} style={{ padding: "10px 4px", color: "#999", fontStyle: "italic" }}>Aucun fournisseur</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
