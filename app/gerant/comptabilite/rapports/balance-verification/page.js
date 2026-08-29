import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assurerPlanComptable } from "@/lib/comptabilite";
import { obtenirInfosEntreprise } from "@/lib/config";
import BoutonImprimerRapport from "../BoutonImprimerRapport";

const NORMAL_DEBIT = ["ACTIF", "DEPENSE"];
const LABELS_TYPE = { ACTIF: "Actif", PASSIF: "Passif", CAPITAUX_PROPRES: "Capitaux propres", REVENU: "Revenus", DEPENSE: "Dépenses" };

export default async function BalanceVerificationImprimable() {
  const session = await obtenirSession();
  const { nomEntreprise, adresseLigne1, adresseLigne2 } = await obtenirInfosEntreprise();
  if (!(await aAccesSection(session, "comptabilite"))) redirect("/login");
  await assurerPlanComptable();

  const comptes = await prisma.compte.findMany({ where: { actif: true }, include: { lignes: true }, orderBy: { numero: "asc" } });

  // La balance de vérification liste chaque compte avec son solde du côté
  // qui lui est naturel (Débit pour Actif/Dépenses, Crédit pour le reste) —
  // les deux colonnes doivent toujours totaliser le même montant
  const lignes = comptes
    .map((c) => {
      const totalDebit = c.lignes.reduce((s, l) => s + l.debit, 0);
      const totalCredit = c.lignes.reduce((s, l) => s + l.credit, 0);
      const solde = NORMAL_DEBIT.includes(c.type) ? totalDebit - totalCredit : totalCredit - totalDebit;
      return { numero: c.numero, nom: c.nom, type: c.type, debit: NORMAL_DEBIT.includes(c.type) ? solde : 0, credit: NORMAL_DEBIT.includes(c.type) ? 0 : solde };
    })
    .filter((l) => l.debit !== 0 || l.credit !== 0);

  const totalDebit = lignes.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lignes.reduce((s, l) => s + l.credit, 0);
  const equilibre = Math.abs(totalDebit - totalCredit) < 0.01;

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
          <p style={{ fontSize: 16, fontWeight: 700, marginTop: 12, marginBottom: 0 }}>Balance de vérification</p>
          <p style={{ fontSize: 11.5, color: "#666", margin: "2px 0 0" }}>
            Au {new Date().toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}
          </p>
        </div>

        <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #17150f" }}>
              <th style={{ textAlign: "left", padding: "6px 0", fontSize: 10.5, textTransform: "uppercase", color: "#888" }}>No</th>
              <th style={{ textAlign: "left", padding: "6px 0", fontSize: 10.5, textTransform: "uppercase", color: "#888" }}>Compte</th>
              <th style={{ textAlign: "right", padding: "6px 0", fontSize: 10.5, textTransform: "uppercase", color: "#888" }}>Débit</th>
              <th style={{ textAlign: "right", padding: "6px 0", fontSize: 10.5, textTransform: "uppercase", color: "#888" }}>Crédit</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.numero} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "5px 0", fontFamily: "monospace", color: "#444" }}>{l.numero}</td>
                <td style={{ padding: "5px 0" }}>{l.nom}</td>
                <td style={{ padding: "5px 0", textAlign: "right" }}>{l.debit > 0 ? l.debit.toFixed(2) + " $" : ""}</td>
                <td style={{ padding: "5px 0", textAlign: "right" }}>{l.credit > 0 ? l.credit.toFixed(2) + " $" : ""}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid #17150f" }}>
              <td colSpan={2} style={{ padding: "8px 0", fontWeight: 700 }}>Total</td>
              <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 700 }}>{totalDebit.toFixed(2)} $</td>
              <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 700 }}>{totalCredit.toFixed(2)} $</td>
            </tr>
          </tfoot>
        </table>

        <div style={{ marginTop: 16, fontSize: 13, fontWeight: 700, color: equilibre ? "#3d7a3d" : "#a83232" }}>
          {equilibre ? "✓ La balance est équilibrée" : `⚠ Écart de ${Math.abs(totalDebit - totalCredit).toFixed(2)} $`}
        </div>
      </div>
    </div>
  );
}
