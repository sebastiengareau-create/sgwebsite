import { redirect, notFound } from "next/navigation";
import { obtenirSession, estGerantOuDev, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import EnTete from "../../../components/EnTete";
import Link from "next/link";

const NORMAL_DEBIT = ["ACTIF", "DEPENSE"];

export default async function GrandLivre({ params }) {
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "comptabilite"))) redirect("/gerant");

  const compte = await prisma.compte.findUnique({
    where: { id: params.compteId },
    include: { lignes: { include: { ecriture: true }, orderBy: { ecriture: { date: "asc" } } } },
  });
  if (!compte) notFound();

  let solde = 0;
  const lignesAvecSolde = compte.lignes.map((l) => {
    solde += NORMAL_DEBIT.includes(compte.type) ? l.debit - l.credit : l.credit - l.debit;
    return { ...l, soldeApres: solde };
  });

  return (
    <div>
      <EnTete nom={session.nom} role={session.role} />
      <div className="conteneur-page">
        <Link href="/gerant/comptabilite" style={{ fontSize: 12, color: "var(--text-muted)", textDecoration: "none" }}>← Retour au plan comptable</Link>
        <h1 style={{ fontSize: 20, marginTop: 8 }}>
          <span style={{ fontFamily: "monospace", fontSize: 14, color: "var(--text-muted)", marginRight: 8 }}>{compte.numero}</span>
          {compte.nom}
        </h1>
        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)", marginTop: 4, marginBottom: 20 }}>
          Solde : {solde.toFixed(2)} $
        </div>

        {lignesAvecSolde.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Aucune écriture sur ce compte encore.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {lignesAvecSolde.map((l) => (
              <div key={l.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)" }}>
                  <span>{new Date(l.ecriture.date).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}</span>
                  <span style={{ fontFamily: "monospace" }}>{l.ecriture.numero}</span>
                </div>
                <div style={{ fontSize: 13, marginTop: 2 }}>{l.ecriture.description}</div>
                {l.ecriture.creePar && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>par {l.ecriture.creePar}</div>}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 13 }}>
                  <span style={{ color: l.debit > 0 ? "var(--text)" : "var(--text-muted)" }}>
                    Débit : {l.debit > 0 ? l.debit.toFixed(2) + " $" : "—"}
                  </span>
                  <span style={{ color: l.credit > 0 ? "var(--text)" : "var(--text-muted)" }}>
                    Crédit : {l.credit > 0 ? l.credit.toFixed(2) + " $" : "—"}
                  </span>
                  <span style={{ fontWeight: 700 }}>{l.soldeApres.toFixed(2)} $</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
