import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assurerPlanComptable } from "@/lib/comptabilite";
import { obtenirInfosEntreprise } from "@/lib/config";
import BoutonImprimerRapport from "../BoutonImprimerRapport";

export default async function EtatResultatsImprimable() {
  const session = await obtenirSession();
  const { nomEntreprise, adresseLigne1, adresseLigne2 } = await obtenirInfosEntreprise();
  if (!(await aAccesSection(session, "comptabilite"))) redirect("/login");
  await assurerPlanComptable();

  const comptes = await prisma.compte.findMany({
    where: { actif: true, type: { in: ["REVENU", "DEPENSE"] } },
    include: { lignes: true },
    orderBy: { numero: "asc" },
  });

  const lignes = comptes.map((c) => {
    const totalDebit = c.lignes.reduce((s, l) => s + l.debit, 0);
    const totalCredit = c.lignes.reduce((s, l) => s + l.credit, 0);
    const solde = c.type === "REVENU" ? totalCredit - totalDebit : totalDebit - totalCredit;
    return { numero: c.numero, nom: c.nom, type: c.type, solde };
  });

  const revenus = lignes.filter((l) => l.type === "REVENU" && l.solde !== 0);
  const depenses = lignes.filter((l) => l.type === "DEPENSE" && l.solde !== 0);
  const totalRevenus = revenus.reduce((s, l) => s + l.solde, 0);
  const totalDepenses = depenses.reduce((s, l) => s + l.solde, 0);
  const profitNet = totalRevenus - totalDepenses;

  return (
    <div>
      <style>{`
        @media print { .cacher-impression { display: none !important; } body { background: white !important; } }
        body { background: #f2f0ea; margin: 0; }
      `}</style>
      <div className="cacher-impression" style={{ padding: 16, textAlign: "center" }}>
        <BoutonImprimerRapport />
      </div>
      <div style={{ maxWidth: 720, margin: "0 auto 40px", background: "white", color: "#17150f", padding: "36px 40px", fontFamily: "Arial, sans-serif" }}>
        <div style={{ borderBottom: "2px solid #17150f", paddingBottom: 16, marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>{nomEntreprise}</h1>
          <p style={{ fontSize: 11.5, color: "#666", margin: "3px 0 0" }}>{adresseLigne1}, {adresseLigne2}</p>
          <p style={{ fontSize: 16, fontWeight: 700, marginTop: 12, marginBottom: 0 }}>État des résultats</p>
          <p style={{ fontSize: 11.5, color: "#666", margin: "2px 0 0" }}>
            Depuis le début — généré le {new Date().toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}
          </p>
        </div>

        <SectionTable titre="Revenus" lignes={revenus} total={totalRevenus} />
        <SectionTable titre="Dépenses" lignes={depenses} total={totalDepenses} />

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, paddingTop: 16, borderTop: "2px solid #17150f" }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>Profit net</span>
          <span style={{ fontSize: 20, fontWeight: 700 }}>{profitNet.toFixed(2)} $</span>
        </div>
      </div>
    </div>
  );
}

function SectionTable({ titre, lignes, total }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", color: "#888", marginBottom: 8 }}>{titre}</div>
      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
        <tbody>
          {lignes.map((l) => (
            <tr key={l.numero}>
              <td style={{ padding: "4px 0", color: "#444", fontFamily: "monospace", width: 60 }}>{l.numero}</td>
              <td style={{ padding: "4px 0" }}>{l.nom}</td>
              <td style={{ padding: "4px 0", textAlign: "right", fontWeight: 600 }}>{l.solde.toFixed(2)} $</td>
            </tr>
          ))}
          {lignes.length === 0 && (
            <tr><td colSpan={3} style={{ padding: "4px 0", color: "#999", fontStyle: "italic" }}>Aucune donnée</td></tr>
          )}
          <tr>
            <td colSpan={2} style={{ padding: "6px 0", fontWeight: 700, borderTop: "1px solid #ddd" }}>Total {titre.toLowerCase()}</td>
            <td style={{ padding: "6px 0", textAlign: "right", fontWeight: 700, borderTop: "1px solid #ddd" }}>{total.toFixed(2)} $</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
