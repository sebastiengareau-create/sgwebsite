import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { obtenirInfosEntreprise } from "@/lib/config";
import { construireRapportParFournisseur } from "@/lib/rapportInventaire";
import ChoixFournisseurRapport from "./ChoixFournisseurRapport";

const fmt = (n) => `${n.toFixed(2)} $`;
const th = (align = "left") => ({ textAlign: align, padding: "6px 4px", fontSize: 10, textTransform: "uppercase", color: "#888" });
const td = (align = "left") => ({ textAlign: align, padding: "5px 4px" });

export default async function RapportInventaireFournisseurs(props) {
  const searchParams = await props.searchParams;
  const session = await obtenirSession();
  // Comme le rapport d'inventaire : Comptabilité ou Inventaire
  if (!(await aAccesSection(session, "comptabilite")) && !(await aAccesSection(session, "inventaire"))) {
    redirect("/gerant");
  }

  const fournisseurId = typeof searchParams?.fournisseur === "string" && searchParams.fournisseur ? searchParams.fournisseur : null;
  const [{ nomEntreprise, adresseLigne1, adresseLigne2 }, fournisseurs, rapport] = await Promise.all([
    obtenirInfosEntreprise(),
    prisma.fournisseur.findMany({ orderBy: [{ actif: "desc" }, { nom: "asc" }], select: { id: true, nom: true, actif: true } }),
    construireRapportParFournisseur(prisma, fournisseurId),
  ]);
  const titreFournisseur = fournisseurId ? rapport.groupes[0]?.fournisseur?.nom : null;

  return (
    <div>
      <style>{`
        @media print { .cacher-impression { display: none !important; } body { background: white !important; } .groupe { break-inside: avoid-page; } }
        body { background: #f2f0ea; margin: 0; }
      `}</style>
      <div className="cacher-impression" style={{ padding: 16, textAlign: "center" }}>
        <ChoixFournisseurRapport fournisseurs={fournisseurs} fournisseurId={fournisseurId || ""} />
      </div>
      <div style={{ maxWidth: 820, margin: "0 auto 40px", background: "white", color: "#17150f", padding: "36px 40px", fontFamily: "Arial, sans-serif" }}>
        <div style={{ borderBottom: "2px solid #17150f", paddingBottom: 16, marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>{nomEntreprise}</h1>
          <p style={{ fontSize: 11.5, color: "#666", margin: "3px 0 0" }}>{[adresseLigne1, adresseLigne2].filter(Boolean).join(", ")}</p>
          <p style={{ fontSize: 16, fontWeight: 700, marginTop: 12, marginBottom: 0 }}>
            Inventaire par fournisseur{titreFournisseur ? ` — ${titreFournisseur}` : ""}
          </p>
          <p style={{ fontSize: 11.5, color: "#666", margin: "2px 0 0" }}>
            Au {new Date().toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })} — {rapport.totalPieces} pièce{rapport.totalPieces !== 1 ? "s" : ""}
          </p>
        </div>

        {rapport.groupes.map((g) => (
          <div key={g.fournisseur?.id || "aucun"} className="groupe" style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "1px solid #17150f", paddingBottom: 4, marginBottom: 2 }}>
              <strong style={{ fontSize: 14 }}>{g.fournisseur ? g.fournisseur.nom : "Sans fournisseur"}{g.fournisseur && !g.fournisseur.actif ? " (inactif)" : ""}</strong>
              <span style={{ fontSize: 11, color: "#666" }}>{g.lignes.length} pièce{g.lignes.length !== 1 ? "s" : ""}</span>
            </div>
            <table style={{ width: "100%", fontSize: 11.5, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #ccc" }}>
                  <th style={th()}>Notre no</th>
                  <th style={th()}>No fournisseur</th>
                  <th style={th()}>Description</th>
                  <th style={th("right")}>Qté</th>
                  <th style={th("right")}>Min</th>
                  <th style={th("right")}>Dernier prix</th>
                  <th style={th("right")}>Coût moyen</th>
                  <th style={th("right")}>Valeur</th>
                </tr>
              </thead>
              <tbody>
                {g.lignes.map((l) => (
                  <tr key={l.pieceId} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ ...td(), fontFamily: "monospace" }}>{l.numero}</td>
                    <td style={{ ...td(), fontFamily: "monospace", fontWeight: 700 }}>{l.numeroFournisseur || (g.fournisseur ? "—" : "")}</td>
                    <td style={td()}>{l.nom}{l.habituel && <span title="Fournisseur habituel" style={{ color: "#c58a1d" }}> ★</span>}</td>
                    <td style={{ ...td("right"), color: l.qte <= l.qteMin ? "#a83232" : "#17150f", fontWeight: l.qte <= l.qteMin ? 700 : 400 }}>{l.qte}</td>
                    <td style={{ ...td("right"), color: "#888" }}>{l.qteMin}</td>
                    <td style={td("right")}>{l.dernierPrix != null ? fmt(l.dernierPrix) : "—"}</td>
                    <td style={td("right")}>{fmt(l.coutant)}</td>
                    <td style={td("right")}>{fmt(l.valeur)}</td>
                  </tr>
                ))}
                {g.lignes.length === 0 && (
                  <tr><td colSpan={8} style={{ ...td(), color: "#999", fontStyle: "italic" }}>Aucune pièce liée à ce fournisseur</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ ...td(), fontWeight: 700 }}>Sous-total</td>
                  <td style={{ ...td("right"), fontWeight: 700 }}>{g.totalQte}</td>
                  <td colSpan={3} />
                  <td style={{ ...td("right"), fontWeight: 700 }}>{fmt(g.totalValeur)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ))}
        {rapport.groupes.length === 0 && <p style={{ color: "#999", fontStyle: "italic" }}>Aucune pièce en inventaire.</p>}

        <div style={{ borderTop: "2px solid #17150f", paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
          <span>Total {fournisseurId ? "" : "de l'inventaire "}({rapport.totalPieces} pièce{rapport.totalPieces !== 1 ? "s" : ""}, {rapport.totalQte} unités)</span>
          <span>{fmt(rapport.totalValeur)}</span>
        </div>
        <p style={{ fontSize: 10.5, color: "#888", marginTop: 10 }}>
          ★ fournisseur habituel · Qté en rouge : au seuil minimum ou sous · Valeur = qté × coût moyen.
          {!fournisseurId && " Une pièce vendue par plusieurs fournisseurs paraît sous chacun ; le total, lui, la compte une seule fois."}
        </p>
      </div>
    </div>
  );
}
