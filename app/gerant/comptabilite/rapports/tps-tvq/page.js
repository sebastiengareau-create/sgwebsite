import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { obtenirInfosEntreprise } from "@/lib/config";
import { dateAujourdhuiQuebec, limitesJourQuebec } from "@/lib/temps";
import BoutonImprimerRapport from "../BoutonImprimerRapport";

export default async function RapportTpsTvq({ searchParams }) {
  const session = await obtenirSession();
  const { nomEntreprise, adresseLigne1, adresseLigne2 } = await obtenirInfosEntreprise();
  if (!(await aAccesSection(session, "comptabilite"))) redirect("/login");

  const aujourdhui = dateAujourdhuiQuebec();
  const [an, mois] = aujourdhui.split("-");
  const debutMoisDefaut = `${an}-${mois}-01`;

  const debutStr = searchParams?.debut || debutMoisDefaut;
  const finStr = searchParams?.fin || aujourdhui;

  const { debut } = limitesJourQuebec(debutStr);
  const { fin } = limitesJourQuebec(finStr);

  const parametres = await prisma.parametre.findMany({ where: { cle: { in: ["tps_numero", "tvq_numero"] } } });
  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));

  const [compteTps, compteTvq] = await Promise.all([
    prisma.compte.findUnique({ where: { numero: "2000" }, include: { lignes: { where: { ecriture: { date: { gte: debut, lte: fin } } }, include: { ecriture: true } } } }),
    prisma.compte.findUnique({ where: { numero: "2010" }, include: { lignes: { where: { ecriture: { date: { gte: debut, lte: fin } } }, include: { ecriture: true } } } }),
  ]);

  function resumer(compte) {
    if (!compte) return { percue: 0, payee: 0, nette: 0 };
    const percue = compte.lignes.reduce((s, l) => s + l.credit, 0);
    const payee = compte.lignes.reduce((s, l) => s + l.debit, 0);
    return { percue, payee, nette: percue - payee };
  }

  const tps = resumer(compteTps);
  const tvq = resumer(compteTvq);
  const totalARemettre = tps.nette + tvq.nette;

  return (
    <div>
      <style>{`
        @media print { .cacher-impression { display: none !important; } body { background: white !important; } }
        body { background: #f2f0ea; margin: 0; }
      `}</style>
      <div className="cacher-impression" style={{ padding: 16, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <form method="get" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
          <input type="date" name="debut" defaultValue={debutStr} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }} />
          <span style={{ color: "var(--text-muted)" }}>à</span>
          <input type="date" name="fin" defaultValue={finStr} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }} />
          <button type="submit" className="bouton-3d-sombre" style={{ padding: "9px 16px", borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
            Changer la période
          </button>
        </form>
        <BoutonImprimerRapport />
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto 40px", background: "white", color: "#17150f", padding: "36px 40px", fontFamily: "Arial, sans-serif" }}>
        <div style={{ borderBottom: "2px solid #17150f", paddingBottom: 16, marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>{nomEntreprise}</h1>
          <p style={{ fontSize: 11.5, color: "#666", margin: "3px 0 0" }}>{adresseLigne1}, {adresseLigne2}</p>
          <p style={{ fontSize: 16, fontWeight: 700, marginTop: 12, marginBottom: 0 }}>Rapport de remise TPS/TVQ</p>
          <p style={{ fontSize: 11.5, color: "#666", margin: "2px 0 0" }}>
            Du {new Date(`${debutStr}T12:00:00`).toLocaleDateString("fr-CA")} au {new Date(`${finStr}T12:00:00`).toLocaleDateString("fr-CA")}
          </p>
          {(dict.tps_numero || dict.tvq_numero) && (
            <p style={{ fontSize: 10.5, color: "#888", margin: "4px 0 0" }}>
              {dict.tps_numero && <>No TPS : {dict.tps_numero} </>}
              {dict.tvq_numero && <>· No TVQ : {dict.tvq_numero}</>}
            </p>
          )}
        </div>

        <SectionTaxe titre="TPS" numero={dict.tps_numero} data={tps} />
        <SectionTaxe titre="TVQ" numero={dict.tvq_numero} data={tvq} />

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, paddingTop: 16, borderTop: "2px solid #17150f" }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>Total à remettre</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: totalARemettre >= 0 ? "#17150f" : "#a83232" }}>{totalARemettre.toFixed(2)} $</span>
        </div>
        {totalARemettre < 0 && (
          <p style={{ fontSize: 11, color: "#a83232", marginTop: 6 }}>
            Montant négatif — tu as payé plus de taxes sur tes achats que perçu sur tes ventes ce trimestre; ce montant te serait normalement remboursé.
          </p>
        )}

        <p style={{ fontSize: 10, color: "#999", marginTop: 30, textAlign: "center" }}>
          Calculé à partir des écritures comptables de la période — à valider avant toute vraie déclaration.
        </p>
      </div>
    </div>
  );
}

function SectionTaxe({ titre, numero, data }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", color: "#888", marginBottom: 8 }}>
        {titre}{numero ? ` (${numero})` : ""}
      </div>
      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={{ padding: "4px 0" }}>Perçue sur les ventes</td>
            <td style={{ padding: "4px 0", textAlign: "right", fontWeight: 600 }}>{data.percue.toFixed(2)} $</td>
          </tr>
          <tr>
            <td style={{ padding: "4px 0" }}>Payée sur les achats (récupérable)</td>
            <td style={{ padding: "4px 0", textAlign: "right", fontWeight: 600 }}>−{data.payee.toFixed(2)} $</td>
          </tr>
          <tr>
            <td style={{ padding: "6px 0", fontWeight: 700, borderTop: "1px solid #ddd" }}>Net à remettre</td>
            <td style={{ padding: "6px 0", textAlign: "right", fontWeight: 700, borderTop: "1px solid #ddd" }}>{data.nette.toFixed(2)} $</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
