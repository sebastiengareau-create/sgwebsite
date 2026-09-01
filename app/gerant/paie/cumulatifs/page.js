import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { obtenirInfosEntreprise } from "@/lib/config";
import { dateAujourdhuiQuebec } from "@/lib/temps";
import BoutonImprimerRapport from "../../comptabilite/rapports/BoutonImprimerRapport";

export default async function CumulatifsPaie({ searchParams }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "paie"))) redirect("/login");

  const { nomEntreprise, adresseLigne1, adresseLigne2 } = await obtenirInfosEntreprise();

  const aujourdhui = dateAujourdhuiQuebec();
  const [an] = aujourdhui.split("-");
  const debutStr = searchParams?.debut || `${an}-01-01`;
  const finStr = searchParams?.fin || aujourdhui;
  const debut = new Date(`${debutStr}T00:00:00`);
  const fin = new Date(`${finStr}T23:59:59`);

  const paies = await prisma.paie.findMany({
    where: { periodeFin: { gte: debut, lte: fin }, statut: "VERSEE" },
    include: { employe: true },
    orderBy: [{ employe: { nom: "asc" } }, { periodeFin: "asc" }],
  });

  const parEmploye = {};
  for (const p of paies) {
    const nom = p.employe.nom;
    if (!parEmploye[nom]) {
      parEmploye[nom] = { brut: 0, rrq: 0, rqap: 0, ae: 0, impotFederal: 0, impotQuebec: 0, net: 0, vacancesAccumulees: 0, vacancesVersees: 0, nbPaies: 0 };
    }
    const d = parEmploye[nom];
    d.brut += p.salaireBrut;
    d.rrq += p.rrqEmploye;
    d.rqap += p.rqapEmploye;
    d.ae += p.aeEmploye;
    d.impotFederal += p.impotFederal;
    d.impotQuebec += p.impotQuebec;
    d.net += p.salaireNet;
    if (p.typePaie === "VACANCES") d.vacancesVersees += p.salaireBrut;
    else d.vacancesAccumulees += p.vacancesAccumulees;
    d.nbPaies += 1;
  }
  const lignes = Object.entries(parEmploye).sort((a, b) => a[0].localeCompare(b[0]));

  const totaux = lignes.reduce(
    (acc, [, d]) => ({
      brut: acc.brut + d.brut, rrq: acc.rrq + d.rrq, rqap: acc.rqap + d.rqap, ae: acc.ae + d.ae,
      impotFederal: acc.impotFederal + d.impotFederal, impotQuebec: acc.impotQuebec + d.impotQuebec, net: acc.net + d.net,
    }),
    { brut: 0, rrq: 0, rqap: 0, ae: 0, impotFederal: 0, impotQuebec: 0, net: 0 }
  );

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

      <div style={{ maxWidth: 820, margin: "0 auto 40px", background: "white", color: "#17150f", padding: "36px 40px", fontFamily: "Arial, sans-serif" }}>
        <div style={{ borderBottom: "2px solid #17150f", paddingBottom: 16, marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>{nomEntreprise}</h1>
          <p style={{ fontSize: 11.5, color: "#666", margin: "3px 0 0" }}>{adresseLigne1}, {adresseLigne2}</p>
          <p style={{ fontSize: 16, fontWeight: 700, marginTop: 12, marginBottom: 0 }}>Cumulatifs de paie par employé</p>
          <p style={{ fontSize: 11.5, color: "#666", margin: "2px 0 0" }}>
            Du {new Date(`${debutStr}T12:00:00`).toLocaleDateString("fr-CA")} au {new Date(`${finStr}T12:00:00`).toLocaleDateString("fr-CA")}
          </p>
        </div>

        <table style={{ width: "100%", fontSize: 11.5, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #17150f" }}>
              <th style={{ textAlign: "left", padding: "6px 4px", fontSize: 10, textTransform: "uppercase", color: "#888" }}>Employé</th>
              <th style={{ textAlign: "right", padding: "6px 4px", fontSize: 10, textTransform: "uppercase", color: "#888" }}>Brut</th>
              <th style={{ textAlign: "right", padding: "6px 4px", fontSize: 10, textTransform: "uppercase", color: "#888" }}>RRQ</th>
              <th style={{ textAlign: "right", padding: "6px 4px", fontSize: 10, textTransform: "uppercase", color: "#888" }}>RQAP</th>
              <th style={{ textAlign: "right", padding: "6px 4px", fontSize: 10, textTransform: "uppercase", color: "#888" }}>AE</th>
              <th style={{ textAlign: "right", padding: "6px 4px", fontSize: 10, textTransform: "uppercase", color: "#888" }}>Imp. féd.</th>
              <th style={{ textAlign: "right", padding: "6px 4px", fontSize: 10, textTransform: "uppercase", color: "#888" }}>Imp. QC</th>
              <th style={{ textAlign: "right", padding: "6px 4px", fontSize: 10, textTransform: "uppercase", color: "#888" }}>Net</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map(([nom, d]) => (
              <tr key={nom} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "6px 4px" }}>{nom} <span style={{ color: "#999", fontSize: 10 }}>({d.nbPaies})</span></td>
                <td style={{ padding: "6px 4px", textAlign: "right", fontWeight: 600 }}>{d.brut.toFixed(2)} $</td>
                <td style={{ padding: "6px 4px", textAlign: "right" }}>{d.rrq.toFixed(2)} $</td>
                <td style={{ padding: "6px 4px", textAlign: "right" }}>{d.rqap.toFixed(2)} $</td>
                <td style={{ padding: "6px 4px", textAlign: "right" }}>{d.ae.toFixed(2)} $</td>
                <td style={{ padding: "6px 4px", textAlign: "right" }}>{d.impotFederal.toFixed(2)} $</td>
                <td style={{ padding: "6px 4px", textAlign: "right" }}>{d.impotQuebec.toFixed(2)} $</td>
                <td style={{ padding: "6px 4px", textAlign: "right", fontWeight: 700 }}>{d.net.toFixed(2)} $</td>
              </tr>
            ))}
            {lignes.length === 0 && (
              <tr><td colSpan={8} style={{ padding: "10px 4px", color: "#999", fontStyle: "italic" }}>Aucune paie sur cette période</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid #17150f" }}>
              <td style={{ padding: "8px 4px", fontWeight: 700 }}>Total</td>
              <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 700 }}>{totaux.brut.toFixed(2)} $</td>
              <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 700 }}>{totaux.rrq.toFixed(2)} $</td>
              <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 700 }}>{totaux.rqap.toFixed(2)} $</td>
              <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 700 }}>{totaux.ae.toFixed(2)} $</td>
              <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 700 }}>{totaux.impotFederal.toFixed(2)} $</td>
              <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 700 }}>{totaux.impotQuebec.toFixed(2)} $</td>
              <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 700 }}>{totaux.net.toFixed(2)} $</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
