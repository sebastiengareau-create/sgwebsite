import { notFound, redirect } from "next/navigation";
import { obtenirSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { obtenirInfosEntreprise } from "@/lib/config";
import BoutonImprimer from "./BoutonImprimer";
function dureeHeures(debutISO, finISO) {
  return (new Date(finISO) - new Date(debutISO)) / 3600000;
}
function fmtHeures(h) {
  const heures = Math.floor(h);
  const min = Math.round((h - heures) * 60);
  return `${heures}h${String(min).padStart(2, "0")}`;
}

const STATUTS = { EN_ATTENTE: "En attente", EN_COURS: "En cours", TERMINE: "Facturé" };
const STATUTS_FACTURE = { IMPAYEE: "Impayée", PAYEE: "Payée", ANNULEE: "Annulée" };
const COLONNES_TRAVAUX = "1fr 55px 45px 65px 75px"; // description | hrs | qté | prix | total

export default async function ImprimerBon({ params }) {
  const session = await obtenirSession();
  const { nomEntreprise, adresseLigne1, adresseLigne2, telephone } = await obtenirInfosEntreprise();
  if (!session) redirect("/login");

  const [bon, parametres] = await Promise.all([
    prisma.bonTravail.findUnique({
      where: { id: params.id },
      include: {
        client: true,
        problemes: { orderBy: { id: "asc" }, include: { photos: true, pieces: { include: { piece: true } }, entreesTemps: { include: { employe: true } } } },
        facture: true,
      },
    }),
    prisma.parametre.findMany(),
  ]);
  if (!bon) notFound();

  const dict = Object.fromEntries(parametres.map((p) => [p.cle, p.valeur]));

  const problemesMainOeuvre = bon.problemes.filter((pr) => (pr.categorieRevenu || "MAIN_OEUVRE") === "MAIN_OEUVRE");
  const toutesEntreesTemps = problemesMainOeuvre.flatMap((pr) => pr.entreesTemps);
  const parEmploye = {};
  for (const t of toutesEntreesTemps) {
    if (!parEmploye[t.employeId]) parEmploye[t.employeId] = { employe: t.employe, heures: 0 };
    if (t.fin) parEmploye[t.employeId].heures += dureeHeures(t.debut, t.fin);
  }

  // Si une facture officielle existe, on utilise ses montants FIGÉS (le vrai
  // document légal). Sinon, on calcule un aperçu en direct, clairement marqué
  // comme tel, puisque les montants pourraient encore changer.
  const estFacturee = !!bon.facture;
  const totalPieces = estFacturee
    ? bon.facture.totalPieces
    : bon.problemes.reduce((s, pr) => s + pr.pieces.reduce((s2, l) => s2 + l.qte * l.prix, 0), 0);
  const tauxHoraireClient = estFacturee ? bon.facture.tauxHoraireUtilise : (bon.tauxHoraireOverride ?? Number(dict.taux_horaire_client || 195));
  const totalHeures = estFacturee ? bon.facture.heuresFacturees : Object.values(parEmploye).reduce((s, l) => s + l.heures, 0);
  const totalMainOeuvre = estFacturee ? bon.facture.totalMainOeuvre : totalHeures * tauxHoraireClient;
  const totalAutresRevenus = estFacturee
    ? (bon.facture.totalAutresRevenus || 0)
    : bon.problemes.filter((pr) => (pr.categorieRevenu || "MAIN_OEUVRE") !== "MAIN_OEUVRE").reduce((s, pr) => s + (pr.facturePrixUnitaire || 0) * (pr.factureQte || 1), 0);
  const sousTotalAvantEscompte = estFacturee
    ? bon.facture.totalFacture + (bon.facture.escompteApplique || 0)
    : totalPieces + totalMainOeuvre + totalAutresRevenus;
  const escompteApplique = estFacturee
    ? (bon.facture.escompteApplique || 0)
    : Math.min(bon.escompteMontant || 0, sousTotalAvantEscompte);
  const totalFacture = estFacturee ? bon.facture.totalFacture : sousTotalAvantEscompte - escompteApplique;

  const tpsTaux = Number(dict.tps_taux || 5);
  const tvqTaux = Number(dict.tvq_taux || 9.975);
  const tpsMontant = estFacturee ? bon.facture.tpsMontant : totalFacture * (tpsTaux / 100);
  const tvqMontant = estFacturee ? bon.facture.tvqMontant : totalFacture * (tvqTaux / 100);
  const totalAvecTaxes = estFacturee ? bon.facture.totalAvecTaxes : totalFacture + tpsMontant + tvqMontant;

  return (
    <div>
      <style>{`
        @media print {
          .cacher-impression { display: none !important; }
          body { background: white !important; }
        }
        body { background: #f2f0ea; margin: 0; }
      `}</style>

      <div className="cacher-impression" style={{ padding: 16, textAlign: "center" }}>
        <BoutonImprimer />
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto 40px", background: "white", color: "#17150f", padding: "36px 40px", fontFamily: "Arial, sans-serif", position: "relative" }}>
        {!estFacturee && (
          <div style={{
            position: "absolute", top: 20, right: -30, background: "#C9A227", color: "#17150f",
            padding: "4px 40px", fontSize: 11, fontWeight: 700, transform: "rotate(30deg)", boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
          }}>
            APERÇU — NON OFFICIELLE
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #17150f", paddingBottom: 16, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/logo.png" alt={nomEntreprise} style={{ width: 50, height: 50, objectFit: "contain" }} />
            <div>
              <h1 style={{ fontSize: 22, margin: 0 }}>{nomEntreprise}</h1>
              <p style={{ fontSize: 11.5, color: "#666", margin: "3px 0 0", lineHeight: 1.4 }}>
                {adresseLigne1}<br />
                {adresseLigne2}<br />
                {telephone}
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
            <div style={{ fontSize: 18, fontWeight: 700 }}>{estFacturee ? "FACTURE" : "APERÇU DE FACTURE"}</div>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "monospace", marginTop: 2 }}>
              #{estFacturee ? bon.facture.numero : bon.numero}
            </div>
            <div style={{ fontSize: 12, color: "#666" }}>
              {new Date(estFacturee ? bon.facture.dateEmission : bon.creeLe).toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>
              {estFacturee ? STATUTS_FACTURE[bon.facture.statut] : STATUTS[bon.statut]}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#888", marginBottom: 4 }}>Client</div>
          <div style={{ fontWeight: 600 }}>{bon.client.nom}</div>
          {bon.client.telephone && <div style={{ fontSize: 13 }}>{bon.client.telephone}</div>}
          {(bon.client.adresse || bon.client.ville) && (
            <div style={{ fontSize: 13 }}>{[bon.client.adresse, [bon.client.ville, bon.client.codePostal].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</div>
          )}
          {bon.client.garantieProlongee && (
            <div style={{ fontSize: 12, marginTop: 6, padding: "4px 8px", background: "#f2f0ea", borderRadius: 4, display: "inline-block" }}>
              🛡️ Garantie prolongée — #{bon.client.garantieProlongee}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: COLONNES_TRAVAUX, alignItems: "end", marginBottom: 8 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#888" }}>Détail des travaux</div>
          <div style={{ fontSize: 9, textTransform: "uppercase", color: "#aaa", textAlign: "right" }}>Hrs</div>
          <div style={{ fontSize: 9, textTransform: "uppercase", color: "#aaa", textAlign: "right" }}>Qté</div>
          <div style={{ fontSize: 9, textTransform: "uppercase", color: "#aaa", textAlign: "right" }}>Prix</div>
          <div style={{ fontSize: 9, textTransform: "uppercase", color: "#aaa", textAlign: "right" }}>Total</div>
        </div>
        {bon.problemes.map((pr, idx) => {
          const estMainOeuvre = (pr.categorieRevenu || "MAIN_OEUVRE") === "MAIN_OEUVRE";
          const heuresTache = estMainOeuvre
            ? pr.entreesTemps.filter((t) => t.fin).reduce((s, t) => s + dureeHeures(t.debut, t.fin), 0)
            : 0;
          const montantManuel = !estMainOeuvre ? (pr.facturePrixUnitaire || 0) * (pr.factureQte || 1) : 0;
          return (
          <div key={pr.id} style={{ marginBottom: 14, pageBreakInside: "avoid" }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>{idx + 1}. {pr.description}</div>

            {heuresTache > 0.005 && (
              <LigneTravail description="Main-d'œuvre" hrs={fmtHeures(heuresTache)} prix={tauxHoraireClient} total={heuresTache * tauxHoraireClient} />
            )}
            {!estMainOeuvre && montantManuel > 0.005 && (
              <LigneTravail description={pr.factureDescription || "Service"} qte={pr.factureQte || 1} prix={pr.facturePrixUnitaire || 0} total={montantManuel} />
            )}
            {pr.pieces.map((l) => (
              <LigneTravail key={l.id} description={l.piece.nom} qte={l.qte} prix={l.prix} total={l.qte * l.prix} />
            ))}

            {pr.photos.length > 0 && (
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {pr.photos.map((p) => (
                  <img key={p.id} src={p.url} alt="" style={{ width: 90, height: 90, objectFit: "cover", border: "1px solid #ddd", borderRadius: 4 }} />
                ))}
              </div>
            )}
          </div>
          );
        })}

        <div style={{ borderTop: "1px solid #ddd", marginTop: 20, paddingTop: 16 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "#888", marginBottom: 4 }}>Résumé du temps par employé (taux : {tauxHoraireClient.toFixed(2)} $/h)</div>
          {Object.values(parEmploye).length === 0 ? (
            <div style={{ fontSize: 13, color: "#888" }}>Aucun temps enregistré</div>
          ) : (
            Object.values(parEmploye).map((l) => (
              <div key={l.employe.id} style={{ fontSize: 13 }}>{l.employe.nom} — {fmtHeures(l.heures)}</div>
            ))
          )}
        </div>

        <div style={{ marginTop: 16, marginLeft: "auto", width: 260 }}>
          <LigneTotal label="Main-d'œuvre" valeur={totalMainOeuvre} />
          {totalAutresRevenus > 0 && <LigneTotal label="Autres services" valeur={totalAutresRevenus} />}
          <LigneTotal label="Pièces" valeur={totalPieces} />
          <LigneTotal label="Sous-total" valeur={sousTotalAvantEscompte} gras={escompteApplique === 0} bordureHaut />
          {escompteApplique > 0 && (
            <>
              <LigneTotal label={`Escompte${bon.escompteRaison ? ` (${bon.escompteRaison})` : ""}`} valeur={-escompteApplique} petit />
              <LigneTotal label="Sous-total après escompte" valeur={totalFacture} gras />
            </>
          )}
          <LigneTotal label={`TPS (${tpsTaux}%)`} valeur={tpsMontant} petit />
          <LigneTotal label={`TVQ (${tvqTaux}%)`} valeur={tvqMontant} petit />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: "2px solid #17150f" }}>
            <span style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase" }}>Total {estFacturee ? "" : "estimé "}(taxes incl.)</span>
            <span style={{ fontSize: 20, fontWeight: 700 }}>{totalAvecTaxes.toFixed(2)} $</span>
          </div>
        </div>

        <p style={{ fontSize: 10, color: "#999", marginTop: 30, textAlign: "center" }}>
          {nomEntreprise} — document généré le {new Date().toLocaleDateString("fr-CA", { timeZone: "America/Toronto" })}
        </p>
      </div>
    </div>
  );
}

function LigneTravail({ description, hrs, qte, prix, total }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: COLONNES_TRAVAUX, fontSize: 12, padding: "2px 0" }}>
      <span style={{ color: "#444" }}>{description}</span>
      <span style={{ textAlign: "right" }}>{hrs || ""}</span>
      <span style={{ textAlign: "right" }}>{qte || ""}</span>
      <span style={{ textAlign: "right" }}>{prix.toFixed(2)} $</span>
      <span style={{ textAlign: "right", fontWeight: 600 }}>{total.toFixed(2)} $</span>
    </div>
  );
}

function LigneTotal({ label, valeur, gras, petit, bordureHaut }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between",
      fontSize: petit ? 12 : 13, fontWeight: gras ? 700 : 400, color: petit ? "#666" : "#17150f",
      padding: "3px 0", borderTop: bordureHaut ? "1px solid #ddd" : "none", marginTop: bordureHaut ? 4 : 0,
    }}>
      <span>{label}</span>
      <span>{valeur.toFixed(2)} $</span>
    </div>
  );
}
