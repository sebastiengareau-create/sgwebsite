import { prisma } from "@/lib/prisma";
import { obtenirInfosEntreprise } from "@/lib/config";
import { locataireParJeton, bauxDuLocataire, filtreDocumentsLocataire, filtreReparationsLocataire } from "@/lib/immobilier";
import PortailLocataireClient from "./PortailLocataireClient";

// Portail d'un locataire (module Immobilier) : page publique, protégée par
// le lien secret qui lui est propre (Immobilier → sa fiche → Portail).
// Jamais indexée par les moteurs de recherche.
export const metadata = { robots: { index: false, follow: false } };

export default async function PortailLocataire(props) {
  const { jeton } = await props.params;
  const entreprise = await obtenirInfosEntreprise();
  const l = await locataireParJeton(jeton);
  if (!l) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "var(--bg)" }}>
        <div style={{ maxWidth: 420, textAlign: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: 24 }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>🔒</div>
          <h1 style={{ fontSize: 20, margin: "0 0 10px" }}>{entreprise.nomEntreprise}</h1>
          <p style={{ fontSize: 14, margin: 0, color: "var(--text-muted)" }}>Ce lien n'est plus valide. Demandez un nouveau lien à votre propriétaire{entreprise.telephone ? ` (${entreprise.telephone})` : ""}.</p>
        </div>
      </div>
    );
  }

  // Dernière visite, notée au plus une fois l'heure
  if (!l.dernierAccesPortail || Date.now() - l.dernierAccesPortail.getTime() > 3600000) {
    await prisma.locataireImmo.update({ where: { id: l.id }, data: { dernierAccesPortail: new Date() } });
  }

  const resume = await bauxDuLocataire(l.id);
  const [baux, documents, reparations, aSigner, releves31] = await Promise.all([
    prisma.bailImmo.findMany({
      where: { id: { in: resume.map((b) => b.id) } },
      select: {
        id: true, statut: true, dateDebut: true, dateFin: true, loyer: true, jourPaiement: true, services: true, nouveauLoyer: true, avisEnvoyeLe: true, reponseAvis: true, reponseAvisLe: true, reponseAvisPar: true,
        logement: { select: { id: true, numero: true, type: true, pieces: true, adresseCivique: true, immeuble: { select: { nom: true, adresse: true, ville: true, codePostal: true } } } },
        locataires: { select: { id: true, nom: true } },
        charges: { select: { id: true, date: true, type: true, description: true, montant: true } },
        paiements: { select: { id: true, date: true, montant: true, mode: true, reference: true } },
      },
      orderBy: { dateDebut: "desc" },
    }),
    prisma.documentImmo.findMany({
      where: filtreDocumentsLocataire(l.id, resume),
      select: { id: true, titre: true, categorie: true, date: true, description: true, taille: true, creeLe: true, signeLe: true, genre: true },
      orderBy: [{ date: { sort: "desc", nulls: "last" } }, { creeLe: "desc" }],
    }),
    prisma.reparationImmo.findMany({
      where: filtreReparationsLocataire(l.id, resume),
      select: {
        id: true, numero: true, titre: true, description: true, statut: true, priorite: true, datePrevue: true, dateFin: true, reponse: true, creeLe: true, locataireId: true,
        logement: { select: { numero: true, type: true } },
        fichiers: { select: { id: true, nom: true, typeMime: true } },
      },
      orderBy: { creeLe: "desc" },
    }),
    // Documents qu'il doit signer (lib/signatureImmo.js)
    prisma.signatureImmo.findMany({
      where: { locataireId: l.id, statut: "EN_ATTENTE" },
      select: { id: true, jeton: true, demandeLe: true, document: { select: { titre: true, genre: true, bailId: true } } },
      orderBy: { demandeLe: "desc" },
    }),
    // Relevés 31 produits par le propriétaire (Immobilier → Relevé 31)
    prisma.releve31Immo.findMany({
      where: { bailId: { in: resume.map((b) => b.id) }, produitLe: { not: null } },
      select: { id: true, annee: true, produitLe: true, bail: { select: { logement: { select: { numero: true, type: true, immeuble: { select: { nom: true } } } } } } },
      orderBy: { annee: "desc" },
    }),
  ]);

  return (
    <PortailLocataireClient
      jeton={jeton}
      locataire={{ id: l.id, nom: l.nom }}
      entreprise={{ nom: entreprise.nomEntreprise, telephone: entreprise.telephone, courriel: entreprise.courriel }}
      {...JSON.parse(JSON.stringify({ baux, documents, reparations, aSigner, releves31 }))}
    />
  );
}
