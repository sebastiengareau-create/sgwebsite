import { notFound, redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { obtenirInfosEntreprise } from "@/lib/config";
import { libelleVehicule } from "@/lib/vehicules";
import { image } from "@/lib/client";
import BoutonImprimer from "../../../../../bons/[id]/imprimer/BoutonImprimer";

// Facture de vente d'un véhicule à vendre, à imprimer — même présentation
// que la facture d'un bon (app/bons/[id]/imprimer).
export default async function ImprimerFactureVente(props) {
  const params = await props.params;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "inventaire"))) redirect("/login");

  const [vv, infos, parametres] = await Promise.all([
    prisma.vehiculeVente.findUnique({ where: { id: params.id }, include: { vehicule: true, factureVente: { include: { client: true } } } }),
    obtenirInfosEntreprise(),
    prisma.parametre.findMany({ where: { cle: { in: ["tps_numero", "tvq_numero"] } } }),
  ]);
  if (!vv?.factureVente) notFound();
  const fv = vv.factureVente;
  const client = fv.client;
  const v = vv.vehicule;
  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));
  const { nomEntreprise, adresseLigne1, adresseLigne2, telephone } = infos;

  return (
    <div>
      <style>{`
        @media print { .cacher-impression { display: none !important; } body { background: white !important; } }
        body { background: #f2f0ea; margin: 0; }
      `}</style>
      <div className="cacher-impression" style={{ padding: 16, textAlign: "center" }}>
        <BoutonImprimer />
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto 40px", background: "white", color: "#17150f", padding: "36px 40px", fontFamily: "Arial, sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #17150f", paddingBottom: 16, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src={image("logo.png")} alt={nomEntreprise} style={{ width: 50, height: 50, objectFit: "contain" }} />
            <div>
              <h1 style={{ fontSize: 22, margin: 0 }}>{nomEntreprise}</h1>
              <p style={{ fontSize: 11.5, color: "#666", margin: "3px 0 0", lineHeight: 1.4 }}>
                {adresseLigne1}<br />{adresseLigne2}<br />{telephone}
              </p>
              {(dict.tps_numero || dict.tvq_numero) && (
                <p style={{ fontSize: 10, color: "#888", margin: "4px 0 0", lineHeight: 1.4 }}>
                  {dict.tps_numero && <>TPS : {dict.tps_numero}<br /></>}
                  {dict.tvq_numero && <>TVQ : {dict.tvq_numero}</>}
                </p>
              )}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>FACTURE DE VENTE</div>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "monospace", marginTop: 2 }}>#{fv.numero}</div>
            <div style={{ fontSize: 12, color: "#666" }}>{new Date(fv.dateEmission).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}</div>
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>{fv.statut === "PAYEE" ? "Payée" : "Impayée"}</div>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#888", marginBottom: 4 }}>Acheteur</div>
          <div style={{ fontWeight: 600 }}>{client.nom}</div>
          {client.telephone && <div style={{ fontSize: 13 }}>{client.telephone}</div>}
          {(client.adresse || client.ville) && (
            <div style={{ fontSize: 13 }}>{[client.adresse, [client.ville, client.codePostal].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</div>
          )}
        </div>

        <div style={{ fontSize: 11, textTransform: "uppercase", color: "#888", marginBottom: 6 }}>Véhicule vendu</div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, borderBottom: "1px solid #ddd", paddingBottom: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{libelleVehicule(v) || "Véhicule"}</div>
            <div style={{ fontSize: 12, fontFamily: "monospace", marginTop: 2 }}>
              {[v.niv && `NIV ${v.niv}`, v.plaque && `Plaque ${v.plaque}`, vv.kilometrage != null && `${vv.kilometrage.toLocaleString("fr-CA")} km`].filter(Boolean).join(" · ")}
            </div>
            {vv.description && <div style={{ fontSize: 12, color: "#444", whiteSpace: "pre-wrap", marginTop: 6 }}>{vv.description}</div>}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap" }}>{fv.prixVente.toFixed(2)} $</div>
        </div>

        <div style={{ marginTop: 16, marginLeft: "auto", width: 260 }}>
          <LigneTotal label="Sous-total" valeur={fv.prixVente} />
          <LigneTotal label="TPS" valeur={fv.tpsMontant} petit />
          <LigneTotal label="TVQ" valeur={fv.tvqMontant} petit />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: "2px solid #17150f" }}>
            <span style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase" }}>Total (taxes incl.)</span>
            <span style={{ fontSize: 20, fontWeight: 700 }}>{fv.totalAvecTaxes.toFixed(2)} $</span>
          </div>
        </div>

        {fv.note && <p style={{ fontSize: 12, whiteSpace: "pre-wrap", marginTop: 24, padding: 10, background: "#f2f0ea", borderRadius: 4 }}>{fv.note}</p>}

        <p style={{ fontSize: 10, color: "#999", marginTop: 30, textAlign: "center" }}>
          {nomEntreprise} — document généré le {new Date().toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}
        </p>
      </div>
    </div>
  );
}

function LigneTotal({ label, valeur, petit }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: petit ? 12 : 13, color: petit ? "#666" : "#17150f", padding: "3px 0" }}>
      <span>{label}</span>
      <span>{valeur.toFixed(2)} $</span>
    </div>
  );
}
