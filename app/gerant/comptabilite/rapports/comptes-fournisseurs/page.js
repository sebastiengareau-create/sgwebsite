import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { obtenirInfosEntreprise } from "@/lib/config";
import BoutonImprimerRapport from "../BoutonImprimerRapport";

const TRANCHES = [
  { cle: "0-30", label: "0-30 jours", max: 30 },
  { cle: "31-60", label: "31-60 jours", max: 60 },
  { cle: "61-90", label: "61-90 jours", max: 90 },
  { cle: "90+", label: "90+ jours", max: Infinity },
];

function trancheDe(jours) {
  for (const t of TRANCHES) if (jours <= t.max) return t.cle;
  return "90+";
}

export default async function RapportComptesFournisseurs() {
  const session = await obtenirSession();
  const { nomEntreprise, adresseLigne1, adresseLigne2 } = await obtenirInfosEntreprise();
  if (!(await aAccesSection(session, "fournisseurs"))) redirect("/gerant");

  const depenses = await prisma.depense.findMany({
    where: { statut: "IMPAYEE" },
    include: { fournisseur: true },
    orderBy: { dateFacture: "asc" },
  });

  const maintenant = new Date();
  const parFournisseur = {};
  for (const d of depenses) {
    const jours = Math.floor((maintenant - new Date(d.dateFacture)) / 86400000);
    const tranche = trancheDe(jours);
    const nomFournisseur = d.fournisseur.nom;
    if (!parFournisseur[nomFournisseur]) parFournisseur[nomFournisseur] = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0, total: 0 };
    parFournisseur[nomFournisseur][tranche] += d.montant;
    parFournisseur[nomFournisseur].total += d.montant;
  }

  const lignesFournisseurs = Object.entries(parFournisseur).sort((a, b) => b[1].total - a[1].total);
  const totauxTranches = TRANCHES.reduce((acc, t) => ({ ...acc, [t.cle]: lignesFournisseurs.reduce((s, [, d]) => s + d[t.cle], 0) }), {});
  const grandTotal = lignesFournisseurs.reduce((s, [, d]) => s + d.total, 0);

  return (
    <div>
      <style>{`
        @media print { .cacher-impression { display: none !important; } body { background: white !important; } }
        body { background: #f2f0ea; margin: 0; }
      `}</style>
      <div className="cacher-impression" style={{ padding: 16, textAlign: "center" }}>
        <BoutonImprimerRapport />
      </div>
      <div style={{ maxWidth: 760, margin: "0 auto 40px", background: "white", color: "#17150f", padding: "36px 40px", fontFamily: "Arial, sans-serif" }}>
        <div style={{ borderBottom: "2px solid #17150f", paddingBottom: 16, marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>{nomEntreprise}</h1>
          <p style={{ fontSize: 11.5, color: "#666", margin: "3px 0 0" }}>{adresseLigne1}, {adresseLigne2}</p>
          <p style={{ fontSize: 16, fontWeight: 700, marginTop: 12, marginBottom: 0 }}>Comptes fournisseurs — rapport âgé</p>
          <p style={{ fontSize: 11.5, color: "#666", margin: "2px 0 0" }}>
            Au {maintenant.toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}
          </p>
        </div>

        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #17150f" }}>
              <th style={{ textAlign: "left", padding: "6px 4px", fontSize: 10.5, textTransform: "uppercase", color: "#888" }}>Fournisseur</th>
              {TRANCHES.map((t) => (
                <th key={t.cle} style={{ textAlign: "right", padding: "6px 4px", fontSize: 10.5, textTransform: "uppercase", color: "#888" }}>{t.label}</th>
              ))}
              <th style={{ textAlign: "right", padding: "6px 4px", fontSize: 10.5, textTransform: "uppercase", color: "#888" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {lignesFournisseurs.map(([nomFournisseur, d]) => (
              <tr key={nomFournisseur} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "6px 4px" }}>{nomFournisseur}</td>
                {TRANCHES.map((t) => (
                  <td key={t.cle} style={{ padding: "6px 4px", textAlign: "right", color: d[t.cle] > 0 && t.cle === "90+" ? "#a83232" : "#17150f" }}>
                    {d[t.cle] > 0 ? d[t.cle].toFixed(2) + " $" : ""}
                  </td>
                ))}
                <td style={{ padding: "6px 4px", textAlign: "right", fontWeight: 700 }}>{d.total.toFixed(2)} $</td>
              </tr>
            ))}
            {lignesFournisseurs.length === 0 && (
              <tr><td colSpan={6} style={{ padding: "10px 4px", color: "#999", fontStyle: "italic" }}>Aucun compte fournisseur impayé</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid #17150f" }}>
              <td style={{ padding: "8px 4px", fontWeight: 700 }}>Total</td>
              {TRANCHES.map((t) => (
                <td key={t.cle} style={{ padding: "8px 4px", textAlign: "right", fontWeight: 700 }}>{totauxTranches[t.cle].toFixed(2)} $</td>
              ))}
              <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 700 }}>{grandTotal.toFixed(2)} $</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
