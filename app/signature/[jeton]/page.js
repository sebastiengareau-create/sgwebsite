import { prisma } from "@/lib/prisma";
import { obtenirInfosEntreprise, lignesEnteteEntreprise } from "@/lib/config";
import { signatureParJeton, modeReponse, reglementAAttester } from "@/lib/signatureImmo";
import { adresseLogement, ajouterMois } from "@/lib/immobilierCalculs";
import LogoClient from "../../components/LogoClient";
import SignatureClient from "./SignatureClient";

// Page publique de signature d'un document de l'immobilier (bail, avis de
// modification, document déposé) : le signataire le lit, puis signe ou
// refuse (lib/signatureImmo.js). Protégée par le lien secret propre à
// chaque signataire ; jamais indexée.
export const metadata = { robots: { index: false, follow: false } };

export default async function PageSignature(props) {
  const { jeton } = await props.params;
  const [entreprise, d] = await Promise.all([obtenirInfosEntreprise(), signatureParJeton(jeton)]);

  if (!d || d.statut === "ANNULE") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "var(--bg)" }}>
        <div style={{ maxWidth: 420, textAlign: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: 24 }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>🔒</div>
          <h1 style={{ fontSize: 20, margin: "0 0 10px" }}>{entreprise.nomEntreprise}</h1>
          <p style={{ fontSize: 14, margin: 0, color: "var(--text-muted)" }}>
            Ce lien n&apos;est plus valide. Communiquez avec votre propriétaire{entreprise.telephone ? ` (${entreprise.telephone})` : ""}.
          </p>
        </div>
      </div>
    );
  }

  // Première ouverture : notée (certificat de signature)
  if (!d.vuLe) await prisma.signatureImmo.update({ where: { id: d.id }, data: { vuLe: new Date() } });

  const doc = d.document;
  const mode = modeReponse(doc);
  const bail = doc.bailId
    ? await prisma.bailImmo.findUnique({
      where: { id: doc.bailId },
      select: { loyer: true, nouveauLoyer: true, dateFin: true, avisEnvoyeLe: true, logement: { select: { numero: true, type: true, adresseCivique: true, immeuble: { select: { nom: true, adresse: true, ville: true, codePostal: true } } } } },
    })
    : null;
  const reglementRemisLe = d.statut === "EN_ATTENTE" ? await reglementAAttester(d, doc) : null;
  const avis = mode === "AVIS" && bail?.dateFin ? {
    loyer: bail.loyer, nouveauLoyer: bail.nouveauLoyer ?? bail.loyer, finBail: bail.dateFin,
    debut: new Date(new Date(bail.dateFin).getTime() + 86400000), limite: bail.avisEnvoyeLe ? ajouterMois(bail.avisEnvoyeLe, 1) : null,
  } : null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "20px 16px 40px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 14, marginBottom: 16, borderBottom: "2px solid var(--text)" }}>
          <LogoClient alt={entreprise.nomEntreprise} width={84} height={56} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{entreprise.nomEntreprise}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.45 }}>
              {lignesEnteteEntreprise(entreprise).map((l) => <div key={l}>{l}</div>)}
            </div>
          </div>
        </header>
        <SignatureClient
          jeton={jeton}
          mode={mode}
          {...JSON.parse(JSON.stringify({
            demande: { nom: d.nom, role: d.role, statut: d.statut, message: d.message, signataireNom: d.signataireNom, signature: d.signature, reponduLe: d.reponduLe, reponseAvis: d.reponseAvis, note: d.note },
            document: { titre: doc.titre, signe: Boolean(doc.signeLe), empreinteSignee: doc.empreinteSignee, adresse: bail ? adresseLogement(bail.logement) : null },
            reglementRemisLe,
            parties: doc.signatures.filter((s) => s.statut !== "ANNULE").map((s) => ({ id: s.id, nom: s.nom, role: s.role, statut: s.statut, moi: s.id === d.id })),
            avis,
          }))}
          telephone={entreprise.telephone}
        />
      </div>
    </div>
  );
}
