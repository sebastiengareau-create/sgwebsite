import { redirect } from "next/navigation";
import { obtenirSession, aAccesSection } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { obtenirInfosEntreprise } from "@/lib/config";
import { dateAujourdhuiQuebec } from "@/lib/temps";
import { lignesAdresse } from "@/lib/adresse";
import { formaterNas, nasValide } from "@/lib/nas";
import { calculerFeuillets, CASES_T4, CASES_RL1, ANNEE_MAXIMUMS } from "@/lib/feuilletsFiscaux";
import BoutonImprimerRapport from "../../comptabilite/rapports/BoutonImprimerRapport";
import BoutonFermerPage from "@/app/components/BoutonFermerPage";

const fmt = (n) => Number(n || 0).toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Sommaires de fin d'année T4 / RL-1 : ?annee=AAAA (l'année précédente par
// défaut en début d'année, quand on produit les feuillets ; sinon l'année
// en cours)
export default async function FeuilletsFiscaux(props) {
  const searchParams = await props.searchParams;
  const session = await obtenirSession();
  if (!(await aAccesSection(session, "paie"))) redirect("/gerant");
  const modulePaie = await prisma.parametre.findUnique({ where: { cle: "module_paie" } });
  if (modulePaie?.valeur !== "actif") redirect("/gerant");

  const [anCourant, moisCourant] = dateAujourdhuiQuebec().split("-").map(Number);
  const anneeDefaut = moisCourant <= 3 ? anCourant - 1 : anCourant;
  const annee = /^\d{4}$/.test(searchParams?.annee || "") ? Number(searchParams.annee) : anneeDefaut;

  const [entreprise, { feuillets, totaux, nbBrouillons, maximumsAJour }] = await Promise.all([
    obtenirInfosEntreprise(),
    calculerFeuillets(annee),
  ]);
  const sansNas = feuillets.filter((f) => !nasValide(f.employe.nas));
  const avertissements = [
    !maximumsAJour && `Les cases de gains admissibles (24, 26, 56, G, I) utilisent les maximums de ${ANNEE_MAXIMUMS}, pas ceux de ${annee} : vérifie-les.`,
    nbBrouillons > 0 && `${nbBrouillons} paie${nbBrouillons > 1 ? "s" : ""} encore en brouillon cette année ne ${nbBrouillons > 1 ? "sont" : "est"} pas comptée${nbBrouillons > 1 ? "s" : ""}.`,
    sansNas.length > 0 && `NAS manquant ou invalide : ${sansNas.map((f) => f.employe.nom).join(", ")} — à ajouter dans la fiche de l'employé.`,
    !entreprise.numeroEmployeurArc && "Numéro d'employeur ARC manquant (Administrateur → Informations de l'entreprise).",
    !entreprise.numeroEmployeurRq && "Numéro d'identification Revenu Québec manquant (Administrateur → Informations de l'entreprise).",
  ].filter(Boolean);

  const annees = [anCourant, anCourant - 1, anCourant - 2];
  const styleCase = { padding: "5px 8px", borderBottom: "1px solid #e5e2da", fontSize: 12.5 };

  return (
    <div>
      <style>{`
        @media print {
          .cacher-impression { display: none !important; }
          body { background: white !important; }
          .feuille-employe { break-before: page; }
        }
        body { background: #f2f0ea; margin: 0; }
      `}</style>

      <div className="cacher-impression" style={{ padding: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <BoutonFermerPage retour="/gerant/paie" />
        <form method="get" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select name="annee" defaultValue={annee} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}>
            {(annees.includes(annee) ? annees : [annee, ...annees]).map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button type="submit" className="bouton-3d-sombre" style={{ padding: "9px 16px", borderRadius: 8, fontWeight: 700, fontSize: 13 }}>Changer l'année</button>
        </form>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <BoutonImprimerRapport />
          <a href={`/api/paie/feuillets/csv?annee=${annee}`} className="bouton-3d-sombre" style={{ padding: "10px 20px", borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
            📊 Excel (pour le comptable)
          </a>
        </div>
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", maxWidth: 640, textAlign: "center", margin: 0 }}>
          Le fichier Excel contient les NAS : garde-le en lieu sûr et ne l'envoie pas par courriel non protégé.
        </p>
      </div>

      <div style={{ maxWidth: 820, margin: "0 auto 40px", background: "white", color: "#17150f", padding: "36px 40px", fontFamily: "Arial, sans-serif" }}>
        <div style={{ borderBottom: "2px solid #17150f", paddingBottom: 14, marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>{entreprise.nomEntreprise}</h1>
          <p style={{ fontSize: 11.5, color: "#666", margin: "3px 0 0" }}>{[entreprise.adresseLigne1, entreprise.adresseLigne2].filter(Boolean).join(", ")}</p>
          <p style={{ fontSize: 11.5, color: "#666", margin: "3px 0 0" }}>
            ARC : {entreprise.numeroEmployeurArc || "—"} · Revenu Québec : {entreprise.numeroEmployeurRq || "—"}
          </p>
          <p style={{ fontSize: 17, fontWeight: 700, margin: "12px 0 0" }}>Sommaires T4 et RL-1 — année {annee}</p>
          <p style={{ fontSize: 11, color: "#666", margin: "4px 0 0", lineHeight: 1.45 }}>
            Montants tirés des paies versées en {annee} (date de versement). Ce document n'est pas un feuillet officiel : recopie
            ces montants dans les Formulaires Web T4 de l'ARC et dans le service de Revenu Québec, ou remets-le à ton comptable.
            Les paies du logiciel sont des estimations — vérifie que ces montants concordent avec ce qui a réellement été versé et remis.
          </p>
        </div>

        {avertissements.length > 0 && (
          <div style={{ background: "#fdf3e1", border: "1px solid #e8a33d", borderRadius: 6, padding: "10px 12px", marginBottom: 20, fontSize: 12, lineHeight: 1.5 }}>
            {avertissements.map((a) => <div key={a}>⚠️ {a}</div>)}
          </div>
        )}

        {feuillets.length === 0 ? (
          <p style={{ fontSize: 13, color: "#666" }}>Aucune paie versée en {annee}.</p>
        ) : (
          <>
            <h2 style={{ fontSize: 15, margin: "0 0 8px" }}>Sommaire de l'employeur — {feuillets.length} feuillet{feuillets.length > 1 ? "s" : ""}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 8 }}>
              <TableCases titre="T4 Sommaire (ARC)" styleCase={styleCase} lignes={[
                ["88", "Nombre de feuillets T4", String(feuillets.length)],
                ["14", "Revenus d'emploi", fmt(totaux.revenus)],
                ["18", "Cotisations des employés à l'AE", fmt(totaux.ae)],
                ["19", "Cotisations de l'employeur à l'AE", fmt(totaux.aeEmployeur)],
                ["22", "Impôt sur le revenu retenu", fmt(totaux.impotFederal)],
                ["80", "Total des retenues (18 + 19 + 22)", fmt(totaux.ae + totaux.aeEmployeur + totaux.impotFederal)],
              ]} />
              <TableCases titre="RL-1 Sommaire (Revenu Québec)" styleCase={styleCase} lignes={[
                ["", "Nombre de relevés 1", String(feuillets.length)],
                ["", "Cotisations au RRQ — employés", fmt(totaux.rrq)],
                ["", "Cotisations au RRQ — employeur", fmt(totaux.rrqEmployeur)],
                ["", "Cotisations au RQAP — employés", fmt(totaux.rqap)],
                ["", "Cotisations au RQAP — employeur", fmt(totaux.rqapEmployeur)],
                ["", "Impôt du Québec retenu", fmt(totaux.impotQuebec)],
              ]} />
            </div>
            <p style={{ fontSize: 10.5, color: "#777", margin: "0 0 4px", lineHeight: 1.45 }}>
              Les versements déjà faits aux gouvernements (T4 Sommaire case 82), le FSS, la cotisation CNESST et la contribution au
              développement de la main-d'œuvre ne sont pas calculés par le logiciel : prends-les dans tes relevés de versements.
            </p>

            {feuillets.map((f) => (
              <div key={f.employe.id} className="feuille-employe" style={{ marginTop: 28, paddingTop: 16, borderTop: "2px solid #17150f" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{f.employe.nom}</div>
                    {lignesAdresse(f.employe).map((l) => <div key={l} style={{ fontSize: 12, color: "#555" }}>{l}</div>)}
                  </div>
                  <div style={{ textAlign: "right", fontSize: 12.5 }}>
                    <div>NAS : <strong style={{ fontFamily: "monospace" }}>{nasValide(f.employe.nas) ? formaterNas(f.employe.nas) : "⚠️ manquant"}</strong></div>
                    {f.employe.numeroEmploye && <div style={{ color: "#555" }}>No d'employé : {f.employe.numeroEmploye}</div>}
                    <div style={{ color: "#555" }}>{f.nbPaies} paie{f.nbPaies > 1 ? "s" : ""} versée{f.nbPaies > 1 ? "s" : ""}</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
                  <TableCases titre="T4 — case 10 : QC" styleCase={styleCase} lignes={CASES_T4.map((c) => [c.t4, c.libelle, fmt(f.montants[c.cle])])} />
                  <TableCases titre="Relevé 1" styleCase={styleCase} lignes={CASES_RL1.map((c) => [c.rl1, c.libelle, fmt(f.montants[c.cle])])} />
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function TableCases({ titre, lignes, styleCase }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr><th colSpan={3} style={{ textAlign: "left", fontSize: 12, textTransform: "uppercase", color: "#666", padding: "4px 8px", background: "#f2f0ea" }}>{titre}</th></tr>
      </thead>
      <tbody>
        {lignes.map(([cas, libelle, montant]) => (
          <tr key={`${cas}-${libelle}`}>
            <td style={{ ...styleCase, fontWeight: 700, width: 38, fontFamily: "monospace" }}>{cas}</td>
            <td style={styleCase}>{libelle}</td>
            <td style={{ ...styleCase, textAlign: "right", fontFamily: "monospace", whiteSpace: "nowrap" }}>{montant}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
