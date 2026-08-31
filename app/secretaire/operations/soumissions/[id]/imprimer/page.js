import { notFound, redirect } from "next/navigation";
import { obtenirSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { obtenirInfosEntreprise } from "@/lib/config";
import BoutonImprimer from "../../../../../bons/[id]/imprimer/BoutonImprimer";
import BoutonRetour from "./BoutonRetour";

const STATUTS = { EN_ATTENTE: "En attente", ACCEPTEE: "Acceptée", BROUILLON: "En attente", ENVOYEE: "En attente", REFUSEE: "Refusée" };

export default async function ImprimerSoumission({ params }) {
  const session = await obtenirSession();
  const { nomEntreprise, adresseLigne1, adresseLigne2, telephone } = await obtenirInfosEntreprise();
  if (!session) redirect("/login");

  const [soumission, parametres] = await Promise.all([
    prisma.soumission.findUnique({
      where: { id: params.id },
      include: { taches: { include: { pieces: true } }, client: true },
    }),
    prisma.parametre.findMany(),
  ]);
  if (!soumission) notFound();

  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));
  const tauxHoraireClient = Number(dict.taux_horaire_client || 195);

  const totalTemps = soumission.taches.reduce((s, t) => s + t.tempsEstime, 0);
  const totalMainOeuvre = totalTemps * tauxHoraireClient;
  const totalPieces = soumission.taches.reduce(
    (s, t) => s + t.pieces.reduce((s2, p) => s2 + p.prixEstime * p.qte, 0),
    0
  );
  const totalEstime = totalMainOeuvre + totalPieces;
  const garantie = soumission.client?.garantieProlongee;

  return (
    <div>
      <style>{`
        @media print {
          .cacher-impression { display: none !important; }
          body { background: white !important; }
        }
        body { background: #f2f0ea; margin: 0; }
      `}</style>

      <div className="cacher-impression" style={{ padding: 16, display: "flex", justifyContent: "center", gap: 10 }}>
        <BoutonRetour />
        <BoutonImprimer />
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto 40px", background: "white", color: "#17150f", padding: "36px 40px", fontFamily: "Arial, sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #17150f", paddingBottom: 16, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/logo.png" alt={nomEntreprise} style={{ width: 50, height: 50, objectFit: "contain" }} />
            <div>
              <h1 style={{ fontSize: 22, margin: 0 }}>{nomEntreprise}</h1>
              <p style={{ fontSize: 11.5, color: "#666", margin: "3px 0 0", lineHeight: 1.4 }}>
                {adresseLigne1}<br />{adresseLigne2}<br />{telephone}
              </p>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>SOUMISSION</div>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "monospace", marginTop: 2 }}>#{soumission.numero}</div>
            <div style={{ fontSize: 12, color: "#666" }}>{new Date(soumission.creeLe).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}</div>
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>{STATUTS[soumission.statut]}</div>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#888", marginBottom: 4 }}>Client</div>
          <div style={{ fontWeight: 600 }}>{soumission.clientNom}</div>
          {soumission.clientTelephone && <div style={{ fontSize: 13 }}>{soumission.clientTelephone}</div>}
          {garantie && (
            <div style={{ fontSize: 12, marginTop: 6, padding: "4px 8px", background: "#f2f0ea", borderRadius: 4, display: "inline-block" }}>
              🛡️ Garantie prolongée — contrat #{garantie}
            </div>
          )}
        </div>

        <div style={{ fontSize: 11, textTransform: "uppercase", color: "#888", marginBottom: 8 }}>Travaux estimés</div>
        {soumission.taches.map((t, idx) => (
          <div key={t.id} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 600 }}>
              <span>{idx + 1}. {t.description}</span>
              <span style={{ fontSize: 12, color: "#666", fontWeight: 400 }}>{t.tempsEstime}h × {tauxHoraireClient.toFixed(2)} $ = {(t.tempsEstime * tauxHoraireClient).toFixed(2)} $</span>
            </div>
            {t.pieces.length > 0 && (
              <table style={{ width: "100%", fontSize: 12, marginTop: 4, borderCollapse: "collapse" }}>
                <tbody>
                  {t.pieces.map((p) => (
                    <tr key={p.id}>
                      <td style={{ padding: "2px 0", color: "#444" }}>{p.nom}</td>
                      <td style={{ padding: "2px 0", textAlign: "center", width: 50 }}>{p.qte} ×</td>
                      <td style={{ padding: "2px 0", textAlign: "right", width: 70 }}>{p.prixEstime.toFixed(2)} $</td>
                      <td style={{ padding: "2px 0", textAlign: "right", width: 80, fontWeight: 600 }}>{(p.qte * p.prixEstime).toFixed(2)} $</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}

        <div style={{ marginTop: 20, marginLeft: "auto", width: 280, borderTop: "2px solid #17150f", paddingTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span>Main-d'œuvre ({totalTemps}h × {tauxHoraireClient.toFixed(2)} $)</span>
            <span style={{ fontWeight: 600 }}>{totalMainOeuvre.toFixed(2)} $</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span>Pièces estimées</span>
            <span style={{ fontWeight: 600 }}>{totalPieces.toFixed(2)} $</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700, marginTop: 8, paddingTop: 8, borderTop: "1px solid #ddd" }}>
            <span>Total estimé</span>
            <span>{totalEstime.toFixed(2)} $</span>
          </div>
        </div>

        <p style={{ fontSize: 10, color: "#999", marginTop: 30, textAlign: "center" }}>
          Estimé sujet à changement selon les travaux réels requis — {nomEntreprise}
        </p>
      </div>
    </div>
  );
}
