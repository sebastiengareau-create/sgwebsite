import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { obtenirInfosEntreprise } from "@/lib/config";
import { dateAujourdhuiQuebec, limitesJourQuebec } from "@/lib/temps";
import BoutonImprimerRapport from "../BoutonImprimerRapport";

export default async function RapportDas({ searchParams }) {
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

  const numeros = ["2020", "2030", "2040", "2050", "2060"];
  const comptes = await prisma.compte.findMany({
    where: { numero: { in: numeros } },
    include: { lignes: { where: { ecriture: { date: { gte: debut, lte: fin } } } } },
  });

  function soldeCompte(numero) {
    const c = comptes.find((c) => c.numero === numero);
    if (!c) return 0;
    return c.lignes.reduce((s, l) => s + l.credit - l.debit, 0);
  }

  const rrq = soldeCompte("2020");
  const rqap = soldeCompte("2030");
  const ae = soldeCompte("2040");
  const impotFederal = soldeCompte("2050");
  const impotQuebec = soldeCompte("2060");

  const totalFederal = impotFederal + ae;
  const totalProvincial = impotQuebec + rrq + rqap;
  const totalGeneral = totalFederal + totalProvincial;

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
          <p style={{ fontSize: 16, fontWeight: 700, marginTop: 12, marginBottom: 0 }}>Déductions à la source (DAS) à remettre</p>
          <p style={{ fontSize: 11.5, color: "#666", margin: "2px 0 0" }}>
            Du {new Date(`${debutStr}T12:00:00`).toLocaleDateString("fr-CA")} au {new Date(`${finStr}T12:00:00`).toLocaleDateString("fr-CA")}
          </p>
        </div>

        <SectionRemise
          titre="Agence du revenu du Canada (ARC)"
          lignes={[
            { label: "Impôt fédéral retenu (employés)", valeur: impotFederal },
            { label: "Assurance-emploi (part employé + employeur)", valeur: ae },
          ]}
          total={totalFederal}
        />

        <SectionRemise
          titre="Revenu Québec"
          lignes={[
            { label: "Impôt Québec retenu (employés)", valeur: impotQuebec },
            { label: "RRQ (part employé + employeur)", valeur: rrq },
            { label: "RQAP (part employé + employeur)", valeur: rqap },
          ]}
          total={totalProvincial}
        />

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, paddingTop: 16, borderTop: "2px solid #17150f" }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>Total DAS à remettre</span>
          <span style={{ fontSize: 20, fontWeight: 700 }}>{totalGeneral.toFixed(2)} $</span>
        </div>

        <p style={{ fontSize: 10, color: "#999", marginTop: 30, textAlign: "center" }}>
          Calculé à partir des paies confirmées de la période — à valider avant toute vraie remise. La fréquence de
          remise (mensuelle, trimestrielle, etc.) dépend de ton statut auprès de l'ARC et de Revenu Québec.
        </p>
      </div>
    </div>
  );
}

function SectionRemise({ titre, lignes, total }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", color: "#888", marginBottom: 8 }}>{titre}</div>
      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
        <tbody>
          {lignes.map((l) => (
            <tr key={l.label}>
              <td style={{ padding: "4px 0" }}>{l.label}</td>
              <td style={{ padding: "4px 0", textAlign: "right", fontWeight: 600 }}>{l.valeur.toFixed(2)} $</td>
            </tr>
          ))}
          <tr>
            <td style={{ padding: "6px 0", fontWeight: 700, borderTop: "1px solid #ddd" }}>Sous-total {titre.split(" ")[0]}</td>
            <td style={{ padding: "6px 0", textAlign: "right", fontWeight: 700, borderTop: "1px solid #ddd" }}>{total.toFixed(2)} $</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
